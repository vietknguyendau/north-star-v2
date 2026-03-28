import React, { useState, useRef, useEffect } from "react";
import RulesPage from "./Rules";
import Sidebets from "./Sidebets";
import TournamentHistory from "./History";
import SeasonStandings from "./Season";
import HandicapTracker from "./Handicap";
import { searchCourses } from "./mnCourses";
import { db, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc
} from "firebase/firestore";
import { SKILL_LEVELS, DEFAULT_PAR, DEFAULT_YARDS, HCP_STROKES, TOURNAMENT_ID } from "./constants";
import { hashPin, toPM, lastFilledIdx, holesPlayed, calcGrossToPar, calcCourseHandicap, calcNet, scoreLabel, scoreClass } from "./lib/scoring";
import { calcHoleRange } from "./lib/handicap";
import { useAuth } from "./contexts/AuthContext";
import { usePlayers } from "./contexts/PlayersContext";
import { useCourse } from "./contexts/CourseContext";
import { useTournament } from "./contexts/TournamentContext";

// ── Error Boundary — shows friendly message instead of black screen
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{minHeight:"100vh",background:"#080c08",color:"#e4dcc8",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"Georgia,serif"}}>
        <div style={{maxWidth:480,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>⛳</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,color:"#c8a830",marginBottom:12}}>SOMETHING WENT WRONG</div>
          <p style={{fontSize:14,color:"#a09880",lineHeight:1.8,marginBottom:24}}>The app hit an error loading. Try refreshing the page. If it keeps happening, the commissioner is on it.</p>
          <button onClick={()=>window.location.reload()} style={{background:"#c8a830",color:"#060a06",border:"none",padding:"12px 32px",fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:2,cursor:"pointer",borderRadius:3}}>
            RELOAD PAGE
          </button>
          <div style={{marginTop:16,fontSize:11,color:"#607060",fontFamily:"monospace"}}>{this.state.error?.message}</div>
        </div>
      </div>
    );
    return this.props.children;
  }
}


// ─── Secrets (from environment — never hardcode) ─────────────────────────────
const JOIN_CODE       = process.env.REACT_APP_JOIN_CODE;
const LEAGUE_PASSWORD = process.env.REACT_APP_LEAGUE_PASSWORD;
const ADMIN_PIN       = process.env.REACT_APP_ADMIN_PIN;

// ─── Helpers (imported from lib/scoring and lib/handicap) ────────────────────


// ═════════════════════════════════════════════════════════════════════════════
// ── AdminView as standalone component to prevent remount on parent re-render

// ── PIN Reset Button (used in AdminView per player)
function PinResetButton({ player, notify }) {
  const [open, setOpen]       = React.useState(false);
  const [newPin, setNewPin]   = React.useState("");
  const [saving, setSaving]   = React.useState(false);

  const save = async () => {
    if (newPin.length !== 4) return;
    setSaving(true);
    try {
      const hash = await hashPin(newPin);
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "players", player.id), { pinHash: hash }, { merge: true });
      setOpen(false);
      setNewPin("");
      notify(player.name + "'s PIN updated.");
    } catch(e) { console.error(e); notify("Failed to update PIN — check connection.", "error"); }
    setSaving(false);
  };

  if (!open) return (
    <button onClick={()=>setOpen(true)}
      style={{padding:"5px 10px",fontSize:11,fontFamily:"'Bebas Neue'",letterSpacing:1,
        background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",
        borderRadius:3,cursor:"pointer",whiteSpace:"nowrap"}}>
      🔑 PIN
    </button>
  );

  return (
    <div style={{display:"flex",gap:4,alignItems:"center"}}>
      <input type="password" maxLength={4} placeholder="New PIN"
        value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,"").slice(0,4))}
        style={{width:80,padding:"5px 8px",fontSize:13,background:"var(--bg3)",
          border:"1px solid var(--gold-dim)",borderRadius:3,color:"var(--text)",textAlign:"center"}}/>
      <button onClick={save} disabled={saving||newPin.length!==4}
        style={{padding:"5px 8px",fontSize:11,fontFamily:"'Bebas Neue'",letterSpacing:1,
          background:"var(--gold)",color:"#060a06",border:"none",borderRadius:3,cursor:"pointer"}}>
        {saving?"...":"SAVE"}
      </button>
      <button onClick={()=>{setOpen(false);setNewPin("");}}
        style={{padding:"5px 6px",background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14}}>✕</button>
    </div>
  );
}


// ── One-Off Tournament Creator (used inside AdminView)
function OneOffCreator({ players, notify, courseLibrary, pars }) {
  const [title,    setTitle]    = React.useState("");
  const [date,     setDate]     = React.useState("");
  const [course,   setCourse2]  = React.useState("");
  const [notes,    setNotes]    = React.useState("");
  const [saving,   setSaving]   = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [tourneys, setTourneys] = React.useState([]);
  const [active,   setActive]   = React.useState(null); // active one-off from Firebase

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db,"tournaments",TOURNAMENT_ID,"one_off_tournaments"), snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      setTourneys(arr);
    });
    const unsub2 = onSnapshot(doc(db,"tournaments",TOURNAMENT_ID,"settings","active_oneoff"), snap => {
      setActive(snap.exists() ? snap.data() : null);
    });
    return () => { unsub(); unsub2(); };
  }, []);

  const [password,   setPassword]   = React.useState("");
  const [courseInfo, setCourseInfo] = React.useState(null);

  const startTournament = async () => {
    if (!title.trim()) { notify("Enter a title before starting.", "error"); return; }
    if (!window.confirm(`Start "${title.trim()}"? Players can join and enter scores immediately.`)) return;
    setStarting(true);
    try {
      const pwHash = password.trim() ? await hashPin(password.trim()) : null;
      const oneOffId = `oneoff-${Date.now()}`;
      const tData = {
        id: oneOffId,
        title: title.trim(),
        date: date || new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
        course: course.trim(), notes: notes.trim(), startedAt: Date.now(),
        courseDetails: courseInfo || null,
        pwHash, hasPassword: !!password.trim(),
      };
      await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"active_tournaments",oneOffId), tData);
      await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"settings","active_oneoff"), tData);
      setTitle(""); setDate(""); setCourse2(""); setNotes(""); setCourseInfo(null); setPassword("");
      notify(`"${title.trim()}" started! Players can now join and enter scores. 🏌️`);
    } catch(e) { console.error(e); notify("Failed to start tournament — check connection.", "error"); }
    setStarting(false);
  };

  const lockAndSave = async () => {
    const t = active || { title: title.trim(), date: date, course: course.trim(), notes: notes.trim() };
    if (!t.title) { notify("No active tournament to lock.", "error"); return; }
    setSaving(true);
    // Only snapshot players tagged to this tournament (if password protected), otherwise all with scores
    const eligible = t.id
      ? players.filter(p => p.scores?.some(Boolean) && (!t.hasPassword || p.oneOffId === t.id))
      : players.filter(p => p.scores?.some(Boolean));
    const snapPars = pars || DEFAULT_PAR;
    const snapCourse = active?.courseDetails ? { slope: active.courseDetails.slope, rating: active.courseDetails.rating } : null;
    const snap = eligible
      .map(p => {
        const result = calcHoleRange(p.scores, p.handicap, snapCourse, snapPars);
        const gross = result?.gross ?? p.scores.filter(Boolean).reduce((a,b)=>a+b,0);
        const net = result ? result.gross - result.strokes : gross;
        return { id:p.id, name:p.name, handicap:p.handicap, flight:p.flight, gross, net, scores:[...p.scores] };
      })
      .sort((a,b) => a.net - b.net);

    try {
      const id = `oneoff-${Date.now()}`;
      await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"one_off_tournaments",id), {
        id, title: t.title,
        date: t.date || new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
        course: t.course || "", notes: t.notes || "",
        courseDetails: t.courseDetails || null,
        snapshot: snap, createdAt: Date.now(),
      });
      if (t.id) await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"active_tournaments",t.id));
      await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"settings","active_oneoff"));
      setTitle(""); setDate(""); setCourse2(""); setNotes(""); setCourseInfo(null);
      notify(`"${t.title}" locked and saved! View it in History. 🏆`);
    } catch(e) { console.error(e); notify("Failed to save tournament — check connection.", "error"); }
    setSaving(false);
  };

  const cancelActive = async (t) => {
    const tourney = t || active;
    if (!tourney) return;
    if (!window.confirm(`Cancel "${tourney.title}"? It won't be saved.`)) return;
    try {
      if (tourney.id) await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"active_tournaments",tourney.id));
      await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"settings","active_oneoff"));
      notify("Tournament cancelled.");
    } catch(e) { console.error(e); notify("Failed to cancel tournament — check connection.", "error"); }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"one_off_tournaments",id));
    notify("Tournament deleted.");
  };

  const playersWithScores = players.filter(p=>p.scores?.some(Boolean)).length;

  return (
    <div>
      {/* Active tournament banner */}
      {active && (
        <div style={{padding:"16px 20px",background:"#0a1a0a",border:"1px solid var(--green)",borderRadius:6,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:4}}>🟢 TOURNAMENT IN PROGRESS</div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,color:"var(--text)"}}>{active.title}</div>
              <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{active.date}{active.course?` · ${active.course}`:""}</div>
              {active.courseDetails && (
                <div style={{fontSize:11,color:"var(--text3)",marginTop:3}}>
                  Par {active.courseDetails.par} · Rating {active.courseDetails.rating} · Slope {active.courseDetails.slope}
                </div>
              )}
              <div style={{fontSize:12,color:"var(--green)",marginTop:6}}>{playersWithScores} players have entered scores</div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="btn-gold" style={{fontSize:12}} onClick={lockAndSave} disabled={saving}>
                {saving?"SAVING…":"📸 LOCK IN & SAVE RESULTS"}
              </button>
              <button className="btn-danger" style={{fontSize:11}} onClick={cancelActive}>✕ CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Setup form — always visible to support multiple simultaneous tournaments */}
      <div className="card" style={{padding:20,marginBottom:16}}>
          <div style={{fontSize:13,color:"var(--text3)",marginBottom:14,lineHeight:1.6}}>
            Set up a new tournament. Multiple tournaments can run simultaneously — each gets its own leaderboard.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>TOURNAMENT TITLE *</div>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. July 4th Scramble" style={{width:"100%",fontSize:15,padding:"9px 12px"}}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>DATE</div>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                style={{width:"100%",colorScheme:"dark"}}/>
              {date && <div style={{fontSize:11,color:"var(--text3)",marginTop:3}}>
                {new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
              </div>}
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>COURSE</div>
              <CourseSearch onSelect={c=>{
                setCourse2(c.name);
                setCourseInfo(c);
              }}/>
              {/* Library picker */}
              {courseLibrary && courseLibrary.length > 0 && (
                <div style={{marginTop:8}}>
                  <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>── OR PICK FROM YOUR LIBRARY</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {courseLibrary.map(c=>(
                      <button key={c.id}
                        onClick={()=>{ setCourse2(c.name); setCourseInfo(c); }}
                        style={{fontSize:11,padding:"5px 12px",fontFamily:"'Bebas Neue'",letterSpacing:1,
                          background: courseInfo?.name===c.name?"var(--gold)":"var(--bg3)",
                          border:`1px solid ${courseInfo?.name===c.name?"var(--gold)":"var(--border)"}`,
                          color: courseInfo?.name===c.name?"#060a06":"var(--text2)",
                          borderRadius:4,cursor:"pointer"}}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {courseInfo && (
                <div style={{marginTop:8,padding:"10px 14px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:4,fontSize:12,color:"var(--text3)",display:"flex",gap:20,flexWrap:"wrap"}}>
                  <span>Par <strong style={{color:"var(--text)"}}>{courseInfo.par}</strong></span>
                  <span>Rating <strong style={{color:"var(--text)"}}>{courseInfo.rating}</strong></span>
                  <span>Slope <strong style={{color:"var(--text)"}}>{courseInfo.slope}</strong></span>
                  <span style={{color:"var(--text2)"}}>{courseInfo.city}</span>
                </div>
              )}
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>NOTES (optional)</div>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Scramble format, $10/player" style={{width:"100%"}}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>TOURNAMENT PASSWORD (optional)</div>
              <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="e.g. eagles2026 — share with players to join" style={{width:"100%"}}/>
              <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Players enter this on Login or Register to join this tournament's leaderboard.</div>
            </div>
          </div>
          <button className="btn-gold" style={{fontSize:14,padding:"12px 28px"}} onClick={startTournament} disabled={starting||!title.trim()}>
            {starting?"STARTING…":"🚀 START TOURNAMENT"}
          </button>
        </div>

      {/* Saved list */}
      {tourneys.length > 0 && (
        <div>
          <div style={{fontSize:10,color:"var(--text3)",letterSpacing:2,fontFamily:"'Bebas Neue'",marginBottom:8}}>SAVED TOURNAMENTS</div>
          {tourneys.map(t=>(
            <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:4,marginBottom:6}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{t.title}</div>
                <div style={{fontSize:11,color:"var(--text3)"}}>{t.date}{t.course?` · ${t.course}`:""} · {(t.snapshot||[]).length} players</div>
              </div>
              <button className="btn-danger" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>remove(t.id,t.title)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminView({ course, players, adminUnlocked, setAdminUnlocked, pinInput, setPinInput,
  pinError, setPinError, savePlayer, removePlayerDb, saveCourse, setCourse, updateField, notify,
  scorecardUploads, courseLibrary, saveCourseToLibrary, pars }) {
    const [localCourse, setLocalCourse] = useState(course || {});
    const [saving, setSaving] = useState(false);
    const [courseKey, setCourseKey] = useState(0);

    // Refs for text inputs — avoid re-render on type but sync when course selected
    const nameRef    = React.useRef(null);
    const cityRef    = React.useRef(null);
    const slopeRef   = React.useRef(null);
    const ratingRef  = React.useRef(null);
    const descRef    = React.useRef(null);
    const parRefs    = React.useRef(Array.from({length:18}, ()=>React.createRef()));
    const yardsRefs  = React.useRef(Array.from({length:18}, ()=>React.createRef()));

    // When courseKey changes (new course selected), force-update all input DOM values
    React.useEffect(() => {
      if (nameRef.current)   nameRef.current.value   = localCourse.name   || "";
      if (cityRef.current)   cityRef.current.value   = localCourse.city   || "";
      if (slopeRef.current)  slopeRef.current.value  = localCourse.slope  || "";
      if (ratingRef.current) ratingRef.current.value = localCourse.rating || "";
      if (descRef.current)   descRef.current.value   = localCourse.description || "";
      const par   = localCourse.par   || DEFAULT_PAR;
      const yards = localCourse.yards;
      parRefs.current.forEach((ref, i)   => { if (ref.current) ref.current.value = par[i] || 4; });
      yardsRefs.current.forEach((ref, i) => { if (ref.current) ref.current.value = (yards && yards[i]) ? yards[i] : ""; });
    }, [courseKey]);

    const collectAndSave = async () => {
      // Read all values directly from DOM refs before saving
      const par   = parRefs.current.map((ref,i)   => parseInt(ref.current?.value)   || DEFAULT_PAR[i]);
      const yards = yardsRefs.current.map((ref,i) => parseInt(ref.current?.value)   || DEFAULT_YARDS[i]);
      const updated = {
        ...localCourse,
        name:        nameRef.current?.value   || localCourse.name,
        city:        cityRef.current?.value   || localCourse.city,
        slope:       parseInt(slopeRef.current?.value)  || localCourse.slope,
        rating:      parseFloat(ratingRef.current?.value) || localCourse.rating,
        description: descRef.current?.value  || localCourse.description,
        par, yards,
      };
      setLocalCourse(updated);
      return updated;
    };

    const saveAll = async () => {
      setSaving(true);
      const updated = await collectAndSave();
      await saveCourse(updated);
      setCourse(updated);
      setSaving(false);
      notify("Course saved!");
    };

    const saveToLib = async () => {
      const updated = await collectAndSave();
      await saveCourseToLibrary(updated);
    };

    if (!adminUnlocked) return (
      <div className="fade-up" style={{maxWidth:340,margin:"0 auto",textAlign:"center"}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:4,color:"var(--green)",marginBottom:10}}>COMMISSIONER ACCESS</div>
        <h2 style={{fontFamily:"'Bebas Neue'",fontSize:28,marginBottom:24}}>ADMIN LOGIN</h2>
        <div className="card" style={{padding:28}}>
          <div className="section-label" style={{textAlign:"left"}}>PIN</div>
          <input type="password" value={pinInput} onChange={e=>setPinInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"){ if(pinInput===ADMIN_PIN)setAdminUnlocked(true); else setPinError(true); }}}
            placeholder="••••" style={{width:"100%",fontSize:24,letterSpacing:8,textAlign:"center",marginBottom:10}}/>
          {pinError && <div style={{color:"var(--red)",fontSize:13,marginBottom:10}}>Incorrect PIN.</div>}
          <button className="btn-gold" style={{width:"100%"}}
            onClick={()=>{ if(pinInput===ADMIN_PIN){setAdminUnlocked(true);setPinError(false);}else setPinError(true); }}>
            UNLOCK
          </button>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:12}}>Default PIN: 1234</div>
        </div>
      </div>
    );

    return (
      <div className="fade-up">
        {/* Join code banner */}


        {/* Course settings */}
        <div className="section-label">── COURSE SETTINGS</div>
        <div className="card" style={{padding:20,marginBottom:24}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            {/* Course search */}
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>SEARCH MINNESOTA COURSES</div>
              <CourseSearch onSelect={c=>{
                setLocalCourse(prev=>({...prev,name:c.name,city:c.city,slope:c.slope,rating:c.rating,
                  par:DEFAULT_PAR,
                  yards:Array(18).fill(""),
                }));
                setCourseKey(k=>k+1);
              }}/>
            </div>

            {/* Course Library Picker */}
            {courseLibrary.length > 0 && (
              <div style={{gridColumn:"1/-1"}}>
                <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:6}}>── OR LOAD FROM YOUR LIBRARY ({courseLibrary.length} saved)</div>
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto",
                  background:"var(--bg)",border:"1px solid var(--border)",borderRadius:6,padding:8}}>
                  {courseLibrary.map(c => (
                    <div key={c.id}
                      onClick={()=>{
                        setLocalCourse(c);
                        setCourseKey(k=>k+1);
                        notify(`Loaded "${c.name}" from library`);
                      }}
                      style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                        padding:"9px 12px",borderRadius:4,cursor:"pointer",background:"var(--bg2)",
                        border:"1px solid var(--border)",transition:"border-color 0.15s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--gold)"}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                      <div>
                        <div style={{fontSize:14,color:"var(--text)",fontWeight:600}}>{c.name}</div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>{c.city}</div>
                      </div>
                      <div style={{textAlign:"right",fontSize:11,color:"var(--text3)"}}>
                        <div>Par {(c.par||[]).reduce((a,b)=>a+b,0)||"—"}</div>
                        <div>Slope {c.slope} · {c.rating}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {[["Course Name","name",nameRef],["City / State","city",cityRef],["Slope Rating","slope",slopeRef],["Course Rating","rating",ratingRef]].map(([lbl,key,ref])=>(
              <div key={key}>
                <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>{lbl.toUpperCase()}</div>
                <input ref={ref} defaultValue={localCourse[key]??""} type={key==="slope"||key==="rating"?"number":"text"}
                  step={key==="rating"?".1":undefined}
                  style={{width:"100%"}}/>
              </div>
            ))}
          </div>

          {/* Par per hole */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:8}}>PAR PER HOLE (1–18)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {Array.from({length:18},(_,i)=>(
                <div key={i} style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>{i+1}</div>
                  <input ref={parRefs.current[i]} type="number" min="3" max="6"
                    defaultValue={(localCourse.par||DEFAULT_PAR)[i]}
                    style={{width:40,textAlign:"center",padding:"4px 2px"}}/>
                </div>
              ))}
            </div>
          </div>

          {/* Yardage per hole */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:8}}>YARDAGE PER HOLE (1–18)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {Array.from({length:18},(_,i)=>(
                <div key={i} style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>{i+1}</div>
                  <input ref={yardsRefs.current[i]} type="number" min="100" max="700"
                    defaultValue={(localCourse.yards||DEFAULT_YARDS)[i]}
                    style={{width:52,textAlign:"center",padding:"4px 2px"}}/>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>DESCRIPTION</div>
            <textarea ref={descRef} defaultValue={localCourse.description??""} rows={3} style={{width:"100%",resize:"vertical"}}/>
          </div>

          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="btn-gold" onClick={saveAll} disabled={saving} style={{fontSize:13,flex:1}}>
              {saving?"SAVING…":"SAVE AS ACTIVE COURSE"}
            </button>
            <button className="btn-ghost" onClick={saveToLib} style={{fontSize:13,flex:1}}>
              📚 SAVE TO LIBRARY
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="section-label">── PLAYER ROSTER ({players.length} players)</div>
        <div className="card" style={{overflow:"hidden",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 80px 150px auto auto",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
            <span>NAME</span><span>HCP</span><span>SKILL LEVEL</span><span>PIN</span><span></span>
          </div>
          {players.map(p=>{
          const upload = scorecardUploads?.[p.id];
          return (<React.Fragment key={p.id}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px 150px auto auto",padding:"10px 16px",borderBottom:"1px solid var(--border)",alignItems:"center",gap:8}}>
              <input defaultValue={p.name} key={p.id+"-name"} onBlur={e=>updateField(p.id,"name",e.target.value)} style={{width:"100%",padding:"5px 8px"}}/>
              <input type="number" defaultValue={p.handicap} key={p.id+"-hcp"} onBlur={e=>updateField(p.id,"handicap",e.target.value)} min="0" max="54" style={{width:65,borderColor:"var(--gold-dim)"}} title="Commissioner verified handicap"/>
              <select value={p.flight} onChange={e=>updateField(p.id,"flight",e.target.value)} style={{width:"100%"}}>
                {SKILL_LEVELS.map(f=><option key={f}>{f}</option>)}
              </select>
              <PinResetButton player={p} notify={notify}/>
              <button className="btn-danger" onClick={()=>removePlayerDb(p.id)}>✕</button>
            </div>
            {/* Scorecard verification panel */}
            {!scorecardUploads?.[p.id]?.url && (
              <div style={{padding:"6px 12px 10px",fontSize:11,color:"var(--text3)",fontStyle:"italic",borderTop:"1px solid var(--border)"}}>
                No scorecard uploaded yet.
              </div>
            )}
            {scorecardUploads?.[p.id]?.url && (
              <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)",display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap",background:"var(--bg3)"}}>
                <img src={scorecardUploads[p.id].url} alt="Scorecard" style={{width:100,height:70,objectFit:"cover",borderRadius:3,border:"1px solid var(--border2)",cursor:"pointer"}}
                  onClick={()=>window.open(scorecardUploads[p.id].url,"_blank")}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"var(--text3)",marginBottom:6}}>📸 Uploaded: {scorecardUploads[p.id].uploadedAt}</div>
                  {scorecardUploads[p.id].verified ? (
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,color:"var(--green)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>✓ VERIFIED · {scorecardUploads[p.id].verifiedAt}</span>
                      <button className="btn-ghost" style={{fontSize:10,padding:"2px 8px",color:"var(--amber)",borderColor:"var(--amber)"}}
                        onClick={async()=>{ try { await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"scorecard_uploads",p.id),{...scorecardUploads[p.id],verified:false}); notify("Verification removed."); } catch(e) { console.error(e); notify("Failed — check connection.","error"); } }}>
                        UNVERIFY
                      </button>
                    </div>
                  ) : (
                    <button className="btn-gold" style={{fontSize:11,padding:"5px 14px"}}
                      onClick={async()=>{ try { await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"scorecard_uploads",p.id),{...scorecardUploads[p.id],verified:true,verifiedAt:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}); notify(`${p.name} verified! ✓`); } catch(e) { console.error(e); notify("Failed — check connection.","error"); } }}>
                      ✓ MARK AS VERIFIED
                    </button>
                  )}
                </div>
              </div>
            )}
          </React.Fragment>);
        })}
          {players.length===0 && <div style={{padding:24,textAlign:"center",color:"var(--text3)",fontSize:13}}>No players yet. They'll appear here once they register.</div>}
        </div>
        <button className="btn-gold" style={{fontSize:13}} onClick={async()=>{
          const np={id:`player-${Date.now()}`,name:"New Player",handicap:0,flight:"Mid (13-20)",scores:Array(18).fill(null)};
          await savePlayer(np);
          notify("Player added.");
        }}>+ ADD PLAYER</button>

        {/* ── Email Export */}
        {(() => {
          const withEmail = players.filter(p=>p.email);
          const noEmail   = players.filter(p=>!p.email);
          const allEmails = withEmail.map(p=>p.email).join(", ");
          return (
            <div className="card" style={{padding:20,marginTop:16}}>
              <div className="section-label" style={{marginBottom:10}}>── EMAIL LIST ({withEmail.length} of {players.length} players)</div>
              {withEmail.length > 0 ? (
                <>
                  <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:4,padding:"12px 14px",fontSize:12,fontFamily:"'DM Mono'",color:"var(--text2)",lineHeight:1.8,wordBreak:"break-all",marginBottom:12,maxHeight:120,overflowY:"auto"}}>
                    {allEmails}
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button className="btn-gold" style={{fontSize:12}} onClick={()=>{
                      navigator.clipboard.writeText(allEmails);
                      notify("Emails copied to clipboard! ✓");
                    }}>📋 COPY ALL EMAILS</button>
                    <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{
                      window.open(`mailto:?bcc=${encodeURIComponent(allEmails)}`,"_blank");
                    }}>✉️ OPEN IN MAIL APP</button>
                  </div>
                  {noEmail.length > 0 && (
                    <div style={{fontSize:11,color:"var(--amber)",marginTop:10}}>
                      ⚠ {noEmail.length} player{noEmail.length>1?"s":""} without email: {noEmail.map(p=>p.name).join(", ")}
                    </div>
                  )}
                </>
              ) : (
                <div style={{fontSize:13,color:"var(--text3)",fontStyle:"italic"}}>No player emails on file yet.</div>
              )}
            </div>
          );
        })()}

        {/* ── One-Off Tournament Creator */}
        <div style={{marginTop:32}}>
          <div className="section-label">── ONE-OFF TOURNAMENTS</div>
          <OneOffCreator players={players} notify={notify} courseLibrary={courseLibrary} pars={pars} />
        </div>
      </div>
    );
  
}




// ── CTP Distance Entry Component
const CtpDistanceEntry = ({ player, holeIdx, ctpBet, notify }) => {
  const [feet, setFeet] = React.useState("");
  const [inches, setInches] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!feet || feet < 0) { notify("Enter a valid distance.", "error"); return; }
    setSaving(true);
    const ctpKey = `hole_${holeIdx}`;
    const updated = {
      ...ctpBet,
      entries: {
        ...ctpBet.entries,
        [player.id]: {
          ...ctpBet.entries[player.id],
          feet: parseInt(feet),
          inches: parseInt(inches) || 0,
          totalInches: parseInt(feet) * 12 + (parseInt(inches) || 0),
          playerName: player.name,
          submittedAt: new Date().toISOString(),
        }
      }
    };
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "ctp_bets", ctpKey), updated);
      notify("Distance submitted! Good luck 🎯");
    } catch(e) { console.error(e); notify("Failed to submit distance — check connection.", "error"); }
    setSaving(false);
  };

  return (
    <div style={{marginTop:8}}>
      <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>Enter your distance to the pin:</div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
        <input type="number" value={feet} onChange={e=>setFeet(e.target.value)} placeholder="Feet"
          style={{width:70,padding:"8px 10px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--text)",fontSize:15,textAlign:"center"}}/>
        <span style={{color:"var(--text3)"}}>ft</span>
        <input type="number" value={inches} onChange={e=>setInches(e.target.value)} placeholder="In" min="0" max="11"
          style={{width:60,padding:"8px 10px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--text)",fontSize:15,textAlign:"center"}}/>
        <span style={{color:"var(--text3)"}}>in</span>
        <button className="btn-gold" style={{fontSize:12,padding:"8px 16px"}} onClick={submit} disabled={saving||!feet}>
          {saving?"...":"SUBMIT"}
        </button>
      </div>
    </div>
  );
};

// ── CTP Leaderboard Component (shown in Sidebets tab)
const CtpLeaderboard = ({ ctpBets, pars, players }) => {
  const par3Holes = pars.map((p,i) => p===3 ? i : -1).filter(i => i !== -1);
  const activeBets = par3Holes.filter(hIdx => ctpBets[`hole_${hIdx}`]?.active);
  if (activeBets.length === 0) return (
    <div style={{textAlign:"center",padding:"32px 20px",color:"var(--text3)"}}>
      <div style={{fontSize:32,marginBottom:8}}>📍</div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2}}>NO ACTIVE CTP BETS</div>
    </div>
  );
  return (
    <div>
      {activeBets.map(hIdx => {
        const bet = ctpBets[`hole_${hIdx}`];
        const entries = Object.entries(bet.entries || {})
          .filter(([,e]) => e.feet !== undefined)
          .sort(([,a],[,b]) => a.totalInches - b.totalInches);
        return (
          <div key={hIdx} className="card" style={{marginBottom:16,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",background:"var(--bg3)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,color:"var(--gold)"}}>📍 HOLE {hIdx+1} — CLOSEST TO PIN</div>
              <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>{Object.keys(bet.entries||{}).length} LOCKED IN</div>
            </div>
            {entries.length === 0 ? (
              <div style={{padding:"16px",fontSize:13,color:"var(--text3)",fontStyle:"italic"}}>No distances entered yet.</div>
            ) : entries.map(([pid, entry], idx) => (
              <div key={pid} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12,
                background:idx===0?"#1c1600":"transparent"}}>
                <span style={{fontFamily:"'Bebas Neue'",fontSize:18,color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)",minWidth:36}}>
                  {idx===0?"🏆":idx===1?"2ND":"3RD".slice(0,idx===2?3:0)||`${idx+1}`}
                </span>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600}}>{entry.playerName}</div>
                </div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:18,color:idx===0?"var(--gold)":"var(--text2)"}}>
                  {entry.feet}'{entry.inches}"
                </div>
              </div>
            ))}
            {Object.entries(bet.entries||{}).filter(([,e])=>e.lockedIn && e.feet===undefined).map(([pid,e])=>(
              <div key={pid} style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12,opacity:0.5}}>
                <span style={{fontSize:11,color:"var(--amber)",fontFamily:"'Bebas Neue'",letterSpacing:1,minWidth:36}}>TBD</span>
                <div style={{fontSize:14,color:"var(--text3)"}}>{players.find(p=>p.id===pid)?.name || "Player"}</div>
                <div style={{fontSize:11,color:"var(--amber)",marginLeft:"auto"}}>⏳ PLAYING</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ── Leaderboard Table Component
const LeaderboardTable = ({ players, pars, scorecardUploads, calcNet, calcGrossToPar, holesPlayed, toPM, setSelectedPid, setScreen, course }) => (
  <div style={{marginBottom:32}}>
    <div className="card" style={{overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"48px 1fr 60px 72px 72px 72px 52px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
        <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>THRU</span>
        <span style={{textAlign:"center"}}>GROSS</span><span style={{textAlign:"center"}}>+/- PAR</span>
        <span style={{textAlign:"center"}}>NET</span><span style={{textAlign:"center"}}>HCP</span>
      </div>
      {players.map((player,idx)=>{
        const net=calcNet(player,pars,course), gross=calcGrossToPar(player,pars), thru=holesPlayed(player);
        const rawGross = player.scores.slice(0,thru).filter(Boolean).reduce((a,b)=>a+b,0);
        const lead=idx===0&&net!==null;
        return (
          <div key={player.id} className="player-row"
            style={{display:"grid",gridTemplateColumns:"48px 1fr 60px 72px 72px 72px 52px",padding:"12px 16px",alignItems:"center",
              borderLeft:lead?"3px solid var(--gold)":"3px solid transparent"}}
            onClick={()=>{ setSelectedPid(player.id); setScreen("scorecard"); }}>
            <span style={{fontFamily:"'Bebas Neue'",fontSize:20,color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
              {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
            </span>
            <div>
              <div style={{fontSize:15,color:lead?"var(--text)":"var(--text2)",fontWeight:600,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {player.name}
                {holesPlayed(player)>0 && !scorecardUploads[player.id]?.url && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--amber)",border:"1px solid var(--amber)",borderRadius:2,padding:"1px 4px"}}>UNVERIFIED</span>}
                {scorecardUploads[player.id]?.url && !scorecardUploads[player.id]?.verified && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--gold)",border:"1px solid var(--gold-dim)",borderRadius:2,padding:"1px 4px"}}>PENDING ⏳</span>}
                {scorecardUploads[player.id]?.verified && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--green)",border:"1px solid var(--green-dim)",borderRadius:2,padding:"1px 4px"}}>✓ VERIFIED</span>}
              </div>
              <div style={{fontSize:10,color:"var(--text3)"}}>{`HCP ${player.handicap}`}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:14,color:thru===18?"var(--green)":"var(--text)"}}>{thru===18?"F":thru||"—"}</div>
              <div style={{fontSize:9,color:"var(--text3)",letterSpacing:1}}>{thru===18?"FINAL":thru>0?"THRU":"—"}</div>
            </div>
            <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:15,color:"var(--text3)"}}>{rawGross||"—"}</div>
            <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:15,color:gross>0?"var(--amber)":gross<0?"var(--gold)":"var(--text)"}}>{gross!==null?toPM(gross):"—"}</div>
            <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:18,fontWeight:700,color:net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"}}>{toPM(net)}</div>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Scorecard Upload Component
const ScorecardUpload = ({ player, upload, notify }) => {
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState("");
  const allFilled = player.scores.filter(Boolean).length >= 9;

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadErr("Please upload an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadErr("Image too large. Max 10MB."); return; }
    setUploading(true); setUploadErr("");
    try {
      const storageRef = ref(storage, `scorecards/${player.id}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "scorecard_uploads", player.id), {
        url, playerId: player.id, playerName: player.name,
        uploadedAt: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}),
        verified: false,
      });
      notify("Scorecard uploaded! Awaiting commissioner verification.");
    } catch(err) { setUploadErr("Upload failed. Try again."); console.error(err); }
    setUploading(false);
  };

  return (
    <div className="card" style={{padding:20,marginTop:16,border:upload?.verified?"1px solid var(--green)":upload?.url?"1px solid var(--gold-dim)":"1px solid var(--border2)"}}>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:3,marginBottom:10,
        color:upload?.verified?"var(--green)":upload?.url?"var(--gold)":"var(--text3)"}}>
        {upload?.verified ? "✅ SCORECARD VERIFIED" : upload?.url ? "⏳ AWAITING VERIFICATION" : "📸 SUBMIT SCORECARD"}
      </div>
      {!upload?.url ? (
        <>
          <div style={{fontSize:13,color:"var(--text3)",marginBottom:12,lineHeight:1.6}}>
            Take a photo of your physical scorecard and upload it to finalize your round.
            {!allFilled && <span style={{color:"var(--amber)"}}> Complete at least 9 holes first.</span>}
          </div>
          <label style={{display:"inline-block",cursor:allFilled?"pointer":"not-allowed",opacity:allFilled?1:0.4}}>
            <div className="btn-gold" style={{fontSize:12,display:"inline-block",pointerEvents:allFilled?"auto":"none"}}>
              {uploading ? "UPLOADING…" : "📷 UPLOAD SCORECARD PHOTO"}
            </div>
            <input type="file" accept="image/*" capture="environment"
              style={{display:"none"}} disabled={!allFilled||uploading}
              onChange={handleUpload}/>
          </label>
          {uploadErr && <div style={{color:"var(--red)",fontSize:12,marginTop:8}}>{uploadErr}</div>}
        </>
      ) : upload?.verified ? (
        <div style={{fontSize:13,color:"var(--green)",lineHeight:1.6}}>
          Your scorecard has been verified by the commissioner. Your round is official. ✓
        </div>
      ) : (
        <div>
          <div style={{fontSize:13,color:"var(--text2)",marginBottom:10}}>
            Scorecard uploaded on {upload.uploadedAt}. The commissioner will verify it shortly.
          </div>
          <img src={upload.url} alt="Uploaded scorecard" style={{width:"100%",maxWidth:320,borderRadius:4,border:"1px solid var(--border)"}}/>
          <div style={{marginTop:10}}>
            <label style={{cursor:"pointer"}}>
              <span style={{fontSize:11,color:"var(--text3)",textDecoration:"underline"}}>Upload a different photo</span>
              <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleUpload}/>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Course Search Component (standalone — must be outside App to avoid remount)
function CourseSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.length >= 2) { setResults(searchCourses(query)); setOpen(true); }
    else { setResults([]); setOpen(false); }
  }, [query]);

  const pick = (course) => {
    onSelect(course);
    setQuery(course.name + " — " + course.city);
    setOpen(false);
  };

  return (
    <div style={{position:"relative"}}>
      <input value={query} onChange={e=>setQuery(e.target.value)}
        placeholder="Type course name or city…"
        style={{width:"100%",padding:"8px 12px",fontSize:14,background:"var(--bg2)",border:"1px solid var(--border2)",color:"var(--text)",borderRadius:3,outline:"none",fontFamily:"inherit"}}
        onFocus={()=>results.length>0&&setOpen(true)}
      />
      {open && results.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:"var(--bg2)",border:"1px solid var(--gold)",borderRadius:"0 0 6px 6px",maxHeight:280,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.8)"}}>
          {results.map((c,i)=>(
            <div key={i} onClick={()=>pick(c)}
              style={{padding:"11px 16px",cursor:"pointer",borderBottom:"1px solid var(--border)"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{c.name}</div>
              <div style={{fontSize:12,color:"var(--text3)",display:"flex",gap:16,marginTop:2}}>
                <span>📍 {c.city}, MN</span>
                <span>Par {c.par}</span>
                <span>Rating {c.rating}</span>
                <span>Slope {c.slope}</span>
              </div>
            </div>
          ))}
          <div style={{padding:"8px 16px",fontSize:11,color:"var(--text3)",fontStyle:"italic"}}>Not listed? Fill in fields below manually.</div>
        </div>
      )}
    </div>
  );
}

function AppInner() {
  // ── Context state (replaces local Firebase state + listeners) ──
  const { players, loading, syncStatus, setSyncStatus, scorecardUploads } = usePlayers();
  const { course, setCourse, courseLibrary } = useCourse();
  const { activeOneOff, activeOnOffs, ctpBets, foursomes, groupBets } = useTournament();
  const { activePlayer, setActivePlayer, adminUnlocked, setAdminUnlocked } = useAuth();

  // ── UI state ──
  const [moreOpen, setMoreOpen] = useState(false); // mobile nav toggle
  const [lbTab, setLbTab] = useState("individual"); // leaderboard sub-tab
  const [showFoursomeModal, setShowFoursomeModal] = useState(false);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [screen, setScreen]           = useState("leaderboard");
  const [selectedPid, setSelectedPid] = useState(null);
  const [activeHole, setActiveHole]   = useState(0);
  const [regForm, setRegForm]         = useState({ code:"", name:"", email:"", handicap:"", flight:"Scratch (0-5)", pin:"", pin2:"", leagueCode:"" });
  const [amateurForm, setAmateurForm] = useState({ name:"", email:"", handicap:"", pin:"", pin2:"" });
  const [amateurError, setAmateurError] = useState("");
  const [amateurSuccess, setAmateurSuccess] = useState(false);
  const [regError, setRegError]       = useState("");
  const [regSuccess, setRegSuccess]   = useState(false);
  const [showScModal, setShowScModal] = useState(false);
  const [pinInput, setPinInput]       = useState("");
  const [pinError, setPinError]       = useState(false);
  const [notif, setNotif]             = useState(null);
  const [pinAttempts, setPinAttempts] = useState({});
  const [scorePin, setScorePin]       = useState("");
  const [scorePinError, setScorePinError] = useState("");
  const [pendingPlayer, setPendingPlayer] = useState(null);
  const fileRef = useRef();
  const notifyTimer = useRef(null);

  const notify = (msg, type="success") => {
    clearTimeout(notifyTimer.current);
    setNotif({ msg, type });
    notifyTimer.current = setTimeout(() => setNotif(null), 3500);
  };
  useEffect(() => () => clearTimeout(notifyTimer.current), []);

  // ── FOURSOME HELPERS ─────────────────────────────────────────────────────
  const createFoursome = async (name, memberIds) => {
    const id = Date.now().toString();
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "foursomes", id), {
        id, name, memberIds, createdAt: Date.now(), createdBy: activePlayer || "anonymous"
      });
      notify(`Foursome "${name}" created! ⛳`);
    } catch(e) { console.error(e); notify("Failed to create foursome — check connection.", "error"); return null; }
    return id;
  };

  const deleteFoursome = async (id, name) => {
    if (!window.confirm(`Delete group "${name}"?`)) return;
    await deleteDoc(doc(db, "tournaments", TOURNAMENT_ID, "foursomes", id));
    notify("Group deleted.");
  };

  const createGroupBet = async (bet) => {
    const id = Date.now().toString();
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "group_bets", id), {
        id, ...bet, createdAt: Date.now(), settled: false, results: {}
      });
      notify("Bet added! 💰");
    } catch(e) { console.error(e); notify("Failed to add bet — check connection.", "error"); }
  };

  const settleCtp = async (betId, winnerId) => {
    try {
      await updateDoc(doc(db, "tournaments", TOURNAMENT_ID, "group_bets", betId), {
        settled: true, winnerId, settledAt: Date.now()
      });
      notify("CTP winner recorded! 🎯");
    } catch(e) { console.error(e); notify("Failed to record CTP winner — check connection.", "error"); }
  };

  // Calculate who owes who for a group of bets
  const calcSettlement = (bets, playerIds) => {
    const balances = {};
    playerIds.forEach(id => { balances[id] = 0; });

    bets.forEach(bet => {
      if (!bet.settled && bet.type !== "ctp") return;
      const amount = parseFloat(bet.amount) || 0;
      const participants = bet.playerIds || playerIds;

      if (bet.type === "ctp") {
        if (!bet.winnerId) return;
        // Each loser pays winner
        participants.filter(id => id !== bet.winnerId).forEach(lid => {
          balances[bet.winnerId] = (balances[bet.winnerId] || 0) + amount;
          balances[lid] = (balances[lid] || 0) - amount;
        });
      } else {
        // front9, back9, fullround — net or gross
        const winner = determineRoundWinner(bet, participants);
        if (!winner) return;
        participants.filter(id => id !== winner).forEach(lid => {
          balances[winner] = (balances[winner] || 0) + amount;
          balances[lid] = (balances[lid] || 0) - amount;
        });
      }
    });
    return balances;
  };

  const determineRoundWinner = (bet, participantIds) => {
    const scoreType = bet.scoreType || "net"; // net | gross
    const holeRange = bet.type === "front9" ? [0,9] : bet.type === "back9" ? [9,18] : [0,18];
    const rangeLen = holeRange[1] - holeRange[0];
    let best = null, bestScore = Infinity;
    participantIds.forEach(pid => {
      const p = players.find(pl => pl.id === pid);
      if (!p) return;
      const result = calcHoleRange(p.scores, p.handicap, course, pars, holeRange);
      if (!result || result.thru < rangeLen) return; // not finished yet
      // gross = raw strokes; gross - strokes = net adjusted (lowest wins)
      const compareScore = scoreType === "gross" ? result.gross : result.gross - result.strokes;
      if (compareScore < bestScore) { bestScore = compareScore; best = pid; }
    });
    return best;
  };

  const pars  = (Array.isArray(course?.par)   && course.par.length===18)  ? course.par   : DEFAULT_PAR;
  const par3Holes = pars.map((p,i) => p===3 ? i : -1).filter(i => i !== -1);

  // Auto-initialize CTP bets for all par 3s if not already active
  const initCtpBets = async () => {
    try {
      for (const holeIdx of par3Holes) {
        const key = `hole_${holeIdx}`;
        if (!ctpBets[key]) {
          await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "ctp_bets", key), {
            holeIndex: holeIdx, active: true, entries: {}
          });
        }
      }
    } catch(e) { console.error(e); notify("Failed to initialize CTP bets — check connection.", "error"); }
  };
  const yards = (Array.isArray(course?.yards) && course.yards.length===18) ? course.yards : DEFAULT_YARDS;
  const totalPar  = pars.reduce((a,b)=>a+b,0);

  // ── Firebase write helpers ──
  const savePlayer = async (player) => {
    setSyncStatus("syncing");
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "players", player.id), player);
      setSyncStatus("synced");
    } catch(e) { console.error(e); setSyncStatus("error"); notify("Sync failed — check connection","error"); }
  };

  const removePlayerDb = async (id) => {
    setSyncStatus("syncing");
    try {
      await deleteDoc(doc(db, "tournaments", TOURNAMENT_ID, "players", id));
      setSyncStatus("synced");
    } catch(e) { console.error(e); setSyncStatus("error"); }
  };

  const saveCourseToLibrary = async (courseData) => {
    const id = courseData.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "course_library", id), {
        ...courseData,
        id,
        savedAt: Date.now(),
      });
      notify(`"${courseData.name}" saved to course library ✓`);
    } catch(e) { console.error(e); notify("Failed to save course — check connection.", "error"); }
  };

  const saveCourse = async (data) => {
    setSyncStatus("syncing");
    try {
      // Validate before writing — never save malformed par/yards arrays
      const safe = { ...data };
      if (!Array.isArray(safe.par) || safe.par.length !== 18) safe.par = DEFAULT_PAR;
      if (!Array.isArray(safe.yards) || safe.yards.length !== 18) safe.yards = DEFAULT_YARDS;
      if (!safe.name) safe.name = "Keller Golf Course";
      if (!safe.slope || isNaN(safe.slope)) safe.slope = 128;
      if (!safe.rating || isNaN(safe.rating)) safe.rating = 70.4;
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "settings", "course"), safe);
      setSyncStatus("synced");
    } catch(e) { console.error(e); setSyncStatus("error"); }
  };

  // ── Player helpers ──
  const sortedFlight = flight => {
    const base = players.filter(p => p.memberType !== "amateur"); // exclude amateurs from main board
    return [...base].sort((a,b)=>{
      const an=calcNet(a,pars,course), bn=calcNet(b,pars,course);
      if(an===null&&bn===null)return 0;
      if(an===null)return 1; if(bn===null)return -1;
      return an!==bn ? an-bn : holesPlayed(b)-holesPlayed(a);
    });
  };

  const updateScore = async (pid, hole, val) => {
    const player = players.find(p=>p.id===pid);
    if (!player) return;
    const scores = [...player.scores];
    scores[hole] = val === "" ? null : Math.min(10, Math.max(1, parseInt(val)||1));
    const updated = { ...player, scores };
    // Optimistic local update
    setPlayers(prev => prev.map(p => p.id===pid ? updated : p));
    if (activePlayer === pid) setActivePlayer(pid);
    await savePlayer(updated);
  };

  const updateField = async (id, field, val) => {
    const player = players.find(p=>p.id===id);
    if (!player) return;
    const updated = { ...player, [field]: field==="handicap" ? parseInt(val)||0 : val };
    setPlayers(prev => prev.map(p => p.id===id ? updated : p));
    await savePlayer(updated);
  };

  const handleRegister = async () => {
    if (!regForm.leagueCode.trim()) { setRegError("Please enter the league password."); return; }
    if (regForm.leagueCode.trim() !== LEAGUE_PASSWORD) { setRegError("Incorrect league password. Contact the commissioner."); return; }
    if (!regForm.name.trim()) { setRegError("Please enter your name."); return; }
    if (players.find(p=>p.name.toLowerCase()===regForm.name.trim().toLowerCase())) { setRegError("Name already registered."); return; }
    if (!regForm.pin || regForm.pin.length !== 4 || !/^\d{4}$/.test(regForm.pin)) { setRegError("Please set a 4-digit PIN."); return; }
    if (regForm.pin !== regForm.pin2) { setRegError("PINs do not match."); return; }
    // Check tournament password
    let oneOffId = null;
    if (regForm.tourneyPw && activeOneOff?.hasPassword) {
      const pwHash = await hashPin(regForm.tourneyPw.trim());
      if (pwHash === activeOneOff.pwHash) { oneOffId = activeOneOff.id; }
      else { setRegError("Incorrect tournament password."); return; }
    }
    const id  = `player-${Date.now()}`;
    const pinHash = await hashPin(regForm.pin);
    const np  = { id, name:regForm.name.trim(), email:regForm.email.trim().toLowerCase(), handicap:parseInt(regForm.handicap)||0, flight:regForm.flight, scores:Array(18).fill(null), pinHash, memberType:"league", ...(oneOffId?{oneOffId}:{}) };
    await savePlayer(np);
    setActivePlayer(np.id);
    setRegSuccess(true);
    notify(oneOffId ? `Welcome, ${np.name}! You've joined "${activeOneOff.title}" 🏌️` : `Welcome, ${np.name}! 🏌️`);
  };

  // ── AMATEUR REGISTRATION
  const handleAmateurRegister = async () => {
    if (!amateurForm.name.trim()) { setAmateurError("Please enter your name."); return; }
    if (players.find(p=>p.name.toLowerCase()===amateurForm.name.trim().toLowerCase())) { setAmateurError("Name already registered."); return; }
    if (!amateurForm.pin || amateurForm.pin.length !== 4) { setAmateurError("Please set a 4-digit PIN."); return; }
    if (amateurForm.pin !== amateurForm.pin2) { setAmateurError("PINs do not match."); return; }
    setAmateurError("");
    const id = Date.now().toString();
    const pinHash = await hashPin(amateurForm.pin);
    const np = { id, name:amateurForm.name.trim(), email:amateurForm.email.trim().toLowerCase(), handicap:parseInt(amateurForm.handicap)||0, flight:"Amateur", scores:Array(18).fill(null), pinHash, memberType:"amateur" };
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",id), np);
    setActivePlayer(np);
    setAmateurSuccess(true);
    setAmateurForm({ name:"", email:"", handicap:"", pin:"", pin2:"" });
    notify(`Welcome, ${np.name}! You're registered as an amateur. 🏌️`);
  };

  const handleFileUpload = e => {
    const file = e.target.files[0]; if (!file) return;
    // Note: for production, upload to Firebase Storage instead of base64
    const reader = new FileReader();
    reader.onload = async ev => {
      const url   = ev.target.result;
      const isPdf = file.type.includes("pdf");
      const updated = { ...course, scorecardImage:isPdf?null:url, scorecardPdf:isPdf?url:null, scorecardName:file.name };
      setCourse(updated);
      await saveCourse(updated);
      notify("Scorecard uploaded!");
    };
    reader.readAsDataURL(file);
  };

  // Single unified leaderboard — no flights

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#080c08",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:4,color:"#5a9a5a"}} className="pulse">LOADING TOURNAMENT DATA…</div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // LEADERBOARD
  // ══════════════════════════════════════════════════════════════════════════
  // TOURNAMENT TAB
  const TournamentTab = () => {
    const [tourneys, setTourneys]   = React.useState([]);
    const [tabStep, setTabStep]     = React.useState("list");  // list | login | scores
    const [selTourney, setSelTourney] = React.useState(null);
    const [tLoginPid, setTLoginPid] = React.useState("");
    const [tLoginPin, setTLoginPin] = React.useState("");
    const [tLoginErr, setTLoginErr] = React.useState("");
    const [tPwInput,  setTPwInput]  = React.useState("");
    const [tPwErr,    setTPwErr]    = React.useState("");
    const [tLogging,  setTLogging]  = React.useState(false);
    const [tStep,     setTStep]     = React.useState("name"); // name | pin | password
    const [showPlayers, setShowPlayers] = React.useState(false);
    const [expandedTourney, setExpandedTourney] = React.useState(null); // id of past tourney showing players

    React.useEffect(() => {
      const unsub = onSnapshot(collection(db,"tournaments",TOURNAMENT_ID,"one_off_tournaments"), snap => {
        const arr = snap.docs.map(d=>({id:d.id,...d.data()}));
        arr.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        setTourneys(arr);
      });
      return () => unsub();
    }, []);

    const selectedPlayer = players.find(p=>p.id===tLoginPid);

    const handleTLogin = async () => {
      if (!selectedPlayer) return;
      setTLogging(true);
      const isAdmin = tLoginPin === ADMIN_PIN;
      const hash = isAdmin ? null : await hashPin(tLoginPin);
      if (!isAdmin && hash !== selectedPlayer.pinHash) {
        setTLoginErr("Incorrect PIN. Try again.");
        setTLogging(false);
        setTLoginPin("");
        return;
      }
      setTLogging(false);
      // PIN verified — check if tournament needs password and player isn't already in
      if (selTourney?.hasPassword && selectedPlayer.oneOffId !== selTourney.id) {
        setTStep("password");
      } else {
        // Already joined or no password — go straight to scores
        setActivePlayer(selectedPlayer.id);
        setActiveHole(Math.max(0, holesPlayed(selectedPlayer)-1)||0);
        setScreen("tournament-scores");
        setTabStep("scores");
      }
    };

    const handleJoinWithPassword = async () => {
      if (!tPwInput.trim()) { setTPwErr("Enter the tournament password."); return; }
      const pwHash = await hashPin(tPwInput.trim());
      if (pwHash !== selTourney.pwHash) { setTPwErr("Incorrect password."); return; }
      await updateDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",selectedPlayer.id),{oneOffId:selTourney.id});
      notify(`Joined "${selTourney.title}"! 🏌️`);
      setActivePlayer(selectedPlayer.id);
      setActiveHole(Math.max(0, holesPlayed(selectedPlayer)-1)||0);
      setScreen("tournament-scores");
      setTabStep("scores");
    };

    // Inline live leaderboard for a one-off tournament
    // Live leaderboard summary rows
    const TourneyLeaderboard = ({ t }) => {
      const joined = t.hasPassword
        ? players.filter(p=>p.oneOffId===t.id && p.scores?.some(Boolean))
        : players.filter(p=>p.scores?.some(Boolean));
      const rows = joined.map(p=>{
        const result = calcHoleRange(p.scores, p.handicap, course, pars);
        const gross = result?.gross || 0;
        const net = result ? result.net : 0;
        const thru = result?.thru || 0;
        return {...p, gross, net, thru};
      }).sort((a,b)=>a.net-b.net);
      if (!rows.length) return (
        <div style={{padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:13,fontStyle:"italic"}}>
          No scores yet — be the first on the board.
        </div>
      );
      return (
        <div style={{borderRadius:6,overflow:"hidden",border:"1px solid var(--border)"}}>
          <div style={{display:"grid",gridTemplateColumns:"44px 1fr 48px 58px 62px 68px",background:"var(--bg3)",padding:"8px 14px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
            <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>THRU</span>
            <span style={{textAlign:"center"}}>GROSS</span><span style={{textAlign:"center"}}>+/-</span><span style={{textAlign:"center"}}>NET</span>
          </div>
          {rows.map((p,idx)=>{
            const parThru = pars.slice(0,p.thru).reduce((a,b)=>a+b,0);
            const overPar = p.thru>0 ? p.gross - parThru : null;
            return (
            <div key={p.id} style={{display:"grid",gridTemplateColumns:"44px 1fr 48px 58px 62px 68px",padding:"11px 14px",borderBottom:"1px solid var(--border)",
              borderLeft:idx===0?"3px solid var(--green)":"3px solid transparent"}}>
              <span style={{fontFamily:"'Bebas Neue'",fontSize:18,color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
              </span>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:"var(--text2)"}}>{p.name}</div>
                <div style={{fontSize:10,color:"var(--text3)"}}>HCP {p.handicap}</div>
              </div>
              <div style={{textAlign:"center",fontSize:14,color:p.thru===18?"var(--green)":"var(--text)"}}>{p.thru===18?"F":p.thru||"—"}</div>
              <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:14,color:"var(--text3)"}}>{p.gross||"—"}</div>
              <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:14,color:overPar>0?"var(--amber)":overPar<0?"var(--gold)":"var(--text)"}}>{overPar!==null?toPM(overPar):"—"}</div>
              <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:16,fontWeight:700,color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>{toPM(p.net)}</div>
            </div>
            );
          })}
        </div>
      );
    };

    // Expanded player roster with hole-by-hole scores
    const PlayerRoster = ({ t, isLive }) => {
      const joined = isLive
        ? (t.hasPassword
            ? players.filter(p=>p.oneOffId===t.id)
            : players)
        : (t.snapshot || []);
      if (!joined.length) return (
        <div style={{padding:"16px",textAlign:"center",color:"var(--text3)",fontSize:13,fontStyle:"italic"}}>No players yet.</div>
      );
      // For live: compute from live scores. For past: use snapshot data
      const rows = isLive
        ? joined.map(p=>{
            const result = calcHoleRange(p.scores || [], p.handicap, course, pars);
            return {...p, gross: result?.gross||0, net: result?.net||0, thru: result?.thru||0};
          }).sort((a,b)=>a.net-b.net)
        : joined.map(p=>({...p,thru:p.scores?.filter(Boolean).length||18})).sort((a,b)=>a.net-b.net);

      const scoreColor = (s, par) => {
        if (!s) return "var(--text3)";
        const d = s - par;
        if (d <= -2) return "var(--gold)";
        if (d === -1) return "var(--green-bright)";
        if (d === 0)  return "var(--text)";
        if (d === 1)  return "var(--amber)";
        return "var(--red)";
      };

      return (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {rows.map((p, idx) => {
            const hasScores = p.scores?.some(Boolean);
            return (
              <div key={p.id} style={{background:"var(--bg3)",border:`1px solid ${idx===0?"var(--green-dim)":"var(--border)"}`,borderRadius:8,overflow:"hidden"}}>
                {/* Player header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:hasScores?"1px solid var(--border)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontFamily:"'Bebas Neue'",fontSize:20,color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)",minWidth:36}}>
                      {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                    </span>
                    <div>
                      <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>{p.name}</div>
                      <div style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap} · Thru {p.thru===18?"F (Final)":p.thru||"—"}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:16,alignItems:"center"}}>
                    {p.gross > 0 && <div style={{textAlign:"center"}}>
                      <div style={{fontFamily:"'DM Mono'",fontSize:16,color:"var(--text3)"}}>{p.gross}</div>
                      <div style={{fontSize:9,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>GROSS</div>
                    </div>}
                    <div style={{textAlign:"center"}}>
                      <div style={{fontFamily:"'DM Mono'",fontSize:20,fontWeight:700,color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>{p.net!==0||p.thru>0?toPM(p.net):"—"}</div>
                      <div style={{fontSize:9,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>NET</div>
                    </div>
                  </div>
                </div>
                {/* Hole-by-hole scores */}
                {hasScores && (
                  <div style={{overflowX:"auto",padding:"10px 12px"}}>
                    <div style={{display:"flex",gap:4,minWidth:"max-content"}}>
                      {p.scores.map((s, hi) => (
                        <div key={hi} style={{textAlign:"center",minWidth:28}}>
                          <div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Bebas Neue'",marginBottom:2}}>{hi+1}</div>
                          <div style={{width:28,height:28,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:13,fontFamily:"'DM Mono'",fontWeight:600,
                            background:s?"var(--bg4)":"transparent",
                            color:s?scoreColor(s,pars[hi]):"var(--border2)",
                            border:s?`1px solid ${scoreColor(s,pars[hi])}44`:"1px solid var(--border)"}}>
                            {s||"·"}
                          </div>
                          <div style={{fontSize:8,color:"var(--text3)",marginTop:2}}>{pars[hi]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!hasScores && isLive && (
                  <div style={{padding:"8px 16px",fontSize:11,color:"var(--text3)",fontStyle:"italic"}}>No scores entered yet</div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    // ── SCORES VIEW (after login)
    if (tabStep === "scores" && screen === "tournament-scores") {
      return <MyScores/>;
    }

    // ── LOGIN VIEW for a specific tournament
    if (tabStep === "login" && selTourney) {
      return (
        <div className="fade-up" style={{maxWidth:420,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
            <button onClick={()=>{setTabStep("list");setTStep("name");setTLoginPid("");setTLoginPin("");setTLoginErr("");setTPwInput("");setTPwErr("");}}
              style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
            <div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:selTourney.isActive?"var(--green)":"var(--text3)"}}>
                {selTourney.isActive?"🟢 IN PROGRESS":"⛳ TOURNAMENT"}
              </div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2}}>{selTourney.title}</div>
              <div style={{fontSize:12,color:"var(--text3)"}}>{selTourney.date}{selTourney.course?` · ${selTourney.course}`:""}</div>
            </div>
          </div>

          {/* Name step */}
          {tStep === "name" && (
            <div className="card" style={{padding:28}}>
              <div className="section-label" style={{marginBottom:8}}>YOUR NAME</div>
              <select value={tLoginPid} onChange={e=>{setTLoginPid(e.target.value);setTLoginErr("");}}
                style={{width:"100%",padding:"10px 12px",fontSize:15,background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:tLoginPid?"var(--text)":"var(--text3)",marginBottom:20}}>
                <option value="">Select your name...</option>
                {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
                disabled={!tLoginPid} onClick={()=>setTStep("pin")}>
                CONTINUE →
              </button>
            </div>
          )}

          {/* PIN step */}
          {tStep === "pin" && (
            <div className="card" style={{padding:28}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <button onClick={()=>{setTStep("name");setTLoginPin("");setTLoginErr("");}}
                  style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2}}>{selectedPlayer?.name}</div>
              </div>
              <div className="section-label" style={{marginBottom:8}}>YOUR PIN</div>
              <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:16}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} style={{width:48,height:56,border:"2px solid "+(tLoginPin.length>i?"var(--gold)":"var(--border2)"),borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,background:"var(--bg3)",color:"var(--gold)",transition:"all .15s"}}>
                    {tLoginPin.length>i?"●":""}
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
                  <button key={i} onClick={()=>{
                    if(k==="⌫") setTLoginPin(p=>p.slice(0,-1));
                    else if(k===""||tLoginPin.length>=4) return;
                    else { setTLoginPin(p=>p+k); setTLoginErr(""); }
                  }} style={{padding:"15px 8px",fontFamily:"'DM Mono'",fontSize:20,background:k==="⌫"?"var(--bg3)":"var(--bg4)",border:"1px solid var(--border2)",borderRadius:6,color:k==="⌫"?"var(--red)":"var(--text)",cursor:k===""?"default":"pointer",opacity:k===""?0:1}}>
                    {k}
                  </button>
                ))}
              </div>
              {tLoginErr && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"8px 12px",borderRadius:4,marginBottom:12}}>{tLoginErr}</div>}
              <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
                onClick={handleTLogin} disabled={tLogging||tLoginPin.length!==4}>
                {tLogging?"...":"VERIFY PIN →"}
              </button>
            </div>
          )}

          {/* Password step */}
          {tStep === "password" && (
            <div className="card" style={{padding:28}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <button onClick={()=>{setTStep("pin");setTLoginPin("");setTPwInput("");setTPwErr("");}}
                  style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2}}>{selectedPlayer?.name}</div>
              </div>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:32,marginBottom:8}}>🔒</div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,marginBottom:6}}>{selTourney.title}</div>
                <div style={{fontSize:13,color:"var(--text3)"}}>This tournament is invite-only. Enter the password your commissioner shared with you.</div>
              </div>
              <input value={tPwInput} onChange={e=>{setTPwInput(e.target.value);setTPwErr("");}}
                placeholder="Tournament password" style={{width:"100%",fontSize:15,marginBottom:8}}/>
              {tPwErr && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"8px 12px",borderRadius:4,marginBottom:12}}>{tPwErr}</div>}
              <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
                onClick={handleJoinWithPassword} disabled={!tPwInput.trim()}>
                JOIN TOURNAMENT →
              </button>
            </div>
          )}
        </div>
      );
    }

    // ── FULL LEADERBOARD VIEW
    if (tabStep === "leaderboard" && selTourney) {
      const isLive = !!selTourney.isActive;
      return (
        <div className="fade-up">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <button onClick={()=>{ setTabStep("list"); setSelTourney(null); setShowPlayers(false); }}
              style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:22,cursor:"pointer"}}>←</button>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                {isLive && <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>}
                <span style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:isLive?"var(--green)":"var(--text3)"}}>
                  {isLive?"LIVE · IN PROGRESS":"FINAL RESULTS"}
                </span>
              </div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:2,lineHeight:1}}>{selTourney.title}</div>
              <div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>
                {selTourney.date}{selTourney.course?` · ${selTourney.course}`:""}
                {selTourney.courseDetails?` · Par ${selTourney.courseDetails.par}`:""}
              </div>
            </div>
            {isLive && (
              <button className="btn-gold" style={{fontSize:12,padding:"9px 16px",letterSpacing:2,whiteSpace:"nowrap"}}
                onClick={()=>{ setTabStep("login"); setTStep("name"); }}>
                ENTER SCORES →
              </button>
            )}
          </div>
          <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid var(--border)"}}>
            {[["board","🏆 LEADERBOARD"],["players","👤 PLAYERS"]].map(([val,label])=>(
              <div key={val} onClick={()=>setShowPlayers(val==="players")}
                style={{padding:"9px 18px",fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:2,cursor:"pointer",
                  color:((val==="players")===showPlayers)?"var(--gold)":"var(--text3)",
                  borderBottom:((val==="players")===showPlayers)?"2px solid var(--gold)":"2px solid transparent",
                  marginBottom:-1}}>
                {label}
              </div>
            ))}
          </div>
          {!showPlayers && <TourneyLeaderboard t={selTourney}/>}
          {showPlayers && <PlayerRoster t={selTourney} isLive={isLive}/>}
        </div>
      );
    }

    // ── LIST VIEW
    const activeTourneys = activeOnOffs.length > 0
      ? activeOnOffs
      : (activeOneOff ? [{ ...activeOneOff, isActive: true }] : []);
    const pastTourneys = tourneys;

    return (
      <div className="fade-up">
        <div style={{marginBottom:24}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:4,color:"var(--text3)",marginBottom:4}}>NORTH STAR AMATEUR SERIES</div>
          <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2,marginBottom:4}}>TOURNAMENTS</h2>
          <p style={{fontSize:13,color:"var(--text3)"}}>Tap any tournament to view the full leaderboard or enter scores.</p>
        </div>

        {activeTourneys.length > 0 && (
          <div style={{marginBottom:28}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>
              {activeTourneys.length} OPEN NOW
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {activeTourneys.map(t => {
                const tPlayers = t.hasPassword
                  ? players.filter(p=>p.oneOffId===t.id && p.scores?.some(Boolean))
                  : players.filter(p=>p.memberType!=="amateur" && p.scores?.some(Boolean));
                return (
                  <div key={t.id} style={{background:"#060e06",border:"2px solid var(--green-dim)",borderRadius:10,overflow:"hidden"}}>
                    <div style={{padding:"18px 20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:14}}>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:"'Bebas Neue'",fontSize:24,letterSpacing:2,color:"var(--text)"}}>{t.title}</div>
                          <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>
                            {t.date}{t.course?` · ${t.course}`:""}
                            {t.courseDetails?` · Par ${t.courseDetails.par}`:""}
                          </div>
                          {t.notes && <div style={{fontSize:12,color:"var(--text2)",marginTop:4,fontStyle:"italic"}}>{t.notes}</div>}
                          <div style={{fontSize:11,color:"var(--text3)",marginTop:6}}>{tPlayers.length} player{tPlayers.length!==1?"s":""} on the board</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                          {t.hasPassword && <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--text3)",border:"1px solid var(--border2)",borderRadius:3,padding:"2px 8px"}}>🔒 INVITE ONLY</span>}
                          <button className="btn-gold" style={{fontSize:12,padding:"9px 18px",letterSpacing:2}}
                            onClick={()=>{ setSelTourney(t); setTabStep("login"); setTStep("name"); }}>
                            ENTER SCORES →
                          </button>
                          <button style={{fontSize:11,padding:"6px 14px",fontFamily:"'Bebas Neue'",letterSpacing:2,
                            background:"transparent",border:"1px solid var(--green-dim)",borderRadius:4,color:"var(--green)",cursor:"pointer"}}
                            onClick={()=>{ setSelTourney(t); setTabStep("leaderboard"); setShowPlayers(false); }}>
                            VIEW LEADERBOARD →
                          </button>
                        </div>
                      </div>
                      <TourneyLeaderboard t={t}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTourneys.length === 0 && (
          <div style={{padding:"32px 20px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:36,marginBottom:10}}>⛳</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,marginBottom:6}}>NO ACTIVE TOURNAMENT</div>
            <div style={{fontSize:13,color:"var(--text3)"}}>Check back when the commissioner starts one.</div>
          </div>
        )}

        {pastTourneys.length > 0 && (
          <div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--text3)",marginBottom:12}}>── PAST TOURNAMENTS</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {pastTourneys.map(t => {
                const winner = t.snapshot?.[0];
                return (
                  <div key={t.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,cursor:"pointer"}}
                    onClick={()=>{ setSelTourney(t); setTabStep("leaderboard"); setShowPlayers(false); }}>
                    <div style={{padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                      <div>
                        <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:1,color:"var(--text)"}}>{t.title}</div>
                        <div style={{fontSize:12,color:"var(--text3)"}}>{t.date}{t.course?` · ${t.course}`:""}</div>
                        {winner && <div style={{fontSize:12,color:"var(--gold)",marginTop:4}}>🏆 {winner.name} · Net {winner.net}</div>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--text3)",border:"1px solid var(--border2)",borderRadius:3,padding:"2px 8px"}}>
                          {t.snapshot?.length||0} PLAYERS
                        </span>
                        <span style={{color:"var(--text3)",fontSize:18}}>›</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTourneys.length === 0 && pastTourneys.length === 0 && (
          <div style={{textAlign:"center",padding:"20px",color:"var(--text3)",fontSize:13}}>No tournaments yet.</div>
        )}
      </div>
    );

    return null;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // FOURSOME + GROUP BETS VIEW
  const FoursomeView = () => {
    const [step, setStep] = React.useState("list");
    const [gName, setGName] = React.useState("");
    const [gMembers, setGMembers] = React.useState([]);
    const [detailGroup, setDetailGroup] = React.useState(null);
    const [betType, setBetType] = React.useState("fullround");
    const [betScore, setBetScore] = React.useState("net");
    const [betAmount, setBetAmount] = React.useState("");
    const [betPlayers, setBetPlayers] = React.useState([]);
    const [betHole, setBetHole] = React.useState("");
    const [betErr, setBetErr] = React.useState("");

    const par3s = pars.map((p,i) => p===3 ? i : -1).filter(i => i !== -1);
    const getPlayer = id => players.find(p => p.id === id);

    const groupBetsFor = (group) => groupBets.filter(b =>
      b.foursomeId === group.id
    );

    const toggleMember = id => {
      setGMembers(prev => prev.includes(id) ? prev.filter(x=>x!==id) : prev.length < 4 ? [...prev, id] : prev);
    };

    const handleCreate = async () => {
      if (!gName.trim() || gMembers.length < 2) return;
      await createFoursome(gName.trim(), gMembers);
      setGName(""); setGMembers([]); setStep("list");
    };

    const handleAddBet = async () => {
      setBetErr("");
      if (!betAmount || isNaN(parseFloat(betAmount))) { setBetErr("Enter a dollar amount."); return; }
      if (betPlayers.length < 2) { setBetErr("Select at least 2 players."); return; }
      if (betType === "ctp" && betHole === "") { setBetErr("Select a hole."); return; }
      await createGroupBet({
        foursomeId: detailGroup?.id || null,
        playerIds: betPlayers,
        type: betType,
        scoreType: betScore,
        amount: parseFloat(betAmount),
        hole: betType === "ctp" ? parseInt(betHole) : null,
        label: betType === "ctp" ? `CTP · Hole ${parseInt(betHole)+1}`
          : betType === "front9" ? `Front 9 · ${betScore}`
          : betType === "back9" ? `Back 9 · ${betScore}`
          : `Full Round · ${betScore}`,
      });
      setBetAmount(""); setBetPlayers([]); setBetHole(""); setStep("detail");
    };

    const getGroupScore = (pid, type, scoreType) => {
      const p = getPlayer(pid); if (!p) return null;
      const range = type==="front9"?[0,9]:type==="back9"?[9,18]:[0,18];
      const result = calcHoleRange(p.scores, p.handicap, course, pars, range);
      if (!result) return null;
      return scoreType === "gross" ? result.gross : result.gross - result.strokes;
    };

    const thruRange = (pid, type) => {
      const p = getPlayer(pid); if (!p) return 0;
      const range = type==="front9"?[0,9]:type==="back9"?[9,18]:[0,18];
      return p.scores.slice(range[0], range[1]).filter(Boolean).length;
    };

    const determineWinner = (bet) => {
      const pids = bet.playerIds || [];
      let best = null, bestScore = Infinity;
      pids.forEach(pid => {
        const score = getGroupScore(pid, bet.type, bet.scoreType);
        if (score !== null && score < bestScore) { bestScore = score; best = pid; }
      });
      return best;
    };

    const calcSettlement = (bets, pids) => {
      const balances = {};
      pids.forEach(id => { balances[id] = 0; });
      bets.forEach(bet => {
        const winner = bet.type === "ctp" ? bet.winnerId : determineWinner(bet);
        if (!winner) return;
        const amount = parseFloat(bet.amount) || 0;
        const participants = bet.playerIds || pids;
        participants.filter(id=>id!==winner).forEach(lid => {
          balances[winner] = (balances[winner]||0) + amount;
          balances[lid] = (balances[lid]||0) - amount;
        });
      });
      return balances;
    };

    const BetCard = ({ bet }) => {
      const pids = bet.playerIds || [];
      const winner = bet.type === "ctp" ? bet.winnerId : determineWinner(bet);
      const winnerName = winner ? getPlayer(winner)?.name : null;
      const canSettle = bet.type === "ctp" && !bet.settled && activePlayer && pids.includes(activePlayer);
      return (
        <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,padding:"14px 16px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <span style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,color:"var(--gold)"}}>{bet.label}</span>
              <span style={{fontSize:11,color:"var(--text3)",marginLeft:8}}>${bet.amount}/player</span>
            </div>
            {winnerName && <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--green)",border:"1px solid var(--green-dim)",borderRadius:3,padding:"2px 8px"}}>🏆 {winnerName}</span>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pids.map(pid => {
              const p = getPlayer(pid); if (!p) return null;
              const score = bet.type!=="ctp" ? getGroupScore(pid,bet.type,bet.scoreType) : null;
              const thru = bet.type!=="ctp" ? thruRange(pid,bet.type) : null;
              const isWinner = winner===pid;
              return (
                <div key={pid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"6px 10px",background:isWinner?"#0a1a0a":"transparent",
                  border:isWinner?"1px solid var(--green-dim)":"1px solid transparent",borderRadius:4}}>
                  <span style={{fontSize:14,color:isWinner?"var(--green)":"var(--text2)",fontWeight:isWinner?600:400}}>{p.name}</span>
                  {bet.type!=="ctp" ? (
                    <div style={{display:"flex",gap:12,alignItems:"center"}}>
                      <span style={{fontSize:11,color:"var(--text3)"}}>{thru===(bet.type==="fullround"?18:9)?"F":`Thru ${thru||"—"}`}</span>
                      <span style={{fontFamily:"'DM Mono'",fontSize:16,fontWeight:700,color:isWinner?"var(--green)":"var(--text3)"}}>{score!==null?score:"—"}</span>
                    </div>
                  ) : (
                    canSettle && !bet.settled ? (
                      <button onClick={()=>settleCtp(bet.id,pid)}
                        style={{fontSize:11,fontFamily:"'Bebas Neue'",letterSpacing:2,padding:"4px 12px",
                          background:"transparent",border:"1px solid var(--gold-dim)",color:"var(--gold)",borderRadius:3,cursor:"pointer"}}>
                        SET WINNER
                      </button>
                    ) : <span style={{fontSize:12,color:isWinner?"var(--green)":"var(--text3)"}}>{isWinner?"🎯 Winner":"—"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const SettlementSummary = ({ bets, pids }) => {
      const balances = calcSettlement(bets, pids);
      const entries = Object.entries(balances).filter(([,v])=>v!==0);
      if (!entries.length) return null;
      const owed = [];
      const pos = entries.filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      const neg = entries.filter(([,v])=>v<0).sort((a,b)=>a[1]-b[1]);
      neg.forEach(([lid,lval])=>{
        let rem = Math.abs(lval);
        pos.forEach(([wid,wval])=>{ if(rem<=0)return; const amt=Math.min(rem,wval); if(amt>0){owed.push({from:lid,to:wid,amount:amt});rem-=amt;} });
      });
      if (!owed.length) return null;
      return (
        <div style={{background:"#0a1a0a",border:"1px solid var(--green-dim)",borderRadius:8,padding:"14px 16px",marginTop:16}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:10}}>── SETTLEMENT</div>
          {owed.map((o,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<owed.length-1?"1px solid var(--border)":"none"}}>
              <span style={{fontSize:14,color:"var(--text2)"}}>
                <span style={{color:"var(--red)"}}>{getPlayer(o.from)?.name}</span>
                <span style={{color:"var(--text3)"}}> owes </span>
                <span style={{color:"var(--green)"}}>{getPlayer(o.to)?.name}</span>
              </span>
              <span style={{fontFamily:"'DM Mono'",fontSize:18,fontWeight:700,color:"var(--gold)"}}>${o.amount.toFixed(0)}</span>
            </div>
          ))}
        </div>
      );
    };

    if (step === "list") return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--text3)"}}>── {foursomes.length} GROUP{foursomes.length!==1?"S":""}</div>
          <button className="btn-gold" style={{fontSize:12,padding:"8px 18px",letterSpacing:2}} onClick={()=>setStep("create")}>+ CREATE GROUP</button>
        </div>
        {foursomes.length===0 && (
          <div style={{padding:"40px 20px",textAlign:"center",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8}}>
            <div style={{fontSize:36,marginBottom:12}}>🤝</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,marginBottom:8}}>NO GROUPS YET</div>
            <div style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Create a group with your foursome to track bets and scores together.</div>
            <button className="btn-gold" style={{fontSize:12,padding:"10px 24px"}} onClick={()=>setStep("create")}>CREATE GROUP →</button>
          </div>
        )}
        {foursomes.map(group => {
          const bets = groupBetsFor(group);
          const balances = calcSettlement(bets, group.memberIds);
          const myBalance = activePlayer ? balances[activePlayer] : null;
          return (
            <div key={group.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,padding:"16px 20px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{cursor:"pointer",flex:1}} onClick={()=>{ setDetailGroup(group); setStep("detail"); }}>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:1}}>{group.name}</div>
                  <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{group.memberIds.map(id=>getPlayer(id)?.name||"?").join(" · ")}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <button onClick={(e)=>{ e.stopPropagation(); deleteFoursome(group.id, group.name); }}
                    style={{fontSize:10,padding:"3px 10px",fontFamily:"'Bebas Neue'",letterSpacing:1,background:"transparent",border:"1px solid #4a1010",color:"var(--red)",borderRadius:3,cursor:"pointer"}}>
                    ✕ DELETE
                  </button>
                  <div style={{fontSize:11,color:"var(--text3)"}}>{bets.length} bet{bets.length!==1?"s":""}</div>
                  {myBalance!==null&&myBalance!==0&&<div style={{fontFamily:"'DM Mono'",fontSize:14,fontWeight:700,color:myBalance>0?"var(--green)":"var(--red)",marginTop:4}}>{myBalance>0?`+$${myBalance}`:`-$${Math.abs(myBalance)}`}</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {group.memberIds.map(id=>{ const p=getPlayer(id); const thru=p?holesPlayed(p):0; return p?(<span key={id} style={{fontSize:11,color:"var(--text2)",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:4,padding:"3px 8px"}}>{p.name.split(" ")[0]} {thru===18?"✓":`(${thru})`}</span>):null; })}
              </div>
            </div>
          );
        })}
        {activePlayer && (
          <div style={{marginTop:20,textAlign:"center"}}>
            <button className="btn-ghost" style={{fontSize:11,padding:"8px 20px",letterSpacing:2}}
              onClick={()=>{ setDetailGroup(null); setBetPlayers([]); setStep("addbet"); }}>
              + ADD SOLO BET
            </button>
          </div>
        )}
      </div>
    );

    if (step === "create") return (
      <div style={{maxWidth:460,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <button onClick={()=>setStep("list")} style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2}}>CREATE GROUP</div>
        </div>
        <div className="card" style={{padding:24,display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div className="section-label">GROUP NAME</div>
            <input value={gName} onChange={e=>setGName(e.target.value)} placeholder="e.g. Saturday Foursome" style={{width:"100%"}}/>
          </div>
          <div>
            <div className="section-label" style={{marginBottom:8}}>SELECT PLAYERS ({gMembers.length}/4)</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>
              {players.filter(p=>p.memberType!=="amateur").map(p=>{
                const sel=gMembers.includes(p.id);
                return (<div key={p.id} onClick={()=>toggleMember(p.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:6,cursor:"pointer",background:sel?"#0a1a0a":"var(--bg3)",border:`1px solid ${sel?"var(--green)":"var(--border)"}`}}>
                  <span style={{fontSize:14,color:sel?"var(--green)":"var(--text2)"}}>{p.name}</span>
                  <span style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</span>
                </div>);
              })}
            </div>
          </div>
          <button className="btn-gold" style={{width:"100%",padding:12,fontSize:14}} onClick={handleCreate} disabled={!gName.trim()||gMembers.length<2}>CREATE GROUP →</button>
        </div>
      </div>
    );

    if (step === "detail" && detailGroup) {
      const bets = groupBetsFor(detailGroup);
      const allPids = detailGroup.memberIds;
      return (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <button onClick={()=>setStep("list")} style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2}}>{detailGroup.name}</div>
              <div style={{fontSize:12,color:"var(--text3)"}}>{allPids.map(id=>getPlayer(id)?.name||"?").join(" · ")}</div>
            </div>
            <button onClick={()=>{ deleteFoursome(detailGroup.id, detailGroup.name).then(()=>setStep("list")); }}
              style={{fontSize:11,padding:"6px 14px",fontFamily:"'Bebas Neue'",letterSpacing:1,background:"transparent",border:"1px solid #4a1010",color:"var(--red)",borderRadius:4,cursor:"pointer"}}>
              ✕ DELETE GROUP
            </button>
          </div>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden",marginBottom:20}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 60px 70px 70px 60px",background:"var(--bg3)",padding:"8px 14px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
              <span>PLAYER</span><span style={{textAlign:"center"}}>THRU</span><span style={{textAlign:"center"}}>GROSS</span><span style={{textAlign:"center"}}>NET</span><span style={{textAlign:"center"}}>HCP</span>
            </div>
            {allPids.map((pid,idx)=>{
              const p=getPlayer(pid); if(!p)return null;
              const net=calcNet(p,pars,course), gross=calcGrossToPar(p,pars), thru=holesPlayed(p);
              return (<div key={pid} style={{display:"grid",gridTemplateColumns:"1fr 60px 70px 70px 60px",padding:"12px 14px",borderBottom:"1px solid var(--border)",borderLeft:idx===0?"3px solid var(--gold)":"3px solid transparent"}}>
                <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{p.name}</div>
                <div style={{textAlign:"center",fontSize:14,color:thru===18?"var(--green)":"var(--text)"}}>{thru===18?"F":thru||"—"}</div>
                <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:14,color:"var(--text3)"}}>{toPM(gross)}</div>
                <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:16,fontWeight:700,color:net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"}}>{toPM(net)}</div>
                <div style={{textAlign:"center",fontSize:13,color:"var(--text3)"}}>{p.handicap}</div>
              </div>);
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--text3)"}}>── BETS ({bets.length})</div>
            <button className="btn-gold" style={{fontSize:11,padding:"7px 16px",letterSpacing:2}} onClick={()=>{ setBetPlayers([...allPids]); setStep("addbet"); }}>+ ADD BET</button>
          </div>
          {bets.length===0&&<div style={{padding:"24px",textAlign:"center",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,marginBottom:16}}><div style={{fontSize:13,color:"var(--text3)"}}>No bets yet.</div></div>}
          {bets.map(bet=><BetCard key={bet.id} bet={bet}/>)}
          {bets.length>0&&<SettlementSummary bets={bets} pids={allPids}/>}
        </div>
      );
    }

    if (step === "addbet") return (
      <div style={{maxWidth:460,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <button onClick={()=>setStep(detailGroup?"detail":"list")} style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2}}>ADD BET</div>
        </div>
        <div className="card" style={{padding:24,display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div className="section-label" style={{marginBottom:8}}>BET TYPE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["fullround","Full Round"],["front9","Front 9"],["back9","Back 9"],["ctp","Closest to Pin"]].map(([val,label])=>(
                <button key={val} onClick={()=>setBetType(val)} style={{padding:"10px 8px",fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:1,background:betType===val?"var(--green-dim)":"var(--bg3)",border:`1px solid ${betType===val?"var(--green)":"var(--border)"}`,color:betType===val?"var(--green)":"var(--text2)",borderRadius:6,cursor:"pointer"}}>{label}</button>
              ))}
            </div>
          </div>
          {betType!=="ctp"&&(
            <div>
              <div className="section-label" style={{marginBottom:8}}>SCORE TYPE</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["net","Net"],["gross","Gross"]].map(([val,label])=>(
                  <button key={val} onClick={()=>setBetScore(val)} style={{padding:"10px",fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:1,background:betScore===val?"#0a1a0a":"var(--bg3)",border:`1px solid ${betScore===val?"var(--gold)":"var(--border)"}`,color:betScore===val?"var(--gold)":"var(--text2)",borderRadius:6,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
            </div>
          )}
          {betType==="ctp"&&(
            <div>
              <div className="section-label" style={{marginBottom:8}}>PAR 3 HOLE</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {par3s.map(hi=>(
                  <button key={hi} onClick={()=>setBetHole(hi.toString())} style={{width:44,height:44,fontFamily:"'Bebas Neue'",fontSize:16,background:betHole===hi.toString()?"var(--gold)":"var(--bg3)",border:`1px solid ${betHole===hi.toString()?"var(--gold)":"var(--border)"}`,color:betHole===hi.toString()?"#060a06":"var(--text2)",borderRadius:6,cursor:"pointer"}}>{hi+1}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="section-label">AMOUNT PER PLAYER ($)</div>
            <input type="number" value={betAmount} onChange={e=>setBetAmount(e.target.value)} placeholder="e.g. 5" min="1" style={{width:"100%",fontSize:18,textAlign:"center"}}/>
          </div>
          <div>
            <div className="section-label" style={{marginBottom:8}}>PLAYERS IN BET ({betPlayers.length} selected)</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:240,overflowY:"auto"}}>
              {players.filter(p=>p.memberType!=="amateur").map(p=>{
                const sel=betPlayers.includes(p.id);
                return (<div key={p.id} onClick={()=>setBetPlayers(prev=>sel?prev.filter(x=>x!==p.id):[...prev,p.id])} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderRadius:6,cursor:"pointer",background:sel?"#0a1200":"var(--bg3)",border:`1px solid ${sel?"var(--gold)":"var(--border)"}`}}>
                  <span style={{fontSize:14,color:sel?"var(--gold)":"var(--text2)"}}>{p.name}</span>
                  <span style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</span>
                </div>);
              })}
            </div>
          </div>
          {betErr&&<div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"10px 14px",borderRadius:4}}>{betErr}</div>}
          <button className="btn-gold" style={{width:"100%",padding:13,fontSize:14}} onClick={handleAddBet}>ADD BET →</button>
        </div>
      </div>
    );

    return null;
  };

    const Leaderboard = () => {
    const oneOffPlayers = activeOneOff
      ? (activeOneOff.hasPassword
          ? players.filter(p => p.oneOffId === activeOneOff.id && p.scores?.some(Boolean))
          : players.filter(p => p.scores?.some(Boolean)))
      : [];
    const oneOffRows = oneOffPlayers
      .map(p => {
        const result = calcHoleRange(p.scores, p.handicap, course, pars);
        return { ...p, gross: result?.gross||0, net: result?.net||0, thru: result?.thru||0 };
      })
      .sort((a,b) => a.net - b.net);

    return (
      <div className="fade-up">
        {/* ── Sub tabs: Individual / Groups */}
        <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:"1px solid var(--border)"}}>
          {[["individual","👤 INDIVIDUAL"],["groups","🤝 GROUPS"]].map(([val,label])=>(
            <div key={val}
              onClick={()=>setLbTab(val)}
              style={{padding:"10px 20px",fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,cursor:"pointer",
                color:lbTab===val?"var(--gold)":"var(--text3)",
                borderBottom:lbTab===val?"2px solid var(--gold)":"2px solid transparent",
                marginBottom:-1,transition:"all 0.15s"}}>
              {label}
            </div>
          ))}
        </div>

        {lbTab === "groups" && <FoursomeView/>}
        {lbTab === "individual" && <>
        {/* ── One-Off Tournament Live Banner */}
        {activeOneOff && (
          <div style={{marginBottom:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>
                <span style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)"}}>LIVE NOW</span>
              </div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2,color:"var(--text)"}}>{activeOneOff.title}</div>
              {activeOneOff.course && <div style={{fontSize:12,color:"var(--text3)"}}>📍 {activeOneOff.course}</div>}
              {activeOneOff.hasPassword && <span style={{fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,border:"1px solid var(--border2)",borderRadius:2,padding:"1px 6px"}}>🔒 INVITE ONLY</span>}
            </div>

            {oneOffRows.length === 0 ? (
              <div style={{padding:"24px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:6,textAlign:"center",color:"var(--text3)",fontSize:13,fontStyle:"italic"}}>
                Waiting for players to enter scores…
              </div>
            ) : (
              <div style={{background:"var(--bg2)",border:"1px solid var(--green-dim)",borderRadius:6,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"52px 1fr 60px 80px 80px 60px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
                  <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>THRU</span>
                  <span style={{textAlign:"center"}}>GROSS</span><span style={{textAlign:"center"}}>NET</span><span style={{textAlign:"center"}}>HCP</span>
                </div>
                {oneOffRows.map((p, idx) => (
                  <div key={p.id} className="player-row"
                    style={{display:"grid",gridTemplateColumns:"52px 1fr 60px 80px 80px 60px",padding:"12px 16px",alignItems:"center",
                      borderLeft:idx===0?"3px solid var(--green)":"3px solid transparent"}}
                    onClick={()=>{ setSelectedPid(p.id); setScreen("scorecard"); }}>
                    <span style={{fontFamily:"'Bebas Neue'",fontSize:20,color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                      {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                    </span>
                    <div>
                      <div style={{fontSize:16,fontWeight:600,color:idx===0?"var(--text)":"var(--text2)"}}>{p.name}</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:15,color:p.thru===18?"var(--green)":"var(--text)"}}>{p.thru===18?"F":p.thru||"—"}</div>
                      <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1}}>{p.thru===18?"FINAL":p.thru>0?"THRU":"—"}</div>
                    </div>
                    <div style={{textAlign:"center",fontSize:16,color:p.gross>0?"var(--amber)":p.gross<0?"var(--gold)":"var(--text)"}}>{p.gross||"—"}</div>
                    <div style={{textAlign:"center",fontSize:22,fontWeight:700,color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>{toPM(p.net)}</div>
                    <div style={{textAlign:"center",fontSize:13,color:"var(--text3)"}}>{p.handicap}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{borderTop:"1px solid var(--border)",marginTop:24,paddingTop:20}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--text3)",marginBottom:12}}>── SEASON LEADERBOARD</div>
            </div>
          </div>
        )}

        <LeaderboardTable
          players={sortedFlight("All")}
          pars={pars}
          scorecardUploads={scorecardUploads}
          calcNet={calcNet}
          calcGrossToPar={calcGrossToPar}
          holesPlayed={holesPlayed}
          toPM={toPM}
          setSelectedPid={setSelectedPid}
          setScreen={setScreen}
          course={course}
        />
        {players.filter(p=>p.memberType!=="amateur").length===0 && (
          <div style={{textAlign:"center",padding:"60px 20px",color:"var(--text3)"}}>
            <div style={{fontSize:36,marginBottom:12}}>⛳</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,marginBottom:8}}>NO PLAYERS YET</div>
          </div>
        )}

        </>}
        {/* Amateurs section */}
        {lbTab === "individual" && players.filter(p=>p.memberType==="amateur").length > 0 && (
          <div style={{marginTop:32}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--text3)",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
              <span>── AMATEUR MEMBERS</span>
              <button style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",borderRadius:3,padding:"2px 10px",cursor:"pointer"}}
                onClick={()=>setScreen("amateurs")}>VIEW ALL →</button>
            </div>
            <div className="card" style={{overflow:"hidden"}}>
              {players.filter(p=>p.memberType==="amateur").map((p,idx)=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",borderBottom:"1px solid var(--border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontFamily:"'Bebas Neue'",fontSize:16,color:"var(--text3)",minWidth:28}}>{idx+1}</span>
                    <div>
                      <div style={{fontSize:15,fontWeight:600,color:"var(--text2)"}}>{p.name}</div>
                      <div style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</div>
                    </div>
                  </div>
                  <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--gold)",border:"1px solid #c8a84a44",borderRadius:3,padding:"2px 8px"}}>AMATEUR</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SCORECARD VIEW
  const ScorecardView = () => {
    const player = players.find(p=>p.id===selectedPid) || players[0];
    if (!player) return <div style={{color:"var(--text3)",padding:40,textAlign:"center"}}>No players yet.</div>;

    const Nine = ({ start, label }) => {
      const ninePars  = pars.slice(start,start+9);
      const nineYards = yards.slice(start,start+9);
      const nineHcps  = HCP_STROKES.slice(start,start+9);
      const scores    = player.scores.slice(start,start+9);
      const gross     = scores.filter(Boolean).reduce((a,b)=>a+b,0);
      return (
        <div style={{overflowX:"auto",marginBottom:16}}>
          <div className="section-label" style={{marginBottom:6}}>{label}</div>
          <table style={{borderCollapse:"collapse",minWidth:"100%",fontSize:13}}>
            <thead>
              <tr style={{background:"var(--bg3)"}}>
                <td style={{padding:"7px 10px",fontSize:10,letterSpacing:1,color:"var(--text3)",fontFamily:"'Bebas Neue'",minWidth:70}}>HOLE</td>
                {Array.from({length:9},(_,i)=>(
                  <td key={i} style={{padding:"7px 5px",textAlign:"center",fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",minWidth:38}}>{start+i+1}</td>
                ))}
                <td style={{padding:"7px 8px",textAlign:"center",fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",background:"var(--bg4)",minWidth:42}}>TOT</td>
              </tr>
              <tr style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"5px 10px",fontSize:11,color:"var(--text3)"}}>Yards</td>
                {nineYards.map((y,i)=><td key={i} style={{textAlign:"center",padding:"5px 4px",fontSize:12,color:"var(--text3)"}}>{y}</td>)}
                <td style={{textAlign:"center",fontSize:12,color:"var(--text3)",background:"var(--bg4)"}}>{nineYards.reduce((a,b)=>a+b,0)}</td>
              </tr>
              <tr style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"5px 10px",fontSize:11,color:"var(--text3)"}}>HCP</td>
                {nineHcps.map((h,i)=><td key={i} style={{textAlign:"center",padding:"5px 4px",fontSize:11,color:"var(--text3)"}}>{h}</td>)}
                <td style={{background:"var(--bg4)"}}/>
              </tr>
              <tr style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"6px 10px",fontSize:12,color:"var(--green)",fontWeight:600}}>Par</td>
                {ninePars.map((p,i)=><td key={i} style={{textAlign:"center",padding:"6px 4px",fontSize:13,color:"var(--green)",fontWeight:600}}>{p}</td>)}
                <td style={{textAlign:"center",fontSize:13,color:"var(--green)",fontWeight:700,background:"var(--bg4)"}}>{ninePars.reduce((a,b)=>a+b,0)}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{padding:"8px 10px",fontSize:13,color:"var(--text2)"}}>{player.name.split(" ")[0]}</td>
                {scores.map((s,i)=>{
                  const par=ninePars[i];
                  const diff=s?s-par:null;
                  const bg=diff===null?"transparent":diff<=-2?"#1a3a0a":diff===-1?"#0a2a0a":diff===0?"transparent":diff===1?"#2a1a0a":"#3a0a0a";
                  const col=diff===null?"var(--text3)":diff<=-2?"#a0e060":diff===-1?"var(--green-bright)":diff===0?"var(--text)":diff===1?"var(--amber)":"var(--red)";
                  return (
                    <td key={i} style={{textAlign:"center",padding:"6px 3px"}}>
                      {adminUnlocked ? (
                        <input className="sc-input" type="number" min="1" max="15" value={s??""} onChange={e=>updateScore(player.id,start+i,e.target.value)}/>
                      ) : (
                        <div style={{width:36,height:28,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",borderRadius:3,background:bg,color:col,fontSize:14,fontFamily:"'DM Mono'",fontWeight:s?600:400}}>
                          {s||"—"}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td style={{textAlign:"center",fontWeight:700,fontSize:15,color:"var(--text)",background:"var(--bg4)",padding:"6px 8px"}}>{gross||"—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    };

    const net=calcNet(player,pars), gross=player.scores.filter(Boolean).reduce((a,b)=>a+b,0), thru=holesPlayed(player);
    return (
      <div className="fade-up">
        <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
          {players.map(p=>(
            <button key={p.id} className={`flight-chip ${selectedPid===p.id?"active":""}`} style={{fontSize:13}} onClick={()=>setSelectedPid(p.id)}>
              {p.name.split(" ")[0]}
            </button>
          ))}
        </div>
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:16}}>
            <div>
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:30,letterSpacing:2}}>{player.name}</h2>
              <div style={{fontSize:12,color:"var(--text3)",letterSpacing:1}}>Handicap {player.handicap}</div>
            </div>
            <div style={{display:"flex",gap:24}}>
              {[["GROSS",gross||"—","var(--text)"],["THRU",thru===18?"F":thru||"—",thru===18?"var(--green)":"var(--text2)"],["NET",toPM(net),net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"]].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:10,color:"var(--text3)",letterSpacing:2,fontFamily:"'Bebas Neue'"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <Nine start={0} label="FRONT NINE"/>
          <Nine start={9} label="BACK NINE"/>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // COURSE VIEW
  const CourseView = () => (
    <div className="fade-up" style={{maxWidth:820}}>
      <div className="section-label">── COURSE INFORMATION</div>
      <div className="card" style={{padding:24,marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:20}}>
          <div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2}}>{course?.name}</h2>
            <div style={{fontSize:14,color:"var(--text3)"}}>{course?.city}</div>
          </div>
          <div style={{display:"flex",gap:28}}>
            {[["PAR",totalPar,"var(--green)"],["SLOPE",course?.slope,"var(--text)"],["RATING",course?.rating,"var(--gold)"]].map(([l,v,c])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:c}}>{v}</div>
                <div style={{fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{fontSize:15,color:"var(--text2)",lineHeight:1.8,fontStyle:"italic",borderLeft:"2px solid var(--gold-dim)",paddingLeft:16}}>{course?.description}</p>
      </div>

      <div className="section-label">── HOLE-BY-HOLE</div>
      <div className="card" style={{overflow:"hidden",marginBottom:24}}>
        {[{start:0,label:"FRONT NINE"},{start:9,label:"BACK NINE"}].map(({start,label})=>(
          <div key={label} style={{overflowX:"auto",padding:"16px 16px 12px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontFamily:"'Bebas Neue'",letterSpacing:2,fontSize:11,color:"var(--green-dim)",marginBottom:8}}>{label}</div>
            <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
              <thead>
                <tr style={{color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,fontSize:10}}>
                  <td style={{padding:"4px 8px",minWidth:60}}>HOLE</td>
                  {Array.from({length:9},(_,i)=><td key={i} style={{textAlign:"center",padding:"4px 5px",minWidth:36}}>{start+i+1}</td>)}
                  <td style={{textAlign:"center",padding:"4px 8px",background:"var(--bg3)",minWidth:40}}>TOT</td>
                </tr>
              </thead>
              <tbody>
                <tr style={{color:"var(--text3)",fontSize:12}}>
                  <td style={{padding:"4px 8px"}}>Yards</td>
                  {yards.slice(start,start+9).map((y,i)=><td key={i} style={{textAlign:"center",padding:"4px 5px"}}>{y}</td>)}
                  <td style={{textAlign:"center",background:"var(--bg3)",fontWeight:600}}>{yards.slice(start,start+9).reduce((a,b)=>a+b,0)}</td>
                </tr>
                <tr style={{color:"var(--text3)",fontSize:11}}>
                  <td style={{padding:"4px 8px"}}>HCP</td>
                  {HCP_STROKES.slice(start,start+9).map((h,i)=><td key={i} style={{textAlign:"center",padding:"4px 5px"}}>{h}</td>)}
                  <td style={{background:"var(--bg3)"}}/>
                </tr>
                <tr style={{color:"var(--green)"}}>
                  <td style={{padding:"5px 8px",fontWeight:600,fontSize:13}}>Par</td>
                  {pars.slice(start,start+9).map((p,i)=><td key={i} style={{textAlign:"center",padding:"5px 5px",fontWeight:600,fontSize:14}}>{p}</td>)}
                  <td style={{textAlign:"center",fontWeight:700,background:"var(--bg3)",fontSize:14}}>{pars.slice(start,start+9).reduce((a,b)=>a+b,0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="section-label">── OFFICIAL SCORECARD</div>
      <div className="card" style={{padding:20}}>
        {course?.scorecardImage || course?.scorecardPdf ? (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:14,color:"var(--text2)"}}>📄 {course.scorecardName||"Scorecard"}</span>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-ghost btn-sm" onClick={()=>setShowScModal(true)}>View Full</button>
                <button className="btn-danger btn-sm" onClick={async()=>{ const u={...course,scorecardImage:null,scorecardPdf:null}; setCourse(u); await saveCourse(u); }}>Remove</button>
              </div>
            </div>
            {course.scorecardImage && <img src={course.scorecardImage} alt="Scorecard" style={{width:"100%",maxHeight:280,objectFit:"contain",borderRadius:4,border:"1px solid var(--border)",cursor:"pointer"}} onClick={()=>setShowScModal(true)}/>}
            {course.scorecardPdf && <div style={{textAlign:"center",padding:24,background:"var(--bg3)",borderRadius:4}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:13,color:"var(--text2)",marginBottom:10}}>PDF: {course.scorecardName}</div><button className="btn-ghost btn-sm" onClick={()=>setShowScModal(true)}>Open PDF</button></div>}
          </div>
        ) : (
          <>
            <div className="upload-zone" onClick={()=>fileRef.current.click()}>
              <div style={{fontSize:36,marginBottom:12}}>⛳</div>
              <div style={{fontSize:16,color:"var(--text2)",marginBottom:6}}>Upload Course Scorecard</div>
              <div style={{fontSize:12,color:"var(--text3)"}}>JPG · PNG · PDF · Click to browse</div>
            </div>
            <button className="btn-ghost btn-sm" style={{marginTop:12}} onClick={()=>fileRef.current.click()}>+ Upload File</button>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handleFileUpload}/>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // REGISTER
  const RegisterView = () => (
    <div className="fade-up" style={{maxWidth:460,margin:"0 auto"}}>
      {!regSuccess ? (
        <>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--green)",marginBottom:8}}>JOIN THE TOURNAMENT</div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2}}>PLAYER REGISTRATION</h2>
            <p style={{fontSize:14,color:"var(--text2)",marginTop:8,lineHeight:1.7}}>Fill in your details below to join the North Star Amateur Series.</p>
          </div>
          <div className="card" style={{padding:28}}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              <div>
                <div className="section-label">FULL NAME</div>
                <input defaultValue={regForm.name} onBlur={e=>setRegForm(f=>({...f,name:e.target.value}))} placeholder="First Last" style={{width:"100%"}}/>
              </div>
              <div>
                <div className="section-label">EMAIL ADDRESS</div>
                <input type="email" defaultValue={regForm.email} onBlur={e=>setRegForm(f=>({...f,email:e.target.value}))} placeholder="you@email.com" style={{width:"100%"}}/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>For tournament updates and announcements only.</div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{flex:1}}>
                  <div className="section-label">HANDICAP INDEX</div>
                  <input type="number" defaultValue={regForm.handicap} onBlur={e=>setRegForm(f=>({...f,handicap:e.target.value}))} placeholder="0" min="0" max="54" style={{width:"100%"}}/>
                  <div style={{fontSize:11,color:"var(--amber)",marginTop:5,lineHeight:1.4}}>⚠ Commissioner verifies before Event 1. Have your Grint screenshot ready.</div>
                </div>
                <div style={{flex:2}}>
                  <div className="section-label">SKILL LEVEL</div>
                  <select value={regForm.flight} onChange={e=>setRegForm(f=>({...f,flight:e.target.value}))} style={{width:"100%"}}>
                    {SKILL_LEVELS.map(f=><option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{flex:1}}>
                  <div className="section-label">YOUR PIN</div>
                  <input type="password" maxLength={4} defaultValue={regForm.pin} onBlur={e=>setRegForm(f=>({...f,pin:e.target.value.replace(/\D/g,"")}))} placeholder="4 digits" style={{width:"100%",letterSpacing:6,textAlign:"center",fontSize:18}}/>
                </div>
                <div style={{flex:1}}>
                  <div className="section-label">CONFIRM PIN</div>
                  <input type="password" maxLength={4} defaultValue={regForm.pin2} onBlur={e=>setRegForm(f=>({...f,pin2:e.target.value.replace(/\D/g,"")}))} placeholder="4 digits" style={{width:"100%",letterSpacing:6,textAlign:"center",fontSize:18}}/>
                </div>
              </div>
              <div style={{fontSize:12,color:"var(--text3)",fontStyle:"italic"}}>🔒 Your PIN protects your scorecard. Only you (and the commissioner) can edit your scores.</div>

              {/* Tournament password — only show if a one-off is active with a password */}
              {activeOneOff?.hasPassword && (
                <div style={{marginTop:16,padding:"12px 16px",background:"#0a1a0a",border:"1px solid var(--green)",borderRadius:4}}>
                  <div className="section-label" style={{color:"var(--green)",marginBottom:6}}>🟢 TOURNAMENT IN PROGRESS: {activeOneOff.title}</div>
                  <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>Have a tournament password? Enter it to join the leaderboard.</div>
                  <input defaultValue={regForm.tourneyPw} onBlur={e=>setRegForm(f=>({...f,tourneyPw:e.target.value}))}
                    placeholder="Tournament password" style={{width:"100%",fontSize:14}}/>
                </div>
              )}

              {/* League password */}
              <div style={{marginTop:4,padding:"12px 16px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4}}>
                <div className="section-label" style={{marginBottom:6}}>🔒 LEAGUE PASSWORD</div>
                <input defaultValue={regForm.leagueCode} onBlur={e=>setRegForm(f=>({...f,leagueCode:e.target.value}))}
                  placeholder="Enter league password" style={{width:"100%"}}/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Get this from the commissioner to complete registration.</div>
              </div>

              {regError && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"10px 14px",borderRadius:4}}>{regError}</div>}
              <button className="btn-gold" style={{width:"100%",padding:13,fontSize:15,marginTop:4}} onClick={handleRegister}>REGISTER &amp; JOIN →</button>
            </div>
          </div>
          <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"var(--text3)"}}>
            Already registered? <span style={{color:"var(--gold)",cursor:"pointer"}} onClick={()=>setScreen("my-scores-login")}>Enter scores →</span>
          </div>
        </>
      ) : (
        <div style={{textAlign:"center",paddingTop:40}}>
          <div style={{fontSize:52,marginBottom:16}}>🏌️</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:36,letterSpacing:2,color:"var(--gold)",marginBottom:10}}>YOU'RE IN!</div>
          <p style={{fontSize:16,color:"var(--text2)",marginBottom:28,lineHeight:1.8}}>Welcome, <strong>{activePlayer?.name}</strong>. Good luck out there.</p>
          <button className="btn-gold" style={{padding:"12px 32px",fontSize:14}} onClick={()=>setScreen("my-scores")}>START ENTERING SCORES →</button>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // MEMBERS DIRECTORY VIEW
  const AmateursView = () => {
    const amateurs = players.filter(p => p.memberType === "amateur");
    const leagueMembers = players.filter(p => p.memberType !== "amateur").sort((a,b)=>a.name.localeCompare(b.name));
    const spotsLeft = 32 - leagueMembers.length;
    return (
      <div className="fade-up" style={{maxWidth:640,margin:"0 auto"}}>
        {/* Header */}
        <div style={{marginBottom:28}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:5,color:"var(--green)",marginBottom:6}}>NORTH STAR AMATEUR SERIES · 2026</div>
          <h2 style={{fontFamily:"'Bebas Neue'",fontSize:36,letterSpacing:2,marginBottom:8}}>MEMBER ROSTER</h2>
          <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{fontSize:13,color:"var(--text3)"}}>{leagueMembers.length} of 32 league spots filled</div>
            <div style={{height:6,flex:1,minWidth:120,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(leagueMembers.length/32)*100}%`,background:"var(--green)",borderRadius:3}}/>
            </div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,color:spotsLeft>0?"var(--amber)":"var(--red)",letterSpacing:1}}>
              {spotsLeft>0?`${spotsLeft} SPOTS LEFT`:"FULL"}
            </div>
          </div>
        </div>

        {/* League Members */}
        <div style={{marginBottom:32}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:12}}>
            ── LEAGUE MEMBERS ({leagueMembers.length})
          </div>
          {leagueMembers.length === 0 ? (
            <div style={{padding:"32px 20px",textAlign:"center",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8}}>
              <div style={{fontSize:32,marginBottom:10}}>⛳</div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,marginBottom:6}}>NO MEMBERS YET</div>
              <div style={{fontSize:13,color:"var(--text3)"}}>Registration is open — share the league password to get players signed up.</div>
            </div>
          ) : (
            <div className="card" style={{overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"40px 1fr 70px 110px",background:"var(--bg3)",padding:"8px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
                <span>#</span><span>NAME</span><span style={{textAlign:"center"}}>HCP</span><span style={{textAlign:"center"}}>SKILL</span>
              </div>
              {leagueMembers.map((p, idx) => (
                <div key={p.id} style={{display:"grid",gridTemplateColumns:"40px 1fr 70px 110px",padding:"13px 16px",borderBottom:"1px solid var(--border)",alignItems:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:16,color:"var(--text3)"}}>{idx+1}</div>
                  <div>
                    <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>{p.name}</div>
                    {p.email && <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{p.email}</div>}
                  </div>
                  <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:15,color:"var(--text)"}}>{p.handicap}</div>
                  <div style={{textAlign:"center"}}>
                    <span style={{fontFamily:"'Bebas Neue'",fontSize:9,letterSpacing:1,color:"var(--text3)",border:"1px solid var(--border2)",borderRadius:3,padding:"2px 7px"}}>{p.flight||"—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Amateur Members */}
        <div style={{marginBottom:24}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--gold)",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>── AMATEUR MEMBERS ({amateurs.length})</span>
            <button className="btn-ghost btn-sm" style={{fontSize:10,letterSpacing:1}}
              onClick={()=>{ setAmateurSuccess(false); setAmateurError(""); setAmateurForm({name:"",email:"",handicap:"",pin:"",pin2:""}); setScreen("amateur-register"); }}>
              + JOIN AS AMATEUR
            </button>
          </div>
          {amateurs.length === 0 ? (
            <div style={{padding:"20px",textAlign:"center",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8}}>
              <div style={{fontSize:13,color:"var(--text3)"}}>No amateur members yet.</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {amateurs.map((p, idx) => (
                <div key={p.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontFamily:"'Bebas Neue'",fontSize:16,color:"var(--text3)",minWidth:28}}>{idx+1}</div>
                    <div>
                      <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{p.name}</div>
                      <div style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</div>
                    </div>
                  </div>
                  <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--gold)",border:"1px solid #c8a84a44",borderRadius:3,padding:"2px 8px"}}>AMATEUR</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // AMATEUR REGISTRATION VIEW
  const AmateurRegisterView = () => (
    <div className="fade-up" style={{maxWidth:460,margin:"0 auto"}}>
      {!amateurSuccess ? (
        <>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--gold)",marginBottom:8}}>JOIN AS AN AMATEUR</div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2}}>AMATEUR REGISTRATION</h2>
            <p style={{fontSize:14,color:"var(--text2)",marginTop:8,lineHeight:1.7}}>
              Not competing in the full season? Register as an amateur to be listed in the league directory and join one-off events.
            </p>
          </div>
          <div className="card" style={{padding:28}}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="section-label">FULL NAME</div>
                <input defaultValue={amateurForm.name} onBlur={e=>setAmateurForm(f=>({...f,name:e.target.value}))} placeholder="First Last" style={{width:"100%"}}/>
              </div>
              <div>
                <div className="section-label">EMAIL ADDRESS</div>
                <input type="email" defaultValue={amateurForm.email} onBlur={e=>setAmateurForm(f=>({...f,email:e.target.value}))} placeholder="you@email.com" style={{width:"100%"}}/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>For event invitations and announcements.</div>
              </div>
              <div>
                <div className="section-label">HANDICAP INDEX</div>
                <input type="number" defaultValue={amateurForm.handicap} onBlur={e=>setAmateurForm(f=>({...f,handicap:e.target.value}))} placeholder="0" min="0" max="54" style={{width:"100%"}}/>
                <div style={{fontSize:11,color:"var(--amber)",marginTop:5,lineHeight:1.4}}>⚠ Commissioner verifies before Event 1. Have your Grint screenshot ready.</div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{flex:1}}>
                  <div className="section-label">YOUR PIN</div>
                  <input type="password" maxLength={4} defaultValue={amateurForm.pin} onBlur={e=>setAmateurForm(f=>({...f,pin:e.target.value.replace(/\D/g,"")}))} placeholder="4 digits" style={{width:"100%",letterSpacing:6,textAlign:"center",fontSize:18}}/>
                </div>
                <div style={{flex:1}}>
                  <div className="section-label">CONFIRM PIN</div>
                  <input type="password" maxLength={4} defaultValue={amateurForm.pin2} onBlur={e=>setAmateurForm(f=>({...f,pin2:e.target.value.replace(/\D/g,"")}))} placeholder="4 digits" style={{width:"100%",letterSpacing:6,textAlign:"center",fontSize:18}}/>
                </div>
              </div>
              <div style={{fontSize:12,color:"var(--text3)",fontStyle:"italic"}}>🔒 Your PIN protects your profile. Set it now so you can log in later.</div>
              {/* Amateur badge preview */}
              <div style={{padding:"10px 14px",background:"#1a1200",border:"1px solid #c8a84a33",borderRadius:4,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--gold)",border:"1px solid var(--gold-dim)",borderRadius:3,padding:"2px 8px"}}>AMATEUR</span>
                <span style={{fontSize:12,color:"var(--text3)"}}>You'll appear in the Amateurs section of the league directory.</span>
              </div>
              {amateurError && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"10px 14px",borderRadius:4}}>{amateurError}</div>}
              <button className="btn-gold" style={{width:"100%",padding:13,fontSize:15,marginTop:4}} onClick={handleAmateurRegister}>REGISTER AS AMATEUR →</button>
            </div>
          </div>
          <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"var(--text3)"}}>
            Competing in the full season? <span style={{color:"var(--gold)",cursor:"pointer"}} onClick={()=>setScreen("register")}>League registration →</span>
          </div>
        </>
      ) : (
        <div style={{textAlign:"center",paddingTop:40}}>
          <div style={{fontSize:52,marginBottom:16}}>🏌️</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:36,letterSpacing:2,color:"var(--gold)",marginBottom:10}}>YOU'RE IN!</div>
          <div style={{display:"inline-block",fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--gold)",border:"1px solid var(--gold-dim)",borderRadius:3,padding:"3px 12px",marginBottom:16}}>AMATEUR</div>
          <p style={{fontSize:16,color:"var(--text2)",marginBottom:28,lineHeight:1.8}}>Welcome, <strong>{activePlayer?.name}</strong>.<br/>You're registered as an amateur member.</p>
          <button className="btn-ghost" style={{padding:"12px 32px",fontSize:14}} onClick={()=>setScreen("leaderboard")}>VIEW LEADERBOARD →</button>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // QUICK LOGIN — select player + PIN → goes straight to My Scores
  const LoginView = () => {
    const [step, setStep]         = React.useState("name"); // name | pin
    const [loginPid, setLoginPid] = React.useState("");
    const [loginPin, setLoginPin] = React.useState("");
    const [loginErr, setLoginErr] = React.useState("");
    const [logging,  setLogging]  = React.useState(false);

    const selectedPlayer = players.find(p=>p.id===loginPid);

    const handlePinSubmit = async () => {
      if (!selectedPlayer) return;
      setLogging(true);
      if (loginPin === ADMIN_PIN) {
        setActivePlayer(selectedPlayer.id);
        setActiveHole(Math.max(0, holesPlayed(selectedPlayer)-1)||0);
        setScreen("my-scores");
        return;
      }
      const hash = await hashPin(loginPin);
      if (hash === selectedPlayer.pinHash) {
        setActivePlayer(selectedPlayer.id);
        setActiveHole(Math.max(0, holesPlayed(selectedPlayer)-1)||0);
        setScreen("my-scores");
      } else {
        setLoginErr("Incorrect PIN. Try again or ask the commissioner.");
        setLogging(false);
        setLoginPin("");
      }
    };

    return (
      <div className="fade-up" style={{maxWidth:400,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--green)",marginBottom:8}}>NORTH STAR AMATEUR SERIES</div>
          <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2}}>PLAYER LOGIN</h2>
          <p style={{fontSize:14,color:"var(--text2)",marginTop:8}}>Select your name and enter your PIN to access your scorecard.</p>
        </div>

        {/* ── STEP 1: Name */}
        {step === "name" && (
          <div className="card" style={{padding:28}}>
            <div className="section-label" style={{marginBottom:8}}>YOUR NAME</div>
            <select value={loginPid} onChange={e=>{setLoginPid(e.target.value);setLoginErr("");}}
              style={{width:"100%",padding:"10px 12px",fontSize:15,background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:loginPid?"var(--text)":"var(--text3)",marginBottom:20}}>
              <option value="">Select your name...</option>
              {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
              disabled={!loginPid} onClick={()=>setStep("pin")}>
              CONTINUE →
            </button>
          </div>
        )}

        {/* ── STEP 2: PIN */}
        {step === "pin" && (
          <div className="card" style={{padding:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button onClick={()=>{setStep("name");setLoginPin("");setLoginErr("");}}
                style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer",padding:"0 4px"}}>←</button>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2}}>{selectedPlayer?.name}</div>
            </div>
            <div className="section-label" style={{marginBottom:8}}>YOUR PIN</div>
            <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:16}}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{width:48,height:56,border:"2px solid "+(loginPin.length>i?"var(--gold)":"var(--border2)"),borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,background:"var(--bg3)",color:"var(--gold)",transition:"all .15s"}}>
                  {loginPin.length>i?"●":""}
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
              {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
                <button key={i} onClick={()=>{
                  if(k==="⌫") setLoginPin(p=>p.slice(0,-1));
                  else if(k===""||loginPin.length>=4) return;
                  else { setLoginPin(p=>p+k); setLoginErr(""); }
                }} style={{padding:"15px 8px",fontFamily:"'DM Mono'",fontSize:20,background:k==="⌫"?"var(--bg3)":"var(--bg4)",border:"1px solid var(--border2)",borderRadius:6,color:k==="⌫"?"var(--red)":"var(--text)",cursor:k===""?"default":"pointer",opacity:k===""?0:1}}>
                  {k}
                </button>
              ))}
            </div>
            {loginErr && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"8px 12px",borderRadius:4,marginBottom:12}}>{loginErr}</div>}
            <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
              onClick={handlePinSubmit} disabled={logging||loginPin.length!==4}>
              {logging?"...":"LOG IN →"}
            </button>
          </div>
        )}

        <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"var(--text3)"}}>
          New player? <span style={{color:"var(--gold)",cursor:"pointer"}} onClick={()=>setScreen("register")}>Register here →</span>
        </div>
      </div>
    );
  };

    // MY SCORES LOGIN
  const MyScoresLogin = () => {
    const handlePinSubmit = async () => {
      if (!pendingPlayer) return;
      const attempts = pinAttempts[pendingPlayer.id] || 0;
      if (attempts >= 5) { setScorePinError("Too many attempts. Ask the commissioner to reset your PIN."); return; }
      // Admin override — admin PIN bypasses player PIN
      if (scorePin === ADMIN_PIN) {
        setActivePlayer(pendingPlayer.id);
        setActiveHole(Math.max(0, holesPlayed(pendingPlayer)-1)||0);
        setScreen("my-scores");
        setScorePin(""); setScorePinError(""); setPendingPlayer(null);
        return;
      }
      const hash = await hashPin(scorePin);
      if (hash === pendingPlayer.pinHash) {
        setActivePlayer(pendingPlayer.id);
        setActiveHole(Math.max(0, holesPlayed(pendingPlayer)-1)||0);
        setScreen("my-scores");
        setPinAttempts(prev => ({ ...prev, [pendingPlayer.id]: 0 }));
        setScorePin(""); setScorePinError(""); setPendingPlayer(null);
      } else {
        const newAttempts = attempts + 1;
        setPinAttempts(prev => ({ ...prev, [pendingPlayer.id]: newAttempts }));
        setScorePinError(`Incorrect PIN. ${5 - newAttempts} attempt${5-newAttempts===1?"":"s"} remaining.`);
      }
    };
    return (
      <div className="fade-up" style={{maxWidth:460,margin:"0 auto"}}>
        {!pendingPlayer ? (
          <>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--green)",marginBottom:6}}>SCORE ENTRY</div>
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:28,letterSpacing:2}}>WHO ARE YOU?</h2>
            </div>
            <div className="card" style={{overflow:"hidden"}}>
              {players.length === 0 && <div style={{padding:32,textAlign:"center",color:"var(--text3)",fontSize:14}}>No players registered yet.<br/>Register using the Register tab.</div>}
              {players.map(p=>(
                <div key={p.id} className="player-row" style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  onClick={()=>{ setPendingPlayer(p); setScorePin(""); setScorePinError(""); }}>
                  <div>
                    <div style={{fontSize:17,fontWeight:600}}>{p.name}</div>
                    <div style={{fontSize:12,color:"var(--text3)"}}>HCP {p.handicap} · Thru {holesPlayed(p)||"—"}</div>
                  </div>
                  <span style={{color:"var(--gold)",fontSize:12,fontFamily:"'Bebas Neue'",letterSpacing:1}}>SELECT →</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--green)",marginBottom:8}}>SCORE ENTRY</div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:28,letterSpacing:2,marginBottom:4}}>{pendingPlayer.name}</h2>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:28}}>Enter your 4-digit PIN to continue</div>
            <div className="card" style={{padding:28,maxWidth:320,margin:"0 auto"}}>
              <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:20}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} style={{width:48,height:56,border:`2px solid ${scorePin.length>i?"var(--gold)":"var(--border2)"}`,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,background:"var(--bg3)",color:"var(--gold)",transition:"all .15s"}}>
                    {scorePin.length>i?"●":""}
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
                  <button key={i} onClick={()=>{
                    if(k==="⌫") setScorePin(p=>p.slice(0,-1));
                    else if(k===""||scorePin.length>=4) return;
                    else setScorePin(p=>p+k);
                    setScorePinError("");
                  }} style={{padding:"16px 8px",fontFamily:"'DM Mono'",fontSize:20,background:k==="⌫"?"var(--bg3)":"var(--bg4)",border:"1px solid var(--border2)",borderRadius:6,color:k==="⌫"?"var(--red)":"var(--text)",cursor:k===""?"default":"pointer",opacity:k===""?0:1}}>
                    {k}
                  </button>
                ))}
              </div>
              {scorePinError && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"8px 12px",borderRadius:4,marginBottom:12}}>{scorePinError}</div>}
              <button className="btn-gold" style={{width:"100%",fontSize:14,padding:12}} onClick={handlePinSubmit} disabled={scorePin.length!==4}>ENTER →</button>
              <button className="btn-ghost" style={{width:"100%",fontSize:12,marginTop:8}} onClick={()=>{ setPendingPlayer(null); setScorePin(""); setScorePinError(""); }}>← BACK</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MY SCORES — mobile entry
  const MyScores = () => {
    if (!activePlayer) { setScreen("my-scores-login"); return null; }
    const player = players.find(p=>p.id===activePlayer);
    if (!player) { setScreen("my-scores-login"); return null; }
    // Extra guard: activePlayer must match a real player and must have authenticated via PIN
    // (activePlayer is only set after successful PIN entry in MyScoresLogin)

    const s    = player.scores[activeHole];
    const par  = pars[activeHole];
    const diff = s !== null ? s - par : null;
    const scColor = diff===null?"var(--text3)":diff<=-1?"var(--gold)":diff===0?"var(--green)":diff===1?"var(--amber)":"var(--red)";
    const scBg    = diff===null?"var(--bg3)":diff<=-1?"#1c1600":diff===0?"#0a1a0a":diff===1?"#1c1000":"#1c0808";
    const net  = calcNet(player,pars);

    return (
      <div className="fade-up" style={{maxWidth:480,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:4,color:"var(--green)",marginBottom:4}}>SCORE ENTRY</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:2}}>{player.name}</div>
          <div style={{fontSize:12,color:"var(--text3)"}}>HCP {player.handicap}</div>
          <button onClick={()=>{ setActivePlayer(null); setScreen("my-scores-login"); }}
            style={{marginTop:10,padding:"5px 14px",fontSize:11,fontFamily:"'Bebas Neue'",letterSpacing:1,background:"transparent",border:"1px solid #3a1010",color:"var(--red)",borderRadius:3,cursor:"pointer"}}>
            🔒 LOCK &amp; EXIT
          </button>
        </div>

        <div className="section-label">── SELECT HOLE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
          {Array.from({length:18},(_,i)=>{
            const hs=player.scores[i];
            return (
              <button key={i} className={`hole-score-btn ${activeHole===i?"active":""}`}
                style={{width:44,height:44,background:hs!==null?"var(--bg4)":"var(--bg3)",color:hs!==null?(activeHole===i?"var(--gold)":"var(--text2)"):"var(--text3)"}}
                onClick={()=>setActiveHole(i)}>
                {hs!==null?hs:i+1}
              </button>
            );
          })}
        </div>

        {/* CTP card — always visible on par 3s */}
        {par === 3 && (() => {
          const ctpKey = `hole_${activeHole}`;
          const ctpBet = ctpBets[ctpKey];
          const myEntry = ctpBet?.entries?.[player.id];

          // Already locked in + distance entered
          if (myEntry?.lockedIn && myEntry.feet !== undefined) return (
            <div style={{marginBottom:12,padding:"12px 16px",background:"#0d1a0d",border:"1px solid var(--green-dim)",borderRadius:6,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>📍</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:2}}>CTP — HOLE {activeHole+1}</div>
                <div style={{fontSize:13,color:"var(--text2)"}}>Your distance: <strong style={{color:"var(--gold)",fontFamily:"'Bebas Neue'",fontSize:16}}>{myEntry.feet}' {myEntry.inches}"</strong></div>
              </div>
              <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--green)"}}>ENTERED</span>
            </div>
          );

          // Locked in, need to enter distance
          if (myEntry?.lockedIn) return (
            <div style={{marginBottom:12,padding:"14px 16px",background:"#120e00",border:"1px solid var(--gold-dim)",borderRadius:6}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--gold)",marginBottom:10}}>📍 CTP — HOLE {activeHole+1} · ENTER YOUR DISTANCE</div>
              <CtpDistanceEntry player={player} holeIdx={activeHole} ctpBet={ctpBet} notify={notify} />
            </div>
          );

          // Not yet locked in — show opt-in prompt
          return (
            <div style={{marginBottom:12,padding:"14px 16px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:6}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:22}}>📍</span>
                <div>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:3,color:"var(--gold)"}}>CLOSEST TO PIN — HOLE {activeHole+1}</div>
                  <div style={{fontSize:12,color:"var(--text3)"}}>Par 3 · Opt in to compete for CTP</div>
                </div>
              </div>
              <button className="btn-gold" style={{width:"100%",fontSize:13,padding:12,letterSpacing:2}} onClick={async()=>{
                const existing = ctpBet || { holeIndex: activeHole, active: true, entries: {} };
                await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"ctp_bets",ctpKey),{
                  ...existing,
                  entries:{ ...(existing.entries||{}), [player.id]:{ lockedIn:true, lockedAt:new Date().toISOString() } }
                });
                notify("Locked in for CTP! Enter your distance after you play the hole.");
              }}>
                🔒 LOCK IN FOR CTP
              </button>
            </div>
          );
        })()}

        <div className="card" style={{padding:24,marginBottom:16}}>
          {/* Hole header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:48,letterSpacing:1,lineHeight:1}}>HOLE {activeHole+1}</div>
              <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>Par {par} · {yards[activeHole]}yds · HCP {HCP_STROKES[activeHole]}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{width:80,height:80,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontFamily:"'Bebas Neue'",background:scBg,border:`2px solid ${scColor}`,color:scColor,transition:"all .2s"}}>
                {s??"—"}
              </div>
              {s!==null && <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:2,color:scColor,marginTop:4}}>{scoreLabel(s,par)}</div>}
            </div>
          </div>

          {/* Score buttons — par-relative, auto-advance on tap */}
          {(()=>{
            const scores = [];
            for (let n = Math.max(1, par-3); n <= Math.min(10, Math.max(par+4, 10)); n++) scores.push(n);
            const labelFor = (n) => {
              const d = n - par;
              if (d <= -3) return "ALBATROSS";
              if (d === -2) return "EAGLE";
              if (d === -1) return "BIRDIE";
              if (d === 0)  return "PAR";
              if (d === 1)  return "BOGEY";
              if (d === 2)  return "DOUBLE";
              if (d === 3)  return "TRIPLE";
              return `+${d}`;
            };
            const colorFor = (n) => {
              const d = n - par;
              if (d <= -2) return { bg:"#1c1600", border:"var(--gold)", text:"var(--gold)" };
              if (d === -1) return { bg:"#0a2a0a", border:"var(--green)", text:"var(--green-bright)" };
              if (d === 0)  return { bg:"#0a1a0a", border:"var(--green-dim)", text:"var(--text)" };
              if (d === 1)  return { bg:"#1c1000", border:"var(--amber)", text:"var(--amber)" };
              if (d === 2)  return { bg:"#2a0a0a", border:"var(--red)", text:"var(--red)" };
              return { bg:"#1a0808", border:"#6a1010", text:"#e05050" };
            };
            return (
              <div style={{display:"grid",gridTemplateColumns:`repeat(${scores.length},1fr)`,gap:6,marginBottom:8}}>
                {scores.map(n => {
                  const isSelected = s === n;
                  const c = colorFor(n);
                  return (
                    <button key={n} onClick={async () => {
                      await updateScore(player.id, activeHole, n);
                      if (activeHole < 17) setActiveHole(h => h + 1);
                    }}
                      style={{
                        padding:"16px 4px", cursor:"pointer", borderRadius:8, transition:"all .12s",
                        display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                        background: isSelected ? c.border : c.bg,
                        border: `2px solid ${isSelected ? c.border : c.border+"66"}`,
                        transform: isSelected ? "scale(1.05)" : "scale(1)",
                        boxShadow: isSelected ? `0 0 12px ${c.border}55` : "none",
                      }}>
                      <span style={{fontFamily:"'DM Mono'",fontSize:22,fontWeight:700,color:isSelected?"#060a06":c.text,lineHeight:1}}>{n}</span>
                      <span style={{fontFamily:"'Bebas Neue'",fontSize:9,letterSpacing:1,color:isSelected?"#060a06":c.text+"99"}}>{labelFor(n)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Clear + nav */}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>updateScore(player.id,activeHole,"")}
              style={{padding:"10px 14px",fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:1,cursor:"pointer",borderRadius:6,background:"transparent",color:"var(--red)",border:"1px solid #2a1010"}}>
              CLR
            </button>
            <button className="btn-ghost" style={{flex:1}} disabled={activeHole===0} onClick={()=>setActiveHole(h=>Math.max(0,h-1))}>← PREV</button>
            <button className="btn-gold"  style={{flex:1,fontSize:13}} disabled={activeHole===17} onClick={()=>setActiveHole(h=>Math.min(17,h+1))}>NEXT →</button>
          </div>
        </div>

        <div className="card" style={{padding:16,display:"flex",justifyContent:"space-around"}}>
          {[["THRU",holesPlayed(player)===18?"F":holesPlayed(player)||"—","var(--text)"],
            ["GROSS",player.scores.filter(Boolean).reduce((a,b)=>a+b,0)||"—","var(--text)"],
            ["NET",toPM(net),net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"]
          ].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:24,color:c}}>{v}</div>
              <div style={{fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>{l}</div>
            </div>
          ))}
        </div>
        {/* Scorecard Upload Section */}
        <ScorecardUpload player={player} upload={scorecardUploads[player.id]} notify={notify} />

        <div style={{textAlign:"center",marginTop:14}}>
          <span style={{fontSize:12,color:"var(--text3)",cursor:"pointer"}} onClick={()=>setScreen("leaderboard")}>← Back to Leaderboard</span>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN

  // ══════════════════════════════════════════════════════════════════════════
  // SIDEBETS LOGIN
  const SidebetsLogin = () => {
    const [sbPid, setSbPid]       = React.useState("");
    const [sbPin, setSbPin]       = React.useState("");
    const [sbErr, setSbErr]       = React.useState("");
    const [sbStep, setSbStep]     = React.useState("pick"); // pick | pin

    const sbPlayer = players.find(p=>p.id===sbPid);

    const verifySbPin = async () => {
      if (!sbPlayer) return;
      if (sbPin === ADMIN_PIN) { setActivePlayer(sbPid); setSbErr(""); return; }
      const hash = await hashPin(sbPin);
      if (hash === sbPlayer.pinHash) {
        setActivePlayer(sbPid);
        setSbErr("");
      } else {
        setSbErr("Incorrect PIN. Try again.");
        setSbPin("");
      }
    };

    return (
      <div style={{maxWidth:420,margin:"0 auto"}} className="fade-up">
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:4,color:"var(--green)",marginBottom:4}}>PRIVATE</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:28,letterSpacing:2}}>SIDEBETS</div>
          <div style={{fontSize:13,color:"var(--text3)",marginTop:6}}>Log in to view and create sidebets</div>
        </div>

        {sbStep === "pick" && (
          <div className="card" style={{padding:20}}>
            <div className="section-label" style={{marginBottom:12}}>SELECT YOUR NAME</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:320,overflowY:"auto"}}>
              {players.map(p=>(
                <button key={p.id}
                  className={`flight-chip ${sbPid===p.id?"active":""}`}
                  style={{textAlign:"left",padding:"12px 16px",fontSize:14,justifyContent:"space-between",display:"flex",alignItems:"center"}}
                  onClick={()=>setSbPid(p.id)}>
                  <span>{p.name}</span>
                  <span style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</span>
                </button>
              ))}
            </div>
            <button className="btn-gold" style={{width:"100%",marginTop:14,fontSize:13}}
              disabled={!sbPid} onClick={()=>setSbStep("pin")}>
              CONTINUE →
            </button>
          </div>
        )}

        {sbStep === "pin" && (
          <div className="card" style={{padding:24,textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,marginBottom:4}}>{sbPlayer?.name}</div>
            <div style={{fontSize:13,color:"var(--text3)",marginBottom:20}}>Enter your PIN to access sidebets</div>
            <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:16}}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{width:44,height:52,background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontFamily:"'DM Mono'",color:"var(--gold)"}}>
                  {sbPin[i]?"●":""}
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:220,margin:"0 auto 16px"}}>
              {[1,2,3,4,5,6,7,8,9,"←",0,"→"].map((k,i)=>(
                <button key={i} style={{padding:"14px 0",fontFamily:"'DM Mono'",fontSize:18,background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--text)",cursor:"pointer"}}
                  onClick={()=>{
                    if(k==="←") setSbPin(p=>p.slice(0,-1));
                    else if(k==="→") verifySbPin();
                    else if(sbPin.length<4) setSbPin(p=>p+k);
                  }}>
                  {k}
                </button>
              ))}
            </div>
            {sbErr && <div style={{color:"var(--red)",fontSize:13,marginBottom:10}}>{sbErr}</div>}
            <button className="btn-ghost" style={{fontSize:12,marginTop:4}} onClick={()=>{ setSbStep("pick"); setSbPin(""); setSbErr(""); }}>← Back</button>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ROOT RENDER
 const NAV_PRIMARY = [
    ["leaderboard","🏆 LEADERBOARD"],
    ["tournament","⛳ TOURNAMENTS"],
    ["season","🌟 STANDINGS"],
    ["rules","📋 RULES"],
    ["course","🗺 COURSE"],
    ["handicap","🏅 HANDICAPS"],
    ["amateurs","👥 MEMBERS"],
    ["sidebets","🤝 SIDEBETS"],
    ["history","📖 HISTORY"],
  ];
  const activeNav = screen==="my-scores"?"login":screen==="my-scores-login"?"login":screen==="sidebets"?"sidebets":screen==="tournament-scores"?"tournament":screen==="amateur-register"?"amateurs":screen;

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      {notif && <div className={`notif notif-${notif.type}`}>{notif.msg}</div>}

      {/* Scorecard modal */}
      {showScModal && (course?.scorecardImage||course?.scorecardPdf) && (
        <div className="modal-bg" onClick={()=>setShowScModal(false)}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:8,padding:20,maxWidth:"92vw",maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontFamily:"'Bebas Neue'",letterSpacing:2,fontSize:16}}>{course?.name} — Official Scorecard</span>
              <button className="btn-ghost btn-sm" onClick={()=>setShowScModal(false)}>✕ Close</button>
            </div>
            {course.scorecardImage && <img src={course.scorecardImage} alt="Scorecard" style={{maxWidth:"80vw",maxHeight:"76vh",objectFit:"contain",display:"block"}}/>}
            {course.scorecardPdf   && <iframe src={course.scorecardPdf} title="PDF" style={{width:"78vw",height:"76vh",border:"none"}}/>}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"linear-gradient(180deg,#080e08,var(--bg))",borderBottom:"1px solid var(--border)",padding:"0 20px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{padding:"18px 0 0",display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <img src="/logo.png" alt="North Star Golf" style={{width:72,height:72,objectFit:"contain",flexShrink:0}}/>
              <div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:4,color:"var(--green)",marginBottom:3,display:"flex",alignItems:"center",gap:8}}>
                  <span className={`sync-dot ${syncStatus}`}/>
                  {syncStatus==="synced"?"LIVE · ALL SCORES SYNCED":syncStatus==="syncing"?"SYNCING…":"SYNC ERROR — CHECK CONNECTION"}
                </div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,lineHeight:1}}>NORTH STAR AMATEUR SERIES</div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>{course?.name} · {course?.city} · Par {totalPar} · {players.length} Players</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <button className="btn-ghost btn-sm" onClick={()=>{ setRegSuccess(false); setRegError(""); setScreen("register"); }}>JOIN / REGISTER</button>
              <button className="btn-ghost btn-sm" onClick={()=>setScreen("admin")} style={{fontSize:11,letterSpacing:1}}>⚙ ADMIN</button>
              <button className="btn-gold btn-sm" style={{display:"flex",alignItems:"center",gap:6}} onClick={()=>setScreen(activePlayer?"my-scores":"my-scores-login")}>
                {activePlayer ? <><span style={{fontSize:10,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{players.find(p=>p.id===activePlayer)?.name?.split(" ")[0]?.toUpperCase()}</span><span> ✏️</span></> : <>✏️ LOG IN</>}
              </button>
              {activePlayer && (
                <button className="btn-ghost btn-sm"
                  style={{color:"var(--red)",borderColor:"#2a1010",fontSize:11}}
                  onClick={()=>{ setActivePlayer(null); setScreen("leaderboard"); notify("Logged out. See you on the course! 🏌️"); }}>
                  🔒 LOG OUT
                </button>
              )}
            </div>
          </div>
          <div style={{display:"flex",marginTop:12,overflowX:"auto",gap:0,scrollbarWidth:"none",msOverflowStyle:"none"}}>
            {NAV_PRIMARY.map(([val,label])=>(
              <div key={val} className={`nav-pill ${activeNav===val?"active":""}`}
                onClick={()=>{ if(val==="login"&&activePlayer)setScreen("my-scores"); else setScreen(val); }}>
                {label}
              </div>
            ))}

          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 16px"}}>
        {screen==="leaderboard"     && <Leaderboard/>}
        {(screen==="tournament"||screen==="tournament-scores") && <TournamentTab/>}
        {screen==="scorecard"       && <ScorecardView/>}
        {screen==="course"          && <CourseView/>}
        {screen==="register"        && <RegisterView/>}
        {screen==="amateurs"          && <AmateursView/>}
        {screen==="amateur-register"  && <AmateurRegisterView/>}
        {(screen==="login"||screen==="my-scores-login") && <LoginView/>}
        {screen==="my-scores"       && <MyScores/>}
        {screen==="history" && <TournamentHistory players={players} adminUnlocked={adminUnlocked} />}
        {screen==="rules" && <RulesPage adminUnlocked={adminUnlocked} />}
        {screen==="sidebets" && (
          <Sidebets
            myPlayer={activePlayer ? players.find(p=>p.id===activePlayer) : null}
            players={players}
            pars={pars}
            ctpBets={ctpBets}
            onCtpOptToggle={async (val) => {
              if (!activePlayer) return;
              await updateDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",activePlayer),{ctpOptIn:val});
              notify(val?"Opted in to CTP bets ✓":"Opted out of CTP bets");
            }}
          />
        )}
        {screen==="season" && <SeasonStandings players={players} adminUnlocked={adminUnlocked} />}
        {screen==="handicap" && <HandicapTracker players={players} adminUnlocked={adminUnlocked} onHandicapUpdate={(pid,hcp)=>setPlayers(prev=>prev.map(p=>p.id===pid?{...p,handicap:hcp}:p))} />}
        {screen==="admin" && <AdminView
          course={course} players={players} adminUnlocked={adminUnlocked}
          setAdminUnlocked={setAdminUnlocked} pinInput={pinInput} setPinInput={setPinInput}
          pinError={pinError} setPinError={setPinError}
          savePlayer={savePlayer} removePlayerDb={removePlayerDb}
          saveCourse={saveCourse} setCourse={setCourse}
          updateField={updateField} notify={notify}
          scorecardUploads={scorecardUploads}
          courseLibrary={courseLibrary}
          saveCourseToLibrary={saveCourseToLibrary}
          pars={pars}
        />}
      </div>
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}

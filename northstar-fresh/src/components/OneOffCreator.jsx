import React from "react";
import { db } from "../firebase";
import { doc, collection, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { TOURNAMENT_ID, DEFAULT_PAR } from "../constants";
import { hashPin } from "../lib/scoring";
import { calcHoleRange } from "../lib/handicap";
import CourseSearch from "./CourseSearch";
import ConfirmModal from "./ConfirmModal";

export default function OneOffCreator({ players, notify, courseLibrary, pars }) {
  const [title,    setTitle]    = React.useState("");
  const [date,     setDate]     = React.useState("");
  const [course,   setCourse2]  = React.useState("");
  const [notes,    setNotes]    = React.useState("");
  const [saving,   setSaving]   = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [tourneys, setTourneys] = React.useState([]);
  const [active,   setActive]   = React.useState(null);
  const [password,   setPassword]   = React.useState("");
  const [courseInfo, setCourseInfo] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);

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

  const startTournament = () => {
    if (!title.trim()) { notify("Enter a title before starting.", "error"); return; }
    setConfirm({
      message: `Start "${title.trim()}"? Players can join and enter scores immediately.`,
      confirmLabel: "START", danger: false,
      onConfirm: async () => {
        setConfirm(null); setStarting(true);
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
      },
    });
  };

  const lockAndSave = async () => {
    const t = active || { title: title.trim(), date: date, course: course.trim(), notes: notes.trim() };
    if (!t.title) { notify("No active tournament to lock.", "error"); return; }
    setSaving(true);
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

  const cancelActive = (t) => {
    const tourney = t || active;
    if (!tourney) return;
    setConfirm({
      message: `Cancel "${tourney.title}"? It won't be saved.`,
      confirmLabel: "CANCEL TOURNAMENT",
      onConfirm: async () => {
        setConfirm(null);
        try {
          if (tourney.id) await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"active_tournaments",tourney.id));
          await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"settings","active_oneoff"));
          notify("Tournament cancelled.");
        } catch(e) { console.error(e); notify("Failed to cancel tournament — check connection.", "error"); }
      },
    });
  };

  const remove = (id, name) => {
    setConfirm({
      message: `Delete "${name}"?`,
      confirmLabel: "DELETE",
      onConfirm: async () => {
        setConfirm(null);
        await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"one_off_tournaments",id));
        notify("Tournament deleted.");
      },
    });
  };

  const playersWithScores = players.filter(p=>p.scores?.some(Boolean)).length;

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} confirmLabel={confirm.confirmLabel} danger={confirm.danger!==false} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)} />}
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

      {/* Setup form */}
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
            <CourseSearch onSelect={c => { setCourse2(c.name); setCourseInfo(c); }}/>
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

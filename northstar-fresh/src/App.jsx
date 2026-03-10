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


// ── Simple PIN hash (SHA-256 via Web Crypto API)
const hashPin = async (pin) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
};

// ─── Constants ───────────────────────────────────────────────────────────────
const SKILL_LEVELS  = ["Scratch (0-5)", "Low (6-12)", "Mid (13-20)", "High (21+)"];
const DEFAULT_PAR   = [4,4,3,4,5,3,4,4,5, 4,3,4,5,4,3,4,4,5];
const DEFAULT_YARDS = [385,412,178,395,520,162,430,388,510, 402,185,415,535,375,160,420,395,525];
const HCP_STROKES   = [7,1,15,5,9,17,3,13,11, 8,18,4,6,16,14,2,12,10];
const JOIN_CODE     = "NORTHSTAR24";
const ADMIN_PIN     = "1234";
const TOURNAMENT_ID = "tournament-2024"; // change per season/event

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toPM = v =>
  v === null || v === undefined || isNaN(v) ? "—"
  : v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`;

const lastFilledIdx = scores => {
  let last = -1;
  scores.forEach((s, i) => { if (s !== null) last = i; });
  return last;
};

const calcGrossToPar = (player, pars) => {
  const last = lastFilledIdx(player.scores);
  if (last < 0) return null;
  const gross  = player.scores.slice(0, last+1).filter(s=>s!==null).reduce((a,b)=>a+b,0);
  const parSum = pars.slice(0, last+1).reduce((a,b)=>a+b,0);
  return gross - parSum;
};

const calcNet = (player, pars) => {
  const last = lastFilledIdx(player.scores);
  if (last < 0) return null;
  let hcpStrokes = 0;
  player.scores.forEach((s, i) => {
    if (s === null) return;
    if (HCP_STROKES[i] <= player.handicap) hcpStrokes++;
    if (player.handicap > 18 && HCP_STROKES[i] <= player.handicap - 18) hcpStrokes++;
  });
  const gross  = player.scores.slice(0,last+1).filter(s=>s!==null).reduce((a,b)=>a+b,0);
  const parSum = pars.slice(0,last+1).reduce((a,b)=>a+b,0);
  return gross - hcpStrokes - parSum;
};

const holesPlayed = p => lastFilledIdx(p.scores) + 1;

const scoreLabel = (score, par) => {
  if (score === null) return "";
  const d = score - par;
  if (d <= -2) return "EAGLE";
  if (d === -1) return "BIRDIE";
  if (d === 0)  return "PAR";
  if (d === 1)  return "BOGEY";
  if (d === 2)  return "DOUBLE BOGEY";
  return "TRIPLE+";
};

const scoreClass = (score, par) => {
  if (score === null) return "";
  const d = score - par;
  if (d <= -2) return "s-eagle";
  if (d === -1) return "s-birdie";
  if (d === 0)  return "s-par";
  if (d === 1)  return "s-bogey";
  return "s-double";
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#080c08;--bg2:#0c120c;--bg3:#101810;--bg4:#141e14;
  --border:#1c2a1c;--border2:#243424;
  --gold:#c8a830;--gold2:#a88020;--gold-dim:#7a6010;
  --green:#5a9a5a;--green-dim:#3a6a3a;--green-bright:#70c870;
  --text:#e4dcc8;--text2:#a09880;--text3:#607060;
  --red:#c04030;--amber:#d07830;
}
body{background:var(--bg);color:var(--text);font-family:'Cormorant Garamond',Georgia,serif;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:var(--bg);}
::-webkit-scrollbar-thumb{background:var(--border2);}
input,select,textarea{font-family:inherit;background:var(--bg2);border:1px solid var(--border2);color:var(--text);padding:8px 12px;border-radius:3px;outline:none;font-size:14px;transition:border-color .2s;}
input:focus,select:focus,textarea:focus{border-color:var(--gold);}
button{cursor:pointer;font-family:'Bebas Neue',sans-serif;letter-spacing:1.5px;border:none;border-radius:3px;transition:all .2s;}
.btn-gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#060a06;padding:10px 24px;font-size:14px;}
.btn-gold:hover{filter:brightness(1.1);}
.btn-ghost{background:transparent;border:1px solid var(--border2);color:var(--text2);padding:8px 18px;font-size:13px;}
.btn-ghost:hover{border-color:var(--green);color:var(--text);}
.btn-sm{padding:5px 12px;font-size:11px;}
.btn-danger{background:transparent;border:1px solid #3a1818;color:var(--red);padding:5px 10px;font-size:11px;letter-spacing:1px;}
.btn-danger:hover{background:#3a181822;}
.s-eagle{background:var(--gold);color:#060a06;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;margin:auto;font-weight:700;}
.s-birdie{border:2px solid var(--gold);color:var(--gold);border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;margin:auto;}
.s-par{color:var(--text);}
.s-bogey{color:var(--amber);}
.s-double{color:var(--red);font-weight:700;}
.nav-pill{padding:7px 16px;font-family:'Bebas Neue';letter-spacing:2px;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;color:var(--text3);transition:all .2s;white-space:nowrap;}
.nav-pill.active{color:var(--gold);border-bottom-color:var(--gold);}
.nav-pill:hover{color:var(--text);}
.flight-chip{padding:4px 14px;font-size:12px;border:1px solid var(--border);border-radius:20px;color:var(--text3);cursor:pointer;transition:all .2s;background:transparent;font-family:'Bebas Neue';letter-spacing:1px;}
.flight-chip.active{border-color:var(--green);color:#8ac88a;background:var(--bg3);}
.player-row{border-bottom:1px solid var(--border);transition:background .15s;cursor:pointer;}
.player-row:hover{background:var(--bg3);}
.sc-input{width:36px;background:var(--bg3);border:1px solid var(--border2);color:var(--text);text-align:center;padding:4px 2px;border-radius:3px;font-size:13px;font-family:'DM Mono';}
.sc-input:focus{border-color:var(--gold);outline:none;}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:6px;}
.section-label{font-family:'Bebas Neue';letter-spacing:3px;font-size:11px;color:var(--green);margin-bottom:10px;}
.upload-zone{border:2px dashed var(--border2);border-radius:8px;padding:40px;text-align:center;cursor:pointer;transition:all .2s;}
.upload-zone:hover{border-color:var(--gold-dim);background:var(--bg3);}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(6px);}
.notif{position:fixed;top:20px;right:20px;z-index:999;padding:12px 20px;border-radius:4px;font-size:14px;animation:slideIn .3s ease;}
.notif-success{background:#1a3a1a;border:1px solid var(--green);color:#8ac88a;}
.notif-error{background:#3a1818;border:1px solid var(--red);color:#e08080;}
.notif-info{background:#1a1a3a;border:1px solid #5a5a9a;color:#9a9ae0;}
@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp .35s ease;}
.pulse{animation:pulse2 2s infinite;}
@keyframes pulse2{0%,100%{opacity:1}50%{opacity:.35}}
.hole-score-btn{border-radius:6px;background:var(--bg3);border:1px solid var(--border2);color:var(--text2);font-family:'DM Mono';font-size:17px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.hole-score-btn:hover{border-color:var(--gold);color:var(--text);}
.hole-score-btn.active{border-color:var(--gold);background:var(--bg4);color:var(--gold);}
.sync-dot{width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block;}
.sync-dot.syncing{background:var(--amber);animation:pulse2 0.8s infinite;}
.sync-dot.error{background:var(--red);}
`;

// ═════════════════════════════════════════════════════════════════════════════
// ── AdminView as standalone component to prevent remount on parent re-render
function AdminView({ course, players, adminUnlocked, setAdminUnlocked, pinInput, setPinInput,
  pinError, setPinError, savePlayer, removePlayerDb, saveCourse, setCourse, updateField, notify,
  scorecardUploads }) {
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
        <div style={{marginBottom:24,padding:"16px 20px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div className="section-label" style={{marginBottom:2}}>PLAYER JOIN CODE — SHARE THIS</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:30,letterSpacing:5,color:"var(--gold)"}}>{JOIN_CODE}</div>
          </div>
          <div style={{fontSize:13,color:"var(--text3)",maxWidth:280}}>Players enter this on the Register screen to join the tournament and enter scores from their phones.</div>
        </div>

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

          <button className="btn-gold" onClick={saveAll} disabled={saving} style={{fontSize:13}}>
            {saving?"SAVING…":"SAVE COURSE CHANGES"}
          </button>
        </div>

        {/* Players */}
        <div className="section-label">── PLAYER ROSTER ({players.length} players)</div>
        <div className="card" style={{overflow:"hidden",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 80px 150px 90px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
            <span>NAME</span><span>HCP</span><span>SKILL LEVEL</span><span></span>
          </div>
          {players.map(p=>{
          const upload = scorecardUploads?.[p.id];
          return (<React.Fragment key={p.id}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px 150px 90px",padding:"10px 16px",borderBottom:"1px solid var(--border)",alignItems:"center",gap:8}}>
              <input defaultValue={p.name} key={p.id+"-name"} onBlur={e=>updateField(p.id,"name",e.target.value)} style={{width:"100%",padding:"5px 8px"}}/>
              <input type="number" defaultValue={p.handicap} key={p.id+"-hcp"} onBlur={e=>updateField(p.id,"handicap",e.target.value)} min="0" max="54" style={{width:65,borderColor:"var(--gold-dim)"}} title="Commissioner verified handicap"/>
              <select value={p.flight} onChange={e=>updateField(p.id,"flight",e.target.value)} style={{width:"100%"}}>
                {SKILL_LEVELS.map(f=><option key={f}>{f}</option>)}
              </select>
              <button className="btn-danger" onClick={()=>removePlayerDb(p.id)}>✕ Remove</button>
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
                        onClick={async()=>{ await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"scorecard_uploads",p.id),{...scorecardUploads[p.id],verified:false}); notify("Verification removed."); }}>
                        UNVERIFY
                      </button>
                    </div>
                  ) : (
                    <button className="btn-gold" style={{fontSize:11,padding:"5px 14px"}}
                      onClick={async()=>{ await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"scorecard_uploads",p.id),{...scorecardUploads[p.id],verified:true,verifiedAt:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}); notify(`${p.name} verified! ✓`); }}>
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
    await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "ctp_bets", ctpKey), updated);
    notify("Distance submitted! Good luck 🎯");
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
const LeaderboardTable = ({ players, pars, scorecardUploads, calcNet, calcGrossToPar, holesPlayed, toPM, setSelectedPid, setScreen }) => (
  <div style={{marginBottom:32}}>
    <div className="card" style={{overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"52px 1fr 70px 80px 80px 60px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
        <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>THRU</span><span style={{textAlign:"center"}}>GROSS</span><span style={{textAlign:"center"}}>NET</span><span style={{textAlign:"center"}}>HCP</span>
      </div>
      {players.map((player,idx)=>{
        const net=calcNet(player,pars), gross=calcGrossToPar(player,pars), thru=holesPlayed(player);
        const lead=idx===0&&net!==null;
        return (
          <div key={player.id} className="player-row"
            style={{display:"grid",gridTemplateColumns:"52px 1fr 70px 80px 80px 60px",padding:"13px 16px",alignItems:"center",
              borderLeft:lead?"3px solid var(--gold)":"3px solid transparent"}}
            onClick={()=>{ setSelectedPid(player.id); setScreen("scorecard"); }}>
            <span style={{fontFamily:"'Bebas Neue'",fontSize:20,color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
              {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
            </span>
            <div>
              <div style={{fontSize:17,color:lead?"var(--text)":"var(--text2)",fontWeight:600,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {player.name}
                {holesPlayed(player)>0 && !scorecardUploads[player.id]?.url && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--amber)",border:"1px solid var(--amber)",borderRadius:2,padding:"1px 4px"}}>UNVERIFIED</span>}
                {scorecardUploads[player.id]?.url && !scorecardUploads[player.id]?.verified && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--gold)",border:"1px solid var(--gold-dim)",borderRadius:2,padding:"1px 4px"}}>PENDING ⏳</span>}
                {scorecardUploads[player.id]?.verified && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--green)",border:"1px solid var(--green-dim)",borderRadius:2,padding:"1px 4px"}}>✓ VERIFIED</span>}
              </div>
              <div style={{fontSize:11,color:"var(--text3)",letterSpacing:1}}></div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:15,color:thru===18?"var(--green)":"var(--text)"}}>{thru===18?"F":thru||"—"}</div>
              <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1}}>{thru===18?"FINAL":thru>0?"THRU":"—"}</div>
            </div>
            <div style={{textAlign:"center",fontSize:17,color:gross>0?"var(--amber)":gross<0?"var(--gold)":"var(--text)"}}>{toPM(gross)}</div>
            <div style={{textAlign:"center",fontSize:22,fontWeight:700,color:net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"}}>{toPM(net)}</div>
            <div style={{textAlign:"center",fontSize:13,color:"var(--text3)"}}>{player.handicap}</div>
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

export default function App() {
  // ── Firebase state ──
  const [players, setPlayers]   = useState([]);
  const [course, setCourse]     = useState(null);
  const [scorecardUploads, setScorecardUploads] = useState({});
  const [ctpBets, setCtpBets] = useState({});      // { holeIndex: { entries: {playerId: {feet,inches,lockedIn}}, active } }
  const [moreOpen, setMoreOpen] = useState(false); // { playerId: { url, verified, uploadedAt } }
  const [loading, setLoading]   = useState(true);
  const [syncStatus, setSyncStatus] = useState("synced"); // synced | syncing | error

  // ── UI state ──
  const [screen, setScreen]           = useState("leaderboard");
  const [selectedPid, setSelectedPid] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [activeHole, setActiveHole]   = useState(0);
  const [regForm, setRegForm]         = useState({ code:"", name:"", handicap:"", flight:"Scratch (0-5)", pin:"", pin2:"" });
  const [regError, setRegError]       = useState("");
  const [regSuccess, setRegSuccess]   = useState(false);
  const [showScModal, setShowScModal] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pinInput, setPinInput]       = useState("");
  const [pinError, setPinError]       = useState(false);
  const [notif, setNotif]             = useState(null);
  const [pinAttempts, setPinAttempts] = useState({});
  const [scorePin, setScorePin]       = useState("");
  const [scorePinError, setScorePinError] = useState("");
  const [pendingPlayer, setPendingPlayer] = useState(null);
  const fileRef = useRef();

  // ── Firestore listeners ──
  useEffect(() => {
    // Listen to players collection
    const unsub1 = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "players"),
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPlayers(data);
        setLoading(false);
      },
      err => { console.error(err); setSyncStatus("error"); setLoading(false); }
    );

    // Listen to course document
    const unsub2 = onSnapshot(
      doc(db, "tournaments", TOURNAMENT_ID, "settings", "course"),
      snap => {
        if (snap.exists()) {
          const data = snap.data();
          // Defensive: ensure par and yards are valid arrays (bad write protection)
          if (!Array.isArray(data.par) || data.par.length !== 18) data.par = DEFAULT_PAR;
          if (!Array.isArray(data.yards) || data.yards.length !== 18) data.yards = DEFAULT_YARDS;
          setCourse(data);
        } else {
          // First run — seed default course
          const defaultCourse = {
            name:"Keller Golf Course", city:"Maplewood, MN", slope:128, rating:70.4,
            par: DEFAULT_PAR, yards: DEFAULT_YARDS,
            description:"A classic Minnesota municipal course winding through mature oaks and wetlands. Tight fairways reward accuracy over distance.",
            scorecardImage: null, scorecardPdf: null,
          };
          setDoc(doc(db, "tournaments", TOURNAMENT_ID, "settings", "course"), defaultCourse);
          setCourse(defaultCourse);
        }
        setLoading(false);
      }
    );

    // Listen to scorecard uploads
    const unsub3 = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "scorecard_uploads"),
      snap => {
        const d = {};
        snap.docs.forEach(doc => { d[doc.id] = doc.data(); });
        setScorecardUploads(d);
      }
    );

    // Listen to CTP bets
    const unsub4 = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "ctp_bets"),
      snap => {
        const d = {};
        snap.docs.forEach(doc => { d[doc.id] = doc.data(); });
        setCtpBets(d);
      }
    );

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  const notify = (msg, type="success") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3500);
  };

  const pars  = (Array.isArray(course?.par)   && course.par.length===18)  ? course.par   : DEFAULT_PAR;
  const par3Holes = pars.map((p,i) => p===3 ? i : -1).filter(i => i !== -1);

  // Auto-initialize CTP bets for all par 3s if not already active
  const initCtpBets = async () => {
    for (const holeIdx of par3Holes) {
      const key = \`hole_\${holeIdx}\`;
      if (!ctpBets[key]) {
        await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "ctp_bets", key), {
          holeIndex: holeIdx, active: true, entries: {}
        });
      }
    }
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
    const base = players; // unified leaderboard — no flight filtering
    return [...base].sort((a,b)=>{
      const an=calcNet(a,pars), bn=calcNet(b,pars);
      if(an===null&&bn===null)return 0;
      if(an===null)return 1; if(bn===null)return -1;
      return an!==bn ? an-bn : holesPlayed(b)-holesPlayed(a);
    });
  };

  const updateScore = async (pid, hole, val) => {
    const player = players.find(p=>p.id===pid);
    if (!player) return;
    const scores = [...player.scores];
    scores[hole] = val === "" ? null : Math.max(1, parseInt(val)||1);
    const updated = { ...player, scores };
    // Optimistic local update
    setPlayers(prev => prev.map(p => p.id===pid ? updated : p));
    if (activePlayer?.id === pid) setActivePlayer(updated);
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
    if (regForm.code.toUpperCase() !== JOIN_CODE) { setRegError("Invalid join code."); return; }
    if (!regForm.name.trim()) { setRegError("Please enter your name."); return; }
    if (players.find(p=>p.name.toLowerCase()===regForm.name.trim().toLowerCase())) { setRegError("Name already registered."); return; }
    if (!regForm.pin || regForm.pin.length !== 4 || !/^\d{4}$/.test(regForm.pin)) { setRegError("Please set a 4-digit PIN."); return; }
    if (regForm.pin !== regForm.pin2) { setRegError("PINs do not match."); return; }
    const id  = `player-${Date.now()}`;
    const pinHash = await hashPin(regForm.pin);
    const np  = { id, name:regForm.name.trim(), handicap:parseInt(regForm.handicap)||0, flight:regForm.flight, scores:Array(18).fill(null), pinHash };
    await savePlayer(np);
    setActivePlayer(np);
    setRegSuccess(true);
    notify(`Welcome, ${np.name}! 🏌️`);
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
      <style>{CSS}</style>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:4,color:"#5a9a5a"}} className="pulse">LOADING TOURNAMENT DATA…</div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // LEADERBOARD
  const Leaderboard = () => (
    <div className="fade-up">
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
      />
      {players.length===0 && (
        <div style={{textAlign:"center",padding:"60px 20px",color:"var(--text3)"}}>
          <div style={{fontSize:36,marginBottom:12}}>⛳</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,marginBottom:8}}>NO PLAYERS YET</div>
          <div style={{fontSize:14}}>Share join code <strong style={{color:"var(--gold)"}}>{JOIN_CODE}</strong> with your group</div>
        </div>
      )}
    </div>
  );

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
            <p style={{fontSize:14,color:"var(--text2)",marginTop:8,lineHeight:1.7}}>Get the join code from your commissioner, then fill in your details.</p>
          </div>
          <div className="card" style={{padding:28}}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="section-label">JOIN CODE</div>
                <input defaultValue={regForm.code} onBlur={e=>setRegForm(f=>({...f,code:e.target.value.toUpperCase()}))} onChange={e=>e.target.value=e.target.value.toUpperCase()} placeholder="e.g. NORTHSTAR24" style={{width:"100%",letterSpacing:3,fontFamily:"'Bebas Neue'",fontSize:18,textAlign:"center"}}/>
              </div>
              <div>
                <div className="section-label">FULL NAME</div>
                <input defaultValue={regForm.name} onBlur={e=>setRegForm(f=>({...f,name:e.target.value}))} placeholder="First Last" style={{width:"100%"}}/>
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
  // MY SCORES LOGIN
  const MyScoresLogin = () => {
    const handlePinSubmit = async () => {
      if (!pendingPlayer) return;
      const attempts = pinAttempts[pendingPlayer.id] || 0;
      if (attempts >= 5) { setScorePinError("Too many attempts. Ask the commissioner to reset your PIN."); return; }
      // Admin override — admin PIN bypasses player PIN
      if (scorePin === ADMIN_PIN) {
        setActivePlayer(pendingPlayer);
        setActiveHole(Math.max(0, holesPlayed(pendingPlayer)-1)||0);
        setScreen("my-scores");
        setScorePin(""); setScorePinError(""); setPendingPlayer(null);
        return;
      }
      const hash = await hashPin(scorePin);
      if (hash === pendingPlayer.pinHash) {
        setActivePlayer(pendingPlayer);
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
              {players.length === 0 && <div style={{padding:32,textAlign:"center",color:"var(--text3)",fontSize:14}}>No players registered yet.<br/>Register first using your join code.</div>}
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
    const player = players.find(p=>p.id===activePlayer.id);
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

        {/* CTP lock-in prompt for par 3s */}
        {par === 3 && (() => {
          const ctpKey = `hole_${activeHole}`;
          const ctpBet = ctpBets[ctpKey];
          const myEntry = ctpBet?.entries?.[player.id];
          const isOptedIn = player.ctpOptIn !== false;
          if (!ctpBet?.active || !isOptedIn) return null;
          if (myEntry?.lockedIn) return (
            <div className="card" style={{padding:16,marginBottom:12,border:"1px solid var(--gold-dim)",background:"#120e00"}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:3,color:"var(--gold)",marginBottom:8}}>📍 CTP — HOLE {activeHole+1} (PAR 3)</div>
              {myEntry.feet !== undefined ? (
                <div style={{fontSize:13,color:"var(--text2)"}}>Your distance: <strong style={{color:"var(--gold)"}}>{myEntry.feet}'{myEntry.inches}"</strong></div>
              ) : (
                <CtpDistanceEntry player={player} holeIdx={activeHole} ctpBet={ctpBet} notify={notify} />
              )}
            </div>
          );
          return (
            <div className="card" style={{padding:16,marginBottom:12,border:"1px solid var(--amber)",background:"#120800"}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:3,color:"var(--amber)",marginBottom:6}}>📍 CTP BET — HOLE {activeHole+1}</div>
              <div style={{fontSize:13,color:"var(--text2)",marginBottom:12}}>Lock in to compete for Closest to the Pin on this par 3. You must confirm before entering your score.</div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-gold" style={{flex:1,fontSize:12}} onClick={async()=>{
                  const ctpKey2 = `hole_${activeHole}`;
                  await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"ctp_bets",ctpKey2),{
                    ...ctpBet, entries:{...ctpBet.entries,[player.id]:{lockedIn:true,lockedAt:new Date().toISOString()}}
                  });
                  notify("Locked in for CTP! Enter your distance after you play.");
                }}>🔒 LOCK IN</button>
                <button className="btn-ghost" style={{flex:1,fontSize:12}} onClick={async()=>{
                  await updateDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",player.id),{ctpOptIn:false});
                  notify("Opted out of CTP bets.");
                }}>OPT OUT</button>
              </div>
            </div>
          );
        })()}

        <div className="card" style={{padding:24,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:42,letterSpacing:1,lineHeight:1}}>HOLE {activeHole+1}</div>
              <div style={{fontSize:12,color:"var(--text3)"}}>Par {par} · {yards[activeHole]}yds · HCP {HCP_STROKES[activeHole]}</div>
            </div>
            <div style={{width:80,height:80,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontFamily:"'Bebas Neue'",background:scBg,border:`2px solid ${scColor}`,color:scColor}}>
              {s??""}
            </div>
          </div>
          {s!==null && <div style={{textAlign:"center",fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:3,color:scColor,marginBottom:16}}>{scoreLabel(s,par)}</div>}

          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
            {Array.from({length:10},(_,i)=>i+1).map(n=>(
              <button key={n} onClick={()=>updateScore(player.id,activeHole,n)}
                style={{padding:"14px 4px",fontFamily:"'DM Mono'",fontSize:18,cursor:"pointer",transition:"all .15s",borderRadius:6,
                  background:s===n?"var(--gold)":n===par?"var(--bg4)":"var(--bg3)",
                  color:s===n?"#060a06":n===par?"var(--green)":"var(--text2)",
                  border:`1px solid ${s===n?"var(--gold)":n===par?"var(--green-dim)":"var(--border2)"}`}}>
                {n}
              </button>
            ))}
            <button onClick={()=>updateScore(player.id,activeHole,"")}
              style={{padding:"14px 4px",fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:1,cursor:"pointer",borderRadius:6,background:"var(--bg3)",color:"var(--red)",border:"1px solid #2a1010"}}>
              CLR
            </button>
          </div>

          <div style={{display:"flex",gap:8}}>
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
    ["my-scores-login","✏️ MY SCORES"],
    ["sidebets","🤝 SIDEBETS"],
    ["season","🌟 STANDINGS"],
    ["register","✍ REGISTER"],
  ];
  const NAV_MORE = [
    ["history","📖 HISTORY"],
    ["rules","📋 RULES"],
    ["scorecard","📋 SCORECARDS"],
    ["course","🗺 COURSE"],
    ["handicap","🏅 HANDICAPS"],
    ["admin","⚙ ADMIN"],
  ];
  const NAV = [...NAV_PRIMARY, ...NAV_MORE];
  const activeNav = screen==="my-scores"?"my-scores-login":screen==="sidebets"?"sidebets":screen;

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      <style>{CSS}</style>
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
              <button className="btn-gold  btn-sm" onClick={()=>setScreen(activePlayer?"my-scores":"my-scores-login")}>✏️ MY SCORES</button>
            </div>
          </div>
          <div style={{display:"flex",marginTop:12,alignItems:"center",gap:0}}>
            {NAV_PRIMARY.map(([val,label])=>(
              <div key={val} className={`nav-pill ${activeNav===val?"active":""}`}
                onClick={()=>{ if(val==="my-scores-login"&&activePlayer)setScreen("my-scores"); else setScreen(val); }}>
                {label}
              </div>
            ))}
            {/* More dropdown */}
            <div style={{position:"relative"}} onMouseLeave={()=>setMoreOpen(false)}>
              <div className={`nav-pill ${NAV_MORE.some(([v])=>v===activeNav)?"active":""}`}
                onClick={()=>setMoreOpen(o=>!o)}
                style={{cursor:"pointer",userSelect:"none"}}>
                {NAV_MORE.some(([v])=>v===activeNav)
                  ? NAV_MORE.find(([v])=>v===activeNav)?.[1]
                  : "⋯ MORE"}
              </div>
              {moreOpen && (
                <div style={{position:"absolute",top:"100%",right:0,background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:4,zIndex:100,minWidth:180,boxShadow:"0 8px 24px rgba(0,0,0,.6)"}}>
                  {NAV_MORE.map(([val,label])=>(
                    <div key={val}
                      style={{padding:"11px 18px",fontSize:12,fontFamily:"'Bebas Neue'",letterSpacing:2,cursor:"pointer",
                        color:activeNav===val?"var(--gold)":"var(--text2)",
                        background:activeNav===val?"var(--bg3)":"transparent",
                        borderBottom:"1px solid var(--border)"}}
                      onClick={()=>{ setScreen(val); setMoreOpen(false); }}>
                      {label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 16px"}}>
        {screen==="leaderboard"     && <Leaderboard/>}
        {screen==="scorecard"       && <ScorecardView/>}
        {screen==="course"          && <CourseView/>}
        {screen==="register"        && <RegisterView/>}
        {screen==="my-scores-login" && <MyScoresLogin/>}
        {screen==="my-scores"       && <MyScores/>}
        {screen==="history" && <TournamentHistory players={players} />}
        {screen==="rules" && <RulesPage adminUnlocked={adminUnlocked} />}
        {screen==="sidebets" && (
          activePlayer
            ? <Sidebets
                myPlayer={players.find(p=>p.id===activePlayer)}
                players={players}
                pars={pars}
                ctpBets={ctpBets}
                onCtpOptToggle={async (val) => {
                  if (!activePlayer) return;
                  await updateDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",activePlayer),{ctpOptIn:val});
                  notify(val?"Opted in to CTP bets ✓":"Opted out of CTP bets");
                }}
              />
            : <SidebetsLogin/>
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
        />}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { TOURNAMENT_ID, DEFAULT_PAR, DEFAULT_YARDS, SKILL_LEVELS } from "../constants";
import PinResetButton from "../components/PinResetButton";
import OneOffCreator from "../components/OneOffCreator";
import CourseSearch from "../components/CourseSearch";

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;

export default function AdminView({ course, players, adminUnlocked, setAdminUnlocked, pinInput, setPinInput,
  pinError, setPinError, savePlayer, removePlayerDb, saveCourse, setCourse, updateField, notify,
  scorecardUploads, courseLibrary, saveCourseToLibrary, pars }) {
  const [localCourse, setLocalCourse] = useState(course || {});
  const [saving, setSaving] = useState(false);
  const [courseKey, setCourseKey] = useState(0);

  const nameRef    = React.useRef(null);
  const cityRef    = React.useRef(null);
  const slopeRef   = React.useRef(null);
  const ratingRef  = React.useRef(null);
  const descRef    = React.useRef(null);
  const parRefs    = React.useRef(Array.from({length:18}, () => React.createRef()));
  const yardsRefs  = React.useRef(Array.from({length:18}, () => React.createRef()));

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
    const par   = parRefs.current.map((ref, i) => parseInt(ref.current?.value)   || DEFAULT_PAR[i]);
    const yards = yardsRefs.current.map((ref, i) => parseInt(ref.current?.value) || DEFAULT_YARDS[i]);
    const updated = {
      ...localCourse,
      name:        nameRef.current?.value   || localCourse.name,
      city:        cityRef.current?.value   || localCourse.city,
      slope:       parseInt(slopeRef.current?.value)    || localCourse.slope,
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
      {/* Course settings */}
      <div className="section-label">── COURSE SETTINGS</div>
      <div className="card" style={{padding:20,marginBottom:24}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
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
        {players.map(p => {
          return (
            <React.Fragment key={p.id}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 80px 150px auto auto",padding:"10px 16px",borderBottom:"1px solid var(--border)",alignItems:"center",gap:8}}>
                <input defaultValue={p.name} key={p.id+"-name"} onBlur={e=>updateField(p.id,"name",e.target.value)} style={{width:"100%",padding:"5px 8px"}}/>
                <input type="number" defaultValue={p.handicap} key={p.id+"-hcp"} onBlur={e=>updateField(p.id,"handicap",e.target.value)} min="0" max="54" style={{width:65,borderColor:"var(--gold-dim)"}} title="Commissioner verified handicap"/>
                <select value={p.flight} onChange={e=>updateField(p.id,"flight",e.target.value)} style={{width:"100%"}}>
                  {SKILL_LEVELS.map(f=><option key={f}>{f}</option>)}
                </select>
                <PinResetButton player={p} notify={notify}/>
                <button className="btn-danger" onClick={()=>removePlayerDb(p.id)}>✕</button>
              </div>
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
            </React.Fragment>
          );
        })}
        {players.length===0 && <div style={{padding:24,textAlign:"center",color:"var(--text3)",fontSize:13}}>No players yet. They'll appear here once they register.</div>}
      </div>
      <button className="btn-gold" style={{fontSize:13}} onClick={async()=>{
        const np={id:`player-${Date.now()}`,name:"New Player",handicap:0,flight:"Mid (13-20)",scores:Array(18).fill(null)};
        await savePlayer(np);
        notify("Player added.");
      }}>+ ADD PLAYER</button>

      {/* Email Export */}
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

      {/* One-Off Tournament Creator */}
      <div style={{marginTop:32}}>
        <div className="section-label">── ONE-OFF TOURNAMENTS</div>
        <OneOffCreator players={players} notify={notify} courseLibrary={courseLibrary} pars={pars} />
      </div>
    </div>
  );
}

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
    <div className="fade-up max-w-xs mx-auto text-center">
      <div className="font-display text-[12px] tracking-[4px] text-green mb-2.5">COMMISSIONER ACCESS</div>
      <h2 className="font-display text-[28px] mb-6">ADMIN LOGIN</h2>
      <div className="card p-7">
        <div className="section-label text-left">PIN</div>
        <input type="password" value={pinInput} onChange={e=>setPinInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"){ if(pinInput===ADMIN_PIN)setAdminUnlocked(true); else setPinError(true); }}}
          placeholder="••••" className="w-full text-center mb-2.5" style={{fontSize:24,letterSpacing:8}}/>
        {pinError && <div className="text-red text-[13px] mb-2.5">Incorrect PIN.</div>}
        <button className="btn-gold w-full"
          onClick={()=>{ if(pinInput===ADMIN_PIN){setAdminUnlocked(true);setPinError(false);}else setPinError(true); }}>
          UNLOCK
        </button>
        <div className="text-[11px] text-t3 mt-3">Default PIN: 1234</div>
      </div>
    </div>
  );

  return (
    <div className="fade-up">
      {/* Course settings */}
      <div className="section-label">── COURSE SETTINGS</div>
      <div className="card p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="md:col-span-2">
            <div className="font-display text-[10px] tracking-[1px] text-t3 mb-1">SEARCH MINNESOTA COURSES</div>
            <CourseSearch onSelect={c=>{
              setLocalCourse(prev=>({...prev,name:c.name,city:c.city,slope:c.slope,rating:c.rating,
                par:DEFAULT_PAR,
                yards:Array(18).fill(""),
              }));
              setCourseKey(k=>k+1);
            }}/>
          </div>

          {courseLibrary.length > 0 && (
            <div className="md:col-span-2">
              <div className="font-display text-[10px] tracking-[1px] text-t3 mb-1.5">── OR LOAD FROM YOUR LIBRARY ({courseLibrary.length} saved)</div>
              <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto bg-bg border border-border rounded-[6px] p-2">
                {courseLibrary.map(c => (
                  <div key={c.id}
                    onClick={()=>{ setLocalCourse(c); setCourseKey(k=>k+1); notify(`Loaded "${c.name}" from library`); }}
                    className="flex justify-between items-center px-3 py-2.5 rounded-[4px] cursor-pointer bg-bg2 border border-border transition-colors duration-150 hover:border-gold min-h-[48px]">
                    <div>
                      <div className="text-[14px] text-text font-semibold">{c.name}</div>
                      <div className="text-[11px] text-t3">{c.city}</div>
                    </div>
                    <div className="text-right text-[11px] text-t3">
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
              <div className="font-display text-[10px] tracking-[1px] text-t3 mb-1">{lbl.toUpperCase()}</div>
              <input ref={ref} defaultValue={localCourse[key]??""} type={key==="slope"||key==="rating"?"number":"text"}
                step={key==="rating"?".1":undefined}
                className="w-full"/>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <div className="font-display text-[10px] tracking-[1px] text-t3 mb-2">PAR PER HOLE (1–18)</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({length:18},(_,i)=>(
              <div key={i} className="text-center">
                <div className="font-display text-[9px] text-t3 mb-0.5">{i+1}</div>
                <input ref={parRefs.current[i]} type="number" min="3" max="6"
                  defaultValue={(localCourse.par||DEFAULT_PAR)[i]}
                  style={{width:40,textAlign:"center",padding:"4px 2px"}}/>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="font-display text-[10px] tracking-[1px] text-t3 mb-2">YARDAGE PER HOLE (1–18)</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({length:18},(_,i)=>(
              <div key={i} className="text-center">
                <div className="font-display text-[9px] text-t3 mb-0.5">{i+1}</div>
                <input ref={yardsRefs.current[i]} type="number" min="100" max="700"
                  defaultValue={(localCourse.yards||DEFAULT_YARDS)[i]}
                  style={{width:52,textAlign:"center",padding:"4px 2px"}}/>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="font-display text-[10px] tracking-[1px] text-t3 mb-1">DESCRIPTION</div>
          <textarea ref={descRef} defaultValue={localCourse.description??""} rows={3} className="w-full" style={{resize:"vertical"}}/>
        </div>

        <div className="flex gap-2.5 flex-wrap">
          <button className="btn-gold text-[13px] flex-1" onClick={saveAll} disabled={saving}>
            {saving?"SAVING…":"SAVE AS ACTIVE COURSE"}
          </button>
          <button className="btn-ghost text-[13px] flex-1" onClick={saveToLib}>
            📚 SAVE TO LIBRARY
          </button>
        </div>
      </div>

      {/* Players */}
      <div className="section-label">── PLAYER ROSTER ({players.length} players)</div>
      <div className="card overflow-hidden mb-3 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: 560 }}>
          <div
            className="grid bg-bg3 px-4 py-2.5 font-display text-[10px] tracking-[2px] text-t3"
            style={{ gridTemplateColumns: "1fr 80px 150px auto auto" }}
          >
            <span>NAME</span><span>HCP</span><span>SKILL LEVEL</span><span>PIN</span><span></span>
          </div>
          {players.map(p => (
            <React.Fragment key={p.id}>
              <div
                className="grid px-4 py-2.5 border-b border-border items-center gap-2"
                style={{ gridTemplateColumns: "1fr 80px 150px auto auto" }}
              >
                <input defaultValue={p.name} key={p.id+"-name"} onBlur={e=>updateField(p.id,"name",e.target.value)} className="w-full" style={{padding:"5px 8px"}}/>
                <input type="number" defaultValue={p.handicap} key={p.id+"-hcp"} onBlur={e=>updateField(p.id,"handicap",e.target.value)} min="0" max="54" style={{width:65,borderColor:"var(--gold-dim)"}} title="Commissioner verified handicap"/>
                <select value={p.flight} onChange={e=>updateField(p.id,"flight",e.target.value)} className="w-full">
                  {SKILL_LEVELS.map(f=><option key={f}>{f}</option>)}
                </select>
                <PinResetButton player={p} notify={notify}/>
                <button className="btn-danger" onClick={()=>removePlayerDb(p.id)}>✕</button>
              </div>
              {!scorecardUploads?.[p.id]?.url && (
                <div className="px-3 pb-2.5 pt-1.5 text-[11px] text-t3 italic border-t border-border">
                  No scorecard uploaded yet.
                </div>
              )}
              {scorecardUploads?.[p.id]?.url && (
                <div className="px-3 py-2.5 border-t border-border flex gap-3 items-start flex-wrap bg-bg3">
                  <img src={scorecardUploads[p.id].url} alt="Scorecard"
                    className="rounded-[3px] border border-border2 cursor-pointer object-cover"
                    style={{width:100,height:70}}
                    onClick={()=>window.open(scorecardUploads[p.id].url,"_blank")}/>
                  <div className="flex-1">
                    <div className="text-[11px] text-t3 mb-1.5">📸 Uploaded: {scorecardUploads[p.id].uploadedAt}</div>
                    {scorecardUploads[p.id].verified ? (
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[11px] tracking-[1px] text-green">✓ VERIFIED · {scorecardUploads[p.id].verifiedAt}</span>
                        <button className="btn-ghost text-[10px] px-2 py-[2px]" style={{color:"var(--amber)",borderColor:"var(--amber)"}}
                          onClick={async()=>{ try { await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"scorecard_uploads",p.id),{...scorecardUploads[p.id],verified:false}); notify("Verification removed."); } catch(e) { console.error(e); notify("Failed — check connection.","error"); } }}>
                          UNVERIFY
                        </button>
                      </div>
                    ) : (
                      <button className="btn-gold text-[11px] py-1.5 px-3.5"
                        onClick={async()=>{ try { await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"scorecard_uploads",p.id),{...scorecardUploads[p.id],verified:true,verifiedAt:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}); notify(`${p.name} verified! ✓`); } catch(e) { console.error(e); notify("Failed — check connection.","error"); } }}>
                        ✓ MARK AS VERIFIED
                      </button>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
          {players.length===0 && (
            <div className="p-6 text-center text-t3 text-[13px]">No players yet. They'll appear here once they register.</div>
          )}
        </div>
      </div>
      <button className="btn-gold text-[13px]" onClick={async()=>{
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
          <div className="card p-5 mt-4">
            <div className="section-label mb-2.5">── EMAIL LIST ({withEmail.length} of {players.length} players)</div>
            {withEmail.length > 0 ? (
              <>
                <div className="bg-bg3 border border-border rounded-[4px] px-3.5 py-3 text-[12px] font-mono text-t2 leading-relaxed break-all mb-3 max-h-[120px] overflow-y-auto">
                  {allEmails}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-gold text-[12px]" onClick={()=>{ navigator.clipboard.writeText(allEmails); notify("Emails copied to clipboard! ✓"); }}>
                    📋 COPY ALL EMAILS
                  </button>
                  <button className="btn-ghost text-[12px]" onClick={()=>{ window.open(`mailto:?bcc=${encodeURIComponent(allEmails)}`,"_blank"); }}>
                    ✉️ OPEN IN MAIL APP
                  </button>
                </div>
                {noEmail.length > 0 && (
                  <div className="text-[11px] text-amber mt-2.5">
                    ⚠ {noEmail.length} player{noEmail.length>1?"s":""} without email: {noEmail.map(p=>p.name).join(", ")}
                  </div>
                )}
              </>
            ) : (
              <div className="text-[13px] text-t3 italic">No player emails on file yet.</div>
            )}
          </div>
        );
      })()}

      {/* One-Off Tournament Creator */}
      <div className="mt-8">
        <div className="section-label">── ONE-OFF TOURNAMENTS</div>
        <OneOffCreator players={players} notify={notify} courseLibrary={courseLibrary} pars={pars} />
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { searchCourses } from "./mnCourses";
import { db } from "./firebase";
import { doc, collection, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

const TOURNAMENT_ID = "tournament-2024";
const MAX_HANDICAP = 28;
const WHS_BEST_OF = 8;
const WHS_POOL = 20;
const WHS_MULTIPLIER = 0.96;

// ── WHS Differential = (Gross - Course Rating) × 113 / Slope
const calcDifferential = (gross, courseRating, slope) =>
  Math.round(((gross - courseRating) * 113 / slope) * 10) / 10;

// ── WHS Handicap Index from array of differentials (best 8 of last 20)
const calcHandicapIndex = (differentials) => {
  if (!differentials || differentials.length === 0) return null;
  const pool = [...differentials].slice(-WHS_POOL); // last 20
  const sorted = [...pool].sort((a, b) => a - b);
  const best = sorted.slice(0, Math.min(WHS_BEST_OF, sorted.length));
  const avg = best.reduce((a, b) => a + b, 0) / best.length;
  const idx = Math.round(avg * WHS_MULTIPLIER * 10) / 10;
  return Math.min(idx, MAX_HANDICAP);
};

// How many differentials needed before league takes over from self-reported
const LEAGUE_TAKEOVER_ROUNDS = 3;

const CSS = `
.hcp-wrap { font-family:'Cormorant Garamond',Georgia,serif; }
.hcp-fade { animation:hcpFade .4s ease; }
@keyframes hcpFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.hcp-card { background:var(--bg2); border:1px solid var(--border); border-radius:6px; }
.hcp-label { font-family:'Bebas Neue'; letter-spacing:3px; font-size:11px; color:var(--green); margin-bottom:10px; }
.hcp-row { border-bottom:1px solid var(--border); transition:background .15s; }
.hcp-row:hover { background:var(--bg3); }
.hcp-badge { font-family:'Bebas Neue'; font-size:32px; line-height:1; }
.hcp-source { font-family:'Bebas Neue'; font-size:9px; letter-spacing:2px; padding:2px 6px; border-radius:2px; }
.hcp-source-self { background:#1a1400; color:var(--amber); border:1px solid #4a3a00; }
.hcp-source-league { background:#0a1800; color:var(--green); border:1px solid #2a4a10; }
.hcp-source-pending { background:var(--bg3); color:var(--text3); border:1px solid var(--border2); }
.diff-bar { height:4px; border-radius:2px; background:var(--bg3); overflow:hidden; margin-top:3px; }
.diff-bar-fill { height:100%; border-radius:2px; transition:width .4s; }
.trend-up { color:var(--red); font-size:11px; font-family:'DM Mono'; }
.trend-dn { color:var(--green-bright); font-size:11px; font-family:'DM Mono'; }
.trend-eq { color:var(--text3); font-size:11px; font-family:'DM Mono'; }
.history-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.spark-bar { display:flex; align-items:flex-end; gap:2px; height:32px; }
.spark-seg { border-radius:2px 2px 0 0; min-width:8px; transition:all .3s; }
`;


// ── Inline course search for handicap round entry
function HcpCourseSearch({ onSelect }) {
  const [q, setQ] = React.useState("");
  const [res, setRes] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (q.length >= 2) { setRes(searchCourses(q)); setOpen(true); }
    else { setRes([]); setOpen(false); }
  }, [q]);
  const pick = (c) => { onSelect(c); setQ(c.name); setOpen(false); };
  return (
    <div style={{position:"relative"}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Type course name or city…"
        style={{width:"100%",padding:"6px 8px",fontSize:13}} onFocus={()=>res.length>0&&setOpen(true)}/>
      {open && res.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:100,background:"var(--bg2)",border:"1px solid var(--gold)",borderRadius:"0 0 4px 4px",maxHeight:220,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.6)"}}>
          {res.map((c,i)=>(
            <div key={i} onClick={()=>pick(c)} style={{padding:"9px 12px",cursor:"pointer",borderBottom:"1px solid var(--border)"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{c.name}</div>
              <div style={{fontSize:11,color:"var(--text3)",display:"flex",gap:12,marginTop:1}}>
                <span>{c.city}, MN</span><span>Par {c.par}</span><span>Rating {c.rating}</span><span>Slope {c.slope}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HandicapTracker({ players, adminUnlocked, onHandicapUpdate }) {
  const [hcpData, setHcpData]       = useState({});
  const [loading, setLoading]       = useState(true);
  const [selectedPid, setSelectedPid] = useState(null);
  const [editingPid, setEditingPid] = useState(null);
  const [manualHcp, setManualHcp]   = useState("");
  const [addingRound, setAddingRound] = useState(null);
  const [roundForm, setRoundForm]   = useState({ gross:"", courseRating:"70.4", slope:"128", date:"", course:"" });
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "handicaps"),
      snap => {
        const d = {};
        snap.docs.forEach(doc => { d[doc.id] = doc.data(); });
        setHcpData(d);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── Get effective handicap for a player
  const getEffectiveHcp = (player) => {
    const data = hcpData[player.id];
    if (!data) return { index: player.handicap, source: "self", rounds: 0 };
    const diffs = data.differentials || [];
    if (diffs.length >= LEAGUE_TAKEOVER_ROUNDS) {
      const idx = calcHandicapIndex(diffs);
      return { index: idx, source: "league", rounds: diffs.length };
    }
    if (diffs.length > 0) {
      const idx = calcHandicapIndex(diffs);
      return { index: idx, source: "mixed", rounds: diffs.length };
    }
    return { index: data.selfReported ?? player.handicap, source: "self", rounds: 0 };
  };

  const getTrend = (player) => {
    const data = hcpData[player.id];
    if (!data?.differentials || data.differentials.length < 2) return null;
    const diffs = data.differentials;
    const recent = calcHandicapIndex(diffs);
    const prev = calcHandicapIndex(diffs.slice(0, -1));
    if (recent === null || prev === null) return null;
    const delta = Math.round((recent - prev) * 10) / 10;
    return delta;
  };

  const saveRound = async (playerId) => {
    if (!roundForm.gross) return;
    setSaving(true);
    const gross = parseInt(roundForm.gross);
    const rating = parseFloat(roundForm.courseRating) || 70.4;
    const slope  = parseInt(roundForm.slope) || 128;
    const diff   = calcDifferential(gross, rating, slope);
    const existing = hcpData[playerId] || {};
    const diffs = [...(existing.differentials || []), diff];
    const rounds = [...(existing.rounds || []), {
      gross, diff, courseRating: rating, slope,
      date: roundForm.date || new Date().toLocaleDateString(),
      course: roundForm.course || "League Event",
      addedAt: Date.now(),
    }];
    const newIdx = calcHandicapIndex(diffs);
    const updated = { ...existing, differentials: diffs, rounds, currentIndex: newIdx, selfReported: existing.selfReported ?? (hcpData[playerId]?.selfReported ?? null) };
    await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "handicaps", playerId), updated);
    // Also update player's handicap in players collection
    if (onHandicapUpdate && newIdx !== null) onHandicapUpdate(playerId, Math.round(newIdx));
    setSaving(false);
    setAddingRound(null);
    setRoundForm({ gross:"", courseRating:"70.4", slope:"128", date:"", course:"" });
  };

  const setSelfReported = async (playerId, hcp) => {
    const existing = hcpData[playerId] || {};
    const val = Math.min(parseFloat(hcp)||0, MAX_HANDICAP);
    await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "handicaps", playerId), { ...existing, selfReported: val });
    if (onHandicapUpdate) onHandicapUpdate(playerId, Math.round(val));
    setSaving(false); setEditingPid(null); setManualHcp("");
  };

  const removeLastRound = async (playerId) => {
    const data = hcpData[playerId];
    if (!data?.differentials?.length) return;
    const diffs = data.differentials.slice(0, -1);
    const rounds = (data.rounds || []).slice(0, -1);
    const newIdx = calcHandicapIndex(diffs);
    await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "handicaps", playerId), { ...data, differentials: diffs, rounds, currentIndex: newIdx });
    if (onHandicapUpdate && newIdx !== null) onHandicapUpdate(playerId, Math.round(newIdx));
  };

  const sortedPlayers = [...players].sort((a,b) => {
    const ah = getEffectiveHcp(a).index ?? 99;
    const bh = getEffectiveHcp(b).index ?? 99;
    return ah - bh;
  });

  const selectedPlayer = players.find(p => p.id === selectedPid);

  if (loading) return <div style={{textAlign:"center",padding:60,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>LOADING HANDICAPS…</div>;

  return (
    <div className="hcp-wrap hcp-fade">
      <style>{CSS}</style>

      {/* Header summary */}
      <div className="hcp-label">── LEAGUE HANDICAP INDEX · WHS METHOD · MAX {MAX_HANDICAP}</div>
      <div style={{fontSize:13,color:"var(--text2)",marginBottom:20,lineHeight:1.7,fontStyle:"italic",borderLeft:"2px solid var(--gold-dim)",paddingLeft:14}}>
        Handicap differentials are calculated as <strong>(Gross − Course Rating) × 113 ÷ Slope</strong>. 
        Index = best {WHS_BEST_OF} of last {WHS_POOL} differentials × {WHS_MULTIPLIER}. 
        Self-reported until {LEAGUE_TAKEOVER_ROUNDS} league rounds are posted.
      </div>

      {/* Handicap roster */}
      <div className="hcp-card" style={{overflow:"hidden",marginBottom:24}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 90px 90px 100px 80px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
          <span>PLAYER</span>
          <span style={{textAlign:"center"}}>HCP INDEX</span>
          <span style={{textAlign:"center"}}>ROUNDS</span>
          <span style={{textAlign:"center"}}>SOURCE</span>
          <span style={{textAlign:"center"}}>TREND</span>
        </div>
        {sortedPlayers.map(player => {
          const eff = getEffectiveHcp(player);
          const trend = getTrend(player);
          const data = hcpData[player.id] || {};
          const isSelected = selectedPid === player.id;
          return (
            <div key={player.id}>
              <div className="hcp-row" style={{display:"grid",gridTemplateColumns:"1fr 90px 90px 100px 80px",padding:"12px 16px",alignItems:"center",cursor:"pointer",borderLeft:isSelected?"3px solid var(--gold)":"3px solid transparent"}}
                onClick={()=>setSelectedPid(isSelected?null:player.id)}>
                <div>
                  <div style={{fontSize:16,fontWeight:600,color:"var(--text2)"}}>{player.name}</div>
                  <div style={{fontSize:11,color:"var(--text3)",letterSpacing:1}}>{player.flight}</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div className="hcp-badge" style={{color:eff.source==="league"?"var(--green-bright)":eff.source==="mixed"?"var(--amber)":"var(--text2)"}}>
                    {eff.index !== null ? eff.index : "—"}
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:20,color:"var(--text2)"}}>{eff.rounds}</div>
                  <div style={{fontSize:9,color:"var(--text3)",letterSpacing:1}}>/ {WHS_POOL} MAX</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <span className={`hcp-source hcp-source-${eff.source==="league"?"league":eff.source==="mixed"?"pending":"self"}`}>
                    {eff.source==="league"?"LEAGUE":eff.source==="mixed"?"MIXED":"SELF-RPT"}
                  </span>
                </div>
                <div style={{textAlign:"center"}}>
                  {trend !== null ? (
                    <span className={trend > 0 ? "trend-up" : trend < 0 ? "trend-dn" : "trend-eq"}>
                      {trend > 0 ? `▲ +${trend}` : trend < 0 ? `▼ ${trend}` : "► 0.0"}
                    </span>
                  ) : <span style={{color:"var(--text3)",fontSize:11}}>—</span>}
                </div>
              </div>

              {/* Expanded detail */}
              {isSelected && (
                <div style={{background:"var(--bg3)",padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:16}}>
                    {/* Stats */}
                    <div style={{display:"flex",gap:24}}>
                      {[
                        ["CURRENT INDEX", eff.index ?? "—", eff.source==="league"?"var(--green-bright)":"var(--text)"],
                        ["ROUNDS POSTED", eff.rounds, "var(--text)"],
                        ["LOWEST DIFF", data.differentials?.length ? Math.min(...data.differentials) : "—", "var(--gold)"],
                        ["AVG DIFF", data.differentials?.length ? Math.round(data.differentials.reduce((a,b)=>a+b,0)/data.differentials.length*10)/10 : "—", "var(--text2)"],
                      ].map(([lbl,val,col])=>(
                        <div key={lbl} style={{textAlign:"center"}}>
                          <div style={{fontFamily:"'Bebas Neue'",fontSize:22,color:col}}>{val}</div>
                          <div style={{fontSize:9,color:"var(--text3)",letterSpacing:1,fontFamily:"'Bebas Neue'"}}>{lbl}</div>
                        </div>
                      ))}
                    </div>

                    {/* Sparkline */}
                    {data.differentials?.length > 0 && (
                      <div>
                        <div style={{fontSize:9,color:"var(--text3)",letterSpacing:2,fontFamily:"'Bebas Neue'",marginBottom:4}}>DIFFERENTIAL HISTORY</div>
                        <div className="spark-bar">
                          {data.differentials.slice(-10).map((d,i,arr)=>{
                            const max = Math.max(...arr);
                            const min = Math.min(...arr);
                            const range = max-min || 1;
                            const h = Math.max(4, Math.round(((d-min)/range)*28)+4);
                            const isBest = d===Math.min(...arr);
                            return <div key={i} className="spark-seg" style={{height:h,background:isBest?"var(--gold)":d<15?"var(--green)":d<25?"var(--amber)":"var(--red)",opacity:i===arr.length-1?1:0.6}}/>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Round history */}
                  {data.rounds?.length > 0 && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:9,color:"var(--text3)",letterSpacing:2,fontFamily:"'Bebas Neue'",marginBottom:6}}>ROUND HISTORY</div>
                      <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:160,overflowY:"auto"}}>
                        {[...data.rounds].reverse().map((r,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 10px",background:"var(--bg2)",borderRadius:3,fontSize:12}}>
                            <span style={{color:"var(--text3)"}}>{r.date}</span>
                            <span style={{color:"var(--text2)"}}>{r.course}</span>
                            <span style={{fontFamily:"'DM Mono'",color:"var(--text2)"}}>Gross {r.gross}</span>
                            <span style={{fontFamily:"'DM Mono'",color:r.diff<15?"var(--green-bright)":r.diff<25?"var(--amber)":"var(--red)",fontWeight:700}}>Diff {r.diff}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {adminUnlocked && (
                      <button className="btn-gold" style={{fontSize:12}} onClick={()=>setAddingRound(player.id)}>+ ADD ROUND</button>
                    )}
                    {adminUnlocked && (
                      <>
                        <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{ setEditingPid(player.id); setManualHcp(eff.index??""); }}>EDIT SELF-REPORTED</button>
                        {data.rounds?.length > 0 && (
                          <button className="btn-danger" style={{fontSize:11}} onClick={()=>removeLastRound(player.id)}>REMOVE LAST ROUND</button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Add round form */}
                  {addingRound === player.id && (
                    <div style={{marginTop:14,padding:"16px",background:"var(--bg2)",borderRadius:4,border:"1px solid var(--border2)"}}>
                      <div style={{fontSize:11,color:"var(--gold)",letterSpacing:2,fontFamily:"'Bebas Neue'",marginBottom:12}}>ADD ROUND — {player.name.toUpperCase()}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:12}}>
                        {[
                          ["GROSS SCORE","gross","number","e.g. 88"],
                          ["COURSE RATING","courseRating","number","e.g. 70.4"],
                          ["SLOPE","slope","number","e.g. 128"],
                          ["DATE","date","text","e.g. May 30"],
                          ["COURSE","course","text","e.g. Rum River"],
                        ].map(([lbl,key,type,ph])=>(
                          <div key={key}>
                            <div style={{fontSize:9,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>{lbl}</div>
                            <input type={type} defaultValue={roundForm[key]} onBlur={e=>setRoundForm(f=>({...f,[key]:e.target.value}))}
                              placeholder={ph} style={{width:"100%",padding:"6px 8px",fontSize:13}}/>
                          </div>
                        ))}
                      </div>
                      {roundForm.gross && (
                        <div style={{fontSize:13,color:"var(--text2)",marginBottom:10,fontStyle:"italic"}}>
                          Differential: <strong style={{color:"var(--gold)"}}>{calcDifferential(parseInt(roundForm.gross),parseFloat(roundForm.courseRating)||70.4,parseInt(roundForm.slope)||128)}</strong>
                          {" "}→ New index est: <strong style={{color:"var(--green-bright)"}}>
                            {calcHandicapIndex([...(hcpData[player.id]?.differentials||[]),calcDifferential(parseInt(roundForm.gross),parseFloat(roundForm.courseRating)||70.4,parseInt(roundForm.slope)||128)])}
                          </strong>
                        </div>
                      )}
                      <div style={{display:"flex",gap:8}}>
                        <button className="btn-gold" style={{fontSize:12}} onClick={()=>saveRound(player.id)} disabled={saving}>{saving?"SAVING…":"SAVE ROUND"}</button>
                        <button className="btn-ghost" style={{fontSize:12}} onClick={()=>setAddingRound(null)}>CANCEL</button>
                      </div>
                    </div>
                  )}

                  {/* Edit self-reported */}
                  {editingPid === player.id && (
                    <div style={{marginTop:12,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      <div style={{fontSize:11,color:"var(--text3)",letterSpacing:1}}>SELF-REPORTED HCP INDEX:</div>
                      <input type="number" step="0.1" min="0" max={MAX_HANDICAP} value={manualHcp}
                        onChange={e=>setManualHcp(e.target.value)} style={{width:80,textAlign:"center",fontSize:16}}/>
                      <button className="btn-gold" style={{fontSize:12}} onClick={()=>setSelfReported(player.id,manualHcp)} disabled={saving}>SAVE</button>
                      <button className="btn-ghost" style={{fontSize:12}} onClick={()=>setEditingPid(null)}>CANCEL</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {players.length===0 && <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:14}}>No players registered yet.</div>}
      </div>

      {/* How it works */}
      <div className="hcp-label">── HOW IT WORKS</div>
      <div className="hcp-card" style={{padding:"16px 20px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
          {[
            ["📋 Self-Reported","Players enter their current handicap index when registering. Used until league rounds are posted.","var(--amber)"],
            ["⛳ League Rounds","After "+LEAGUE_TAKEOVER_ROUNDS+" posted rounds, your league differential history takes over automatically.","var(--green)"],
            ["📊 WHS Formula","Differential = (Gross − Rating) × 113 ÷ Slope. Best "+WHS_BEST_OF+" of last "+WHS_POOL+" × "+WHS_MULTIPLIER+".","var(--gold)"],
            ["🔒 Max Cap","All handicap indexes are capped at "+MAX_HANDICAP+". Ensures competitive balance across the league.","var(--text2)"],
          ].map(([title,desc,col])=>(
            <div key={title} style={{padding:"12px 14px",background:"var(--bg3)",borderRadius:4,borderLeft:`2px solid ${col}`}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:1,color:col,marginBottom:6}}>{title}</div>
              <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.6}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

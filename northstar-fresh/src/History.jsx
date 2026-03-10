import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";

const TOURNAMENT_ID = "tournament-2024";

const POINTS_TABLE = [100,85,75,65,55,50,45,40,36,32,29,26,24,22,20,18,16,14,12,10];
const getBasePoints = (place) => place >= 1 && place <= POINTS_TABLE.length ? POINTS_TABLE[place-1] : 5;
const getPoints = (place, multiplier=1) => Math.round(getBasePoints(place) * multiplier);
// Event-specific payout structures
const PAYOUT_CONFIG = {
  "event-1": { splits:[250,125,75,50],  label:"Standard" },
  "event-2": { splits:[250,125,75,50],  label:"Standard" },
  "event-3": { splits:[250,125,75,50],  label:"Standard" },
  "event-4": { splits:[375,188,112,75], label:"Major" },
  "event-5": { splits:[250,125,75,50],  label:"Standard" },
  "event-6": { splits:[800,500,360,220,120], label:"Championship" },
};
const getPayouts = (eventId) => PAYOUT_CONFIG[eventId] || PAYOUT_CONFIG["event-1"];

const SEASON_EVENTS = [
  { id:"event-1", order:1, name:"Opening Classic",               date:"May 30, 2026",       course:"Rum River Hills",         multiplier:1, payoutTop4:false },
  { id:"event-2", order:2, name:"Early Summer Medal",            date:"June 20, 2026",       course:"Links at Northfork",      multiplier:1, payoutTop4:false },
  { id:"event-3", order:3, name:"Mid-Summer Medal",              date:"July 11, 2026",       course:"Oak Marsh / Eagle Valley",multiplier:1, payoutTop4:true  },
  { id:"event-4", order:4, name:"North Star Mid-Season Major ⭐", date:"August 1, 2026",     course:"Keller / Edinburgh",      multiplier:2, payoutTop4:false },
  { id:"event-5", order:5, name:"Late-Season Push",              date:"August 22, 2026",     course:"Cedar Creek / Fox Hollow",multiplier:1, payoutTop4:false },
  { id:"event-6", order:6, name:"North Star Championship ⭐⭐",   date:"September 12, 2026", course:"Mystic Lake / Keller",     multiplier:3, payoutTop4:false },
];

const HCP_STROKES = [7,1,15,5,9,17,3,13,11, 8,18,4,6,16,14,2,12,10];

const calcNet = (scores, handicap, pars) => {
  let net = 0;
  scores.forEach((s, i) => {
    if (!s) return;
    let hcpStrokes = 0;
    if (HCP_STROKES[i] <= handicap) hcpStrokes++;
    if (handicap > 18 && HCP_STROKES[i] <= handicap - 18) hcpStrokes++;
    net += s - hcpStrokes;
  });
  return net;
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
.hist-wrap { font-family:'Cormorant Garamond',Georgia,serif; }
.hist-fade { animation:histFade .4s ease; }
@keyframes histFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.hist-card { background:var(--bg2); border:1px solid var(--border); border-radius:6px; }
.hist-label { font-family:'Bebas Neue'; letter-spacing:3px; font-size:11px; color:var(--green); margin-bottom:10px; }
.hist-event-card { border:1px solid var(--border); border-radius:6px; overflow:hidden; cursor:pointer; transition:border-color .2s; }
.hist-event-card:hover { border-color:var(--gold-dim); }
.hist-event-card.active { border-color:var(--gold); }
.hist-row { border-bottom:1px solid var(--border); transition:background .15s; }
.hist-row:hover { background:var(--bg3); }
.sc-cell { width:34px; height:26px; display:flex; align-items:center; justify-content:center; border-radius:3px; font-family:'DM Mono'; font-size:12px; font-weight:600; margin:0 auto; }
.mult-badge { font-family:'Bebas Neue'; font-size:9px; letter-spacing:1px; padding:1px 5px; border-radius:2px; }
.mult-2x { background:#1a2a00; color:#a0c840; border:1px solid #4a7a10; }
.mult-3x { background:#2a1a00; color:var(--gold); border:1px solid var(--gold-dim); }
.tab-pill { padding:6px 16px; font-family:'Bebas Neue'; letter-spacing:2px; font-size:11px; cursor:pointer; border-radius:20px; border:1px solid var(--border2); color:var(--text3); background:transparent; transition:all .2s; white-space:nowrap; }
.tab-pill.active { border-color:var(--gold); color:var(--gold); background:var(--bg3); }
.place-badge { font-family:'Bebas Neue'; font-size:20px; width:40px; text-align:center; }
`;

export default function TournamentHistory({ players }) {
  const [snapshots, setSnapshots] = useState({});
  const [results,   setResults]   = useState({});
  const [eventMeta, setEventMeta] = useState({});
  const [pars,      setPars]      = useState([4,4,3,4,5,3,4,4,5,4,3,4,5,4,3,4,4,5]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [innerTab,  setInnerTab]  = useState("leaderboard");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"tournaments",TOURNAMENT_ID,"tournament_snapshots"), snap => {
      const d = {}; snap.docs.forEach(doc => { d[doc.id] = doc.data(); }); setSnapshots(d);
    });
    const u2 = onSnapshot(collection(db,"tournaments",TOURNAMENT_ID,"season_results"), snap => {
      const d = {}; snap.docs.forEach(doc => { d[doc.id] = doc.data(); }); setResults(d);
    });
    const u3 = onSnapshot(collection(db,"tournaments",TOURNAMENT_ID,"event_meta"), snap => {
      const d = {}; snap.docs.forEach(doc => { d[doc.id] = doc.data(); }); setEventMeta(d);
    });
    const u4 = onSnapshot(doc(db,"tournaments",TOURNAMENT_ID,"settings","course"), snap => {
      if (snap.exists() && snap.data().par) setPars(snap.data().par);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const lockedEvents = SEASON_EVENTS.filter(e => eventMeta[e.id]?.locked);

  // Build leaderboard for an event from live player data + season_results
  const buildLeaderboard = (event) => {
    const snap = snapshots[event.id];
    const eventResults = results[event.id] || {};

    // Use snapshot if available, otherwise build from current data
    if (snap?.leaderboard) return snap.leaderboard;

    return players
      .map(p => {
        const place = eventResults[p.id] || null;
        const gross = p.scores ? p.scores.filter(Boolean).reduce((a,b)=>a+b,0) : 0;
        const net   = p.scores ? calcNet(p.scores, p.handicap, pars) : 0;
        const pts   = place ? getPoints(place, event.multiplier) : 0;
        return { id:p.id, name:p.name, handicap:p.handicap, flight:p.flight, place, gross:gross||null, net:net||null, pts, scores:p.scores||[] };
      })
      .filter(p => p.place)
      .sort((a,b) => a.place - b.place);
  };

  const selectedEventData = selectedEvent ? SEASON_EVENTS.find(e => e.id === selectedEvent) : null;
  const leaderboard = selectedEventData ? buildLeaderboard(selectedEventData) : [];
  const meta = selectedEvent ? (eventMeta[selectedEvent] || {}) : {};
  const pot  = meta.pot || 0;

  // Score cell color
  const scColor = (score, par) => {
    if (!score) return { bg:"transparent", col:"var(--text3)" };
    const d = score - par;
    if (d <= -2) return { bg:"#1a3a0a", col:"#a0e060" };
    if (d === -1) return { bg:"#0a2a0a", col:"var(--green-bright)" };
    if (d === 0)  return { bg:"transparent", col:"var(--text)" };
    if (d === 1)  return { bg:"#2a1a0a", col:"var(--amber)" };
    return { bg:"#3a0a0a", col:"var(--red)" };
  };

  return (
    <div className="hist-wrap hist-fade">
      <style>{CSS}</style>

      <div className="hist-label">── TOURNAMENT HISTORY · 2026 SEASON</div>

      {/* Event selector */}
      {lockedEvents.length === 0 ? (
        <div className="hist-card" style={{padding:"48px 32px",textAlign:"center",marginBottom:24}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,color:"var(--text3)",marginBottom:8}}>NO COMPLETED EVENTS YET</div>
          <div style={{fontSize:14,color:"var(--text3)",fontStyle:"italic"}}>Results appear here after the commissioner locks an event in the Season tab.</div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginBottom:28}}>
          {SEASON_EVENTS.map(e => {
            const locked = eventMeta[e.id]?.locked;
            const isSelected = selectedEvent === e.id;
            return (
              <div key={e.id}
                className={`hist-event-card ${isSelected?"active":""}`}
                style={{opacity:locked?1:0.4,pointerEvents:locked?"auto":"none"}}
                onClick={()=>{ setSelectedEvent(e.id); setInnerTab("leaderboard"); setSelectedPlayer(null); }}>
                <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",background:isSelected?"var(--bg3)":"var(--bg2)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,color:isSelected?"var(--gold)":"var(--text2)"}}>
                      EVENT {e.order}
                      {e.multiplier===2&&<span className="mult-badge mult-2x" style={{marginLeft:6}}>2×</span>}
                      {e.multiplier===3&&<span className="mult-badge mult-3x" style={{marginLeft:6}}>3×</span>}
                    </div>
                    {locked && <span style={{fontSize:10,color:"var(--green)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>✓ FINAL</span>}
                  </div>
                  <div style={{fontSize:16,fontWeight:600,color:"var(--text)",marginTop:2}}>{e.name.replace(" ⭐⭐","").replace(" ⭐","")}</div>
                </div>
                <div style={{padding:"10px 18px",display:"flex",gap:16,fontSize:12,color:"var(--text3)"}}>
                  <span>📅 {e.date}</span>
                  <span>📍 {e.course.split(" /")[0]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event detail */}
      {selectedEventData && (
        <div className="hist-fade">
          {/* Header */}
          <div style={{marginBottom:20,padding:"18px 22px",background:"var(--bg2)",border:"1px solid var(--gold-dim)",borderRadius:6,borderLeft:"3px solid var(--gold)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:4}}>
                  EVENT {selectedEventData.order} · {selectedEventData.date}
                </div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:2,color:"var(--text)"}}>
                  {selectedEventData.name.replace(" ⭐⭐","").replace(" ⭐","")}
                  {selectedEventData.multiplier===2&&<span className="mult-badge mult-2x" style={{marginLeft:8}}>2× POINTS</span>}
                  {selectedEventData.multiplier===3&&<span className="mult-badge mult-3x" style={{marginLeft:8}}>3× POINTS</span>}
                </div>
                <div style={{fontSize:13,color:"var(--text3)",marginTop:2}}>📍 {selectedEventData.course}</div>
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {[
                  ["PLAYERS", leaderboard.length],
                  ["WINNER", leaderboard[0]?.name?.split(" ")[0] || "—"],
                  pot ? ["POT", `$${pot}`] : null,
                ].filter(Boolean).map(([lbl,val])=>(
                  <div key={lbl} style={{textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue'",fontSize:22,color:"var(--gold)"}}>{val}</div>
                    <div style={{fontSize:9,color:"var(--text3)",letterSpacing:2,fontFamily:"'Bebas Neue'"}}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inner tabs */}
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {[["leaderboard","🏆 LEADERBOARD"],["scorecards","📋 SCORECARDS"],["points","⭐ POINTS"],
              ["payouts","💰 PAYOUTS"]
            ].map(([val,lbl])=>(
              <button key={val} className={`tab-pill ${innerTab===val?"active":""}`} onClick={()=>{ setInnerTab(val); setSelectedPlayer(null); }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* ── LEADERBOARD */}
          {innerTab==="leaderboard" && (
            <div className="hist-card" style={{overflow:"hidden",marginBottom:24}}>
              <div style={{display:"grid",gridTemplateColumns:"44px 1fr 80px 80px 70px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
                <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>GROSS</span>
                <span style={{textAlign:"center"}}>NET</span><span style={{textAlign:"center"}}>THRU</span>
              </div>
              {leaderboard.map((p,idx)=>(
                <div key={p.id} className="hist-row" style={{display:"grid",gridTemplateColumns:"44px 1fr 80px 80px 70px",padding:"12px 16px",alignItems:"center",
                  borderLeft:idx===0?"3px solid var(--gold)":"3px solid transparent"}}>
                  <span className="place-badge" style={{color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                    {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                  </span>
                  <div>
                    <div style={{fontSize:16,fontWeight:600,color:"var(--text2)"}}>{p.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)",letterSpacing:1}}>HCP {p.handicap}</div>
                  </div>
                  <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:15,color:"var(--text2)"}}>{p.gross||"—"}</div>
                  <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:15,fontWeight:700,color:idx===0?"var(--gold)":"var(--text)"}}>{p.net||"—"}</div>
                  <div style={{textAlign:"center",fontSize:12,color:"var(--text3)"}}>
                    {p.scores ? p.scores.filter(Boolean).length : "—"}/18
                  </div>
                </div>
              ))}
              {leaderboard.length===0&&<div style={{padding:"40px",textAlign:"center",color:"var(--text3)"}}>No results recorded.</div>}
            </div>
          )}

          {/* ── SCORECARDS */}
          {innerTab==="scorecards" && (
            <div>
              {/* Player selector */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {leaderboard.map((p,idx)=>(
                  <button key={p.id} className={`tab-pill ${selectedPlayer===p.id?"active":""}`}
                    onClick={()=>setSelectedPlayer(p.id)}>
                    #{idx+1} {p.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              {selectedPlayer && (()=>{
                const p = leaderboard.find(x=>x.id===selectedPlayer) || players.find(x=>x.id===selectedPlayer);
                if (!p || !p.scores) return <div style={{color:"var(--text3)",padding:20}}>No scorecard data.</div>;
                const renderNine = (start, label) => {
                  const nineScores = p.scores.slice(start,start+9);
                  const ninePars   = pars.slice(start,start+9);
                  const gross = nineScores.filter(Boolean).reduce((a,b)=>a+b,0);
                  const parTot = ninePars.reduce((a,b)=>a+b,0);
                  return (
                    <div style={{overflowX:"auto",marginBottom:16}}>
                      <div style={{fontSize:11,color:"var(--text3)",letterSpacing:2,fontFamily:"'Bebas Neue'",marginBottom:6}}>{label}</div>
                      <table style={{borderCollapse:"collapse",minWidth:"100%",fontSize:13}}>
                        <thead>
                          <tr style={{background:"var(--bg3)"}}>
                            <td style={{padding:"6px 10px",fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,minWidth:60}}>HOLE</td>
                            {Array.from({length:9},(_,i)=>(
                              <td key={i} style={{padding:"6px 4px",textAlign:"center",fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",minWidth:36}}>{start+i+1}</td>
                            ))}
                            <td style={{padding:"6px 8px",textAlign:"center",fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",background:"var(--bg4)",minWidth:40}}>TOT</td>
                          </tr>
                          <tr style={{borderBottom:"1px solid var(--border)"}}>
                            <td style={{padding:"5px 10px",fontSize:11,color:"var(--green)",fontWeight:600}}>Par</td>
                            {ninePars.map((par,i)=><td key={i} style={{textAlign:"center",padding:"5px 4px",fontSize:12,color:"var(--green)",fontWeight:600}}>{par}</td>)}
                            <td style={{textAlign:"center",fontSize:12,color:"var(--green)",fontWeight:700,background:"var(--bg4)"}}>{parTot}</td>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{padding:"7px 10px",fontSize:13,color:"var(--text2)",fontWeight:600}}>{p.name.split(" ")[0]}</td>
                            {nineScores.map((s,i)=>{
                              const {bg,col} = scColor(s,ninePars[i]);
                              return (
                                <td key={i} style={{textAlign:"center",padding:"5px 3px"}}>
                                  <div className="sc-cell" style={{background:bg,color:s?col:"var(--text3)"}}>{s||"—"}</div>
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
                const totalGross = p.scores.filter(Boolean).reduce((a,b)=>a+b,0);
                const totalNet   = calcNet(p.scores, p.handicap, pars);
                const totalPar   = pars.reduce((a,b)=>a+b,0);
                return (
                  <div className="hist-card" style={{padding:"18px 20px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                      <div>
                        <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2,color:"var(--text)"}}>{p.name}</div>
                        <div style={{fontSize:12,color:"var(--text3)"}}>HCP {p.handicap}</div>
                      </div>
                      <div style={{display:"flex",gap:20}}>
                        {[["GROSS",totalGross,"+"+((totalGross-totalPar)>=0?(totalGross-totalPar):totalGross-totalPar)],
                          ["NET",totalNet,""],
                          ["HCP",p.handicap,""]
                        ].map(([lbl,val])=>(
                          <div key={lbl} style={{textAlign:"center"}}>
                            <div style={{fontFamily:"'Bebas Neue'",fontSize:24,color:lbl==="NET"?"var(--gold)":"var(--text2)"}}>{val||"—"}</div>
                            <div style={{fontSize:9,color:"var(--text3)",letterSpacing:2,fontFamily:"'Bebas Neue'"}}>{lbl}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {renderNine(0,"FRONT NINE")}
                    {renderNine(9,"BACK NINE")}
                    <div style={{display:"flex",gap:12,marginTop:8,fontSize:12,color:"var(--text3)",fontStyle:"italic",flexWrap:"wrap"}}>
                      <span style={{color:"#a0e060"}}>● Eagle or better</span>
                      <span style={{color:"var(--green-bright)"}}>● Birdie</span>
                      <span style={{color:"var(--text)"}}>● Par</span>
                      <span style={{color:"var(--amber)"}}>● Bogey</span>
                      <span style={{color:"var(--red)"}}>● Double+</span>
                    </div>
                  </div>
                );
              })()}
              {!selectedPlayer && <div style={{color:"var(--text3)",fontSize:14,fontStyle:"italic",padding:"20px 0"}}>Select a player above to view their scorecard.</div>}
            </div>
          )}

          {/* ── POINTS */}
          {innerTab==="points" && (
            <div className="hist-card" style={{overflow:"hidden",marginBottom:24}}>
              <div style={{display:"grid",gridTemplateColumns:"44px 1fr 80px 80px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
                <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>BASE</span><span style={{textAlign:"center"}}>EARNED</span>
              </div>
              {leaderboard.map((p,idx)=>(
                <div key={p.id} className="hist-row" style={{display:"grid",gridTemplateColumns:"44px 1fr 80px 80px",padding:"12px 16px",alignItems:"center",
                  borderLeft:idx===0?"3px solid var(--gold)":"3px solid transparent"}}>
                  <span className="place-badge" style={{color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                    {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                  </span>
                  <div>
                    <div style={{fontSize:16,fontWeight:600,color:"var(--text2)"}}>{p.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}></div>
                  </div>
                  <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:14,color:"var(--text3)"}}>{getBasePoints(p.place)}</div>
                  <div style={{textAlign:"center"}}>
                    <span style={{background:"var(--gold)",color:"#060a06",borderRadius:3,padding:"2px 10px",fontFamily:"'DM Mono'",fontSize:14,fontWeight:700}}>{p.pts}</span>
                    {selectedEventData.multiplier>1&&<div style={{fontSize:9,color:"var(--text3)",marginTop:2,letterSpacing:1}}>{selectedEventData.multiplier}× MULTIPLIER</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── PAYOUTS */}
          {innerTab==="payouts" && (
            <div>
              <div className="hist-card" style={{overflow:"hidden",marginBottom:16}}>
                <div style={{padding:"14px 20px",background:"var(--bg3)",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:2,color:"var(--gold)"}}>{getPayouts(selectedEvent).label.toUpperCase()} EVENT PURSE</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{getPayouts(selectedEvent).label==="Championship"?"Top 5 paid out":"Top 4 paid out"}</div>
                  </div>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:"var(--gold)"}}>${getPayouts(selectedEvent).splits.reduce((a,b)=>a+b,0)}</div>
                </div>
                {(()=>{ const cfg=getPayouts(selectedEvent); return leaderboard.slice(0,cfg.splits.length).map((p,idx)=>(
                  <div key={p.id} className="hist-row" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <span className="place-badge" style={{color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text2)"}}>
                        {["1ST","2ND","3RD","4TH","5TH"][idx]}
                      </span>
                      <div>
                        <div style={{fontSize:16,fontWeight:600,color:"var(--text2)"}}>{p.name}</div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>{cfg.label} event · place {idx+1}</div>
                      </div>
                    </div>
                    <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:"var(--gold)"}}>${cfg.splits[idx]}</div>
                  </div>
                )); })()}
              </div>
              <div style={{fontSize:12,color:"var(--text3)",fontStyle:"italic",textAlign:"right"}}>
                Payouts per North Star Amateur Series official structure
              </div>
            </div>
          )}
          
        </div>
      )}
    </div>
  );
}

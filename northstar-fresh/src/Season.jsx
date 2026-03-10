import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, collection, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

// ── Season config
const TOURNAMENT_ID = "tournament-2024";
const COUNT_BEST = 4;

const SEASON_EVENTS = [
  { id:"event-1", order:1, name:"Opening Classic",        date:"May 30, 2026",    course:"Rum River Hills",        multiplier:1,  pointsEvent:true,  payoutTop4:false, rydercup:false, scramble:false },
  { id:"event-2", order:2, name:"Early Summer Medal",     date:"June 20, 2026",   course:"Links at Northfork",     multiplier:1,  pointsEvent:true,  payoutTop4:false, rydercup:false, scramble:false },
  { id:"event-3", order:3, name:"Mid-Summer Medal",       date:"July 11, 2026",   course:"Oak Marsh / Eagle Valley",multiplier:1, pointsEvent:true,  payoutTop4:true,  rydercup:false, scramble:false },
  { id:"event-4", order:4, name:"North Star Mid-Season Major ⭐", date:"August 1, 2026", course:"Keller / Edinburgh", multiplier:2, pointsEvent:true, payoutTop4:false, rydercup:false, scramble:false },
  { id:"event-5", order:5, name:"Late-Season Push",       date:"August 22, 2026", course:"Cedar Creek / Fox Hollow",multiplier:1, pointsEvent:true,  payoutTop4:false, rydercup:false, scramble:false },
  { id:"event-6", order:6, name:"North Star Championship ⭐⭐", date:"September 12, 2026", course:"Mystic Lake / Keller", multiplier:3, pointsEvent:true, payoutTop4:false, rydercup:false, scramble:false },
  { id:"event-7", order:7, name:"Ryder Cup Finale 🏆",    date:"September 26, 2026", course:"Championship Venue",  multiplier:0,  pointsEvent:false, payoutTop4:false, rydercup:true,  scramble:false },
  { id:"event-8", order:8, name:"Season-Ending Scramble & Banquet", date:"October 3, 2026", course:"TBD", multiplier:0, pointsEvent:false, payoutTop4:false, rydercup:false, scramble:true },
];

const POINTS_TABLE = [100,85,75,65,55,50,45,40,36,32,29,26,24,22,20,18,16,14,12,10];
const getBasePoints = (place) => place >= 1 && place <= POINTS_TABLE.length ? POINTS_TABLE[place-1] : 5;
const getPoints = (place, multiplier) => Math.round(getBasePoints(place) * multiplier);

// Payout splits for top-4 events (percentages of pot)
const PAYOUT_SPLITS = [0.40, 0.27, 0.20, 0.13];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
.ss { font-family:'Cormorant Garamond',Georgia,serif; }
.ss-fade { animation:ssFade .4s ease; }
@keyframes ssFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.ss-card { background:var(--bg2); border:1px solid var(--border); border-radius:6px; }
.ss-label { font-family:'Bebas Neue'; letter-spacing:3px; font-size:11px; color:var(--green); margin-bottom:10px; }
.ss-row { border-bottom:1px solid var(--border); transition:background .15s; }
.ss-row:hover { background:var(--bg3); }
.ev-chip { padding:5px 14px; font-size:11px; border:1px solid var(--border); border-radius:20px; color:var(--text3); cursor:pointer; transition:all .2s; background:transparent; font-family:'Bebas Neue'; letter-spacing:1px; white-space:nowrap; }
.ev-chip.active { border-color:var(--gold); color:var(--gold); background:var(--bg3); }
.ev-chip.locked { border-color:var(--green-dim); color:var(--green); }
.ev-chip.major { border-color:var(--gold-dim); }
.pts-counted { background:var(--gold); color:#060a06; border-radius:3px; padding:2px 7px; font-family:'DM Mono'; font-size:12px; font-weight:700; }
.pts-dropped { color:var(--text3); font-family:'DM Mono'; font-size:12px; text-decoration:line-through; }
.pts-empty { color:var(--border2); font-family:'DM Mono'; font-size:12px; }
.mult-badge { font-family:'Bebas Neue'; font-size:10px; letter-spacing:1px; padding:1px 5px; border-radius:2px; margin-left:4px; }
.mult-2x { background:#1a2a00; color:#a0c840; border:1px solid #4a7a10; }
.mult-3x { background:#2a1a00; color:var(--gold); border:1px solid var(--gold-dim); }
.rank-badge { font-family:'Bebas Neue'; font-size:22px; width:44px; text-align:center; }
.ryder-team { border-radius:6px; padding:16px; margin-bottom:12px; }
.ryder-A { background:#0a1800; border:1px solid #2a4a10; }
.ryder-B { background:#00101a; border:1px solid #103040; }
.match-row { padding:10px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.match-result { font-family:'DM Mono'; font-size:13px; padding:4px 10px; border-radius:3px; min-width:60px; text-align:center; }
.result-A { background:#0a1800; color:#70c840; border:1px solid #2a4a10; }
.result-B { background:#00101a; color:#4090c0; border:1px solid #103040; }
.result-half { background:#1a1400; color:var(--gold); border:1px solid var(--gold-dim); }
.result-pending { background:var(--bg3); color:var(--text3); border:1px solid var(--border2); }
.score-bubble { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Bebas Neue'; font-size:18px; }
.score-big { font-family:'Bebas Neue'; font-size:48px; line-height:1; }
`;

export default function SeasonStandings({ players, adminUnlocked }) {
  const [results, setResults]       = useState({});
  const [ryder, setRyder]           = useState(null);
  const [eventMeta, setEventMeta]   = useState({});
  const [activeTab, setActiveTab]   = useState("standings");
  const [editingEvent, setEditingEvent] = useState(null);
  const [manualEntry, setManualEntry]   = useState({});
  const [saving, setSaving]         = useState(false);
  const [potSize, setPotSize]       = useState({});

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"tournaments",TOURNAMENT_ID,"season_results"), snap => {
      const d = {}; snap.docs.forEach(doc => { d[doc.id] = doc.data(); }); setResults(d);
    });
    const u2 = onSnapshot(doc(db,"tournaments",TOURNAMENT_ID,"settings","ryder"), snap => {
      if (snap.exists()) setRyder(snap.data());
      else setRyder({ teamA:{ name:"Team USA", color:"#4a9a30", players:[] }, teamB:{ name:"Team Europe", color:"#3060a0", players:[] }, matches:[], locked:false, scoreA:0, scoreB:0 });
    });
    const u3 = onSnapshot(collection(db,"tournaments",TOURNAMENT_ID,"event_meta"), snap => {
      const d = {}; snap.docs.forEach(doc => { d[doc.id] = doc.data(); }); setEventMeta(d);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  // ── Compute standings
  const computeStandings = () => {
    const pointsEvents = SEASON_EVENTS.filter(e => e.pointsEvent);
    return players.map(p => {
      const evData = pointsEvents.map(ev => {
        const res = results[ev.id] || {};
        const place = res[p.id] || null;
        const pts = place ? getPoints(place, ev.multiplier) : null;
        return { ...ev, place, pts };
      });
      const withPts = evData.filter(e => e.pts !== null).sort((a,b) => b.pts - a.pts);
      const countedIds = new Set(withPts.slice(0, COUNT_BEST).map(e => e.id));
      const total = withPts.slice(0, COUNT_BEST).reduce((a,b) => a + b.pts, 0);
      return {
        player: p,
        events: evData.map(e => ({ ...e, counted: countedIds.has(e.id) && e.pts !== null, dropped: !countedIds.has(e.id) && e.pts !== null })),
        total,
        played: withPts.length,
      };
    }).sort((a,b) => b.total - a.total || b.played - a.played);
  };

  const standings = computeStandings();
  const pointsEvents = SEASON_EVENTS.filter(e => e.pointsEvent);

  const saveResults = async () => {
    if (!editingEvent) return;
    setSaving(true);
    const toSave = {};
    Object.entries(manualEntry).forEach(([pid, place]) => { if (place) toSave[pid] = parseInt(place); });
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"season_results",editingEvent), toSave);
    // Save pot/payout if applicable
    const pot = potSize[editingEvent] ? parseInt(potSize[editingEvent]) : 0;
    if (pot) {
      await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"event_meta",editingEvent), { pot, locked: true });
    } else {
      await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"event_meta",editingEvent), { locked: true });
    }
    // Auto-snapshot: freeze leaderboard for history tab
    const ev = SEASON_EVENTS.find(e => e.id === editingEvent);
    const leaderboard = Object.entries(toSave)
      .map(([pid, place]) => ({ id: pid, place }))
      .sort((a,b) => a.place - b.place);
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"tournament_snapshots",editingEvent), {
      eventId: editingEvent,
      eventName: ev?.name || editingEvent,
      date: ev?.date || "",
      course: ev?.course || "",
      multiplier: ev?.multiplier || 1,
      pot: pot || 0,
      lockedAt: Date.now(),
      leaderboard,
    });
    setSaving(false); setEditingEvent(null); setManualEntry({});
  };

  const saveRyder = async (data) => {
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"settings","ryder"), data);
    setRyder(data);
  };

  // ── STANDINGS TAB
  const StandingsTab = () => (
    <div className="ss-fade">
      <div style={{marginBottom:20}}>
        <div className="ss-label">── 2026 SEASON · BEST {COUNT_BEST} OF {pointsEvents.length} EVENTS COUNT</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
          {SEASON_EVENTS.map(e => {
            const meta = eventMeta[e.id] || {};
            return (
              <div key={e.id} className={`ev-chip ${meta.locked?"locked":""} ${e.multiplier>1?"major":""}`} style={{cursor:"default"}}>
                {e.name.replace(" ⭐⭐","").replace(" ⭐","").replace(" 🏆","")}
                {e.multiplier===2 && <span className="mult-badge mult-2x">2×</span>}
                {e.multiplier===3 && <span className="mult-badge mult-3x">3×</span>}
                {e.rydercup && <span style={{marginLeft:4,fontSize:10,color:"var(--gold)"}}>🏆</span>}
                {e.scramble && <span style={{marginLeft:4,fontSize:10,color:"var(--green)"}}>🎉</span>}
                {meta.locked && <span style={{marginLeft:4,color:"var(--green)",fontSize:10}}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="ss-card" style={{overflowX:"auto",marginBottom:24}}>
        <div style={{minWidth:700}}>
          <div style={{display:"grid",gridTemplateColumns:`52px 1fr repeat(${pointsEvents.length},72px) 90px`,background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
            <span>POS</span><span>PLAYER</span>
            {pointsEvents.map(e=>(
              <span key={e.id} style={{textAlign:"center"}}>
                E{e.order}{e.multiplier>1?` ${e.multiplier}×`:""}
              </span>
            ))}
            <span style={{textAlign:"center"}}>PTS</span>
          </div>
          {standings.map((s,idx)=>{
            const isLeader = idx===0 && s.total>0;
            return (
              <div key={s.player.id} className="ss-row"
                style={{display:"grid",gridTemplateColumns:`52px 1fr repeat(${pointsEvents.length},72px) 90px`,padding:"12px 16px",alignItems:"center",
                  borderLeft:isLeader?"3px solid var(--gold)":"3px solid transparent"}}>
                <span className="rank-badge" style={{color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                  {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                </span>
                <div>
                  <div style={{fontSize:16,fontWeight:600,color:isLeader?"var(--text)":"var(--text2)"}}>{s.player.name}</div>
                  <div style={{fontSize:11,color:"var(--text3)",letterSpacing:1}}>{s.player.flight} · HCP {s.player.handicap}</div>
                </div>
                {s.events.map((e,i)=>(
                  <div key={i} style={{textAlign:"center"}}>
                    {e.pts===null ? <span className="pts-empty">—</span>
                    : e.counted ? <span className="pts-counted">{e.pts}</span>
                    : <span className="pts-dropped">{e.pts}</span>}
                    {e.place && <div style={{fontSize:9,color:"var(--text3)",marginTop:2}}>#{e.place}</div>}
                  </div>
                ))}
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:s.total>0?"var(--gold)":"var(--text3)"}}>{s.total||"—"}</div>
                  <div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>{s.played}/{pointsEvents.length}</div>
                </div>
              </div>
            );
          })}
          {standings.length===0 && <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:14}}>No players yet.</div>}
        </div>
      </div>

      {/* Points key */}
      <div className="ss-label">── POINTS SCALE</div>
      <div className="ss-card" style={{padding:"16px 20px",marginBottom:24}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:12}}>
          {POINTS_TABLE.slice(0,8).map((pts,i)=>(
            <div key={i} style={{textAlign:"center",minWidth:44}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:20,color:i===0?"var(--gold)":i===1?"#90b0b8":i===2?"#c08050":"var(--text2)"}}>{pts}</div>
              <div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>{i===0?"1ST":i===1?"2ND":i===2?"3RD":`${i+1}TH`}</div>
            </div>
          ))}
          <div style={{textAlign:"center",minWidth:44}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:20,color:"var(--text3)"}}>5</div>
            <div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>9TH+</div>
          </div>
        </div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:12,color:"var(--text3)",fontStyle:"italic"}}>
          <span>Best {COUNT_BEST} of {pointsEvents.length} count</span>
          <span><span className="mult-badge mult-2x">2×</span> Event 4 = double points</span>
          <span><span className="mult-badge mult-3x">3×</span> Event 6 = triple points</span>
          <span><span style={{color:"var(--gold)"}}>Gold</span> = counted · <span style={{textDecoration:"line-through"}}>Strike</span> = dropped</span>
        </div>
      </div>

      {/* Schedule */}
      <div className="ss-label">── 2026 SCHEDULE</div>
      <div className="ss-card" style={{overflow:"hidden"}}>
        {SEASON_EVENTS.map((e,i)=>{
          const meta = eventMeta[e.id] || {};
          return (
            <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid var(--border)",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:e.multiplier===3?"var(--gold)":e.multiplier===2?"#a0c840":e.rydercup?"#4090c0":e.scramble?"var(--green)":"var(--text3)",minWidth:30}}>{e.order}</div>
                <div>
                  <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>
                    {e.name}
                    {e.multiplier===2 && <span className="mult-badge mult-2x" style={{marginLeft:8}}>2× POINTS</span>}
                    {e.multiplier===3 && <span className="mult-badge mult-3x" style={{marginLeft:8}}>3× POINTS</span>}
                    {e.payoutTop4 && <span style={{marginLeft:8,fontSize:10,color:"var(--amber)",fontFamily:"'Bebas Neue'",letterSpacing:1,border:"1px solid var(--amber)",padding:"1px 5px",borderRadius:2}}>TOP-4 PAYOUT</span>}
                  </div>
                  <div style={{fontSize:12,color:"var(--text3)"}}>{e.date} · {e.course}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {!e.pointsEvent && !e.rydercup && <span style={{fontSize:11,color:"var(--green)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>NO POINTS</span>}
                {e.rydercup && <span style={{fontSize:11,color:"#4090c0",fontFamily:"'Bebas Neue'",letterSpacing:1}}>RYDER CUP</span>}
                {meta.locked && <span style={{fontSize:11,color:"var(--green)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>✓ FINAL</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── RYDER CUP TAB
  const RyderTab = () => {
    const [localRyder, setLocalRyder] = useState(ryder || { teamA:{name:"Team USA",color:"#4a9a30",players:[]}, teamB:{name:"Team Europe",color:"#3060a0",players:[]}, matches:[], scoreA:0, scoreB:0, locked:false });
    const [savingRyder, setSavingRyder] = useState(false);

    const totalA = localRyder.matches?.reduce((a,m) => a + (m.result==="A"?1:m.result==="half"?.5:0), 0) || localRyder.scoreA || 0;
    const totalB = localRyder.matches?.reduce((a,m) => a + (m.result==="B"?1:m.result==="half"?.5:0), 0) || localRyder.scoreB || 0;
    const totalMatches = (localRyder.matches?.length || 0);
    const maxPoints = totalMatches;

    const addMatch = () => {
      const newMatch = { id:`m-${Date.now()}`, type:"singles", playerA:"", playerB:"", result:"pending", desc:"" };
      setLocalRyder(r => ({ ...r, matches:[...(r.matches||[]), newMatch] }));
    };

    const updateMatch = (id, field, val) => {
      setLocalRyder(r => ({ ...r, matches: r.matches.map(m => m.id===id ? {...m,[field]:val} : m) }));
    };

    const removeMatch = (id) => {
      setLocalRyder(r => ({ ...r, matches: r.matches.filter(m => m.id!==id) }));
    };

    const handleSave = async () => {
      setSavingRyder(true);
      await saveRyder(localRyder);
      setSavingRyder(false);
    };

    // Top 12 for Ryder Cup
    const top12 = standings.slice(0, 12).map(s => s.player);

    return (
      <div className="ss-fade">
        <div style={{marginBottom:20}}>
          <div className="ss-label">── RYDER CUP FINALE · SEPTEMBER 26, 2026</div>
          <div style={{fontSize:14,color:"var(--text2)",lineHeight:1.7,marginBottom:16,fontStyle:"italic",borderLeft:"2px solid var(--gold-dim)",paddingLeft:16}}>
            Top 12 players from season standings. Morning team matches + afternoon singles. 36 holes in one day.
          </div>
        </div>

        {/* Scoreboard */}
        <div className="ss-card" style={{padding:24,marginBottom:24}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:16,marginBottom:20}}>
            {/* Team A */}
            <div style={{textAlign:"center"}}>
              {adminUnlocked ? (
                <input defaultValue={localRyder.teamA?.name||"Team USA"} onBlur={e=>setLocalRyder(r=>({...r,teamA:{...r.teamA,name:e.target.value}}))}
                  style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,background:"transparent",border:"none",borderBottom:"1px solid var(--border2)",color:"var(--green-bright)",textAlign:"center",width:"100%",outline:"none"}}/>
              ) : (
                <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,color:"var(--green-bright)"}}>{localRyder.teamA?.name||"Team USA"}</div>
              )}
              <div className="score-big" style={{color:"var(--green-bright)",marginTop:8}}>{totalA}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:3,color:"var(--text3)"}}>VS</div>
              <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>{totalMatches} matches</div>
              {maxPoints > 0 && <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{(maxPoints/2).toFixed(1)} to win</div>}
            </div>
            {/* Team B */}
            <div style={{textAlign:"center"}}>
              {adminUnlocked ? (
                <input defaultValue={localRyder.teamB?.name||"Team Europe"} onBlur={e=>setLocalRyder(r=>({...r,teamB:{...r.teamB,name:e.target.value}}))}
                  style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,background:"transparent",border:"none",borderBottom:"1px solid var(--border2)",color:"#4090c0",textAlign:"center",width:"100%",outline:"none"}}/>
              ) : (
                <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,color:"#4090c0"}}>{localRyder.teamB?.name||"Team Europe"}</div>
              )}
              <div className="score-big" style={{color:"#4090c0",marginTop:8}}>{totalB}</div>
            </div>
          </div>

          {/* Leader bar */}
          {totalMatches > 0 && (
            <div style={{background:"var(--bg3)",borderRadius:4,height:8,overflow:"hidden",marginBottom:8}}>
              <div style={{height:"100%",background:totalA>totalB?"var(--green)":totalB>totalA?"#3060a0":"var(--border2)",width:`${Math.max(5,Math.min(95,(totalA/maxPoints)*100))}%`,transition:"width .5s"}}/>
            </div>
          )}
          {totalA===totalB && totalMatches>0 && <div style={{textAlign:"center",fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,color:"var(--gold)"}}>ALL SQUARE</div>}
          {totalA>totalB && <div style={{textAlign:"center",fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,color:"var(--green-bright)"}}>{localRyder.teamA?.name||"Team USA"} LEAD {totalA}–{totalB}</div>}
          {totalB>totalA && <div style={{textAlign:"center",fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,color:"#4090c0"}}>{localRyder.teamB?.name||"Team Europe"} LEAD {totalB}–{totalA}</div>}
        </div>

        {/* Team rosters */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
          {["A","B"].map(team=>{
            const t = team==="A" ? localRyder.teamA : localRyder.teamB;
            const color = team==="A" ? "var(--green-bright)" : "#4090c0";
            const bg = team==="A" ? "ryder-A" : "ryder-B";
            return (
              <div key={team} className={`ryder-team ${bg}`}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,color,marginBottom:10}}>{t?.name||`Team ${team}`}</div>
                {adminUnlocked ? (
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {top12.map(p=>{
                      const inA = localRyder.teamA?.players?.includes(p.id);
                      const inB = localRyder.teamB?.players?.includes(p.id);
                      const inThis = team==="A"?inA:inB;
                      return (
                        <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:14,color:inThis?"var(--text)":"var(--text3)"}}>
                          <input type="checkbox" checked={!!inThis} onChange={e=>{
                            const key = team==="A"?"teamA":"teamB";
                            const otherKey = team==="A"?"teamB":"teamA";
                            if(e.target.checked){
                              setLocalRyder(r=>({...r,
                                [key]:{...r[key],players:[...(r[key]?.players||[]),p.id]},
                                [otherKey]:{...r[otherKey],players:(r[otherKey]?.players||[]).filter(id=>id!==p.id)}
                              }));
                            } else {
                              setLocalRyder(r=>({...r,[key]:{...r[key],players:(r[key]?.players||[]).filter(id=>id!==p.id)}}));
                            }
                          }}/>
                          {p.name} <span style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {(t?.players||[]).map(pid=>{
                      const p = players.find(x=>x.id===pid);
                      return p ? <div key={pid} style={{fontSize:14,color:"var(--text2)"}}>{p.name} <span style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</span></div> : null;
                    })}
                    {(!t?.players||t.players.length===0) && <div style={{fontSize:13,color:"var(--text3)",fontStyle:"italic"}}>TBD — top 12 after Event 6</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Matches */}
        <div className="ss-label">── MATCH RESULTS</div>
        <div className="ss-card" style={{overflow:"hidden",marginBottom:16}}>
          {(!localRyder.matches || localRyder.matches.length===0) && (
            <div style={{padding:"32px",textAlign:"center",color:"var(--text3)",fontSize:13}}>No matches added yet.</div>
          )}
          {(localRyder.matches||[]).map((m,i)=>(
            <div key={m.id} className="match-row">
              <div style={{fontSize:13,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,minWidth:60}}>
                {m.type==="foursomes"?"FOURSOMES":m.type==="fourballs"?"FOUR-BALL":"SINGLES"} {i+1}
              </div>
              {adminUnlocked ? (
                <>
                  <input defaultValue={m.playerA} onBlur={e=>updateMatch(m.id,"playerA",e.target.value)} placeholder="Player(s) A" style={{flex:1,minWidth:100,padding:"5px 8px",fontSize:13}}/>
                  <select value={m.result} onChange={e=>updateMatch(m.id,"result",e.target.value)}
                    style={{padding:"5px 10px",fontSize:13,minWidth:120}}>
                    <option value="pending">Pending</option>
                    <option value="A">{localRyder.teamA?.name||"Team A"} wins</option>
                    <option value="B">{localRyder.teamB?.name||"Team B"} wins</option>
                    <option value="half">Halved</option>
                  </select>
                  <input defaultValue={m.playerB} onBlur={e=>updateMatch(m.id,"playerB",e.target.value)} placeholder="Player(s) B" style={{flex:1,minWidth:100,padding:"5px 8px",fontSize:13}}/>
                  <button onClick={()=>removeMatch(m.id)} style={{background:"transparent",border:"1px solid #2a1010",color:"var(--red)",padding:"4px 8px",borderRadius:3,cursor:"pointer",fontFamily:"'Bebas Neue'",fontSize:11}}>✕</button>
                </>
              ) : (
                <>
                  <div style={{flex:1,fontSize:14,color:"var(--text2)",textAlign:"right"}}>{m.playerA||"—"}</div>
                  <div className={`match-result result-${m.result==="pending"?"pending":m.result}`}>
                    {m.result==="pending"?"TBD":m.result==="half"?"½–½":m.result==="A"?"▲ WIN":"▲ WIN"}
                  </div>
                  <div style={{flex:1,fontSize:14,color:"var(--text2)"}}>{m.playerB||"—"}</div>
                </>
              )}
            </div>
          ))}
        </div>
        {adminUnlocked && (
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{ const m={id:`m-${Date.now()}`,type:"singles",playerA:"",playerB:"",result:"pending"}; setLocalRyder(r=>({...r,matches:[...(r.matches||[]),m]})); }}>+ SINGLES MATCH</button>
            <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{ const m={id:`m-${Date.now()}`,type:"fourballs",playerA:"",playerB:"",result:"pending"}; setLocalRyder(r=>({...r,matches:[...(r.matches||[]),m]})); }}>+ FOUR-BALL</button>
            <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{ const m={id:`m-${Date.now()}`,type:"foursomes",playerA:"",playerB:"",result:"pending"}; setLocalRyder(r=>({...r,matches:[...(r.matches||[]),m]})); }}>+ FOURSOMES</button>
            <button className="btn-gold" style={{fontSize:12}} onClick={handleSave} disabled={savingRyder}>{savingRyder?"SAVING…":"SAVE RYDER CUP"}</button>
          </div>
        )}
      </div>
    );
  };

  // ── ADMIN RESULTS ENTRY
  const AdminEntry = () => {
    if (!adminUnlocked) return null;
    return (
      <div className="ss-fade">
        <div className="ss-label">── ENTER TOURNAMENT RESULTS</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {SEASON_EVENTS.filter(e=>e.pointsEvent).map(e=>{
            const meta = eventMeta[e.id]||{};
            return (
              <button key={e.id} className={`ev-chip ${editingEvent===e.id?"active":""} ${meta.locked?"locked":""}`}
                onClick={()=>{ setEditingEvent(e.id); const ex=results[e.id]||{}; const init={}; players.forEach(p=>{init[p.id]=ex[p.id]||"";}); setManualEntry(init); }}>
                {e.name.replace(" ⭐⭐","").replace(" ⭐","")}
                {e.multiplier>1&&<span className={`mult-badge mult-${e.multiplier}x`} style={{marginLeft:4}}>{e.multiplier}×</span>}
                {meta.locked&&<span style={{color:"var(--green)",marginLeft:4}}>✓</span>}
              </button>
            );
          })}
        </div>

        {editingEvent && (()=>{
          const ev = SEASON_EVENTS.find(e=>e.id===editingEvent);
          return (
            <div className="ss-card" style={{padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2,color:"var(--gold)"}}>{ev?.name}</div>
                  <div style={{fontSize:12,color:"var(--text3)"}}>{ev?.date} · {ev?.course}</div>
                </div>
                {ev?.payoutTop4 && (
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,color:"var(--text3)"}}>POT SIZE ($)</span>
                    <input type="number" defaultValue={potSize[editingEvent]||""} onBlur={e=>setPotSize(p=>({...p,[editingEvent]:e.target.value}))}
                      placeholder="e.g. 200" style={{width:100,textAlign:"center"}}/>
                  </div>
                )}
              </div>

              {ev?.payoutTop4 && potSize[editingEvent] && (
                <div style={{marginBottom:16,padding:"12px 16px",background:"var(--bg3)",borderRadius:4,fontSize:13,color:"var(--text2)"}}>
                  <div style={{fontFamily:"'Bebas Neue'",letterSpacing:2,fontSize:11,color:"var(--amber)",marginBottom:6}}>PAYOUT BREAKDOWN</div>
                  {PAYOUT_SPLITS.map((pct,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid var(--border)"}}>
                      <span>{i===0?"1ST":i===1?"2ND":i===2?"3RD":"4TH"} place</span>
                      <span style={{color:"var(--gold)",fontFamily:"'DM Mono'"}}>
                        ${Math.round(parseInt(potSize[editingEvent])*pct)} ({Math.round(pct*100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"1fr 110px 80px",gap:8,marginBottom:4}}>
                <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1}}>PLAYER</div>
                <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,textAlign:"center"}}>FINISH</div>
                <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1,textAlign:"center"}}>POINTS</div>
              </div>
              {players.map(p=>(
                <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 110px 80px",gap:8,alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{fontSize:15,color:"var(--text2)"}}>{p.name}</div>
                  <input type="number" min="1" max={players.length} value={manualEntry[p.id]||""}
                    onChange={e=>setManualEntry(prev=>({...prev,[p.id]:e.target.value}))}
                    placeholder="—" style={{textAlign:"center",padding:"5px",fontSize:14,fontFamily:"'DM Mono'"}}/>
                  <div style={{textAlign:"center",fontFamily:"'Bebas Neue'",fontSize:16,color:"var(--gold)"}}>
                    {manualEntry[p.id] ? getPoints(parseInt(manualEntry[p.id]), ev?.multiplier||1) : "—"}
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button className="btn-gold" style={{fontSize:13}} onClick={saveResults} disabled={saving}>{saving?"SAVING…":"SAVE & LOCK RESULTS"}</button>
                <button className="btn-ghost" style={{fontSize:13}} onClick={()=>{setEditingEvent(null);setManualEntry({});}}>CANCEL</button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="ss">
      <style>{CSS}</style>
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid var(--border)",overflowX:"auto"}}>
        {[["standings","🌟 STANDINGS"],["ryder","🏆 RYDER CUP"],...(adminUnlocked?[["entry","⚙ ENTER RESULTS"]]:[])]
          .map(([val,label])=>(
          <div key={val} style={{padding:"8px 18px",fontFamily:"'Bebas Neue'",letterSpacing:2,fontSize:12,cursor:"pointer",
            borderBottom:`2px solid ${activeTab===val?"var(--gold)":"transparent"}`,
            color:activeTab===val?"var(--gold)":"var(--text3)",transition:"all .2s",whiteSpace:"nowrap"}}
            onClick={()=>setActiveTab(val)}>
            {label}
          </div>
        ))}
      </div>
      {activeTab==="standings" && <StandingsTab/>}
      {activeTab==="ryder"    && <RyderTab/>}
      {activeTab==="entry"    && <AdminEntry/>}
    </div>
  );
}

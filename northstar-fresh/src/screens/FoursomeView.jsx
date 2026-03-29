import React from "react";
import { db } from "../firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { TOURNAMENT_ID, DEFAULT_PAR } from "../constants";
import { calcNet, calcGrossToPar, toPM, holesPlayed } from "../lib/scoring";
import { calcHoleRange } from "../lib/handicap";
import { usePlayers } from "../contexts/PlayersContext";
import { useTournament } from "../contexts/TournamentContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourse } from "../contexts/CourseContext";

export default function FoursomeView({ notify }) {
  const { players } = usePlayers();
  const { groupBets, foursomes } = useTournament();
  const { activePlayer } = useAuth();
  const { course } = useCourse();

  const pars = (Array.isArray(course?.par) && course.par.length===18) ? course.par : DEFAULT_PAR;
  const par3s = pars.map((p,i) => p===3 ? i : -1).filter(i => i !== -1);

  const [step, setStep]             = React.useState("list");
  const [gName, setGName]           = React.useState("");
  const [gMembers, setGMembers]     = React.useState([]);
  const [detailGroup, setDetailGroup] = React.useState(null);
  const [betType, setBetType]       = React.useState("fullround");
  const [betScore, setBetScore]     = React.useState("net");
  const [betAmount, setBetAmount]   = React.useState("");
  const [betPlayers, setBetPlayers] = React.useState([]);
  const [betHole, setBetHole]       = React.useState("");
  const [betErr, setBetErr]         = React.useState("");

  const getPlayer = id => players.find(p => p.id === id);
  const groupBetsFor = (group) => groupBets.filter(b => b.foursomeId === group.id);

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
          <div key={group.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,padding:"16px 20px",marginBottom:12,cursor:"pointer"}}
            onClick={()=>{ setDetailGroup(group); setStep("detail"); }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:1}}>{group.name}</div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{group.memberIds.map(id=>getPlayer(id)?.name||"?").join(" · ")}</div>
              </div>
              <div style={{textAlign:"right"}}>
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
          <div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2}}>{detailGroup.name}</div>
            <div style={{fontSize:12,color:"var(--text3)"}}>{allPids.map(id=>getPlayer(id)?.name||"?").join(" · ")}</div>
          </div>
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
}

import React, { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { TOURNAMENT_ID, DEFAULT_PAR } from "../constants";
import { calcNet, calcGrossToPar, toPM, holesPlayed } from "../lib/scoring";
import { calcHoleRange } from "../lib/handicap";
import { usePlayers } from "../contexts/PlayersContext";
import { useTournament } from "../contexts/TournamentContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourse } from "../contexts/CourseContext";
import ConfirmModal from "../components/ConfirmModal";

export default function FoursomeView({ notify }) {
  const { players } = usePlayers();
  const { groupBets, foursomes, deleteFoursome } = useTournament();
  const { activePlayer } = useAuth();
  const { course } = useCourse();

  const pars = (Array.isArray(course?.par) && course.par.length===18) ? course.par : DEFAULT_PAR;
  const par3s = pars.map((p,i) => p===3 ? i : -1).filter(i => i !== -1);

  const [step, setStep]               = React.useState("list");
  const [gName, setGName]             = React.useState("");
  const [gMembers, setGMembers]       = React.useState([]);
  const [detailGroup, setDetailGroup] = React.useState(null);
  const [betType, setBetType]         = React.useState("fullround");
  const [betScore, setBetScore]       = React.useState("net");
  const [betAmount, setBetAmount]     = React.useState("");
  const [betPlayers, setBetPlayers]   = React.useState([]);
  const [betHole, setBetHole]         = React.useState("");
  const [betErr, setBetErr]           = React.useState("");
  const [confirmState, setConfirmState] = useState(null);

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

  const handleDeleteFoursome = (id, name) => {
    setConfirmState({
      title: "Delete Group",
      message: `Delete group "${name}"?`,
      onConfirm: async () => {
        try {
          await deleteFoursome(id);
          notify("Group deleted.");
        } catch(e) {
          console.error(e);
          notify("Failed to delete group — check connection.", "error");
        }
        setConfirmState(null);
      },
      destructive: true
    });
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
      <div className="bg-bg3 border border-border rounded-lg p-4 mb-2.5">
        <div className="flex justify-between items-center mb-2.5">
          <div>
            <span className="font-display text-[13px] tracking-[2px] text-gold">{bet.label}</span>
            <span className="text-[11px] text-t3 ml-2">${bet.amount}/player</span>
          </div>
          {winnerName && (
            <span className="font-display text-[10px] tracking-[2px] text-green border border-green-dim rounded-[3px] px-2 py-px">
              🏆 {winnerName}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {pids.map(pid => {
            const p = getPlayer(pid); if (!p) return null;
            const score = bet.type!=="ctp" ? getGroupScore(pid,bet.type,bet.scoreType) : null;
            const thru = bet.type!=="ctp" ? thruRange(pid,bet.type) : null;
            const isWinner = winner===pid;
            return (
              <div key={pid}
                className="flex justify-between items-center px-2.5 py-1.5 rounded-[4px]"
                style={{
                  background: isWinner ? "#0a1a0a" : "transparent",
                  border: isWinner ? "1px solid var(--green-dim)" : "1px solid transparent",
                }}>
                <span className="text-[14px]" style={{color:isWinner?"var(--green)":"var(--text2)",fontWeight:isWinner?600:400}}>{p.name}</span>
                {bet.type!=="ctp" ? (
                  <div className="flex gap-3 items-center">
                    <span className="text-[11px] text-t3">{thru===(bet.type==="fullround"?18:9)?"F":`Thru ${thru||"—"}`}</span>
                    <span className="font-mono text-[16px] font-bold" style={{color:isWinner?"var(--green)":"var(--text3)"}}>{score!==null?score:"—"}</span>
                  </div>
                ) : (
                  canSettle && !bet.settled ? (
                    <button
                      onClick={()=>settleCtp(bet.id,pid)}
                      className="font-display text-[11px] tracking-[2px] px-3 py-1 bg-transparent border border-[--gold-dim] text-gold rounded-[3px] cursor-pointer min-h-[36px]"
                      style={{borderColor:"var(--gold-dim)",color:"var(--gold)"}}>
                      SET WINNER
                    </button>
                  ) : (
                    <span className="text-[12px]" style={{color:isWinner?"var(--green)":"var(--text3)"}}>{isWinner?"🎯 Winner":"—"}</span>
                  )
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
      <div className="rounded-lg p-4 mt-4" style={{background:"#0a1a0a",border:"1px solid var(--green-dim)"}}>
        <div className="font-display text-[11px] tracking-[3px] text-green mb-2.5">── SETTLEMENT</div>
        {owed.map((o,i)=>(
          <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
            <span className="text-[14px] text-t2">
              <span style={{color:"var(--red)"}}>{getPlayer(o.from)?.name}</span>
              <span className="text-t3"> owes </span>
              <span style={{color:"var(--green)"}}>{getPlayer(o.to)?.name}</span>
            </span>
            <span className="font-mono text-[18px] font-bold text-gold">${o.amount.toFixed(0)}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  if (step === "list") return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div className="font-display text-[11px] tracking-[3px] text-t3">── {foursomes.length} GROUP{foursomes.length!==1?"S":""}</div>
        <button className="btn-gold text-[12px] py-2 px-[18px] tracking-[2px]" onClick={()=>setStep("create")}>+ CREATE GROUP</button>
      </div>

      {foursomes.length===0 && (
        <div className="p-10 text-center bg-bg2 border border-border rounded-lg">
          <div className="text-4xl mb-3">🤝</div>
          <div className="font-display text-[16px] tracking-[2px] mb-2">NO GROUPS YET</div>
          <div className="text-[13px] text-t3 mb-4">Create a group with your foursome to track bets and scores together.</div>
          <button className="btn-gold text-[12px] px-6 py-2.5" onClick={()=>setStep("create")}>CREATE GROUP →</button>
        </div>
      )}

      {foursomes.map(group => {
        const bets = groupBetsFor(group);
        const balances = calcSettlement(bets, group.memberIds);
        const myBalance = activePlayer ? balances[activePlayer] : null;
        return (
          <div key={group.id}
            className="bg-bg2 border border-border rounded-lg p-4 mb-3 cursor-pointer"
            onClick={()=>{ setDetailGroup(group); setStep("detail"); }}>
            <div className="flex justify-between items-start mb-2.5">
              <div className="flex-1 min-w-0 pr-3">
                <div className="font-display text-xl tracking-[1px]">{group.name}</div>
                <div className="text-[12px] text-t3 mt-0.5">{group.memberIds.map(id=>getPlayer(id)?.name||"?").join(" · ")}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="text-[11px] text-t3">{bets.length} bet{bets.length!==1?"s":""}</div>
                {myBalance!==null&&myBalance!==0&&(
                  <div className="font-mono text-[14px] font-bold" style={{color:myBalance>0?"var(--green)":"var(--red)"}}>
                    {myBalance>0?`+$${myBalance}`:`-$${Math.abs(myBalance)}`}
                  </div>
                )}
                <button
                  onClick={e=>{ e.stopPropagation(); handleDeleteFoursome(group.id, group.name); }}
                  className="font-display text-[10px] tracking-[2px] px-2.5 py-[3px] bg-transparent border border-[#4a1010] text-red rounded-[3px] cursor-pointer min-h-[28px]">
                  DELETE
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {group.memberIds.map(id=>{
                const p=getPlayer(id); const thru=p?holesPlayed(p):0;
                return p?(
                  <span key={id} className="text-[11px] text-t2 bg-bg3 border border-border rounded-[4px] px-2 py-[3px]">
                    {p.name.split(" ")[0]} {thru===18?"✓":`(${thru})`}
                  </span>
                ):null;
              })}
            </div>
          </div>
        );
      })}

      {activePlayer && (
        <div className="mt-5 text-center">
          <button className="btn-ghost text-[11px] px-5 py-2 tracking-[2px]"
            onClick={()=>{ setDetailGroup(null); setBetPlayers([]); setStep("addbet"); }}>
            + ADD SOLO BET
          </button>
        </div>
      )}

      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={()=>setConfirmState(null)}
          danger={confirmState.destructive}
        />
      )}
    </div>
  );

  // ── CREATE VIEW ──────────────────────────────────────────────────────────
  if (step === "create") return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-2.5 mb-6">
        <button onClick={()=>setStep("list")} className="bg-transparent border-none text-t3 text-lg cursor-pointer">←</button>
        <div className="font-display text-[22px] tracking-[2px]">CREATE GROUP</div>
      </div>
      <div className="card p-6 flex flex-col gap-4">
        <div>
          <div className="section-label">GROUP NAME</div>
          <input value={gName} onChange={e=>setGName(e.target.value)} placeholder="e.g. Saturday Foursome" className="w-full"/>
        </div>
        <div>
          <div className="section-label mb-2">SELECT PLAYERS ({gMembers.length}/4)</div>
          <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
            {players.filter(p=>p.memberType!=="amateur").map(p=>{
              const sel=gMembers.includes(p.id);
              return (
                <div key={p.id}
                  onClick={()=>toggleMember(p.id)}
                  className="flex justify-between items-center px-3.5 py-2.5 rounded-[6px] cursor-pointer min-h-[44px]"
                  style={{background:sel?"#0a1a0a":"var(--bg3)",border:`1px solid ${sel?"var(--green)":"var(--border)"}`}}>
                  <span className="text-[14px]" style={{color:sel?"var(--green)":"var(--text2)"}}>{p.name}</span>
                  <span className="text-[11px] text-t3">HCP {p.handicap}</span>
                </div>
              );
            })}
          </div>
        </div>
        <button className="btn-gold w-full py-3 text-[14px]" onClick={handleCreate} disabled={!gName.trim()||gMembers.length<2}>
          CREATE GROUP →
        </button>
      </div>
    </div>
  );

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (step === "detail" && detailGroup) {
    const bets = groupBetsFor(detailGroup);
    const allPids = detailGroup.memberIds;
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-5">
          <button onClick={()=>setStep("list")} className="bg-transparent border-none text-t3 text-lg cursor-pointer">←</button>
          <div>
            <div className="font-display text-[22px] tracking-[2px]">{detailGroup.name}</div>
            <div className="text-[12px] text-t3">{allPids.map(id=>getPlayer(id)?.name||"?").join(" · ")}</div>
          </div>
        </div>

        {/* Score table — scrollable on mobile */}
        <div
          className="-mx-4 md:mx-0 overflow-x-auto border border-border rounded-lg mb-5"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div style={{ minWidth: 360 }}>
            <div
              className="grid bg-bg3 px-3.5 py-2 font-display text-[10px] tracking-[2px] text-t3"
              style={{ gridTemplateColumns: "1fr 60px 70px 70px" }}
            >
              <span>PLAYER</span>
              <span className="text-center">THRU</span>
              <span className="text-center">GROSS</span>
              <span className="text-center">NET</span>
            </div>
            {allPids.map((pid,idx)=>{
              const p=getPlayer(pid); if(!p)return null;
              const net=calcNet(p,pars,course), gross=calcGrossToPar(p,pars), thru=holesPlayed(p);
              return (
                <div key={pid}
                  className="grid px-3.5 py-3 border-b border-border last:border-b-0"
                  style={{
                    gridTemplateColumns: "1fr 60px 70px 70px",
                    borderLeft: idx===0 ? "3px solid var(--gold)" : "3px solid transparent",
                  }}>
                  <div className="text-[15px] font-semibold text-text">{p.name}</div>
                  <div className="text-center text-[14px]" style={{color:thru===18?"var(--green)":"var(--text)"}}>{thru===18?"F":thru||"—"}</div>
                  <div className="text-center font-mono text-[14px] text-t3">{toPM(gross)}</div>
                  <div className="text-center font-mono text-[16px] font-bold" style={{color:net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"}}>{toPM(net)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mb-3.5">
          <div className="font-display text-[11px] tracking-[3px] text-t3">── BETS ({bets.length})</div>
          <button className="btn-gold text-[11px] py-[7px] px-4 tracking-[2px]"
            onClick={()=>{ setBetPlayers([...allPids]); setStep("addbet"); }}>
            + ADD BET
          </button>
        </div>
        {bets.length===0 && (
          <div className="p-6 text-center bg-bg2 border border-border rounded-lg mb-4">
            <div className="text-[13px] text-t3">No bets yet.</div>
          </div>
        )}
        {bets.map(bet=><BetCard key={bet.id} bet={bet}/>)}
        {bets.length>0&&<SettlementSummary bets={bets} pids={allPids}/>}
      </div>
    );
  }

  // ── ADD BET VIEW ─────────────────────────────────────────────────────────
  if (step === "addbet") return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-2.5 mb-6">
        <button onClick={()=>setStep(detailGroup?"detail":"list")} className="bg-transparent border-none text-t3 text-lg cursor-pointer">←</button>
        <div className="font-display text-[22px] tracking-[2px]">ADD BET</div>
      </div>
      <div className="card p-6 flex flex-col gap-4">
        <div>
          <div className="section-label mb-2">BET TYPE</div>
          <div className="grid grid-cols-2 gap-2">
            {[["fullround","Full Round"],["front9","Front 9"],["back9","Back 9"],["ctp","Closest to Pin"]].map(([val,label])=>(
              <button key={val} onClick={()=>setBetType(val)}
                className="py-2.5 px-2 font-display text-[13px] tracking-[1px] rounded-[6px] cursor-pointer min-h-[44px]"
                style={{
                  background: betType===val ? "var(--green-dim)" : "var(--bg3)",
                  border: `1px solid ${betType===val?"var(--green)":"var(--border)"}`,
                  color: betType===val ? "var(--green)" : "var(--text2)",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {betType!=="ctp" && (
          <div>
            <div className="section-label mb-2">SCORE TYPE</div>
            <div className="grid grid-cols-2 gap-2">
              {[["net","Net"],["gross","Gross"]].map(([val,label])=>(
                <button key={val} onClick={()=>setBetScore(val)}
                  className="py-2.5 font-display text-[13px] tracking-[1px] rounded-[6px] cursor-pointer min-h-[44px]"
                  style={{
                    background: betScore===val ? "#0a1a0a" : "var(--bg3)",
                    border: `1px solid ${betScore===val?"var(--gold)":"var(--border)"}`,
                    color: betScore===val ? "var(--gold)" : "var(--text2)",
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {betType==="ctp" && (
          <div>
            <div className="section-label mb-2">PAR 3 HOLE</div>
            <div className="flex gap-2 flex-wrap">
              {par3s.map(hi=>(
                <button key={hi} onClick={()=>setBetHole(hi.toString())}
                  className="w-11 h-11 font-display text-[16px] rounded-[6px] cursor-pointer"
                  style={{
                    background: betHole===hi.toString() ? "var(--gold)" : "var(--bg3)",
                    border: `1px solid ${betHole===hi.toString()?"var(--gold)":"var(--border)"}`,
                    color: betHole===hi.toString() ? "#060a06" : "var(--text2)",
                  }}>
                  {hi+1}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="section-label">AMOUNT PER PLAYER ($)</div>
          <input type="number" value={betAmount} onChange={e=>setBetAmount(e.target.value)}
            placeholder="e.g. 5" min="1" className="w-full text-[18px] text-center"/>
        </div>

        <div>
          <div className="section-label mb-2">PLAYERS IN BET ({betPlayers.length} selected)</div>
          <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
            {players.filter(p=>p.memberType!=="amateur").map(p=>{
              const sel=betPlayers.includes(p.id);
              return (
                <div key={p.id}
                  onClick={()=>setBetPlayers(prev=>sel?prev.filter(x=>x!==p.id):[...prev,p.id])}
                  className="flex justify-between items-center px-3.5 py-2.5 rounded-[6px] cursor-pointer min-h-[44px]"
                  style={{
                    background: sel ? "#0a1200" : "var(--bg3)",
                    border: `1px solid ${sel?"var(--gold)":"var(--border)"}`,
                  }}>
                  <span className="text-[14px]" style={{color:sel?"var(--gold)":"var(--text2)"}}>{p.name}</span>
                  <span className="text-[11px] text-t3">HCP {p.handicap}</span>
                </div>
              );
            })}
          </div>
        </div>

        {betErr && (
          <div className="text-[13px] text-red bg-[#2a0808] border border-[#4a1010] px-3.5 py-2.5 rounded-[4px]">{betErr}</div>
        )}
        <button className="btn-gold w-full py-3.5 text-[14px]" onClick={handleAddBet}>ADD BET →</button>
      </div>
    </div>
  );

  return null;
}

import React from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { TOURNAMENT_ID, HCP_STROKES, DEFAULT_PAR, DEFAULT_YARDS } from "../constants";
import { calcNet, toPM, holesPlayed, scoreLabel } from "../lib/scoring";
import { usePlayers } from "../contexts/PlayersContext";
import { useTournament } from "../contexts/TournamentContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourse } from "../contexts/CourseContext";
import CtpDistanceEntry from "../components/CtpDistanceEntry";
import ScorecardUpload from "../components/ScorecardUpload";

export default function MyScores({ activeHole, setActiveHole, updateScore, notify, setScreen }) {
  const { players, scorecardUploads } = usePlayers();
  const { ctpBets } = useTournament();
  const { activePlayer, setActivePlayer } = useAuth();
  const { course } = useCourse();

  const pars  = (Array.isArray(course?.par)   && course.par.length===18)   ? course.par   : DEFAULT_PAR;
  const yards = (Array.isArray(course?.yards)  && course.yards.length===18) ? course.yards : DEFAULT_YARDS;

  if (!activePlayer) { setScreen("my-scores-login"); return null; }
  const player = players.find(p=>p.id===activePlayer);
  if (!player) { setScreen("my-scores-login"); return null; }

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

      {par === 3 && (() => {
        const ctpKey = `hole_${activeHole}`;
        const ctpBet = ctpBets[ctpKey];
        const myEntry = ctpBet?.entries?.[player.id];

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

        if (myEntry?.lockedIn) return (
          <div style={{marginBottom:12,padding:"14px 16px",background:"#120e00",border:"1px solid var(--gold-dim)",borderRadius:6}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--gold)",marginBottom:10}}>📍 CTP — HOLE {activeHole+1} · ENTER YOUR DISTANCE</div>
            <CtpDistanceEntry player={player} holeIdx={activeHole} ctpBet={ctpBet} notify={notify} />
          </div>
        );

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

      <ScorecardUpload player={player} upload={scorecardUploads[player.id]} notify={notify} />

      <div style={{textAlign:"center",marginTop:14}}>
        <span style={{fontSize:12,color:"var(--text3)",cursor:"pointer"}} onClick={()=>setScreen("leaderboard")}>← Back to Leaderboard</span>
      </div>
    </div>
  );
}

import React from "react";

export default function CtpLeaderboard({ ctpBets, pars, players }) {
  const par3Holes = pars.map((p, i) => p === 3 ? i : -1).filter(i => i !== -1);
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
          .filter(([, e]) => e.feet !== undefined)
          .sort(([, a], [, b]) => a.totalInches - b.totalInches);
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
                  {idx===0?"🏆":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                </span>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600}}>{entry.playerName}</div>
                </div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:18,color:idx===0?"var(--gold)":"var(--text2)"}}>
                  {entry.feet}'{entry.inches}"
                </div>
              </div>
            ))}
            {Object.entries(bet.entries||{}).filter(([,e]) => e.lockedIn && e.feet===undefined).map(([pid]) => (
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
}

import React from "react";

export default function LeaderboardTable({ players, pars, scorecardUploads, calcNet, calcGrossToPar, holesPlayed, toPM, setSelectedPid, setScreen, course }) {
  return (
    <div style={{marginBottom:32}}>
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"48px 1fr 60px 72px 72px 72px 52px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
          <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>THRU</span>
          <span style={{textAlign:"center"}}>GROSS</span><span style={{textAlign:"center"}}>+/- PAR</span>
          <span style={{textAlign:"center"}}>NET</span><span style={{textAlign:"center"}}>HCP</span>
        </div>
        {players.map((player, idx) => {
          const net = calcNet(player, pars, course), gross = calcGrossToPar(player, pars), thru = holesPlayed(player);
          const rawGross = player.scores.slice(0, thru).filter(Boolean).reduce((a, b) => a + b, 0);
          const lead = idx === 0 && net !== null;
          return (
            <div key={player.id} className="player-row"
              style={{display:"grid",gridTemplateColumns:"48px 1fr 60px 72px 72px 72px 52px",padding:"12px 16px",alignItems:"center",
                borderLeft:lead?"3px solid var(--gold)":"3px solid transparent"}}
              onClick={() => { setSelectedPid(player.id); setScreen("scorecard"); }}>
              <span style={{fontFamily:"'Bebas Neue'",fontSize:20,color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
              </span>
              <div>
                <div style={{fontSize:15,color:lead?"var(--text)":"var(--text2)",fontWeight:600,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  {player.name}
                  {holesPlayed(player)>0 && !scorecardUploads[player.id]?.url && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--amber)",border:"1px solid var(--amber)",borderRadius:2,padding:"1px 4px"}}>UNVERIFIED</span>}
                  {scorecardUploads[player.id]?.url && !scorecardUploads[player.id]?.verified && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--gold)",border:"1px solid var(--gold-dim)",borderRadius:2,padding:"1px 4px"}}>PENDING ⏳</span>}
                  {scorecardUploads[player.id]?.verified && <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1,color:"var(--green)",border:"1px solid var(--green-dim)",borderRadius:2,padding:"1px 4px"}}>✓ VERIFIED</span>}
                </div>
                <div style={{fontSize:10,color:"var(--text3)"}}>{`HCP ${player.handicap}`}</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:14,color:thru===18?"var(--green)":"var(--text)"}}>{thru===18?"F":thru||"—"}</div>
                <div style={{fontSize:9,color:"var(--text3)",letterSpacing:1}}>{thru===18?"FINAL":thru>0?"THRU":"—"}</div>
              </div>
              <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:15,color:"var(--text3)"}}>{rawGross||"—"}</div>
              <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:15,color:gross>0?"var(--amber)":gross<0?"var(--gold)":"var(--text)"}}>{gross!==null?toPM(gross):"—"}</div>
              <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:18,fontWeight:700,color:net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"}}>{toPM(net)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

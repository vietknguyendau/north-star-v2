import React from "react";
import { usePlayers } from "../contexts/PlayersContext";
import { useTournament } from "../contexts/TournamentContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourse } from "../contexts/CourseContext";
import { calcNet, calcGrossToPar, toPM, holesPlayed } from "../lib/scoring";
import { calcHoleRange } from "../lib/handicap";
import { DEFAULT_PAR } from "../constants";
import LeaderboardTable from "../components/LeaderboardTable";
import FoursomeView from "./FoursomeView";

export default function LeaderboardScreen({ setSelectedPid, setScreen, notify }) {
  const { players, scorecardUploads } = usePlayers();
  const { activeOneOff } = useTournament();
  const { course } = useCourse();
  const [lbTab, setLbTab] = React.useState("individual");

  const pars = (Array.isArray(course?.par) && course.par.length===18) ? course.par : DEFAULT_PAR;

  const sortedFlight = () => {
    const base = players.filter(p => p.memberType !== "amateur");
    return [...base].sort((a,b)=>{
      const an=calcNet(a,pars,course), bn=calcNet(b,pars,course);
      if(an===null&&bn===null)return 0;
      if(an===null)return 1; if(bn===null)return -1;
      return an!==bn ? an-bn : holesPlayed(b)-holesPlayed(a);
    });
  };

  const oneOffPlayers = activeOneOff
    ? (activeOneOff.hasPassword
        ? players.filter(p => p.oneOffId === activeOneOff.id && p.scores?.some(Boolean))
        : players.filter(p => p.scores?.some(Boolean)))
    : [];
  const oneOffRows = oneOffPlayers
    .map(p => {
      const result = calcHoleRange(p.scores, p.handicap, course, pars);
      return { ...p, gross: result?.gross||0, net: result?.net||0, thru: result?.thru||0 };
    })
    .sort((a,b) => a.net - b.net);

  return (
    <div className="fade-up">
      <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:"1px solid var(--border)"}}>
        {[["individual","👤 INDIVIDUAL"],["groups","🤝 GROUPS"]].map(([val,label])=>(
          <div key={val}
            onClick={()=>setLbTab(val)}
            style={{padding:"10px 20px",fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,cursor:"pointer",
              color:lbTab===val?"var(--gold)":"var(--text3)",
              borderBottom:lbTab===val?"2px solid var(--gold)":"2px solid transparent",
              marginBottom:-1,transition:"all 0.15s"}}>
            {label}
          </div>
        ))}
      </div>

      {lbTab === "groups" && <FoursomeView notify={notify} />}

      {lbTab === "individual" && <>
        {activeOneOff && (
          <div style={{marginBottom:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>
                <span style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)"}}>LIVE NOW</span>
              </div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2,color:"var(--text)"}}>{activeOneOff.title}</div>
              {activeOneOff.course && <div style={{fontSize:12,color:"var(--text3)"}}>📍 {activeOneOff.course}</div>}
              {activeOneOff.hasPassword && <span style={{fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,border:"1px solid var(--border2)",borderRadius:2,padding:"1px 6px"}}>🔒 INVITE ONLY</span>}
            </div>

            {oneOffRows.length === 0 ? (
              <div style={{padding:"24px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:6,textAlign:"center",color:"var(--text3)",fontSize:13,fontStyle:"italic"}}>
                Waiting for players to enter scores…
              </div>
            ) : (
              <div style={{background:"var(--bg2)",border:"1px solid var(--green-dim)",borderRadius:6,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"52px 1fr 60px 80px 80px 60px",background:"var(--bg3)",padding:"9px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
                  <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>THRU</span>
                  <span style={{textAlign:"center"}}>GROSS</span><span style={{textAlign:"center"}}>NET</span><span style={{textAlign:"center"}}>HCP</span>
                </div>
                {oneOffRows.map((p, idx) => (
                  <div key={p.id} className="player-row"
                    style={{display:"grid",gridTemplateColumns:"52px 1fr 60px 80px 80px 60px",padding:"12px 16px",alignItems:"center",
                      borderLeft:idx===0?"3px solid var(--green)":"3px solid transparent"}}
                    onClick={()=>{ setSelectedPid(p.id); setScreen("scorecard"); }}>
                    <span style={{fontFamily:"'Bebas Neue'",fontSize:20,color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                      {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                    </span>
                    <div>
                      <div style={{fontSize:16,fontWeight:600,color:idx===0?"var(--text)":"var(--text2)"}}>{p.name}</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:15,color:p.thru===18?"var(--green)":"var(--text)"}}>{p.thru===18?"F":p.thru||"—"}</div>
                      <div style={{fontSize:10,color:"var(--text3)",letterSpacing:1}}>{p.thru===18?"FINAL":p.thru>0?"THRU":"—"}</div>
                    </div>
                    <div style={{textAlign:"center",fontSize:16,color:p.gross>0?"var(--amber)":p.gross<0?"var(--gold)":"var(--text)"}}>{p.gross||"—"}</div>
                    <div style={{textAlign:"center",fontSize:22,fontWeight:700,color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>{toPM(p.net)}</div>
                    <div style={{textAlign:"center",fontSize:13,color:"var(--text3)"}}>{p.handicap}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{borderTop:"1px solid var(--border)",marginTop:24,paddingTop:20}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--text3)",marginBottom:12}}>── SEASON LEADERBOARD</div>
            </div>
          </div>
        )}

        <LeaderboardTable
          players={sortedFlight()}
          pars={pars}
          scorecardUploads={scorecardUploads}
          calcNet={calcNet}
          calcGrossToPar={calcGrossToPar}
          holesPlayed={holesPlayed}
          toPM={toPM}
          setSelectedPid={setSelectedPid}
          setScreen={setScreen}
          course={course}
        />
        {players.filter(p=>p.memberType!=="amateur").length===0 && (
          <div style={{textAlign:"center",padding:"60px 20px",color:"var(--text3)"}}>
            <div style={{fontSize:36,marginBottom:12}}>⛳</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,marginBottom:8}}>NO PLAYERS YET</div>
          </div>
        )}
      </>}

      {lbTab === "individual" && players.filter(p=>p.memberType==="amateur").length > 0 && (
        <div style={{marginTop:32}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--text3)",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span>── AMATEUR MEMBERS</span>
            <button style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",borderRadius:3,padding:"2px 10px",cursor:"pointer"}}
              onClick={()=>setScreen("amateurs")}>VIEW ALL →</button>
          </div>
          <div className="card" style={{overflow:"hidden"}}>
            {players.filter(p=>p.memberType==="amateur").map((p,idx)=>(
              <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",borderBottom:"1px solid var(--border)"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontFamily:"'Bebas Neue'",fontSize:16,color:"var(--text3)",minWidth:28}}>{idx+1}</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--text2)"}}>{p.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</div>
                  </div>
                </div>
                <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--gold)",border:"1px solid #c8a84a44",borderRadius:3,padding:"2px 8px"}}>AMATEUR</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

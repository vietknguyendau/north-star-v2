import React from "react";
import { usePlayers } from "../contexts/PlayersContext";

export default function AmateursView({ setScreen }) {
  const { players } = usePlayers();
  const amateurs = players.filter(p => p.memberType === "amateur");
  const leagueMembers = players.filter(p => p.memberType !== "amateur").sort((a,b)=>a.name.localeCompare(b.name));
  const spotsLeft = 32 - leagueMembers.length;

  return (
    <div className="fade-up" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:5,color:"var(--green)",marginBottom:6}}>NORTH STAR AMATEUR SERIES · 2026</div>
        <h2 style={{fontFamily:"'Bebas Neue'",fontSize:36,letterSpacing:2,marginBottom:8}}>MEMBER ROSTER</h2>
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div style={{fontSize:13,color:"var(--text3)"}}>{leagueMembers.length} of 32 league spots filled</div>
          <div style={{height:6,flex:1,minWidth:120,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${(leagueMembers.length/32)*100}%`,background:"var(--green)",borderRadius:3}}/>
          </div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:13,color:spotsLeft>0?"var(--amber)":"var(--red)",letterSpacing:1}}>
            {spotsLeft>0?`${spotsLeft} SPOTS LEFT`:"FULL"}
          </div>
        </div>
      </div>

      <div style={{marginBottom:32}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:12}}>
          ── LEAGUE MEMBERS ({leagueMembers.length})
        </div>
        {leagueMembers.length === 0 ? (
          <div style={{padding:"32px 20px",textAlign:"center",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8}}>
            <div style={{fontSize:32,marginBottom:10}}>⛳</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,marginBottom:6}}>NO MEMBERS YET</div>
            <div style={{fontSize:13,color:"var(--text3)"}}>Registration is open — share the league password to get players signed up.</div>
          </div>
        ) : (
          <div className="card" style={{overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"40px 1fr 70px 110px",background:"var(--bg3)",padding:"8px 16px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
              <span>#</span><span>NAME</span><span style={{textAlign:"center"}}>HCP</span><span style={{textAlign:"center"}}>SKILL</span>
            </div>
            {leagueMembers.map((p, idx) => (
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"40px 1fr 70px 110px",padding:"13px 16px",borderBottom:"1px solid var(--border)",alignItems:"center"}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:16,color:"var(--text3)"}}>{idx+1}</div>
                <div>
                  <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>{p.name}</div>
                  {p.email && <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{p.email}</div>}
                </div>
                <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:15,color:"var(--text)"}}>{p.handicap}</div>
                <div style={{textAlign:"center"}}>
                  <span style={{fontFamily:"'Bebas Neue'",fontSize:9,letterSpacing:1,color:"var(--text3)",border:"1px solid var(--border2)",borderRadius:3,padding:"2px 7px"}}>{p.flight||"—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--gold)",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>── AMATEUR MEMBERS ({amateurs.length})</span>
          <button className="btn-ghost btn-sm" style={{fontSize:10,letterSpacing:1}}
            onClick={()=>setScreen("amateur-register")}>
            + JOIN AS AMATEUR
          </button>
        </div>
        {amateurs.length === 0 ? (
          <div style={{padding:"20px",textAlign:"center",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8}}>
            <div style={{fontSize:13,color:"var(--text3)"}}>No amateur members yet.</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {amateurs.map((p, idx) => (
              <div key={p.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:16,color:"var(--text3)",minWidth:28}}>{idx+1}</div>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{p.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</div>
                  </div>
                </div>
                <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--gold)",border:"1px solid #c8a84a44",borderRadius:3,padding:"2px 8px"}}>AMATEUR</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

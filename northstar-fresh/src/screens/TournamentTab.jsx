import React from "react";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { TOURNAMENT_ID, DEFAULT_PAR } from "../constants";
import { hashPin, holesPlayed, toPM } from "../lib/scoring";
import { calcHoleRange } from "../lib/handicap";
import { usePlayers } from "../contexts/PlayersContext";
import { useTournament } from "../contexts/TournamentContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourse } from "../contexts/CourseContext";
import PinKeypad from "../components/PinKeypad";

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;

export default function TournamentTab({ activeHole, setActiveHole, setScreen, notify }) {
  const { players } = usePlayers();
  const { activeOneOff, activeOnOffs, oneOffTournaments } = useTournament();
  const { setActivePlayer } = useAuth();
  const { course } = useCourse();

  const pars = (Array.isArray(course?.par) && course.par.length===18) ? course.par : DEFAULT_PAR;

  const [tabStep, setTabStep]           = React.useState("list");
  const [selTourney, setSelTourney]     = React.useState(null);
  const [tLoginPid, setTLoginPid]       = React.useState("");
  const [tLoginPin, setTLoginPin]       = React.useState("");
  const [tLoginErr, setTLoginErr]       = React.useState("");
  const [tPwInput,  setTPwInput]        = React.useState("");
  const [tPwErr,    setTPwErr]          = React.useState("");
  const [tLogging,  setTLogging]        = React.useState(false);
  const [tStep,     setTStep]           = React.useState("name");
  const [showPlayers, setShowPlayers]   = React.useState(false);
  const [expandedTourney, setExpandedTourney] = React.useState(null);

  const selectedPlayer = players.find(p=>p.id===tLoginPid);

  const handleTLogin = async () => {
    if (!selectedPlayer) return;
    setTLogging(true);
    const isAdmin = tLoginPin === ADMIN_PIN;
    const hash = isAdmin ? null : await hashPin(tLoginPin);
    if (!isAdmin && hash !== selectedPlayer.pinHash) {
      setTLoginErr("Incorrect PIN. Try again.");
      setTLogging(false);
      setTLoginPin("");
      return;
    }
    setTLogging(false);
    if (selTourney?.hasPassword && selectedPlayer.oneOffId !== selTourney.id) {
      setTStep("password");
    } else {
      setActivePlayer(selectedPlayer.id);
      setActiveHole(Math.max(0, holesPlayed(selectedPlayer)-1)||0);
      setScreen("tournament-scores");
    }
  };

  const handleJoinWithPassword = async () => {
    if (!tPwInput.trim()) { setTPwErr("Enter the tournament password."); return; }
    const pwHash = await hashPin(tPwInput.trim());
    if (pwHash !== selTourney.pwHash) { setTPwErr("Incorrect password."); return; }
    await updateDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",selectedPlayer.id),{oneOffId:selTourney.id});
    notify(`Joined "${selTourney.title}"! 🏌️`);
    setActivePlayer(selectedPlayer.id);
    setActiveHole(Math.max(0, holesPlayed(selectedPlayer)-1)||0);
    setScreen("tournament-scores");
  };

  const TourneyLeaderboard = ({ t }) => {
    const joined = t.hasPassword
      ? players.filter(p=>p.oneOffId===t.id && p.scores?.some(Boolean))
      : players.filter(p=>p.scores?.some(Boolean));
    const rows = joined.map(p=>{
      const result = calcHoleRange(p.scores, p.handicap, course, pars);
      const gross = result?.gross || 0;
      const net = result ? result.net : 0;
      const thru = result?.thru || 0;
      return {...p, gross, net, thru};
    }).sort((a,b)=>a.net-b.net);
    if (!rows.length) return (
      <div style={{padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:13,fontStyle:"italic"}}>
        No scores yet — be the first on the board.
      </div>
    );
    return (
      <div style={{borderRadius:6,overflow:"hidden",border:"1px solid var(--border)"}}>
        <div style={{display:"grid",gridTemplateColumns:"44px 1fr 48px 58px 62px 68px",background:"var(--bg3)",padding:"8px 14px",fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>
          <span>POS</span><span>PLAYER</span><span style={{textAlign:"center"}}>THRU</span>
          <span style={{textAlign:"center"}}>GROSS</span><span style={{textAlign:"center"}}>+/-</span><span style={{textAlign:"center"}}>NET</span>
        </div>
        {rows.map((p,idx)=>{
          const parThru = pars.slice(0,p.thru).reduce((a,b)=>a+b,0);
          const overPar = p.thru>0 ? p.gross - parThru : null;
          return (
          <div key={p.id} style={{display:"grid",gridTemplateColumns:"44px 1fr 48px 58px 62px 68px",padding:"11px 14px",borderBottom:"1px solid var(--border)",
            borderLeft:idx===0?"3px solid var(--green)":"3px solid transparent"}}>
            <span style={{fontFamily:"'Bebas Neue'",fontSize:18,color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
              {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
            </span>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:"var(--text2)"}}>{p.name}</div>
              <div style={{fontSize:10,color:"var(--text3)"}}>HCP {p.handicap}</div>
            </div>
            <div style={{textAlign:"center",fontSize:14,color:p.thru===18?"var(--green)":"var(--text)"}}>{p.thru===18?"F":p.thru||"—"}</div>
            <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:14,color:"var(--text3)"}}>{p.gross||"—"}</div>
            <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:14,color:overPar>0?"var(--amber)":overPar<0?"var(--gold)":"var(--text)"}}>{overPar!==null?toPM(overPar):"—"}</div>
            <div style={{textAlign:"center",fontFamily:"'DM Mono'",fontSize:16,fontWeight:700,color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>{toPM(p.net)}</div>
          </div>
          );
        })}
      </div>
    );
  };

  const PlayerRoster = ({ t, isLive }) => {
    const joined = isLive
      ? (t.hasPassword ? players.filter(p=>p.oneOffId===t.id) : players)
      : (t.snapshot || []);
    if (!joined.length) return (
      <div style={{padding:"16px",textAlign:"center",color:"var(--text3)",fontSize:13,fontStyle:"italic"}}>No players yet.</div>
    );
    const rows = isLive
      ? joined.map(p=>{
          const result = calcHoleRange(p.scores || [], p.handicap, course, pars);
          return {...p, gross: result?.gross||0, net: result?.net||0, thru: result?.thru||0};
        }).sort((a,b)=>a.net-b.net)
      : joined.map(p=>({...p,thru:p.scores?.filter(Boolean).length||18})).sort((a,b)=>a.net-b.net);

    const scoreColor = (s, par) => {
      if (!s) return "var(--text3)";
      const d = s - par;
      if (d <= -2) return "var(--gold)";
      if (d === -1) return "var(--green-bright)";
      if (d === 0)  return "var(--text)";
      if (d === 1)  return "var(--amber)";
      return "var(--red)";
    };

    return (
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {rows.map((p, idx) => {
          const hasScores = p.scores?.some(Boolean);
          return (
            <div key={p.id} style={{background:"var(--bg3)",border:`1px solid ${idx===0?"var(--green-dim)":"var(--border)"}`,borderRadius:8,overflow:"hidden"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:hasScores?"1px solid var(--border)":"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontFamily:"'Bebas Neue'",fontSize:20,color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)",minWidth:36}}>
                    {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                  </span>
                  <div>
                    <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>{p.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap} · Thru {p.thru===18?"F (Final)":p.thru||"—"}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:16,alignItems:"center"}}>
                  {p.gross > 0 && <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"'DM Mono'",fontSize:16,color:"var(--text3)"}}>{p.gross}</div>
                    <div style={{fontSize:9,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>GROSS</div>
                  </div>}
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"'DM Mono'",fontSize:20,fontWeight:700,color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>{p.net!==0||p.thru>0?toPM(p.net):"—"}</div>
                    <div style={{fontSize:9,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>NET</div>
                  </div>
                </div>
              </div>
              {hasScores && (
                <div style={{overflowX:"auto",padding:"10px 12px"}}>
                  <div style={{display:"flex",gap:4,minWidth:"max-content"}}>
                    {p.scores.map((s, hi) => (
                      <div key={hi} style={{textAlign:"center",minWidth:28}}>
                        <div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Bebas Neue'",marginBottom:2}}>{hi+1}</div>
                        <div style={{width:28,height:28,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:13,fontFamily:"'DM Mono'",fontWeight:600,
                          background:s?"var(--bg4)":"transparent",
                          color:s?scoreColor(s,pars[hi]):"var(--border2)",
                          border:s?`1px solid ${scoreColor(s,pars[hi])}44`:"1px solid var(--border)"}}>
                          {s||"·"}
                        </div>
                        <div style={{fontSize:8,color:"var(--text3)",marginTop:2}}>{pars[hi]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!hasScores && isLive && (
                <div style={{padding:"8px 16px",fontSize:11,color:"var(--text3)",fontStyle:"italic"}}>No scores entered yet</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // LOGIN VIEW for a specific tournament
  if (tabStep === "login" && selTourney) {
    return (
      <div className="fade-up" style={{maxWidth:420,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <button onClick={()=>{setTabStep("list");setTStep("name");setTLoginPid("");setTLoginPin("");setTLoginErr("");setTPwInput("");setTPwErr("");}}
            style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
          <div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:selTourney.isActive?"var(--green)":"var(--text3)"}}>
              {selTourney.isActive?"🟢 IN PROGRESS":"⛳ TOURNAMENT"}
            </div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2}}>{selTourney.title}</div>
            <div style={{fontSize:12,color:"var(--text3)"}}>{selTourney.date}{selTourney.course?` · ${selTourney.course}`:""}</div>
          </div>
        </div>

        {tStep === "name" && (
          <div className="card" style={{padding:28}}>
            <div className="section-label" style={{marginBottom:8}}>YOUR NAME</div>
            <select value={tLoginPid} onChange={e=>{setTLoginPid(e.target.value);setTLoginErr("");}}
              style={{width:"100%",padding:"10px 12px",fontSize:15,background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:tLoginPid?"var(--text)":"var(--text3)",marginBottom:20}}>
              <option value="">Select your name...</option>
              {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
              disabled={!tLoginPid} onClick={()=>setTStep("pin")}>
              CONTINUE →
            </button>
          </div>
        )}

        {tStep === "pin" && (
          <div className="card" style={{padding:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button onClick={()=>{setTStep("name");setTLoginPin("");setTLoginErr("");}}
                style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2}}>{selectedPlayer?.name}</div>
            </div>
            <div className="section-label" style={{marginBottom:8}}>YOUR PIN</div>
            <PinKeypad
              pin={tLoginPin}
              onChange={v => { setTLoginPin(v); setTLoginErr(""); }}
              error={tLoginErr}
              onSubmit={handleTLogin}
              disabled={tLogging}
              submitLabel={tLogging ? "..." : "VERIFY PIN →"}
            />
          </div>
        )}

        {tStep === "password" && (
          <div className="card" style={{padding:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button onClick={()=>{setTStep("pin");setTLoginPin("");setTPwInput("");setTPwErr("");}}
                style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer"}}>←</button>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2}}>{selectedPlayer?.name}</div>
            </div>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:32,marginBottom:8}}>🔒</div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,marginBottom:6}}>{selTourney.title}</div>
              <div style={{fontSize:13,color:"var(--text3)"}}>This tournament is invite-only. Enter the password your commissioner shared with you.</div>
            </div>
            <input value={tPwInput} onChange={e=>{setTPwInput(e.target.value);setTPwErr("");}}
              placeholder="Tournament password" style={{width:"100%",fontSize:15,marginBottom:8}}/>
            {tPwErr && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"8px 12px",borderRadius:4,marginBottom:12}}>{tPwErr}</div>}
            <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
              onClick={handleJoinWithPassword} disabled={!tPwInput.trim()}>
              JOIN TOURNAMENT →
            </button>
          </div>
        )}
      </div>
    );
  }

  // FULL LEADERBOARD VIEW
  if (tabStep === "leaderboard" && selTourney) {
    const isLive = !!selTourney.isActive;
    return (
      <div className="fade-up">
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>{ setTabStep("list"); setSelTourney(null); setShowPlayers(false); }}
            style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:22,cursor:"pointer"}}>←</button>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              {isLive && <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>}
              <span style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:isLive?"var(--green)":"var(--text3)"}}>
                {isLive?"LIVE · IN PROGRESS":"FINAL RESULTS"}
              </span>
            </div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:2,lineHeight:1}}>{selTourney.title}</div>
            <div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>
              {selTourney.date}{selTourney.course?` · ${selTourney.course}`:""}
              {selTourney.courseDetails?` · Par ${selTourney.courseDetails.par}`:""}
            </div>
          </div>
          {isLive && (
            <button className="btn-gold" style={{fontSize:12,padding:"9px 16px",letterSpacing:2,whiteSpace:"nowrap"}}
              onClick={()=>{ setTabStep("login"); setTStep("name"); }}>
              ENTER SCORES →
            </button>
          )}
        </div>
        <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid var(--border)"}}>
          {[["board","🏆 LEADERBOARD"],["players","👤 PLAYERS"]].map(([val,label])=>(
            <div key={val} onClick={()=>setShowPlayers(val==="players")}
              style={{padding:"9px 18px",fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:2,cursor:"pointer",
                color:((val==="players")===showPlayers)?"var(--gold)":"var(--text3)",
                borderBottom:((val==="players")===showPlayers)?"2px solid var(--gold)":"2px solid transparent",
                marginBottom:-1}}>
              {label}
            </div>
          ))}
        </div>
        {!showPlayers && <TourneyLeaderboard t={selTourney}/>}
        {showPlayers && <PlayerRoster t={selTourney} isLive={isLive}/>}
      </div>
    );
  }

  // LIST VIEW
  const activeTourneys = activeOnOffs.length > 0
    ? activeOnOffs
    : (activeOneOff ? [{ ...activeOneOff, isActive: true }] : []);
  const pastTourneys = oneOffTournaments;

  return (
    <div className="fade-up">
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:4,color:"var(--text3)",marginBottom:4}}>NORTH STAR AMATEUR SERIES</div>
        <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2,marginBottom:4}}>TOURNAMENTS</h2>
        <p style={{fontSize:13,color:"var(--text3)"}}>Tap any tournament to view the full leaderboard or enter scores.</p>
      </div>

      {activeTourneys.length > 0 && (
        <div style={{marginBottom:28}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>
            {activeTourneys.length} OPEN NOW
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {activeTourneys.map(t => {
              const tPlayers = t.hasPassword
                ? players.filter(p=>p.oneOffId===t.id && p.scores?.some(Boolean))
                : players.filter(p=>p.memberType!=="amateur" && p.scores?.some(Boolean));
              return (
                <div key={t.id} style={{background:"#060e06",border:"2px solid var(--green-dim)",borderRadius:10,overflow:"hidden"}}>
                  <div style={{padding:"18px 20px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:14}}>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"'Bebas Neue'",fontSize:24,letterSpacing:2,color:"var(--text)"}}>{t.title}</div>
                        <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>
                          {t.date}{t.course?` · ${t.course}`:""}
                          {t.courseDetails?` · Par ${t.courseDetails.par}`:""}
                        </div>
                        {t.notes && <div style={{fontSize:12,color:"var(--text2)",marginTop:4,fontStyle:"italic"}}>{t.notes}</div>}
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:6}}>{tPlayers.length} player{tPlayers.length!==1?"s":""} on the board</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                        {t.hasPassword && <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--text3)",border:"1px solid var(--border2)",borderRadius:3,padding:"2px 8px"}}>🔒 INVITE ONLY</span>}
                        <button className="btn-gold" style={{fontSize:12,padding:"9px 18px",letterSpacing:2}}
                          onClick={()=>{ setSelTourney(t); setTabStep("login"); setTStep("name"); }}>
                          ENTER SCORES →
                        </button>
                        <button style={{fontSize:11,padding:"6px 14px",fontFamily:"'Bebas Neue'",letterSpacing:2,
                          background:"transparent",border:"1px solid var(--green-dim)",borderRadius:4,color:"var(--green)",cursor:"pointer"}}
                          onClick={()=>{ setSelTourney(t); setTabStep("leaderboard"); setShowPlayers(false); }}>
                          VIEW LEADERBOARD →
                        </button>
                      </div>
                    </div>
                    <TourneyLeaderboard t={t}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTourneys.length === 0 && (
        <div style={{padding:"32px 20px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:10}}>⛳</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,marginBottom:6}}>NO ACTIVE TOURNAMENT</div>
          <div style={{fontSize:13,color:"var(--text3)"}}>Check back when the commissioner starts one.</div>
        </div>
      )}

      {pastTourneys.length > 0 && (
        <div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--text3)",marginBottom:12}}>── PAST TOURNAMENTS</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {pastTourneys.map(t => {
              const winner = t.snapshot?.[0];
              return (
                <div key={t.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,cursor:"pointer"}}
                  onClick={()=>{ setSelTourney(t); setTabStep("leaderboard"); setShowPlayers(false); }}>
                  <div style={{padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                    <div>
                      <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:1,color:"var(--text)"}}>{t.title}</div>
                      <div style={{fontSize:12,color:"var(--text3)"}}>{t.date}{t.course?` · ${t.course}`:""}</div>
                      {winner && <div style={{fontSize:12,color:"var(--gold)",marginTop:4}}>🏆 {winner.name} · Net {winner.net}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--text3)",border:"1px solid var(--border2)",borderRadius:3,padding:"2px 8px"}}>
                        {t.snapshot?.length||0} PLAYERS
                      </span>
                      <span style={{color:"var(--text3)",fontSize:18}}>›</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTourneys.length === 0 && pastTourneys.length === 0 && (
        <div style={{textAlign:"center",padding:"20px",color:"var(--text3)",fontSize:13}}>No tournaments yet.</div>
      )}
    </div>
  );
}

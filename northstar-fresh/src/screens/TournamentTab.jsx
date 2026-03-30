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
      <div className="py-5 text-center text-t3 text-[13px] italic">
        No scores yet — be the first on the board.
      </div>
    );
    return (
      <div
        className="-mx-4 md:mx-0 overflow-x-auto rounded-[6px] border border-border"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ minWidth: 380 }}>
          <div
            className="grid bg-bg3 px-3.5 py-2 font-display text-[10px] tracking-[2px] text-t3"
            style={{ gridTemplateColumns: "44px 1fr 48px 58px 62px 68px" }}
          >
            <span>POS</span><span>PLAYER</span>
            <span className="text-center">THRU</span>
            <span className="text-center">GROSS</span>
            <span className="text-center">+/-</span>
            <span className="text-center">NET</span>
          </div>
          {rows.map((p,idx)=>{
            const parThru = pars.slice(0,p.thru).reduce((a,b)=>a+b,0);
            const overPar = p.thru>0 ? p.gross - parThru : null;
            return (
              <div key={p.id}
                className="grid px-3.5 py-2.5 border-b border-border last:border-b-0 items-center"
                style={{
                  gridTemplateColumns: "44px 1fr 48px 58px 62px 68px",
                  borderLeft: idx===0 ? "3px solid var(--green)" : "3px solid transparent",
                }}>
                <span className="font-display text-[18px]" style={{color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                  {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                </span>
                <div>
                  <div className="text-[15px] font-semibold text-t2">{p.name}</div>
                  <div className="font-display text-[10px] text-t3">HCP {p.handicap}</div>
                </div>
                <div className="text-center text-[14px]" style={{color:p.thru===18?"var(--green)":"var(--text)"}}>{p.thru===18?"F":p.thru||"—"}</div>
                <div className="text-center font-mono text-[14px] text-t3">{p.gross||"—"}</div>
                <div className="text-center font-mono text-[14px]" style={{color:overPar>0?"var(--amber)":overPar<0?"var(--gold)":"var(--text)"}}>{overPar!==null?toPM(overPar):"—"}</div>
                <div className="text-center font-mono text-[16px] font-bold" style={{color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>{toPM(p.net)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const PlayerRoster = ({ t, isLive }) => {
    const joined = isLive
      ? (t.hasPassword ? players.filter(p=>p.oneOffId===t.id) : players)
      : (t.snapshot || []);
    if (!joined.length) return (
      <div className="py-4 text-center text-t3 text-[13px] italic">No players yet.</div>
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
      <div className="flex flex-col gap-3">
        {rows.map((p, idx) => {
          const hasScores = p.scores?.some(Boolean);
          return (
            <div key={p.id}
              className="rounded-lg overflow-hidden"
              style={{ background:"var(--bg3)", border:`1px solid ${idx===0?"var(--green-dim)":"var(--border)"}` }}>
              <div className="flex justify-between items-center px-4 py-3" style={{borderBottom:hasScores?"1px solid var(--border)":"none"}}>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl min-w-[36px]" style={{color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                    {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                  </span>
                  <div>
                    <div className="text-[16px] font-semibold text-text">{p.name}</div>
                    <div className="text-[11px] text-t3">HCP {p.handicap} · Thru {p.thru===18?"F (Final)":p.thru||"—"}</div>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  {p.gross > 0 && (
                    <div className="text-center">
                      <div className="font-mono text-[16px] text-t3">{p.gross}</div>
                      <div className="font-display text-[9px] tracking-[2px] text-t3">GROSS</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="font-mono text-[20px] font-bold" style={{color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>{p.net!==0||p.thru>0?toPM(p.net):"—"}</div>
                    <div className="font-display text-[9px] tracking-[2px] text-t3">NET</div>
                  </div>
                </div>
              </div>
              {hasScores && (
                <div className="overflow-x-auto px-3 py-2.5" style={{ WebkitOverflowScrolling: "touch" }}>
                  <div className="flex gap-1 min-w-max">
                    {p.scores.map((s, hi) => (
                      <div key={hi} className="text-center min-w-[28px]">
                        <div className="font-display text-[9px] text-t3 mb-0.5">{hi+1}</div>
                        <div
                          className="w-7 h-7 rounded-[4px] flex items-center justify-center font-mono text-[13px] font-semibold"
                          style={{
                            background: s ? "var(--bg4)" : "transparent",
                            color: s ? scoreColor(s,pars[hi]) : "var(--border2)",
                            border: s ? `1px solid ${scoreColor(s,pars[hi])}44` : "1px solid var(--border)",
                          }}>
                          {s||"·"}
                        </div>
                        <div className="text-[8px] text-t3 mt-0.5">{pars[hi]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!hasScores && isLive && (
                <div className="px-4 py-2 text-[11px] text-t3 italic">No scores entered yet</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── LOGIN VIEW ───────────────────────────────────────────────────────────
  if (tabStep === "login" && selTourney) {
    return (
      <div className="fade-up max-w-sm mx-auto">
        <div className="flex items-center gap-2.5 mb-6">
          <button
            onClick={()=>{ setTabStep("list"); setTStep("name"); setTLoginPid(""); setTLoginPin(""); setTLoginErr(""); setTPwInput(""); setTPwErr(""); }}
            className="bg-transparent border-none text-t3 text-lg cursor-pointer">←</button>
          <div>
            <div className="font-display text-[11px] tracking-[3px]" style={{color:selTourney.isActive?"var(--green)":"var(--text3)"}}>
              {selTourney.isActive?"🟢 IN PROGRESS":"⛳ TOURNAMENT"}
            </div>
            <div className="font-display text-[22px] tracking-[2px]">{selTourney.title}</div>
            <div className="text-[12px] text-t3">{selTourney.date}{selTourney.course?` · ${selTourney.course}`:""}</div>
          </div>
        </div>

        {tStep === "name" && (
          <div className="card p-7">
            <div className="section-label mb-2">YOUR NAME</div>
            <select value={tLoginPid} onChange={e=>{ setTLoginPid(e.target.value); setTLoginErr(""); }}
              className="w-full px-3 py-3 text-[15px] bg-bg3 border border-border2 rounded-[4px] mb-5 min-h-[44px]"
              style={{ color: tLoginPid ? "var(--text)" : "var(--text3)" }}>
              <option value="">Select your name...</option>
              {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn-gold w-full text-[14px] py-3.5" disabled={!tLoginPid} onClick={()=>setTStep("pin")}>
              CONTINUE →
            </button>
          </div>
        )}

        {tStep === "pin" && (
          <div className="card p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <button onClick={()=>{ setTStep("name"); setTLoginPin(""); setTLoginErr(""); }}
                className="bg-transparent border-none text-t3 text-lg cursor-pointer">←</button>
              <div className="font-display text-[18px] tracking-[2px]">{selectedPlayer?.name}</div>
            </div>
            <div className="section-label mb-2">YOUR PIN</div>
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
          <div className="card p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <button onClick={()=>{ setTStep("pin"); setTLoginPin(""); setTPwInput(""); setTPwErr(""); }}
                className="bg-transparent border-none text-t3 text-lg cursor-pointer">←</button>
              <div className="font-display text-[18px] tracking-[2px]">{selectedPlayer?.name}</div>
            </div>
            <div className="text-center mb-5">
              <div className="text-[32px] mb-2">🔒</div>
              <div className="font-display text-[16px] tracking-[2px] mb-1.5">{selTourney.title}</div>
              <div className="text-[13px] text-t3">This tournament is invite-only. Enter the password your commissioner shared with you.</div>
            </div>
            <input value={tPwInput} onChange={e=>{ setTPwInput(e.target.value); setTPwErr(""); }}
              placeholder="Tournament password" className="w-full text-[15px] mb-2"/>
            {tPwErr && (
              <div className="text-[13px] text-red bg-[#2a0808] border border-[#4a1010] px-3 py-2 rounded-[4px] mb-3">{tPwErr}</div>
            )}
            <button className="btn-gold w-full text-[14px] py-3.5" onClick={handleJoinWithPassword} disabled={!tPwInput.trim()}>
              JOIN TOURNAMENT →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── LEADERBOARD VIEW ─────────────────────────────────────────────────────
  if (tabStep === "leaderboard" && selTourney) {
    const isLive = !!selTourney.isActive;
    return (
      <div className="fade-up">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={()=>{ setTabStep("list"); setSelTourney(null); setShowPlayers(false); }}
            className="bg-transparent border-none text-t3 text-[22px] cursor-pointer">←</button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              {isLive && <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>}
              <span className="font-display text-[11px] tracking-[3px]" style={{color:isLive?"var(--green)":"var(--text3)"}}>
                {isLive?"LIVE · IN PROGRESS":"FINAL RESULTS"}
              </span>
            </div>
            <div className="font-display text-[26px] tracking-[2px] leading-none">{selTourney.title}</div>
            <div className="text-[12px] text-t3 mt-0.5">
              {selTourney.date}{selTourney.course?` · ${selTourney.course}`:""}
              {selTourney.courseDetails?` · Par ${selTourney.courseDetails.par}`:""}
            </div>
          </div>
          {isLive && (
            <button className="btn-gold text-[12px] py-2 px-4 tracking-[2px] whitespace-nowrap"
              onClick={()=>{ setTabStep("login"); setTStep("name"); }}>
              ENTER SCORES →
            </button>
          )}
        </div>

        {/* Sub-tab strip */}
        <div className="flex border-b border-border mb-5" style={{ marginBottom: -1 }}>
          {[["board","🏆 LEADERBOARD"],["players","👤 PLAYERS"]].map(([val,label])=>(
            <button key={val} onClick={()=>setShowPlayers(val==="players")}
              className="px-4 py-2.5 font-display text-[12px] tracking-[2px] cursor-pointer bg-transparent border-none transition-all duration-150"
              style={{
                color: ((val==="players")===showPlayers) ? "var(--gold)" : "var(--text3)",
                borderBottom: ((val==="players")===showPlayers) ? "2px solid var(--gold)" : "2px solid transparent",
                marginBottom: -1,
              }}>
              {label}
            </button>
          ))}
        </div>

        {!showPlayers && <TourneyLeaderboard t={selTourney}/>}
        {showPlayers && <PlayerRoster t={selTourney} isLive={isLive}/>}
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  const activeTourneys = activeOnOffs.length > 0
    ? activeOnOffs
    : (activeOneOff ? [{ ...activeOneOff, isActive: true }] : []);
  const pastTourneys = oneOffTournaments;

  return (
    <div className="fade-up">
      <div className="mb-6">
        <div className="font-display text-[11px] tracking-[4px] text-t3 mb-1">NORTH STAR AMATEUR SERIES</div>
        <h2 className="font-display text-4xl tracking-[2px] mb-1">TOURNAMENTS</h2>
        <p className="text-[13px] text-t3">Tap any tournament to view the full leaderboard or enter scores.</p>
      </div>

      {activeTourneys.length > 0 && (
        <div className="mb-7">
          <div className="font-display text-[11px] tracking-[3px] text-green mb-3 flex items-center gap-2">
            <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>
            {activeTourneys.length} OPEN NOW
          </div>
          <div className="flex flex-col gap-3">
            {activeTourneys.map(t => {
              const tPlayers = t.hasPassword
                ? players.filter(p=>p.oneOffId===t.id && p.scores?.some(Boolean))
                : players.filter(p=>p.memberType!=="amateur" && p.scores?.some(Boolean));
              return (
                <div key={t.id} className="rounded-[10px] overflow-hidden" style={{background:"#060e06",border:"2px solid var(--green-dim)"}}>
                  <div className="p-4 md:p-5">
                    <div className="flex justify-between items-start flex-wrap gap-2.5 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-[24px] tracking-[2px] text-text">{t.title}</div>
                        <div className="text-[12px] text-t3 mt-0.5">
                          {t.date}{t.course?` · ${t.course}`:""}
                          {t.courseDetails?` · Par ${t.courseDetails.par}`:""}
                        </div>
                        {t.notes && <div className="text-[12px] text-t2 mt-1 italic">{t.notes}</div>}
                        <div className="text-[11px] text-t3 mt-1.5">{tPlayers.length} player{tPlayers.length!==1?"s":""} on the board</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {t.hasPassword && (
                          <span className="font-display text-[10px] tracking-[2px] text-t3 border border-border2 rounded-[3px] px-2 py-px">🔒 INVITE ONLY</span>
                        )}
                        <button className="btn-gold text-[12px] py-2.5 px-4 tracking-[2px]"
                          onClick={()=>{ setSelTourney(t); setTabStep("login"); setTStep("name"); }}>
                          ENTER SCORES →
                        </button>
                        <button
                          className="font-display text-[11px] tracking-[2px] py-1.5 px-3.5 bg-transparent rounded-[4px] cursor-pointer border border-green-dim text-green"
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
        <div className="p-8 bg-bg2 border border-border rounded-lg text-center mb-7">
          <div className="text-4xl mb-2.5">⛳</div>
          <div className="font-display text-[18px] tracking-[2px] mb-1.5">NO ACTIVE TOURNAMENT</div>
          <div className="text-[13px] text-t3">Check back when the commissioner starts one.</div>
        </div>
      )}

      {pastTourneys.length > 0 && (
        <div>
          <div className="font-display text-[11px] tracking-[3px] text-t3 mb-3">── PAST TOURNAMENTS</div>
          <div className="flex flex-col gap-2.5">
            {pastTourneys.map(t => {
              const winner = t.snapshot?.[0];
              return (
                <div key={t.id}
                  className="bg-bg2 border border-border rounded-lg cursor-pointer"
                  onClick={()=>{ setSelTourney(t); setTabStep("leaderboard"); setShowPlayers(false); }}>
                  <div className="px-5 py-4 flex justify-between items-center flex-wrap gap-2.5">
                    <div>
                      <div className="font-display text-[18px] tracking-[1px] text-text">{t.title}</div>
                      <div className="text-[12px] text-t3">{t.date}{t.course?` · ${t.course}`:""}</div>
                      {winner && <div className="text-[12px] text-gold mt-1">🏆 {winner.name} · Net {winner.net}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[10px] tracking-[2px] text-t3 border border-border2 rounded-[3px] px-2 py-px">
                        {t.snapshot?.length||0} PLAYERS
                      </span>
                      <span className="text-t3 text-[18px]">›</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTourneys.length === 0 && pastTourneys.length === 0 && (
        <div className="text-center py-5 text-t3 text-[13px]">No tournaments yet.</div>
      )}
    </div>
  );
}

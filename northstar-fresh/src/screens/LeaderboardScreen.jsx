import React from "react";
import { usePlayers } from "../contexts/PlayersContext";
import { useTournament } from "../contexts/TournamentContext";
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

      {/* Tab strip */}
      <div className="flex border-b border-border mb-6" style={{ marginBottom: -1 }}>
        {[["individual","👤 INDIVIDUAL"],["groups","🤝 GROUPS"]].map(([val,label])=>(
          <button key={val}
            onClick={()=>setLbTab(val)}
            className="px-5 py-2.5 font-display text-[13px] tracking-[2px] cursor-pointer bg-transparent border-none transition-all duration-150"
            style={{
              color: lbTab===val ? "var(--gold)" : "var(--text3)",
              borderBottom: lbTab===val ? "2px solid var(--gold)" : "2px solid transparent",
              marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
      </div>

      {lbTab === "groups" && <FoursomeView notify={notify} />}

      {lbTab === "individual" && <>
        {activeOneOff && (
          <div className="mb-7 mt-6">
            {/* Live now header */}
            <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse2 1.2s infinite"}}/>
                <span className="font-display text-[11px] tracking-[3px] text-green">LIVE NOW</span>
              </div>
              <div className="font-display text-xl tracking-[2px] text-text">{activeOneOff.title}</div>
              {activeOneOff.course && <div className="text-xs text-t3">📍 {activeOneOff.course}</div>}
              {activeOneOff.hasPassword && (
                <span className="font-display text-[10px] tracking-[1px] text-t3 border border-border2 rounded-[2px] px-1.5 py-px">🔒 INVITE ONLY</span>
              )}
            </div>

            {oneOffRows.length === 0 ? (
              <div className="p-6 bg-bg2 border border-border rounded-[6px] text-center text-t3 text-[13px] italic">
                Waiting for players to enter scores…
              </div>
            ) : (
              <div
                className="-mx-4 md:mx-0 overflow-x-auto border border-green-dim rounded-[6px]"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div style={{ minWidth: 420 }}>
                  <div
                    className="grid bg-bg3 px-4 py-2.5 font-display text-[10px] tracking-[2px] text-t3"
                    style={{ gridTemplateColumns: "52px 1fr 60px 80px 80px" }}
                  >
                    <span>POS</span><span>PLAYER</span>
                    <span className="text-center">THRU</span>
                    <span className="text-center">GROSS</span>
                    <span className="text-center">NET</span>
                  </div>
                  {oneOffRows.map((p, idx) => (
                    <div key={p.id}
                      className="player-row grid px-4 py-3 items-center border-b border-border last:border-b-0"
                      style={{
                        gridTemplateColumns: "52px 1fr 60px 80px 80px",
                        borderLeft: idx===0 ? "3px solid var(--green)" : "3px solid transparent",
                      }}
                      onClick={()=>{ setSelectedPid(p.id); setScreen("scorecard"); }}>
                      <span className="font-display text-xl"
                        style={{color:idx===0?"var(--green)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)"}}>
                        {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
                      </span>
                      <div>
                        <div className="text-[16px] font-semibold" style={{color:idx===0?"var(--text)":"var(--text2)"}}>{p.name}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[15px]" style={{color:p.thru===18?"var(--green)":"var(--text)"}}>{p.thru===18?"F":p.thru||"—"}</div>
                        <div className="font-display text-[10px] text-t3 tracking-[1px]">{p.thru===18?"FINAL":p.thru>0?"THRU":"—"}</div>
                      </div>
                      <div className="text-center font-mono text-[16px]"
                        style={{color:p.gross>0?"var(--amber)":p.gross<0?"var(--gold)":"var(--text)"}}>
                        {p.gross||"—"}
                      </div>
                      <div className="text-center font-mono text-[22px] font-bold"
                        style={{color:p.net<0?"var(--green-bright)":p.net>0?"var(--amber)":"var(--text)"}}>
                        {toPM(p.net)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-border mt-6 pt-5">
              <div className="font-display text-[11px] tracking-[3px] text-t3 mb-3">── SEASON LEADERBOARD</div>
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
          <div className="text-center py-16 px-5 text-t3">
            <div className="text-4xl mb-3">⛳</div>
            <div className="font-display text-xl tracking-[2px] mb-2">NO PLAYERS YET</div>
          </div>
        )}
      </>}

      {lbTab === "individual" && players.filter(p=>p.memberType==="amateur").length > 0 && (
        <div className="mt-8">
          <div className="font-display text-[11px] tracking-[3px] text-t3 mb-3.5 flex items-center gap-2.5">
            <span>── AMATEUR MEMBERS</span>
            <button
              className="font-display text-[10px] tracking-[2px] bg-transparent border border-border2 text-t3 rounded-[3px] px-2.5 py-[2px] cursor-pointer"
              onClick={()=>setScreen("amateurs")}>
              VIEW ALL →
            </button>
          </div>
          <div className="card overflow-hidden">
            {players.filter(p=>p.memberType==="amateur").map((p,idx)=>(
              <div key={p.id} className="flex justify-between items-center px-4 py-3.5 border-b border-border last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="font-display text-[16px] text-t3 min-w-[28px]">{idx+1}</span>
                  <div>
                    <div className="text-[15px] font-semibold text-t2">{p.name}</div>
                    <div className="text-[11px] text-t3">HCP {p.handicap}</div>
                  </div>
                </div>
                <span className="font-display text-[10px] tracking-[2px] text-gold border border-[#c8a84a44] rounded-[3px] px-2 py-px">AMATEUR</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

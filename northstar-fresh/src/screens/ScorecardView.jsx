import React from "react";
import { usePlayers } from "../contexts/PlayersContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourse } from "../contexts/CourseContext";
import { calcNet, toPM, holesPlayed } from "../lib/scoring";
import { DEFAULT_PAR, DEFAULT_YARDS, HCP_STROKES } from "../constants";

export default function ScorecardView({ selectedPid, setSelectedPid, updateScore }) {
  const { players } = usePlayers();
  const { adminUnlocked } = useAuth();
  const { course } = useCourse();

  const pars  = (Array.isArray(course?.par)   && course.par.length===18)   ? course.par   : DEFAULT_PAR;
  const yards = (Array.isArray(course?.yards)  && course.yards.length===18) ? course.yards : DEFAULT_YARDS;

  const player = players.find(p=>p.id===selectedPid) || players[0];
  if (!player) return <div className="text-t3 p-10 text-center">No players yet.</div>;

  const Nine = ({ start, label }) => {
    const ninePars  = pars.slice(start,start+9);
    const nineYards = yards.slice(start,start+9);
    const nineHcps  = HCP_STROKES.slice(start,start+9);
    const scores    = player.scores.slice(start,start+9);
    const gross     = scores.filter(Boolean).reduce((a,b)=>a+b,0);
    return (
      <div className="overflow-x-auto mb-4" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="section-label mb-1.5">{label}</div>
        <table style={{ borderCollapse:"collapse", minWidth:"100%", fontSize:13 }}>
          <thead>
            <tr className="bg-bg3">
              <td className="font-display text-[10px] tracking-[1px] text-t3 py-[7px] px-2.5 min-w-[70px]">HOLE</td>
              {Array.from({length:9},(_,i)=>(
                <td key={i} className="font-display text-[11px] text-t3 text-center py-[7px] px-1 min-w-[38px]">{start+i+1}</td>
              ))}
              <td className="font-display text-[11px] text-t3 text-center py-[7px] px-2 min-w-[42px] bg-bg4">TOT</td>
            </tr>
            <tr className="border-b border-border">
              <td className="text-[11px] text-t3 py-[5px] px-2.5">Yards</td>
              {nineYards.map((y,i)=><td key={i} className="text-center text-[12px] text-t3 py-[5px] px-1">{y}</td>)}
              <td className="text-center text-[12px] text-t3 bg-bg4">{nineYards.reduce((a,b)=>a+b,0)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="text-[11px] text-t3 py-[5px] px-2.5">HCP</td>
              {nineHcps.map((h,i)=><td key={i} className="text-center text-[11px] text-t3 py-[5px] px-1">{h}</td>)}
              <td className="bg-bg4"/>
            </tr>
            <tr className="border-b border-border">
              <td className="text-[12px] text-green font-semibold py-1.5 px-2.5">Par</td>
              {ninePars.map((p,i)=><td key={i} className="text-center text-[13px] text-green font-semibold py-1.5 px-1">{p}</td>)}
              <td className="text-center text-[13px] text-green font-bold bg-bg4">{ninePars.reduce((a,b)=>a+b,0)}</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-[13px] text-t2 py-2 px-2.5">{player.name.split(" ")[0]}</td>
              {scores.map((s,i)=>{
                const par=ninePars[i];
                const diff=s?s-par:null;
                const bg=diff===null?"transparent":diff<=-2?"#1a3a0a":diff===-1?"#0a2a0a":diff===0?"transparent":diff===1?"#2a1a0a":"#3a0a0a";
                const col=diff===null?"var(--text3)":diff<=-2?"#a0e060":diff===-1?"var(--green-bright)":diff===0?"var(--text)":diff===1?"var(--amber)":"var(--red)";
                return (
                  <td key={i} className="text-center py-1.5 px-[3px]">
                    {adminUnlocked ? (
                      <input className="sc-input" type="number" min="1" max="15" value={s??""} onChange={e=>updateScore(player.id,start+i,e.target.value)}/>
                    ) : (
                      <div
                        className="w-9 h-7 flex items-center justify-center mx-auto rounded-[3px] font-mono text-[14px]"
                        style={{ background:bg, color:col, fontWeight:s?600:400 }}>
                        {s||"—"}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="text-center font-bold text-[15px] text-text bg-bg4 py-1.5 px-2">{gross||"—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const net=calcNet(player,pars), gross=player.scores.filter(Boolean).reduce((a,b)=>a+b,0), thru=holesPlayed(player);

  return (
    <div className="fade-up">
      {/* Player chip strip */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {players.map(p=>(
          <button key={p.id} className={`flight-chip ${selectedPid===p.id?"active":""} text-[13px]`} onClick={()=>setSelectedPid(p.id)}>
            {p.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {/* Player header */}
        <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-[30px] tracking-[2px]">{player.name}</h2>
            <div className="text-[12px] text-t3 tracking-[1px]">Handicap {player.handicap}</div>
          </div>
          <div className="flex gap-6">
            {[
              ["GROSS", gross||"—", "var(--text)"],
              ["THRU",  thru===18?"F":thru||"—", thru===18?"var(--green)":"var(--text2)"],
              ["NET",   toPM(net), net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"],
            ].map(([l,v,c])=>(
              <div key={l} className="text-center">
                <div className="text-[24px] font-bold" style={{color:c}}>{v}</div>
                <div className="font-display text-[10px] text-t3 tracking-[2px]">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <Nine start={0} label="FRONT NINE"/>
        <Nine start={9} label="BACK NINE"/>
      </div>
    </div>
  );
}

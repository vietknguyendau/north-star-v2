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
  if (!player) return <div style={{color:"var(--text3)",padding:40,textAlign:"center"}}>No players yet.</div>;

  const Nine = ({ start, label }) => {
    const ninePars  = pars.slice(start,start+9);
    const nineYards = yards.slice(start,start+9);
    const nineHcps  = HCP_STROKES.slice(start,start+9);
    const scores    = player.scores.slice(start,start+9);
    const gross     = scores.filter(Boolean).reduce((a,b)=>a+b,0);
    return (
      <div style={{overflowX:"auto",marginBottom:16}}>
        <div className="section-label" style={{marginBottom:6}}>{label}</div>
        <table style={{borderCollapse:"collapse",minWidth:"100%",fontSize:13}}>
          <thead>
            <tr style={{background:"var(--bg3)"}}>
              <td style={{padding:"7px 10px",fontSize:10,letterSpacing:1,color:"var(--text3)",fontFamily:"'Bebas Neue'",minWidth:70}}>HOLE</td>
              {Array.from({length:9},(_,i)=>(
                <td key={i} style={{padding:"7px 5px",textAlign:"center",fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",minWidth:38}}>{start+i+1}</td>
              ))}
              <td style={{padding:"7px 8px",textAlign:"center",fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",background:"var(--bg4)",minWidth:42}}>TOT</td>
            </tr>
            <tr style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"5px 10px",fontSize:11,color:"var(--text3)"}}>Yards</td>
              {nineYards.map((y,i)=><td key={i} style={{textAlign:"center",padding:"5px 4px",fontSize:12,color:"var(--text3)"}}>{y}</td>)}
              <td style={{textAlign:"center",fontSize:12,color:"var(--text3)",background:"var(--bg4)"}}>{nineYards.reduce((a,b)=>a+b,0)}</td>
            </tr>
            <tr style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"5px 10px",fontSize:11,color:"var(--text3)"}}>HCP</td>
              {nineHcps.map((h,i)=><td key={i} style={{textAlign:"center",padding:"5px 4px",fontSize:11,color:"var(--text3)"}}>{h}</td>)}
              <td style={{background:"var(--bg4)"}}/>
            </tr>
            <tr style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"6px 10px",fontSize:12,color:"var(--green)",fontWeight:600}}>Par</td>
              {ninePars.map((p,i)=><td key={i} style={{textAlign:"center",padding:"6px 4px",fontSize:13,color:"var(--green)",fontWeight:600}}>{p}</td>)}
              <td style={{textAlign:"center",fontSize:13,color:"var(--green)",fontWeight:700,background:"var(--bg4)"}}>{ninePars.reduce((a,b)=>a+b,0)}</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{padding:"8px 10px",fontSize:13,color:"var(--text2)"}}>{player.name.split(" ")[0]}</td>
              {scores.map((s,i)=>{
                const par=ninePars[i];
                const diff=s?s-par:null;
                const bg=diff===null?"transparent":diff<=-2?"#1a3a0a":diff===-1?"#0a2a0a":diff===0?"transparent":diff===1?"#2a1a0a":"#3a0a0a";
                const col=diff===null?"var(--text3)":diff<=-2?"#a0e060":diff===-1?"var(--green-bright)":diff===0?"var(--text)":diff===1?"var(--amber)":"var(--red)";
                return (
                  <td key={i} style={{textAlign:"center",padding:"6px 3px"}}>
                    {adminUnlocked ? (
                      <input className="sc-input" type="number" min="1" max="15" value={s??""} onChange={e=>updateScore(player.id,start+i,e.target.value)}/>
                    ) : (
                      <div style={{width:36,height:28,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",borderRadius:3,background:bg,color:col,fontSize:14,fontFamily:"'DM Mono'",fontWeight:s?600:400}}>
                        {s||"—"}
                      </div>
                    )}
                  </td>
                );
              })}
              <td style={{textAlign:"center",fontWeight:700,fontSize:15,color:"var(--text)",background:"var(--bg4)",padding:"6px 8px"}}>{gross||"—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const net=calcNet(player,pars), gross=player.scores.filter(Boolean).reduce((a,b)=>a+b,0), thru=holesPlayed(player);
  return (
    <div className="fade-up">
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {players.map(p=>(
          <button key={p.id} className={`flight-chip ${selectedPid===p.id?"active":""}`} style={{fontSize:13}} onClick={()=>setSelectedPid(p.id)}>
            {p.name.split(" ")[0]}
          </button>
        ))}
      </div>
      <div className="card" style={{padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:16}}>
          <div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:30,letterSpacing:2}}>{player.name}</h2>
            <div style={{fontSize:12,color:"var(--text3)",letterSpacing:1}}>Handicap {player.handicap}</div>
          </div>
          <div style={{display:"flex",gap:24}}>
            {[["GROSS",gross||"—","var(--text)"],["THRU",thru===18?"F":thru||"—",thru===18?"var(--green)":"var(--text2)"],["NET",toPM(net),net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)"]].map(([l,v,c])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:700,color:c}}>{v}</div>
                <div style={{fontSize:10,color:"var(--text3)",letterSpacing:2,fontFamily:"'Bebas Neue'"}}>{l}</div>
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

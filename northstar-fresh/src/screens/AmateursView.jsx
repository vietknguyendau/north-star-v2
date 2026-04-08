import React from "react";
import { usePlayers } from "../contexts/PlayersContext";

export default function AmateursView({ setScreen }) {
  const { players } = usePlayers();
  const amateurs = players.filter(p => p.memberType === "amateur");
  const leagueMembers = players.filter(p => p.memberType !== "amateur").sort((a,b)=>a.name.localeCompare(b.name));
  const spotsLeft = 32 - leagueMembers.length;

  return (
    <div className="fade-up max-w-2xl mx-auto">
      <div className="mb-7">
        <div className="font-display text-[11px] tracking-[5px] text-green mb-1.5">NORTH STAR AMATEUR SERIES · 2026</div>
        <h2 className="font-display text-4xl tracking-[2px] mb-2">MEMBER ROSTER</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-[13px] text-t3">{leagueMembers.length} of 32 league spots filled</div>
          <div className="h-1.5 flex-1 min-w-[80px] bg-bg3 rounded-full overflow-hidden">
            <div className="h-full bg-green rounded-full" style={{width:`${(leagueMembers.length/32)*100}%`}}/>
          </div>
          <div className="font-display text-[13px] tracking-[1px]" style={{color:spotsLeft>0?"var(--amber)":"var(--red)"}}>
            {spotsLeft>0?`${spotsLeft} SPOTS LEFT`:"FULL"}
          </div>
        </div>
      </div>

      {/* League members */}
      <div className="mb-8">
        <div className="font-display text-[11px] tracking-[3px] text-green mb-3">── LEAGUE MEMBERS ({leagueMembers.length})</div>
        {leagueMembers.length === 0 ? (
          <div className="p-8 text-center bg-bg2 border border-border rounded-lg">
            <div className="text-[32px] mb-2.5">⛳</div>
            <div className="font-display text-[16px] tracking-[2px] mb-1.5">NO MEMBERS YET</div>
            <div className="text-[13px] text-t3">Registration is open — share the league password to get players signed up.</div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div
              className="grid bg-bg3 px-4 py-2 font-display text-[10px] tracking-[2px] text-t3"
              style={{ gridTemplateColumns: "40px 1fr 70px 110px" }}
            >
              <span>#</span><span>NAME</span>
              <span className="text-center">HCP</span>
              <span className="text-center">SKILL</span>
            </div>
            {leagueMembers.map((p, idx) => (
              <div key={p.id}
                className="grid px-4 py-3.5 border-b border-border last:border-b-0 items-center"
                style={{ gridTemplateColumns: "40px 1fr 70px 110px" }}>
                <div className="font-display text-[16px] text-t3">{idx+1}</div>
                <div>
                  <div className="text-[16px] font-semibold text-text">{p.name}</div>
                  {p.email && <div className="text-[11px] text-t3 mt-px">{p.email}</div>}
                </div>
                <div className="text-center font-mono text-[15px] text-text">{p.handicap}</div>
                <div className="text-center">
                  <span className="font-display text-[9px] tracking-[1px] text-t3 border border-border2 rounded-[3px] px-1.5 py-[2px]">{p.flight||"—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Amateur members */}
      <div className="mb-6">
        <div className="font-display text-[11px] tracking-[3px] text-gold mb-3 flex justify-between items-center">
          <span>── AMATEUR MEMBERS ({amateurs.length})</span>
          <button className="btn-ghost btn-sm text-[10px] tracking-[1px]" onClick={()=>setScreen("amateur-register")}>
            + JOIN AS AMATEUR
          </button>
        </div>
        {amateurs.length === 0 ? (
          <div className="p-5 text-center bg-bg2 border border-border rounded-lg">
            <div className="text-[13px] text-t3">No amateur members yet.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {amateurs.map((p, idx) => (
              <div key={p.id} className="bg-bg2 border border-border rounded-lg px-4 py-3.5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="font-display text-[16px] text-t3 min-w-[28px]">{idx+1}</div>
                  <div>
                    <div className="text-[15px] font-semibold text-text">{p.name}</div>
                    <div className="text-[11px] text-t3">HCP {p.handicap}</div>
                  </div>
                </div>
                <span className="font-display text-[10px] tracking-[2px] text-gold border border-[#c8a84a44] rounded-[3px] px-2 py-px">AMATEUR</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

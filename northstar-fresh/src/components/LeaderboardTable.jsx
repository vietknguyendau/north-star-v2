import React from "react";

const HEADER = {
  fontSize: 10, letterSpacing: 2, color: "var(--text3)",
  fontFamily: "'Bebas Neue'", fontWeight: "normal",
  background: "var(--bg3)", whiteSpace: "nowrap",
  padding: "9px 10px",
};
const CELL = { borderBottom: "1px solid var(--border)", verticalAlign: "middle" };

export default function LeaderboardTable({
  players, pars, scorecardUploads, calcNet, calcGrossToPar,
  holesPlayed, toPM, setSelectedPid, setScreen, course,
}) {
  return (
    <div style={{ marginBottom: 32 }}>

      {/* ── Mobile: frozen left column + scrollable right ─────────── */}
      <div
        className="md:hidden -mx-4 overflow-x-auto border-t border-b border-border"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              {/* Frozen left header */}
              <th
                scope="col"
                className="sticky left-0 z-10"
                style={{ ...HEADER, textAlign: "left", minWidth: 160, paddingLeft: 16, paddingRight: 12 }}
              >
                PLAYER
              </th>
              {/* Scrollable right headers — NET first as hero stat */}
              <th scope="col" style={{ ...HEADER, textAlign: "center", width: 64 }}>NET</th>
              <th scope="col" style={{ ...HEADER, textAlign: "center", width: 52 }}>THRU</th>
              <th scope="col" style={{ ...HEADER, textAlign: "center", width: 56 }}>GROSS</th>
              <th scope="col" style={{ ...HEADER, textAlign: "center", width: 60, paddingRight: 16 }}>+/- PAR</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, idx) => {
              const net      = calcNet(player, pars, course);
              const gross    = calcGrossToPar(player, pars);
              const thru     = holesPlayed(player);
              const rawGross = player.scores.slice(0, thru).filter(Boolean).reduce((a, b) => a + b, 0);
              const lead     = idx === 0 && net !== null;

              const posColor  = idx===0 ? "var(--gold)" : idx===1 ? "#90b0b8" : idx===2 ? "#c08050" : "var(--text3)";
              const posLabel  = idx===0 ? "1ST" : idx===1 ? "2ND" : idx===2 ? "3RD" : `${idx + 1}`;
              const netColor  = net < 0 ? "var(--green-bright)" : net > 0 ? "var(--amber)" : "var(--text)";
              const grossColor = gross > 0 ? "var(--amber)" : gross < 0 ? "var(--gold)" : "var(--text)";

              return (
                <tr
                  key={player.id}
                  className="player-row group"
                  onClick={() => { setSelectedPid(player.id); setScreen("scorecard"); }}
                >
                  {/* Frozen left: pos + full name + badge + HCP */}
                  <td
                    className="sticky left-0 z-10 bg-bg2 group-hover:bg-bg3 transition-colors duration-150"
                    style={{
                      ...CELL,
                      padding: "11px 12px 11px 16px",
                      borderLeft: lead ? "3px solid var(--gold)" : "3px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Position */}
                      <span style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: posColor, minWidth: 28, lineHeight: 1, flexShrink: 0 }}>
                        {posLabel}
                      </span>
                      {/* Player info */}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: lead ? "var(--text)" : "var(--text2)", lineHeight: 1.25, display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap" }}>
                          <span>{player.name}</span>
                          {holesPlayed(player) > 0 && !scorecardUploads[player.id]?.url && (
                            <span style={{ fontSize: 8, fontFamily: "'Bebas Neue'", letterSpacing: 1, color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: 2, padding: "1px 3px", flexShrink: 0 }}>
                              UNVERF
                            </span>
                          )}
                          {scorecardUploads[player.id]?.url && !scorecardUploads[player.id]?.verified && (
                            <span style={{ fontSize: 8, fontFamily: "'Bebas Neue'", letterSpacing: 1, color: "var(--gold)", border: "1px solid var(--gold-dim)", borderRadius: 2, padding: "1px 3px", flexShrink: 0 }}>
                              PEND ⏳
                            </span>
                          )}
                          {scorecardUploads[player.id]?.verified && (
                            <span style={{ fontSize: 8, fontFamily: "'Bebas Neue'", letterSpacing: 1, color: "var(--green)", border: "1px solid var(--green-dim)", borderRadius: 2, padding: "1px 3px", flexShrink: 0 }}>
                              ✓ VER
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>HCP {player.handicap}</div>
                      </div>
                    </div>
                  </td>

                  {/* NET — hero stat: larger, bold, colored */}
                  <td style={{ ...CELL, textAlign: "center", padding: "11px 8px" }}>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: 22, fontWeight: 700, color: netColor, lineHeight: 1 }}>
                      {toPM(net)}
                    </div>
                  </td>

                  {/* THRU */}
                  <td style={{ ...CELL, textAlign: "center", padding: "11px 8px" }}>
                    <div style={{ fontSize: 14, color: thru === 18 ? "var(--green)" : "var(--text)" }}>
                      {thru === 18 ? "F" : thru || "—"}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1 }}>
                      {thru === 18 ? "FINAL" : thru > 0 ? "THRU" : "—"}
                    </div>
                  </td>

                  {/* GROSS */}
                  <td style={{ ...CELL, textAlign: "center", padding: "11px 8px" }}>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: 14, color: "var(--text3)" }}>
                      {rawGross || "—"}
                    </div>
                  </td>

                  {/* +/- PAR */}
                  <td style={{ ...CELL, textAlign: "center", padding: "11px 12px 11px 8px" }}>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: 14, color: grossColor }}>
                      {gross !== null ? toPM(gross) : "—"}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Desktop: full-width grid (unchanged) ──────────────────── */}
      <div className="hidden md:block card" style={{ overflow: "hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"48px 1fr 60px 72px 72px 72px", background:"var(--bg3)", padding:"9px 16px", fontSize:10, letterSpacing:2, color:"var(--text3)", fontFamily:"'Bebas Neue'" }}>
          <span>POS</span><span>PLAYER</span>
          <span style={{ textAlign:"center" }}>THRU</span>
          <span style={{ textAlign:"center" }}>GROSS</span>
          <span style={{ textAlign:"center" }}>+/- PAR</span>
          <span style={{ textAlign:"center" }}>NET</span>
        </div>
        {players.map((player, idx) => {
          const net      = calcNet(player, pars, course);
          const gross    = calcGrossToPar(player, pars);
          const thru     = holesPlayed(player);
          const rawGross = player.scores.slice(0, thru).filter(Boolean).reduce((a, b) => a + b, 0);
          const lead     = idx === 0 && net !== null;
          return (
            <div key={player.id} className="player-row"
              style={{ display:"grid", gridTemplateColumns:"48px 1fr 60px 72px 72px 72px", padding:"12px 16px", alignItems:"center", borderLeft: lead ? "3px solid var(--gold)" : "3px solid transparent" }}
              onClick={() => { setSelectedPid(player.id); setScreen("scorecard"); }}>
              <span style={{ fontFamily:"'Bebas Neue'", fontSize:20, color:idx===0?"var(--gold)":idx===1?"#90b0b8":idx===2?"#c08050":"var(--text3)" }}>
                {idx===0?"1ST":idx===1?"2ND":idx===2?"3RD":`${idx+1}`}
              </span>
              <div style={{ overflow:"hidden" }}>
                <div style={{ fontSize:15, color:lead?"var(--text)":"var(--text2)", fontWeight:600, display:"flex", alignItems:"center", gap:6, flexWrap:"nowrap" }}>
                  <span>{player.name}</span>
                  {holesPlayed(player)>0 && !scorecardUploads[player.id]?.url && <span style={{ fontSize:9, fontFamily:"'Bebas Neue'", letterSpacing:1, color:"var(--amber)", border:"1px solid var(--amber)", borderRadius:2, padding:"1px 4px" }}>UNVERIFIED</span>}
                  {scorecardUploads[player.id]?.url && !scorecardUploads[player.id]?.verified && <span style={{ fontSize:9, fontFamily:"'Bebas Neue'", letterSpacing:1, color:"var(--gold)", border:"1px solid var(--gold-dim)", borderRadius:2, padding:"1px 4px" }}>PENDING ⏳</span>}
                  {scorecardUploads[player.id]?.verified && <span style={{ fontSize:9, fontFamily:"'Bebas Neue'", letterSpacing:1, color:"var(--green)", border:"1px solid var(--green-dim)", borderRadius:2, padding:"1px 4px" }}>✓ VERIFIED</span>}
                </div>
                <div style={{ fontSize:10, color:"var(--text3)" }}>{`HCP ${player.handicap}`}</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:14, color:thru===18?"var(--green)":"var(--text)" }}>{thru===18?"F":thru||"—"}</div>
                <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>{thru===18?"FINAL":thru>0?"THRU":"—"}</div>
              </div>
              <div style={{ textAlign:"center", fontFamily:"'DM Mono'", fontSize:15, color:"var(--text3)" }}>{rawGross||"—"}</div>
              <div style={{ textAlign:"center", fontFamily:"'DM Mono'", fontSize:15, color:gross>0?"var(--amber)":gross<0?"var(--gold)":"var(--text)" }}>{gross!==null?toPM(gross):"—"}</div>
              <div style={{ textAlign:"center", fontFamily:"'DM Mono'", fontSize:18, fontWeight:700, color:net<0?"var(--green-bright)":net>0?"var(--amber)":"var(--text)" }}>{toPM(net)}</div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

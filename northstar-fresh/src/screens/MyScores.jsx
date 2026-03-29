import React from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { TOURNAMENT_ID, HCP_STROKES, DEFAULT_PAR, DEFAULT_YARDS } from "../constants";
import { calcNet, toPM, holesPlayed, scoreLabel } from "../lib/scoring";
import { usePlayers } from "../contexts/PlayersContext";
import { useTournament } from "../contexts/TournamentContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourse } from "../contexts/CourseContext";
import CtpDistanceEntry from "../components/CtpDistanceEntry";
import ScorecardUpload from "../components/ScorecardUpload";

// Score-relative colors — truly runtime values, must stay as style objects
const colorFor = (n, par) => {
  const d = n - par;
  if (d <= -2) return { bg: "#1c1600", border: "var(--gold)",      text: "var(--gold)" };
  if (d === -1) return { bg: "#0a2a0a", border: "var(--green)",     text: "var(--green-bright)" };
  if (d === 0)  return { bg: "#0a1a0a", border: "var(--green-dim)", text: "var(--text)" };
  if (d === 1)  return { bg: "#1c1000", border: "var(--amber)",     text: "var(--amber)" };
  if (d === 2)  return { bg: "#2a0a0a", border: "var(--red)",       text: "var(--red)" };
  return               { bg: "#1a0808", border: "#6a1010",          text: "#e05050" };
};

const labelFor = (n, par) => {
  const d = n - par;
  if (d <= -3) return "ALBATROSS";
  if (d === -2) return "EAGLE";
  if (d === -1) return "BIRDIE";
  if (d === 0)  return "PAR";
  if (d === 1)  return "BOGEY";
  if (d === 2)  return "DOUBLE";
  if (d === 3)  return "TRIPLE";
  return `+${d}`;
};

export default function MyScores({ activeHole, setActiveHole, updateScore, notify, setScreen }) {
  const { players, scorecardUploads } = usePlayers();
  const { ctpBets } = useTournament();
  const { activePlayer, setActivePlayer } = useAuth();
  const { course } = useCourse();

  const pars  = (Array.isArray(course?.par)   && course.par.length === 18)   ? course.par   : DEFAULT_PAR;
  const yards = (Array.isArray(course?.yards)  && course.yards.length === 18) ? course.yards : DEFAULT_YARDS;

  if (!activePlayer) { setScreen("my-scores-login"); return null; }
  const player = players.find(p => p.id === activePlayer);
  if (!player) { setScreen("my-scores-login"); return null; }

  const s    = player.scores[activeHole];
  const par  = pars[activeHole];
  const diff = s !== null ? s - par : null;
  const net  = calcNet(player, pars, course);
  const thru = holesPlayed(player);

  // Dynamic circle colors for the current-score display
  const scColor = diff === null ? "var(--text3)"
    : diff <= -1 ? "var(--gold)"
    : diff === 0  ? "var(--green)"
    : diff === 1  ? "var(--amber)"
    : "var(--red)";
  const scBg = diff === null ? "var(--bg3)"
    : diff <= -1 ? "#1c1600"
    : diff === 0  ? "#0a1a0a"
    : diff === 1  ? "#1c1000"
    : "#1c0808";

  // Score options for this hole: par-3 through par+4, capped at [1,10]
  const scoreOptions = [];
  for (let n = Math.max(1, par - 3); n <= Math.min(10, Math.max(par + 4, 10)); n++) scoreOptions.push(n);

  // CTP state
  const ctpKey  = `hole_${activeHole}`;
  const ctpBet  = ctpBets[ctpKey];
  const myEntry = ctpBet?.entries?.[player.id];

  const grossTotal = player.scores.filter(Boolean).reduce((a, b) => a + b, 0);
  const netColor   = net < 0 ? "text-green-bright" : net > 0 ? "text-amber" : "text-text";

  return (
    <div className="fade-up max-w-lg mx-auto pb-24">

      {/* ── Sticky player/stats header ───────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg border-b border-border px-4 pt-3 pb-2.5">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-[10px] tracking-[4px] text-green mb-0.5">SCORE ENTRY</div>
            <div className="font-display text-xl tracking-wider leading-none">{player.name}</div>
            <div className="text-[11px] text-t3 mt-0.5">HCP {player.handicap}</div>
          </div>
          <button
            onClick={() => { setActivePlayer(null); setScreen("my-scores-login"); }}
            className="font-display text-[10px] tracking-[1px] text-red border border-[#3a1010] bg-transparent px-3 py-1.5 rounded-[3px] cursor-pointer shrink-0"
          >
            🔒 LOCK &amp; EXIT
          </button>
        </div>

        {/* Live stats bar */}
        <div className="flex gap-6 mt-2">
          <div>
            <div className="font-display text-xl leading-none text-text">
              {thru === 18 ? "F" : thru || "—"}
            </div>
            <div className="font-display text-[9px] tracking-[2px] text-t3">THRU</div>
          </div>
          <div>
            <div className="font-display text-xl leading-none text-text">
              {grossTotal || "—"}
            </div>
            <div className="font-display text-[9px] tracking-[2px] text-t3">GROSS</div>
          </div>
          <div>
            <div className={`font-display text-xl leading-none ${netColor}`}>{toPM(net)}</div>
            <div className="font-display text-[9px] tracking-[2px] text-t3">NET</div>
          </div>
        </div>
      </div>

      {/* ── Hole chip strip — horizontal scroll ──────────────────── */}
      <div
        className="flex gap-1.5 px-3 py-3 overflow-x-auto border-b border-border"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {Array.from({ length: 18 }, (_, i) => {
          const hs       = player.scores[i];
          const isActive = activeHole === i;
          return (
            <button
              key={i}
              onClick={() => setActiveHole(i)}
              className={[
                "shrink-0 w-10 h-10 rounded font-mono text-sm font-bold cursor-pointer",
                "flex items-center justify-center transition-all duration-150",
                isActive
                  ? "border-2 border-gold bg-[#1c1600] text-gold"
                  : hs !== null
                  ? "border border-border2 bg-bg4 text-t2"
                  : "border border-border bg-bg3 text-t3",
              ].join(" ")}
            >
              {hs !== null ? hs : i + 1}
            </button>
          );
        })}
      </div>

      {/* ── Main score entry area ─────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-4">

        {/* Hole info + current-score circle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-5xl leading-none tracking-wide">HOLE {activeHole + 1}</div>
            <div className="text-xs text-t3 mt-1.5">
              Par {par} · {yards[activeHole]}yds · Stroke {HCP_STROKES[activeHole]}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-display text-4xl transition-all duration-200"
              style={{ background: scBg, border: `2px solid ${scColor}`, color: scColor }}
            >
              {s ?? "—"}
            </div>
            {s !== null && (
              <div className="font-display text-[10px] tracking-[2px]" style={{ color: scColor }}>
                {scoreLabel(s, par)}
              </div>
            )}
          </div>
        </div>

        {/* ── CTP block (par 3 only) ──────────────────────────────── */}
        {par === 3 && (() => {
          // Already entered distance
          if (myEntry?.lockedIn && myEntry.feet !== undefined) return (
            <div className="flex items-center gap-3 p-3 rounded-[6px] border border-green-dim bg-[#0d1a0d]">
              <span className="text-xl">📍</span>
              <div className="flex-1">
                <div className="font-display text-[11px] tracking-[3px] text-green mb-0.5">
                  CTP — HOLE {activeHole + 1}
                </div>
                <div className="text-[13px] text-t2">
                  Your distance:{" "}
                  <strong className="text-gold font-display text-base">
                    {myEntry.feet}' {myEntry.inches}"
                  </strong>
                </div>
              </div>
              <span className="font-display text-[10px] tracking-[2px] text-green">ENTERED</span>
            </div>
          );

          // Locked in, needs to enter distance
          if (myEntry?.lockedIn) return (
            <div className="p-3.5 rounded-[6px] border border-gold-dim bg-[#120e00]">
              <div className="font-display text-[11px] tracking-[3px] text-gold mb-2.5">
                📍 CTP — HOLE {activeHole + 1} · ENTER YOUR DISTANCE
              </div>
              <CtpDistanceEntry player={player} holeIdx={activeHole} ctpBet={ctpBet} notify={notify} />
            </div>
          );

          // Not yet locked in
          return (
            <div className="p-3.5 rounded-[6px] border border-border bg-bg2">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-xl">📍</span>
                <div>
                  <div className="font-display text-[13px] tracking-[3px] text-gold">
                    CLOSEST TO PIN — HOLE {activeHole + 1}
                  </div>
                  <div className="text-xs text-t3">Par 3 · Opt in to compete for CTP</div>
                </div>
              </div>
              <button
                className="btn-gold w-full text-[13px] py-3 tracking-[2px]"
                onClick={async () => {
                  const existing = ctpBet || { holeIndex: activeHole, active: true, entries: {} };
                  await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "ctp_bets", ctpKey), {
                    ...existing,
                    entries: {
                      ...(existing.entries || {}),
                      [player.id]: { lockedIn: true, lockedAt: new Date().toISOString() },
                    },
                  });
                  notify("Locked in for CTP! Enter your distance after you play the hole.");
                }}
              >
                🔒 LOCK IN FOR CTP
              </button>
            </div>
          );
        })()}

        {/* ── Score picker grid — 4 cols, min-48px touch targets ── */}
        <div className="grid grid-cols-4 gap-2">
          {scoreOptions.map(n => {
            const isSelected = s === n;
            const c = colorFor(n, par);
            return (
              <button
                key={n}
                onClick={async () => {
                  await updateScore(player.id, activeHole, n);
                  if (activeHole < 17) setActiveHole(h => h + 1);
                }}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg cursor-pointer transition-all duration-150"
                style={{
                  background:  isSelected ? c.border : c.bg,
                  border:      `2px solid ${isSelected ? c.border : c.border + "66"}`,
                  transform:   isSelected ? "scale(1.05)" : "scale(1)",
                  boxShadow:   isSelected ? `0 0 12px ${c.border}55` : "none",
                  minHeight:   68,
                  paddingTop:  16,
                  paddingBottom: 16,
                }}
              >
                <span
                  className="font-mono text-2xl font-bold leading-none"
                  style={{ color: isSelected ? "#060a06" : c.text }}
                >
                  {n}
                </span>
                <span
                  className="font-display text-[8px] tracking-[1px]"
                  style={{ color: isSelected ? "#060a06" : c.text + "99" }}
                >
                  {labelFor(n, par)}
                </span>
              </button>
            );
          })}
        </div>

        {/* CLR button */}
        <button
          onClick={() => updateScore(player.id, activeHole, "")}
          className="font-display text-[11px] tracking-[1px] text-red border border-[#2a1010] bg-transparent rounded-[6px] px-3.5 py-2.5 cursor-pointer"
        >
          CLR
        </button>

        <ScorecardUpload player={player} upload={scorecardUploads[player.id]} notify={notify} />

        <div className="text-center py-2">
          <span
            className="text-xs text-t3 cursor-pointer hover:text-text transition-colors duration-150"
            onClick={() => setScreen("leaderboard")}
          >
            ← Back to Leaderboard
          </span>
        </div>
      </div>

      {/* ── Fixed bottom nav: PREV / NEXT ────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-bg border-t border-border px-4 py-3">
        <div className="flex gap-2 max-w-lg mx-auto">
          <button
            className="btn-ghost flex-1 text-[13px]"
            disabled={activeHole === 0}
            onClick={() => setActiveHole(h => Math.max(0, h - 1))}
          >
            ← PREV
          </button>
          <button
            className="btn-gold flex-1 text-[13px]"
            disabled={activeHole === 17}
            onClick={() => setActiveHole(h => Math.min(17, h + 1))}
          >
            NEXT →
          </button>
        </div>
      </div>
    </div>
  );
}

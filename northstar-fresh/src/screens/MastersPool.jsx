import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { usePlayers } from "../contexts/PlayersContext";
import PinKeypad from "../components/PinKeypad";
import { hashPin } from "../lib/scoring";
import mastersData from "../data/mastersPicks.json";

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;
const MAX_ENTRIES = 40;
const LOCK_TIME = new Date("2026-04-09T06:00:00").getTime();

const ALL_GOLFER_NAMES = mastersData.tiers.flatMap((t) => t.players.map((p) => p.name));

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLocked() {
  return Date.now() >= LOCK_TIME;
}

function golferTotal(golfer) {
  if (!golfer) return null;
  const { r1, r2, r3, r4, missedCut } = golfer;
  const rounds = [r1, r2, r3, r4];
  let total = 0;
  let hasData = false;
  for (const r of rounds) {
    if (r != null && r !== "") {
      total += Number(r);
      hasData = true;
    } else if (missedCut) {
      total += 80;
      hasData = true;
    }
  }
  return hasData ? total : null;
}

function entryBreakdown(entry, scores) {
  const details = mastersData.tiers.map((t) => {
    const name = entry[`tier${t.tier}`];
    const g = scores[name];
    const total = golferTotal(g);
    return { tier: t.tier, name, total, missedCut: g?.missedCut ?? false };
  });

  const sorted = [...details].sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
  const counting = sorted.slice(0, 4);
  const teamTotal = counting.reduce((sum, d) => sum + (d.total ?? 0), 0);

  return { sorted, counting, teamTotal };
}

function emptyPicks() {
  return Object.fromEntries(mastersData.tiers.map((t) => [t.tier, null]));
}

function picksFromEntry(entry) {
  return Object.fromEntries(mastersData.tiers.map((t) => [t.tier, entry[`tier${t.tier}`] ?? null]));
}

// ── LEADERBOARD TAB ───────────────────────────────────────────────────────────

function LeaderboardTab({ entries, scores, loading, winningScore }) {
  const [expanded, setExpanded] = useState(null);

  const ranked = [...entries]
    .map((e) => ({ ...e, ...entryBreakdown(e, scores) }))
    .sort((a, b) => {
      if (a.teamTotal !== b.teamTotal) return a.teamTotal - b.teamTotal;
      if (winningScore == null) return 0;
      const diffA = Math.abs((a.tiebreaker ?? 0) - winningScore);
      const diffB = Math.abs((b.tiebreaker ?? 0) - winningScore);
      return diffA - diffB;
    });

  const pot = entries.length * 10;
  const payouts = [
    Math.floor(pot * 0.6),
    Math.floor(pot * 0.3),
    Math.floor(pot * 0.1),
  ];

  if (loading) {
    return (
      <div className="text-center text-t3 py-12 font-display tracking-widest text-sm pulse">
        LOADING…
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">⛳</div>
        <div className="font-display text-sm tracking-widest text-t3">NO ENTRIES YET</div>
        <div className="text-xs text-t3 mt-1">Switch to Enter Picks to be the first!</div>
      </div>
    );
  }

  if (!isLocked()) {
    return (
      <div>
        <div className="card p-6 text-center mb-4">
          <div className="text-3xl mb-3">🔒</div>
          <div className="font-display text-[15px] tracking-wider mb-1">PICKS HIDDEN</div>
          <div className="text-[12px] text-t2 mb-1">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} submitted
          </div>
          <div className="text-[11px] text-t3">
            Picks are revealed when the pool locks — April 9 at 6:00 AM
          </div>
        </div>
        <div className="card mt-4 p-5">
          <div className="section-label mb-4">PAYOUT BREAKDOWN</div>
          <div className="flex justify-around text-center">
            <div>
              <div className="text-[10px] text-t3 mb-1.5 font-display tracking-wider">1ST · 60%</div>
              <div className="font-display text-3xl text-gold">${payouts[0]}</div>
            </div>
            <div>
              <div className="text-[10px] text-t3 mb-1.5 font-display tracking-wider">2ND · 30%</div>
              <div className="font-display text-2xl text-t2">${payouts[1]}</div>
            </div>
            <div>
              <div className="text-[10px] text-t3 mb-1.5 font-display tracking-wider">3RD · 10%</div>
              <div className="font-display text-xl text-amber">${payouts[2]}</div>
            </div>
          </div>
          <div className="text-center text-[11px] text-t3 mt-4 pt-3 border-t border-border">
            {entries.length} / {MAX_ENTRIES} entries · ${pot} total pot
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Winning score banner */}
      {winningScore != null && (
        <div className="card mb-4 p-3 flex items-center justify-between">
          <div className="text-[11px] text-t3 font-display tracking-wider">WINNING SCORE</div>
          <div className="font-display text-xl text-gold">
            {winningScore > 0 ? `+${winningScore}` : winningScore}
          </div>
        </div>
      )}

      {ranked.map((entry, idx) => {
        const isExp = expanded === entry.id;
        const rankColor =
          idx === 0 ? "text-gold"
          : idx === 1 ? "text-t2"
          : idx === 2 ? "text-amber"
          : "text-t3";

        const tbDiff =
          winningScore != null && entry.tiebreaker != null
            ? Math.abs(entry.tiebreaker - winningScore)
            : null;

        return (
          <div key={entry.id} className="card mb-2 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-3.5 text-left active:opacity-70"
              onClick={() => setExpanded(isExp ? null : entry.id)}
            >
              <div className={`font-display text-[22px] w-7 shrink-0 leading-none ${rankColor}`}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-[15px] tracking-wide truncate">{entry.name}</div>
                <div className="text-[11px] text-t3 mt-0.5 truncate">
                  {entry.counting.map((d) => d.name.split(" ").slice(-1)[0]).join(" · ")}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-[22px] text-gold leading-none">{entry.teamTotal}</div>
                <div className="text-[10px] text-t3 mt-0.5">TEAM TOTAL</div>
              </div>
              <div className="text-t3 text-xs ml-1 shrink-0">{isExp ? "▲" : "▼"}</div>
            </button>

            {isExp && (
              <div className="border-t border-border px-4 pb-4 pt-3">
                <div className="text-[10px] text-t3 font-display tracking-widest mb-3">
                  PICK BREAKDOWN — BEST 4 COUNT
                </div>
                {entry.sorted.map((d, i) => {
                  const isCounting = i < 4;
                  return (
                    <div
                      key={d.name}
                      className={`flex items-center gap-3 py-1.5 ${i === 3 ? "border-b border-border mb-1" : ""}`}
                    >
                      <div className={`text-[10px] font-display tracking-wider w-5 shrink-0 ${isCounting ? "text-green" : "text-t3"}`}>
                        T{d.tier}
                      </div>
                      <div className={`flex-1 text-[13px] ${isCounting ? "text-text" : "text-t3 line-through"}`}>
                        {d.name}
                        {d.missedCut && <span className="text-red ml-1.5 text-[10px]">MC</span>}
                      </div>
                      <div className={`font-display text-[14px] shrink-0 ${isCounting ? "text-gold" : "text-t3"}`}>
                        {d.total == null ? "—" : d.total}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center mt-2.5 pt-1 border-t border-border">
                  <div className="text-[10px] text-t3">Best 4 of 6 · Lowest Wins</div>
                  <div className="font-display text-gold">{entry.teamTotal}</div>
                </div>

                {/* Tiebreaker */}
                <div className="flex justify-between items-center mt-2 pt-1">
                  <div className="text-[10px] text-t3">
                    TIEBREAKER GUESS
                    {tbDiff != null && (
                      <span className="ml-1 text-t3">· off by {tbDiff}</span>
                    )}
                  </div>
                  <div className="font-display text-[13px] text-t2">
                    {entry.tiebreaker != null
                      ? entry.tiebreaker > 0 ? `+${entry.tiebreaker}` : entry.tiebreaker
                      : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="card mt-6 p-5">
        <div className="section-label mb-4">PAYOUT BREAKDOWN</div>
        <div className="flex justify-around text-center">
          <div>
            <div className="text-[10px] text-t3 mb-1.5 font-display tracking-wider">1ST · 60%</div>
            <div className="font-display text-3xl text-gold">${payouts[0]}</div>
          </div>
          <div>
            <div className="text-[10px] text-t3 mb-1.5 font-display tracking-wider">2ND · 30%</div>
            <div className="font-display text-2xl text-t2">${payouts[1]}</div>
          </div>
          <div>
            <div className="text-[10px] text-t3 mb-1.5 font-display tracking-wider">3RD · 10%</div>
            <div className="font-display text-xl text-amber">${payouts[2]}</div>
          </div>
        </div>
        <div className="text-center text-[11px] text-t3 mt-4 pt-3 border-t border-border">
          {entries.length} / {MAX_ENTRIES} entries · ${pot} total pot
        </div>
      </div>
    </div>
  );
}

// ── LOGIN GATE ────────────────────────────────────────────────────────────────

function LoginGate({ onSuccess }) {
  const { players } = usePlayers();
  const { setActivePlayer } = useAuth();
  const [pending, setPending] = useState(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [attempts, setAttempts] = useState({});

  const handleSubmit = async () => {
    if (!pending) return;
    const tries = attempts[pending.id] || 0;
    if (tries >= 5) {
      setPinError("Too many attempts. Ask the commissioner to reset your PIN.");
      return;
    }
    if (pin === ADMIN_PIN) {
      setActivePlayer(pending.id);
      onSuccess(pending);
      return;
    }
    const hash = await hashPin(pin);
    if (hash === pending.pinHash) {
      setActivePlayer(pending.id);
      setAttempts((a) => ({ ...a, [pending.id]: 0 }));
      onSuccess(pending);
    } else {
      const next = tries + 1;
      setAttempts((a) => ({ ...a, [pending.id]: next }));
      setPinError(`Incorrect PIN. ${5 - next} attempt${5 - next === 1 ? "" : "s"} remaining.`);
    }
  };

  if (!pending) {
    return (
      <div className="fade-up max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="font-display text-[13px] tracking-[4px] text-green mb-1.5">MASTERS POOL</div>
          <h2 className="font-display text-[28px] tracking-[2px]">WHO ARE YOU?</h2>
          <div className="text-[12px] text-t3 mt-1">Log in to enter your picks</div>
        </div>
        <div className="card overflow-hidden">
          {players.length === 0 && (
            <div className="p-8 text-center text-t3 text-[14px]">No players registered yet.</div>
          )}
          {players.map((p) => (
            <button
              key={p.id}
              className="player-row w-full px-5 py-4 flex justify-between items-center min-h-[64px] bg-transparent border-none cursor-pointer text-left"
              onClick={() => { setPending(p); setPin(""); setPinError(""); }}
            >
              <div className="text-[17px] font-semibold text-text">{p.name}</div>
              <span className="font-display text-[12px] tracking-[1px] text-gold">SELECT →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up text-center max-w-xs mx-auto">
      <div className="font-display text-[13px] tracking-[4px] text-green mb-2">MASTERS POOL</div>
      <h2 className="font-display text-[28px] tracking-[2px] mb-1">{pending.name}</h2>
      <div className="text-[12px] text-t3 mb-7">Enter your 4-digit PIN to continue</div>
      <div className="card p-7">
        <PinKeypad
          pin={pin}
          onChange={(v) => { setPin(v); setPinError(""); }}
          error={pinError}
          onSubmit={handleSubmit}
          submitLabel="ENTER →"
        />
        <button
          className="btn-ghost w-full text-[12px] mt-2"
          onClick={() => { setPending(null); setPin(""); setPinError(""); }}
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}

// ── READ-ONLY ENTRY VIEW ──────────────────────────────────────────────────────

function LockedEntryView({ entry }) {
  return (
    <div className="max-w-lg mx-auto fade-up">
      <div className="card p-4 mb-3" style={{ borderColor: "var(--gold-dim)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gold text-sm">🔒</span>
          <div className="font-display text-[11px] tracking-wider text-gold">PICKS LOCKED</div>
        </div>
        <div className="text-[12px] text-t3">
          Entries closed April 9 at 2:00 AM. Good luck, {entry.name}!
        </div>
      </div>

      {mastersData.tiers.map((t) => (
        <div key={t.tier} className="mb-3">
          <div className="section-label mb-1.5">{t.label}</div>
          <div className="card px-4 py-3 flex items-center gap-3">
            <div
              className="w-4 h-4 rounded shrink-0 flex items-center justify-center bg-gold border-gold border"
            >
              <span style={{ fontSize: 9, color: "var(--bg)", fontWeight: 700, lineHeight: 1 }}>✓</span>
            </div>
            <div className="flex-1 text-[14px]">{entry[`tier${t.tier}`]}</div>
          </div>
        </div>
      ))}

      <div className="card px-4 py-3 mt-3 flex justify-between items-center">
        <div className="text-[11px] text-t3 font-display tracking-wider">TIEBREAKER GUESS</div>
        <div className="font-display text-[15px] text-t2">
          {entry.tiebreaker != null
            ? entry.tiebreaker > 0 ? `+${entry.tiebreaker}` : entry.tiebreaker
            : "—"}
        </div>
      </div>
    </div>
  );
}

// ── ENTER PICKS TAB ───────────────────────────────────────────────────────────

function EnterPicksTab({ entries, notify }) {
  const { activePlayer } = useAuth();
  const { players } = usePlayers();

  const [picks, setPicks] = useState(emptyPicks);
  const [tiebreaker, setTiebreaker] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const locked = isLocked();
  const player = players.find((p) => p.id === activePlayer) ?? null;
  const existingEntry = entries.find((e) => e.playerId === activePlayer) ?? null;

  // Pre-load existing entry when player logs in
  useEffect(() => {
    if (existingEntry) {
      setPicks(picksFromEntry(existingEntry));
      setTiebreaker(existingEntry.tiebreaker ?? "");
    } else {
      setPicks(emptyPicks());
      setTiebreaker("");
    }
  }, [activePlayer, existingEntry?.id]);

  const isFull = !existingEntry && entries.length >= MAX_ENTRIES;
  const allPicked = mastersData.tiers.every((t) => picks[t.tier] != null);
  const isEditing = !!existingEntry;

  const togglePick = (tierNum, playerName) => {
    setPicks((prev) => ({
      ...prev,
      [tierNum]: prev[tierNum] === playerName ? null : playerName,
    }));
  };

  const submit = async () => {
    if (!player) return;
    if (!allPicked) { notify("Pick one golfer from every tier", "error"); return; }
    if (tiebreaker === "" || tiebreaker == null) {
      notify("Enter your tiebreaker guess", "error");
      return;
    }
    setSubmitting(true);
    try {
      // Reuse existing id when editing, generate new one otherwise
      const id = existingEntry ? existingEntry.id : `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tierFields = Object.fromEntries(
        mastersData.tiers.map((t) => [`tier${t.tier}`, picks[t.tier]])
      );
      await setDoc(doc(db, "masters_entries", id), {
        id,
        playerId: activePlayer,
        name: player.name,
        ...tierFields,
        tiebreaker: parseInt(tiebreaker),
        submittedAt: Date.now(),
      });
      notify(isEditing ? "Picks updated! ⛳" : "Entry submitted! Good luck! ⛳");
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      notify("Failed to submit — check connection", "error");
    }
    setSubmitting(false);
  };

  // Gate: must be logged in
  if (!activePlayer) {
    return <LoginGate onSuccess={() => {}} />;
  }

  // After deadline with existing entry → read-only
  if (locked && existingEntry) {
    return <LockedEntryView entry={existingEntry} />;
  }

  // After deadline, no entry → closed
  if (locked && !existingEntry) {
    return (
      <div className="max-w-sm mx-auto text-center py-10">
        <div className="text-4xl mb-3">🔒</div>
        <div className="font-display text-xl tracking-wider text-red mb-2">ENTRIES CLOSED</div>
        <div className="text-t3 text-sm">The pool locked on April 9 at 2:00 AM.</div>
      </div>
    );
  }

  // Pool full (and no existing entry to edit)
  if (isFull) {
    return (
      <div className="max-w-sm mx-auto text-center py-10">
        <div className="text-4xl mb-3">🔒</div>
        <div className="font-display text-xl tracking-wider text-red mb-2">POOL IS FULL</div>
        <div className="text-t3 text-sm">{MAX_ENTRIES} entries have been submitted.</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-sm mx-auto text-center py-10 fade-up">
        <div className="text-5xl mb-4">🏆</div>
        <div className="font-display text-[28px] tracking-wide mb-2">
          {isEditing ? "PICKS UPDATED!" : "YOU'RE IN!"}
        </div>
        <div className="text-t2 text-sm mb-6">Good luck at Augusta, {player?.name ?? ""}.</div>
        <button
          className="btn-ghost btn-sm"
          onClick={() => setSubmitted(false)}
        >
          {isEditing ? "Edit Again" : "View My Picks"}
        </button>
      </div>
    );
  }

  const tiersRemaining = mastersData.tiers.filter((t) => !picks[t.tier]).length;

  return (
    <div className="max-w-lg mx-auto fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <div className="text-[11px] text-t3 font-display tracking-wider">
            {isEditing ? "EDITING ENTRY" : "ENTERING AS"}
          </div>
          <div className="font-display text-[18px] tracking-wide text-gold">{player?.name}</div>
        </div>
        <div className="text-[11px] text-t3">{entries.length} / {MAX_ENTRIES} entries</div>
      </div>

      {isEditing && (
        <div className="card p-3 mb-4 flex items-center gap-2" style={{ borderColor: "var(--gold-dim)" }}>
          <span className="text-gold text-xs">✏️</span>
          <div className="text-[11px] text-t2">
            You've already entered. Changes are allowed until April 9 at 2:00 AM.
          </div>
        </div>
      )}

      {/* Tier sections */}
      {mastersData.tiers.map((tier) => (
        <div key={tier.tier} className="mb-4">
          <div className="section-label mb-2">{tier.label} — PICK {tier.picks}</div>
          <div className="card overflow-hidden">
            {tier.players.map((p) => {
              const isSelected = picks[tier.tier] === p.name;
              return (
                <button
                  key={p.name}
                  className={[
                    "w-full flex items-center gap-3 px-4 min-h-[44px] text-left border-none cursor-pointer transition-colors active:opacity-70",
                    isSelected
                      ? "bg-bg3 border-l-2 border-l-gold"
                      : "bg-transparent border-l-2 border-l-transparent",
                  ].join(" ")}
                  onClick={() => togglePick(tier.tier, p.name)}
                >
                  <div
                    className={[
                      "w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors",
                      isSelected ? "bg-gold border-gold" : "border-border2 bg-bg4",
                    ].join(" ")}
                  >
                    {isSelected && (
                      <span style={{ fontSize: 9, color: "var(--bg)", fontWeight: 700, lineHeight: 1 }}>
                        ✓
                      </span>
                    )}
                  </div>
                  <div className={`flex-1 text-[14px] ${isSelected ? "text-text" : "text-t2"}`}>
                    {p.name}
                  </div>
                  <div className="text-[11px] text-t3 w-8 text-right shrink-0">
                    {p.wr != null ? `#${p.wr}` : "—"}
                  </div>
                  <div className="text-[11px] text-t2 w-14 text-right shrink-0 font-mono">
                    {p.odds}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Tiebreaker */}
      <div className="card p-4 mb-4">
        <label className="text-[11px] text-t2 font-display tracking-wider block mb-1.5">
          TIEBREAKER — Winning score (relative to par, e.g. −16)
        </label>
        <input
          type="number"
          className="w-full text-center"
          placeholder="e.g. -16"
          value={tiebreaker}
          onChange={(e) => setTiebreaker(e.target.value)}
          style={{ fontSize: 22, letterSpacing: 2 }}
        />
        <div className="text-[11px] text-t3 text-center mt-1.5">
          Closest guess breaks ties between equal team totals
        </div>
      </div>

      {/* Submit */}
      <div className="sticky bottom-20 md:bottom-4 pt-2 pb-1">
        <button
          className="btn-gold w-full"
          onClick={submit}
          disabled={submitting || !allPicked || tiebreaker === ""}
          style={{ opacity: allPicked && tiebreaker !== "" ? 1 : 0.5 }}
        >
          {submitting
            ? "SUBMITTING…"
            : !allPicked
            ? `${tiersRemaining} TIER${tiersRemaining === 1 ? "" : "S"} REMAINING`
            : tiebreaker === ""
            ? "ENTER TIEBREAKER TO SUBMIT"
            : isEditing
            ? "UPDATE MY PICKS"
            : "SUBMIT PICKS — $10 ENTRY"}
        </button>
      </div>

      {/* Rules */}
      <div className="card p-4 mt-3 mb-6">
        <div className="section-label mb-3">POOL RULES</div>
        <div className="space-y-1.5 text-[12px] text-t2">
          <div>Pick 1 golfer from each of 6 tiers</div>
          <div>Best 4 of 6 scores count toward your team total</div>
          <div>Missed cut = +80 per remaining round</div>
          <div>Lowest team total wins · tiebreaker: closest winning score (relative to par)</div>
          <div>$10 entry · up to {MAX_ENTRIES} people</div>
          <div>Picks lock April 9 at 2:00 AM</div>
          <div className="pt-1 text-t3">Payout: 60% / 30% / 10%</div>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN TAB ─────────────────────────────────────────────────────────────────

function AdminTab({ entries, scores, notify }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [localScores, setLocalScores] = useState({});
  const [winningScoreInput, setWinningScoreInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (unlocked) {
      const init = {};
      ALL_GOLFER_NAMES.forEach((name) => {
        const g = scores[name] || {};
        init[name] = {
          r1: g.r1 ?? "",
          r2: g.r2 ?? "",
          r3: g.r3 ?? "",
          r4: g.r4 ?? "",
          missedCut: g.missedCut ?? false,
        };
      });
      setLocalScores(init);
      setWinningScoreInput(scores.winningScore ?? "");
    }
  }, [unlocked, scores]);

  const tryUnlock = () => {
    if (pin === ADMIN_PIN) { setUnlocked(true); setPinError(false); }
    else setPinError(true);
  };

  const updateGolfer = (name, field, val) => {
    setLocalScores((s) => ({ ...s, [name]: { ...s[name], [field]: val } }));
  };

  const saveAllScores = async () => {
    setSaving(true);
    try {
      const clean = {};
      ALL_GOLFER_NAMES.forEach((name) => {
        const g = localScores[name] || {};
        clean[name] = {
          r1: g.r1 !== "" && g.r1 != null ? parseInt(g.r1) : null,
          r2: g.r2 !== "" && g.r2 != null ? parseInt(g.r2) : null,
          r3: g.r3 !== "" && g.r3 != null ? parseInt(g.r3) : null,
          r4: g.r4 !== "" && g.r4 != null ? parseInt(g.r4) : null,
          missedCut: !!g.missedCut,
        };
      });
      if (winningScoreInput !== "" && winningScoreInput != null) {
        clean.winningScore = parseInt(winningScoreInput);
      }
      await setDoc(doc(db, "masters_pool", "scores"), clean);
      notify("Scores saved!");
    } catch (e) {
      console.error(e);
      notify("Failed to save scores", "error");
    }
    setSaving(false);
  };

  const deleteEntry = async (id, name) => {
    try {
      await deleteDoc(doc(db, "masters_entries", id));
      notify(`Deleted entry for ${name}`);
    } catch (e) {
      notify("Failed to delete entry", "error");
    }
  };

  if (!unlocked) {
    return (
      <div className="max-w-xs mx-auto text-center fade-up">
        <div className="font-display text-[12px] tracking-[4px] text-green mb-2.5">
          COMMISSIONER ACCESS
        </div>
        <h2 className="font-display text-[28px] mb-6">ADMIN LOGIN</h2>
        <div className="card p-7">
          <div className="section-label text-left">PIN</div>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") tryUnlock(); }}
            placeholder="••••"
            className="w-full text-center mb-2.5"
            style={{ fontSize: 24, letterSpacing: 8 }}
          />
          {pinError && <div className="text-red text-[13px] mb-2.5">Incorrect PIN.</div>}
          <button className="btn-gold w-full" onClick={tryUnlock}>UNLOCK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      {/* Winning score */}
      <div className="section-label mb-2">TOURNAMENT RESULT</div>
      <div className="card p-4 mb-6">
        <label className="text-[11px] text-t2 font-display tracking-wider block mb-1.5">
          WINNING SCORE (relative to par, e.g. −16)
        </label>
        <input
          type="number"
          className="w-full text-center"
          placeholder="e.g. -16"
          value={winningScoreInput}
          onChange={(e) => setWinningScoreInput(e.target.value)}
          style={{ fontSize: 22, letterSpacing: 2 }}
        />
        <div className="text-[11px] text-t3 mt-1.5">
          Used to resolve tiebreakers — set after the tournament ends.
        </div>
      </div>

      {/* Golfer scores */}
      <div className="section-label mb-2">ENTER GOLFER SCORES</div>
      <div className="text-[11px] text-t3 mb-4">
        Enter raw round scores (e.g. 68, 71). Check MC for missed cut — +80 added per remaining round.
      </div>

      {mastersData.tiers.map((t) => (
        <div key={t.tier} className="card mb-4 p-4">
          <div className="text-[11px] text-green font-display tracking-widest mb-3">
            {t.label.toUpperCase()}
          </div>
          {t.players.map(({ name }) => {
            const g = localScores[name] || { r1: "", r2: "", r3: "", r4: "", missedCut: false };
            return (
              <div key={name} className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="text-[13px] min-w-[160px] shrink-0">{name}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["r1", "r2", "r3", "r4"].map((r) => (
                    <div key={r} className="flex flex-col items-center gap-0.5">
                      <div className="text-[9px] text-t3 font-display tracking-wider">{r.toUpperCase()}</div>
                      <input
                        type="number"
                        value={g[r] ?? ""}
                        onChange={(e) => updateGolfer(name, r, e.target.value)}
                        className="sc-input w-12 text-center text-sm"
                        placeholder="—"
                        min={55}
                        max={99}
                      />
                    </div>
                  ))}
                  <label className="flex items-center gap-1.5 text-[11px] text-t2 cursor-pointer ml-1">
                    <input
                      type="checkbox"
                      checked={!!g.missedCut}
                      onChange={(e) => updateGolfer(name, "missedCut", e.target.checked)}
                      className="accent-red"
                    />
                    <span className="text-red">MC</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <button className="btn-gold w-full mb-8" onClick={saveAllScores} disabled={saving}>
        {saving ? "SAVING…" : "SAVE ALL SCORES"}
      </button>

      <div className="section-label mb-3">MANAGE ENTRIES ({entries.length})</div>
      {entries.length === 0 && (
        <div className="text-t3 text-sm text-center py-6">No entries yet.</div>
      )}
      {[...entries]
        .sort((a, b) => a.submittedAt - b.submittedAt)
        .map((e) => (
          <div key={e.id} className="card flex items-center justify-between gap-3 p-3 mb-2">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold truncate">{e.name}</div>
              <div className="text-[10px] text-t3 mt-0.5">
                {new Date(e.submittedAt).toLocaleString()}
                {e.tiebreaker != null && (
                  <span className="ml-2 text-t3">
                    TB: {e.tiebreaker > 0 ? `+${e.tiebreaker}` : e.tiebreaker}
                  </span>
                )}
              </div>
            </div>
            <button
              className="btn-danger btn-sm shrink-0"
              onClick={() => deleteEntry(e.id, e.name)}
            >
              DELETE
            </button>
          </div>
        ))}
    </div>
  );
}

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function MastersPool({ notify }) {
  const [tab, setTab] = useState("leaderboard");
  const [entries, setEntries] = useState([]);
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubEntries = onSnapshot(collection(db, "masters_entries"), (snap) => {
      setEntries(snap.docs.map((d) => d.data()));
      setLoading(false);
    });
    const unsubScores = onSnapshot(doc(db, "masters_pool", "scores"), (snap) => {
      setScores(snap.exists() ? snap.data() : {});
    });
    return () => { unsubEntries(); unsubScores(); };
  }, []);

  const winningScore = scores.winningScore ?? null;

  const tabBtn = (id, label) => (
    <button
      key={id}
      className={[
        "flex-1 py-2.5 font-display text-[11px] tracking-[1.5px] border-b-2 transition-colors",
        tab === id ? "border-gold text-gold" : "border-transparent text-t3",
      ].join(" ")}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="fade-up">
      <div className="text-center mb-6">
        <div className="font-display text-[11px] tracking-[4px] text-green mb-1">APRIL 2026</div>
        <h1 className="font-display text-[32px] md:text-[42px] tracking-[2px] leading-none">
          MASTERS POOL
        </h1>
        <div className="text-xs text-t2 mt-2">
          Pick 6 · Best 4 Count · $10 Entry · Lowest Score Wins
        </div>
      </div>

      <div className="flex border-b border-border mb-5">
        {tabBtn("leaderboard", "🏆 LEADERBOARD")}
        {tabBtn("picks", "⛳ ENTER PICKS")}
        {tabBtn("admin", "⚙ ADMIN")}
      </div>

      {tab === "leaderboard" && (
        <LeaderboardTab
          entries={entries}
          scores={scores}
          loading={loading}
          winningScore={winningScore}
        />
      )}
      {tab === "picks" && (
        <EnterPicksTab entries={entries} notify={notify} />
      )}
      {tab === "admin" && (
        <AdminTab entries={entries} scores={scores} notify={notify} />
      )}
    </div>
  );
}

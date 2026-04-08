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

const ALL_GOLFER_NAMES = mastersData.tiers.flatMap((t) => t.players.map((p) => p.name));

// ── Scoring helpers ───────────────────────────────────────────────────────────

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

// ── LEADERBOARD TAB ───────────────────────────────────────────────────────────

function LeaderboardTab({ entries, scores, loading }) {
  const [expanded, setExpanded] = useState(null);

  const ranked = [...entries]
    .map((e) => ({ ...e, ...entryBreakdown(e, scores) }))
    .sort((a, b) => a.teamTotal - b.teamTotal);

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

  return (
    <div>
      {ranked.map((entry, idx) => {
        const isExp = expanded === entry.id;
        const rankColor =
          idx === 0 ? "text-gold"
          : idx === 1 ? "text-t2"
          : idx === 2 ? "text-amber"
          : "text-t3";

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
                        {d.missedCut && (
                          <span className="text-red ml-1.5 text-[10px]">MC</span>
                        )}
                      </div>
                      <div className={`font-display text-[14px] shrink-0 ${isCounting ? "text-gold" : "text-t3"}`}>
                        {d.total == null ? "—" : d.total}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center mt-2.5 pt-1">
                  <div className="text-[10px] text-t3">Best 4 of 6 · Lowest Wins</div>
                  <div className="font-display text-gold">{entry.teamTotal}</div>
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

// ── LOGIN GATE (mirrors MyScoresLogin pattern) ────────────────────────────────

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
            <div className="p-8 text-center text-t3 text-[14px]">
              No players registered yet.
            </div>
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

// ── ENTER PICKS TAB ───────────────────────────────────────────────────────────

function EnterPicksTab({ entries, notify }) {
  const { activePlayer, setActivePlayer } = useAuth();
  const { players } = usePlayers();

  // picks keyed by tier number: { 1: "Player Name" | null, ... }
  const emptyPicks = () =>
    Object.fromEntries(mastersData.tiers.map((t) => [t.tier, null]));

  const [picks, setPicks] = useState(emptyPicks);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const player = players.find((p) => p.id === activePlayer) ?? null;
  const isFull = entries.length >= MAX_ENTRIES;
  const allPicked = mastersData.tiers.every((t) => picks[t.tier] != null);

  const togglePick = (tierNum, playerName) => {
    setPicks((prev) => ({
      ...prev,
      [tierNum]: prev[tierNum] === playerName ? null : playerName,
    }));
  };

  const submit = async () => {
    if (!player) return;
    if (!allPicked) { notify("Pick one golfer from every tier", "error"); return; }
    setSubmitting(true);
    try {
      const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tierFields = Object.fromEntries(
        mastersData.tiers.map((t) => [`tier${t.tier}`, picks[t.tier]])
      );
      await setDoc(doc(db, "masters_entries", id), {
        id,
        name: player.name,
        ...tierFields,
        submittedAt: Date.now(),
      });
      notify("Entry submitted! Good luck! ⛳");
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

  if (submitted) {
    return (
      <div className="max-w-sm mx-auto text-center py-10 fade-up">
        <div className="text-5xl mb-4">🏆</div>
        <div className="font-display text-[28px] tracking-wide mb-2">YOU'RE IN!</div>
        <div className="text-t2 text-sm mb-6">Good luck at Augusta, {player?.name ?? ""}.</div>
        <button
          className="btn-ghost btn-sm"
          onClick={() => { setSubmitted(false); setPicks(emptyPicks()); }}
        >
          Submit Another Entry
        </button>
      </div>
    );
  }

  if (isFull) {
    return (
      <div className="max-w-sm mx-auto text-center py-10">
        <div className="text-4xl mb-3">🔒</div>
        <div className="font-display text-xl tracking-wider text-red mb-2">POOL IS FULL</div>
        <div className="text-t3 text-sm">{MAX_ENTRIES} entries have been submitted.</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto fade-up">
      {/* Who's entering */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <div className="text-[11px] text-t3 font-display tracking-wider">ENTERING AS</div>
          <div className="font-display text-[18px] tracking-wide text-gold">{player?.name}</div>
        </div>
        <div className="text-[11px] text-t3">{entries.length} / {MAX_ENTRIES} entries</div>
      </div>

      {/* Tier sections */}
      {mastersData.tiers.map((tier) => (
        <div key={tier.tier} className="mb-4">
          <div className="section-label mb-2">
            {tier.label} — PICK {tier.picks}
          </div>
          <div className="card overflow-hidden">
            {tier.players.map((player) => {
              const isSelected = picks[tier.tier] === player.name;
              return (
                <button
                  key={player.name}
                  className={[
                    "w-full flex items-center gap-3 px-4 min-h-[44px] text-left border-none cursor-pointer transition-colors active:opacity-70",
                    isSelected
                      ? "bg-bg3 border-l-2 border-l-gold"
                      : "bg-transparent border-l-2 border-l-transparent",
                  ].join(" ")}
                  onClick={() => togglePick(tier.tier, player.name)}
                >
                  {/* Checkbox */}
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

                  {/* Name */}
                  <div className={`flex-1 text-[14px] ${isSelected ? "text-text" : "text-t2"}`}>
                    {player.name}
                  </div>

                  {/* WR */}
                  <div className="text-[11px] text-t3 w-8 text-right shrink-0">
                    {player.wr != null ? `#${player.wr}` : "—"}
                  </div>

                  {/* Odds */}
                  <div className="text-[11px] text-t2 w-14 text-right shrink-0 font-mono">
                    {player.odds}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Submit */}
      <div className="sticky bottom-20 md:bottom-4 pt-2 pb-1">
        <button
          className="btn-gold w-full"
          onClick={submit}
          disabled={submitting || !allPicked}
          style={{ opacity: allPicked ? 1 : 0.5 }}
        >
          {submitting
            ? "SUBMITTING…"
            : allPicked
            ? "SUBMIT PICKS — $10 ENTRY"
            : `${mastersData.tiers.filter((t) => !picks[t.tier]).length} TIER${mastersData.tiers.filter((t) => !picks[t.tier]).length === 1 ? "" : "S"} REMAINING`}
        </button>
      </div>

      {/* Rules */}
      <div className="card p-4 mt-3 mb-6">
        <div className="section-label mb-3">POOL RULES</div>
        <div className="space-y-1.5 text-[12px] text-t2">
          <div>Pick 1 golfer from each of 6 tiers</div>
          <div>Best 4 of 6 scores count toward your team total</div>
          <div>Missed cut = +80 per remaining round</div>
          <div>Lowest team total wins</div>
          <div>$10 entry · up to {MAX_ENTRIES} people</div>
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
        <LeaderboardTab entries={entries} scores={scores} loading={loading} />
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

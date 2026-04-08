import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;
const MAX_ENTRIES = 40;

const TIERS = [
  {
    tier: 1,
    label: "Tier 1 — The Favorites",
    golfers: ["Scottie Scheffler", "Jon Rahm", "Bryson DeChambeau", "Rory McIlroy"],
  },
  {
    tier: 2,
    label: "Tier 2 — Contenders",
    golfers: ["Xander Schauffele", "Collin Morikawa", "Viktor Hovland", "Ludvig Åberg"],
  },
  {
    tier: 3,
    label: "Tier 3 — Dark Horses",
    golfers: ["Tommy Fleetwood", "Patrick Cantlay", "Shane Lowry", "Cameron Smith"],
  },
  {
    tier: 4,
    label: "Tier 4 — Former Champs",
    golfers: ["Jordan Spieth", "Hideki Matsuyama", "Justin Thomas", "Brooks Koepka"],
  },
  {
    tier: 5,
    label: "Tier 5 — Longshots",
    golfers: ["Tony Finau", "Jason Day", "Min Woo Lee", "Corey Conners"],
  },
  {
    tier: 6,
    label: "Tier 6 — The Field",
    golfers: [
      "Wyndham Clark", "Tom Kim", "Sahith Theegala", "Harris English",
      "Adam Scott", "Sepp Straka", "Russell Henley", "Si Woo Kim",
    ],
  },
];

const ALL_GOLFERS = TIERS.flatMap((t) => t.golfers);

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
  const details = TIERS.map((t) => {
    const name = entry[`tier${t.tier}`];
    const g = scores[name];
    const total = golferTotal(g);
    return {
      tier: t.tier,
      name,
      total,
      missedCut: g?.missedCut ?? false,
    };
  });

  // Sort by total ascending (null/no-score treated as 0 for sorting)
  const sorted = [...details].sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
  const counting = sorted.slice(0, 4);
  const dropped = sorted.slice(4);
  const teamTotal = counting.reduce((sum, d) => sum + (d.total ?? 0), 0);

  return { sorted, counting, dropped, teamTotal };
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
          idx === 0 ? "text-gold" : idx === 1 ? "text-t2" : idx === 2 ? "text-amber" : "text-t3";

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
                      <div
                        className={`text-[10px] font-display tracking-wider w-5 shrink-0 ${
                          isCounting ? "text-green" : "text-t3"
                        }`}
                      >
                        T{d.tier}
                      </div>
                      <div
                        className={`flex-1 text-[13px] ${
                          isCounting ? "text-text" : "text-t3 line-through"
                        }`}
                      >
                        {d.name}
                        {d.missedCut && (
                          <span className="text-red ml-1.5 text-[10px] no-underline not-italic">
                            MC
                          </span>
                        )}
                      </div>
                      <div
                        className={`font-display text-[14px] shrink-0 ${
                          isCounting ? "text-gold" : "text-t3"
                        }`}
                      >
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

      {/* Payout */}
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

function EnterPicksTab({ entries, notify, activePlayer, players }) {
  const [name, setName] = useState("");
  const [picks, setPicks] = useState({ tier1: "", tier2: "", tier3: "", tier4: "", tier5: "", tier6: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill name if logged in
  useEffect(() => {
    if (activePlayer && players) {
      const p = players.find((pl) => pl.id === activePlayer);
      if (p) setName(p.name);
    }
  }, [activePlayer, players]);

  const isFull = entries.length >= MAX_ENTRIES;
  const chosen = Object.values(picks).filter(Boolean);

  const submit = async () => {
    if (!name.trim()) { notify("Please enter your name", "error"); return; }
    for (const t of TIERS) {
      if (!picks[`tier${t.tier}`]) {
        notify(`Pick a golfer for ${t.label}`, "error");
        return;
      }
    }
    if (new Set(chosen).size !== chosen.length) {
      notify("You can't pick the same golfer twice", "error");
      return;
    }
    setSubmitting(true);
    try {
      const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await setDoc(doc(db, "masters_entries", id), {
        id,
        name: name.trim(),
        ...picks,
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

  if (submitted) {
    return (
      <div className="max-w-sm mx-auto text-center py-10">
        <div className="text-5xl mb-4">🏆</div>
        <div className="font-display text-[28px] tracking-wide mb-2">YOU'RE IN!</div>
        <div className="text-t2 text-sm mb-6">Good luck at Augusta, {name.trim()}.</div>
        <button className="btn-ghost btn-sm" onClick={() => setSubmitted(false)}>
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
    <div className="max-w-lg mx-auto">
      <div className="card p-5 mb-4">
        <div className="section-label mb-4">YOUR ENTRY</div>

        <div className="mb-5">
          <label className="text-[11px] text-t2 font-display tracking-wider block mb-1.5">
            YOUR NAME
          </label>
          <input
            className="w-full"
            placeholder="First Last"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {TIERS.map((t) => {
          const key = `tier${t.tier}`;
          return (
            <div key={t.tier} className="mb-4">
              <label className="text-[11px] text-t2 font-display tracking-wider block mb-1.5">
                {t.label}
              </label>
              <select
                className="w-full bg-bg3 border border-border rounded px-3 py-2.5 text-sm text-text"
                style={{ appearance: "none" }}
                value={picks[key]}
                onChange={(e) => setPicks((p) => ({ ...p, [key]: e.target.value }))}
              >
                <option value="">— Pick one —</option>
                {t.golfers.map((g) => {
                  const alreadyPicked = chosen.includes(g) && picks[key] !== g;
                  return (
                    <option key={g} value={g} disabled={alreadyPicked}>
                      {g}
                      {alreadyPicked ? " (already picked)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        })}

        <div className="text-[11px] text-t3 text-center mb-3">
          {entries.length} / {MAX_ENTRIES} entries submitted
        </div>

        <button
          className="btn-gold w-full"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "SUBMITTING…" : "SUBMIT PICKS — $10 ENTRY"}
        </button>
      </div>

      {/* Rules card */}
      <div className="card p-4">
        <div className="section-label mb-3">POOL RULES</div>
        <div className="space-y-1.5 text-[12px] text-t2">
          <div>Pick 1 golfer from each of 6 tiers</div>
          <div>Best 4 of 6 scores count toward your team total</div>
          <div>Missed cut = +80 per remaining round</div>
          <div>Lowest team total wins — lowest score wins!</div>
          <div>$10 entry · up to {MAX_ENTRIES} people</div>
          <div className="pt-1 text-t3">Payout: 60% / 30% / 10%</div>
        </div>
      </div>
    </div>
  );
}

function AdminTab({ entries, scores, notify }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [localScores, setLocalScores] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (unlocked) {
      const init = {};
      ALL_GOLFERS.forEach((name) => {
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
      ALL_GOLFERS.forEach((name) => {
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
      {/* Score entry */}
      <div className="section-label mb-4">ENTER GOLFER SCORES</div>
      <div className="text-[11px] text-t3 mb-4">
        Enter raw round scores (e.g. 68, 71). Check MC for missed cut — +80 added per remaining round.
      </div>

      {TIERS.map((t) => (
        <div key={t.tier} className="card mb-4 p-4">
          <div className="text-[11px] text-green font-display tracking-widest mb-3">
            {t.label.toUpperCase()}
          </div>
          {t.golfers.map((name) => {
            const g = localScores[name] || { r1: "", r2: "", r3: "", r4: "", missedCut: false };
            return (
              <div key={name} className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="text-[13px] min-w-[140px] shrink-0">{name}</div>
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

      {/* Entry management */}
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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MastersPool({ notify, activePlayer, players }) {
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
      {/* Header */}
      <div className="text-center mb-6">
        <div className="font-display text-[11px] tracking-[4px] text-green mb-1">APRIL 2026</div>
        <h1 className="font-display text-[32px] md:text-[42px] tracking-[2px] leading-none">
          MASTERS POOL
        </h1>
        <div className="text-xs text-t2 mt-2">
          Pick 6 · Best 4 Count · $10 Entry · Lowest Score Wins
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {tabBtn("leaderboard", "🏆 LEADERBOARD")}
        {tabBtn("picks", "⛳ ENTER PICKS")}
        {tabBtn("admin", "⚙ ADMIN")}
      </div>

      {tab === "leaderboard" && (
        <LeaderboardTab entries={entries} scores={scores} loading={loading} />
      )}
      {tab === "picks" && (
        <EnterPicksTab
          entries={entries}
          notify={notify}
          activePlayer={activePlayer}
          players={players}
        />
      )}
      {tab === "admin" && (
        <AdminTab entries={entries} scores={scores} notify={notify} />
      )}
    </div>
  );
}

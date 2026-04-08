import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { hashPin } from "../lib/scoring";

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;

// ── Default Masters 2026 field (admin can override scores) ────────────────────
const DEFAULT_GOLFERS = [
  // Tier 1 — Favorites
  { id: "scheffler",   name: "Scottie Scheffler",  country: "🇺🇸", tier: 1 },
  { id: "mcilroy",     name: "Rory McIlroy",        country: "🇬🇧", tier: 1 },
  { id: "rahm",        name: "Jon Rahm",            country: "🇪🇸", tier: 1 },
  { id: "schauffele",  name: "Xander Schauffele",   country: "🇺🇸", tier: 1 },
  { id: "morikawa",   name: "Collin Morikawa",     country: "🇺🇸", tier: 1 },
  { id: "hovland",     name: "Viktor Hovland",      country: "🇳🇴", tier: 1 },
  { id: "aberg",       name: "Ludvig Åberg",        country: "🇸🇪", tier: 1 },
  { id: "dechambeau",  name: "Bryson DeChambeau",   country: "🇺🇸", tier: 1 },
  // Tier 2 — Contenders
  { id: "spieth",      name: "Jordan Spieth",       country: "🇺🇸", tier: 2 },
  { id: "jthomas",    name: "Justin Thomas",       country: "🇺🇸", tier: 2 },
  { id: "koepka",      name: "Brooks Koepka",       country: "🇺🇸", tier: 2 },
  { id: "cantlay",     name: "Patrick Cantlay",     country: "🇺🇸", tier: 2 },
  { id: "fleetwood",  name: "Tommy Fleetwood",    country: "🇬🇧", tier: 2 },
  { id: "burns",       name: "Sam Burns",           country: "🇺🇸", tier: 2 },
  { id: "lowry",       name: "Shane Lowry",         country: "🇮🇪", tier: 2 },
  { id: "matsuyama",  name: "Hideki Matsuyama",   country: "🇯🇵", tier: 2 },
  // Tier 3 — Longshots
  { id: "jday",        name: "Jason Day",           country: "🇦🇺", tier: 3 },
  { id: "finau",       name: "Tony Finau",          country: "🇺🇸", tier: 3 },
  { id: "homa",        name: "Max Homa",            country: "🇺🇸", tier: 3 },
  { id: "conners",     name: "Corey Conners",       country: "🇨🇦", tier: 3 },
  { id: "ascott",      name: "Adam Scott",          country: "🇦🇺", tier: 3 },
  { id: "mickelson",  name: "Phil Mickelson",      country: "🇺🇸", tier: 3 },
  { id: "woods",       name: "Tiger Woods",         country: "🇺🇸", tier: 3 },
  { id: "csmith",      name: "Cameron Smith",       country: "🇦🇺", tier: 3 },
  { id: "djohnson",   name: "Dustin Johnson",      country: "🇺🇸", tier: 3 },
  { id: "zalatoris",  name: "Will Zalatoris",      country: "🇺🇸", tier: 3 },
  { id: "cyoung",      name: "Cameron Young",       country: "🇺🇸", tier: 3 },
  { id: "bhatia",      name: "Akshay Bhatia",       country: "🇺🇸", tier: 3 },
  { id: "hojgaard",   name: "Nicolai Højgaard",   country: "🇩🇰", tier: 3 },
  { id: "harris",      name: "Harris English",      country: "🇺🇸", tier: 3 },
];

const TIER_INFO = {
  1: { label: "TIER 1 — FAVORITES",   color: "var(--gold)",  picks: 2 },
  2: { label: "TIER 2 — CONTENDERS",  color: "var(--green)", picks: 2 },
  3: { label: "TIER 3 — LONGSHOTS",   color: "var(--t2)",    picks: 2 },
};

// ── Funny golf team name generator ───────────────────────────────────────────
const ADJ = [
  "Birdie", "Bogey", "Eagle", "Shanked", "Mulligan", "Sand Trap", "Amen Corner",
  "Plaid", "Green Jacket", "Azalea", "Dogleg", "Bunker", "Scratch", "Yippy",
  "Fat Shot", "Gimme", "Lip Out", "Duffed", "Provisional", "Fore!",
  "Back Nine", "Mudball", "Shaggy", "Soggy", "Crusty", "Sketchy", "Lucky",
];
const NOUN = [
  "Bandits", "Hackers", "Duffers", "Gang", "Crew", "Squad", "Syndicate",
  "Brigade", "Outlaws", "Caddies", "Greenies", "Bogeymen", "Crushers",
  "Warriors", "Legends", "Posse", "Wolves", "Sharks", "Rippers", "Chumps",
  "Dreamers", "Underdogs", "Believers", "Contenders", "Desperados",
];
const genName = () => `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const toPM = v =>
  v === null || v === undefined || isNaN(v) ? "—"
  : v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`;

function calcEntryScore(entry, golferMap) {
  const allPicks = Object.values(entry.picks || {}).flat();
  if (!allPicks.length) return null;
  let total = 0, hasAny = false;
  allPicks.forEach(id => {
    const g = golferMap[id];
    if (g && g.score !== null && g.score !== undefined) {
      total += Number(g.score);
      hasAny = true;
    }
  });
  return hasAny ? total : null;
}

function displayName(entry) {
  return entry.teamName?.trim() || entry.realName || "Anonymous";
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MastersPool({ notify }) {
  const [tab, setTab]           = useState("leaderboard");
  const [entries, setEntries]   = useState([]);
  const [golfers, setGolfers]   = useState(DEFAULT_GOLFERS.map(g => ({ ...g, score: null, thru: null, madeCut: true })));
  const [picksLocked, setPicksLocked] = useState(false);
  const [loading, setLoading]   = useState(true);

  // Entry form
  const [form, setForm]         = useState({ realName: "", teamName: "", picks: {}, pin: "", pin2: "" });
  const [formErr, setFormErr]   = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Edit my entry
  const [editSearch, setEditSearch] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [editPin, setEditPin]       = useState("");
  const [editPinErr, setEditPinErr] = useState("");
  const [editUnlocked, setEditUnlocked] = useState(null); // entry object once unlocked
  const [editTeamName, setEditTeamName] = useState("");

  // Admin
  const [adminPin, setAdminPin]       = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPinErr, setAdminPinErr] = useState("");
  const [scoreEdits, setScoreEdits]   = useState({});
  const [newGolfer, setNewGolfer]     = useState({ name: "", country: "🇺🇸", tier: 1 });

  // ── Firestore listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "masters_pool", "config"), snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.golfers?.length) setGolfers(d.golfers);
        setPicksLocked(!!d.picksLocked);
      }
    });
    const unsubEntries = onSnapshot(collection(db, "masters_entries"), snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { unsubConfig(); unsubEntries(); };
  }, []);

  const golferMap = Object.fromEntries(golfers.map(g => [g.id, g]));

  const rankedEntries = [...entries].sort((a, b) => {
    const sa = calcEntryScore(a, golferMap);
    const sb = calcEntryScore(b, golferMap);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  });

  // ── Entry form helpers ────────────────────────────────────────────────────
  const togglePick = (tier, id) => {
    if (picksLocked) return;
    setForm(f => {
      const current = f.picks[tier] || [];
      const max = TIER_INFO[tier].picks;
      let next;
      if (current.includes(id)) {
        next = current.filter(x => x !== id);
      } else {
        if (current.length >= max) {
          notify(`Pick at most ${max} from this tier`, "error");
          return f;
        }
        next = [...current, id];
      }
      return { ...f, picks: { ...f.picks, [tier]: next } };
    });
  };

  const picksComplete = () =>
    Object.entries(TIER_INFO).every(([tier, info]) =>
      (form.picks[tier] || []).length === info.picks
    );

  const handleSubmit = async () => {
    setFormErr("");
    if (!form.realName.trim()) { setFormErr("Please enter your name."); return; }
    if (entries.find(e => e.realName.toLowerCase() === form.realName.trim().toLowerCase())) {
      setFormErr("That name is already taken. Use a different name or edit your existing entry."); return;
    }
    if (!picksComplete()) { setFormErr("Please make all your picks (2 per tier)."); return; }
    if (!form.pin || form.pin.length !== 4 || !/^\d{4}$/.test(form.pin)) {
      setFormErr("Please set a 4-digit PIN to protect your entry."); return;
    }
    if (form.pin !== form.pin2) { setFormErr("PINs do not match."); return; }

    const id = `entry-${Date.now()}`;
    const pinHash = await hashPin(form.pin);
    const entry = {
      id,
      realName: form.realName.trim(),
      teamName: form.teamName.trim(),
      picks: form.picks,
      pinHash,
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, "masters_entries", id), entry);
      setSubmitted(true);
      notify(`Entry submitted! Good luck, ${displayName(entry)}! 🏌️`);
    } catch (e) {
      console.error(e);
      setFormErr("Failed to save — check your connection.");
    }
  };

  // ── Edit my entry ─────────────────────────────────────────────────────────
  const handleEditUnlock = async () => {
    if (!editTarget) return;
    setEditPinErr("");
    if (editPin === ADMIN_PIN || (await hashPin(editPin)) === editTarget.pinHash) {
      setEditUnlocked(editTarget);
      setEditTeamName(editTarget.teamName || "");
      setEditPin("");
    } else {
      setEditPinErr("Incorrect PIN.");
    }
  };

  const handleSaveTeamName = async () => {
    if (!editUnlocked) return;
    try {
      await updateDoc(doc(db, "masters_entries", editUnlocked.id), { teamName: editTeamName.trim() });
      setEditUnlocked(null);
      setEditTarget(null);
      notify("Team name updated! ✓");
    } catch (e) {
      notify("Failed to save — check your connection.", "error");
    }
  };

  // ── Admin ─────────────────────────────────────────────────────────────────
  const handleAdminUnlock = async () => {
    if (adminPin === ADMIN_PIN) {
      setAdminUnlocked(true);
      setAdminPinErr("");
      const init = {};
      golfers.forEach(g => { init[g.id] = { score: g.score ?? "", thru: g.thru ?? "", madeCut: g.madeCut ?? true }; });
      setScoreEdits(init);
    } else {
      setAdminPinErr("Incorrect admin PIN.");
    }
  };

  const handleSaveScores = async () => {
    const updated = golfers.map(g => ({
      ...g,
      score: scoreEdits[g.id]?.score === "" || scoreEdits[g.id]?.score === null
        ? null
        : Number(scoreEdits[g.id]?.score ?? g.score),
      thru: scoreEdits[g.id]?.thru ?? g.thru,
      madeCut: scoreEdits[g.id]?.madeCut ?? g.madeCut,
    }));
    try {
      await setDoc(doc(db, "masters_pool", "config"), { golfers: updated, picksLocked }, { merge: true });
      notify("Scores saved ✓");
    } catch (e) {
      notify("Failed to save scores.", "error");
    }
  };

  const handleAddGolfer = async () => {
    if (!newGolfer.name.trim()) return;
    const id = newGolfer.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const g = { id, name: newGolfer.name.trim(), country: newGolfer.country, tier: Number(newGolfer.tier), score: null, thru: null, madeCut: true };
    const updated = [...golfers, g];
    try {
      await setDoc(doc(db, "masters_pool", "config"), { golfers: updated, picksLocked }, { merge: true });
      setNewGolfer({ name: "", country: "🇺🇸", tier: 1 });
      notify(`${g.name} added ✓`);
    } catch (e) {
      notify("Failed to add golfer.", "error");
    }
  };

  const handleRemoveGolfer = async (id) => {
    const updated = golfers.filter(g => g.id !== id);
    await setDoc(doc(db, "masters_pool", "config"), { golfers: updated, picksLocked }, { merge: true });
    notify("Golfer removed.");
  };

  // ── Filtered entries for edit search ─────────────────────────────────────
  const editFiltered = editSearch.trim().length > 0
    ? entries.filter(e =>
        e.realName.toLowerCase().includes(editSearch.toLowerCase()) ||
        (e.teamName || "").toLowerCase().includes(editSearch.toLowerCase())
      )
    : entries;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fade-up max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="font-display text-[12px] tracking-[4px] text-green mb-1.5">⛳ NORTH STAR GOLF</div>
        <h1 className="font-display text-[32px] md:text-[40px] tracking-[2px] leading-none">MASTERS POOL</h1>
        <p className="text-[13px] text-t2 mt-2">Pick 2 golfers from each tier · Lowest combined score wins</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 mb-6 rounded-[4px] overflow-hidden border border-border">
        {[
          { id: "leaderboard", label: "🏆 BOARD" },
          { id: "enter",       label: "✏️ ENTER" },
          { id: "edit",        label: "✏️ MY ENTRY" },
          { id: "admin",       label: "⚙ ADMIN" },
        ].map(t => (
          <button
            key={t.id}
            className={[
              "flex-1 py-2.5 text-[10px] font-display tracking-[1.5px] transition-colors border-none cursor-pointer",
              tab === t.id ? "bg-gold text-bg" : "bg-bg2 text-t2 hover:text-text",
            ].join(" ")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LEADERBOARD TAB ─────────────────────────────────────────────── */}
      {tab === "leaderboard" && (
        <div>
          {loading ? (
            <div className="text-center py-16 text-t3 font-display text-[12px] tracking-[3px]">LOADING…</div>
          ) : rankedEntries.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-[40px] mb-3">⛳</div>
              <div className="font-display text-[14px] tracking-[2px] text-t2">NO ENTRIES YET</div>
              <p className="text-[13px] text-t3 mt-2">Be the first to enter the pool!</p>
              <button className="btn-gold mt-5 px-6 py-2.5 text-[13px]" onClick={() => setTab("enter")}>ENTER NOW →</button>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {/* Golfer score legend */}
              <div className="px-5 py-3 border-b border-border bg-bg3">
                <div className="font-display text-[10px] tracking-[2px] text-t3 mb-2">CURRENT MASTERS SCORES</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {golfers.filter(g => g.score !== null).sort((a,b)=>a.score-b.score).slice(0,10).map(g => (
                    <span key={g.id} className="text-[11px] text-t2">
                      <span className={g.score <= 0 ? "text-green" : "text-red"}>{toPM(g.score)}</span>
                      {" "}{g.name.split(" ").pop()}
                      {!g.madeCut && <span className="text-t3"> (MC)</span>}
                    </span>
                  ))}
                  {golfers.every(g => g.score === null) && (
                    <span className="text-[11px] text-t3 italic">Scores not yet available — check back during the tournament</span>
                  )}
                </div>
              </div>

              {/* Entries */}
              {rankedEntries.map((entry, i) => {
                const score = calcEntryScore(entry, golferMap);
                const allPicks = Object.values(entry.picks || {}).flat();
                return (
                  <div key={entry.id} className="player-row px-5 py-4 flex items-start gap-4 border-b border-border last:border-0">
                    {/* Rank */}
                    <div className={[
                      "font-display text-[22px] leading-none w-8 shrink-0 mt-0.5 text-center",
                      i === 0 ? "text-gold" : i === 1 ? "text-t2" : i === 2 ? "text-amber" : "text-t3"
                    ].join(" ")}>
                      {score !== null ? i + 1 : "—"}
                    </div>

                    {/* Name + picks */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[17px] font-semibold leading-tight">{displayName(entry)}</span>
                        {entry.teamName && entry.realName && (
                          <span className="text-[11px] text-t3">({entry.realName})</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {allPicks.map(id => {
                          const g = golferMap[id];
                          if (!g) return null;
                          return (
                            <span key={id} className="text-[11px] text-t2">
                              {g.country} {g.name}
                              {g.score !== null && (
                                <span className={g.score <= 0 ? " text-green" : " text-red"}>
                                  {" "}{toPM(g.score)}
                                </span>
                              )}
                              {!g.madeCut && <span className="text-t3"> MC</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="shrink-0 text-right">
                      <div className={[
                        "font-display text-[26px] leading-none",
                        score === null ? "text-t3" : score <= 0 ? "text-green" : "text-red"
                      ].join(" ")}>
                        {toPM(score)}
                      </div>
                      {score !== null && <div className="text-[10px] text-t3 mt-0.5">TOTAL</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ENTER TAB ───────────────────────────────────────────────────── */}
      {tab === "enter" && (
        <div>
          {submitted ? (
            <div className="text-center pt-8">
              <div className="text-[52px] mb-4">⛳</div>
              <div className="font-display text-3xl tracking-[2px] text-gold mb-2">YOU'RE IN!</div>
              <p className="text-[15px] text-t2 mb-6">Good luck. May your picks stay under par.</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button className="btn-gold px-6 py-2.5 text-[13px]" onClick={() => setTab("leaderboard")}>VIEW LEADERBOARD →</button>
                <button className="btn-ghost px-6 py-2.5 text-[13px]" onClick={() => { setSubmitted(false); setForm({ realName: "", teamName: "", picks: {}, pin: "", pin2: "" }); }}>ENTER ANOTHER</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {picksLocked && (
                <div className="p-4 rounded-[4px] bg-[#1a0a0a] border border-[#4a1010] text-[13px] text-red">
                  🔒 The tournament has started — picks are now locked. You can still update your team name in MY ENTRY.
                </div>
              )}

              {/* Name */}
              <div className="card p-5 flex flex-col gap-4">
                <div>
                  <div className="section-label">YOUR NAME</div>
                  <input
                    value={form.realName}
                    onChange={e => setForm(f => ({ ...f, realName: e.target.value }))}
                    placeholder="First Last"
                    className="w-full"
                  />
                  <div className="text-[11px] text-t3 mt-1">Anyone can enter — no league membership required.</div>
                </div>

                <div>
                  <div className="section-label flex items-center justify-between">
                    <span>TEAM NAME (OPTIONAL)</span>
                    <button
                      className="text-[10px] text-gold border border-gold/40 rounded px-2 py-0.5 hover:bg-gold/10 transition-colors"
                      onClick={() => setForm(f => ({ ...f, teamName: genName() }))}
                      type="button"
                    >
                      🎲 RANDOM
                    </button>
                  </div>
                  <input
                    value={form.teamName}
                    onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
                    placeholder="e.g. Birdie Bandits"
                    className="w-full"
                  />
                  <div className="text-[11px] text-t3 mt-1">This shows on the leaderboard instead of your name. You can change it anytime.</div>
                </div>
              </div>

              {/* Picks */}
              {!picksLocked && (
                <div className="flex flex-col gap-4">
                  {[1, 2, 3].map(tier => {
                    const info = TIER_INFO[tier];
                    const selected = form.picks[tier] || [];
                    const tierGolfers = golfers.filter(g => g.tier === tier);
                    return (
                      <div key={tier} className="card p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-display text-[11px] tracking-[2px]" style={{ color: info.color }}>{info.label}</div>
                          <div className="text-[11px] text-t3">{selected.length}/{info.picks} selected</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {tierGolfers.map(g => {
                            const isPicked = selected.includes(g.id);
                            return (
                              <button
                                key={g.id}
                                onClick={() => togglePick(tier, g.id)}
                                className={[
                                  "w-full text-left px-3.5 py-2.5 rounded-[3px] transition-all duration-100 border cursor-pointer",
                                  "flex items-center justify-between gap-2",
                                  isPicked
                                    ? "border-gold bg-gold/10 text-text"
                                    : "border-border bg-transparent text-t2 hover:border-border2 hover:text-text",
                                ].join(" ")}
                              >
                                <span className="text-[14px]">
                                  {g.country} <span className={isPicked ? "text-text" : ""}>{g.name}</span>
                                </span>
                                {g.score !== null && (
                                  <span className={`text-[12px] font-display ${g.score <= 0 ? "text-green" : "text-red"}`}>
                                    {toPM(g.score)}
                                  </span>
                                )}
                                {isPicked && <span className="text-gold text-[12px] font-display">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PIN */}
              <div className="card p-5">
                <div className="font-display text-[11px] tracking-[2px] text-t2 mb-3">🔒 SET YOUR PIN</div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="section-label">PIN</div>
                    <input
                      type="password" maxLength={4}
                      value={form.pin}
                      onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
                      placeholder="4 digits" className="w-full text-center"
                      style={{ letterSpacing: 6, fontSize: 18 }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="section-label">CONFIRM PIN</div>
                    <input
                      type="password" maxLength={4}
                      value={form.pin2}
                      onChange={e => setForm(f => ({ ...f, pin2: e.target.value.replace(/\D/g, "") }))}
                      placeholder="4 digits" className="w-full text-center"
                      style={{ letterSpacing: 6, fontSize: 18 }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-t3 mt-2">Use this PIN to edit your team name later.</div>
              </div>

              {formErr && (
                <div className="text-[13px] text-red bg-[#2a0808] border border-[#4a1010] px-3.5 py-2.5 rounded-[4px]">{formErr}</div>
              )}
              <button
                className="btn-gold w-full py-3.5 text-[15px]"
                onClick={handleSubmit}
                disabled={picksLocked}
              >
                SUBMIT ENTRY →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MY ENTRY (EDIT) TAB ─────────────────────────────────────────── */}
      {tab === "edit" && (
        <div>
          {editUnlocked ? (
            // Editing view
            <div className="card p-6 max-w-md mx-auto">
              <div className="font-display text-[11px] tracking-[2px] text-green mb-1">EDITING ENTRY</div>
              <div className="text-[18px] font-semibold mb-4">{editUnlocked.realName}</div>

              <div className="mb-4">
                <div className="section-label flex items-center justify-between">
                  <span>TEAM NAME</span>
                  <button
                    className="text-[10px] text-gold border border-gold/40 rounded px-2 py-0.5 hover:bg-gold/10 transition-colors"
                    onClick={() => setEditTeamName(genName())}
                    type="button"
                  >
                    🎲 RANDOM
                  </button>
                </div>
                <input
                  value={editTeamName}
                  onChange={e => setEditTeamName(e.target.value)}
                  placeholder="e.g. Birdie Bandits"
                  className="w-full"
                />
                <div className="text-[11px] text-t3 mt-1">Shown on leaderboard instead of your real name.</div>
              </div>

              {/* Show current picks (read-only if locked) */}
              <div className="mb-5">
                <div className="section-label mb-2">YOUR PICKS</div>
                <div className="flex flex-col gap-1">
                  {Object.entries(editUnlocked.picks || {}).flatMap(([tier, ids]) =>
                    ids.map(id => {
                      const g = golferMap[id];
                      return g ? (
                        <div key={id} className="flex items-center justify-between px-3 py-1.5 rounded-[3px] bg-bg3 border border-border text-[13px]">
                          <span>{g.country} {g.name}</span>
                          <span className="text-[10px] text-t3">T{tier}</span>
                        </div>
                      ) : null;
                    })
                  )}
                </div>
                {picksLocked && <div className="text-[11px] text-t3 mt-2">🔒 Picks are locked — tournament has started.</div>}
              </div>

              <div className="flex gap-3">
                <button className="btn-gold flex-1 py-3" onClick={handleSaveTeamName}>SAVE →</button>
                <button className="btn-ghost flex-1 py-3" onClick={() => { setEditUnlocked(null); setEditTarget(null); }}>CANCEL</button>
              </div>
            </div>
          ) : editTarget ? (
            // PIN entry
            <div className="text-center max-w-xs mx-auto">
              <div className="font-display text-[13px] tracking-[4px] text-green mb-2">VERIFY IDENTITY</div>
              <div className="text-[20px] font-semibold mb-1">{editTarget.teamName || editTarget.realName}</div>
              {editTarget.teamName && <div className="text-[13px] text-t3 mb-5">({editTarget.realName})</div>}
              <div className="card p-6">
                <div className="section-label mb-2">ENTER YOUR PIN</div>
                <input
                  type="password" maxLength={4}
                  value={editPin}
                  onChange={e => { setEditPin(e.target.value.replace(/\D/g, "")); setEditPinErr(""); }}
                  placeholder="4 digits" className="w-full text-center mb-3"
                  style={{ letterSpacing: 6, fontSize: 20 }}
                  onKeyDown={e => e.key === "Enter" && handleEditUnlock()}
                />
                {editPinErr && <div className="text-[12px] text-red mb-3">{editPinErr}</div>}
                <button className="btn-gold w-full py-2.5" onClick={handleEditUnlock}>UNLOCK →</button>
                <button className="btn-ghost w-full mt-2 text-[12px]" onClick={() => { setEditTarget(null); setEditPin(""); setEditPinErr(""); }}>← BACK</button>
              </div>
            </div>
          ) : (
            // Search / select entry
            <div>
              <div className="text-center mb-5">
                <div className="font-display text-[13px] tracking-[4px] text-green mb-1">EDIT MY ENTRY</div>
                <p className="text-[13px] text-t2">Find your entry to update your team name.</p>
              </div>
              <div className="mb-4">
                <input
                  value={editSearch}
                  onChange={e => setEditSearch(e.target.value)}
                  placeholder="Search by name or team name…"
                  className="w-full"
                />
              </div>
              <div className="card overflow-hidden">
                {editFiltered.length === 0 ? (
                  <div className="p-8 text-center text-t3 text-[13px]">
                    {entries.length === 0 ? "No entries yet." : "No entries matching your search."}
                  </div>
                ) : (
                  editFiltered.map(entry => (
                    <button
                      key={entry.id}
                      className="player-row w-full px-5 py-4 flex justify-between items-center bg-transparent border-none cursor-pointer text-left border-b border-border last:border-0"
                      onClick={() => { setEditTarget(entry); setEditPin(""); setEditPinErr(""); }}
                    >
                      <div>
                        <div className="text-[16px] font-semibold">{displayName(entry)}</div>
                        {entry.teamName && <div className="text-[11px] text-t3">{entry.realName}</div>}
                      </div>
                      <span className="font-display text-[11px] tracking-[1px] text-gold">EDIT →</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN TAB ───────────────────────────────────────────────────── */}
      {tab === "admin" && (
        <div>
          {!adminUnlocked ? (
            <div className="max-w-xs mx-auto text-center">
              <div className="font-display text-[13px] tracking-[4px] text-green mb-4">COMMISSIONER ACCESS</div>
              <div className="card p-6">
                <div className="section-label mb-2">ADMIN PIN</div>
                <input
                  type="password" maxLength={6}
                  value={adminPin}
                  onChange={e => { setAdminPin(e.target.value); setAdminPinErr(""); }}
                  placeholder="Admin PIN" className="w-full text-center mb-3"
                  style={{ letterSpacing: 6, fontSize: 20 }}
                  onKeyDown={e => e.key === "Enter" && handleAdminUnlock()}
                />
                {adminPinErr && <div className="text-[12px] text-red mb-3">{adminPinErr}</div>}
                <button className="btn-gold w-full py-2.5" onClick={handleAdminUnlock}>UNLOCK →</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Pool settings */}
              <div className="card p-5">
                <div className="font-display text-[11px] tracking-[2px] text-green mb-3">POOL SETTINGS</div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    className={`w-10 h-6 rounded-full relative transition-colors ${picksLocked ? "bg-red" : "bg-border2"}`}
                    onClick={async () => {
                      const next = !picksLocked;
                      setPicksLocked(next);
                      await setDoc(doc(db, "masters_pool", "config"), { picksLocked: next }, { merge: true });
                      notify(next ? "Picks LOCKED — tournament started" : "Picks UNLOCKED");
                    }}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${picksLocked ? "left-5" : "left-1"}`} />
                  </div>
                  <span className="text-[13px]">
                    {picksLocked ? "🔒 Picks LOCKED (tournament active)" : "🔓 Picks OPEN"}
                  </span>
                </label>
              </div>

              {/* Golfer scores */}
              <div className="card p-5">
                <div className="font-display text-[11px] tracking-[2px] text-green mb-4">UPDATE GOLFER SCORES</div>
                <div className="flex flex-col gap-2 mb-4">
                  {[1, 2, 3].map(tier => (
                    <div key={tier}>
                      <div className="font-display text-[10px] tracking-[1.5px] mb-2 mt-3" style={{ color: TIER_INFO[tier].color }}>
                        {TIER_INFO[tier].label}
                      </div>
                      {golfers.filter(g => g.tier === tier).map(g => (
                        <div key={g.id} className="flex items-center gap-2 mb-1.5">
                          <span className="text-[12px] text-t2 w-36 shrink-0 truncate">{g.country} {g.name}</span>
                          <input
                            type="number"
                            value={scoreEdits[g.id]?.score ?? ""}
                            onChange={e => setScoreEdits(prev => ({ ...prev, [g.id]: { ...prev[g.id], score: e.target.value } }))}
                            placeholder="E"
                            className="w-16 text-center text-[13px] py-1"
                          />
                          <input
                            value={scoreEdits[g.id]?.thru ?? ""}
                            onChange={e => setScoreEdits(prev => ({ ...prev, [g.id]: { ...prev[g.id], thru: e.target.value } }))}
                            placeholder="Thru"
                            className="w-16 text-center text-[12px] py-1"
                          />
                          <label className="flex items-center gap-1 text-[11px] text-t2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={scoreEdits[g.id]?.madeCut ?? true}
                              onChange={e => setScoreEdits(prev => ({ ...prev, [g.id]: { ...prev[g.id], madeCut: e.target.checked } }))}
                              className="w-3.5 h-3.5"
                            />
                            Cut
                          </label>
                          <button
                            className="text-[10px] text-t3 hover:text-red ml-auto"
                            onClick={() => handleRemoveGolfer(g.id)}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <button className="btn-gold w-full py-2.5 text-[13px]" onClick={handleSaveScores}>
                  SAVE ALL SCORES ✓
                </button>
              </div>

              {/* Add golfer */}
              <div className="card p-5">
                <div className="font-display text-[11px] tracking-[2px] text-green mb-3">ADD GOLFER TO FIELD</div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={newGolfer.name}
                    onChange={e => setNewGolfer(g => ({ ...g, name: e.target.value }))}
                    placeholder="Golfer name"
                    className="flex-1 min-w-[140px]"
                  />
                  <input
                    value={newGolfer.country}
                    onChange={e => setNewGolfer(g => ({ ...g, country: e.target.value }))}
                    placeholder="🇺🇸"
                    className="w-14 text-center"
                  />
                  <select
                    value={newGolfer.tier}
                    onChange={e => setNewGolfer(g => ({ ...g, tier: Number(e.target.value) }))}
                    className="w-24"
                  >
                    <option value={1}>Tier 1</option>
                    <option value={2}>Tier 2</option>
                    <option value={3}>Tier 3</option>
                  </select>
                  <button className="btn-gold px-4 py-2 text-[12px]" onClick={handleAddGolfer}>ADD +</button>
                </div>
              </div>

              {/* Entries list */}
              <div className="card p-5">
                <div className="font-display text-[11px] tracking-[2px] text-green mb-3">ALL ENTRIES ({entries.length})</div>
                <div className="flex flex-col gap-1">
                  {entries.map(e => (
                    <div key={e.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-border last:border-0">
                      <span>{displayName(e)}{e.teamName && <span className="text-t3 ml-1">({e.realName})</span>}</span>
                      <span className={`font-display ${calcEntryScore(e, golferMap) <= 0 ? "text-green" : "text-t2"}`}>
                        {toPM(calcEntryScore(e, golferMap))}
                      </span>
                    </div>
                  ))}
                  {entries.length === 0 && <div className="text-t3 text-[12px]">No entries yet.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

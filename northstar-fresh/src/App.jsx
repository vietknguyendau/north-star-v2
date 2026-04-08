import React, { useState, useRef, useEffect } from "react";
import RulesPage from "./Rules";
import Sidebets from "./Sidebets";
import TournamentHistory from "./History";
import SeasonStandings from "./Season";
import HandicapTracker from "./Handicap";
import { db } from "./firebase";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { TOURNAMENT_ID, DEFAULT_PAR, DEFAULT_YARDS } from "./constants";
import { useAuth } from "./contexts/AuthContext";
import { usePlayers } from "./contexts/PlayersContext";
import { useCourse } from "./contexts/CourseContext";
import { useTournament } from "./contexts/TournamentContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminViewScreen from "./screens/AdminView";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import TournamentTab from "./screens/TournamentTab";
import ScorecardView from "./screens/ScorecardView";
import CourseView from "./screens/CourseView";
import RegisterView from "./screens/RegisterView";
import AmateursView from "./screens/AmateursView";
import AmateurRegisterView from "./screens/AmateurRegisterView";
import LoginView from "./screens/LoginView";
import MyScoresLogin from "./screens/MyScoresLogin";
import MyScores from "./screens/MyScores";
import SidebetsLogin from "./screens/SidebetsLogin";
import MastersPool from "./screens/MastersPool";

// ── Mobile bottom nav split ───────────────────────────────────────────────────
const NAV_BOTTOM_PRIMARY = [
  { id: "leaderboard", icon: "🏆", label: "BOARD"   },
  { id: "tournament",  icon: "⛳", label: "EVENTS"  },
  { id: "masters",     icon: "🟢", label: "MASTERS" },
  { id: "sidebets",    icon: "🤝", label: "BETS"    },
  { id: "login",       icon: "✏️", label: "MY GAME" },
];
const NAV_MORE = [
  { id: "rules",    icon: "📋", label: "RULES"     },
  { id: "course",   icon: "🗺",  label: "COURSE"   },
  { id: "handicap", icon: "🏅", label: "HANDICAPS" },
  { id: "amateurs", icon: "👥", label: "MEMBERS"   },
  { id: "history",  icon: "📖", label: "HISTORY"   },
  { id: "register", icon: "➕", label: "REGISTER"  },
  { id: "admin",    icon: "⚙️", label: "ADMIN"     },
];

function AppInner() {
  const { players, loading, syncStatus, setSyncStatus, scorecardUploads } = usePlayers();
  const { course, setCourse, courseLibrary } = useCourse();
  const { ctpBets } = useTournament();
  const { activePlayer, setActivePlayer, adminUnlocked, setAdminUnlocked } = useAuth();

  const [screen, setScreen]           = useState("leaderboard");
  const [selectedPid, setSelectedPid] = useState(null);
  const [activeHole, setActiveHole]   = useState(0);
  const [pinInput, setPinInput]       = useState("");
  const [pinError, setPinError]       = useState(false);
  const [notif, setNotif]             = useState(null);
  const [moreOpen, setMoreOpen]       = useState(false);
  const notifyTimer = useRef(null);

  const notify = (msg, type="success") => {
    clearTimeout(notifyTimer.current);
    setNotif({ msg, type });
    notifyTimer.current = setTimeout(() => setNotif(null), 3500);
  };
  useEffect(() => () => clearTimeout(notifyTimer.current), []);

  const pars     = (Array.isArray(course?.par) && course.par.length===18) ? course.par : DEFAULT_PAR;
  const totalPar = pars.reduce((a,b)=>a+b,0);

  const savePlayer = async (player) => {
    setSyncStatus("syncing");
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "players", player.id), player);
      setSyncStatus("synced");
    } catch(e) { console.error(e); setSyncStatus("error"); notify("Sync failed — check connection","error"); }
  };

  const removePlayerDb = async (id) => {
    setSyncStatus("syncing");
    try {
      await deleteDoc(doc(db, "tournaments", TOURNAMENT_ID, "players", id));
      setSyncStatus("synced");
    } catch(e) { console.error(e); setSyncStatus("error"); }
  };

  const saveCourseToLibrary = async (courseData) => {
    const id = courseData.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "course_library", id), { ...courseData, id, savedAt: Date.now() });
      notify(`"${courseData.name}" saved to course library ✓`);
    } catch(e) { console.error(e); notify("Failed to save course — check connection.", "error"); }
  };

  const saveCourse = async (data) => {
    setSyncStatus("syncing");
    try {
      const safe = { ...data };
      if (!Array.isArray(safe.par)   || safe.par.length   !== 18) safe.par   = DEFAULT_PAR;
      if (!Array.isArray(safe.yards) || safe.yards.length !== 18) safe.yards = DEFAULT_YARDS;
      if (!safe.name)                    safe.name   = "Keller Golf Course";
      if (!safe.slope  || isNaN(safe.slope))  safe.slope  = 128;
      if (!safe.rating || isNaN(safe.rating)) safe.rating = 70.4;
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "settings", "course"), safe);
      setSyncStatus("synced");
    } catch(e) { console.error(e); setSyncStatus("error"); }
  };

  const updateScore = async (pid, hole, val) => {
    const player = players.find(p => p.id === pid);
    if (!player) return;
    const scores = [...player.scores];
    scores[hole] = val === "" ? null : Math.min(10, Math.max(1, parseInt(val)||1));
    await savePlayer({ ...player, scores });
  };

  const updateField = async (id, field, val) => {
    const player = players.find(p => p.id === id);
    if (!player) return;
    await savePlayer({ ...player, [field]: field==="handicap" ? parseInt(val)||0 : val });
  };

  if (loading) return (
    <div className="min-h-screen bg-[#080c08] flex flex-col items-center justify-center gap-4">
      <div className="font-display text-[13px] tracking-[4px] text-green pulse">
        LOADING TOURNAMENT DATA…
      </div>
    </div>
  );

  // ── Nav state ─────────────────────────────────────────────────────────────
  const NAV_PRIMARY = [
    ["leaderboard","🏆 LEADERBOARD"],
    ["tournament", "⛳ TOURNAMENTS"],
    ["masters",    "🟢 MASTERS"    ],
    ["season",     "🌟 STANDINGS"  ],
    ["rules",      "📋 RULES"      ],
    ["course",     "🗺 COURSE"     ],
    ["handicap",   "🏅 HANDICAPS"  ],
    ["amateurs",   "👥 MEMBERS"    ],
    ["sidebets",   "🤝 SIDEBETS"   ],
    ["history",    "📖 HISTORY"    ],
  ];

  const activeNav = screen==="my-scores"         ? "login"
    : screen==="my-scores-login"                  ? "login"
    : screen==="sidebets"                         ? "sidebets"
    : screen==="tournament-scores"                ? "tournament"
    : screen==="amateur-register"                 ? "amateurs"
    : screen;

  // MyScores has its own fixed PREV/NEXT bar — hide the app bottom nav
  const hideBottomNav = screen === "my-scores" || screen === "tournament-scores";

  const activePlayerName = players.find(p => p.id === activePlayer)?.name?.split(" ")[0]?.toUpperCase();

  const handleNavMore = (id) => {
    setMoreOpen(false);
    setScreen(id);
  };

  return (
    <div className="min-h-screen bg-bg text-text overflow-x-hidden">
      {/* Notification toast */}
      {notif && <div className={`notif notif-${notif.type}`}>{notif.msg}</div>}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-gradient-to-b from-[#080e08] to-bg border-b border-border">
        <div className="max-w-[1100px] mx-auto px-4 md:px-5">

          {/* Mobile header — compact single row */}
          <div className="flex items-center justify-between py-2.5 md:hidden">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="NSG" className="w-9 h-9 object-contain shrink-0" />
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`sync-dot ${syncStatus}`} />
                  <span className="font-display text-[8px] tracking-[2px] text-green leading-none">
                    {syncStatus==="synced" ? "LIVE" : syncStatus==="syncing" ? "SYNCING" : "ERROR"}
                  </span>
                </div>
                <div className="font-display text-base tracking-[2px] leading-none">NORTH STAR</div>
                <div className="text-[10px] text-t3 leading-none mt-0.5">Par {totalPar} · {players.length} Players</div>
              </div>
            </div>
            <button
              className="btn-gold btn-sm flex items-center gap-1.5 shrink-0"
              onClick={() => setScreen(activePlayer ? "my-scores" : "my-scores-login")}
            >
              {activePlayer
                ? <span className="max-w-[56px] overflow-hidden text-ellipsis whitespace-nowrap text-[10px]">{activePlayerName} ✏️</span>
                : <>✏️ LOG IN</>
              }
            </button>
          </div>

          {/* Desktop header — full layout */}
          <div className="hidden md:flex items-start justify-between flex-wrap gap-2.5 pt-[18px]">
            <div className="flex items-center gap-3.5">
              <img src="/logo.png" alt="North Star Golf" className="w-[72px] h-[72px] object-contain shrink-0" />
              <div>
                <div className="flex items-center gap-2 mb-[3px] font-display text-[10px] tracking-[4px] text-green">
                  <span className={`sync-dot ${syncStatus}`} />
                  {syncStatus==="synced" ? "LIVE · ALL SCORES SYNCED" : syncStatus==="syncing" ? "SYNCING…" : "SYNC ERROR — CHECK CONNECTION"}
                </div>
                <div className="font-display text-[34px] tracking-[3px] leading-none">NORTH STAR AMATEUR SERIES</div>
                <div className="text-xs text-t3 mt-[3px]">{course?.name} · {course?.city} · Par {totalPar} · {players.length} Players</div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button className="btn-ghost btn-sm" onClick={() => setScreen("register")}>JOIN / REGISTER</button>
              <button className="btn-ghost btn-sm text-[11px] tracking-[1px]" onClick={() => setScreen("admin")}>⚙ ADMIN</button>
              <button
                className="btn-gold btn-sm flex items-center gap-1.5"
                onClick={() => setScreen(activePlayer ? "my-scores" : "my-scores-login")}
              >
                {activePlayer
                  ? <><span className="text-[10px] max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap">{activePlayerName}</span><span> ✏️</span></>
                  : <>✏️ LOG IN</>
                }
              </button>
              {activePlayer && (
                <button
                  className="btn-ghost btn-sm text-[11px]"
                  style={{color:"var(--red)",borderColor:"#2a1010"}}
                  onClick={() => { setActivePlayer(null); setScreen("leaderboard"); notify("Logged out. See you on the course! 🏌️"); }}
                >
                  🔒 LOG OUT
                </button>
              )}
            </div>
          </div>

          {/* Desktop nav pills */}
          <div
            className="hidden md:flex mt-3 overflow-x-auto gap-0"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {NAV_PRIMARY.map(([val, label]) => (
              <div key={val} className={`nav-pill ${activeNav===val ? "active" : ""}`}
                onClick={() => { if(val==="login"&&activePlayer) setScreen("my-scores"); else setScreen(val); }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className={`max-w-[1100px] mx-auto px-4 pt-6 ${hideBottomNav ? "pb-6" : "pb-24 md:pb-8"}`}>
        {screen==="leaderboard"   && <LeaderboardScreen setSelectedPid={setSelectedPid} setScreen={setScreen} notify={notify} />}
        {screen==="tournament"    && <TournamentTab activeHole={activeHole} setActiveHole={setActiveHole} setScreen={setScreen} notify={notify} />}
        {(screen==="my-scores"||screen==="tournament-scores") && <MyScores activeHole={activeHole} setActiveHole={setActiveHole} updateScore={updateScore} notify={notify} setScreen={setScreen} />}
        {screen==="scorecard"     && <ScorecardView selectedPid={selectedPid} setSelectedPid={setSelectedPid} updateScore={updateScore} />}
        {screen==="course"        && <CourseView saveCourse={saveCourse} notify={notify} />}
        {screen==="register"      && <RegisterView notify={notify} setScreen={setScreen} />}
        {screen==="amateurs"      && <AmateursView setScreen={setScreen} />}
        {screen==="amateur-register" && <AmateurRegisterView notify={notify} setScreen={setScreen} />}
        {(screen==="login"||screen==="my-scores-login") && <MyScoresLogin setScreen={setScreen} setActiveHole={setActiveHole} />}
        {screen==="my-login"      && <LoginView setScreen={setScreen} setActiveHole={setActiveHole} />}
        {screen==="history"       && <TournamentHistory players={players} adminUnlocked={adminUnlocked} />}
        {screen==="rules"         && <RulesPage adminUnlocked={adminUnlocked} />}
        {screen==="sidebets"      && (activePlayer
          ? <Sidebets
              myPlayer={players.find(p=>p.id===activePlayer)}
              players={players}
              pars={pars}
              ctpBets={ctpBets}
              onCtpOptToggle={async (val) => {
                if (!activePlayer) return;
                await updateDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",activePlayer),{ctpOptIn:val});
                notify(val ? "Opted in to CTP bets ✓" : "Opted out of CTP bets");
              }}
            />
          : <SidebetsLogin notify={notify} setScreen={setScreen} />
        )}
        {screen==="masters"        && <MastersPool notify={notify} activePlayer={activePlayer} players={players} />}
        {screen==="season"        && <SeasonStandings players={players} adminUnlocked={adminUnlocked} />}
        {screen==="handicap"      && <HandicapTracker players={players} adminUnlocked={adminUnlocked} onHandicapUpdate={(pid,hcp)=>updateField(pid,"handicap",hcp)} />}
        {screen==="admin"         && <AdminViewScreen
          course={course} players={players} adminUnlocked={adminUnlocked}
          setAdminUnlocked={setAdminUnlocked} pinInput={pinInput} setPinInput={setPinInput}
          pinError={pinError} setPinError={setPinError}
          savePlayer={savePlayer} removePlayerDb={removePlayerDb}
          saveCourse={saveCourse} setCourse={setCourse}
          updateField={updateField} notify={notify}
          scorecardUploads={scorecardUploads}
          courseLibrary={courseLibrary}
          saveCourseToLibrary={saveCourseToLibrary}
          pars={pars}
        />}
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      {!hideBottomNav && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-bg border-t border-border"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex h-16">
            {NAV_BOTTOM_PRIMARY.map(({ id, icon, label }) => {
              const isActive = activeNav === id;
              return (
                <button
                  key={id}
                  className={[
                    "flex-1 flex flex-col items-center justify-center gap-0.5",
                    "border-none bg-transparent cursor-pointer transition-colors duration-150",
                    "active:opacity-70",
                    isActive ? "text-gold" : "text-t3",
                  ].join(" ")}
                  onClick={() => {
                    if (id === "login") setScreen(activePlayer ? "my-scores" : "my-scores-login");
                    else setScreen(id);
                  }}
                >
                  <span className="text-xl leading-none">{icon}</span>
                  <span className="font-display text-[9px] tracking-[1px]">{label}</span>
                </button>
              );
            })}

            {/* More button */}
            <button
              className={[
                "flex-1 flex flex-col items-center justify-center gap-0.5",
                "border-none bg-transparent cursor-pointer transition-colors duration-150",
                "active:opacity-70",
                moreOpen ? "text-gold" : "text-t3",
              ].join(" ")}
              onClick={() => setMoreOpen(o => !o)}
            >
              <span className="font-display text-xl leading-none tracking-widest">···</span>
              <span className="font-display text-[9px] tracking-[1px]">MORE</span>
            </button>
          </div>
        </nav>
      )}

      {/* ── More sheet (mobile) ───────────────────────────────────────────── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/75"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg2 border-t border-border2 rounded-t-2xl"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 bg-border2 rounded-full mx-auto mt-3 mb-1" />

            {/* Secondary nav grid */}
            <div className="grid grid-cols-4 py-2">
              {NAV_MORE.map(({ id, icon, label }) => {
                const isActive = activeNav === id;
                return (
                  <button
                    key={id}
                    className={[
                      "flex flex-col items-center gap-1.5 py-4",
                      "border-none bg-transparent cursor-pointer active:opacity-70",
                      isActive ? "text-gold" : "text-t2",
                    ].join(" ")}
                    onClick={() => handleNavMore(id)}
                  >
                    <span className="text-2xl leading-none">{icon}</span>
                    <span className="font-display text-[10px] tracking-[1px]">{label}</span>
                  </button>
                );
              })}

              {/* Logout in sheet if logged in */}
              {activePlayer && (
                <button
                  className="flex flex-col items-center gap-1.5 py-4 border-none bg-transparent cursor-pointer active:opacity-70 text-red"
                  onClick={() => {
                    setMoreOpen(false);
                    setActivePlayer(null);
                    setScreen("leaderboard");
                    notify("Logged out. See you on the course! 🏌️");
                  }}
                >
                  <span className="text-2xl leading-none">🔒</span>
                  <span className="font-display text-[10px] tracking-[1px]">LOG OUT</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}

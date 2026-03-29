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
import CtpLeaderboard from "./components/CtpLeaderboard";
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

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;

function AppInner() {
  const { players, loading, syncStatus, setSyncStatus, scorecardUploads } = usePlayers();
  const { course, setCourse, courseLibrary } = useCourse();
  const { activeOneOff, activeOnOffs, ctpBets, foursomes, groupBets } = useTournament();
  const { activePlayer, setActivePlayer, adminUnlocked, setAdminUnlocked } = useAuth();

  const [screen, setScreen]           = useState("leaderboard");
  const [selectedPid, setSelectedPid] = useState(null);
  const [activeHole, setActiveHole]   = useState(0);
  const [pinInput, setPinInput]       = useState("");
  const [pinError, setPinError]       = useState(false);
  const [notif, setNotif]             = useState(null);
  const notifyTimer = useRef(null);

  const notify = (msg, type="success") => {
    clearTimeout(notifyTimer.current);
    setNotif({ msg, type });
    notifyTimer.current = setTimeout(() => setNotif(null), 3500);
  };
  useEffect(() => () => clearTimeout(notifyTimer.current), []);

  const pars     = (Array.isArray(course?.par)   && course.par.length===18)   ? course.par   : DEFAULT_PAR;
  const yards    = (Array.isArray(course?.yards)  && course.yards.length===18) ? course.yards : DEFAULT_YARDS;
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
      if (!Array.isArray(safe.par) || safe.par.length !== 18) safe.par = DEFAULT_PAR;
      if (!Array.isArray(safe.yards) || safe.yards.length !== 18) safe.yards = DEFAULT_YARDS;
      if (!safe.name) safe.name = "Keller Golf Course";
      if (!safe.slope || isNaN(safe.slope)) safe.slope = 128;
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
    <div style={{minHeight:"100vh",background:"#080c08",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:4,color:"#5a9a5a"}} className="pulse">LOADING TOURNAMENT DATA…</div>
    </div>
  );

  const NAV_PRIMARY = [
    ["leaderboard","🏆 LEADERBOARD"],
    ["tournament","⛳ TOURNAMENTS"],
    ["season","🌟 STANDINGS"],
    ["rules","📋 RULES"],
    ["course","🗺 COURSE"],
    ["handicap","🏅 HANDICAPS"],
    ["amateurs","👥 MEMBERS"],
    ["sidebets","🤝 SIDEBETS"],
    ["history","📖 HISTORY"],
  ];
  const activeNav = screen==="my-scores"?"login":screen==="my-scores-login"?"login":screen==="sidebets"?"sidebets":screen==="tournament-scores"?"tournament":screen==="amateur-register"?"amateurs":screen;

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      {notif && <div className={`notif notif-${notif.type}`}>{notif.msg}</div>}

      {/* Header */}
      <div style={{background:"linear-gradient(180deg,#080e08,var(--bg))",borderBottom:"1px solid var(--border)",padding:"0 20px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{padding:"18px 0 0",display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <img src="/logo.png" alt="North Star Golf" style={{width:72,height:72,objectFit:"contain",flexShrink:0}}/>
              <div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:4,color:"var(--green)",marginBottom:3,display:"flex",alignItems:"center",gap:8}}>
                  <span className={`sync-dot ${syncStatus}`}/>
                  {syncStatus==="synced"?"LIVE · ALL SCORES SYNCED":syncStatus==="syncing"?"SYNCING…":"SYNC ERROR — CHECK CONNECTION"}
                </div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,lineHeight:1}}>NORTH STAR AMATEUR SERIES</div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>{course?.name} · {course?.city} · Par {totalPar} · {players.length} Players</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <button className="btn-ghost btn-sm" onClick={()=>setScreen("register")}>JOIN / REGISTER</button>
              <button className="btn-ghost btn-sm" onClick={()=>setScreen("admin")} style={{fontSize:11,letterSpacing:1}}>⚙ ADMIN</button>
              <button className="btn-gold btn-sm" style={{display:"flex",alignItems:"center",gap:6}} onClick={()=>setScreen(activePlayer?"my-scores":"my-scores-login")}>
                {activePlayer ? <><span style={{fontSize:10,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{players.find(p=>p.id===activePlayer)?.name?.split(" ")[0]?.toUpperCase()}</span><span> ✏️</span></> : <>✏️ LOG IN</>}
              </button>
              {activePlayer && (
                <button className="btn-ghost btn-sm"
                  style={{color:"var(--red)",borderColor:"#2a1010",fontSize:11}}
                  onClick={()=>{ setActivePlayer(null); setScreen("leaderboard"); notify("Logged out. See you on the course! 🏌️"); }}>
                  🔒 LOG OUT
                </button>
              )}
            </div>
          </div>
          <div style={{display:"flex",marginTop:12,overflowX:"auto",gap:0,scrollbarWidth:"none",msOverflowStyle:"none"}}>
            {NAV_PRIMARY.map(([val,label])=>(
              <div key={val} className={`nav-pill ${activeNav===val?"active":""}`}
                onClick={()=>{ if(val==="login"&&activePlayer)setScreen("my-scores"); else setScreen(val); }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 16px"}}>
        {screen==="leaderboard" && <LeaderboardScreen setSelectedPid={setSelectedPid} setScreen={setScreen} notify={notify} />}
        {screen==="tournament" && <TournamentTab activeHole={activeHole} setActiveHole={setActiveHole} setScreen={setScreen} notify={notify} />}
        {(screen==="my-scores"||screen==="tournament-scores") && <MyScores activeHole={activeHole} setActiveHole={setActiveHole} updateScore={updateScore} notify={notify} setScreen={setScreen} />}
        {screen==="scorecard" && <ScorecardView selectedPid={selectedPid} setSelectedPid={setSelectedPid} updateScore={updateScore} />}
        {screen==="course" && <CourseView saveCourse={saveCourse} notify={notify} />}
        {screen==="register" && <RegisterView notify={notify} setScreen={setScreen} />}
        {screen==="amateurs" && <AmateursView setScreen={setScreen} />}
        {screen==="amateur-register" && <AmateurRegisterView notify={notify} setScreen={setScreen} />}
        {(screen==="login"||screen==="my-scores-login") && <MyScoresLogin setScreen={setScreen} setActiveHole={setActiveHole} />}
        {screen==="my-login" && <LoginView setScreen={setScreen} setActiveHole={setActiveHole} />}
        {screen==="history" && <TournamentHistory players={players} adminUnlocked={adminUnlocked} />}
        {screen==="rules" && <RulesPage adminUnlocked={adminUnlocked} />}
        {screen==="sidebets" && (activePlayer
          ? <Sidebets
              myPlayer={players.find(p=>p.id===activePlayer)}
              players={players}
              pars={pars}
              ctpBets={ctpBets}
              onCtpOptToggle={async (val) => {
                if (!activePlayer) return;
                await updateDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",activePlayer),{ctpOptIn:val});
                notify(val?"Opted in to CTP bets ✓":"Opted out of CTP bets");
              }}
            />
          : <SidebetsLogin notify={notify} setScreen={setScreen} />
        )}
        {screen==="season" && <SeasonStandings players={players} adminUnlocked={adminUnlocked} />}
        {screen==="handicap" && <HandicapTracker players={players} adminUnlocked={adminUnlocked} onHandicapUpdate={(pid,hcp)=>updateField(pid,"handicap",hcp)} />}
        {screen==="admin" && <AdminViewScreen
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
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}

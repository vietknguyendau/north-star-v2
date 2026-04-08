import React from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { TOURNAMENT_ID, SKILL_LEVELS } from "../constants";
import { hashPin } from "../lib/scoring";
import { usePlayers } from "../contexts/PlayersContext";
import { useTournament } from "../contexts/TournamentContext";
import { useAuth } from "../contexts/AuthContext";

const LEAGUE_PASSWORD = process.env.REACT_APP_LEAGUE_PASSWORD;

export default function RegisterView({ notify, setScreen }) {
  const { players, setSyncStatus } = usePlayers();
  const { activeOneOff } = useTournament();
  const { setActivePlayer } = useAuth();
  const [regForm, setRegForm] = React.useState({ code:"", name:"", email:"", handicap:"", flight:"Scratch (0-5)", pin:"", pin2:"", leagueCode:"", tourneyPw:"" });
  const [regError, setRegError] = React.useState("");
  const [regSuccess, setRegSuccess] = React.useState(false);

  const handleRegister = async () => {
    if (!regForm.leagueCode.trim()) { setRegError("Please enter the league password."); return; }
    if (regForm.leagueCode.trim() !== LEAGUE_PASSWORD) { setRegError("Incorrect league password. Contact the commissioner."); return; }
    if (!regForm.name.trim()) { setRegError("Please enter your name."); return; }
    if (players.find(p=>p.name.toLowerCase()===regForm.name.trim().toLowerCase())) { setRegError("Name already registered."); return; }
    if (!regForm.pin || regForm.pin.length !== 4 || !/^\d{4}$/.test(regForm.pin)) { setRegError("Please set a 4-digit PIN."); return; }
    if (regForm.pin !== regForm.pin2) { setRegError("PINs do not match."); return; }
    let oneOffId = null;
    if (regForm.tourneyPw && activeOneOff?.hasPassword) {
      const pwHash = await hashPin(regForm.tourneyPw.trim());
      if (pwHash === activeOneOff.pwHash) { oneOffId = activeOneOff.id; }
      else { setRegError("Incorrect tournament password."); return; }
    }
    const id = `player-${Date.now()}`;
    const pinHash = await hashPin(regForm.pin);
    const np = { id, name:regForm.name.trim(), email:regForm.email.trim().toLowerCase(), handicap:parseInt(regForm.handicap)||0, flight:regForm.flight, scores:Array(18).fill(null), pinHash, memberType:"league", ...(oneOffId?{oneOffId}:{}) };
    setSyncStatus("syncing");
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "players", np.id), np);
      setSyncStatus("synced");
    } catch(e) { console.error(e); setSyncStatus("error"); notify("Sync failed — check connection","error"); return; }
    setActivePlayer(np.id);
    setRegSuccess(true);
    notify(oneOffId ? `Welcome, ${np.name}! You've joined "${activeOneOff.title}" 🏌️` : `Welcome, ${np.name}! 🏌️`);
  };

  return (
    <div className="fade-up max-w-lg mx-auto">
      {!regSuccess ? (
        <>
          <div className="text-center mb-7">
            <div className="font-display text-[13px] tracking-[4px] text-green mb-2">JOIN THE TOURNAMENT</div>
            <h2 className="font-display text-4xl tracking-[2px]">PLAYER REGISTRATION</h2>
            <p className="text-[14px] text-t2 mt-2 leading-relaxed">Fill in your details below to join the North Star Amateur Series.</p>
          </div>

          <div className="card p-7">
            <div className="flex flex-col gap-4">
              <div>
                <div className="section-label">FULL NAME</div>
                <input defaultValue={regForm.name} onBlur={e=>setRegForm(f=>({...f,name:e.target.value}))} placeholder="First Last" className="w-full"/>
              </div>

              <div>
                <div className="section-label">EMAIL ADDRESS</div>
                <input type="email" defaultValue={regForm.email} onBlur={e=>setRegForm(f=>({...f,email:e.target.value}))} placeholder="you@email.com" className="w-full"/>
                <div className="text-[11px] text-t3 mt-1">For tournament updates and announcements only.</div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="section-label">HANDICAP INDEX</div>
                  <input type="number" defaultValue={regForm.handicap} onBlur={e=>setRegForm(f=>({...f,handicap:e.target.value}))} placeholder="0" min="0" max="54" className="w-full"/>
                  <div className="text-[11px] text-amber mt-1 leading-snug">⚠ Commissioner verifies before Event 1. Have your Grint screenshot ready.</div>
                </div>
                <div className="flex-[2]">
                  <div className="section-label">SKILL LEVEL</div>
                  <select value={regForm.flight} onChange={e=>setRegForm(f=>({...f,flight:e.target.value}))} className="w-full">
                    {SKILL_LEVELS.map(f=><option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="section-label">YOUR PIN</div>
                  <input type="password" maxLength={4} defaultValue={regForm.pin}
                    onBlur={e=>setRegForm(f=>({...f,pin:e.target.value.replace(/\D/g,"")}))}
                    placeholder="4 digits" className="w-full text-center" style={{letterSpacing:6,fontSize:18}}/>
                </div>
                <div className="flex-1">
                  <div className="section-label">CONFIRM PIN</div>
                  <input type="password" maxLength={4} defaultValue={regForm.pin2}
                    onBlur={e=>setRegForm(f=>({...f,pin2:e.target.value.replace(/\D/g,"")}))}
                    placeholder="4 digits" className="w-full text-center" style={{letterSpacing:6,fontSize:18}}/>
                </div>
              </div>
              <div className="text-[12px] text-t3 italic">🔒 Your PIN protects your scorecard. Only you (and the commissioner) can edit your scores.</div>

              {activeOneOff?.hasPassword && (
                <div className="mt-4 p-4 rounded-[4px]" style={{background:"#0a1a0a",border:"1px solid var(--green)"}}>
                  <div className="section-label text-green mb-1.5">🟢 TOURNAMENT IN PROGRESS: {activeOneOff.title}</div>
                  <div className="text-[12px] text-t3 mb-2">Have a tournament password? Enter it to join the leaderboard.</div>
                  <input defaultValue={regForm.tourneyPw}
                    onBlur={e=>setRegForm(f=>({...f,tourneyPw:e.target.value}))}
                    placeholder="Tournament password" className="w-full text-[14px]"/>
                </div>
              )}

              <div className="p-4 rounded-[4px] bg-bg3 border border-border2">
                <div className="section-label mb-1.5">🔒 LEAGUE PASSWORD</div>
                <input defaultValue={regForm.leagueCode}
                  onBlur={e=>setRegForm(f=>({...f,leagueCode:e.target.value}))}
                  placeholder="Enter league password" className="w-full"/>
                <div className="text-[11px] text-t3 mt-1">Get this from the commissioner to complete registration.</div>
              </div>

              {regError && (
                <div className="text-[13px] text-red bg-[#2a0808] border border-[#4a1010] px-3.5 py-2.5 rounded-[4px]">{regError}</div>
              )}
              <button className="btn-gold w-full py-3.5 text-[15px] mt-1" onClick={handleRegister}>REGISTER &amp; JOIN →</button>
            </div>
          </div>

          <div className="text-center mt-4 text-[13px] text-t3">
            Already registered?{" "}
            <span className="text-gold cursor-pointer" onClick={()=>setScreen("my-scores-login")}>Enter scores →</span>
          </div>
        </>
      ) : (
        <div className="text-center pt-10">
          <div className="text-[52px] mb-4">🏌️</div>
          <div className="font-display text-4xl tracking-[2px] text-gold mb-2.5">YOU'RE IN!</div>
          <p className="text-[16px] text-t2 mb-7 leading-relaxed">Welcome! Good luck out there.</p>
          <button className="btn-gold px-8 py-3 text-[14px]" onClick={()=>setScreen("my-scores")}>START ENTERING SCORES →</button>
        </div>
      )}
    </div>
  );
}

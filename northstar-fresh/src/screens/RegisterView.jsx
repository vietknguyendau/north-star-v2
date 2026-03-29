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
    <div className="fade-up" style={{maxWidth:460,margin:"0 auto"}}>
      {!regSuccess ? (
        <>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--green)",marginBottom:8}}>JOIN THE TOURNAMENT</div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2}}>PLAYER REGISTRATION</h2>
            <p style={{fontSize:14,color:"var(--text2)",marginTop:8,lineHeight:1.7}}>Fill in your details below to join the North Star Amateur Series.</p>
          </div>
          <div className="card" style={{padding:28}}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="section-label">FULL NAME</div>
                <input defaultValue={regForm.name} onBlur={e=>setRegForm(f=>({...f,name:e.target.value}))} placeholder="First Last" style={{width:"100%"}}/>
              </div>
              <div>
                <div className="section-label">EMAIL ADDRESS</div>
                <input type="email" defaultValue={regForm.email} onBlur={e=>setRegForm(f=>({...f,email:e.target.value}))} placeholder="you@email.com" style={{width:"100%"}}/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>For tournament updates and announcements only.</div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{flex:1}}>
                  <div className="section-label">HANDICAP INDEX</div>
                  <input type="number" defaultValue={regForm.handicap} onBlur={e=>setRegForm(f=>({...f,handicap:e.target.value}))} placeholder="0" min="0" max="54" style={{width:"100%"}}/>
                  <div style={{fontSize:11,color:"var(--amber)",marginTop:5,lineHeight:1.4}}>⚠ Commissioner verifies before Event 1. Have your Grint screenshot ready.</div>
                </div>
                <div style={{flex:2}}>
                  <div className="section-label">SKILL LEVEL</div>
                  <select value={regForm.flight} onChange={e=>setRegForm(f=>({...f,flight:e.target.value}))} style={{width:"100%"}}>
                    {SKILL_LEVELS.map(f=><option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{flex:1}}>
                  <div className="section-label">YOUR PIN</div>
                  <input type="password" maxLength={4} defaultValue={regForm.pin} onBlur={e=>setRegForm(f=>({...f,pin:e.target.value.replace(/\D/g,"")}))} placeholder="4 digits" style={{width:"100%",letterSpacing:6,textAlign:"center",fontSize:18}}/>
                </div>
                <div style={{flex:1}}>
                  <div className="section-label">CONFIRM PIN</div>
                  <input type="password" maxLength={4} defaultValue={regForm.pin2} onBlur={e=>setRegForm(f=>({...f,pin2:e.target.value.replace(/\D/g,"")}))} placeholder="4 digits" style={{width:"100%",letterSpacing:6,textAlign:"center",fontSize:18}}/>
                </div>
              </div>
              <div style={{fontSize:12,color:"var(--text3)",fontStyle:"italic"}}>🔒 Your PIN protects your scorecard. Only you (and the commissioner) can edit your scores.</div>

              {activeOneOff?.hasPassword && (
                <div style={{marginTop:16,padding:"12px 16px",background:"#0a1a0a",border:"1px solid var(--green)",borderRadius:4}}>
                  <div className="section-label" style={{color:"var(--green)",marginBottom:6}}>🟢 TOURNAMENT IN PROGRESS: {activeOneOff.title}</div>
                  <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>Have a tournament password? Enter it to join the leaderboard.</div>
                  <input defaultValue={regForm.tourneyPw} onBlur={e=>setRegForm(f=>({...f,tourneyPw:e.target.value}))}
                    placeholder="Tournament password" style={{width:"100%",fontSize:14}}/>
                </div>
              )}

              <div style={{marginTop:4,padding:"12px 16px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4}}>
                <div className="section-label" style={{marginBottom:6}}>🔒 LEAGUE PASSWORD</div>
                <input defaultValue={regForm.leagueCode} onBlur={e=>setRegForm(f=>({...f,leagueCode:e.target.value}))}
                  placeholder="Enter league password" style={{width:"100%"}}/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Get this from the commissioner to complete registration.</div>
              </div>

              {regError && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"10px 14px",borderRadius:4}}>{regError}</div>}
              <button className="btn-gold" style={{width:"100%",padding:13,fontSize:15,marginTop:4}} onClick={handleRegister}>REGISTER &amp; JOIN →</button>
            </div>
          </div>
          <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"var(--text3)"}}>
            Already registered? <span style={{color:"var(--gold)",cursor:"pointer"}} onClick={()=>setScreen("my-scores-login")}>Enter scores →</span>
          </div>
        </>
      ) : (
        <div style={{textAlign:"center",paddingTop:40}}>
          <div style={{fontSize:52,marginBottom:16}}>🏌️</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:36,letterSpacing:2,color:"var(--gold)",marginBottom:10}}>YOU'RE IN!</div>
          <p style={{fontSize:16,color:"var(--text2)",marginBottom:28,lineHeight:1.8}}>Welcome! Good luck out there.</p>
          <button className="btn-gold" style={{padding:"12px 32px",fontSize:14}} onClick={()=>setScreen("my-scores")}>START ENTERING SCORES →</button>
        </div>
      )}
    </div>
  );
}

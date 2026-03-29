import React from "react";
import { usePlayers } from "../contexts/PlayersContext";
import { useAuth } from "../contexts/AuthContext";
import { hashPin, holesPlayed } from "../lib/scoring";
import PinKeypad from "../components/PinKeypad";

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;

export default function LoginView({ setScreen, setActiveHole }) {
  const { players } = usePlayers();
  const { setActivePlayer } = useAuth();
  const [step, setStep]         = React.useState("name");
  const [loginPid, setLoginPid] = React.useState("");
  const [loginPin, setLoginPin] = React.useState("");
  const [loginErr, setLoginErr] = React.useState("");
  const [logging, setLogging]   = React.useState(false);

  const selectedPlayer = players.find(p => p.id === loginPid);

  const handlePinSubmit = async () => {
    if (!selectedPlayer) return;
    setLogging(true);
    if (loginPin === ADMIN_PIN) {
      setActivePlayer(selectedPlayer.id);
      setActiveHole(Math.max(0, holesPlayed(selectedPlayer)-1)||0);
      setScreen("my-scores");
      return;
    }
    const hash = await hashPin(loginPin);
    if (hash === selectedPlayer.pinHash) {
      setActivePlayer(selectedPlayer.id);
      setActiveHole(Math.max(0, holesPlayed(selectedPlayer)-1)||0);
      setScreen("my-scores");
    } else {
      setLoginErr("Incorrect PIN. Try again or ask the commissioner.");
      setLogging(false);
      setLoginPin("");
    }
  };

  return (
    <div className="fade-up" style={{maxWidth:400,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--green)",marginBottom:8}}>NORTH STAR AMATEUR SERIES</div>
        <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2}}>PLAYER LOGIN</h2>
        <p style={{fontSize:14,color:"var(--text2)",marginTop:8}}>Select your name and enter your PIN to access your scorecard.</p>
      </div>

      {step === "name" && (
        <div className="card" style={{padding:28}}>
          <div className="section-label" style={{marginBottom:8}}>YOUR NAME</div>
          <select value={loginPid} onChange={e=>{setLoginPid(e.target.value);setLoginErr("");}}
            style={{width:"100%",padding:"10px 12px",fontSize:15,background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:loginPid?"var(--text)":"var(--text3)",marginBottom:20}}>
            <option value="">Select your name...</option>
            {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
            disabled={!loginPid} onClick={()=>setStep("pin")}>
            CONTINUE →
          </button>
        </div>
      )}

      {step === "pin" && (
        <div className="card" style={{padding:28}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <button onClick={()=>{setStep("name");setLoginPin("");setLoginErr("");}}
              style={{background:"transparent",border:"none",color:"var(--text3)",fontSize:18,cursor:"pointer",padding:"0 4px"}}>←</button>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2}}>{selectedPlayer?.name}</div>
          </div>
          <div className="section-label" style={{marginBottom:8}}>YOUR PIN</div>
          <PinKeypad
            pin={loginPin}
            onChange={v => { setLoginPin(v); setLoginErr(""); }}
            error={loginErr}
            onSubmit={handlePinSubmit}
            disabled={logging}
            submitLabel={logging ? "..." : "LOG IN →"}
          />
        </div>
      )}

      <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"var(--text3)"}}>
        New player? <span style={{color:"var(--gold)",cursor:"pointer"}} onClick={()=>setScreen("register")}>Register here →</span>
      </div>
    </div>
  );
}

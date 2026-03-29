import React from "react";
import { usePlayers } from "../contexts/PlayersContext";
import { useAuth } from "../contexts/AuthContext";
import { hashPin } from "../lib/scoring";
import PinKeypad from "../components/PinKeypad";

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;

export default function SidebetsLogin({ notify, setScreen }) {
  const { players } = usePlayers();
  const { setActivePlayer } = useAuth();
  const [sbPid, setSbPid]   = React.useState("");
  const [sbPin, setSbPin]   = React.useState("");
  const [sbErr, setSbErr]   = React.useState("");
  const [sbStep, setSbStep] = React.useState("pick");

  const sbPlayer = players.find(p => p.id === sbPid);

  const verifySbPin = async () => {
    if (!sbPlayer) return;
    if (sbPin === ADMIN_PIN) { setActivePlayer(sbPid); setSbErr(""); return; }
    const hash = await hashPin(sbPin);
    if (hash === sbPlayer.pinHash) {
      setActivePlayer(sbPid);
      setSbErr("");
    } else {
      setSbErr("Incorrect PIN. Try again.");
      setSbPin("");
    }
  };

  return (
    <div style={{maxWidth:420,margin:"0 auto"}} className="fade-up">
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:4,color:"var(--green)",marginBottom:4}}>PRIVATE</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:28,letterSpacing:2}}>SIDEBETS</div>
        <div style={{fontSize:13,color:"var(--text3)",marginTop:6}}>Log in to view and create sidebets</div>
      </div>

      {sbStep === "pick" && (
        <div className="card" style={{padding:20}}>
          <div className="section-label" style={{marginBottom:12}}>SELECT YOUR NAME</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:320,overflowY:"auto"}}>
            {players.map(p=>(
              <button key={p.id}
                className={`flight-chip ${sbPid===p.id?"active":""}`}
                style={{textAlign:"left",padding:"12px 16px",fontSize:14,justifyContent:"space-between",display:"flex",alignItems:"center"}}
                onClick={()=>setSbPid(p.id)}>
                <span>{p.name}</span>
                <span style={{fontSize:11,color:"var(--text3)"}}>HCP {p.handicap}</span>
              </button>
            ))}
          </div>
          <button className="btn-gold" style={{width:"100%",marginTop:14,fontSize:13}}
            disabled={!sbPid} onClick={()=>setSbStep("pin")}>
            CONTINUE →
          </button>
        </div>
      )}

      {sbStep === "pin" && (
        <div className="card" style={{padding:24,textAlign:"center"}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,marginBottom:4}}>{sbPlayer?.name}</div>
          <div style={{fontSize:13,color:"var(--text3)",marginBottom:20}}>Enter your PIN to access sidebets</div>
          <PinKeypad
            pin={sbPin}
            onChange={setSbPin}
            error={sbErr}
            onSubmit={verifySbPin}
            submitLabel="VERIFY →"
          />
          <button className="btn-ghost" style={{fontSize:12,marginTop:4}} onClick={()=>{ setSbStep("pick"); setSbPin(""); setSbErr(""); }}>← Back</button>
        </div>
      )}
    </div>
  );
}

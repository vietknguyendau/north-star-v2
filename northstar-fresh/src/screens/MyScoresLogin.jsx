import React from "react";
import { usePlayers } from "../contexts/PlayersContext";
import { useAuth } from "../contexts/AuthContext";
import { hashPin, holesPlayed } from "../lib/scoring";
import PinKeypad from "../components/PinKeypad";

const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN;

export default function MyScoresLogin({ setScreen, setActiveHole }) {
  const { players } = usePlayers();
  const { setActivePlayer } = useAuth();
  const [pendingPlayer, setPendingPlayer] = React.useState(null);
  const [scorePin, setScorePin]           = React.useState("");
  const [scorePinError, setScorePinError] = React.useState("");
  const [pinAttempts, setPinAttempts]     = React.useState({});

  const handlePinSubmit = async () => {
    if (!pendingPlayer) return;
    const attempts = pinAttempts[pendingPlayer.id] || 0;
    if (attempts >= 5) { setScorePinError("Too many attempts. Ask the commissioner to reset your PIN."); return; }
    if (scorePin === ADMIN_PIN) {
      setActivePlayer(pendingPlayer.id);
      setActiveHole(Math.max(0, holesPlayed(pendingPlayer)-1)||0);
      setScreen("my-scores");
      setScorePin(""); setScorePinError(""); setPendingPlayer(null);
      return;
    }
    const hash = await hashPin(scorePin);
    if (hash === pendingPlayer.pinHash) {
      setActivePlayer(pendingPlayer.id);
      setActiveHole(Math.max(0, holesPlayed(pendingPlayer)-1)||0);
      setScreen("my-scores");
      setPinAttempts(prev => ({ ...prev, [pendingPlayer.id]: 0 }));
      setScorePin(""); setScorePinError(""); setPendingPlayer(null);
    } else {
      const newAttempts = attempts + 1;
      setPinAttempts(prev => ({ ...prev, [pendingPlayer.id]: newAttempts }));
      setScorePinError(`Incorrect PIN. ${5 - newAttempts} attempt${5-newAttempts===1?"":"s"} remaining.`);
    }
  };

  return (
    <div className="fade-up" style={{maxWidth:460,margin:"0 auto"}}>
      {!pendingPlayer ? (
        <>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--green)",marginBottom:6}}>SCORE ENTRY</div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:28,letterSpacing:2}}>WHO ARE YOU?</h2>
          </div>
          <div className="card" style={{overflow:"hidden"}}>
            {players.length === 0 && <div style={{padding:32,textAlign:"center",color:"var(--text3)",fontSize:14}}>No players registered yet.<br/>Register using the Register tab.</div>}
            {players.map(p=>(
              <div key={p.id} className="player-row" style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                onClick={()=>{ setPendingPlayer(p); setScorePin(""); setScorePinError(""); }}>
                <div>
                  <div style={{fontSize:17,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:12,color:"var(--text3)"}}>HCP {p.handicap} · Thru {holesPlayed(p)||"—"}</div>
                </div>
                <span style={{color:"var(--gold)",fontSize:12,fontFamily:"'Bebas Neue'",letterSpacing:1}}>SELECT →</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--green)",marginBottom:8}}>SCORE ENTRY</div>
          <h2 style={{fontFamily:"'Bebas Neue'",fontSize:28,letterSpacing:2,marginBottom:4}}>{pendingPlayer.name}</h2>
          <div style={{fontSize:12,color:"var(--text3)",marginBottom:28}}>Enter your 4-digit PIN to continue</div>
          <div className="card" style={{padding:28,maxWidth:320,margin:"0 auto"}}>
            <PinKeypad
              pin={scorePin}
              onChange={v => { setScorePin(v); setScorePinError(""); }}
              error={scorePinError}
              onSubmit={handlePinSubmit}
              submitLabel="ENTER →"
            />
            <button className="btn-ghost" style={{width:"100%",fontSize:12,marginTop:8}} onClick={()=>{ setPendingPlayer(null); setScorePin(""); setScorePinError(""); }}>← BACK</button>
          </div>
        </div>
      )}
    </div>
  );
}

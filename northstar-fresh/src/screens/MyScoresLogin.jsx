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
    <div className="fade-up max-w-lg mx-auto">
      {!pendingPlayer ? (
        <>
          <div className="text-center mb-6">
            <div className="font-display text-[13px] tracking-[4px] text-green mb-1.5">SCORE ENTRY</div>
            <h2 className="font-display text-[28px] tracking-[2px]">WHO ARE YOU?</h2>
          </div>
          <div className="card overflow-hidden">
            {players.length === 0 && (
              <div className="p-8 text-center text-t3 text-[14px]">
                No players registered yet.<br/>Register using the Register tab.
              </div>
            )}
            {players.map(p=>(
              <button
                key={p.id}
                className="player-row w-full px-5 py-4 flex justify-between items-center min-h-[64px] bg-transparent border-none cursor-pointer text-left"
                onClick={()=>{ setPendingPlayer(p); setScorePin(""); setScorePinError(""); }}>
                <div>
                  <div className="text-[17px] font-semibold text-text">{p.name}</div>
                  <div className="text-[12px] text-t3">HCP {p.handicap} · Thru {holesPlayed(p)||"—"}</div>
                </div>
                <span className="font-display text-[12px] tracking-[1px] text-gold">SELECT →</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center">
          <div className="font-display text-[13px] tracking-[4px] text-green mb-2">SCORE ENTRY</div>
          <h2 className="font-display text-[28px] tracking-[2px] mb-1">{pendingPlayer.name}</h2>
          <div className="text-[12px] text-t3 mb-7">Enter your 4-digit PIN to continue</div>
          <div className="card p-7 max-w-xs mx-auto">
            <PinKeypad
              pin={scorePin}
              onChange={v => { setScorePin(v); setScorePinError(""); }}
              error={scorePinError}
              onSubmit={handlePinSubmit}
              submitLabel="ENTER →"
            />
            <button
              className="btn-ghost w-full text-[12px] mt-2"
              onClick={()=>{ setPendingPlayer(null); setScorePin(""); setScorePinError(""); }}>
              ← BACK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

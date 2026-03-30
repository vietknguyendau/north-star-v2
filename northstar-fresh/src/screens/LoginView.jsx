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
    <div className="fade-up max-w-sm mx-auto px-4">
      <div className="text-center mb-7">
        <div className="font-display text-[13px] tracking-[4px] text-green mb-2">NORTH STAR AMATEUR SERIES</div>
        <h2 className="font-display text-4xl tracking-[2px]">PLAYER LOGIN</h2>
        <p className="text-[14px] text-t2 mt-2 leading-relaxed">Select your name and enter your PIN to access your scorecard.</p>
      </div>

      {step === "name" && (
        <div className="card p-7">
          <div className="section-label mb-2">YOUR NAME</div>
          <select
            value={loginPid}
            onChange={e=>{ setLoginPid(e.target.value); setLoginErr(""); }}
            className="w-full px-3 py-3 text-[15px] bg-bg3 border border-border2 rounded-[4px] mb-5 min-h-[44px]"
            style={{ color: loginPid ? "var(--text)" : "var(--text3)" }}
          >
            <option value="">Select your name...</option>
            {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-gold w-full text-[14px] py-3.5" disabled={!loginPid} onClick={()=>setStep("pin")}>
            CONTINUE →
          </button>
        </div>
      )}

      {step === "pin" && (
        <div className="card p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <button
              onClick={()=>{ setStep("name"); setLoginPin(""); setLoginErr(""); }}
              className="bg-transparent border-none text-t3 text-lg cursor-pointer px-1">
              ←
            </button>
            <div className="font-display text-[18px] tracking-[2px]">{selectedPlayer?.name}</div>
          </div>
          <div className="section-label mb-2">YOUR PIN</div>
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

      <div className="text-center mt-4 text-[13px] text-t3">
        New player?{" "}
        <span className="text-gold cursor-pointer" onClick={()=>setScreen("register")}>Register here →</span>
      </div>
    </div>
  );
}

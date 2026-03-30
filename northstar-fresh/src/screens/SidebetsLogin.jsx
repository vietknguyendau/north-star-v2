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
    <div className="max-w-lg mx-auto fade-up">
      <div className="text-center mb-6">
        <div className="font-display text-[10px] tracking-[4px] text-green mb-1">PRIVATE</div>
        <div className="font-display text-[28px] tracking-[2px]">SIDEBETS</div>
        <div className="text-[13px] text-t3 mt-1.5">Log in to view and create sidebets</div>
      </div>

      {sbStep === "pick" && (
        <div className="card p-5">
          <div className="section-label mb-3">SELECT YOUR NAME</div>
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {players.map(p=>(
              <button key={p.id}
                className={`flight-chip ${sbPid===p.id?"active":""} text-left px-4 py-3 text-[14px] justify-between flex items-center min-h-[48px]`}
                onClick={()=>setSbPid(p.id)}>
                <span>{p.name}</span>
                <span className="text-[11px] text-t3">HCP {p.handicap}</span>
              </button>
            ))}
          </div>
          <button className="btn-gold w-full mt-3.5 text-[13px]" disabled={!sbPid} onClick={()=>setSbStep("pin")}>
            CONTINUE →
          </button>
        </div>
      )}

      {sbStep === "pin" && (
        <div className="card p-6 text-center">
          <div className="font-display text-[22px] tracking-[2px] mb-1">{sbPlayer?.name}</div>
          <div className="text-[13px] text-t3 mb-5">Enter your PIN to access sidebets</div>
          <PinKeypad
            pin={sbPin}
            onChange={setSbPin}
            error={sbErr}
            onSubmit={verifySbPin}
            submitLabel="VERIFY →"
          />
          <button className="btn-ghost text-[12px] mt-1"
            onClick={()=>{ setSbStep("pick"); setSbPin(""); setSbErr(""); }}>
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

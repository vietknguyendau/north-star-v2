import React from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { TOURNAMENT_ID } from "../constants";
import { hashPin } from "../lib/scoring";

export default function PinResetButton({ player, notify }) {
  const [open, setOpen]     = React.useState(false);
  const [newPin, setNewPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (newPin.length !== 4) return;
    setSaving(true);
    try {
      const hash = await hashPin(newPin);
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "players", player.id), { pinHash: hash }, { merge: true });
      setOpen(false);
      setNewPin("");
      notify(player.name + "'s PIN updated.");
    } catch(e) { console.error(e); notify("Failed to update PIN — check connection.", "error"); }
    setSaving(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{padding:"5px 10px",fontSize:11,fontFamily:"'Bebas Neue'",letterSpacing:1,
        background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",
        borderRadius:3,cursor:"pointer",whiteSpace:"nowrap"}}>
      🔑 PIN
    </button>
  );

  return (
    <div style={{display:"flex",gap:4,alignItems:"center"}}>
      <input type="password" maxLength={4} placeholder="New PIN"
        value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,"").slice(0,4))}
        style={{width:80,padding:"5px 8px",fontSize:13,background:"var(--bg3)",
          border:"1px solid var(--gold-dim)",borderRadius:3,color:"var(--text)",textAlign:"center"}}/>
      <button onClick={save} disabled={saving || newPin.length !== 4}
        style={{padding:"5px 8px",fontSize:11,fontFamily:"'Bebas Neue'",letterSpacing:1,
          background:"var(--gold)",color:"#060a06",border:"none",borderRadius:3,cursor:"pointer"}}>
        {saving ? "..." : "SAVE"}
      </button>
      <button onClick={() => { setOpen(false); setNewPin(""); }}
        style={{padding:"5px 6px",background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14}}>✕</button>
    </div>
  );
}

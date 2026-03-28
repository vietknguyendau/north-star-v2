import React from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { TOURNAMENT_ID } from "../constants";

export default function CtpDistanceEntry({ player, holeIdx, ctpBet, notify }) {
  const [feet, setFeet]     = React.useState("");
  const [inches, setInches] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!feet || feet < 0) { notify("Enter a valid distance.", "error"); return; }
    setSaving(true);
    const ctpKey = `hole_${holeIdx}`;
    const updated = {
      ...ctpBet,
      entries: {
        ...ctpBet.entries,
        [player.id]: {
          ...ctpBet.entries[player.id],
          feet: parseInt(feet),
          inches: parseInt(inches) || 0,
          totalInches: parseInt(feet) * 12 + (parseInt(inches) || 0),
          playerName: player.name,
          submittedAt: new Date().toISOString(),
        }
      }
    };
    try {
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "ctp_bets", ctpKey), updated);
      notify("Distance submitted! Good luck 🎯");
    } catch(e) { console.error(e); notify("Failed to submit distance — check connection.", "error"); }
    setSaving(false);
  };

  return (
    <div style={{marginTop:8}}>
      <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>Enter your distance to the pin:</div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
        <input type="number" value={feet} onChange={e => setFeet(e.target.value)} placeholder="Feet"
          style={{width:70,padding:"8px 10px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--text)",fontSize:15,textAlign:"center"}}/>
        <span style={{color:"var(--text3)"}}>ft</span>
        <input type="number" value={inches} onChange={e => setInches(e.target.value)} placeholder="In" min="0" max="11"
          style={{width:60,padding:"8px 10px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--text)",fontSize:15,textAlign:"center"}}/>
        <span style={{color:"var(--text3)"}}>in</span>
        <button className="btn-gold" style={{fontSize:12,padding:"8px 16px"}} onClick={submit} disabled={saving || !feet}>
          {saving ? "..." : "SUBMIT"}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";

const TOURNAMENT_ID = "tournament-2024";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
.sb-card { background:var(--bg2); border:1px solid var(--border); border-radius:6px; overflow:hidden; margin-bottom:12px; }
.sb-header { padding:14px 18px; background:var(--bg3); display:flex; justify-content:space-between; align-items:center; }
.sb-body { padding:16px 18px; }
.sb-vs { font-family:'Bebas Neue'; font-size:32px; color:var(--gold); letter-spacing:2px; text-align:center; line-height:1; }
.sb-label { font-family:'Bebas Neue'; font-size:9px; letter-spacing:3px; color:var(--text3); margin-bottom:2px; }
.sb-score { font-family:'Bebas Neue'; font-size:28px; line-height:1; }
.sb-status { font-family:'Bebas Neue'; font-size:11px; letter-spacing:2px; padding:4px 10px; border-radius:2px; }
.sb-form-row { display:flex; flex-direction:column; gap:4px; margin-bottom:14px; }
.sb-form-row label { font-family:'Bebas Neue'; font-size:10px; letter-spacing:2px; color:var(--text3); }
.sb-form-row select, .sb-form-row input { background:var(--bg3); border:1px solid var(--border2); color:var(--text); padding:8px 10px; border-radius:3px; font-size:14px; width:100%; box-sizing:border-box; }
.sb-form-row select:focus, .sb-form-row input:focus { outline:none; border-color:var(--gold); }
.sb-fade { animation: sbFade .3s ease; }
@keyframes sbFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`;

const FORMAT_LABELS = {
  "18": "Full 18 Holes",
  "front9": "Front 9",
  "back9": "Back 9",
};

function getScores(player, format, scoring, pars) {
  if (!player) return null;
  const scores = player.scores || [];
  let indices = [];
  if (format === "18")     indices = Array.from({length:18},(_,i)=>i);
  if (format === "front9") indices = Array.from({length:9}, (_,i)=>i);
  if (format === "back9")  indices = Array.from({length:9}, (_,i)=>i+9);

  const holesPlayed = indices.filter(i => scores[i] !== null && scores[i] !== undefined);
  if (holesPlayed.length === 0) return { total: null, thru: 0, complete: false };

  const gross = holesPlayed.reduce((sum, i) => sum + (scores[i] || 0), 0);

  if (scoring === "gross") {
    return { total: gross, thru: holesPlayed.length, complete: holesPlayed.length === indices.length };
  }

  // Net: apply handicap strokes hole by hole
  const HCP_ORDER = [1,10,2,11,3,12,4,13,5,14,6,15,7,16,8,17,9,18].map(h=>h-1);
  const courseHcp = Math.round((player.handicap || 0) * 113 / 128);
  const strokesPerHole = Array(18).fill(0);
  for (let i = 0; i < courseHcp && i < 18; i++) strokesPerHole[HCP_ORDER[i]]++;

  const net = holesPlayed.reduce((sum, i) => sum + Math.max(1, (scores[i] || 0) - strokesPerHole[i]), 0);
  const parTotal = holesPlayed.reduce((sum, i) => sum + (pars[i] || 4), 0);

  return { total: net, gross, parTotal, thru: holesPlayed.length, complete: holesPlayed.length === indices.length };
}

function BetCard({ bet, myPlayer, opponent, pars, onDelete }) {
  const myScores   = getScores(myPlayer,   bet.format, bet.scoring, pars);
  const oppScores  = getScores(opponent,   bet.format, bet.scoring, pars);
  const totalHoles = bet.format === "18" ? 18 : 9;

  const myTotal  = myScores?.total  ?? null;
  const oppTotal = oppScores?.total ?? null;

  let statusText = "IN PROGRESS";
  let statusColor = "var(--text3)";
  let statusBg = "var(--bg3)";
  let winner = null;

  const complete = myScores?.complete && oppScores?.complete;

  if (myTotal !== null && oppTotal !== null) {
    if (complete) {
      if (myTotal < oppTotal)       { statusText = "YOU WIN 🏆"; statusColor = "var(--gold)"; statusBg = "#1c1400"; winner = "me"; }
      else if (oppTotal < myTotal)  { statusText = `${opponent?.name?.split(" ")[0]?.toUpperCase()} WINS`; statusColor = "var(--red)"; statusBg = "#1c0808"; winner = "opp"; }
      else                          { statusText = "ALL SQUARE"; statusColor = "var(--green)"; statusBg = "#0a140a"; }
    } else {
      if (myTotal < oppTotal)       { statusText = `YOU +${oppTotal - myTotal} UP`; statusColor = "var(--green)"; }
      else if (oppTotal < myTotal)  { statusText = `${oppTotal - myTotal < 0 ? "" : "-"}${Math.abs(oppTotal - myTotal)} DOWN`; statusColor = "var(--amber)"; }
      else                          { statusText = "ALL SQUARE"; statusColor = "var(--text2)"; }
    }
  }

  const formatScore = (s, thru) => {
    if (s === null) return "—";
    return s;
  };

  return (
    <div className="sb-card sb-fade">
      <div className="sb-header">
        <div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:3,color:"var(--green)",marginBottom:2}}>
            {FORMAT_LABELS[bet.format]} · {bet.scoring === "net" ? "NET" : "GROSS"}
          </div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:1,color:"var(--gold)"}}>
            ${bet.amount} SIDEBET
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span className="sb-status" style={{color:statusColor,background:statusBg,border:`1px solid ${statusColor}33`}}>
            {statusText}
          </span>
          {!complete && (
            <button onClick={onDelete} style={{background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:16,padding:"2px 6px"}} title="Cancel bet">✕</button>
          )}
        </div>
      </div>

      <div className="sb-body">
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center"}}>
          {/* Me */}
          <div style={{textAlign:"center"}}>
            <div className="sb-label">YOU</div>
            <div className="sb-score" style={{color: winner==="me"?"var(--gold)":winner==="opp"?"var(--red)":"var(--text)"}}>
              {formatScore(myTotal, myScores?.thru)}
            </div>
            <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,marginTop:2}}>
              THRU {myScores?.thru ?? 0}
            </div>
          </div>

          {/* VS */}
          <div style={{textAlign:"center"}}>
            <div className="sb-vs">VS</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:9,letterSpacing:2,color:"var(--text3)",marginTop:2}}>
              {bet.scoring.toUpperCase()} SCORE
            </div>
          </div>

          {/* Opponent */}
          <div style={{textAlign:"center"}}>
            <div className="sb-label">{opponent?.name?.split(" ")[0]?.toUpperCase() ?? "OPP"}</div>
            <div className="sb-score" style={{color: winner==="opp"?"var(--gold)":winner==="me"?"var(--red)":"var(--text)"}}>
              {formatScore(oppTotal, oppScores?.thru)}
            </div>
            <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,marginTop:2}}>
              THRU {oppScores?.thru ?? 0}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{marginTop:14,background:"var(--bg3)",borderRadius:2,height:4,overflow:"hidden"}}>
          <div style={{
            height:"100%",
            width:`${Math.round(((myScores?.thru??0) / totalHoles)*100)}%`,
            background:"var(--gold)",
            transition:"width .5s ease",
            borderRadius:2,
          }}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>HOLE 1</span>
          <span style={{fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>{totalHoles} HOLES</span>
        </div>

        {complete && winner === "me" && (
          <div style={{marginTop:12,padding:"10px 14px",background:"#1c1400",border:"1px solid var(--gold-dim)",borderRadius:4,textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:2,color:"var(--gold)"}}>
              🏆 COLLECT ${bet.amount} FROM {opponent?.name?.split(" ")[0]?.toUpperCase()}
            </div>
          </div>
        )}
        {complete && winner === "opp" && (
          <div style={{marginTop:12,padding:"10px 14px",background:"#1c0808",border:"1px solid #5a1a1a",borderRadius:4,textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:2,color:"var(--red)"}}>
              PAY ${bet.amount} TO {opponent?.name?.split(" ")[0]?.toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebets({ myPlayer, players, pars }) {
  const [bets, setBets]         = useState([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ opponentId:"", format:"18", scoring:"net", amount:"" });

  useEffect(() => {
    if (!myPlayer) return;
    const unsub = onSnapshot(
      collection(db,"tournaments",TOURNAMENT_ID,"sidebets"),
      snap => {
        const all = snap.docs.map(d=>({id:d.id,...d.data()}));
        // Only show bets involving this player
        setBets(all.filter(b => b.player1 === myPlayer.id || b.player2 === myPlayer.id));
      }
    );
    return () => unsub();
  }, [myPlayer?.id]);

  const createBet = async () => {
    if (!form.opponentId) return;
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    const id = `bet_${myPlayer.id}_${form.opponentId}_${Date.now()}`;
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"sidebets",id), {
      player1: myPlayer.id,
      player2: form.opponentId,
      format:  form.format,
      scoring: form.scoring,
      amount:  parseFloat(form.amount),
      createdAt: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    });
    setCreating(false);
    setForm({ opponentId:"", format:"18", scoring:"net", amount:"" });
    setSaving(false);
  };

  const deleteBet = async (betId) => {
    await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"sidebets",betId));
  };

  const eligible = players.filter(p => p.id !== myPlayer?.id);

  if (!myPlayer) return null;

  return (
    <div className="sb-fade">
      <style>{CSS}</style>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:3,color:"var(--green)",marginBottom:2}}>PRIVATE</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2}}>YOUR SIDEBETS</div>
        </div>
        {!creating && (
          <button className="btn-gold" style={{fontSize:12}} onClick={()=>setCreating(true)}>+ NEW BET</button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="sb-card sb-fade" style={{border:"1px solid var(--gold-dim)"}}>
          <div className="sb-header">
            <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:2,color:"var(--gold)"}}>NEW SIDEBET</div>
            <button onClick={()=>setCreating(false)} style={{background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          <div className="sb-body">
            <div className="sb-form-row">
              <label>OPPONENT</label>
              <select value={form.opponentId} onChange={e=>setForm(f=>({...f,opponentId:e.target.value}))}>
                <option value="">Select a player...</option>
                {eligible.map(p=>(
                  <option key={p.id} value={p.id}>{p.name} (HCP {p.handicap})</option>
                ))}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div className="sb-form-row">
                <label>FORMAT</label>
                <select value={form.format} onChange={e=>setForm(f=>({...f,format:e.target.value}))}>
                  <option value="18">Full 18</option>
                  <option value="front9">Front 9</option>
                  <option value="back9">Back 9</option>
                </select>
              </div>
              <div className="sb-form-row">
                <label>SCORING</label>
                <select value={form.scoring} onChange={e=>setForm(f=>({...f,scoring:e.target.value}))}>
                  <option value="net">Net</option>
                  <option value="gross">Gross</option>
                </select>
              </div>
            </div>
            <div className="sb-form-row">
              <label>BET AMOUNT ($)</label>
              <input type="number" min="1" placeholder="e.g. 20"
                value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button className="btn-gold" style={{fontSize:12}} onClick={createBet}
                disabled={saving||!form.opponentId||!form.amount}>
                {saving ? "CREATING…" : "CREATE BET"}
              </button>
              <button className="btn-ghost" style={{fontSize:12}} onClick={()=>setCreating(false)}>CANCEL</button>
            </div>
            <div style={{fontSize:11,color:"var(--text3)",marginTop:10,fontStyle:"italic",lineHeight:1.5}}>
              Only you and your opponent can see this bet. Scores update live as you both play.
            </div>
          </div>
        </div>
      )}

      {/* Active bets */}
      {bets.length === 0 && !creating && (
        <div style={{textAlign:"center",padding:"32px 0",color:"var(--text3)",fontSize:13,fontStyle:"italic"}}>
          No active sidebets. Hit + NEW BET to challenge someone.
        </div>
      )}

      {bets.map(bet => {
        const opponentId = bet.player1 === myPlayer.id ? bet.player2 : bet.player1;
        const opponent   = players.find(p => p.id === opponentId);
        return (
          <BetCard
            key={bet.id}
            bet={bet}
            myPlayer={myPlayer}
            opponent={opponent}
            pars={pars}
            onDelete={()=>deleteBet(bet.id)}
          />
        );
      })}
    </div>
  );
}

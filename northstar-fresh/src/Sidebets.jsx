import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

const TOURNAMENT_ID = "tournament-2024";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
.sb-card { background:var(--bg2); border:1px solid var(--border); border-radius:6px; overflow:hidden; margin-bottom:12px; }
.sb-header { padding:12px 16px; background:var(--bg3); display:flex; justify-content:space-between; align-items:center; }
.sb-body { padding:16px; }
.sb-vs { font-family:'Bebas Neue'; font-size:32px; color:var(--gold); letter-spacing:2px; text-align:center; line-height:1; }
.sb-label { font-family:'Bebas Neue'; font-size:9px; letter-spacing:3px; color:var(--text3); margin-bottom:2px; }
.sb-score { font-family:'Bebas Neue'; font-size:28px; line-height:1; }
.sb-status { font-family:'Bebas Neue'; font-size:11px; letter-spacing:2px; padding:4px 10px; border-radius:2px; }
.sb-form-row { display:flex; flex-direction:column; gap:4px; margin-bottom:14px; }
.sb-form-row label { font-family:'Bebas Neue'; font-size:10px; letter-spacing:2px; color:var(--text3); }
.sb-form-row select, .sb-form-row input { background:var(--bg3); border:1px solid var(--border2); color:var(--text); padding:8px 10px; border-radius:3px; font-size:14px; width:100%; box-sizing:border-box; }
.sb-tab { flex:1; padding:10px 4px; font-family:'Bebas Neue'; font-size:13px; letter-spacing:2px; border:none; cursor:pointer; transition:all .15s; }
.sb-tab.active { background:var(--gold); color:#060a06; }
.sb-tab:not(.active) { background:var(--bg3); color:var(--text3); }
.sb-fade { animation: sbFade .25s ease; }
@keyframes sbFade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
.sb-row { padding:11px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; }
.sb-row:last-child { border-bottom:none; }
`;

const FORMAT_LABELS = { "18":"Full 18", "front9":"Front 9", "back9":"Back 9" };

function getScores(player, format, scoring, pars) {
  if (!player) return null;
  const scores = player.scores || [];
  let indices = [];
  if (format === "18")     indices = Array.from({length:18},(_,i)=>i);
  if (format === "front9") indices = Array.from({length:9}, (_,i)=>i);
  if (format === "back9")  indices = Array.from({length:9}, (_,i)=>i+9);
  const holesPlayed = indices.filter(i => scores[i] !== null && scores[i] !== undefined);
  if (holesPlayed.length === 0) return { total:null, thru:0, complete:false };
  const gross = holesPlayed.reduce((sum,i) => sum+(scores[i]||0), 0);
  if (scoring === "gross") return { total:gross, thru:holesPlayed.length, complete:holesPlayed.length===indices.length };
  const HCP_ORDER = [1,10,2,11,3,12,4,13,5,14,6,15,7,16,8,17,9,18].map(h=>h-1);
  const courseHcp = Math.round((player.handicap||0)*113/128);
  const strokesPerHole = Array(18).fill(0);
  for (let i=0; i<courseHcp && i<18; i++) strokesPerHole[HCP_ORDER[i]]++;
  const net = holesPlayed.reduce((sum,i)=>sum+Math.max(1,(scores[i]||0)-strokesPerHole[i]),0);
  return { total:net, gross, thru:holesPlayed.length, complete:holesPlayed.length===indices.length };
}

function BetCard({ bet, myPlayer, opponent, pars, onDelete }) {
  const myScores  = getScores(myPlayer,  bet.format, bet.scoring, pars);
  const oppScores = getScores(opponent,  bet.format, bet.scoring, pars);
  const totalHoles = bet.format === "18" ? 18 : 9;
  const myTotal  = myScores?.total  ?? null;
  const oppTotal = oppScores?.total ?? null;
  const complete = myScores?.complete && oppScores?.complete;

  let statusText = "IN PROGRESS", statusColor = "var(--text3)", statusBg = "var(--bg3)", winner = null;
  if (myTotal !== null && oppTotal !== null) {
    if (complete) {
      if      (myTotal < oppTotal) { statusText="YOU WIN"; statusColor="var(--gold)"; statusBg="#1c1400"; winner="me"; }
      else if (oppTotal < myTotal) { statusText=(opponent?.name?.split(" ")[0]?.toUpperCase())+" WINS"; statusColor="var(--red)"; statusBg="#1c0808"; winner="opp"; }
      else                         { statusText="ALL SQUARE"; statusColor="var(--green)"; statusBg="#0a140a"; }
    } else {
      const diff = oppTotal - myTotal;
      if      (diff > 0) { statusText="YOU +"+diff+" UP"; statusColor="var(--green)"; }
      else if (diff < 0) { statusText=Math.abs(diff)+" DOWN"; statusColor="var(--amber)"; }
      else               { statusText="ALL SQUARE"; statusColor="var(--text2)"; }
    }
  }

  return (
    <div className="sb-card sb-fade">
      <div className="sb-header">
        <div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:3,color:"var(--green)",marginBottom:2}}>
            {FORMAT_LABELS[bet.format]} · {bet.scoring==="net"?"NET":"GROSS"}
          </div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:16,color:"var(--gold)"}}>${bet.amount} SIDEBET</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span className="sb-status" style={{color:statusColor,background:statusBg,border:"1px solid "+statusColor+"33"}}>{statusText}</span>
          {!complete && <button onClick={onDelete} style={{background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:16,padding:"2px 6px"}}>x</button>}
        </div>
      </div>
      <div className="sb-body">
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center"}}>
          <div style={{textAlign:"center"}}>
            <div className="sb-label">YOU</div>
            <div className="sb-score" style={{color:winner==="me"?"var(--gold)":winner==="opp"?"var(--red)":"var(--text)"}}>{myTotal !== null ? myTotal : "—"}</div>
            <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,marginTop:2}}>THRU {myScores?.thru||0}</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div className="sb-vs">VS</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:9,letterSpacing:2,color:"var(--text3)",marginTop:2}}>{bet.scoring.toUpperCase()}</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div className="sb-label">{(opponent?.name?.split(" ")[0]?.toUpperCase())||"OPP"}</div>
            <div className="sb-score" style={{color:winner==="opp"?"var(--gold)":winner==="me"?"var(--red)":"var(--text)"}}>{oppTotal !== null ? oppTotal : "—"}</div>
            <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,marginTop:2}}>THRU {oppScores?.thru||0}</div>
          </div>
        </div>
        <div style={{marginTop:14,background:"var(--bg3)",borderRadius:2,height:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:Math.round(((myScores?.thru||0)/totalHoles)*100)+"%",background:"var(--gold)",transition:"width .5s",borderRadius:2}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>HOLE 1</span>
          <span style={{fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>{totalHoles} HOLES</span>
        </div>
        {complete && winner==="me" && (
          <div style={{marginTop:12,padding:"10px 14px",background:"#1c1400",border:"1px solid var(--gold-dim)",borderRadius:4,textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:2,color:"var(--gold)"}}>COLLECT ${bet.amount} FROM {(opponent?.name?.split(" ")[0]?.toUpperCase())||"OPP"}</div>
          </div>
        )}
        {complete && winner==="opp" && (
          <div style={{marginTop:12,padding:"10px 14px",background:"#1c0808",border:"1px solid #5a1a1a",borderRadius:4,textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:2,color:"var(--red)"}}>PAY ${bet.amount} TO {(opponent?.name?.split(" ")[0]?.toUpperCase())||"OPP"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebetsLeaderboard({ players, pars }) {
  const [allBets, setAllBets] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db,"tournaments",TOURNAMENT_ID,"sidebets"),
      snap => setAllBets(snap.docs.map(d=>({id:d.id,...d.data()})))
    );
    return () => unsub();
  }, []);

  if (allBets.length === 0) return (
    <div style={{textAlign:"center",padding:"48px 20px",color:"var(--text3)"}}>
      <div style={{fontSize:36,marginBottom:8}}>🤝</div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2}}>NO ACTIVE SIDEBETS</div>
      <div style={{fontSize:13,marginTop:6}}>Log in to create a sidebet with another player</div>
    </div>
  );

  return (
    <div>
      {allBets.map(bet => {
        const p1 = players.find(p=>p.id===bet.player1);
        const p2 = players.find(p=>p.id===bet.player2);
        const s1 = getScores(p1, bet.format, bet.scoring, pars);
        const s2 = getScores(p2, bet.format, bet.scoring, pars);
        const t1 = s1?.total ?? null;
        const t2 = s2?.total ?? null;
        const complete = s1?.complete && s2?.complete;
        const totalHoles = bet.format === "18" ? 18 : 9;
        let statusText = "IN PROGRESS", statusColor = "var(--text3)", leader = null;
        if (t1 !== null && t2 !== null) {
          if (complete) {
            if      (t1 < t2) { statusText=(p1?.name?.split(" ")[0]?.toUpperCase())+" WINS"; statusColor="var(--gold)"; leader=bet.player1; }
            else if (t2 < t1) { statusText=(p2?.name?.split(" ")[0]?.toUpperCase())+" WINS"; statusColor="var(--gold)"; leader=bet.player2; }
            else              { statusText="ALL SQUARE"; statusColor="var(--green)"; }
          } else {
            const diff = t1 - t2;
            if      (diff < 0) { statusText=(p1?.name?.split(" ")[0]?.toUpperCase())+" +"+Math.abs(diff)+" UP"; statusColor="var(--green)"; leader=bet.player1; }
            else if (diff > 0) { statusText=(p2?.name?.split(" ")[0]?.toUpperCase())+" +"+diff+" UP"; statusColor="var(--green)"; leader=bet.player2; }
            else               { statusText="ALL SQUARE"; statusColor="var(--text2)"; }
          }
        }
        return (
          <div key={bet.id} className="sb-card">
            <div className="sb-header">
              <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:3,color:"var(--green)"}}>
                {FORMAT_LABELS[bet.format]} · {bet.scoring.toUpperCase()} · ${bet.amount}
              </div>
              <span style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:1,color:statusColor}}>{statusText}</span>
            </div>
            <div style={{padding:"12px 16px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",marginBottom:10}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:9,letterSpacing:2,color:"var(--text3)",marginBottom:2}}>{(p1?.name)||"—"}</div>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:26,color:leader===bet.player1?"var(--gold)":"var(--text)"}}>{t1 !== null ? t1 : "—"}</div>
                  <div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>THRU {s1?.thru||0}</div>
                </div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:18,color:"var(--border2)",textAlign:"center"}}>VS</div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:9,letterSpacing:2,color:"var(--text3)",marginBottom:2}}>{(p2?.name)||"—"}</div>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:26,color:leader===bet.player2?"var(--gold)":"var(--text)"}}>{t2 !== null ? t2 : "—"}</div>
                  <div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1}}>THRU {s2?.thru||0}</div>
                </div>
              </div>
              <div style={{background:"var(--bg3)",borderRadius:2,height:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:Math.round(((s1?.thru||0)/totalHoles)*100)+"%",background:"var(--gold)",transition:"width .5s"}}/>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CtpDistanceInput({ player, holeIdx, ctpBet }) {
  const [feet, setFeet]     = useState("");
  const [inches, setInches] = useState("0");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!feet || isNaN(parseInt(feet)) || parseInt(feet) < 0) return;
    setSaving(true);
    const key = "hole_"+holeIdx;
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"ctp_bets",key), {
      ...ctpBet,
      entries: {
        ...ctpBet.entries,
        [player.id]: {
          ...ctpBet.entries[player.id],
          feet: parseInt(feet),
          inches: parseInt(inches)||0,
          totalInches: parseInt(feet)*12+(parseInt(inches)||0),
          playerName: player.name,
          submittedAt: new Date().toISOString(),
        }
      }
    });
    setSaving(false);
  };

  return (
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <input type="number" value={feet} onChange={e=>setFeet(e.target.value)} placeholder="Feet" min="0"
        style={{width:65,padding:"7px 8px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--text)",fontSize:15,textAlign:"center"}}/>
      <span style={{color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>FT</span>
      <input type="number" value={inches} onChange={e=>setInches(e.target.value)} placeholder="In" min="0" max="11"
        style={{width:55,padding:"7px 8px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--text)",fontSize:15,textAlign:"center"}}/>
      <span style={{color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>IN</span>
      <button className="btn-gold" style={{fontSize:12,padding:"7px 16px"}} onClick={submit} disabled={saving||!feet}>
        {saving?"...":"SUBMIT"}
      </button>
    </div>
  );
}

function CtpTab({ myPlayer, players, ctpBets, onCtpOptToggle }) {
  const isOptedIn = myPlayer?.ctpOptIn !== false;
  const sortedBets = Object.entries(ctpBets||{}).sort(([a],[b])=>a.localeCompare(b));

  return (
    <div className="sb-fade">
      {myPlayer && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,padding:"10px 14px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:6}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:2}}>YOUR CTP STATUS</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>Lock in on your scorecard when you reach a par 3</div>
          </div>
          <button onClick={()=>onCtpOptToggle(!isOptedIn)}
            style={{padding:"6px 14px",fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:1,borderRadius:3,cursor:"pointer",
              background:isOptedIn?"var(--gold)":"var(--bg3)",color:isOptedIn?"#060a06":"var(--text3)",
              border:"1px solid "+(isOptedIn?"var(--gold)":"var(--border2)")}}>
            {isOptedIn?"OPTED IN":"OPT IN"}
          </button>
        </div>
      )}

      {sortedBets.length === 0 && (
        <div style={{textAlign:"center",padding:"48px 20px",color:"var(--text3)"}}>
          <div style={{fontSize:36,marginBottom:8}}>📍</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2}}>NO CTP BETS YET</div>
          <div style={{fontSize:13,marginTop:6}}>Players lock in on their scorecard when they reach a par 3</div>
        </div>
      )}

      {sortedBets.map(([key, bet]) => {
        const hIdx = bet.holeIndex;
        const entries = Object.entries(bet.entries||{}).filter(([,e])=>e.feet!==undefined).sort(([,a],[,b])=>a.totalInches-b.totalInches);
        const pending = Object.entries(bet.entries||{}).filter(([,e])=>e.lockedIn && e.feet===undefined);
        const myEntry = bet.entries?.[myPlayer?.id];

        return (
          <div key={key} className="sb-card">
            <div className="sb-header">
              <div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:3,color:"var(--green)",marginBottom:2}}>PAR 3</div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,color:"var(--gold)"}}>HOLE {hIdx+1} — CLOSEST TO PIN</div>
              </div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--text3)"}}>{Object.keys(bet.entries||{}).length} IN</div>
            </div>

            {entries.length===0 && pending.length===0 ? (
              <div style={{padding:"14px 16px",fontSize:12,color:"var(--text3)",fontStyle:"italic"}}>No distances entered yet.</div>
            ) : (
              <div>
                {entries.map(([pid,e],i)=>(
                  <div key={pid} className="sb-row" style={{background:i===0?"#1c1600":"transparent"}}>
                    <span style={{fontFamily:"'Bebas Neue'",fontSize:18,minWidth:32,color:i===0?"var(--gold)":i===1?"#90b0b8":i===2?"#c08050":"var(--text3)"}}>
                      {i===0?"1ST":i===1?"2ND":i===2?"3RD":(i+1)+""}
                    </span>
                    <div style={{flex:1,fontSize:14,fontWeight:i===0?700:400}}>
                      {e.playerName}
                      {pid===myPlayer?.id && <span style={{fontSize:9,color:"var(--green)",marginLeft:6,fontFamily:"'Bebas Neue'",letterSpacing:1}}> YOU</span>}
                    </div>
                    <div style={{fontFamily:"'Bebas Neue'",fontSize:18,color:i===0?"var(--gold)":"var(--text2)"}}>
                      {e.feet}'{e.inches}"
                    </div>
                  </div>
                ))}
                {pending.map(([pid])=>(
                  <div key={pid} className="sb-row" style={{opacity:0.5}}>
                    <span style={{fontSize:10,color:"var(--amber)",fontFamily:"'Bebas Neue'",minWidth:32}}>TBD</span>
                    <div style={{flex:1,fontSize:13,color:"var(--text3)"}}>{players.find(p=>p.id===pid)?.name}</div>
                    <div style={{fontSize:11,color:"var(--amber)"}}>playing</div>
                  </div>
                ))}
              </div>
            )}

            {myEntry?.lockedIn && myEntry.feet===undefined && (
              <div style={{padding:"12px 16px",borderTop:"1px solid var(--border)",background:"#120800"}}>
                <div style={{fontSize:11,color:"var(--amber)",fontFamily:"'Bebas Neue'",letterSpacing:1,marginBottom:8}}>YOU ARE LOCKED IN — ENTER YOUR DISTANCE</div>
                <CtpDistanceInput player={myPlayer} holeIdx={hIdx} ctpBet={bet}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Sidebets({ myPlayer, players, pars, ctpBets, onCtpOptToggle }) {
  const [tab, setTab]           = useState("ctp");
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
        setBets(all.filter(b=>b.player1===myPlayer.id||b.player2===myPlayer.id));
      }
    );
    return () => unsub();
  }, [myPlayer?.id]);

  const createBet = async () => {
    if (!form.opponentId || !form.amount || isNaN(parseFloat(form.amount))) return;
    setSaving(true);
    const id = "bet_"+myPlayer.id+"_"+form.opponentId+"_"+Date.now();
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"sidebets",id), {
      player1: myPlayer.id, player2: form.opponentId,
      format: form.format, scoring: form.scoring, amount: parseFloat(form.amount),
      createdAt: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    });
    setCreating(false);
    setForm({ opponentId:"", format:"18", scoring:"net", amount:"" });
    setSaving(false);
  };

  const deleteBet = async (betId) => {
    await deleteDoc(doc(db,"tournaments",TOURNAMENT_ID,"sidebets",betId));
  };

  const eligible = players.filter(p=>p.id!==myPlayer?.id);

  return (
    <div>
      <style>{CSS}</style>

      <div style={{display:"flex",marginBottom:16,borderRadius:6,overflow:"hidden",border:"1px solid var(--border)"}}>
        <button className={"sb-tab"+(tab==="ctp"?" active":"")} onClick={()=>setTab("ctp")}>CTP</button>
        <button className={"sb-tab"+(tab==="live"?" active":"")} onClick={()=>setTab("live")}>LIVE BETS</button>
        <button className={"sb-tab"+(tab==="mine"?" active":"")} onClick={()=>setTab("mine")}>MY BETS</button>
      </div>

      {tab==="ctp" && (
        <CtpTab myPlayer={myPlayer} players={players} ctpBets={ctpBets} onCtpOptToggle={onCtpOptToggle}/>
      )}

      {tab==="live" && (
        <div className="sb-fade">
          <SidebetsLeaderboard players={players} pars={pars}/>
        </div>
      )}

      {tab==="mine" && (
        <div className="sb-fade">
          {!myPlayer ? (
            <div style={{textAlign:"center",padding:"48px 20px",color:"var(--text3)"}}>
              <div style={{fontSize:36,marginBottom:10}}>🔒</div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2,marginBottom:6,color:"var(--text)"}}>LOG IN TO VIEW YOUR BETS</div>
              <div style={{fontSize:13,lineHeight:1.6}}>Go to <strong style={{color:"var(--gold)"}}>MY SCORES</strong> and select your name to access sidebets</div>
            </div>
          ) : (<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2}}>YOUR SIDEBETS</div>
            {!creating && <button className="btn-gold" style={{fontSize:12}} onClick={()=>setCreating(true)}>+ NEW BET</button>}
          </div>

          {creating && (
            <div className="sb-card sb-fade" style={{border:"1px solid var(--gold-dim)"}}>
              <div className="sb-header">
                <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:2,color:"var(--gold)"}}>NEW SIDEBET</div>
                <button onClick={()=>setCreating(false)} style={{background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:18}}>x</button>
              </div>
              <div className="sb-body">
                <div className="sb-form-row">
                  <label>OPPONENT</label>
                  <select value={form.opponentId} onChange={e=>setForm(f=>({...f,opponentId:e.target.value}))}>
                    <option value="">Select a player...</option>
                    {eligible.map(p=><option key={p.id} value={p.id}>{p.name} (HCP {p.handicap})</option>)}
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
                  <input type="number" min="1" placeholder="e.g. 20" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
                </div>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <button className="btn-gold" style={{fontSize:12}} onClick={createBet} disabled={saving||!form.opponentId||!form.amount}>
                    {saving?"CREATING...":"CREATE BET"}
                  </button>
                  <button className="btn-ghost" style={{fontSize:12}} onClick={()=>setCreating(false)}>CANCEL</button>
                </div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:10,fontStyle:"italic",lineHeight:1.5}}>
                  Only you and your opponent can see this bet. Scores update live as you both play.
                </div>
              </div>
            </div>
          )}

          {bets.length===0 && !creating && (
            <div style={{textAlign:"center",padding:"40px 0",color:"var(--text3)",fontSize:13,fontStyle:"italic"}}>
              No active sidebets. Hit + NEW BET to challenge someone.
            </div>
          )}

          {bets.map(bet => {
            const opponentId = bet.player1===myPlayer.id ? bet.player2 : bet.player1;
            const opponent   = players.find(p=>p.id===opponentId);
            return <BetCard key={bet.id} bet={bet} myPlayer={myPlayer} opponent={opponent} pars={pars} onDelete={()=>deleteBet(bet.id)}/>;
          })}
          </>)}
        </div>
      )}
    </div>
  );
}

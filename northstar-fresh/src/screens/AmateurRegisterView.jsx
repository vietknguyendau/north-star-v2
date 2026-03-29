import React from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { TOURNAMENT_ID } from "../constants";
import { hashPin } from "../lib/scoring";
import { usePlayers } from "../contexts/PlayersContext";
import { useAuth } from "../contexts/AuthContext";

export default function AmateurRegisterView({ notify, setScreen }) {
  const { players } = usePlayers();
  const { setActivePlayer } = useAuth();
  const [amateurForm, setAmateurForm] = React.useState({ name:"", email:"", handicap:"", pin:"", pin2:"" });
  const [amateurError, setAmateurError] = React.useState("");
  const [amateurSuccess, setAmateurSuccess] = React.useState(false);

  const handleAmateurRegister = async () => {
    if (!amateurForm.name.trim()) { setAmateurError("Please enter your name."); return; }
    if (players.find(p=>p.name.toLowerCase()===amateurForm.name.trim().toLowerCase())) { setAmateurError("Name already registered."); return; }
    if (!amateurForm.pin || amateurForm.pin.length !== 4) { setAmateurError("Please set a 4-digit PIN."); return; }
    if (amateurForm.pin !== amateurForm.pin2) { setAmateurError("PINs do not match."); return; }
    setAmateurError("");
    const id = Date.now().toString();
    const pinHash = await hashPin(amateurForm.pin);
    const np = { id, name:amateurForm.name.trim(), email:amateurForm.email.trim().toLowerCase(), handicap:parseInt(amateurForm.handicap)||0, flight:"Amateur", scores:Array(18).fill(null), pinHash, memberType:"amateur" };
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"players",id), np);
    setActivePlayer(np);
    setAmateurSuccess(true);
    setAmateurForm({ name:"", email:"", handicap:"", pin:"", pin2:"" });
    notify(`Welcome, ${np.name}! You're registered as an amateur. 🏌️`);
  };

  return (
    <div className="fade-up" style={{maxWidth:460,margin:"0 auto"}}>
      {!amateurSuccess ? (
        <>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"var(--gold)",marginBottom:8}}>JOIN AS AN AMATEUR</div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2}}>AMATEUR REGISTRATION</h2>
            <p style={{fontSize:14,color:"var(--text2)",marginTop:8,lineHeight:1.7}}>
              Not competing in the full season? Register as an amateur to be listed in the league directory and join one-off events.
            </p>
          </div>
          <div className="card" style={{padding:28}}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="section-label">FULL NAME</div>
                <input defaultValue={amateurForm.name} onBlur={e=>setAmateurForm(f=>({...f,name:e.target.value}))} placeholder="First Last" style={{width:"100%"}}/>
              </div>
              <div>
                <div className="section-label">EMAIL ADDRESS</div>
                <input type="email" defaultValue={amateurForm.email} onBlur={e=>setAmateurForm(f=>({...f,email:e.target.value}))} placeholder="you@email.com" style={{width:"100%"}}/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>For event invitations and announcements.</div>
              </div>
              <div>
                <div className="section-label">HANDICAP INDEX</div>
                <input type="number" defaultValue={amateurForm.handicap} onBlur={e=>setAmateurForm(f=>({...f,handicap:e.target.value}))} placeholder="0" min="0" max="54" style={{width:"100%"}}/>
                <div style={{fontSize:11,color:"var(--amber)",marginTop:5,lineHeight:1.4}}>⚠ Commissioner verifies before Event 1. Have your Grint screenshot ready.</div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{flex:1}}>
                  <div className="section-label">YOUR PIN</div>
                  <input type="password" maxLength={4} defaultValue={amateurForm.pin} onBlur={e=>setAmateurForm(f=>({...f,pin:e.target.value.replace(/\D/g,"")}))} placeholder="4 digits" style={{width:"100%",letterSpacing:6,textAlign:"center",fontSize:18}}/>
                </div>
                <div style={{flex:1}}>
                  <div className="section-label">CONFIRM PIN</div>
                  <input type="password" maxLength={4} defaultValue={amateurForm.pin2} onBlur={e=>setAmateurForm(f=>({...f,pin2:e.target.value.replace(/\D/g,"")}))} placeholder="4 digits" style={{width:"100%",letterSpacing:6,textAlign:"center",fontSize:18}}/>
                </div>
              </div>
              <div style={{fontSize:12,color:"var(--text3)",fontStyle:"italic"}}>🔒 Your PIN protects your profile. Set it now so you can log in later.</div>
              <div style={{padding:"10px 14px",background:"#1a1200",border:"1px solid #c8a84a33",borderRadius:4,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:2,color:"var(--gold)",border:"1px solid var(--gold-dim)",borderRadius:3,padding:"2px 8px"}}>AMATEUR</span>
                <span style={{fontSize:12,color:"var(--text3)"}}>You'll appear in the Amateurs section of the league directory.</span>
              </div>
              {amateurError && <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"10px 14px",borderRadius:4}}>{amateurError}</div>}
              <button className="btn-gold" style={{width:"100%",padding:13,fontSize:15,marginTop:4}} onClick={handleAmateurRegister}>REGISTER AS AMATEUR →</button>
            </div>
          </div>
          <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"var(--text3)"}}>
            Competing in the full season? <span style={{color:"var(--gold)",cursor:"pointer"}} onClick={()=>setScreen("register")}>League registration →</span>
          </div>
        </>
      ) : (
        <div style={{textAlign:"center",paddingTop:40}}>
          <div style={{fontSize:52,marginBottom:16}}>🏌️</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:36,letterSpacing:2,color:"var(--gold)",marginBottom:10}}>YOU'RE IN!</div>
          <div style={{display:"inline-block",fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--gold)",border:"1px solid var(--gold-dim)",borderRadius:3,padding:"3px 12px",marginBottom:16}}>AMATEUR</div>
          <p style={{fontSize:16,color:"var(--text2)",marginBottom:28,lineHeight:1.8}}>Welcome.<br/>You're registered as an amateur member.</p>
          <button className="btn-ghost" style={{padding:"12px 32px",fontSize:14}} onClick={()=>setScreen("leaderboard")}>VIEW LEADERBOARD →</button>
        </div>
      )}
    </div>
  );
}

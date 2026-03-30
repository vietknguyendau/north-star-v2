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
    <div className="fade-up max-w-lg mx-auto">
      {!amateurSuccess ? (
        <>
          <div className="text-center mb-7">
            <div className="font-display text-[13px] tracking-[4px] text-gold mb-2">JOIN AS AN AMATEUR</div>
            <h2 className="font-display text-4xl tracking-[2px]">AMATEUR REGISTRATION</h2>
            <p className="text-[14px] text-t2 mt-2 leading-relaxed">
              Not competing in the full season? Register as an amateur to be listed in the league directory and join one-off events.
            </p>
          </div>

          <div className="card p-7">
            <div className="flex flex-col gap-4">
              <div>
                <div className="section-label">FULL NAME</div>
                <input defaultValue={amateurForm.name} onBlur={e=>setAmateurForm(f=>({...f,name:e.target.value}))} placeholder="First Last" className="w-full"/>
              </div>

              <div>
                <div className="section-label">EMAIL ADDRESS</div>
                <input type="email" defaultValue={amateurForm.email} onBlur={e=>setAmateurForm(f=>({...f,email:e.target.value}))} placeholder="you@email.com" className="w-full"/>
                <div className="text-[11px] text-t3 mt-1">For event invitations and announcements.</div>
              </div>

              <div>
                <div className="section-label">HANDICAP INDEX</div>
                <input type="number" defaultValue={amateurForm.handicap} onBlur={e=>setAmateurForm(f=>({...f,handicap:e.target.value}))} placeholder="0" min="0" max="54" className="w-full"/>
                <div className="text-[11px] text-amber mt-1 leading-snug">⚠ Commissioner verifies before Event 1. Have your Grint screenshot ready.</div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="section-label">YOUR PIN</div>
                  <input type="password" maxLength={4} defaultValue={amateurForm.pin}
                    onBlur={e=>setAmateurForm(f=>({...f,pin:e.target.value.replace(/\D/g,"")}))}
                    placeholder="4 digits" className="w-full text-center" style={{letterSpacing:6,fontSize:18}}/>
                </div>
                <div className="flex-1">
                  <div className="section-label">CONFIRM PIN</div>
                  <input type="password" maxLength={4} defaultValue={amateurForm.pin2}
                    onBlur={e=>setAmateurForm(f=>({...f,pin2:e.target.value.replace(/\D/g,"")}))}
                    placeholder="4 digits" className="w-full text-center" style={{letterSpacing:6,fontSize:18}}/>
                </div>
              </div>
              <div className="text-[12px] text-t3 italic">🔒 Your PIN protects your profile. Set it now so you can log in later.</div>

              <div className="p-3 rounded-[4px] flex items-center gap-2.5" style={{background:"#1a1200",border:"1px solid #c8a84a33"}}>
                <span className="font-display text-[10px] tracking-[2px] text-gold border border-[--gold-dim] rounded-[3px] px-2 py-px shrink-0" style={{borderColor:"var(--gold-dim)"}}>AMATEUR</span>
                <span className="text-[12px] text-t3">You'll appear in the Amateurs section of the league directory.</span>
              </div>

              {amateurError && (
                <div className="text-[13px] text-red bg-[#2a0808] border border-[#4a1010] px-3.5 py-2.5 rounded-[4px]">{amateurError}</div>
              )}
              <button className="btn-gold w-full py-3.5 text-[15px] mt-1" onClick={handleAmateurRegister}>REGISTER AS AMATEUR →</button>
            </div>
          </div>

          <div className="text-center mt-4 text-[13px] text-t3">
            Competing in the full season?{" "}
            <span className="text-gold cursor-pointer" onClick={()=>setScreen("register")}>League registration →</span>
          </div>
        </>
      ) : (
        <div className="text-center pt-10">
          <div className="text-[52px] mb-4">🏌️</div>
          <div className="font-display text-4xl tracking-[2px] text-gold mb-2.5">YOU'RE IN!</div>
          <div className="inline-block font-display text-[11px] tracking-[3px] text-gold border border-[--gold-dim] rounded-[3px] px-3 py-[3px] mb-4" style={{borderColor:"var(--gold-dim)"}}>AMATEUR</div>
          <p className="text-[16px] text-t2 mb-7 leading-relaxed">Welcome.<br/>You're registered as an amateur member.</p>
          <button className="btn-ghost px-8 py-3 text-[14px]" onClick={()=>setScreen("leaderboard")}>VIEW LEADERBOARD →</button>
        </div>
      )}
    </div>
  );
}

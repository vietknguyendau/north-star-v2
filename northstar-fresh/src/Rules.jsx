import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

const TOURNAMENT_ID = "tournament-2024";

const DEFAULT_RULES = {
  leagueFormat: `The North Star Amateur Series is a six-event net stroke play league held on Saturdays throughout the 2026 Minnesota golf season. The league is open to 32 registered members who have paid the $300 season dues prior to the Opening Classic.

Net scoring ensures fair competition across all skill levels. Your net score is calculated by subtracting your course handicap from your gross score. The player with the lowest net score wins the event.

All play is conducted under USGA Rules of Golf. Preferred lies may be granted by the commissioner based on course conditions.

SEASON STRUCTURE: Six counting events (Events 1–6) determine season standings. Events 7 and 8 are non-points events — the Ryder Cup Finale and Season-Ending Scramble & Banquet respectively.

BEST 4 OF 6: Your best 4 finishes out of 6 events count toward your final season points total. Your two worst events are dropped automatically.`,

  pointsSystem: `Season standings are determined by a points-based system. Points are awarded based on finishing position in each counting event.

POINTS TABLE:
1st – 100 pts
2nd – 85 pts
3rd – 75 pts
4th – 65 pts
5th – 55 pts
6th – 50 pts
7th – 45 pts
8th – 40 pts
9th – 36 pts
10th – 32 pts
11th+ – 5 pts (participation)

BEST 4 OF 6: Only your top 4 point totals count. Your two lowest-scoring events are dropped at season end.

MULTIPLIER EVENTS:
Event 4 (North Star Mid-Season Major) — 2× points multiplier
Event 6 (North Star Championship) — 3× points multiplier

These two events carry the most weight in the standings. A win at Event 6 is worth 300 points — three times a standard event. Consistent play all season is rewarded, but showing up for the majors is essential.

SEASON POINTS CHAMPION: The player with the most cumulative points after dropping their two lowest events is crowned Season Points Champion and receives a $750 cash bonus, awarded at the banquet.`,

  payoutStructure: `The $300 season dues from 32 players generate a $9,600 total fund, distributed as follows:

FULL FUND ALLOCATION:
• Events 1, 2, 3, 5 payouts — $2,000 ($500 each)
• Event 4 Mid-Season Major payout — $750
• Event 6 Championship payout — $2,000
• Season Points Champion bonus — $750
• Ryder Cup prize fund — $500
• Merchandise (welcome pack) — $1,500
• Championship Trophy — $200
• Ryder Cup Trophy — $200
• Banquet & Misc — $700
• TOTAL — $9,600

STANDARD EVENT PAYOUTS (Events 1, 2, 3, 5) — $500 purse:
1st — $250
2nd — $125
3rd — $75
4th — $50

EVENT 4 — MID-SEASON MAJOR — $750 purse:
1st — $375
2nd — $188
3rd — $112
4th — $75

EVENT 6 — NORTH STAR CHAMPIONSHIP — $2,000 purse:
1st — $800
2nd — $500
3rd — $360
4th — $220
5th — $120

SEASON POINTS CHAMPION — $750
Separate from Event 6. Awarded to the player with the highest cumulative season points total. Announced and paid out at the Season-Ending Banquet.

RYDER CUP — $500
Split evenly across all members of the winning Ryder Cup team (~$31 per player).

All payouts are made in cash. Event payouts are distributed same-day. Season champion and Ryder Cup payouts are distributed at the banquet.`,

  handicapRules: `The North Star Amateur Series uses the World Handicap System (WHS) to calculate and maintain all player handicap indexes.

ESTABLISHING A HANDICAP: Players self-report their current GHIN handicap index at registration. This serves as your starting index and will display as "SELF-RPT" in the app until league rounds are posted.

LEAGUE ROUNDS: After 3 rounds posted within the league, your index transitions to a league-calculated index based on your posted differentials. This displays as "LEAGUE" in the app.

DIFFERENTIAL FORMULA:
Differential = (Gross Score − Course Rating) × 113 ÷ Slope Rating

INDEX CALCULATION:
Best 8 of your last 20 differentials, averaged and multiplied by 0.96.

MAXIMUM INDEX: 28.0. Any player with a self-reported index above 28 will be capped at 28 for all league play.

COURSE HANDICAP: Handicap Index × (Slope ÷ 113). This is how many strokes you receive per round.

INTEGRITY: Sandbagging — intentionally posting inflated scores to gain a handicap advantage — is taken seriously and may result in disqualification from payout eligibility at the commissioner's discretion. The commissioner reserves the right to adjust any player's index if evidence of manipulation is found.`,

  conductRules: `The North Star Amateur Series is built on competition, camaraderie, and respect. All members are expected to uphold the following standards.

PACE OF PLAY: Ready golf is expected at all times. Groups should complete 18 holes within 4.5 hours. Slow play affecting other groups may result in score adjustments or disqualification at the commissioner's discretion.

SPORTSMANSHIP: Treat fellow competitors, course staff, and the golf course with respect at all times. Unsportsmanlike behavior including club throwing, verbal abuse, or intentional course damage may result in disqualification without refund.

SCORING INTEGRITY: All scores must be entered by the player themselves using their personal PIN. Falsifying scores, entering scores on behalf of another player, or tampering with another player's scorecard is strictly prohibited and grounds for immediate disqualification.

PHONES & DEVICES: Phones may be used for GPS yardage and score entry only during rounds. Calls should be kept brief and never taken on the tee box.

DISPUTES: Any scoring disputes must be raised with the commissioner before leaving the course. Post-round disputes will not be accepted or reviewed.

DUES & FEES: Season dues of $300 must be paid in full prior to playing Event 1. Players with outstanding balances will be withheld from payout eligibility until dues are settled.

ALCOHOL POLICY: Drinking is permitted in accordance with course rules. Players deemed unfit to play safely by the commissioner may be asked to withdraw from the round.`,

  ryderCupFormat: `The North Star Ryder Cup Finale is held September 26, 2026 and is open exclusively to the top 12 players in season standings following the conclusion of Event 6.

QUALIFICATION: Top 12 players by cumulative season points after best-4-of-6 drops are applied. In the event of a tie, the player with more events played advances. Commissioner has final say on tiebreakers.

TEAM SELECTION: The commissioner assigns players to two teams based on standings and competitive balance. Team captains are the #1 and #2 ranked players respectively.

FORMAT: 36 holes of match play in a single day.
• Morning session: Team matches (foursomes or four-ball) — format announced the week prior
• Afternoon session: Singles matches — every player competes head-to-head

SCORING: 1 point per match won. 0.5 points per halved match. The team with the most points wins the Ryder Cup trophy.

HANDICAPS: Adjusted handicaps are used for competitive balance in match play. The commissioner will announce all adjustments prior to the event.

PRIZE FUND: $500 split evenly among members of the winning team (~$31/player), paid out at the banquet.

TROPHY: The Ryder Cup trophy is held by the winning team until the following year's finale. Team members' names are engraved on the trophy annually.

This event does not count toward season standings points but carries its own trophy, prize fund, and permanent bragging rights.`,

  scheduleOverview: `2026 NORTH STAR AMATEUR SERIES — FULL SCHEDULE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVENT 1 — OPENING CLASSIC
May 30, 2026
Net Stroke Play · $500 Purse
Rum River Hills Golf Course, Anoka MN
Payout: 1st $250 · 2nd $125 · 3rd $75 · 4th $50

EVENT 2 — EARLY SUMMER MEDAL
June 20, 2026
Net Stroke Play · $500 Purse
Links at Northfork, Ramsey MN
Payout: 1st $250 · 2nd $125 · 3rd $75 · 4th $50

EVENT 3 — MID-SUMMER MEDAL
July 11, 2026
Net Stroke Play · $500 Purse
Oak Marsh / Eagle Valley
Payout: 1st $250 · 2nd $125 · 3rd $75 · 4th $50

EVENT 4 — NORTH STAR MID-SEASON MAJOR ⭐ [2× POINTS]
August 1, 2026
Net Stroke Play · $750 Purse · 2× Points Multiplier
Keller / Edinburgh
Payout: 1st $375 · 2nd $188 · 3rd $112 · 4th $75

EVENT 5 — LATE-SEASON PUSH
August 22, 2026
Net Stroke Play · $500 Purse
Cedar Creek / Fox Hollow
Payout: 1st $250 · 2nd $125 · 3rd $75 · 4th $50

EVENT 6 — NORTH STAR CHAMPIONSHIP ⭐⭐ [3× POINTS]
September 12, 2026
Net Stroke Play · $2,000 Purse · 3× Points Multiplier
Mystic Lake / Keller
Payout: 1st $800 · 2nd $500 · 3rd $360 · 4th $220 · 5th $120

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NON-POINTS EVENTS

EVENT 7 — RYDER CUP FINALE 🏆
September 26, 2026
Top 12 Players · 36 Holes Match Play · $500 Team Prize Fund
Championship Venue TBD

EVENT 8 — SEASON-ENDING SCRAMBLE & BANQUET 🎉
October 3, 2026
All Members Welcome · No Points · Awards & Dinner
Season Points Champion ($750) announced and paid out
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
};

const SECTIONS = [
  { key:"leagueFormat",    icon:"⛳", title:"League Format & Scoring" },
  { key:"pointsSystem",    icon:"⭐", title:"Points System & Multipliers" },
  { key:"payoutStructure", icon:"💰", title:"Payout Structure & Fund Allocation" },
  { key:"handicapRules",   icon:"📊", title:"Handicap Rules" },
  { key:"conductRules",    icon:"🤝", title:"Code of Conduct" },
  { key:"ryderCupFormat",  icon:"🏆", title:"Ryder Cup Format" },
  { key:"scheduleOverview",icon:"📅", title:"2026 Schedule & Purses" },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
.rules-wrap { font-family:'Cormorant Garamond',Georgia,serif; max-width:860px; margin:0 auto; }
.rules-fade { animation:rFade .4s ease; }
@keyframes rFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.rules-label { font-family:'Bebas Neue'; letter-spacing:3px; font-size:11px; color:var(--green); margin-bottom:10px; }
.rules-section { border:1px solid var(--border); border-radius:6px; overflow:hidden; margin-bottom:14px; }
.rules-section-header { padding:16px 22px; background:var(--bg2); display:flex; align-items:center; justify-content:space-between; cursor:pointer; transition:background .15s; user-select:none; }
.rules-section-header:hover { background:var(--bg3); }
.rules-section-header.open { border-bottom:1px solid var(--border); }
.rules-body { padding:22px 26px; background:var(--bg2); white-space:pre-wrap; font-size:15px; line-height:1.9; color:var(--text2); }
.rules-body textarea { width:100%; background:var(--bg3); border:1px solid var(--border2); color:var(--text); padding:14px; font-family:'Cormorant Garamond',Georgia,serif; font-size:15px; line-height:1.85; resize:vertical; border-radius:3px; outline:none; box-sizing:border-box; }
.rules-body textarea:focus { border-color:var(--gold); }
.rules-edit-bar { display:flex; gap:8px; padding:12px 0 0; }
.rules-hero { text-align:center; padding:32px 20px 28px; margin-bottom:28px; border-bottom:1px solid var(--border); }
.toc-item { padding:10px 18px; font-size:14px; color:var(--text2); cursor:pointer; border-left:3px solid transparent; transition:all .15s; display:flex; align-items:center; gap:10px; }
.toc-item:hover { color:var(--gold); border-left-color:var(--gold); background:var(--bg3); }
.last-updated { font-family:'DM Mono'; font-size:11px; color:var(--text3); margin-top:10px; }
.fund-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0; }
.fund-card { background:var(--bg3); border:1px solid var(--border); border-radius:5px; padding:14px 16px; }
.fund-amount { font-family:'Bebas Neue'; font-size:26px; color:var(--gold); }
.fund-label { font-size:11px; color:var(--text3); letter-spacing:1px; font-family:'Bebas Neue'; margin-top:2px; }
`;

// Visual payout summary component
function PayoutSummary() {
  return (
    <div style={{marginTop:8}}>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:3,color:"var(--green)",marginBottom:12}}>── FUND ALLOCATION OVERVIEW</div>
      <div className="fund-grid">
        {[
          ["$2,000","EVENTS 1,2,3,5 PAYOUTS","$500 × 4 events"],
          ["$750","EVENT 4 MAJOR PAYOUT","2× points event"],
          ["$2,000","EVENT 6 CHAMPIONSHIP","3× points · top 5 pay"],
          ["$750","SEASON POINTS CHAMPION","paid at banquet"],
          ["$500","RYDER CUP PRIZE FUND","~$31/player winning team"],
          ["$1,500","MERCHANDISE","quarter-zip welcome pack"],
          ["$400","TROPHIES","championship + ryder cup"],
          ["$700","BANQUET & MISC","event 8 awards night"],
        ].map(([amt,lbl,sub])=>(
          <div key={lbl} className="fund-card">
            <div className="fund-amount">{amt}</div>
            <div className="fund-label">{lbl}</div>
            <div style={{fontSize:12,color:"var(--text3)",marginTop:3,fontStyle:"italic"}}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{background:"var(--bg3)",border:"1px solid var(--gold-dim)",borderRadius:5,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,color:"var(--text3)"}}>TOTAL FUND · 32 PLAYERS × $300</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:"var(--gold)"}}>$9,600</div>
      </div>
    </div>
  );
}

export default function RulesPage({ adminUnlocked }) {
  const [rules, setRules]        = useState(null);
  const [openSection, setOpen]   = useState("leagueFormat");
  const [editingKey, setEditing] = useState(null);
  const [draftText, setDraft]    = useState("");
  const [saving, setSaving]      = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db,"tournaments",TOURNAMENT_ID,"settings","rules"), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setRules(data.sections || DEFAULT_RULES);
        setLastUpdated(data.updatedAt || null);
      } else {
        setRules(DEFAULT_RULES);
      }
    });
    return () => unsub();
  }, []);

  const startEdit = (key) => {
    setEditing(key);
    setDraft(rules[key] || DEFAULT_RULES[key] || "");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const saveSection = async (key) => {
    setSaving(true);
    const updated = { ...rules, [key]: draftText };
    const now = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
    await setDoc(doc(db,"tournaments",TOURNAMENT_ID,"settings","rules"), {
      sections: updated,
      updatedAt: now,
    });
    setRules(updated);
    setLastUpdated(now);
    setEditing(null);
    setSaving(false);
  };

  const cancelEdit = () => { setEditing(null); setDraft(""); };

  if (!rules) return (
    <div style={{textAlign:"center",padding:60,color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:3}}>LOADING…</div>
  );

  return (
    <div className="rules-wrap rules-fade">
      <style>{CSS}</style>

      {/* Hero */}
      <div className="rules-hero">
        <img src="/logo.png" alt="North Star Golf" style={{width:150,height:150,objectFit:"contain",marginBottom:16}}/>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:5,color:"var(--green)",marginBottom:8}}>OFFICIAL LEAGUE DOCUMENT · 2026</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:38,letterSpacing:3,color:"var(--text)",marginBottom:6}}>NORTH STAR AMATEUR SERIES</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:3,color:"var(--gold)",marginBottom:14}}>RULES, FORMAT & REGULATIONS</div>
        <div style={{fontSize:14,color:"var(--text3)",fontStyle:"italic",maxWidth:500,margin:"0 auto",lineHeight:1.8}}>
          32 players · $300 season dues · 6 counting events · $9,600 total fund
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:24,marginTop:16,flexWrap:"wrap"}}>
          {[["$6,750","IN PAYOUTS"],["$1,500","MERCHANDISE"],["2","TROPHIES"],["32","PLAYERS"]].map(([val,lbl])=>(
            <div key={lbl} style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:24,color:"var(--gold)"}}>{val}</div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:9,letterSpacing:2,color:"var(--text3)"}}>{lbl}</div>
            </div>
          ))}
        </div>
        {lastUpdated && <div className="last-updated">Last updated: {lastUpdated}</div>}
      </div>

      {/* TOC */}
      <div className="rules-label">── TABLE OF CONTENTS</div>
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden",marginBottom:28}}>
        {SECTIONS.map((s,i)=>(
          <div key={s.key} className="toc-item"
            style={{borderBottom:i<SECTIONS.length-1?"1px solid var(--border)":"none"}}
            onClick={()=>{ setOpen(s.key); setTimeout(()=>document.getElementById("section-"+s.key)?.scrollIntoView({behavior:"smooth",block:"start"}),80); }}>
            <span style={{fontSize:18,width:28}}>{s.icon}</span>
            <span style={{fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:1,color:"var(--text3)",width:20}}>{i+1}.</span>
            <span style={{fontSize:15}}>{s.title}</span>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="rules-label">── FULL RULES & REGULATIONS</div>
      {SECTIONS.map((s,i)=>{
        const isOpen    = openSection === s.key;
        const isEditing = editingKey  === s.key;
        const text      = rules[s.key] || DEFAULT_RULES[s.key];
        return (
          <div key={s.key} id={"section-"+s.key} className="rules-section">
            <div className={`rules-section-header ${isOpen?"open":""}`} onClick={()=>setOpen(isOpen?null:s.key)}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <span style={{fontSize:22}}>{s.icon}</span>
                <div>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:10,letterSpacing:3,color:"var(--green)"}}>SECTION {i+1}</div>
                  <div style={{fontFamily:"'Bebas Neue'",fontSize:17,letterSpacing:2,color:isOpen?"var(--gold)":"var(--text)"}}>{s.title}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {adminUnlocked && isOpen && !isEditing && (
                  <button onClick={e=>{ e.stopPropagation(); startEdit(s.key); }}
                    className="btn-ghost" style={{fontSize:11,padding:"4px 12px"}}>✏️ EDIT</button>
                )}
                <span style={{fontFamily:"'Bebas Neue'",fontSize:20,color:"var(--text3)",display:"inline-block",transition:"transform .2s",transform:isOpen?"rotate(180deg)":"none"}}>▾</span>
              </div>
            </div>

            {isOpen && (
              <div className="rules-body">
                {/* Special visual summary for payout section */}
                {s.key === "payoutStructure" && !isEditing && <PayoutSummary />}

                {isEditing ? (
                  <>
                    <textarea ref={textareaRef} value={draftText} onChange={e=>setDraft(e.target.value)}
                      rows={Math.max(10, draftText.split("\n").length + 3)}/>
                    <div className="rules-edit-bar">
                      <button className="btn-gold" style={{fontSize:12}} onClick={()=>saveSection(s.key)} disabled={saving}>
                        {saving?"SAVING…":"SAVE CHANGES"}
                      </button>
                      <button className="btn-ghost" style={{fontSize:12}} onClick={cancelEdit}>CANCEL</button>
                      <span style={{fontSize:11,color:"var(--text3)",fontStyle:"italic",marginLeft:6,alignSelf:"center"}}>Line breaks are preserved.</span>
                    </div>
                  </>
                ) : (
                  <div style={{marginTop: s.key==="payoutStructure"?16:0}}>{text}</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{textAlign:"center",padding:"32px 0 20px",borderTop:"1px solid var(--border)",marginTop:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:3,color:"var(--text3)"}}>
          NORTH STAR AMATEUR SERIES · MINNEAPOLIS, MN · 2026
        </div>
        <div style={{fontSize:13,color:"var(--text3)",marginTop:6,fontStyle:"italic"}}>
          Rules subject to commissioner discretion. Good golf, good company.
        </div>
      </div>
    </div>
  );
}

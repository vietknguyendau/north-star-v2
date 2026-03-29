import React from "react";
import { useCourse } from "../contexts/CourseContext";
import { DEFAULT_PAR, DEFAULT_YARDS, HCP_STROKES } from "../constants";

export default function CourseView({ saveCourse, notify }) {
  const { course, setCourse } = useCourse();
  const [showScModal, setShowScModal] = React.useState(false);
  const fileRef = React.useRef();

  const pars     = (Array.isArray(course?.par)   && course.par.length===18)   ? course.par   : DEFAULT_PAR;
  const yards    = (Array.isArray(course?.yards)  && course.yards.length===18) ? course.yards : DEFAULT_YARDS;
  const totalPar = pars.reduce((a,b)=>a+b,0);

  const handleFileUpload = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const url   = ev.target.result;
      const isPdf = file.type.includes("pdf");
      const updated = { ...course, scorecardImage:isPdf?null:url, scorecardPdf:isPdf?url:null, scorecardName:file.name };
      setCourse(updated);
      await saveCourse(updated);
      notify("Scorecard uploaded!");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fade-up" style={{maxWidth:820}}>
      {/* Scorecard modal */}
      {showScModal && (course?.scorecardImage||course?.scorecardPdf) && (
        <div className="modal-bg" onClick={()=>setShowScModal(false)}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:8,padding:20,maxWidth:"92vw",maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontFamily:"'Bebas Neue'",letterSpacing:2,fontSize:16}}>{course?.name} — Official Scorecard</span>
              <button className="btn-ghost btn-sm" onClick={()=>setShowScModal(false)}>✕ Close</button>
            </div>
            {course.scorecardImage && <img src={course.scorecardImage} alt="Scorecard" style={{maxWidth:"80vw",maxHeight:"76vh",objectFit:"contain",display:"block"}}/>}
            {course.scorecardPdf   && <iframe src={course.scorecardPdf} title="PDF" style={{width:"78vw",height:"76vh",border:"none"}}/>}
          </div>
        </div>
      )}

      <div className="section-label">── COURSE INFORMATION</div>
      <div className="card" style={{padding:24,marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:20}}>
          <div>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:2}}>{course?.name}</h2>
            <div style={{fontSize:14,color:"var(--text3)"}}>{course?.city}</div>
          </div>
          <div style={{display:"flex",gap:28}}>
            {[["PAR",totalPar,"var(--green)"],["SLOPE",course?.slope,"var(--text)"],["RATING",course?.rating,"var(--gold)"]].map(([l,v,c])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:c}}>{v}</div>
                <div style={{fontSize:10,letterSpacing:2,color:"var(--text3)",fontFamily:"'Bebas Neue'"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{fontSize:15,color:"var(--text2)",lineHeight:1.8,fontStyle:"italic",borderLeft:"2px solid var(--gold-dim)",paddingLeft:16}}>{course?.description}</p>
      </div>

      <div className="section-label">── HOLE-BY-HOLE</div>
      <div className="card" style={{overflow:"hidden",marginBottom:24}}>
        {[{start:0,label:"FRONT NINE"},{start:9,label:"BACK NINE"}].map(({start,label})=>(
          <div key={label} style={{overflowX:"auto",padding:"16px 16px 12px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontFamily:"'Bebas Neue'",letterSpacing:2,fontSize:11,color:"var(--green-dim)",marginBottom:8}}>{label}</div>
            <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
              <thead>
                <tr style={{color:"var(--text3)",fontFamily:"'Bebas Neue'",letterSpacing:1,fontSize:10}}>
                  <td style={{padding:"4px 8px",minWidth:60}}>HOLE</td>
                  {Array.from({length:9},(_,i)=><td key={i} style={{textAlign:"center",padding:"4px 5px",minWidth:36}}>{start+i+1}</td>)}
                  <td style={{textAlign:"center",padding:"4px 8px",background:"var(--bg3)",minWidth:40}}>TOT</td>
                </tr>
              </thead>
              <tbody>
                <tr style={{color:"var(--text3)",fontSize:12}}>
                  <td style={{padding:"4px 8px"}}>Yards</td>
                  {yards.slice(start,start+9).map((y,i)=><td key={i} style={{textAlign:"center",padding:"4px 5px"}}>{y}</td>)}
                  <td style={{textAlign:"center",background:"var(--bg3)",fontWeight:600}}>{yards.slice(start,start+9).reduce((a,b)=>a+b,0)}</td>
                </tr>
                <tr style={{color:"var(--text3)",fontSize:11}}>
                  <td style={{padding:"4px 8px"}}>HCP</td>
                  {HCP_STROKES.slice(start,start+9).map((h,i)=><td key={i} style={{textAlign:"center",padding:"4px 5px"}}>{h}</td>)}
                  <td style={{background:"var(--bg3)"}}/>
                </tr>
                <tr style={{color:"var(--green)"}}>
                  <td style={{padding:"5px 8px",fontWeight:600,fontSize:13}}>Par</td>
                  {pars.slice(start,start+9).map((p,i)=><td key={i} style={{textAlign:"center",padding:"5px 5px",fontWeight:600,fontSize:14}}>{p}</td>)}
                  <td style={{textAlign:"center",fontWeight:700,background:"var(--bg3)",fontSize:14}}>{pars.slice(start,start+9).reduce((a,b)=>a+b,0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="section-label">── OFFICIAL SCORECARD</div>
      <div className="card" style={{padding:20}}>
        {course?.scorecardImage || course?.scorecardPdf ? (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:14,color:"var(--text2)"}}>📄 {course.scorecardName||"Scorecard"}</span>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-ghost btn-sm" onClick={()=>setShowScModal(true)}>View Full</button>
                <button className="btn-danger btn-sm" onClick={async()=>{ const u={...course,scorecardImage:null,scorecardPdf:null}; setCourse(u); await saveCourse(u); }}>Remove</button>
              </div>
            </div>
            {course.scorecardImage && <img src={course.scorecardImage} alt="Scorecard" style={{width:"100%",maxHeight:280,objectFit:"contain",borderRadius:4,border:"1px solid var(--border)",cursor:"pointer"}} onClick={()=>setShowScModal(true)}/>}
            {course.scorecardPdf && <div style={{textAlign:"center",padding:24,background:"var(--bg3)",borderRadius:4}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:13,color:"var(--text2)",marginBottom:10}}>PDF: {course.scorecardName}</div><button className="btn-ghost btn-sm" onClick={()=>setShowScModal(true)}>Open PDF</button></div>}
          </div>
        ) : (
          <>
            <div className="upload-zone" onClick={()=>fileRef.current.click()}>
              <div style={{fontSize:36,marginBottom:12}}>⛳</div>
              <div style={{fontSize:16,color:"var(--text2)",marginBottom:6}}>Upload Course Scorecard</div>
              <div style={{fontSize:12,color:"var(--text3)"}}>JPG · PNG · PDF · Click to browse</div>
            </div>
            <button className="btn-ghost btn-sm" style={{marginTop:12}} onClick={()=>fileRef.current.click()}>+ Upload File</button>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handleFileUpload}/>
      </div>
    </div>
  );
}

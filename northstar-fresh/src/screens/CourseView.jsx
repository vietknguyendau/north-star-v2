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
    <div className="fade-up max-w-3xl">
      {/* Scorecard modal */}
      {showScModal && (course?.scorecardImage||course?.scorecardPdf) && (
        <div className="modal-bg" onClick={()=>setShowScModal(false)}>
          <div
            className="bg-bg2 border border-border2 rounded-lg p-5 overflow-auto"
            style={{ maxWidth:"92vw", maxHeight:"90vh" }}
            onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="font-display tracking-[2px] text-[16px]">{course?.name} — Official Scorecard</span>
              <button className="btn-ghost btn-sm" onClick={()=>setShowScModal(false)}>✕ Close</button>
            </div>
            {course.scorecardImage && <img src={course.scorecardImage} alt="Scorecard" style={{maxWidth:"80vw",maxHeight:"76vh",objectFit:"contain",display:"block"}}/>}
            {course.scorecardPdf   && <iframe src={course.scorecardPdf} title="PDF" style={{width:"78vw",height:"76vh",border:"none"}}/>}
          </div>
        </div>
      )}

      <div className="section-label">── COURSE INFORMATION</div>
      <div className="card p-6 mb-6">
        <div className="flex justify-between flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-display text-4xl tracking-[2px]">{course?.name}</h2>
            <div className="text-[14px] text-t3">{course?.city}</div>
          </div>
          <div className="flex gap-7">
            {[["PAR",totalPar,"var(--green)"],["SLOPE",course?.slope,"var(--text)"],["RATING",course?.rating,"var(--gold)"]].map(([l,v,c])=>(
              <div key={l} className="text-center">
                <div className="font-display text-[28px]" style={{color:c}}>{v}</div>
                <div className="font-display text-[10px] tracking-[2px] text-t3">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[15px] text-t2 leading-relaxed italic pl-4" style={{borderLeft:"2px solid var(--gold-dim)"}}>{course?.description}</p>
      </div>

      <div className="section-label">── HOLE-BY-HOLE</div>
      <div className="card overflow-hidden mb-6">
        {[{start:0,label:"FRONT NINE"},{start:9,label:"BACK NINE"}].map(({start,label})=>(
          <div key={label} className="overflow-x-auto px-4 pt-4 pb-3 border-b border-border last:border-b-0" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="font-display tracking-[2px] text-[11px] text-green-dim mb-2">{label}</div>
            <table style={{ borderCollapse:"collapse", fontSize:12, minWidth:"max-content", width:"100%" }}>
              <thead>
                <tr className="font-display text-[10px] tracking-[1px] text-t3">
                  <td className="py-1 px-2 min-w-[60px]">HOLE</td>
                  {Array.from({length:9},(_,i)=><td key={i} className="text-center py-1 px-1 min-w-[36px]">{start+i+1}</td>)}
                  <td className="text-center py-1 px-2 bg-bg3 min-w-[40px]">TOT</td>
                </tr>
              </thead>
              <tbody>
                <tr className="text-t3 text-[12px]">
                  <td className="py-1 px-2">Yards</td>
                  {yards.slice(start,start+9).map((y,i)=><td key={i} className="text-center py-1 px-1">{y}</td>)}
                  <td className="text-center bg-bg3 font-semibold">{yards.slice(start,start+9).reduce((a,b)=>a+b,0)}</td>
                </tr>
                <tr className="text-t3 text-[11px]">
                  <td className="py-1 px-2">HCP</td>
                  {HCP_STROKES.slice(start,start+9).map((h,i)=><td key={i} className="text-center py-1 px-1">{h}</td>)}
                  <td className="bg-bg3"/>
                </tr>
                <tr className="text-green">
                  <td className="py-1.5 px-2 font-semibold text-[13px]">Par</td>
                  {pars.slice(start,start+9).map((p,i)=><td key={i} className="text-center py-1.5 px-1 font-semibold text-[14px]">{p}</td>)}
                  <td className="text-center font-bold bg-bg3 text-[14px]">{pars.slice(start,start+9).reduce((a,b)=>a+b,0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="section-label">── OFFICIAL SCORECARD</div>
      <div className="card p-5">
        {course?.scorecardImage || course?.scorecardPdf ? (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[14px] text-t2">📄 {course.scorecardName||"Scorecard"}</span>
              <div className="flex gap-2">
                <button className="btn-ghost btn-sm" onClick={()=>setShowScModal(true)}>View Full</button>
                <button className="btn-danger btn-sm" onClick={async()=>{ const u={...course,scorecardImage:null,scorecardPdf:null}; setCourse(u); await saveCourse(u); }}>Remove</button>
              </div>
            </div>
            {course.scorecardImage && (
              <img src={course.scorecardImage} alt="Scorecard"
                className="w-full rounded-[4px] border border-border cursor-pointer"
                style={{ maxHeight:280, objectFit:"contain" }}
                onClick={()=>setShowScModal(true)}/>
            )}
            {course.scorecardPdf && (
              <div className="text-center p-6 bg-bg3 rounded-[4px]">
                <div className="text-[32px] mb-2">📋</div>
                <div className="text-[13px] text-t2 mb-2.5">PDF: {course.scorecardName}</div>
                <button className="btn-ghost btn-sm" onClick={()=>setShowScModal(true)}>Open PDF</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="upload-zone" onClick={()=>fileRef.current.click()}>
              <div className="text-4xl mb-3">⛳</div>
              <div className="text-[16px] text-t2 mb-1.5">Upload Course Scorecard</div>
              <div className="text-[12px] text-t3">JPG · PNG · PDF · Click to browse</div>
            </div>
            <button className="btn-ghost btn-sm mt-3" onClick={()=>fileRef.current.click()}>+ Upload File</button>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload}/>
      </div>
    </div>
  );
}

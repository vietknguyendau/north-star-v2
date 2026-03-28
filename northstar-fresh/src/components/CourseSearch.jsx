import React, { useState, useEffect } from "react";
import { searchCourses } from "../mnCourses";

export default function CourseSearch({ onSelect }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);

  useEffect(() => {
    if (query.length >= 2) { setResults(searchCourses(query)); setOpen(true); }
    else { setResults([]); setOpen(false); }
  }, [query]);

  const pick = (course) => {
    onSelect(course);
    setQuery(course.name + " — " + course.city);
    setOpen(false);
  };

  return (
    <div style={{position:"relative"}}>
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Type course name or city…"
        style={{width:"100%",padding:"8px 12px",fontSize:14,background:"var(--bg2)",border:"1px solid var(--border2)",color:"var(--text)",borderRadius:3,outline:"none",fontFamily:"inherit"}}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:"var(--bg2)",border:"1px solid var(--gold)",borderRadius:"0 0 6px 6px",maxHeight:280,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.8)"}}>
          {results.map((c, i) => (
            <div key={i} onClick={() => pick(c)}
              style={{padding:"11px 16px",cursor:"pointer",borderBottom:"1px solid var(--border)"}}
              onMouseEnter={e => e.currentTarget.style.background="var(--bg3)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{c.name}</div>
              <div style={{fontSize:12,color:"var(--text3)",display:"flex",gap:16,marginTop:2}}>
                <span>📍 {c.city}, MN</span>
                <span>Par {c.par}</span>
                <span>Rating {c.rating}</span>
                <span>Slope {c.slope}</span>
              </div>
            </div>
          ))}
          <div style={{padding:"8px 16px",fontSize:11,color:"var(--text3)",fontStyle:"italic"}}>Not listed? Fill in fields below manually.</div>
        </div>
      )}
    </div>
  );
}

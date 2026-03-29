import React from "react";

/**
 * PinKeypad — shared 4-digit PIN entry component
 * Props:
 *   pin          {string}   current PIN value
 *   onChange     {fn}       setter (receives updater fn or new value)
 *   error        {string}   error message to display (optional)
 *   onSubmit     {fn}       called when submit action taken (optional)
 *   disabled     {bool}     disable submit button
 *   submitLabel  {string}   text on the submit button (default "ENTER →")
 */
export default function PinKeypad({ pin, onChange, error, onSubmit, disabled, submitLabel = "ENTER →" }) {
  return (
    <div>
      {/* 4-dot display */}
      <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:16}}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{width:48,height:56,border:`2px solid ${pin.length>i?"var(--gold)":"var(--border2)"}`,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,background:"var(--bg3)",color:"var(--gold)",transition:"all .15s"}}>
            {pin.length>i ? "●" : ""}
          </div>
        ))}
      </div>
      {/* Number grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
          <button key={i}
            onClick={() => {
              if (k === "⌫") onChange(p => p.slice(0, -1));
              else if (k === "" || pin.length >= 4) return;
              else onChange(p => p + k);
            }}
            style={{padding:"15px 8px",fontFamily:"'DM Mono'",fontSize:20,background:k==="⌫"?"var(--bg3)":"var(--bg4)",border:"1px solid var(--border2)",borderRadius:6,color:k==="⌫"?"var(--red)":"var(--text)",cursor:k===""?"default":"pointer",opacity:k===""?0:1}}>
            {k}
          </button>
        ))}
      </div>
      {error && (
        <div style={{fontSize:13,color:"var(--red)",background:"#2a0808",border:"1px solid #4a1010",padding:"8px 12px",borderRadius:4,marginBottom:12}}>
          {error}
        </div>
      )}
      {onSubmit && (
        <button className="btn-gold" style={{width:"100%",fontSize:14,padding:13}}
          onClick={onSubmit} disabled={disabled || pin.length !== 4}>
          {submitLabel}
        </button>
      )}
    </div>
  );
}

import React from "react";

export default function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = "CONFIRM", danger = true }) {
  return (
    <div className="modal-bg" onClick={onCancel} style={{zIndex:1000}}>
      <div style={{background:"var(--bg2)",border:`1px solid ${danger?"#4a1010":"var(--border2)"}`,borderRadius:8,padding:"28px 24px",maxWidth:360,width:"90%",margin:"0 auto"}}
        onClick={e=>e.stopPropagation()}>
        <p style={{fontSize:14,color:"var(--text2)",lineHeight:1.7,marginBottom:24}}>{message}</p>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button className="btn-ghost" style={{fontSize:13,padding:"9px 20px"}} onClick={onCancel}>CANCEL</button>
          <button className={danger?"btn-danger":"btn-gold"} style={{fontSize:13,padding:"9px 20px"}} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

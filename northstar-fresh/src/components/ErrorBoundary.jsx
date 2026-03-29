import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{minHeight:"100vh",background:"#080c08",color:"#e4dcc8",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"Georgia,serif"}}>
        <div style={{maxWidth:480,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>⛳</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,color:"#c8a830",marginBottom:12}}>SOMETHING WENT WRONG</div>
          <p style={{fontSize:14,color:"#a09880",lineHeight:1.8,marginBottom:24}}>The app hit an error loading. Try refreshing the page. If it keeps happening, the commissioner is on it.</p>
          <button onClick={()=>window.location.reload()} style={{background:"#c8a830",color:"#060a06",border:"none",padding:"12px 32px",fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:2,cursor:"pointer",borderRadius:3}}>
            RELOAD PAGE
          </button>
          <div style={{marginTop:16,fontSize:11,color:"#607060",fontFamily:"monospace"}}>{this.state.error?.message}</div>
        </div>
      </div>
    );
    return this.props.children;
  }
}

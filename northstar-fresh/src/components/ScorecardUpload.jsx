import React from "react";
import { db, storage } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { TOURNAMENT_ID } from "../constants";

export default function ScorecardUpload({ player, upload, notify }) {
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState("");
  const allFilled = player.scores.filter(Boolean).length >= 9;

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadErr("Please upload an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadErr("Image too large. Max 10MB."); return; }
    setUploading(true); setUploadErr("");
    try {
      const storageRef = ref(storage, `scorecards/${player.id}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, "tournaments", TOURNAMENT_ID, "scorecard_uploads", player.id), {
        url, playerId: player.id, playerName: player.name,
        uploadedAt: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}),
        verified: false,
      });
      notify("Scorecard uploaded! Awaiting commissioner verification.");
    } catch(err) { setUploadErr("Upload failed. Try again."); console.error(err); }
    setUploading(false);
  };

  return (
    <div className="card" style={{padding:20,marginTop:16,border:upload?.verified?"1px solid var(--green)":upload?.url?"1px solid var(--gold-dim)":"1px solid var(--border2)"}}>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:3,marginBottom:10,
        color:upload?.verified?"var(--green)":upload?.url?"var(--gold)":"var(--text3)"}}>
        {upload?.verified ? "✅ SCORECARD VERIFIED" : upload?.url ? "⏳ AWAITING VERIFICATION" : "📸 SUBMIT SCORECARD"}
      </div>
      {!upload?.url ? (
        <>
          <div style={{fontSize:13,color:"var(--text3)",marginBottom:12,lineHeight:1.6}}>
            Take a photo of your physical scorecard and upload it to finalize your round.
            {!allFilled && <span style={{color:"var(--amber)"}}> Complete at least 9 holes first.</span>}
          </div>
          <label style={{display:"inline-block",cursor:allFilled?"pointer":"not-allowed",opacity:allFilled?1:0.4}}>
            <div className="btn-gold" style={{fontSize:12,display:"inline-block",pointerEvents:allFilled?"auto":"none"}}>
              {uploading ? "UPLOADING…" : "📷 UPLOAD SCORECARD PHOTO"}
            </div>
            <input type="file" accept="image/*" capture="environment"
              style={{display:"none"}} disabled={!allFilled||uploading}
              onChange={handleUpload}/>
          </label>
          {uploadErr && <div style={{color:"var(--red)",fontSize:12,marginTop:8}}>{uploadErr}</div>}
        </>
      ) : upload?.verified ? (
        <div style={{fontSize:13,color:"var(--green)",lineHeight:1.6}}>
          Your scorecard has been verified by the commissioner. Your round is official. ✓
        </div>
      ) : (
        <div>
          <div style={{fontSize:13,color:"var(--text2)",marginBottom:10}}>
            Scorecard uploaded on {upload.uploadedAt}. The commissioner will verify it shortly.
          </div>
          <img src={upload.url} alt="Uploaded scorecard" style={{width:"100%",maxWidth:320,borderRadius:4,border:"1px solid var(--border)"}}/>
          <div style={{marginTop:10}}>
            <label style={{cursor:"pointer"}}>
              <span style={{fontSize:11,color:"var(--text3)",textDecoration:"underline"}}>Upload a different photo</span>
              <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleUpload}/>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

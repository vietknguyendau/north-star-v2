import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { TOURNAMENT_ID } from "../constants";

const PlayersContext = createContext(null);

export function PlayersProvider({ children }) {
  const [players, setPlayers]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [syncStatus, setSyncStatus]         = useState("synced");
  const [scorecardUploads, setScorecardUploads] = useState({});

  useEffect(() => {
    const unsubPlayers = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "players"),
      snap => {
        setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => { console.error(err); setSyncStatus("error"); setLoading(false); }
    );

    const unsubUploads = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "scorecard_uploads"),
      snap => {
        const d = {};
        snap.docs.forEach(doc => { d[doc.id] = doc.data(); });
        setScorecardUploads(d);
      }
    );

    return () => { unsubPlayers(); unsubUploads(); };
  }, []);

  return (
    <PlayersContext.Provider value={{ players, loading, syncStatus, setSyncStatus, scorecardUploads }}>
      {children}
    </PlayersContext.Provider>
  );
}

export const usePlayers = () => useContext(PlayersContext);

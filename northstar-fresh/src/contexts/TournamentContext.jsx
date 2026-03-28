import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { TOURNAMENT_ID } from "../constants";

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
  const [activeOneOff, setActiveOneOff]   = useState(null);
  const [activeOnOffs, setActiveOnOffs]   = useState([]);
  const [ctpBets, setCtpBets]             = useState({});
  const [foursomes, setFoursomes]         = useState([]);
  const [groupBets, setGroupBets]         = useState([]);

  useEffect(() => {
    const unsubOneOff = onSnapshot(
      doc(db, "tournaments", TOURNAMENT_ID, "settings", "active_oneoff"),
      snap => setActiveOneOff(snap.exists() ? snap.data() : null)
    );

    const unsubActive = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "active_tournaments"),
      snap => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data(), isActive: true }));
        arr.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
        setActiveOnOffs(arr);
      }
    );

    const unsubCtp = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "ctp_bets"),
      snap => {
        const d = {};
        snap.docs.forEach(doc => { d[doc.id] = doc.data(); });
        setCtpBets(d);
      }
    );

    const unsubFoursomes = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "foursomes"),
      snap => setFoursomes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubBets = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "group_bets"),
      snap => setGroupBets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubOneOff(); unsubActive(); unsubCtp(); unsubFoursomes(); unsubBets(); };
  }, []);

  return (
    <TournamentContext.Provider value={{ activeOneOff, activeOnOffs, ctpBets, foursomes, groupBets }}>
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);

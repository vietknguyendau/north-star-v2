import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../firebase";
import { doc, collection, onSnapshot, deleteDoc } from "firebase/firestore";
import { TOURNAMENT_ID } from "../constants";

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
  const [activeOneOff, setActiveOneOff]         = useState(null);
  const [activeOnOffs, setActiveOnOffs]         = useState([]);
  const [oneOffTournaments, setOneOffTournaments] = useState([]);
  const [ctpBets, setCtpBets]                   = useState({});
  const [foursomes, setFoursomes]               = useState([]);
  const [groupBets, setGroupBets]               = useState([]);

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

    const unsubSaved = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "one_off_tournaments"),
      snap => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setOneOffTournaments(arr);
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

    return () => { unsubOneOff(); unsubActive(); unsubSaved(); unsubCtp(); unsubFoursomes(); unsubBets(); };
  }, []);

  const deleteFoursome = useCallback(async (id) => {
    await deleteDoc(doc(db, "tournaments", TOURNAMENT_ID, "foursomes", id));
  }, []);

  const value = useMemo(
    () => ({ activeOneOff, activeOnOffs, oneOffTournaments, ctpBets, foursomes, groupBets, deleteFoursome }),
    [activeOneOff, activeOnOffs, oneOffTournaments, ctpBets, foursomes, groupBets, deleteFoursome]
  );

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);

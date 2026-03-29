import React, { createContext, useContext, useState, useMemo } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [activePlayer, setActivePlayer] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const value = useMemo(
    () => ({ activePlayer, setActivePlayer, adminUnlocked, setAdminUnlocked }),
    [activePlayer, adminUnlocked]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

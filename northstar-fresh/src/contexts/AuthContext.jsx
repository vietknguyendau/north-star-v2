import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [activePlayer, setActivePlayer] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  return (
    <AuthContext.Provider value={{ activePlayer, setActivePlayer, adminUnlocked, setAdminUnlocked }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

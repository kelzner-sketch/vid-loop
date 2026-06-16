import React, { createContext, useContext } from 'react';
import { useAuth } from '@/lib/AuthContext';

const ProContext = createContext({ isPro: false, loading: false, refresh: () => {} });

export function ProProvider({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const isPro = !!user;

  return (
    <ProContext.Provider value={{ isPro, loading: isLoadingAuth, refresh: () => {} }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}
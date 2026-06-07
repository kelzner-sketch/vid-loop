import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const ProContext = createContext({ isPro: false, loading: true, refresh: () => {} });

export function ProProvider({ children }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await base44.functions.invoke('getProStatus', {});
      setIsPro(!!res.data?.is_pro);
    } catch {
      setIsPro(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Check if returning from successful checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('pro') === 'success') {
      // Poll a couple times to catch webhook delay
      setTimeout(refresh, 2000);
      setTimeout(refresh, 5000);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <ProContext.Provider value={{ isPro, loading, refresh }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}
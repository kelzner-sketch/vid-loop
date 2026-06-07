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

    // Check if returning from successful checkout (same-tab flow via location.href)
    const params = new URLSearchParams(window.location.search);
    if (params.get('pro') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      // Poll aggressively — webhook may take a few seconds to arrive
      [2000, 4000, 7000, 12000, 20000].forEach(ms => setTimeout(refresh, ms));
    }

    // Re-check when user returns to this tab after completing checkout in new tab
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
/**
 * TabNavigator — manages independent navigation stacks per tab.
 * Tabs are rendered simultaneously but only the active one is visible,
 * preserving scroll position and component state across tab switches.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const TabContext = createContext(null);

export function useTabNav() {
  return useContext(TabContext);
}

export const ROOT_TABS = ['/', '/gallery', '/settings'];

export function TabNavigatorProvider({ children }) {
  // Each tab has its own stack of { path, props } entries
  const [stacks, setStacks] = useState({
    '/': [{ path: '/' }],
    '/gallery': [{ path: '/gallery' }],
    '/settings': [{ path: '/settings' }],
  });
  const [activeTab, setActiveTab] = useState('/');

  const currentPath = stacks[activeTab]?.[stacks[activeTab].length - 1]?.path ?? activeTab;

  const switchTab = useCallback((tab) => {
    if (tab === activeTab) {
      // Re-tapping active tab resets its stack to root
      setStacks(prev => ({ ...prev, [tab]: [{ path: tab }] }));
    } else {
      setActiveTab(tab);
    }
  }, [activeTab]);

  const push = useCallback((path) => {
    setStacks(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], { path }],
    }));
  }, [activeTab]);

  const pop = useCallback(() => {
    setStacks(prev => {
      const stack = prev[activeTab];
      if (stack.length <= 1) return prev;
      return { ...prev, [activeTab]: stack.slice(0, -1) };
    });
  }, [activeTab]);

  const canGoBack = (stacks[activeTab]?.length ?? 1) > 1;

  return (
    <TabContext.Provider value={{ activeTab, currentPath, stacks, switchTab, push, pop, canGoBack }}>
      {children}
    </TabContext.Provider>
  );
}
/**
 * TabNavigator — manages independent navigation stacks per tab.
 * Tabs are rendered simultaneously but only the active one is visible,
 * preserving scroll position and component state across tab switches.
 * Syncs with browser history and provides slide animations.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TabContext = createContext(null);

export function useTabNav() {
  return useContext(TabContext);
}

export const ROOT_TABS = ['/', '/gallery', '/settings'];
export const PAGE_TITLES = {
  '/': 'Vid-Loop',
  '/gallery': 'Saved Clips',
  '/settings': 'Settings',
};

export function TabNavigatorProvider({ children }) {
  const navigate = useNavigate();
  
  // Each tab has its own stack of { path, props } entries
  const [stacks, setStacks] = useState({
    '/': [{ path: '/' }],
    '/gallery': [{ path: '/gallery' }],
    '/settings': [{ path: '/settings' }],
  });
  const [activeTab, setActiveTab] = useState('/');
  const [slideDirection, setSlideDirection] = useState(0); // -1=left, 0=none, 1=right

  const currentPath = stacks[activeTab]?.[stacks[activeTab].length - 1]?.path ?? activeTab;

  const switchTab = useCallback((tab) => {
    if (tab === activeTab) {
      // Re-tapping active tab resets its stack to root
      setStacks(prev => ({ ...prev, [tab]: [{ path: tab }] }));
      navigate(tab);
    } else {
      setActiveTab(tab);
      navigate(tab);
    }
  }, [activeTab, navigate]);

  const push = useCallback((path) => {
    setSlideDirection(1);
    setStacks(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], { path }],
    }));
    navigate(path);
  }, [activeTab, navigate]);

  const pop = useCallback(() => {
    setStacks(prev => {
      const stack = prev[activeTab];
      if (stack.length <= 1) return prev;
      setSlideDirection(-1);
      const newStack = stack.slice(0, -1);
      navigate(newStack[newStack.length - 1].path);
      return { ...prev, [activeTab]: newStack };
    });
  }, [activeTab, navigate]);

  const canGoBack = (stacks[activeTab]?.length ?? 1) > 1;
  const currentTitle = PAGE_TITLES[currentPath] || 'VidLoop';

  // Reset slide direction after animation completes
  useEffect(() => {
    if (slideDirection !== 0) {
      const timer = setTimeout(() => setSlideDirection(0), 300);
      return () => clearTimeout(timer);
    }
  }, [slideDirection]);

  return (
    <TabContext.Provider value={{ 
      activeTab, 
      currentPath, 
      currentTitle,
      stacks, 
      switchTab, 
      push, 
      pop, 
      canGoBack,
      slideDirection 
    }}>
      {children}
    </TabContext.Provider>
  );
}
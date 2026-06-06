import React, { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import BottomTabBar from './components/BottomTabBar';
import { TabNavigatorProvider, useTabNav } from './components/TabNavigator';
// Add page imports here

const TAB_PAGES = {
  '/': Home,
  '/gallery': Gallery,
  '/settings': Settings,
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const { activeTab, switchTab } = useTabNav();
  const location = useLocation();

  // Sync route path to active tab
  useEffect(() => {
    const path = location.pathname;
    if (path === '/gallery' && activeTab !== '/gallery') switchTab('/gallery');
    else if (path === '/settings' && activeTab !== '/settings') switchTab('/settings');
    else if ((path === '/' || path === '') && activeTab !== '/') switchTab('/');
  }, [location.pathname, activeTab, switchTab]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') return <Routes><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  }

  return (
    <>
      <Routes>
        {/* Auth routes - accessible without authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected app routes */}
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/" element={
            <div className="fixed inset-0">
              {Object.entries(TAB_PAGES).map(([tab, PageComponent]) => (
                <div
                  key={tab}
                  className="absolute inset-0"
                  style={{ display: activeTab === tab ? 'block' : 'none' }}
                >
                  <PageComponent />
                </div>
              ))}
              <BottomTabBar />
            </div>
          } />
          <Route path="/gallery" element={
            <div className="fixed inset-0">
              {Object.entries(TAB_PAGES).map(([tab, PageComponent]) => (
                <div
                  key={tab}
                  className="absolute inset-0"
                  style={{ display: activeTab === tab ? 'block' : 'none' }}
                >
                  <PageComponent />
                </div>
              ))}
              <BottomTabBar />
            </div>
          } />
          <Route path="/settings" element={
            <div className="fixed inset-0">
              {Object.entries(TAB_PAGES).map(([tab, PageComponent]) => (
                <div
                  key={tab}
                  className="absolute inset-0"
                  style={{ display: activeTab === tab ? 'block' : 'none' }}
                >
                  <PageComponent />
                </div>
              ))}
              <BottomTabBar />
            </div>
          } />
        </Route>
      </Routes>
    </>
  );
};


function App() {
  React.useEffect(() => {
    const apply = (dark) => {
      document.documentElement.classList.toggle('dark', dark);
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);
    mq.addEventListener('change', (e) => apply(e.matches));
    return () => mq.removeEventListener('change', (e) => apply(e.matches));
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <TabNavigatorProvider>
            <AuthenticatedApp />
          </TabNavigatorProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
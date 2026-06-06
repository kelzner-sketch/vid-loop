import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Film, Settings } from 'lucide-react';

const tabs = [
  { path: '/', icon: Camera, label: 'Camera' },
  { path: '/gallery', icon: Film, label: 'Gallery' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleTabPress = (path) => {
    if (pathname === path) {
      // Already on this tab — scroll to top / reset view
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(path);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-black/80 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            onClick={() => handleTabPress(path)}
            className="flex flex-col items-center gap-1 py-2 px-6 select-none"
            style={{ WebkitTapHighlightColor: 'transparent', background: 'none', border: 'none' }}
          >
            <Icon className={`w-5 h-5 transition-colors ${active ? 'text-primary' : 'text-white/40'}`} />
            <span className={`text-[10px] font-mono transition-colors ${active ? 'text-primary' : 'text-white/40'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
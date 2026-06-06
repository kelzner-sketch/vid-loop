import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Camera, Film, Settings } from 'lucide-react';

const tabs = [
  { path: '/', icon: Camera, label: 'Camera' },
  { path: '/gallery', icon: Film, label: 'Gallery' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-black/80 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = pathname === path;
        return (
          <Link
            key={path}
            to={path}
            className="flex flex-col items-center gap-1 py-2 px-6 select-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Icon
              className={`w-5 h-5 transition-colors ${active ? 'text-primary' : 'text-white/40'}`}
            />
            <span className={`text-[10px] font-mono transition-colors ${active ? 'text-primary' : 'text-white/40'}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
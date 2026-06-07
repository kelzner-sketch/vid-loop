import React from 'react';
import { Camera, Film, Settings } from 'lucide-react';
import { useTabNav } from '@/components/TabNavigator';
import { useRecording } from '@/lib/RecordingContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const tabs = [
  { path: '/', icon: Camera, label: 'Camera' },
  { path: '/gallery', icon: Film, label: 'Gallery' },
  { path: '/settings', icon: Settings, label: 'About' },
];

export default function BottomTabBar() {
  const { activeTab, switchTab } = useTabNav();
  const { isRecording } = useRecording();
  const navigate = useNavigate();
  const [isLandscape, setIsLandscape] = React.useState(() => window.innerWidth > window.innerHeight);

  React.useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-black/80 backdrop-blur-xl border-t border-white/10 pointer-events-auto"
      initial={{ y: 0 }}
      animate={{ y: (isRecording || isLandscape) ? '100%' : 0 }}
      transition={{ duration: 0.3 }}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = activeTab === path;
        return (
          <button
            key={path}
            onClick={() => { switchTab(path); navigate(path); }}
            className="flex flex-col items-center gap-1 py-2 px-6 select-none pointer-events-auto"
            style={{ WebkitTapHighlightColor: 'transparent', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Icon className={`w-5 h-5 transition-colors ${active ? 'text-primary' : 'text-white/40'}`} />
            <span className={`text-[10px] font-mono transition-colors ${active ? 'text-primary' : 'text-white/40'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}
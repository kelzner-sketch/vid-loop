import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTabNav } from '@/components/TabNavigator';
import { motion } from 'framer-motion';

export default function MobileHeader({ title, right }) {
  const { canGoBack, pop, currentTitle } = useTabNav();
  const displayTitle = title || currentTitle;

  return (
    <div
      className="flex items-center justify-between px-4 pb-3 border-b border-border backdrop-blur-xl bg-[hsl(var(--background))]"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      
      {/* Left: back button or spacer */}
      <div className="w-10">
        {canGoBack &&
        <button
          onClick={pop}
          className="flex items-center gap-0.5 text-primary active:opacity-60 transition-opacity">
          
            <ChevronLeft className="w-5 h-5" />
          </button>
        }
      </div>

      {/* Center: title */}
      <motion.h1 
        key={displayTitle}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-base font-semibold font-heading text-foreground tracking-tight">
        {displayTitle}
      </motion.h1>

      {/* Right slot */}
      <div className="w-10 flex justify-end">
        {right ?? null}
      </div>
    </div>);

}
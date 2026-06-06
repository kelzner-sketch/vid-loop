import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTabNav } from '@/components/TabNavigator';

export default function MobileHeader({ title, right }) {
  const { canGoBack, pop } = useTabNav();

  return (
    <div
      className="flex items-center justify-between px-4 pb-3 border-b border-border bg-background/80 backdrop-blur-xl"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      {/* Left: back button or spacer */}
      <div className="w-10">
        {canGoBack && (
          <button
            onClick={pop}
            className="flex items-center gap-0.5 text-primary active:opacity-60 transition-opacity"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Center: title */}
      <h1 className="text-base font-semibold font-heading text-foreground tracking-tight">{title}</h1>

      {/* Right slot */}
      <div className="w-10 flex justify-end">
        {right ?? null}
      </div>
    </div>
  );
}
import React from 'react';

export default function StatusBadge({ active, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-accent animate-pulse' : 'bg-muted-foreground/40'}`} />
      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}
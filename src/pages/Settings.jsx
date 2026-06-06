import React from 'react';
import { Film, Camera, Layers, Repeat2, Info } from 'lucide-react';

const tips = [
  { icon: Camera, title: 'Scrub', desc: 'Drag the timeline to replay the last ~10 seconds of footage.' },
  { icon: Layers, title: 'Ghost Blend', desc: 'Overlays multiple past frames to visualize motion trails.' },
  { icon: Repeat2, title: 'Loop', desc: 'Ping-pongs through a window of buffered frames automatically.' },
  { icon: Film, title: 'Record', desc: 'Tap REC to capture the canvas output as a video clip.' },
];

export default function Settings() {
  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pb-4 border-b border-border" style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}>
        <Info className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold font-heading">About</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom) + 56px)' }}>
        <div className="rounded-2xl bg-card border border-border px-5 py-4 space-y-1">
          <h2 className="text-2xl font-light font-heading lowercase tracking-tight text-foreground">VidLoop</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Live camera with ring-buffer scrubbing, ghost layering, and ping-pong looping. No account needed — everything runs in your browser.
          </p>
        </div>

        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1">How it works</p>

        {tips.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border">
            <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
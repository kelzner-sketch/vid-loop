import React, { useState, useEffect, useRef } from 'react';
import { Film, Camera, Layers, Repeat2, Trash2 } from 'lucide-react';
import MobileHeader from '@/components/MobileHeader';
import UserProfile from '@/components/UserProfile';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import ControlSlider from '@/components/video/ControlSlider';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const tips = [
  { icon: Camera, title: 'Scrub', desc: 'Drag the timeline to replay the last ~10 seconds of footage.' },
  { icon: Layers, title: 'Ghost Blend', desc: 'Overlays multiple past frames to visualize motion trails.' },
  { icon: Repeat2, title: 'Loop', desc: 'Ping-pongs through a window of buffered frames automatically.' },
  { icon: Film, title: 'Record', desc: 'Tap REC to capture the canvas output as a video clip.' },
];

export default function Settings() {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  
  // Load persisted control prefs
  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem('vidloop_prefs') || '{}'); } catch { return {}; }
  };
  const prefs = loadPrefs();

  const [ghostDelay, setGhostDelay] = useState(prefs.ghostDelay ?? 0);
  const [ghostInterval, setGhostInterval] = useState(prefs.ghostInterval ?? 4);
  const [ghostCount, setGhostCount] = useState(prefs.ghostCount ?? 6);
  const [ghostOpacity, setGhostOpacity] = useState(prefs.ghostOpacity ?? 0.8);
  const [loopDepth, setLoopDepth] = useState(prefs.loopDepth ?? 30);
  const [loopSpeed, setLoopSpeed] = useState(prefs.loopSpeed ?? 1);

  // Load settings from database if authenticated
  useEffect(() => {
    if (user?.preferences) {
      if (user.preferences.ghostDelay !== undefined) setGhostDelay(user.preferences.ghostDelay);
      if (user.preferences.ghostInterval !== undefined) setGhostInterval(user.preferences.ghostInterval);
      if (user.preferences.ghostCount !== undefined) setGhostCount(user.preferences.ghostCount);
      if (user.preferences.ghostOpacity !== undefined) setGhostOpacity(user.preferences.ghostOpacity);
      if (user.preferences.loopDepth !== undefined) setLoopDepth(user.preferences.loopDepth);
      if (user.preferences.loopSpeed !== undefined) setLoopSpeed(user.preferences.loopSpeed);
    }
  }, [user]);

  // Persist prefs to localStorage and database with debounce
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const updatedPrefs = {
      ...prefs,
      ghostDelay, ghostInterval, ghostCount, ghostOpacity, loopDepth, loopSpeed,
    };
    localStorage.setItem('vidloop_prefs', JSON.stringify(updatedPrefs));
    if (user) {
      debounceRef.current = setTimeout(() => {
        base44.auth.updateMe({ preferences: updatedPrefs });
      }, 1000);
    }
    return () => clearTimeout(debounceRef.current);
  }, [ghostDelay, ghostInterval, ghostCount, ghostOpacity, loopDepth, loopSpeed, user]);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    await base44.auth.deleteAccount();
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <MobileHeader title="About" />

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom) + 56px)' }}>
        {user && <UserProfile />}

        {/* Auth Section */}
        {!user && (
          <>
            <div className="flex gap-2 text-xs">
              <a href="/login" className="flex-1 px-4 py-2 rounded-xl border border-border bg-card text-center text-foreground hover:bg-muted transition-colors">Sign In</a>
              <a href="/register" className="flex-1 px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 text-center text-primary hover:bg-primary/20 transition-colors">Sign Up</a>
            </div>
          </>
        )}

        {user && (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll need to sign back in to save your clips and settings.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => base44.auth.logout('/')}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, sign out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        <div className="rounded-2xl bg-card border border-border px-5 py-4 space-y-1">
          <h2 className="text-2xl font-light font-heading lowercase tracking-tight text-foreground">vid-loop</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Live camera with ring-buffer scrubbing, ghost layering, and ping-pong looping. No account needed — everything runs in your browser.
          </p>
        </div>

        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1">How it works</p>

        {tips.map(({ icon: IconComponent, title, desc }) => (
          <div key={title} className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border">
            <IconComponent className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
        {/* Ghost & Loop Settings */}
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1 pt-4">Ghost Blend Controls</p>
        <div className="rounded-2xl bg-card border border-border px-5 py-4 space-y-4">
          <ControlSetting label="Delay" sublabel="Seconds before ghost activates" value={ghostDelay} min={0} max={10} step={1} onChange={setGhostDelay} formatValue={(v) => v === 0 ? 'off' : `${v}s`} />
          <ControlSetting label="Interval" sublabel="Frames between layers" value={ghostInterval} min={1} max={30} step={1} onChange={setGhostInterval} formatValue={(v) => `${v}f`} />
          <ControlSetting label="Layers" sublabel="Number of ghost trails" value={ghostCount} min={2} max={10} step={1} onChange={setGhostCount} formatValue={(v) => `${v}`} />
          <ControlSetting label="Opacity" sublabel="Fade intensity" value={ghostOpacity} min={0.05} max={1} step={0.05} onChange={setGhostOpacity} formatValue={(v) => `${Math.round(v * 100)}%`} />
        </div>

        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1 pt-4">Loop Controls</p>
        <div className="rounded-2xl bg-card border border-border px-5 py-4 space-y-4">
          <ControlSetting label="Depth" sublabel="Duration of ping-pong loop" value={loopDepth} min={5} max={180} step={1} onChange={setLoopDepth} formatValue={(v) => `${(v / 30).toFixed(1)}s`} />
          <ControlSetting label="Speed" sublabel="Playback speed multiplier" value={loopSpeed} min={0.25} max={4} step={0.25} onChange={setLoopSpeed} formatValue={(v) => `${v}x`} />
        </div>

        {/* Delete Account */}
        {user && (
          <>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1 pt-4">Danger Zone</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">Delete Account</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes your account and all saved clips. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}

function ControlSetting({ label, sublabel, value, min, max, step, onChange, formatValue }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
        <span className="text-xs font-mono text-primary">{formatValue(value)}</span>
      </div>
      <ControlSlider value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}
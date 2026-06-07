import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Film, Clock, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const FEATURES = [
  { icon: Star, label: 'HD 1080p recording' },
  { icon: Film, label: 'MP4 export (works everywhere)' },
  { icon: Clock, label: '30s scrub buffer (vs 5s free)' },
];

export default function ProModal({ onClose, context = 'settings' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const returnUrl = window.self !== window.top
        ? window.location.ancestorOrigins?.[0] || document.referrer || window.location.origin
        : window.location.origin;
      const res = await base44.functions.invoke('createCheckout', { returnUrl });
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      } else {
        setError('Could not start checkout. Please try again.');
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-t-3xl p-6 space-y-5"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-foreground">
                {context === 'record' ? 'Unlock HD Recording' : 'VidLoop Pro'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {context === 'record' ? 'HD 1080p · MP4 export · 30s buffer' : 'Unlock the full experience'}
              </p>
            </div>
          </div>
          <button
            onTouchEnd={(e) => { e.preventDefault(); onClose('dismiss'); }}
            onClick={() => onClose('dismiss')}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Features */}
        <div className="space-y-3">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm text-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Price + CTA */}
        <div className="space-y-3 pt-1">
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <button
            onTouchEnd={(e) => { e.preventDefault(); handleUpgrade(); }}
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Upgrade — $2.99 one-time
              </>
            )}
          </button>
          {context === 'record' && (
            <button
              onTouchEnd={(e) => { e.preventDefault(); onClose('record'); }}
              onClick={() => onClose('record')}
              className="w-full h-10 rounded-2xl border border-border text-muted-foreground text-sm flex items-center justify-center"
            >
              Record free (SD, WebM)
            </button>
          )}
          <p className="text-xs text-muted-foreground text-center">One-time purchase · Lifetime access</p>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Film, Clock, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const FEATURES = [
  { icon: Star, label: 'HD 1080p recording' },
  { icon: Film, label: 'MP4 export (works everywhere)' },
  { icon: Clock, label: '30s scrub buffer (vs 5s free)' },
];

export default function ProModal({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpgrade = async () => {
    if (window.self !== window.top) {
      alert('Checkout only works from the published app, not the preview.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('createCheckout', {
        returnUrl: window.location.origin,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="w-full max-w-md bg-card border border-border rounded-t-3xl p-6 pb-10 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-foreground">VidLoop Pro</h2>
              <p className="text-xs text-muted-foreground">Unlock the full experience</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
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
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity active:scale-95"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Upgrade — $2.99/month
              </>
            )}
          </button>
          <p className="text-xs text-muted-foreground text-center">Cancel anytime · Billed monthly</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Trash2, LogOut, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function Settings() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.auth.deleteAccount();
      window.location.href = '/';
    } catch (e) {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-5 pb-4 border-b border-border" style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}>
        <h1 className="text-lg font-bold font-heading">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3">
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border text-foreground hover:bg-muted transition-colors active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Log Out</span>
        </button>

        {/* Delete account */}
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-colors active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Delete Account</span>
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-destructive/10 border border-destructive/30 p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Delete your account?</p>
                <p className="text-xs text-muted-foreground mt-1">This is permanent and cannot be undone. All your clips and data will be lost.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-muted border border-border text-sm font-mono text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-mono disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Safe area bottom padding */}
      <div style={{ height: 'env(safe-area-inset-bottom)' }} />
    </div>
  );
}
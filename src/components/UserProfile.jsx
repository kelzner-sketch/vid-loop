import React from 'react';
import { LogOut, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

export default function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = '/';
  };

  return (
    <div className="rounded-2xl bg-card border border-border px-5 py-4 space-y-3">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Logged in as</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm font-medium text-foreground">{user.full_name}</p>
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[10px] font-mono font-semibold tracking-wide">
            <Zap className="w-2.5 h-2.5" />PRO
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      <Button
        onClick={handleLogout}
        variant="outline"
        size="sm"
        className="w-full gap-2"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sign Out
      </Button>
    </div>
  );
}
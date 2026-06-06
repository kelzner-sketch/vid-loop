import React from 'react';
import { LogOut } from 'lucide-react';
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
        <p className="text-sm font-medium text-foreground mt-1">{user.full_name}</p>
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
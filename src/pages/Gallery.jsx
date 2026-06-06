import React, { useEffect, useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Trash2, Download, Film, Pencil, Check, X, CheckSquare, RefreshCw, Share2, Loader2, Scissors } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileHeader from '@/components/MobileHeader';
import UserProfile from '@/components/UserProfile';
import { useTabNav } from '@/components/TabNavigator';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import TrimModal from '@/components/TrimModal';

export default function Gallery() {
  const navigate = useNavigate();
  const { switchTab } = useTabNav();
  const { user } = useAuth();
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [sharingId, setSharingId] = useState(null);
  const [trimmingClip, setTrimmingClip] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [fullscreenClip, setFullscreenClip] = useState(null);

  // Pull-to-refresh state
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollRef = useRef(null);
  const PULL_THRESHOLD = 64;

  const handleTouchStart = useCallback((e) => {
    if (scrollRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartY.current) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setPullY(Math.min(dy * 0.45, PULL_THRESHOLD + 16));
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullY >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullY(PULL_THRESHOLD);
      await loadClips();
      setRefreshing(false);
    }
    setPullY(0);
    touchStartY.current = 0;
  }, [pullY, refreshing]);

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll = () => setSelected(new Set(clips.map((c) => c.id)));

  const exitSelectMode = () => {setSelectMode(false);setSelected(new Set());};

  const exportSelected = async () => {
    setExporting(true);
    const selectedClips = clips.filter((c) => selected.has(c.id));
    
    // Try native share first if available (works on mobile for camera roll, messaging apps, etc.)
    if (navigator.share && selectedClips.length === 1) {
      try {
        const clip = selectedClips[0];
        const res = await fetch(clip.file_url);
        const blob = await res.blob();
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `${clip.title || 'vidloop'}.${ext}`, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: clip.title });
          setExporting(false);
          exitSelectMode();
          return;
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      }
    }
    
    // Fall back to downloading all selected files
    for (const clip of selectedClips) {
      const title = clip.title || `vidloop-${clip.id}`;
      const res = await fetch(clip.file_url);
      const blob = await res.blob();
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      // Small delay between downloads so browser doesn't block them
      await new Promise((r) => setTimeout(r, 400));
    }
    setExporting(false);
    exitSelectMode();
  };

  const deleteSelected = () => {
    const ids = new Set(selected);
    setClips((prev) => prev.filter((c) => !ids.has(c.id)));
    exitSelectMode();
    Promise.all([...ids].map((id) => base44.entities.Clip.delete(id)));
  };

  const startEdit = (clip) => {setEditingId(clip.id);setEditingTitle(clip.title || '');};
  const cancelEdit = () => {setEditingId(null);setEditingTitle('');};
  const saveEdit = async (id) => {
    await base44.entities.Clip.update(id, { title: editingTitle });
    setClips((prev) => prev.map((c) => c.id === id ? { ...c, title: editingTitle } : c));
    cancelEdit();
  };

  const loadClips = async () => {
    const data = await base44.entities.Clip.list('-created_date');
    setClips(data);
    setLoading(false);
  };

  useEffect(() => {
    // Set up subscription first so it's ready to catch new clips
    const unsubscribe = base44.entities.Clip.subscribe((event) => {
      if (event.type === 'create') {
        setClips((prev) => {
          // Dedupe: don't add if clip with same ID already exists
          if (prev.some((c) => c.id === event.data.id)) return prev;
          return [event.data, ...prev];
        });
      } else if (event.type === 'update') {
        setClips((prev) => prev.map((c) => c.id === event.id ? event.data : c));
      } else if (event.type === 'delete') {
        setClips((prev) => prev.filter((c) => c.id !== event.id));
      }
    });

    // Then load initial clips
    loadClips();
    
    return unsubscribe;
  }, []);

  const deleteClip = (id) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    base44.entities.Clip.delete(id);
  };

  const shareClip = async (clip) => {
    setSharingId(clip.id);
    const title = clip.title || 'VidLoop clip';
    // Try native share with file (works on iOS/Android)
    try {
      if (navigator.share) {
        const res = await fetch(clip.file_url);
        const blob = await res.blob();
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `${title}.${ext}`, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title });
        } else {
          await navigator.share({ title, url: clip.file_url });
        }
      } else {
        await navigator.clipboard.writeText(clip.file_url);
        alert('Link copied to clipboard!');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        await navigator.clipboard.writeText(clip.file_url);
        alert('Link copied to clipboard!');
      }
    } finally {
      setSharingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <MobileHeader
        title="Saved Clips"
        right={
        selectMode ?
        <div className="flex items-center gap-1.5">
              <button onClick={selectAll}
          className="px-2 py-1 rounded-full bg-muted border border-border text-muted-foreground text-xs font-mono hover:bg-muted/80">
                All
              </button>
              <button onClick={exitSelectMode}
          className="px-2 py-1 rounded-full bg-muted border border-border text-muted-foreground text-xs font-mono">
                Cancel
              </button>
              <button onClick={exportSelected} disabled={selected.size === 0 || exporting}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-mono disabled:opacity-40">
                {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                ({selected.size})
              </button>
              <button onClick={deleteSelected} disabled={selected.size === 0}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/20 border border-destructive/40 text-destructive text-xs font-mono disabled:opacity-40">
                <Trash2 className="w-3 h-3" />({selected.size})
              </button>
            </div> :
        clips.length > 0 ?
        <button onClick={() => setSelectMode(true)}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted border border-border text-muted-foreground text-xs font-mono">
              <CheckSquare className="w-3 h-3" />
              Select
            </button> :
        null
        } />
      

      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {pullY > 8 &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center py-2"
          style={{ height: pullY }}>
          
            <RefreshCw className={`w-5 h-5 text-primary transition-transform ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: !refreshing ? `rotate(${pullY / PULL_THRESHOLD * 180}deg)` : undefined }} />
          </motion.div>
        }
      </AnimatePresence>

      {/* Fullscreen video modal */}
      <AnimatePresence>
        {fullscreenClip &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setFullscreenClip(null)}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
        >
          <button
            onClick={() => setFullscreenClip(null)}
            className="absolute top-4 right-4 z-10 text-white/60 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <video
            src={fullscreenClip.file_url}
            controls
            autoPlay
            className="w-full h-full max-w-4xl max-h-[90vh] object-contain"
          />
        </motion.div>
        }
      </AnimatePresence>

      {/* Trim modal */}
      {trimmingClip &&
      <TrimModal
        clip={trimmingClip}
        onClose={() => setTrimmingClip(null)}
        onSaved={(updated) => {
          setClips((prev) => prev.map((c) => c.id === updated.id ? updated : c));
          setTrimmingClip(null);
        }} />

      }

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom) + 56px)' }}>
        
        {user && <UserProfile />}

        {loading ?
        <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div> :
        clips.length === 0 ?
        <div className="flex flex-col items-center justify-center h-60 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Film className="w-7 h-7 text-[hsl(var(--foreground))]" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No clips yet</p>
              <p className="text-xs mt-1 text-[hsl(var(--popover-foreground))]">Record something in the camera and save it here.</p>
            </div>
            <button onClick={() => { switchTab('/'); navigate('/'); }} className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
              Open Camera
            </button>
          </div> :

        <div className="grid grid-cols-3 gap-2">
            {clips.map((clip, i) =>
          <motion.div
            key={clip.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={selectMode ? () => toggleSelect(clip.id) : () => setFullscreenClip(clip)}
            className={`bg-card rounded-2xl border overflow-hidden transition-all ${selectMode ? 'cursor-pointer' : 'cursor-pointer hover:ring-1 hover:ring-primary'} ${selected.has(clip.id) ? 'border-destructive ring-2 ring-destructive/40' : 'border-border'}`}>
            
                {/* Video preview */}
                <div className="aspect-square bg-black relative">
                  {selectMode &&
              <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected.has(clip.id) ? 'bg-destructive border-destructive' : 'bg-black/50 border-white/60'}`}>
                      {selected.has(clip.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
              }
                  <video
                src={clip.file_url}
                className="w-full h-full object-cover"
                muted
                playsInline
                onMouseEnter={(e) => {const v = e.currentTarget;v.play().catch(() => {});}}
                onMouseLeave={(e) => {const v = e.currentTarget;v.pause();v.currentTime = 0;}} />
              
                  {clip.duration &&
              <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
                      {clip.duration}s
                    </span>
              }
                </div>
                {/* Footer */}
                <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                  {editingId === clip.id ?
              <>
                      <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {if (e.key === 'Enter') saveEdit(clip.id);if (e.key === 'Escape') cancelEdit();}}
                      className="flex-1 text-[10px] font-mono bg-muted border border-border rounded px-1.5 py-0.5 text-foreground outline-none" />
                
                      <button onClick={() => saveEdit(clip.id)} className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary" />
                      </button>
                      <button onClick={cancelEdit} className="w-5 h-5 rounded bg-muted flex items-center justify-center">
                        <X className="w-2.5 h-2.5 text-muted-foreground" />
                      </button>
                    </> :

              <>
                      <p className="text-[10px] text-muted-foreground font-mono truncate flex-1">
                        {clip.title || new Date(clip.created_date).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-1 ml-1">
                        <button onClick={() => startEdit(clip)}
                        className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors">
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button onClick={() => setTrimmingClip(clip)}
                        className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors">
                            <Scissors className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button onClick={() => shareClip(clip)} disabled={sharingId === clip.id}
                        className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-60">
                            {sharingId === clip.id ?
                        <Loader2 className="w-3 h-3 text-primary animate-spin" /> :
                        <Share2 className="w-3 h-3 text-muted-foreground" />}
                          </button>
                          <a href={clip.file_url} download
                        className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors">
                            <Download className="w-3 h-3 text-muted-foreground" />
                          </a>
                          <button onClick={() => deleteClip(clip.id)}
                        className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-destructive/20 transition-colors">
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </button>
                      </div>
                    </>
              }
                </div>
              </motion.div>
          )}
          </div>
        }
      </div>
    </div>);

}
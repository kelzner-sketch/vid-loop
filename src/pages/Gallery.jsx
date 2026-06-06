import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Camera, Trash2, Download, Film, Pencil, Check, X, CheckSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Gallery() {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const deleteSelected = async () => {
    await Promise.all([...selected].map(id => base44.entities.Clip.delete(id)));
    setClips(prev => prev.filter(c => !selected.has(c.id)));
    exitSelectMode();
  };

  const startEdit = (clip) => { setEditingId(clip.id); setEditingTitle(clip.title || ''); };
  const cancelEdit = () => { setEditingId(null); setEditingTitle(''); };
  const saveEdit = async (id) => {
    await base44.entities.Clip.update(id, { title: editingTitle });
    setClips(prev => prev.map(c => c.id === id ? { ...c, title: editingTitle } : c));
    cancelEdit();
  };

  const loadClips = async () => {
    const data = await base44.entities.Clip.list('-created_date');
    setClips(data);
    setLoading(false);
  };

  useEffect(() => { loadClips(); }, []);

  const deleteClip = async (id) => {
    await base44.entities.Clip.delete(id);
    setClips(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold font-heading">Saved Clips</h1>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <button onClick={exitSelectMode}
                className="px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-mono">
                Cancel
              </button>
              <button onClick={deleteSelected} disabled={selected.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/20 border border-destructive/40 text-destructive text-xs font-mono disabled:opacity-40">
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selected.size})
              </button>
            </>
          ) : (
            <>
              {clips.length > 0 && (
                <button onClick={() => setSelectMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-mono hover:bg-muted/80 transition-colors">
                  <CheckSquare className="w-3.5 h-3.5" />
                  Select
                </button>
              )}
              <Link to="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono hover:bg-primary/20 transition-colors">
                <Camera className="w-3.5 h-3.5" />
                Camera
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Film className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No clips yet</p>
              <p className="text-xs text-muted-foreground mt-1">Record something in the camera and save it here.</p>
            </div>
            <Link to="/" className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
              Open Camera
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {clips.map((clip, i) => (
              <motion.div
                key={clip.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={selectMode ? () => toggleSelect(clip.id) : undefined}
                className={`bg-card rounded-2xl border overflow-hidden transition-all ${selectMode ? 'cursor-pointer' : ''} ${selected.has(clip.id) ? 'border-destructive ring-2 ring-destructive/40' : 'border-border'}`}
              >
                {/* Video preview */}
                <div className="aspect-[9/16] bg-black relative">
                  {selectMode && (
                    <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected.has(clip.id) ? 'bg-destructive border-destructive' : 'bg-black/50 border-white/60'}`}>
                      {selected.has(clip.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  )}
                  <video
                    src={clip.file_url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    onMouseEnter={e => { const v = e.currentTarget; v.play().catch(() => {}); }}
                    onMouseLeave={e => { const v = e.currentTarget; v.pause(); v.currentTime = 0; }}
                  />
                  {clip.duration && (
                    <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
                      {clip.duration}s
                    </span>
                  )}
                </div>
                {/* Footer */}
                <div className="px-3 py-2 flex items-center justify-between gap-1">
                  {editingId === clip.id ? (
                    <>
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(clip.id); if (e.key === 'Escape') cancelEdit(); }}
                        className="flex-1 text-xs font-mono bg-muted border border-border rounded px-2 py-1 text-foreground outline-none"
                      />
                      <button onClick={() => saveEdit(clip.id)} className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </button>
                      <button onClick={cancelEdit} className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground font-mono truncate flex-1">
                        {clip.title || new Date(clip.created_date).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-1.5 ml-2">
                        <button onClick={() => startEdit(clip)}
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <a href={clip.file_url} download
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors">
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                        <button onClick={() => deleteClip(clip.id)}
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-destructive/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
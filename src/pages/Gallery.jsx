import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Camera, Trash2, Download, Film } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Gallery() {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <Link to="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono hover:bg-primary/20 transition-colors">
          <Camera className="w-3.5 h-3.5" />
          Camera
        </Link>
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
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                {/* Video preview */}
                <div className="aspect-[9/16] bg-black relative">
                  <video
                    src={clip.file_url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    onMouseEnter={e => e.target.play()}
                    onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
                  />
                  {clip.duration && (
                    <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
                      {clip.duration}s
                    </span>
                  )}
                </div>
                {/* Footer */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-mono truncate flex-1">
                    {clip.title || new Date(clip.created_date).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-1.5 ml-2">
                    <a href={clip.file_url} download
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors">
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    </a>
                    <button onClick={() => deleteClip(clip.id)}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-destructive/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
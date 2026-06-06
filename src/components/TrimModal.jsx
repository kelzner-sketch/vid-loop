import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Check, Loader2, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';

export default function TrimModal({ clip, onClose, onSaved }) {
  const videoRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [startT, setStartT] = useState(0);
  const [endT, setEndT] = useState(0);
  const [currentT, setCurrentT] = useState(0);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const railRef = useRef(null);
  const dragging = useRef(null); // 'start' | 'end'

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      const d = v.duration || 0;
      setDuration(d);
      setEndT(d);
    };
    v.addEventListener('loadedmetadata', onLoaded);
    if (v.readyState >= 1) onLoaded();
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentT(v.currentTime);
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, []);

  // Loop within trim range during preview
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.currentTime >= endT) {
        v.currentTime = startT;
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [startT, endT]);

  const xToTime = useCallback((clientX) => {
    const rail = railRef.current;
    if (!rail || !duration) return 0;
    const { left, width } = rail.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - left) / width) * duration));
  }, [duration]);

  const onPointerDown = (e, handle) => {
    e.preventDefault();
    dragging.current = handle;
    const move = (ev) => {
      const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const t = xToTime(x);
      if (handle === 'start') setStartT(prev => Math.min(t, endT - 0.1));
      else setEndT(prev => Math.max(t, startT + 0.1));
    };
    const up = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
  };

  const togglePreview = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!preview) {
      v.currentTime = startT;
      v.play().catch(() => {});
      setPreview(true);
    } else {
      v.pause();
      setPreview(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Fetch the source video
      const res = await fetch(clip.file_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Create an offscreen video
      const vid = document.createElement('video');
      vid.src = url;
      vid.muted = true;
      vid.playsInline = true;
      await new Promise(r => { vid.onloadedmetadata = r; });

      // Create canvas sized to the video
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth;
      canvas.height = vid.videoHeight;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      vid.currentTime = startT;
      await new Promise(r => { vid.onseeked = r; });

      recorder.start();
      vid.play();

      await new Promise((resolve) => {
        const draw = () => {
          if (vid.currentTime >= endT) {
            vid.pause();
            recorder.stop();
            resolve();
            return;
          }
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
      });

      await new Promise(r => { recorder.onstop = r; });
      URL.revokeObjectURL(url);

      const trimmedBlob = new Blob(chunks, { type: mimeType });
      const trimmedFile = new File([trimmedBlob], `trimmed.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`, { type: mimeType });

      const { file_url } = await base44.integrations.Core.UploadFile({ file: trimmedFile });
      const trimmedDuration = Math.round((endT - startT) * 10) / 10;
      await base44.entities.Clip.update(clip.id, { file_url, duration: trimmedDuration });
      onSaved({ ...clip, file_url, duration: trimmedDuration });
    } catch (err) {
      console.error(err);
      alert('Trim failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const startPct = duration ? (startT / duration) * 100 : 0;
  const endPct = duration ? (endT / duration) * 100 : 100;
  const playPct = duration ? (currentT / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
      >
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl overflow-hidden flex flex-col gap-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Trim Clip</span>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Video preview */}
          <div className="aspect-[9/16] bg-black relative max-h-60 w-full overflow-hidden">
            <video
              ref={videoRef}
              src={clip.file_url}
              className="w-full h-full object-contain"
              playsInline
              muted
            />
            {/* Overlay showing trimmed-out regions */}
            <div className="absolute inset-0 pointer-events-none flex">
              <div className="bg-black/60 h-full" style={{ width: `${startPct}%` }} />
              <div className="flex-1" />
              <div className="bg-black/60 h-full" style={{ width: `${100 - endPct}%` }} />
            </div>
          </div>

          {/* Trim controls */}
          <div className="px-4 py-4 space-y-4">
            {/* Rail */}
            <div className="relative h-10 flex items-center select-none" ref={railRef}>
              {/* Track background */}
              <div className="absolute left-0 right-0 h-1.5 rounded-full bg-muted" />
              {/* Active range */}
              <div
                className="absolute h-1.5 rounded-full bg-primary"
                style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
              />
              {/* Playhead */}
              <div
                className="absolute w-0.5 h-4 bg-white/80 rounded-full -translate-x-1/2 pointer-events-none"
                style={{ left: `${playPct}%` }}
              />
              {/* Start handle */}
              <div
                className="absolute -translate-x-1/2 w-5 h-5 rounded-full bg-primary border-2 border-white shadow-lg cursor-grab active:cursor-grabbing z-10 flex items-center justify-center"
                style={{ left: `${startPct}%` }}
                onMouseDown={e => onPointerDown(e, 'start')}
                onTouchStart={e => onPointerDown(e, 'start')}
              />
              {/* End handle */}
              <div
                className="absolute -translate-x-1/2 w-5 h-5 rounded-full bg-primary border-2 border-white shadow-lg cursor-grab active:cursor-grabbing z-10 flex items-center justify-center"
                style={{ left: `${endPct}%` }}
                onMouseDown={e => onPointerDown(e, 'end')}
                onTouchStart={e => onPointerDown(e, 'end')}
              />
            </div>

            {/* Time labels */}
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Start: {startT.toFixed(1)}s</span>
              <span className="text-primary">{(endT - startT).toFixed(1)}s</span>
              <span>End: {endT.toFixed(1)}s</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={togglePreview}
                className="flex-1 py-2 rounded-xl border border-border bg-muted text-foreground text-sm font-mono"
              >
                {preview ? 'Pause' : 'Preview'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-mono flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Trim'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
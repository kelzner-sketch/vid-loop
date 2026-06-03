import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Camera, CameraOff, Layers, Clock, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useCamera from '@/components/video/useCamera';
import useFrameBuffer from '@/components/video/useFrameBuffer';
import RenderCanvas from '@/components/video/RenderCanvas';
import ControlSlider from '@/components/video/ControlSlider';

export default function Home() {
  const { videoRef, isActive, error, start, stop } = useCamera();
  const { pushFrame, getFrame, getBufferLength, clearBuffer, maxBufferSize } = useFrameBuffer();

  const [delayOffset, setDelayOffset] = useState(0);
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [ghostInterval, setGhostInterval] = useState(10);
  const [bufferFill, setBufferFill] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(true);
  const captureRef = useRef(null);

  // Capture frames into the ring buffer at ~30fps
  const captureLoop = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      pushFrame(videoRef.current);
      setBufferFill(getBufferLength());
    }
    captureRef.current = requestAnimationFrame(captureLoop);
  }, [pushFrame, getBufferLength, videoRef]);

  useEffect(() => {
    if (isActive) {
      captureRef.current = requestAnimationFrame(captureLoop);
    }
    return () => {
      if (captureRef.current) cancelAnimationFrame(captureRef.current);
    };
  }, [isActive, captureLoop]);

  const handleStart = async () => {
    await start();
  };

  const handleStop = () => {
    stop();
    clearBuffer();
    setBufferFill(0);
    setDelayOffset(0);
  };

  const delaySeconds = (delayOffset / 30).toFixed(2);
  const fillPercent = Math.round((bufferFill / maxBufferSize) * 100);
  const isDelayed = delayOffset > 0;

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">

      {/* ── IDLE SCREEN ── */}
      <AnimatePresence>
        {!isActive && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 px-8 bg-background"
          >
            {/* Logo mark */}
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Eye className="w-10 h-10 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent animate-pulse" />
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold font-heading tracking-tight text-foreground">FrameDelay</h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Live camera feed with ring-buffer scrubbing and multi-frame ghost layering.
              </p>
            </div>

            <div className="w-full max-w-xs space-y-3">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-xl text-center">
                  {error}
                </p>
              )}
              <Button onClick={handleStart} size="lg" className="w-full gap-2 h-14 text-base rounded-2xl">
                <Camera className="w-5 h-5" />
                Enable Camera
              </Button>
            </div>

            <p className="text-xs text-muted-foreground/60 text-center max-w-xs">
              Works in browser — opens front or rear camera. On iPhone, use Safari for full access.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LIVE VIEW ── */}
      {isActive && (
        <>
          {/* Full-screen canvas */}
          <div className="absolute inset-0">
            <RenderCanvas
              getFrame={getFrame}
              delayOffset={delayOffset}
              ghostEnabled={ghostEnabled}
              ghostInterval={ghostInterval}
              isActive={isActive}
            />
          </div>

          {/* ── TOP HUD ── */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-5 pt-12 pb-6"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>

            {/* Left: status */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-mono text-white/80 uppercase tracking-widest">
                  {isDelayed ? 'DELAYED' : 'LIVE'}
                </span>
              </div>
              {isDelayed && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10"
                >
                  <span className="text-sm font-mono text-white">−{delaySeconds}s</span>
                </motion.div>
              )}
            </div>

            {/* Right: ghost badge + stop */}
            <div className="flex items-center gap-3">
              {ghostEnabled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/50 backdrop-blur-md border border-primary/30"
                >
                  <Layers className="w-3 h-3 text-white" />
                  <span className="text-xs font-mono text-white">GHOST</span>
                </motion.div>
              )}
              <button
                onClick={handleStop}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition-transform"
              >
                <CameraOff className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* ── BUFFER PROGRESS BAR ── */}
          <div className="absolute top-0 left-0 right-0 z-20 h-0.5">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${fillPercent}%` }}
            />
          </div>

          {/* ── BOTTOM CONTROLS PANEL ── */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            {/* Toggle tab */}
            <div className="flex justify-center mb-1">
              <button
                onClick={() => setControlsOpen(o => !o)}
                className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/70 text-xs font-mono"
              >
                {controlsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                {controlsOpen ? 'hide' : 'controls'}
              </button>
            </div>

            <AnimatePresence>
              {controlsOpen && (
                <motion.div
                  key="controls"
                  initial={{ y: 120, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 120, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="mx-3 mb-8 rounded-3xl overflow-hidden"
                  style={{ background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="px-5 pt-5 pb-6 space-y-5">

                    {/* Scrub delay slider */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[11px] font-mono uppercase tracking-widest text-white/50">Scrub Delay</span>
                        </div>
                        <span className="text-sm font-mono text-white">{delaySeconds}s</span>
                      </div>
                      <ControlSlider
                        value={delayOffset}
                        min={0}
                        max={Math.max(1, bufferFill - 1)}
                        step={1}
                        onChange={setDelayOffset}
                      />
                    </div>

                    <div className="h-px bg-white/8" />

                    {/* Ghost toggle row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] font-mono uppercase tracking-widest text-white/50">Ghost Layers</span>
                      </div>
                      <Switch
                        checked={ghostEnabled}
                        onCheckedChange={setGhostEnabled}
                      />
                    </div>

                    {/* Ghost interval slider */}
                    <AnimatePresence>
                      {ghostEnabled && (
                        <motion.div
                          key="ghost-interval"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono uppercase tracking-widest text-white/50">Ghost Interval</span>
                              <span className="text-sm font-mono text-white">{ghostInterval}f</span>
                            </div>
                            <ControlSlider
                              value={ghostInterval}
                              min={1}
                              max={30}
                              step={1}
                              onChange={setGhostInterval}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Stats row */}
                    <div className="flex gap-2 pt-1">
                      <StatPill label="Buffer" value={`${fillPercent}%`} />
                      <StatPill label="Frames" value={`${bufferFill}`} />
                      <StatPill label="Ghosts" value={ghostEnabled ? `4×` : 'off'} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Hidden video element */}
      <video ref={videoRef} playsInline muted className="hidden" />
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-center">
      <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-0.5">{label}</p>
      <p className="text-xs font-mono text-white/80">{value}</p>
    </div>
  );
}
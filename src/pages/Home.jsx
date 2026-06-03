import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Camera, CameraOff, Layers, Clock, Gauge, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useCamera from '@/components/video/useCamera';
import useFrameBuffer from '@/components/video/useFrameBuffer';
import RenderCanvas from '@/components/video/RenderCanvas';
import ControlSlider from '@/components/video/ControlSlider';
import StatusBadge from '@/components/video/StatusBadge';

export default function Home() {
  const { videoRef, isActive, error, start, stop } = useCamera();
  const { pushFrame, getFrame, getBufferLength, clearBuffer, maxBufferSize } = useFrameBuffer();

  const [delayOffset, setDelayOffset] = useState(0);
  const [ghostEnabled, setGhostEnabled] = useState(true);
  const [ghostInterval, setGhostInterval] = useState(10);
  const [bufferFill, setBufferFill] = useState(0);
  const captureRef = useRef(null);

  // Capture frames from the hidden video element into the ring buffer
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

  const handleToggle = async () => {
    if (isActive) {
      stop();
      clearBuffer();
      setBufferFill(0);
      setDelayOffset(0);
    } else {
      await start();
    }
  };

  const fillPercent = Math.round((bufferFill / maxBufferSize) * 100);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold font-heading tracking-tight">FrameDelay</h1>
            <p className="text-xs text-muted-foreground">Live video buffer & ghost layering</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge active={isActive} label={isActive ? 'Live' : 'Offline'} />
          {isActive && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border">
              <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">Buffer {fillPercent}%</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Video Display */}
        <div className="flex-1 flex items-center justify-center p-4 lg:p-8 relative">
          <AnimatePresence mode="wait">
            {!isActive ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-6 text-center max-w-md"
              >
                <div className="w-20 h-20 rounded-2xl bg-secondary border border-border flex items-center justify-center">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold font-heading mb-2">Start Camera</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Grant camera access to begin capturing frames. Scrub through time and layer ghost trails over your live feed.
                  </p>
                </div>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">{error}</p>
                )}
                <Button onClick={handleToggle} size="lg" className="gap-2 px-8">
                  <Camera className="w-4 h-4" />
                  Enable Camera
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full max-h-[70vh] lg:max-h-full flex items-center justify-center relative"
              >
                <div className="relative w-full max-w-3xl aspect-video rounded-xl overflow-hidden bg-black border border-border/50 shadow-2xl shadow-primary/5">
                  <RenderCanvas
                    getFrame={getFrame}
                    delayOffset={delayOffset}
                    ghostEnabled={ghostEnabled}
                    ghostInterval={ghostInterval}
                    isActive={isActive}
                  />
                  {/* Overlay badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {delayOffset > 0 && (
                      <div className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-xs font-mono text-white">
                        -{Math.round(delayOffset / 30 * 100) / 100}s
                      </div>
                    )}
                    {ghostEnabled && (
                      <div className="px-2.5 py-1 rounded-md bg-primary/60 backdrop-blur-sm text-xs font-mono text-white flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        Ghost
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hidden video element for capture */}
          <video ref={videoRef} playsInline muted className="hidden" />
        </div>

        {/* Controls Panel */}
        {isActive && (
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border bg-card p-6 space-y-8 overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Controls</h2>
              <Button variant="ghost" size="sm" onClick={handleToggle} className="text-destructive hover:text-destructive gap-1.5">
                <CameraOff className="w-3.5 h-3.5" />
                Stop
              </Button>
            </div>

            {/* Scrub Delay */}
            <ControlSlider
              label="Scrub Delay"
              icon={Clock}
              value={delayOffset}
              min={0}
              max={maxBufferSize}
              step={1}
              onChange={setDelayOffset}
              unit=" frames"
            />

            <div className="h-px bg-border" />

            {/* Ghost Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ghost Layering</span>
              </div>
              <Switch checked={ghostEnabled} onCheckedChange={setGhostEnabled} />
            </div>

            {/* Ghost Interval */}
            {ghostEnabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <ControlSlider
                  label="Ghost Interval"
                  icon={Layers}
                  value={ghostInterval}
                  min={1}
                  max={30}
                  step={1}
                  onChange={setGhostInterval}
                  unit=" frames"
                />
              </motion.div>
            )}

            <div className="h-px bg-border" />

            {/* Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Info</h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Buffer" value={`${bufferFill}/${maxBufferSize}`} />
                <InfoCard label="Delay" value={`${Math.round(delayOffset / 30 * 100) / 100}s`} />
                <InfoCard label="Ghosts" value={ghostEnabled ? '4 layers' : 'Off'} />
                <InfoCard label="Interval" value={`${ghostInterval}f`} />
              </div>
            </div>
          </motion.aside>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-secondary border border-border">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-mono font-medium text-foreground">{value}</p>
    </div>
  );
}
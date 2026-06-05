import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Camera, CameraOff, Layers, Clock, Eye, Play, Circle, Square, Download, SwitchCamera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useCamera from '@/components/video/useCamera';
import useFrameBuffer from '@/components/video/useFrameBuffer';
import RenderCanvas from '@/components/video/RenderCanvas';
import ControlSlider from '@/components/video/ControlSlider';
import ScrubBar from '@/components/video/ScrubBar';

export default function Home() {
  const { videoRef, isActive, error, start, stop } = useCamera();
  const { pushFrame, getFrame, getBufferLength, clearBuffer, maxBufferSize } = useFrameBuffer();

  const [facingMode, setFacingMode] = useState('user');
  const [delayOffset, setDelayOffset] = useState(0);
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [ghostInterval, setGhostInterval] = useState(10);
  const [ghostCount, setGhostCount] = useState(4);
  const [ghostOpacity, setGhostOpacity] = useState(0.75);
  const [bufferFill, setBufferFill] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const captureRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const canvasRef = useRef(null);

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
    await start(facingMode);
  };

  const handleSwitchCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    if (isActive) {
      stop();
      clearBuffer();
      setBufferFill(0);
      setDelayOffset(0);
      await start(next);
    }
  };

  const handleStop = () => {
    if (isRecording) stopRecording();
    stop();
    clearBuffer();
    setBufferFill(0);
    setDelayOffset(0);
  };

  const startRecording = useCallback(() => {
    // Find the canvas element rendered by RenderCanvas
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    recordingChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const isMP4 = mimeType.startsWith('video/mp4');
      const blob = new Blob(recordingChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `framedelay-${Date.now()}.${isMP4 ? 'mp4' : 'webm'}`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

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
              videoRef={videoRef}
              getFrame={getFrame}
              delayOffset={delayOffset}
              ghostEnabled={ghostEnabled}
              ghostInterval={ghostInterval}
              ghostCount={ghostCount}
              ghostOpacity={ghostOpacity}
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

            {/* Right: ghost badge + record + stop */}
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

              {/* Record button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border font-mono text-xs transition-all active:scale-95 ${
                  isRecording
                    ? 'bg-red-500/80 border-red-400/60 text-white'
                    : 'bg-white/10 border-white/20 text-white/80'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-3 h-3 fill-white" />
                    <span className="tabular-nums">
                      {String(Math.floor(recordingTime / 60)).padStart(2,'0')}:{String(recordingTime % 60).padStart(2,'0')}
                    </span>
                  </>
                ) : (
                  <>
                    <Circle className="w-3 h-3 fill-red-400 text-red-400" />
                    REC
                  </>
                )}
              </button>

              {/* Switch camera */}
              <button
                onClick={handleSwitchCamera}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition-transform"
              >
                <SwitchCamera className="w-4 h-4 text-white" />
              </button>

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
          <div className="absolute bottom-0 left-0 right-0 z-10"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)' }}
          >
            <div className="px-5 pb-16 pt-8 space-y-5">

              {/* ── SCRUB BAR ── */}
              <div className="space-y-2">
                {/* Labels */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-white/40" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Scrub</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDelayed && (
                      <button
                        onClick={() => setDelayOffset(0)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/20 border border-accent/30 text-accent text-[10px] font-mono"
                      >
                        <Play className="w-2.5 h-2.5" />
                        LIVE
                      </button>
                    )}
                    <span className="text-sm font-mono text-white tabular-nums">
                      {isDelayed ? `−${delaySeconds}s` : 'live'}
                    </span>
                  </div>
                </div>

                {/* Custom scrub track */}
                <ScrubBar
                  value={delayOffset}
                  max={Math.max(1, bufferFill - 1)}
                  onChange={setDelayOffset}
                  bufferFill={bufferFill}
                  maxBufferSize={maxBufferSize}
                />

                {/* Time markers */}
                <div className="flex justify-between text-[9px] font-mono text-white/25 px-0.5">
                  <span>−{(Math.max(1, bufferFill - 1) / 30).toFixed(1)}s</span>
                  <span>now</span>
                </div>
              </div>

              {/* ── GHOST CONTROLS ── */}
              <div className="space-y-3">
                {/* Ghost toggle header */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setGhostEnabled(g => !g)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                      ghostEnabled
                        ? 'bg-primary/30 border-primary/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Ghost Blend
                  </button>
                  {/* Stop button */}
                  <button
                    onClick={handleStop}
                    className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <CameraOff className="w-4 h-4 text-white/70" />
                  </button>
                </div>

                {/* Ghost sub-controls */}
                <AnimatePresence>
                  {ghostEnabled && (
                    <motion.div
                      key="ghost-panel"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-1">
                        {/* Interval */}
                        <GhostSliderRow
                          label="Interval"
                          valueLabel={`${ghostInterval}f`}
                          value={ghostInterval} min={1} max={30} step={1}
                          onChange={setGhostInterval}
                        />
                        {/* Count */}
                        <GhostSliderRow
                          label="Layers"
                          valueLabel={`${ghostCount}`}
                          value={ghostCount} min={2} max={10} step={1}
                          onChange={setGhostCount}
                        />
                        {/* Opacity */}
                        <GhostSliderRow
                          label="Opacity"
                          valueLabel={`${Math.round(ghostOpacity * 100)}%`}
                          value={ghostOpacity} min={0.05} max={1} step={0.05}
                          onChange={setGhostOpacity}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Hidden video element */}
      <video ref={videoRef} playsInline muted className="hidden" />
    </div>
  );
}

function GhostSliderRow({ label, valueLabel, value, min, max, step, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 w-14 shrink-0">{label}</span>
      <div className="flex-1">
        <ControlSlider value={value} min={min} max={max} step={step} onChange={onChange} />
      </div>
      <span className="text-xs font-mono text-white/60 w-10 text-right shrink-0 tabular-nums">{valueLabel}</span>
    </div>
  );
}
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Camera as CameraIcon, CameraOff, Layers, Clock, Eye, Play, Circle, Square, Download, SwitchCamera, Repeat2, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTabNav } from '@/components/TabNavigator';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import useCamera from '@/components/video/useCamera';
import useFrameBuffer from '@/components/video/useFrameBuffer';
import RenderCanvas from '@/components/video/RenderCanvas';
import ControlSlider from '@/components/video/ControlSlider';
import ScrubBar from '@/components/video/ScrubBar';
import { useRecording } from '@/lib/RecordingContext';
import { usePro } from '@/lib/ProContext';
import ProModal from '@/components/ProModal';


export default function Camera() {
  const navigate = useNavigate();
  const { switchTab } = useTabNav();
  const { isRecording, setIsRecording } = useRecording();
  const { isPro } = usePro();
  const [showProModal, setShowProModal] = useState(false);
  const { videoRef, isActive, error, start, stop } = useCamera();
  const { pushFrame, getFrame, getBufferLength, clearBuffer, maxBufferSize } = useFrameBuffer();

  const { user } = useAuth();

  // Load persisted prefs from localStorage or database
  const loadPrefs = () => {
    try {return JSON.parse(localStorage.getItem('vidloop_prefs') || '{}');} catch {return {};}
  };
  const prefs = loadPrefs();

  const [facingMode, setFacingMode] = useState(prefs.facingMode ?? 'environment');
  const [delayOffset, setDelayOffset] = useState(15);
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [ghostActive, setGhostActive] = useState(false);
  const [ghostDelay, setGhostDelay] = useState(prefs.ghostDelay ?? 0);
  const [ghostCountdown, setGhostCountdown] = useState(null);
  const [ghostInterval, setGhostInterval] = useState(prefs.ghostInterval ?? 4);
  const [ghostCount, setGhostCount] = useState(prefs.ghostCount ?? 4);
  const [ghostOpacity, setGhostOpacity] = useState(prefs.ghostOpacity ?? 0.8);
  const ghostCountdownRef = useRef(null);

  // Ping-pong loop mode
  const [loopEnabled, setLoopEnabled] = useState(prefs.loopEnabled ?? true);
  const [loopDepth, setLoopDepth] = useState(prefs.loopDepth ?? 30); // frames to ping-pong through
  const [loopSpeed, setLoopSpeed] = useState(prefs.loopSpeed ?? 1); // frames advanced per render tick
  const loopStateRef = useRef({ dir: 1, pos: 0 }); // internal mutable state, no re-render
  const loopRafRef = useRef(null);
  const loopEnabledRef = useRef(false);

  const [bufferFill, setBufferFill] = useState(0);
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);
  const [recordingTime, setRecordingTime] = useState(0);
  const [savedClip, setSavedClip] = useState(null); // {url, duration} shown after save
  const [uploadStatus, setUploadStatus] = useState(null); // 'uploading' | 'error'
  const [uploadError, setUploadError] = useState('');
  const captureRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const canvasRef = useRef(null); // forwarded from RenderCanvas
  const mirrorRafRef = useRef(null);

  // Load settings from database if authenticated
  useEffect(() => {
    if (user) {
      const dbPrefs = user.preferences || {};
      if (dbPrefs.ghostDelay !== undefined) setGhostDelay(dbPrefs.ghostDelay);
      if (dbPrefs.ghostInterval !== undefined) setGhostInterval(dbPrefs.ghostInterval);
      if (dbPrefs.ghostCount !== undefined) setGhostCount(dbPrefs.ghostCount);
      if (dbPrefs.ghostOpacity !== undefined) setGhostOpacity(dbPrefs.ghostOpacity);
      if (dbPrefs.loopDepth !== undefined) setLoopDepth(dbPrefs.loopDepth);
      if (dbPrefs.loopSpeed !== undefined) setLoopSpeed(dbPrefs.loopSpeed);
      if (dbPrefs.loopEnabled !== undefined) setLoopEnabled(dbPrefs.loopEnabled);
      if (dbPrefs.facingMode !== undefined) setFacingMode(dbPrefs.facingMode);
    }
  }, [user]);

  // Persist preferences to localStorage and database with debounce
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const prefs = {
      facingMode, loopEnabled, loopDepth, loopSpeed,
      ghostDelay, ghostInterval, ghostCount, ghostOpacity
    };
    localStorage.setItem('vidloop_prefs', JSON.stringify(prefs));
    if (user) {
      debounceRef.current = setTimeout(() => {
        base44.auth.updateMe({ preferences: prefs });
      }, 1000);
    }
    return () => clearTimeout(debounceRef.current);
  }, [facingMode, loopEnabled, loopDepth, loopSpeed, ghostDelay, ghostInterval, ghostCount, ghostOpacity, user]);

  // Keep refs in sync so the RAF loop always reads latest values
  loopEnabledRef.current = loopEnabled;

  // Ping-pong loop — drives delayOffset automatically
  useEffect(() => {
    if (!loopEnabled) {
      if (loopRafRef.current) cancelAnimationFrame(loopRafRef.current);
      return;
    }
    const tick = () => {
      if (!loopEnabledRef.current) return;
      const state = loopStateRef.current;
      state.pos += state.dir * loopSpeed;
      if (state.pos >= loopDepth) {
        state.pos = loopDepth;
        state.dir = -1;
      } else if (state.pos <= 0) {
        state.pos = 0;
        state.dir = 1;
      }
      setDelayOffset(Math.round(state.pos));
      loopRafRef.current = requestAnimationFrame(tick);
    };
    loopStateRef.current = { dir: 1, pos: 0 };
    loopRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (loopRafRef.current) cancelAnimationFrame(loopRafRef.current);
    };
  }, [loopEnabled, loopDepth, loopSpeed]);

  const toggleLoop = () => {
    setLoopEnabled((prev) => {
      if (prev) {
        // turning off — snap back to live
        setDelayOffset(0);
      }
      return !prev;
    });
  };

  // Track orientation changes without restarting camera (debounced)
  useEffect(() => {
    let timer;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsLandscape(window.innerWidth > window.innerHeight), 150);
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      clearTimeout(timer);
    };
  }, []);

  // Capture frames into the ring buffer at ~30fps
  const captureLoop = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      pushFrame(videoRef.current);
      const len = getBufferLength();
      setBufferFill(len);
      // Once buffer has enough frames, lock the default delay in place
      setDelayOffset((prev) => prev > 0 && prev >= len ? Math.max(0, len - 1) : prev);
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

  const handleStart = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    console.log('Enabling camera, facing mode:', facingMode);
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

  const toggleGhost = () => {
    if (ghostEnabled) {
      // Turn off — cancel any countdown
      clearInterval(ghostCountdownRef.current);
      setGhostEnabled(false);
      setGhostActive(false);
      setGhostCountdown(null);
    } else {
      // Turn on — start countdown
      setGhostEnabled(true);
      if (ghostDelay > 0) {
        setGhostCountdown(ghostDelay);
        setGhostActive(false);
        let remaining = ghostDelay;
        ghostCountdownRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(ghostCountdownRef.current);
            setGhostCountdown(null);
            setGhostActive(true);
          } else {
            setGhostCountdown(remaining);
          }
        }, 1000);
      } else {
        setGhostActive(true);
      }
    }
  };

  const handleStop = () => {
    if (isRecording) stopRecording();
    clearInterval(ghostCountdownRef.current);
    setGhostEnabled(false);
    setGhostActive(false);
    setGhostCountdown(null);
    setLoopEnabled(false);
    stop();
    clearBuffer();
    setBufferFill(0);
    setDelayOffset(0);
  };

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Free tier: record at 360×640 max via an offscreen canvas
    let recordCanvas = canvas;
    if (!isPro) {
      const scale = Math.min(1, 360 / canvas.width, 640 / canvas.height);
      const oc = document.createElement('canvas');
      oc.width = Math.round(canvas.width * scale);
      oc.height = Math.round(canvas.height * scale);
      const octx = oc.getContext('2d');
      // Mirror the main canvas into offscreen at capped size each frame
      const mirrorLoop = () => {
        octx.drawImage(canvas, 0, 0, oc.width, oc.height);
        mirrorRafRef.current = requestAnimationFrame(mirrorLoop);
      };
      mirrorRafRef.current = requestAnimationFrame(mirrorLoop);
      recordCanvas = oc;
    }

    const stream = recordCanvas.captureStream(30);
    const mimeType =
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' :
    MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' :
    MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' :
    'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    recordingChunksRef.current = [];
    recorder.ondataavailable = (e) => {if (e.data.size > 0) recordingChunksRef.current.push(e.data);};
    recorder.onstop = async () => {
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const blob = new Blob(recordingChunksRef.current, { type: mimeType });

      // Trigger browser download
      const localUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = `vid-loop-${Date.now()}.${ext}`;
      a.click();

      // Upload to storage and save to gallery
      try {
        setUploadStatus('uploading');
        const timestamp = Date.now();
        const file = new File([blob], `vid-loop-${timestamp}.${ext}`, { type: mimeType });
        console.log('Uploading file:', { name: file.name, size: file.size, type: file.type });
        const response = await base44.integrations.Core.UploadFile({ file });
        const { file_url } = response;
        console.log('Upload successful:', file_url);
        const clip = await base44.entities.Clip.create({
          file_url,
          duration: recordingTimerRef._lastTime || null,
          title: `Clip ${new Date().toLocaleTimeString()}`
        });
        setUploadStatus(null);
        setSavedClip({ url: file_url });
        // Notify gallery to prepend this clip immediately
        window.dispatchEvent(new CustomEvent('clip-saved', { detail: clip }));
        setTimeout(() => setSavedClip(null), 5000);
      } catch (e) {
        console.error('Gallery save failed:', e);
        const statusCode = e?.response?.status;
        const errorMsg = e?.response?.data?.message || e?.message || e?.toString();
        const details = `Error: ${statusCode ? `HTTP ${statusCode}` : 'Network'} — ${errorMsg}`;
        console.error('Upload error:', details);
        setUploadStatus('error');
        setUploadError(details);
        setTimeout(() => setUploadStatus(null), 5000);
      }
      URL.revokeObjectURL(localUrl);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef._lastTime = 0;
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((t) => {
        recordingTimerRef._lastTime = t + 1;
        return t + 1;
      });
    }, 1000);
  }, [isPro]);

  const handleRecordPress = useCallback((e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    console.log('Record button clicked, isPro:', isPro);
    try {
      if (!isPro) { 
        console.log('Showing Pro modal');
        setShowProModal(true); 
        return; 
      }
      console.log('Starting recording');
      startRecording();
    } catch (err) {
      console.error('Record handler error:', err);
    }
  }, [isPro, startRecording]);

  // When free user dismisses the Pro modal, start recording at capped resolution
  const handleProModalClose = useCallback(() => {
    setShowProModal(false);
    startRecording();
  }, [startRecording]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    if (mirrorRafRef.current) cancelAnimationFrame(mirrorRafRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const delaySeconds = (delayOffset / 30).toFixed(2);
  const fillPercent = Math.round(bufferFill / maxBufferSize * 100);
  const isDelayed = delayOffset > 0;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[hsl(var(--popover))]">

      {/* ── IDLE SCREEN ── */}
      <AnimatePresence>
        {!isActive &&
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 px-8 bg-[#3b917b]/6">
          
            {/* Logo mark */}
            <div className="relative">
              <img src="https://media.base44.com/images/public/6a2067de3230ec7bd237c422/26d8fea39_vid-loop-icon.png" alt="VidLoop" className="w-24 h-24 rounded-3xl" />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full animate-pulse bg-[#ff0000]" />
            </div>

            <div className="text-center space-y-2">
              <h1 className="font-heading tracking-tight text-foreground font-light lowercase text-center text-4xl">Vid-Loop</h1>
              <p className="text-sm leading-relaxed max-w-xs">Live camera tool that lets you scrub back through the last few seconds of footage, layer motion ghost trails, and loop clips in a ping-pong effect. Record and share directly from your phone.

            </p>
            </div>

            <div className="w-full max-w-xs space-y-3">
              {error &&
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-xl text-center">
                  {error}
                </p>
            }
              <Button onClick={handleStart} size="lg" className="w-full gap-2 h-14 rounded-2xl lowercase text-center text-xl bg-[hsl(var(--primary))]">
               <CameraIcon className="w-8 h-8" />
               Enable Camera
              </Button>
            </div>

            <p className="text-xs text-center max-w-xs bg-[hsl(var(--popover))]">Works in browser — opens front or rear camera. On iPhone, use Safari for full access.

          </p>
          </motion.div>
        }
      </AnimatePresence>

      {/* Pro modal */}
      <AnimatePresence>
        {showProModal && <ProModal onClose={handleProModalClose} context="record" />}
      </AnimatePresence>

      {/* ── LIVE VIEW ── */}
      {isActive &&
      <>
          {/* Recording border pulse */}
          {isRecording &&
        <div className="absolute inset-0 z-20 pointer-events-none rounded-none border-4 border-red-500 animate-pulse" />
        }

          {/* Full-screen canvas */}
          <div className="absolute inset-0">
            <RenderCanvas
            videoRef={videoRef}
            getFrame={getFrame}
            delayOffset={delayOffset}
            ghostEnabled={ghostActive}
            ghostInterval={ghostInterval}
            ghostCount={ghostCount}
            ghostOpacity={ghostOpacity}
            isActive={isActive}
            isPro={isPro}
            canvasRefOut={canvasRef} />
          
          </div>

          {/* ── TOASTS ── */}
          <AnimatePresence>
            {savedClip &&
          <motion.div
            key="saved-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/20 text-white text-sm font-mono whitespace-nowrap">
                <Film className="w-4 h-4 text-primary" />
                Clip saved!
                <button onClick={() => {switchTab('/gallery');navigate('/gallery');}} className="text-primary underline text-xs">View Gallery</button>
              </motion.div>
          }
            {uploadStatus === 'uploading' &&
          <motion.div
            key="upload-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/20 text-white text-sm font-mono whitespace-nowrap">
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving to gallery…
              </motion.div>
          }
            {uploadStatus === 'error' &&
          <motion.div
            key="error-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-900/80 backdrop-blur-md border border-red-500/40 text-white text-sm font-mono">
                ⚠ {uploadError || 'Upload failed. Check console for details.'}
              </motion.div>
          }
          </AnimatePresence>

          {/* ── TOP HUD — portrait only ── */}
          {!isLandscape && <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-5 pb-6"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)', paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}>

            {/* Left: status + gallery */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-mono text-white/80 uppercase tracking-widest">
                  {loopEnabled ? 'LOOP' : isDelayed ? 'DELAYED' : 'LIVE'}
                </span>
                <button onClick={() => {switchTab('/gallery');navigate('/gallery');}}
              className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/70 text-[10px] font-mono hover:bg-white/20 transition-colors">
                  <Film className="w-2.5 h-2.5" />GALLERY
                </button>
              </div>
              {isDelayed &&
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10">
              
                  <span className="text-sm font-mono text-white">−{delaySeconds}s</span>
                </motion.div>
            }
            </div>

            {/* Right: record + flip + stop */}
            <div className="flex items-center gap-2">
              {/* Record button */}
              <button
              onClick={isRecording ? stopRecording : handleRecordPress}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border font-mono text-xs transition-all active:scale-95 ${
              isRecording ?
              'bg-red-500/80 border-red-400/60 text-white' :
              'bg-white/10 border-white/20 text-white/80'}`
              }>
                {isRecording ?
              <>
                    <Square className="w-3 h-3 fill-white" />
                    <span className="tabular-nums">
                      {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}
                    </span>
                  </> :
              <>
                    <Circle className="w-3 h-3 fill-red-400 text-red-400" />
                    REC
                  </>
              }
              </button>

              {/* Switch camera — compact icon */}
              <button
              onClick={handleSwitchCamera}
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition-all">
                <SwitchCamera className="w-4 h-4 text-white" />
              </button>

              <button
              onClick={handleStop}
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition-transform">
                <CameraOff className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>}

          {/* ── BUFFER PROGRESS BAR ── */}
          <div className="absolute top-0 left-0 right-0 z-20 h-0.5">
            <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${fillPercent}%` }} />
          
          </div>

          {/* ── CONTROLS PANEL — adapts portrait/landscape ── */}
          {isLandscape ?
        <>
            {/* ── LANDSCAPE LEFT: Record + Camera + Stop ── */}
            <div className="absolute left-0 top-0 bottom-0 z-30 flex flex-col items-center justify-center gap-4 px-2 pointer-events-auto"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.82) 0%, transparent 100%)', width: '70px' }}>
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[6px] font-mono text-white/50 uppercase tracking-widest text-center leading-tight">
                  {loopEnabled ? 'LOOP' : isDelayed ? 'DLY' : 'LIVE'}
                </span>
              </div>
              <button
              onClick={isRecording ? stopRecording : handleRecordPress}
              disabled={uploadStatus === 'uploading'}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-full backdrop-blur-md border font-mono transition-all active:scale-95 disabled:opacity-50 pointer-events-auto ${
              isRecording ? 'bg-red-500/80 border-red-400/60 text-white' : 'bg-white/15 border-white/30 text-white/80'}`
              }>
              
                {isRecording ?
              <>
                    <Square className="w-3.5 h-3.5 fill-white mb-0.5" />
                    <span className="tabular-nums text-[7px]">
                      {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}
                    </span>
                  </> :

              <Circle className="w-5 h-5 fill-red-400 text-red-400" />
              }
              </button>
              <button
              onClick={handleSwitchCamera}
              className="flex flex-col items-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-[8px] font-mono overflow-hidden active:scale-95 transition-all pointer-events-auto">
              
                <span className={`px-3 py-1 w-full text-center transition-colors ${facingMode === 'environment' ? 'bg-white text-black' : 'text-white/50'}`}>R</span>
                <span className={`px-3 py-1 w-full text-center transition-colors ${facingMode === 'user' ? 'bg-white text-black' : 'text-white/50'}`}>F</span>
              </button>
              <button
              onClick={handleStop}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition-transform pointer-events-auto">
              
                <CameraOff className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* ── LANDSCAPE RIGHT: Sliders ── */}
            <div className="absolute right-0 top-0 bottom-0 z-30"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.82) 0%, transparent 100%)', width: '158px' }}>
              <div className="h-full px-3 space-y-2 overflow-y-auto overscroll-contain pointer-events-none"
            style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}>
                <div className="space-y-1 pointer-events-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-[7px] font-mono uppercase tracking-widest text-white/40">Scrub</span>
                    <div className="flex items-center gap-1">
                      {isDelayed &&
                    <button onClick={() => setDelayOffset(0)}
                    className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-accent/20 border border-accent/30 text-accent text-[7px] font-mono pointer-events-auto">
                          <Play className="w-1.5 h-1.5" />L
                        </button>
                    }
                      <span className="text-[7px] font-mono text-white tabular-nums">{isDelayed ? `−${delaySeconds}s` : 'live'}</span>
                    </div>
                  </div>
                  <div className="pointer-events-auto"><ScrubBar value={delayOffset} max={Math.max(1, bufferFill - 1)} onChange={setDelayOffset} bufferFill={bufferFill} maxBufferSize={maxBufferSize} /></div>
                </div>
                <button onClick={toggleLoop}
              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[8px] font-mono transition-all pointer-events-auto ${loopEnabled ? 'bg-accent/30 border-accent/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  <Repeat2 className="w-2.5 h-2.5" />Loop
                </button>
                {loopEnabled &&
              <div className="space-y-1.5">
                    <div className="pointer-events-auto">
                      <CompactSlider label="D" valueLabel={`${(loopDepth / 30).toFixed(1)}s`} value={loopDepth} min={5} max={Math.max(5, bufferFill - 1)} step={1} onChange={setLoopDepth} />
                      <CompactSlider label="S" valueLabel={`${loopSpeed}x`} value={loopSpeed} min={0.25} max={4} step={0.25} onChange={setLoopSpeed} />
                    </div>
                  </div>
              }
                <button onClick={toggleGhost}
              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[8px] font-mono transition-all pointer-events-auto ${ghostEnabled ? 'bg-primary/30 border-primary/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  <Layers className="w-2.5 h-2.5" />
                  {ghostCountdown !== null ? `Ghost ${ghostCountdown}s` : 'Ghost'}
                </button>
                {ghostEnabled &&
              <div className="space-y-1.5">
                    <CompactSlider label="I" valueLabel={`${ghostInterval}f`} value={ghostInterval} min={1} max={30} step={1} onChange={setGhostInterval} />
                    <CompactSlider label="L" valueLabel={`${ghostCount}`} value={ghostCount} min={2} max={4} step={1} onChange={setGhostCount} />
                    <CompactSlider label="O" valueLabel={`${Math.round(ghostOpacity * 100)}%`} value={ghostOpacity} min={0.05} max={1} step={0.05} onChange={setGhostOpacity} />
                  </div>
              }
                <button onClick={() => {if (isRecording) {alert('Stop recording before viewing gallery'); return;} switchTab('/gallery');navigate('/gallery');}}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-white/5 border-white/10 text-white/40 text-[8px] font-mono pointer-events-auto">
                  <Film className="w-2.5 h-2.5" />Gallery
                </button>
              </div>
            </div>
          </> : (

        /* ── PORTRAIT: bottom panel ── */
        <div className="absolute bottom-0 left-0 right-0 z-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)', maxHeight: '65vh', display: 'flex', flexDirection: 'column' }}>
              <div className="overflow-y-auto overscroll-contain px-5 pt-8 space-y-5" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom) + 56px)' }}>
                {/* Scrub */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-white/40" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Scrub</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDelayed &&
                  <button onClick={() => setDelayOffset(0)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/20 border border-accent/30 text-accent text-[10px] font-mono">
                          <Play className="w-2.5 h-2.5" />LIVE
                        </button>
                  }
                      <span className="text-sm font-mono text-white tabular-nums">{isDelayed ? `−${delaySeconds}s` : 'live'}</span>
                    </div>
                  </div>
                  <ScrubBar value={delayOffset} max={Math.max(1, bufferFill - 1)} onChange={setDelayOffset} bufferFill={bufferFill} maxBufferSize={maxBufferSize} />
                  <div className="flex justify-between text-[9px] font-mono text-white/25 px-0.5">
                    <span>−{(Math.max(1, bufferFill - 1) / 30).toFixed(1)}s</span>
                    <span>now</span>
                  </div>
                </div>
                {/* Loop (ping-pong) controls */}
                 <div className="space-y-3">
                   <button onClick={toggleLoop}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${loopEnabled ? 'bg-accent/30 border-accent/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                     <Repeat2 className="w-3.5 h-3.5" />
                     Loop
                   </button>
                   <AnimatePresence>
                     {loopEnabled &&
                <motion.div key="loop-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                         <div className="space-y-3 pt-1">
                           <GhostSliderRow label="Depth" valueLabel={`${(loopDepth / 30).toFixed(1)}s`} value={loopDepth} min={5} max={Math.max(5, bufferFill - 1)} step={1} onChange={setLoopDepth} />
                           <GhostSliderRow label="Speed" valueLabel={`${loopSpeed}x`} value={loopSpeed} min={0.25} max={4} step={0.25} onChange={setLoopSpeed} />
                         </div>
                       </motion.div>
                }
                   </AnimatePresence>
                 </div>

                 {/* Ghost controls */}
                 <div className="space-y-3">
                   <div className="flex items-center justify-between">
                     <button onClick={toggleGhost}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${ghostEnabled ? 'bg-primary/30 border-primary/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                       <Layers className="w-3.5 h-3.5" />
                       {ghostCountdown !== null ? `Ghost in ${ghostCountdown}s…` : 'Ghost Blend'}
                     </button>
                     <button onClick={handleStop}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center active:scale-95 transition-transform">
                       <CameraOff className="w-4 h-4 text-white/70" />
                     </button>
                   </div>
                   <AnimatePresence>
                     {ghostEnabled &&
                <motion.div key="ghost-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                         <div className="space-y-3 pt-1">
                           <GhostSliderRow label="Delay" valueLabel={ghostDelay === 0 ? 'off' : `${ghostDelay}s`} value={ghostDelay} min={0} max={10} step={1} onChange={setGhostDelay} />
                           <GhostSliderRow label="Interval" valueLabel={`${ghostInterval}f`} value={ghostInterval} min={1} max={30} step={1} onChange={setGhostInterval} />
                           <GhostSliderRow label="Layers" valueLabel={`${ghostCount}`} value={ghostCount} min={2} max={4} step={1} onChange={setGhostCount} />
                           <GhostSliderRow label="Opacity" valueLabel={`${Math.round(ghostOpacity * 100)}%`} value={ghostOpacity} min={0.05} max={1} step={0.05} onChange={setGhostOpacity} />
                         </div>
                       </motion.div>
                }
                   </AnimatePresence>
                 </div>
              </div>
            </div>)
        }
        </>
      }

      {/* Hidden video element */}
      <video ref={videoRef} playsInline muted className="hidden" />
    </div>);

}

function GhostSliderRow({ label, valueLabel, value, min, max, step, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 w-14 shrink-0">{label}</span>
      <div className="flex-1">
        <ControlSlider value={value} min={min} max={max} step={step} onChange={onChange} />
      </div>
      <span className="text-xs font-mono text-white/60 w-10 text-right shrink-0 tabular-nums">{valueLabel}</span>
    </div>);

}

function CompactSlider({ label, valueLabel, value, min, max, step, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 w-6 shrink-0">{label}</span>
      <div className="flex-1">
        <ControlSlider value={value} min={min} max={max} step={step} onChange={onChange} />
      </div>
      <span className="text-[8px] font-mono text-white/60 w-8 text-right shrink-0 tabular-nums">{valueLabel}</span>
    </div>);

}
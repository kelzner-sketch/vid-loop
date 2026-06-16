import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Camera as CameraIcon, CameraOff, Layers, Clock, Eye, Play, Circle, Square, Download, SwitchCamera, Repeat2, Film, Shuffle } from 'lucide-react';
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
import { useFFmpegConvert } from '@/components/video/useFFmpegConvert';


export default function Camera() {
  const navigate = useNavigate();
  const { switchTab } = useTabNav();
  const { isRecording, setIsRecording } = useRecording();
  const { videoRef, isActive, error, start, stop } = useCamera();
  const { pushFrame, getFrame, getBufferLength, clearBuffer, maxBufferSize } = useFrameBuffer();
  const { convert } = useFFmpegConvert();

  const { user } = useAuth();

  // Load persisted prefs from localStorage or database
  const loadPrefs = () => {
    try {return JSON.parse(localStorage.getItem('vidloop_prefs') || '{}');} catch {return {};}
  };
  const prefs = loadPrefs();

  const [facingMode, setFacingMode] = useState(prefs.facingMode ?? 'environment');
  const [delayOffset, setDelayOffset] = useState(15);
  const delayOffsetRef = useRef(15);
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

  // Chaos mode
  const [chaosEnabled, setChaosEnabled] = useState(false);
  const [chaosIntensity, setChaosIntensity] = useState(0.5); // 0–1
  const chaosEnabledRef = useRef(false);
  const chaosIntensityRef = useRef(0.5);
  const chaosTimerRef = useRef(null);

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
      facingMode, loopDepth, loopSpeed,
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
  chaosEnabledRef.current = chaosEnabled;
  chaosIntensityRef.current = chaosIntensity;

  // Chaos — randomly jumps the scrub position to a random spot in the buffer,
  // holds it briefly, then releases. Intensity controls frequency of jumps.
  useEffect(() => {
    if (!chaosEnabled) {
      clearTimeout(chaosTimerRef.current);
      return;
    }
    const scheduleChaos = () => {
      const intensity = chaosIntensityRef.current;
      // Time between jumps: high intensity = more frequent (80ms–1500ms)
      const gapMs = 80 + (1 - intensity) * 1420;

      chaosTimerRef.current = setTimeout(() => {
        if (!chaosEnabledRef.current) return;
        const buf = getBufferLength();
        if (buf > 2) {
          // Jump to a random position in the buffer
          const jump = Math.floor(1 + Math.random() * (buf - 1));
          delayOffsetRef.current = jump;
          setDelayOffset(jump);
          // Hold it briefly then release back to the loop
          const holdMs = 60 + Math.random() * 300;
          chaosTimerRef.current = setTimeout(() => {
            if (!chaosEnabledRef.current) return;
            // Snap back to wherever the loop is now
            delayOffsetRef.current = loopStateRef.current.pos;
            scheduleChaos();
          }, holdMs);
        } else {
          scheduleChaos();
        }
      }, gapMs);
    };
    scheduleChaos();
    return () => clearTimeout(chaosTimerRef.current);
  }, [chaosEnabled, getBufferLength]);

  // Backward-only loop — sweeps from 0 → loopDepth, then snaps back to 0 and repeats
  useEffect(() => {
    if (!loopEnabled) {
      if (loopRafRef.current) cancelAnimationFrame(loopRafRef.current);
      return;
    }
    const tick = () => {
      if (!loopEnabledRef.current) return;
      const state = loopStateRef.current;
      state.pos += loopSpeed;
      if (state.pos >= loopDepth) {
        state.pos = 0; // snap back to live and rewind again
      }
      const rounded = Math.round(state.pos);
      delayOffsetRef.current = rounded;
      // Throttle React state updates to ~10fps to avoid re-render jitter
      if (!tick._lastUpdate || performance.now() - tick._lastUpdate > 100) {
        tick._lastUpdate = performance.now();
        setDelayOffset(rounded);
      }
      loopRafRef.current = requestAnimationFrame(tick);
    };
    loopStateRef.current = { pos: 0 };
    loopRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (loopRafRef.current) cancelAnimationFrame(loopRafRef.current);
    };
  }, [loopEnabled, loopDepth, loopSpeed]);

  const setDelay = (v) => {delayOffsetRef.current = v;setDelayOffset(v);};

  const toggleLoop = () => {
    setLoopEnabled((prev) => {
      if (prev) {
        // turning off — snap back to live and stop chaos
        setDelay(0);
        setChaosEnabled(false);
      }
      return !prev;
    });
  };

  const toggleChaos = () => {
    setChaosEnabled((prev) => !prev);
  };

  // Track orientation changes — just update layout flag
  useEffect(() => {
    let timer;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLandscape(window.innerWidth > window.innerHeight);
      }, 200);
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
    stop();
    clearBuffer();
    setBufferFill(0);
    setDelay(0);
    // Reset loop to on so it's ready next time camera starts
    setLoopEnabled(true);
    setChaosEnabled(false);
  };

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create recording canvas: 16:9 aspect ratio
    const recordCanvas = document.createElement('canvas');
    recordCanvas.width = 720; // HD
    recordCanvas.height = 405; // 16:9 aspect ratio
    const rctx = recordCanvas.getContext('2d');

    // Fill with black (for letterboxing)
    rctx.fillStyle = '#000000';
    rctx.fillRect(0, 0, recordCanvas.width, recordCanvas.height);

    // Mirror the main canvas into recording canvas with crop-to-fill (no black bars)
    const mirrorLoop = () => {
      const srcAspect = canvas.width / canvas.height;
      const destAspect = recordCanvas.width / recordCanvas.height;
      let sx, sy, sw, sh;

      if (srcAspect > destAspect) {
        // Source is wider: crop left/right
        sw = canvas.height * destAspect;
        sh = canvas.height;
        sx = (canvas.width - sw) / 2;
        sy = 0;
      } else {
        // Source is taller: crop top/bottom
        sw = canvas.width;
        sh = canvas.width / destAspect;
        sx = 0;
        sy = (canvas.height - sh) / 2;
      }

      rctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, recordCanvas.width, recordCanvas.height);
      mirrorRafRef.current = requestAnimationFrame(mirrorLoop);
    };
    mirrorRafRef.current = requestAnimationFrame(mirrorLoop);

    if (!recordCanvas) {
      console.error('Canvas not available for recording');
      return;
    }
    const stream = recordCanvas.captureStream(30);
    if (!stream) {
      console.error('Failed to capture stream from canvas');
      return;
    }
    const mimeType =
    MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' :
    MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' :
    '';
    console.log('[Record] mimeType selected:', mimeType || '(empty - browser default)');
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 2_500_000 });
    recordingChunksRef.current = [];
    recorder.ondataavailable = (e) => {if (e.data.size > 0) recordingChunksRef.current.push(e.data);};

    recorder.onstop = async () => {
      const actualMimeType = recorder.mimeType || mimeType || 'video/webm';
      console.log('[Record] actual recorder mimeType:', actualMimeType);
      let finalBlob = new Blob(recordingChunksRef.current, { type: actualMimeType });
      let finalType = actualMimeType;
      let finalExt = actualMimeType.includes('mp4') ? 'mp4' : 'webm';

      setUploadStatus('uploading');
      const timestamp = Date.now();
      const fileName = `vid-loop-${timestamp}.${finalExt}`;

      try {
        // Upload directly from frontend to avoid large base64 payloads through backend
        const file = new File([finalBlob], fileName, { type: finalType });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        const clip = await base44.entities.Clip.create({
          title: `Clip ${new Date().toLocaleTimeString()}`,
          file_url,
          duration: recordingTimerRef._lastTime || 0
        });

        setUploadStatus(null);
        setSavedClip({ url: file_url });
        window.dispatchEvent(new CustomEvent('clip-saved', { detail: clip }));
        setTimeout(() => setSavedClip(null), 5000);
      } catch (e) {
        console.error('Gallery save failed:', e);
        setUploadStatus('error');
        setUploadError(e?.message || e?.toString());
        setTimeout(() => setUploadStatus(null), 8000);
      }
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
  }, [base44]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    if (mirrorRafRef.current) cancelAnimationFrame(mirrorRafRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const handleRecordPress = useCallback((e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  }, [startRecording, isRecording, stopRecording]);

  const delaySeconds = (delayOffset / 30).toFixed(2);
  const fillPercent = Math.round(bufferFill / maxBufferSize * 100);
  const isDelayed = delayOffset > 0;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#233c5c]" style={isLandscape ? { height: '100vh', top: 0, maxHeight: '100vh' } : { top: 0 }}>

      {/* ── IDLE SCREEN ── */}
      <AnimatePresence>
        {!isActive &&
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex flex-col items-center bg-[hsl(var(--popover))] overflow-y-auto overscroll-contain">
          
            <div className="flex flex-col items-center gap-6 px-8 py-10 w-full min-h-full justify-center bg-[#000000]">
              {/* Logo mark */}
              <div className="relative">
                <img src="https://media.base44.com/images/public/6a2067de3230ec7bd237c422/80f561db9_vid-loop-icon.png" alt="VidLoop" className="w-20 h-20" />
              </div>

              <div className="text-center space-y-2">
                <h1 className="tracking-tight text-foreground lowercase text-center text-4xl [font-family:'Urbanist',_sans-serif] font-light">vid-loop</h1>
                <p className="text-sm leading-relaxed max-w-xs">Live camera tool that lets you scrub back through the last few seconds of footage, layer motion ghost trails, and loop clips in a ping-pong effect. Record and share directly from your phone.</p>
              </div>

              <div className="w-full max-w-xs space-y-3">
                {error &&
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-xl text-center">{error}</p>
              }
                <Button onClick={handleStart} size="lg" className="w-full gap-2 h-14 rounded-2xl lowercase text-center text-xl bg-[hsl(var(--primary))]">
                  <CameraIcon className="w-8 h-8" />
                  Enable Camera
                </Button>
              </div>


            </div>
          </motion.div>
        }
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
            delayOffsetRef={delayOffsetRef}
            ghostEnabled={ghostActive}
            ghostInterval={ghostInterval}
            ghostCount={ghostCount}
            isActive={isActive}
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
            {uploadStatus === 'converting' &&
          <motion.div
            key="convert-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/20 text-white text-sm font-mono whitespace-nowrap">
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Converting to MP4…
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
              onClick={(e) => {e.preventDefault();e.stopPropagation();handleRecordPress(e);}}
              disabled={uploadStatus === 'uploading'}
              type="button"
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
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.82) 0%, transparent 100%)', width: '240px' }}>
              <div className="h-full px-4 space-y-3 overflow-y-auto overscroll-contain"
            style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
                <div className="space-y-2 pointer-events-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-widest text-white/40">Scrub</span>
                    <div className="flex items-center gap-1.5">
                      {isDelayed &&
                    <button onClick={() => setDelay(0)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-accent/20 border border-accent/30 text-accent text-xs font-mono pointer-events-auto">
                          <Play className="w-2 h-2" />L
                        </button>
                    }
                      <span className="text-xs font-mono text-white tabular-nums">{isDelayed ? `−${delaySeconds}s` : 'live'}</span>
                    </div>
                  </div>
                  <ScrubBar value={delayOffset} max={Math.max(1, bufferFill - 1)} onChange={setDelay} bufferFill={bufferFill} maxBufferSize={maxBufferSize} />
                </div>
                <button onClick={toggleLoop}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all pointer-events-auto ${loopEnabled ? 'bg-accent/30 border-accent/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  <Repeat2 className="w-3.5 h-3.5" />Loop
                </button>
                {loopEnabled &&
              <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-widest text-white/40 w-8 shrink-0">D</span>
                      <div className="flex-1">
                        <ControlSlider value={loopDepth} min={5} max={Math.max(5, bufferFill - 1)} step={1} onChange={setLoopDepth} />
                      </div>
                      <span className="text-xs font-mono text-white/60 w-12 text-right shrink-0 tabular-nums">{(loopDepth / 30).toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-widest text-white/40 w-8 shrink-0">S</span>
                      <div className="flex-1">
                        <ControlSlider value={loopSpeed} min={0.25} max={4} step={0.25} onChange={setLoopSpeed} />
                      </div>
                      <span className="text-xs font-mono text-white/60 w-12 text-right shrink-0 tabular-nums">{loopSpeed}x</span>
                    </div>
                    <button onClick={toggleChaos}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all pointer-events-auto ${chaosEnabled ? 'bg-destructive/40 border-destructive/60 text-white animate-pulse' : 'bg-white/5 border-white/10 text-white/40'}`}>
                      <Shuffle className="w-3.5 h-3.5" />Chaos
                    </button>
                    {chaosEnabled &&
                <div className="flex items-center gap-2">
                        <span className="text-xs font-mono uppercase tracking-widest text-white/40 w-8 shrink-0">~</span>
                        <div className="flex-1">
                          <ControlSlider value={chaosIntensity} min={0.1} max={1} step={0.1} onChange={setChaosIntensity} />
                        </div>
                        <span className="text-xs font-mono text-white/60 w-12 text-right shrink-0 tabular-nums">{Math.round(chaosIntensity * 100)}%</span>
                      </div>
                }
                  </div>
              }
                <button onClick={toggleGhost}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all pointer-events-auto ${ghostEnabled ? 'bg-primary/30 border-primary/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  <Layers className="w-3.5 h-3.5" />
                  {ghostCountdown !== null ? `Ghost ${ghostCountdown}s` : 'Ghost'}
                </button>
                {ghostEnabled &&
              <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-widest text-white/40 w-8 shrink-0">I</span>
                      <div className="flex-1">
                        <ControlSlider value={ghostInterval} min={1} max={30} step={1} onChange={setGhostInterval} />
                      </div>
                      <span className="text-xs font-mono text-white/60 w-12 text-right shrink-0 tabular-nums">{ghostInterval}f</span>
                    </div>
                    <div className="flex items-center gap-2">
                     <span className="text-xs font-mono uppercase tracking-widest text-white/40 w-8 shrink-0">L</span>
                     <div className="flex-1">
                       <ControlSlider value={ghostCount} min={2} max={4} step={1} onChange={setGhostCount} />
                     </div>
                     <span className="text-xs font-mono text-white/60 w-12 text-right shrink-0 tabular-nums">{ghostCount}</span>
                    </div>
                    </div>
              }
                <button onClick={() => {if (isRecording) {alert('Stop recording before viewing gallery');return;}switchTab('/gallery');navigate('/gallery');}}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-white/5 border-white/10 text-white/40 text-xs font-mono pointer-events-auto">
                  <Film className="w-3.5 h-3.5" />Gallery
                </button>
              </div>
            </div>
          </> : (

        /* ── PORTRAIT: bottom panel ── */
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-auto" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)', maxHeight: '65vh', display: 'flex', flexDirection: 'column' }}>
              <div className="overflow-y-auto overscroll-contain px-5 pt-8 space-y-5 pointer-events-auto" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom) + 56px)' }}>
                {/* Scrub */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-white/40" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Scrub</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDelayed &&
                  <button onClick={() => setDelay(0)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/20 border border-accent/30 text-accent text-[10px] font-mono">
                          <Play className="w-2.5 h-2.5" />LIVE
                        </button>
                  }
                      <span className="text-sm font-mono text-white tabular-nums">{isDelayed ? `−${delaySeconds}s` : 'live'}</span>
                    </div>
                  </div>
                  <ScrubBar value={delayOffset} max={Math.max(1, bufferFill - 1)} onChange={setDelay} bufferFill={bufferFill} maxBufferSize={maxBufferSize} />
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
                   {loopEnabled &&
              <motion.div key="loop-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden pointer-events-auto">
                         <div className="space-y-3 pt-1">
                           <GhostSliderRow label="Depth" valueLabel={`${(loopDepth / 30).toFixed(1)}s`} value={loopDepth} min={5} max={Math.max(5, bufferFill - 1)} step={1} onChange={setLoopDepth} />
                           <GhostSliderRow label="Speed" valueLabel={`${loopSpeed}x`} value={loopSpeed} min={0.25} max={4} step={0.25} onChange={setLoopSpeed} />
                           <div className="flex items-center gap-2 pt-1">
                             <button onClick={toggleChaos}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${chaosEnabled ? 'bg-destructive/40 border-destructive/60 text-white animate-pulse' : 'bg-white/5 border-white/10 text-white/40'}`}>
                               <Shuffle className="w-3.5 h-3.5" />Chaos
                             </button>
                             {chaosEnabled &&
                    <div className="flex-1">
                                 <ControlSlider value={chaosIntensity} min={0.1} max={1} step={0.1} onChange={setChaosIntensity} />
                               </div>
                    }
                           </div>
                         </div>
                   </motion.div>
              }
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
                    {ghostEnabled &&
              <motion.div key="ghost-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden pointer-events-auto">
                          <div className="space-y-3 pt-1">
                            <GhostSliderRow label="Interval" valueLabel={`${ghostInterval}f`} value={ghostInterval} min={1} max={30} step={1} onChange={setGhostInterval} />
                            <GhostSliderRow label="Layers" valueLabel={`${ghostCount}`} value={ghostCount} min={2} max={4} step={1} onChange={setGhostCount} />
                          </div>
                    </motion.div>
              }
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
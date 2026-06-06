import React, { useRef, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import MobileHeader from '@/components/MobileHeader';
import ControlSlider from '@/components/video/ControlSlider';
import RenderCanvas from '@/components/video/RenderCanvas';
import ScrubBar from '@/components/video/ScrubBar';
import useCamera from '@/components/video/useCamera';
import useFrameBuffer from '@/components/video/useFrameBuffer';
import StatusBadge from '@/components/video/StatusBadge';
import { useRecording } from '@/lib/RecordingContext';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recordingCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const frameBufferRef = useRef(useFrameBuffer(300));

  const { user } = useAuth();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const { setRecordingStatus } = useRecording();

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Effect controls
  const [delayOffset, setDelayOffset] = useState(0);
  const [ghostEnabled, setGhostEnabled] = useState(true);
  const [ghostDelay, setGhostDelay] = useState(0);
  const [ghostInterval, setGhostInterval] = useState(4);
  const [ghostCount, setGhostCount] = useState(6);
  const [ghostOpacity, setGhostOpacity] = useState(0.8);

  // Persistent settings
  const [persistedGhostEnabled, setPersistedGhostEnabled] = useState(true);
  const [persistedLoopEnabled, setPersistedLoopEnabled] = useState(true);

  // Load persisted settings
  useEffect(() => {
    if (user) {
      base44.auth.me().then(userData => {
        if (userData?.ghostEnabled !== undefined) setPersistedGhostEnabled(userData.ghostEnabled);
        if (userData?.loopEnabled !== undefined) setPersistedLoopEnabled(userData.loopEnabled);
        setGhostEnabled(userData?.ghostEnabled ?? true);
      });
    } else {
      const saved = localStorage.getItem('ghostSettings');
      if (saved) {
        const { ghostEnabled: ge, loopEnabled: le } = JSON.parse(saved);
        setPersistedGhostEnabled(ge ?? true);
        setPersistedLoopEnabled(le ?? true);
        setGhostEnabled(ge ?? true);
      }
    }
  }, [user]);

  // Save settings
  const saveSettings = (ghostEn, loopEn) => {
    if (user) {
      base44.auth.updateMe({ ghostEnabled: ghostEn, loopEnabled: loopEn }).catch(() => {});
    } else {
      localStorage.setItem('ghostSettings', JSON.stringify({ ghostEnabled: ghostEn, loopEnabled: loopEn }));
    }
  };

  const { cameraActive, cameraError, startCamera, stopCamera } = useCamera(videoRef);

  // Setup recording canvas stream
  useEffect(() => {
    if (!recordingCanvasRef.current || !isRecording) return;
    const recordingStream = recordingCanvasRef.current.captureStream(30);
    streamRef.current = recordingStream;

    const mediaRecorder = new MediaRecorder(recordingStream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = e => chunksRef.current.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
        await base44.entities.Clip.create({
          title: `Recording ${new Date().toLocaleString()}`,
          file_url,
          duration: recordingTime / 1000,
        });
      } catch (error) {
        console.error('Upload failed:', error);
      }
    };

    mediaRecorder.start();
    return () => {
      if (mediaRecorder.state === 'recording') mediaRecorder.stop();
    };
  }, [isRecording, recordingTime]);

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordingTime(t => t + 100);
    }, 100);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !videoRef.current) return;
    const animationId = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setCurrentTime(t => {
        const next = t + 1 / 30;
        if (next >= duration) return persistedLoopEnabled ? 0 : duration;
        return next;
      });
    }, 1000 / 30);
    return () => clearInterval(animationId);
  }, [isPlaying, duration, persistedLoopEnabled]);

  // Update frame buffer with delay
  useEffect(() => {
    const frameBuffer = frameBufferRef.current;
    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        frameBuffer.addFrame(videoRef.current);
      }
    }, 1000 / 30);
    return () => clearInterval(interval);
  }, []);

  const getFrame = (delayMs) => {
    const frameIndex = Math.max(0, frameBufferRef.current.length - Math.round(delayMs * 30 / 1000));
    return frameBufferRef.current.getFrame(frameIndex);
  };

  const handleStartRecording = async () => {
    if (!cameraActive) {
      try {
        await startCamera();
      } catch (error) {
        console.error('Camera error:', error);
        return;
      }
    }
    setIsRecording(true);
    setRecordingTime(0);
    setRecordingStatus(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setRecordingStatus(false);
  };

  const handlePlayPause = () => {
    if (!duration) return;
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 landscape:flex-row">
      <MobileHeader />

      <div className="flex-1 flex flex-col landscape:flex-row gap-4 p-4 landscape:p-6 landscape:pt-20">
        {/* Canvas/Preview */}
        <div className="flex-1 flex flex-col landscape:w-2/3">
          <div className="relative bg-black rounded-lg overflow-hidden flex-1 shadow-2xl">
            <RenderCanvas
              videoRef={videoRef}
              getFrame={getFrame}
              delayOffset={delayOffset}
              ghostEnabled={ghostEnabled}
              ghostInterval={ghostInterval}
              ghostCount={ghostCount}
              ghostOpacity={ghostOpacity}
              isActive={isRecording || isPlaying}
              canvasRefOut={recordingCanvasRef}
            />
            {cameraError && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <p className="text-red-400 text-sm">{cameraError}</p>
              </div>
            )}
            <StatusBadge isRecording={isRecording} recordingTime={recordingTime} />
          </div>

          {/* Playback controls - only show when not recording */}
          {!isRecording && duration > 0 && (
            <div className="mt-4 space-y-3">
              <ScrubBar currentTime={currentTime} duration={duration} onScrub={setCurrentTime} />
              <div className="flex items-center justify-center gap-2 text-sm text-white/60 font-medium">
                <span>{Math.floor(currentTime)}s</span>
                <span>/</span>
                <span>{Math.floor(duration)}s</span>
              </div>
              <button
                onClick={handlePlayPause}
                className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:bg-primary/90"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
          )}
        </div>

        {/* Controls - Right Panel */}
        <div className="landscape:w-2/5 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto landscape:overflow-y-visible landscape:max-h-none">
          {/* Record button */}
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`w-full py-4 rounded-lg font-semibold text-lg transition ${
              isRecording
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>

          {/* Ghost Effect Toggle */}
          <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-lg font-semibold text-white">Ghost Effect</label>
              <button
                onClick={() => {
                  const newState = !ghostEnabled;
                  setGhostEnabled(newState);
                  setPersistedGhostEnabled(newState);
                  saveSettings(newState, persistedLoopEnabled);
                }}
                className={`px-4 py-2 rounded text-sm font-semibold ${
                  ghostEnabled ? 'bg-primary text-primary-foreground' : 'bg-slate-600 text-white'
                }`}
              >
                {ghostEnabled ? 'On' : 'Off'}
              </button>
            </div>

            {ghostEnabled && (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-base font-medium">Delay</span>
                    <span className="text-sm text-white/70">{ghostDelay === 0 ? 'off' : `${ghostDelay}s`}</span>
                  </div>
                  <ControlSlider value={ghostDelay} min={0} max={10} step={1} onChange={setGhostDelay} />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-base font-medium">Interval</span>
                    <span className="text-sm text-white/70">{ghostInterval}f</span>
                  </div>
                  <ControlSlider value={ghostInterval} min={1} max={30} step={1} onChange={setGhostInterval} />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-base font-medium">Layers</span>
                    <span className="text-sm text-white/70">{ghostCount}</span>
                  </div>
                  <ControlSlider value={ghostCount} min={2} max={10} step={1} onChange={setGhostCount} />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-base font-medium">Opacity</span>
                    <span className="text-sm text-white/70">{Math.round(ghostOpacity * 100)}%</span>
                  </div>
                  <ControlSlider value={ghostOpacity} min={0.05} max={1} step={0.05} onChange={setGhostOpacity} />
                </div>
              </div>
            )}
          </div>

          {/* Delay Offset */}
          <div className="bg-slate-800/50 rounded-lg p-6">
            <div className="flex justify-between mb-2">
              <label className="text-lg font-semibold text-white">Delay Offset</label>
              <span className="text-sm text-white/70">{delayOffset}ms</span>
            </div>
            <ControlSlider value={delayOffset} min={0} max={500} step={10} onChange={setDelayOffset} />
          </div>

          {/* Loop Playback */}
          <div className="bg-slate-800/50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <label className="text-lg font-semibold text-white">Loop Playback</label>
              <button
                onClick={() => {
                  const newState = !persistedLoopEnabled;
                  setPersistedLoopEnabled(newState);
                  saveSettings(persistedGhostEnabled, newState);
                }}
                className={`px-4 py-2 rounded text-sm font-semibold ${
                  persistedLoopEnabled ? 'bg-primary text-primary-foreground' : 'bg-slate-600 text-white'
                }`}
              >
                {persistedLoopEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      </div>
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

function CompactSlider({ label, valueLabel, value, min, max, step, onChange, compact }) {
  return (
    <div className={`flex items-center gap-${compact ? '1' : '2'}`}>
      <span className={`font-mono uppercase tracking-widest text-white/40 shrink-0 ${compact ? 'text-[5px] w-4' : 'text-[8px] w-6'}`}>{label}</span>
      <div className="flex-1">
        <ControlSlider value={value} min={min} max={max} step={step} onChange={onChange} />
      </div>
      <span className={`font-mono text-white/60 text-right shrink-0 tabular-nums ${compact ? 'text-[5px] w-6' : 'text-[8px] w-8'}`}>{valueLabel}</span>
    </div>
  );
}
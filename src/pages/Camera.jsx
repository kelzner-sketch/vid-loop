import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useCamera from '@/components/video/useCamera';
import RenderCanvas from '@/components/video/RenderCanvas';
import useFrameBuffer from '@/components/video/useFrameBuffer';
import ScrubBar from '@/components/video/ScrubBar';
import ControlSlider from '@/components/video/ControlSlider';
import { Circle, Square, ChevronLeft } from 'lucide-react';

export default function Camera() {
  const navigate = useNavigate();
  const { videoRef, isActive, start, stop } = useCamera();
  const { pushFrame } = useFrameBuffer();
  const canvasRef = React.useRef(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [ghostBlend, setGhostBlend] = useState(0.3);
  const [loopMode, setLoopMode] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);

  // Start camera on mount
  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  // Capture frames for buffer
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      if (videoRef.current) {
        pushFrame(videoRef.current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isActive, pushFrame]);

  const handleRecord = () => {
    setIsRecording(!isRecording);
  };

  const handleScrub = (position) => {
    setScrubPosition(position);
  };

  if (!isActive) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <p className="mb-4">Initializing camera...</p>
          <div className="w-8 h-8 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 border-b border-slate-800" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-0.5 text-yellow-400 active:opacity-60"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-white">Recording</h1>
        <div className="w-10"></div>
      </div>

      {/* Canvas/Video Container */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Hidden video element */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          autoPlay
          muted
        />

        {/* Canvas for rendering with effects */}
        <RenderCanvas
          videoRef={videoRef}
          canvasRef={canvasRef}
          ghostBlend={ghostBlend}
          ghostInterval={10}
        />

        {/* Logo overlay */}
        <div className="absolute top-4 right-4 z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Circle size={24} className="text-white" />
          </div>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-xs font-semibold">REC</span>
          </div>
        )}
      </div>

      {/* Scrub Bar */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50">
        <ScrubBar
          duration={5}
          currentTime={scrubPosition}
          onScrub={handleScrub}
          bufferLength={100}
        />
      </div>

      {/* Controls */}
      <div className="px-4 py-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
        {/* Ghost Blend Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-400">Ghost Blend</label>
            <span className="text-xs text-slate-300">{Math.round(ghostBlend * 100)}%</span>
          </div>
          <ControlSlider
            min={0}
            max={1}
            step={0.01}
            value={ghostBlend}
            onChange={setGhostBlend}
          />
        </div>

        {/* Loop Mode Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Loop Mode</label>
          <button
            onClick={() => setLoopMode(!loopMode)}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              loopMode
                ? 'bg-yellow-400 text-slate-900'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {loopMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Record Button */}
        <button
          onClick={handleRecord}
          className={`w-full py-3 rounded-full font-bold flex items-center justify-center gap-2 transition ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
          }`}
        >
          <Square size={20} fill="currentColor" />
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
    </div>
  );
}
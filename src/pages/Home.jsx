import React, { useState } from 'react';
import useCamera from '@/components/video/useCamera';
import { Lock, Circle, Square } from 'lucide-react';
import MobileHeader from '@/components/MobileHeader';

export default function Home() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const { videoRef, isActive, error, start, stop } = useCamera();

  const handleEnableCamera = async () => {
    setCameraOpen(true);
    await start();
  };

  const handleCloseCamera = () => {
    stop();
    setCameraOpen(false);
  };

  if (cameraOpen) {
    return (
      <div className="fixed inset-0 flex flex-col bg-black">
        <MobileHeader />
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {error ? (
            <div className="text-center text-red-400 px-6">
              <p className="text-lg font-semibold">{error}</p>
              <button
                onClick={handleCloseCamera}
                className="mt-6 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-3 px-6 rounded-full"
              >
                Go Back
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
              />
              <button
                onClick={handleCloseCamera}
                className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full"
              >
                <Square size={24} fill="currentColor" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-950">
      <MobileHeader />

      <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-8">
        {/* App Icon and Title */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-lg">
            <Circle size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white">vid-loop</h1>
        </div>

        {/* Description */}
        <p className="text-center text-sm text-white/70 leading-relaxed max-w-xs">
          Live camera tool that lets you scrub back through the last few seconds of footage, layer motion ghost trails, and loop clips in a ping-pong effect. Record and share directly from your phone.
        </p>

        {/* Enable Camera Button */}
        <button
          onClick={handleEnableCamera}
          className="w-full max-w-xs bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-4 px-6 rounded-full flex items-center justify-center gap-3 transition text-lg"
        >
          <Lock size={20} />
          enable camera
        </button>

        {/* Help Text */}
        <p className="text-center text-xs text-white/50 max-w-xs">
          Works in browser – opens front or rear camera. On iPhone, use Safari for full access.
        </p>
      </div>
    </div>
  );
}
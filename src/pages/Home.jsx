import React from 'react';
import { Lock, Circle } from 'lucide-react';
import MobileHeader from '@/components/MobileHeader';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  const handleEnableCamera = () => {
    navigate('/camera');
  };

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
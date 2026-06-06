import React, { useEffect } from 'react';
import useCamera from '@/components/video/useCamera';
import MobileHeader from '@/components/MobileHeader';
import { useTabNav } from '@/components/TabNavigator';
import { Square } from 'lucide-react';

export default function Camera() {
  const { videoRef, isActive, error, start, stop } = useCamera();
  const { push } = useTabNav();

  useEffect(() => {
    start();
    return () => stop();
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <MobileHeader />

      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {error ? (
          <div className="text-center text-red-400 px-6">
            <p className="text-lg font-semibold">{error}</p>
            <button
              onClick={() => push('/')}
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
              onClick={() => push('/')}
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
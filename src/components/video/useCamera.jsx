import { useState, useRef, useCallback, useEffect } from 'react';

export default function useCamera() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const start = useCallback(async (facingMode = 'user') => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16/9 }, facingMode },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
    } catch (err) {
      setError(err.message || 'Camera access denied');
      setIsActive(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { videoRef, isActive, error, start, stop };
}
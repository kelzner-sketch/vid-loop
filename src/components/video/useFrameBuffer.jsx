import { useRef, useCallback } from 'react';

const MAX_BUFFER_SIZE = 600; // ~20 seconds at 30fps

export default function useFrameBuffer() {
  const bufferRef = useRef([]);
  const canvasPoolRef = useRef([]);

  // Create or reuse an offscreen canvas to store a frame
  const acquireCanvas = useCallback((width, height) => {
    let canvas = canvasPoolRef.current.pop();
    if (!canvas) {
      canvas = document.createElement('canvas');
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas;
  }, []);

  const releaseCanvas = useCallback((canvas) => {
    canvasPoolRef.current.push(canvas);
  }, []);

  const pushFrame = useCallback((videoElement) => {
    if (!videoElement || videoElement.videoWidth === 0) return;

    const w = videoElement.videoWidth;
    const h = videoElement.videoHeight;
    const canvas = acquireCanvas(w, h);
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    ctx.drawImage(videoElement, 0, 0, w, h);

    bufferRef.current.push(canvas);

    // Ring buffer: remove oldest when full
    if (bufferRef.current.length > MAX_BUFFER_SIZE) {
      const old = bufferRef.current.shift();
      releaseCanvas(old);
    }
  }, [acquireCanvas, releaseCanvas]);

  const getFrame = useCallback((offset) => {
    const buf = bufferRef.current;
    if (buf.length === 0) return null;
    const index = Math.max(0, Math.min(buf.length - 1 - offset, buf.length - 1));
    return buf[index];
  }, []);

  const getBufferLength = useCallback(() => {
    return bufferRef.current.length;
  }, []);

  const clearBuffer = useCallback(() => {
    bufferRef.current.forEach(c => releaseCanvas(c));
    bufferRef.current = [];
  }, [releaseCanvas]);

  return { pushFrame, getFrame, getBufferLength, clearBuffer, maxBufferSize: MAX_BUFFER_SIZE };
}
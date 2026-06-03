import React, { useRef, useEffect, useCallback } from 'react';

export default function RenderCanvas({ videoRef, getFrame, delayOffset, ghostEnabled, ghostInterval, isActive }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const containerRef = useRef(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef?.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext('2d');

    // Always size canvas to its CSS display size for sharp output
    const container = containerRef.current;
    if (container) {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }
    }

    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, cw, ch);

    // Helper: draw a source (video or canvas frame) cover-fit into the canvas
    const drawCover = (source, alpha = 1) => {
      if (!source) return;
      const srcW = source.videoWidth || source.width;
      const srcH = source.videoHeight || source.height;
      if (!srcW || !srcH) return;

      const scale = Math.max(cw / srcW, ch / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const dx = (cw - drawW) / 2;
      const dy = (ch - drawH) / 2;

      ctx.globalAlpha = alpha;
      ctx.drawImage(source, dx, dy, drawW, drawH);
    };

    const useBuffer = delayOffset > 0;

    if (ghostEnabled) {
      const ghostCount = 4;
      for (let i = ghostCount - 1; i >= 0; i--) {
        const alpha = i === 0 ? 1.0 : Math.max(0.08, 1.0 - i * 0.25);
        const offset = delayOffset + i * ghostInterval;
        if (offset === 0 && video) {
          drawCover(video, alpha);
        } else {
          const frame = getFrame(offset);
          if (frame) drawCover(frame, alpha);
          else if (i === 0 && video) drawCover(video, alpha); // fallback to live
        }
      }
    } else {
      if (!useBuffer && video) {
        // Live mode: draw directly from the video element — no buffer latency
        drawCover(video, 1);
      } else {
        const frame = getFrame(delayOffset);
        if (frame) {
          drawCover(frame, 1);
        } else if (video) {
          drawCover(video, 1); // fallback until buffer warms up
        }
      }
    }

    ctx.globalAlpha = 1;
    rafRef.current = requestAnimationFrame(render);
  }, [videoRef, getFrame, delayOffset, ghostEnabled, ghostInterval, isActive]);

  useEffect(() => {
    if (isActive) {
      rafRef.current = requestAnimationFrame(render);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render, isActive]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
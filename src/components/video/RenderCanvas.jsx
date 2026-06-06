import React, { useRef, useEffect, useCallback } from 'react';

export default function RenderCanvas({ videoRef, getFrame, delayOffset, ghostEnabled, ghostInterval, ghostCount, ghostOpacity, isActive, canvasRefOut }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const containerRef = useRef(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef?.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext('2d');

    // Always size canvas to its CSS display size — survives orientation changes
    const container = containerRef.current;
    if (container) {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        // Re-apply scale after resize
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }

    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);

    // Fill black background first (needed for multiply blend)
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cw, ch);

    // Helper: draw a source cover-fit into the canvas
    const drawCover = (source, alpha = 1, composite = 'source-over') => {
      if (!source) return;
      const srcW = source.videoWidth || source.width;
      const srcH = source.videoHeight || source.height;
      if (!srcW || !srcH) return;

      const scale = Math.max(cw / srcW, ch / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const dx = (cw - drawW) / 2;
      const dy = (ch - drawH) / 2;

      ctx.globalCompositeOperation = composite;
      ctx.globalAlpha = alpha;
      ctx.drawImage(source, dx, dy, drawW, drawH);
    };

    if (ghostEnabled) {
      const count = ghostCount ?? 4;
      const alpha = ghostOpacity ?? 0.5;
      const interval = ghostInterval ?? 8;

      // Draw ghost layers oldest→newest using 'screen' blend so they ADD light
      // Each ghost is a past frame — moving subjects leave bright trails behind them
      for (let i = count; i >= 1; i--) {
        const offset = delayOffset + i * interval;
        const frame = getFrame(offset);
        if (frame) drawCover(frame, alpha, 'screen');
      }

      // Current frame drawn normally on top at full opacity
      const currentOffset = delayOffset;
      if (currentOffset === 0 && video) {
        drawCover(video, 1, 'source-over');
      } else {
        const frame = getFrame(currentOffset);
        if (frame) drawCover(frame, 1, 'source-over');
        else if (video) drawCover(video, 1, 'source-over');
      }
    } else {
      if (delayOffset === 0 && video) {
        drawCover(video, 1);
      } else {
        const frame = getFrame(delayOffset);
        if (frame) drawCover(frame, 1);
        else if (video) drawCover(video, 1);
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    rafRef.current = requestAnimationFrame(render);
  }, [videoRef, getFrame, delayOffset, ghostEnabled, ghostInterval, ghostCount, ghostOpacity, isActive]);

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
        ref={(el) => { canvasRef.current = el; if (canvasRefOut) canvasRefOut.current = el; }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
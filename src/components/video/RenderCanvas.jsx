import React, { useRef, useEffect, useCallback } from 'react';

export default function RenderCanvas({ videoRef, getFrame, delayOffset, delayOffsetRef, ghostEnabled, ghostInterval, ghostCount, ghostOpacity, isActive, canvasRefOut }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const containerRef = useRef(null);

  // Keep a stable ref for all render-loop props so the RAF loop never needs
  // to be torn down and restarted when they change — avoids any gap in the
  // canvas stream that would break an in-progress recording.
  const propsRef = useRef({});
  propsRef.current = { videoRef, getFrame, delayOffset, delayOffsetRef, ghostEnabled, ghostInterval, ghostCount, ghostOpacity, isActive };

  // Stable render loop — reads latest props from propsRef each frame.
  // Never recreated, so canvas.captureStream() is never broken by prop changes
  // or orientation-triggered re-renders.
  const render = useCallback(() => {
    const { videoRef: vRef, getFrame, delayOffset: delayOffsetProp, delayOffsetRef, ghostEnabled, ghostInterval, ghostCount, ghostOpacity, isActive } = propsRef.current;
    const delayOffset = delayOffsetRef ? delayOffsetRef.current : delayOffsetProp;
    const canvas = canvasRef.current;
    const video = vRef?.current;

    if (!canvas || !isActive) {
      rafRef.current = requestAnimationFrame(render);
      return;
    }

    const ctx = canvas.getContext('2d');

    // Resize canvas to always fill the screen (display resolution)
    const container = containerRef.current;
    if (container) {
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(container.clientWidth * dpr);
      const targetH = Math.round(container.clientHeight * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }

    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cw, ch);

    const drawCover = (source, alpha = 1, blendMode = 'source-over') => {
      if (!source) return;
      const srcW = source.videoWidth || source.width;
      const srcH = source.videoHeight || source.height;
      if (!srcW || !srcH) return;
      const scale = Math.max(cw / srcW, ch / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      ctx.globalCompositeOperation = blendMode;
      ctx.globalAlpha = alpha;
      ctx.drawImage(source, (cw - drawW) / 2, (ch - drawH) / 2, drawW, drawH);
    };

    const currentFrame = delayOffset === 0 ? video : (getFrame(delayOffset) || video);

    if (ghostEnabled) {
      const count = ghostCount ?? 4;
      const interval = ghostInterval ?? 4;
      const opacity = ghostOpacity ?? 0.8;

      // Ghost trail: draw oldest first (most faded), working up to the current frame.
      // Each ghost samples frames progressively further into the past.
      // We always spread from frame 0 (live/newest) regardless of delayOffset,
      // so the trails show the recent motion history behind the current image.
      for (let i = count; i >= 1; i--) {
        const frame = getFrame(i * interval); // always relative to live (index 0)
        if (!frame) continue;
        const alpha = opacity * (count - i + 1) / count;
        drawCover(frame, alpha, 'source-over');
      }

      // Current (possibly delayed) frame on top — always crisp
      drawCover(currentFrame, 1, 'source-over');
    } else {
      drawCover(currentFrame, 1);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    rafRef.current = requestAnimationFrame(render);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — loop is perpetual, reads from propsRef

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={(el) => { canvasRef.current = el; if (canvasRefOut) canvasRefOut.current = el; }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
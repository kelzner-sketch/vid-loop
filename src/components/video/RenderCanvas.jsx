import React, { useRef, useEffect, useCallback } from 'react';

const FREE_MAX_W = 360;
const FREE_MAX_H = 640;

export default function RenderCanvas({ videoRef, getFrame, delayOffset, delayOffsetRef, ghostEnabled, ghostInterval, ghostCount, isActive, canvasRefOut, isPro }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const containerRef = useRef(null);

  // Keep a stable ref for all render-loop props so the RAF loop never needs
  // to be torn down and restarted when they change — avoids any gap in the
  // canvas stream that would break an in-progress recording.
  const propsRef = useRef({});
  propsRef.current = { videoRef, getFrame, delayOffset, delayOffsetRef, ghostEnabled, ghostInterval, ghostCount, isActive, isPro };

  // Stable render loop — reads latest props from propsRef each frame.
  // Never recreated, so canvas.captureStream() is never broken by prop changes
  // or orientation-triggered re-renders.
  const render = useCallback(() => {
    const { videoRef: vRef, getFrame, delayOffset: delayOffsetProp, delayOffsetRef, ghostEnabled, ghostInterval, ghostCount, isActive, isPro } = propsRef.current;
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
      const count = ghostCount ?? 6;
      const interval = ghostInterval ?? 4;

      // Base: current frame at full opacity
      drawCover(currentFrame, 1);

      // Ghost layers with multiply blend: darkens overlapping bright areas
      // giving the moody, shadowy trail effect
      for (let i = 1; i <= count; i++) {
        const frame = getFrame(delayOffset + i * interval);
        if (!frame) continue;
        // Newer ghosts more opaque, older ones fade out
        const alpha = 0.75 * (1 - (i - 1) / count);
        drawCover(frame, alpha, 'multiply');
      }
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
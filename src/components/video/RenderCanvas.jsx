import React, { useRef, useEffect, useCallback } from 'react';

export default function RenderCanvas({ getFrame, delayOffset, ghostEnabled, ghostInterval, isActive }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext('2d');
    const baseFrame = getFrame(delayOffset);
    if (!baseFrame) {
      rafRef.current = requestAnimationFrame(render);
      return;
    }

    // Match canvas to frame size
    if (canvas.width !== baseFrame.width || canvas.height !== baseFrame.height) {
      canvas.width = baseFrame.width;
      canvas.height = baseFrame.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (ghostEnabled) {
      // Draw ghost layers from oldest to newest (back to front)
      const ghostCount = 4;
      for (let i = ghostCount - 1; i >= 0; i--) {
        const offset = delayOffset + i * ghostInterval;
        const frame = getFrame(offset);
        if (frame) {
          ctx.globalAlpha = i === 0 ? 1.0 : Math.max(0.08, 1.0 - i * 0.25);
          ctx.drawImage(frame, 0, 0);
        }
      }
      ctx.globalAlpha = 1.0;
    } else {
      ctx.drawImage(baseFrame, 0, 0);
    }

    rafRef.current = requestAnimationFrame(render);
  }, [getFrame, delayOffset, ghostEnabled, ghostInterval, isActive]);

  useEffect(() => {
    if (isActive) {
      rafRef.current = requestAnimationFrame(render);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ objectFit: 'cover', display: 'block' }}
    />
  );
}
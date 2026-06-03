import React, { useRef, useCallback } from 'react';

export default function ScrubBar({ value, max, onChange, bufferFill, maxBufferSize }) {
  const trackRef = useRef(null);

  const getOffsetFromEvent = useCallback((clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    // Left = most delayed (max), right = live (0)
    const newOffset = Math.round((1 - ratio) * max);
    onChange(newOffset);
  }, [max, onChange]);

  const handleMouseDown = useCallback((e) => {
    getOffsetFromEvent(e.clientX);
    const onMove = (me) => getOffsetFromEvent(me.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [getOffsetFromEvent]);

  const handleTouchStart = useCallback((e) => {
    getOffsetFromEvent(e.touches[0].clientX);
    const onMove = (te) => getOffsetFromEvent(te.touches[0].clientX);
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  }, [getOffsetFromEvent]);

  // Thumb position: 0 = right (live), max = left (most delayed)
  const thumbPercent = max > 0 ? ((1 - value / max) * 100) : 100;
  // How much of the total buffer capacity is filled
  const fillPercent = Math.min(100, (bufferFill / maxBufferSize) * 100);

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className="relative h-10 flex items-center cursor-pointer select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Track background */}
      <div className="absolute inset-x-0 h-1 rounded-full bg-white/10">
        {/* Buffer fill indicator */}
        <div
          className="absolute right-0 h-full rounded-full bg-white/20"
          style={{ width: `${fillPercent}%` }}
        />
        {/* Scrubbed (delayed) region — from thumb to right edge */}
        <div
          className="absolute h-full rounded-full bg-primary/70"
          style={{ left: `${thumbPercent}%`, right: 0 }}
        />
      </div>

      {/* Thumb */}
      <div
        className="absolute w-5 h-5 rounded-full bg-white shadow-lg shadow-black/50 -translate-x-1/2 flex items-center justify-center"
        style={{ left: `${thumbPercent}%`, transition: 'left 0.02s linear' }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
      </div>
    </div>
  );
}
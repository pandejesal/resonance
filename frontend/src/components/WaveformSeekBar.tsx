import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../lib/api';

interface WaveformSeekBarProps {
  trackId: string;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export default function WaveformSeekBar({
  trackId,
  duration,
  currentTime,
  onSeek,
}: WaveformSeekBarProps) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchPeaks = async () => {
      try {
        const response = await fetch(`/api/tracks/${trackId}/waveform`, { credentials: 'include' });
        const data = await response.json();
        if (!cancelled && data.peaks && data.peaks.length > 0) {
          setPeaks(data.peaks);
        }
      } catch {
        // Silently handle errors
      }
    };
    fetchPeaks();
    return () => { cancelled = true; };
  }, [trackId]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekFromEvent = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(percent * duration);
    },
    [duration, onSeek]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      handleSeekFromEvent(e.clientX);
    },
    [handleSeekFromEvent]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      handleSeekFromEvent(e.clientX);
    },
    [handleSeekFromEvent]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      handleSeekFromEvent(e.touches[0].clientX);
    },
    [handleSeekFromEvent]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleSeekFromEvent(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleSeekFromEvent(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleSeekFromEvent]);

  if (peaks.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[60px] cursor-pointer group"
      style={{ touchAction: 'none' }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${peaks.length} 100`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Background peaks */}
        {peaks.map((peak, i) => {
          const height = Math.max(1, peak * 100);
          const x = (i / peaks.length) * 100;
          const barWidth = 100 / peaks.length;
          const isBeforeProgress = (i / peaks.length) * 100 < progressPercent;

          return (
            <rect
              key={i}
              x={`${x}%`}
              y={50 - height / 2}
              width={`${barWidth * 0.8}%`}
              height={height}
              rx="0.5"
              className={`transition-colors duration-100 ${
                isBeforeProgress ? 'fill-brand-500' : 'fill-white/20'
              }`}
            />
          );
        })}

        {/* Progress line */}
        <line
          x1={`${progressPercent}%`}
          y1="0"
          x2={`${progressPercent}%`}
          y2="100"
          stroke="white"
          strokeWidth="2"
          className="opacity-80"
        />
      </svg>

      {/* Hover indicator */}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}

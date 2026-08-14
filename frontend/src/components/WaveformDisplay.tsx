import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformDisplayProps {
  trackId: string;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  className?: string;
  color?: string;
  height?: number;
}

export default function WaveformDisplay({
  trackId,
  currentTime,
  duration,
  onSeek,
  className = '',
  color = '#1DB954',
  height = 64,
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!trackId) return;
    let cancelled = false;
    fetch(`/api/tracks/${trackId}/waveform`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.peaks && data.peaks.length > 0) {
          setPeaks(data.peaks);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [trackId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const progress = duration > 0 ? currentTime / duration : 0;
    const barWidth = Math.max(1, (w / peaks.length) - 0.5);

    peaks.forEach((amp, i) => {
      const x = (i / peaks.length) * w;
      const barHeight = Math.max(1, amp * h * 0.9);
      const y = (h - barHeight) / 2;
      const isPlayed = (i / peaks.length) < progress;

      ctx.fillStyle = isPlayed ? color : `${color}40`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    });
  }, [peaks, currentTime, duration, color]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (!isDragging) return;
    const tick = () => {
      draw();
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isDragging, draw]);

  const seekFromEvent = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !onSeek) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    onSeek(progress * duration);
  }, [duration, onSeek]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    seekFromEvent(e.clientX);
  }, [seekFromEvent]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDragging(true);
    seekFromEvent(e.clientX);
  }, [seekFromEvent]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => seekFromEvent(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) seekFromEvent(e.touches[0].clientX);
    };
    const handleEnd = () => setIsDragging(false);
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
  }, [isDragging, seekFromEvent]);

  if (peaks.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full cursor-pointer group ${className}`}
      style={{ height: `${height}px`, touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ height: '100%' }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => {
          setIsDragging(true);
          seekFromEvent(e.touches[0].clientX);
        }}
      />
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded" />
    </div>
  );
}

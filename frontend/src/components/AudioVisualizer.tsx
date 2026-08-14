import React, { useRef, useEffect, useCallback } from 'react';
import { audioEngine } from '../lib/audio-engine';

interface AudioVisualizerProps {
  barCount?: number;
  barWidth?: number;
  gap?: number;
  height?: number;
  color?: string;
  className?: string;
}

export default function AudioVisualizer({
  barCount = 32,
  barWidth = 3,
  gap = 2,
  height = 60,
  color = '#1DB954',
  className = '',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = audioEngine.getFrequencyData();
    const bufferLength = data.length;
    if (bufferLength === 0) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const totalBarWidth = barWidth + gap;
    const barsToShow = Math.min(barCount, Math.floor(displayWidth / totalBarWidth));
    const step = Math.max(1, Math.floor(bufferLength / barsToShow));

    for (let i = 0; i < barsToShow; i++) {
      const dataIndex = Math.min(i * step, bufferLength - 1);
      const value = data[dataIndex] / 255;
      const barHeight = Math.max(2, value * displayHeight * 0.9);
      const x = i * totalBarWidth;
      const y = (displayHeight - barHeight) / 2;

      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '40');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [barCount, barWidth, gap, color]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full ${className}`}
      style={{ height: `${height}px` }}
    />
  );
}

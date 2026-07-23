import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { usePlayerStore, useUIStore } from '../stores';
import { getArtworkUrl, formatDuration } from '../lib/utils';
import { audioEngine } from '../lib/audio-engine';
import LyricsPanel from './LyricsPanel';

const BAR_COUNT = 40;

export default function NowPlaying() {
  const {
    currentTrack, isPlaying, progress, duration, next, previous,
    togglePlay, seek, shuffle, repeat, toggleShuffle, cycleRepeat,
  } = usePlayerStore();
  const { nowPlayingOpen, toggleNowPlaying, lyricsOpen, toggleLyrics } = useUIStore();
  const [artworkError, setArtworkError] = useState(false);
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(10));
  const rafRef = useRef<number>(0);
  const y = useMotionValue(0);

  const animate = useCallback(() => {
    if (!audioEngine.isReady) {
      setBars((prev) => prev.map(() => 10 + Math.random() * 20));
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const data = audioEngine.getFrequencyData();
    if (data.length === 0) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const binCount = data.length;
    const barsPerBin = Math.max(1, Math.floor(binCount / BAR_COUNT));
    const newBars: number[] = [];

    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      const start = i * barsPerBin;
      for (let j = start; j < start + barsPerBin && j < binCount; j++) {
        sum += data[j];
      }
      const avg = sum / barsPerBin;
      const height = Math.max(8, (avg / 255) * 100);
      newBars.push(height);
    }

    setBars(newBars);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isPlaying && nowPlayingOpen) {
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, nowPlayingOpen, animate]);

  // Sync playback state to Android native MediaSession
  useEffect(() => {
    if (!(window as any).AndroidBridge || !currentTrack) return;
    try {
      (window as any).AndroidBridge.updatePlaybackState(
        currentTrack.title,
        currentTrack.artist,
        currentTrack.album,
        currentTrack.has_artwork ? getArtworkUrl(currentTrack.id) : '',
        isPlaying,
        progress,
        duration,
      );
    } catch (e) {}
  }, [currentTrack, isPlaying, progress, duration]);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.y > 100) {
      toggleNowPlaying();
    }
  }, [toggleNowPlaying]);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <AnimatePresence>
      {nowPlayingOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-surface-0 overflow-hidden"
        >
          {/* Dynamic gradient background */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, rgba(92, 124, 250, 0.3) 0%, transparent 60%)`,
            }}
          />

          {/* Swipe-down drag handle */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.5}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className="absolute top-0 left-0 right-0 z-10 pt-4 pb-2 flex justify-center cursor-grab active:cursor-grabbing"
          >
            <div className="w-10 h-1 rounded-full bg-white/30" />
          </motion.div>

          {/* Close button */}
          <button
            onClick={toggleNowPlaying}
            className="absolute top-4 left-4 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Lyrics button */}
          <button
            onClick={toggleLyrics}
            className={`absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full text-sm transition-all active:scale-95 ${
              lyricsOpen ? 'bg-brand-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Lyrics
          </button>

          <div className="h-full flex flex-col items-center justify-center px-6 pb-24 pt-16 max-w-lg mx-auto">
            {/* Album artwork */}
            <motion.div
              className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden album-shadow-lg mb-8"
              animate={{ scale: isPlaying ? 1 : 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {!artworkError && currentTrack.has_artwork ? (
                <img
                  src={getArtworkUrl(currentTrack.id)}
                  alt={currentTrack.album}
                  className="w-full h-full object-cover"
                  onError={() => setArtworkError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-brand-600/30 to-surface-2 flex items-center justify-center">
                  <svg className="w-20 h-20 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}
            </motion.div>

            {/* Track info */}
            <div className="w-full text-center mb-6">
              <motion.h2
                className="text-xl font-semibold text-primary truncate mb-1"
                key={currentTrack.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {currentTrack.title}
              </motion.h2>
              <p className="text-secondary truncate">{currentTrack.artist}</p>
              <p className="text-tertiary text-sm truncate">{currentTrack.album}</p>
            </div>

            {/* Audio info */}
            <div className="flex items-center gap-3 text-xs text-tertiary mb-6">
              {currentTrack.codec && (
                <span className="px-2 py-1 rounded-lg bg-white/5">{currentTrack.codec}</span>
              )}
              {currentTrack.sample_rate && (
                <span>{(currentTrack.sample_rate / 1000).toFixed(1)}kHz</span>
              )}
              {currentTrack.bit_depth && <span>{currentTrack.bit_depth}bit</span>}
              {currentTrack.bitrate && <span>{currentTrack.bitrate}kbps</span>}
            </div>

            {/* Audio visualization or Lyrics */}
            {lyricsOpen ? (
              <div className="w-full mb-4">
                <LyricsPanel />
              </div>
            ) : (
              <div className="w-full h-12 flex items-end justify-center gap-[2px] mb-4">
                {bars.map((height, i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full bg-brand-500/60"
                    animate={{
                      height: isPlaying ? `${height}%` : '8%',
                    }}
                    transition={{ duration: 0.05 }}
                  />
                ))}
              </div>
            )}

            {/* Progress bar */}
            <div className="w-full mb-4">
              <div
                className="relative w-full h-1 bg-white/10 rounded-full cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seek(percent * duration);
                }}
                onTouchStart={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const touch = e.touches[0];
                  const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                  seek(percent * duration);
                }}
                onTouchMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const touch = e.touches[0];
                  const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                  seek(percent * duration);
                }}
              >
                <motion.div
                  className="absolute h-full bg-brand-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
                <div
                  className="absolute w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -translate-y-1/2 top-1/2"
                  style={{ left: `calc(${progressPercent}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-tertiary">
                <span>{formatDuration(progress)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Primary controls */}
            <div className="flex items-center gap-6">
              <button
                onClick={previous}
                className="p-3 text-white/60 hover:text-white active:text-white active:scale-90 transition-all"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
              >
                {isPlaying ? (
                  <svg className="w-7 h-7 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={next}
                className="p-3 text-white/60 hover:text-white active:text-white active:scale-90 transition-all"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>

            {/* Secondary controls */}
            <div className="flex items-center justify-center gap-10 mt-6">
              <button
                onClick={toggleShuffle}
                className={`p-2 transition-colors active:scale-90 ${
                  shuffle ? 'text-brand-500' : 'text-white/50 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                </svg>
              </button>

              <button
                onClick={cycleRepeat}
                className={`p-2 transition-colors active:scale-90 ${
                  repeat !== 'off' ? 'text-brand-500' : 'text-white/50 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  {repeat === 'one' ? (
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                  ) : (
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                  )}
                </svg>
                {repeat === 'one' && (
                  <span className="absolute -top-1 -right-1 text-[9px] font-bold text-brand-500">1</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

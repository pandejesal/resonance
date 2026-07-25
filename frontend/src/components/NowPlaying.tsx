import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { usePlayerStore, useUIStore, useCastStore } from '../stores';
import { getArtworkUrl, formatDuration } from '../lib/utils';
import { audioEngine } from '../lib/audio-engine';
import LyricsPanel from './LyricsPanel';
import WaveformSeekBar from './WaveformSeekBar';
import StarRating from './StarRating';
import { api } from '../lib/api';

const BAR_COUNT = 40;

export default function NowPlaying() {
  const {
    currentTrack, isPlaying, progress, duration, next, previous,
    togglePlay, seek, shuffle, repeat, toggleShuffle, cycleRepeat,
  } = usePlayerStore();
  const { nowPlayingOpen, toggleNowPlaying, lyricsOpen, toggleLyrics } = useUIStore();
  const {
    targets, activeTarget, isCasting, castMenuOpen,
    fetchTargets, castPlay, castControl, stopCasting, setCastMenuOpen,
  } = useCastStore();
  const [artworkError, setArtworkError] = useState(false);
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(10));
  const [trackRating, setTrackRating] = useState<number | null>(null);
  const rafRef = useRef<number>(0);
  const y = useMotionValue(0);
  const castMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (currentTrack) {
      setTrackRating(currentTrack.rating ?? null);
    }
  }, [currentTrack]);

  // Close cast menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (castMenuRef.current && !castMenuRef.current.contains(event.target as Node)) {
        setCastMenuOpen(false);
      }
    };
    if (castMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [castMenuOpen, setCastMenuOpen]);

  const handleRatingChange = useCallback(async (newRating: number | null) => {
    if (!currentTrack) return;
    setTrackRating(newRating);
    try {
      const updated = await api.tracks.updateRating(currentTrack.id, newRating);
      usePlayerStore.setState((state) => {
        const currentTrack = state.currentTrack;
        if (currentTrack && currentTrack.id === updated.id) {
          return { currentTrack: updated };
        }
        return {};
      });
    } catch (e) {
      console.error('Failed to update rating:', e);
      setTrackRating(currentTrack.rating ?? null);
    }
  }, [currentTrack]);

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
              background: `radial-gradient(ellipse at 50% 0%, rgba(29, 185, 84, 0.3) 0%, transparent 60%)`,
            }}
          />

          {/* Swipe-down drag handle */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.5}
            onDragEnd={handleDragEnd}
            style={{ y, touchAction: 'pan-y' }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-10 pt-4 pb-2 flex justify-center cursor-grab active:cursor-grabbing w-20"
          >
            <div className="w-10 h-1 rounded-full bg-white/30" />
          </motion.div>

          {/* Close button */}
          <button
            onPointerDown={(e) => { e.stopPropagation(); }}
            onTouchStart={(e) => { e.stopPropagation(); toggleNowPlaying(); }}
            onClick={(e) => { e.stopPropagation(); toggleNowPlaying(); }}
            style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
            className="absolute top-4 left-4 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
            aria-label="Close full player"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Cast button */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20" ref={castMenuRef}>
            <button
              onClick={() => {
                if (!castMenuOpen) {
                  fetchTargets();
                }
                setCastMenuOpen(!castMenuOpen);
              }}
              style={{ touchAction: 'manipulation' }}
              className={`px-3 py-1.5 rounded-full text-sm transition-all active:scale-95 flex items-center gap-1.5 ${
                isCasting
                  ? 'bg-brand-500 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
              </svg>
              {isCasting ? activeTarget?.name || 'Casting' : 'Cast'}
            </button>

            {/* Cast dropdown */}
            <AnimatePresence>
              {castMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-surface-1 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-white/5">
                    <p className="text-xs font-medium text-secondary uppercase tracking-wider">Cast Targets</p>
                  </div>
                  {targets.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-tertiary">No cast targets registered</p>
                      <p className="text-xs text-tertiary mt-1">Add targets in Settings</p>
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {targets.map((target) => (
                        <button
                          key={target.id}
                          onClick={() => {
                            if (isCasting && activeTarget?.id === target.id) {
                              stopCasting();
                            } else if (currentTrack) {
                              castPlay(target.id, currentTrack.id);
                            }
                          }}
                          className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className={`w-2 h-2 rounded-full ${
                            activeTarget?.id === target.id && isCasting
                              ? 'bg-brand-500'
                              : 'bg-white/20'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-primary truncate">{target.name}</p>
                            <p className="text-xs text-tertiary">{target.protocol} - {target.host}:{target.port}</p>
                          </div>
                          {activeTarget?.id === target.id && isCasting && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                stopCasting();
                              }}
                              className="text-xs text-accent-500 hover:text-accent-400"
                            >
                              Stop
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

            {/* Lyrics button */}
          <button
            onClick={toggleLyrics}
            style={{ touchAction: 'manipulation' }}
            className={`absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full text-sm transition-all active:scale-95 ${
              lyricsOpen ? 'bg-brand-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
            aria-label={lyricsOpen ? 'Hide lyrics' : 'Show lyrics'}
          >
            Lyrics
          </button>

          <div className="relative z-20 h-full flex flex-col items-center justify-center px-6 pb-24 pt-16 max-w-lg mx-auto">
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
              <p className="text-tertiary text-sm truncate mb-2">{currentTrack.album}</p>
              <div className="flex justify-center">
                <StarRating rating={trackRating} onChange={handleRatingChange} size="md" />
              </div>
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
              {currentTrack.waveform_peaks ? (
                <WaveformSeekBar
                  trackId={currentTrack.id}
                  duration={duration}
                  currentTime={progress}
                  onSeek={seek}
                />
              ) : (
                <div
                  className="relative w-full h-1 bg-white/10 rounded-full cursor-pointer group"
                  style={{ touchAction: 'none' }}
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
              )}
              <div className="flex justify-between mt-2 text-xs text-tertiary">
                <span>{formatDuration(progress)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Primary controls */}
            <div className="flex items-center gap-6">
              <button
                onClick={previous}
                style={{ touchAction: 'manipulation' }}
                className="p-3 text-white/60 hover:text-white active:text-white active:scale-90 transition-all"
                aria-label="Previous track"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                style={{ touchAction: 'manipulation' }}
                className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center active:scale-90 transition-transform"
                aria-label={isPlaying ? 'Pause' : 'Play'}
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
                style={{ touchAction: 'manipulation' }}
                className="p-3 text-white/60 hover:text-white active:text-white active:scale-90 transition-all"
                aria-label="Next track"
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
                style={{ touchAction: 'manipulation' }}
                className={`p-2 transition-colors active:scale-90 ${
                  shuffle ? 'text-brand-500' : 'text-white/50 hover:text-white'
                }`}
                aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                </svg>
              </button>

              <button
                onClick={cycleRepeat}
                style={{ touchAction: 'manipulation' }}
                className={`p-2 transition-colors active:scale-90 ${
                  repeat !== 'off' ? 'text-brand-500' : 'text-white/50 hover:text-white'
                }`}
                aria-label={`Repeat: ${repeat}`}
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

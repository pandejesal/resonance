import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { usePlayerStore, useUIStore, useCastStore } from '../stores';
import { getArtworkUrl, formatDuration } from '../lib/utils';
import SyncedLyrics from './SyncedLyrics';
import WaveformSeekBar from './WaveformSeekBar';
import StarRating from './StarRating';
import { api } from '../lib/api';
import type { LyricsData } from '../types';
import AudioVisualizer from './AudioVisualizer';

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
  const [trackRating, setTrackRating] = useState<number | null>(null);
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [gradientAngle, setGradientAngle] = useState(0);
  const y = useMotionValue(0);
  const castMenuRef = useRef<HTMLDivElement>(null);
  const fullscreenDragY = useMotionValue(0);

  // Animate gradient angle for full-screen mode
  useEffect(() => {
    if (!isFullScreen) return;
    const interval = setInterval(() => {
      setGradientAngle((prev) => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isFullScreen]);

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
      if (isFullScreen) {
        setIsFullScreen(false);
      } else {
        toggleNowPlaying();
      }
    }
  }, [toggleNowPlaying, isFullScreen]);

  useEffect(() => {
    if (currentTrack) {
      setTrackRating(currentTrack.rating ?? null);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack) return;
    setLyricsLoading(true);
    api.tracks.getLyrics(currentTrack.id)
      .then(setLyricsData)
      .catch(() => setLyricsData(null))
      .finally(() => setLyricsLoading(false));
  }, [currentTrack?.id]);

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
  const artworkUrl = currentTrack.has_artwork ? getArtworkUrl(currentTrack.id) : null;

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
          {/* Blurred background for full-screen mode */}
          {isFullScreen && artworkUrl && (
            <div className="absolute inset-0 z-0">
              <img
                src={artworkUrl}
                alt=""
                className="w-full h-full object-cover"
                style={{ filter: 'blur(50px) brightness(0.4) saturate(1.5)' }}
              />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          )}

          {/* Animated gradient background */}
          <div
            className="absolute inset-0 opacity-40 transition-all duration-1000"
            style={{
              background: isFullScreen
                ? `linear-gradient(${gradientAngle}deg, rgba(29, 185, 84, 0.4) 0%, rgba(139, 92, 246, 0.3) 33%, rgba(236, 72, 153, 0.3) 66%, rgba(29, 185, 84, 0.4) 100%)`
                : `radial-gradient(ellipse at 50% 0%, rgba(29, 185, 84, 0.3) 0%, transparent 60%)`,
            }}
          />

          {/* Swipe-down drag handle */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.5}
            onDragEnd={handleDragEnd}
            style={{ y: isFullScreen ? fullscreenDragY : y, touchAction: 'pan-y' }}
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

          {/* Fullscreen toggle button */}
          <button
            onPointerDown={(e) => { e.stopPropagation(); }}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
            style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
            className="absolute top-4 left-16 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
            aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
          >
            {isFullScreen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
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

          {/* Main content area */}
          <div className={`relative z-20 h-full flex flex-col items-center justify-center px-6 pb-24 pt-16 mx-auto ${
            isFullScreen ? 'max-w-4xl' : 'max-w-lg'
          }`}>
            <div className={`w-full flex ${isFullScreen ? 'flex-row items-center gap-12' : 'flex-col items-center'}`}>
              {/* Album artwork */}
              <motion.div
                className={`relative overflow-hidden album-shadow-lg flex-shrink-0 ${
                  isFullScreen
                    ? 'w-[400px] h-[400px] rounded-3xl'
                    : 'w-full max-w-[320px] aspect-square rounded-3xl mb-8'
                }`}
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

                {/* Full-screen vinyl record animation */}
                {isFullScreen && isPlaying && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-white/10" />
                  </motion.div>
                )}
              </motion.div>

              {/* Right side content for full-screen */}
              <div className={`flex-1 ${isFullScreen ? 'flex flex-col justify-center' : 'w-full'}`}>
                {/* Track info */}
                <div className={`text-center mb-6 ${isFullScreen ? 'text-left' : ''}`}>
                  <motion.h2
                    className={`font-semibold text-primary truncate mb-1 ${
                      isFullScreen ? 'text-3xl' : 'text-xl'
                    }`}
                    key={currentTrack.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {currentTrack.title}
                  </motion.h2>
                  <p className={`text-secondary truncate ${isFullScreen ? 'text-lg' : ''}`}>
                    {currentTrack.artist}
                  </p>
                  <p className="text-tertiary text-sm truncate mb-2">{currentTrack.album}</p>
                  <div className={`flex ${isFullScreen ? 'justify-start' : 'justify-center'}`}>
                    <StarRating rating={trackRating} onChange={handleRatingChange} size="md" />
                  </div>
                </div>

                {/* Audio info */}
                <div className={`flex items-center gap-3 text-xs text-tertiary mb-6 ${
                  isFullScreen ? 'justify-start' : 'justify-center'
                }`}>
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
                  <div className={`w-full mb-4 relative ${isFullScreen ? 'h-64' : ''}`}>
                    <div
                      className="absolute inset-0 rounded-2xl overflow-hidden"
                      style={{
                        background: 'linear-gradient(180deg, rgba(29,185,84,0.15) 0%, rgba(0,0,0,0.4) 100%)',
                      }}
                    />
                    <div className="relative h-full">
                      {lyricsLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : lyricsData?.synced ? (
                        <SyncedLyrics lyrics={lyricsData.synced} className="h-full" />
                      ) : lyricsData?.plain ? (
                        <div className="flex items-center justify-center h-full px-4">
                          <p className="text-secondary text-sm text-center whitespace-pre-wrap leading-relaxed">
                            {lyricsData.plain}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-tertiary text-sm">No lyrics available</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full mb-4">
                    <AudioVisualizer
                      barCount={isFullScreen ? 60 : 40}
                      barWidth={isFullScreen ? 2 : 3}
                      gap={2}
                      height={isFullScreen ? 64 : 48}
                      color="#1DB954"
                    />
                  </div>
                )}
              </div>
            </div>

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
                className={`rounded-full bg-brand-500 flex items-center justify-center active:scale-90 transition-transform ${
                  isFullScreen ? 'w-20 h-20' : 'w-16 h-16'
                }`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className={`text-black ${isFullScreen ? 'w-9 h-9' : 'w-7 h-7'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className={`text-black ml-1 ${isFullScreen ? 'w-9 h-9' : 'w-7 h-7'}`} fill="currentColor" viewBox="0 0 24 24">
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

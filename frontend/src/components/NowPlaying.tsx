import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { usePlayerStore, useUIStore, useCastStore } from '../stores';
import { getArtworkUrl, formatDuration } from '../lib/utils';
import SyncedLyrics from './SyncedLyrics';
import WaveformDisplay from './WaveformDisplay';
import AudioQualityBadge from './AudioQualityBadge';
import StarRating from './StarRating';
import { api } from '../lib/api';
import type { LyricsData } from '../types';
import AudioVisualizer from './AudioVisualizer';
import EffectsPanel from './EffectsPanel';

const LIKED_STORAGE_KEY = 'resonance-liked-tracks';

function getLikedTracks(): Set<string> {
  try {
    const stored = localStorage.getItem(LIKED_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLikedTracks(liked: Set<string>) {
  localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify([...liked]));
}

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
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeHover, setVolumeHover] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Set<string>>(getLikedTracks);
  const [isLiked, setIsLiked] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [buffered, setBuffered] = useState(0);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const y = useMotionValue(0);
  const castMenuRef = useRef<HTMLDivElement>(null);
  const fullscreenDragY = useMotionValue(0);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

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
    if (currentTrack) {
      setIsLiked(likedTracks.has(String(currentTrack.id)));
    }
  }, [currentTrack, likedTracks]);

  useEffect(() => {
    const handleBufferProgress = () => {
      const audio = document.querySelector('audio');
      if (audio && audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        setBuffered(bufferedEnd);
      }
    };
    const audio = document.querySelector('audio');
    if (audio) {
      audio.addEventListener('progress', handleBufferProgress);
      return () => audio.removeEventListener('progress', handleBufferProgress);
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

  const handleVolumeChange = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(1, newVolume));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    if (clamped > 0) setPrevVolume(clamped);
    const audio = document.querySelector('audio');
    if (audio) audio.volume = clamped;
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      handleVolumeChange(prevVolume || 0.5);
    } else {
      setPrevVolume(volume);
      handleVolumeChange(0);
    }
  }, [isMuted, volume, prevVolume, handleVolumeChange]);

  const handleToggleLike = useCallback(() => {
    if (!currentTrack) return;
    const id = String(currentTrack.id);
    setLikedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveLikedTracks(next);
      return next;
    });
  }, [currentTrack]);

  const handleShare = useCallback(async () => {
    if (!currentTrack) return;
    const text = `♪ ${currentTrack.title} - ${currentTrack.artist} | Resonance`;
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage('Copied to clipboard!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      setToastMessage('Failed to copy');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  }, [currentTrack]);

  const handleProgressInteraction = useCallback((clientX: number) => {
    const el = progressRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seek(percent * duration);
  }, [duration, seek]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingProgress(true);
    handleProgressInteraction(e.clientX);
  }, [handleProgressInteraction]);

  useEffect(() => {
    if (!isDraggingProgress) return;
    const handleMouseMove = (e: MouseEvent) => handleProgressInteraction(e.clientX);
    const handleMouseUp = () => setIsDraggingProgress(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingProgress, handleProgressInteraction]);

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

                {/* Audio quality & metadata info */}
                <div className={`flex items-center gap-3 flex-wrap mb-6 ${
                  isFullScreen ? 'justify-start' : 'justify-center'
                }`}>
                  {currentTrack.bpm && (
                    <span className="text-xs text-tertiary px-2 py-0.5 bg-surface-2 rounded">
                      {Math.round(currentTrack.bpm)} BPM
                    </span>
                  )}
                  {currentTrack.musical_key && (
                    <span className="text-xs text-tertiary px-2 py-0.5 bg-surface-2 rounded">
                      {currentTrack.musical_key}
                    </span>
                  )}
                  <AudioQualityBadge
                    format={currentTrack.format}
                    bitrate={currentTrack.bitrate}
                    sampleRate={currentTrack.sample_rate}
                    bitDepth={currentTrack.bit_depth}
                  />
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
                <WaveformDisplay
                  trackId={currentTrack.id}
                  duration={duration}
                  currentTime={progress}
                  onSeek={seek}
                  height={64}
                />
              ) : (
                <div
                  ref={progressRef}
                  className="relative w-full h-1.5 bg-white/10 rounded-full cursor-pointer group hover:h-2 transition-all"
                  style={{ touchAction: 'none' }}
                  onMouseDown={handleProgressMouseDown}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    handleProgressInteraction(touch.clientX);
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    handleProgressInteraction(touch.clientX);
                  }}
                >
                  {/* Buffered */}
                  <div
                    className="absolute h-full bg-white/15 rounded-full"
                    style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
                  />
                  {/* Progress */}
                  <motion.div
                    className="absolute h-full bg-brand-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                  {/* Draggable thumb */}
                  <div
                    className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -translate-y-1/2 top-1/2 pointer-events-none"
                    style={{ left: `calc(${progressPercent}% - 7px)` }}
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
            <div className="flex items-center justify-center gap-6 mt-6">
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
                className={`relative p-2 transition-colors active:scale-90 ${
                  repeat !== 'off' ? 'text-brand-500' : 'text-white/50 hover:text-white'
                }`}
                aria-label={`Repeat: ${repeat}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  {repeat === 'one' ? (
                    <>
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                      <text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor">1</text>
                    </>
                  ) : (
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                  )}
                </svg>
              </button>

              <button
                onClick={handleToggleLike}
                style={{ touchAction: 'manipulation' }}
                className={`p-2 transition-colors active:scale-90 ${
                  isLiked ? 'text-pink-500' : 'text-white/50 hover:text-white'
                }`}
                aria-label={isLiked ? 'Unlike track' : 'Like track'}
              >
                <motion.svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  animate={isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  fill={isLiked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={isLiked ? 0 : 2}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </motion.svg>
              </button>

              <button
                onClick={handleShare}
                style={{ touchAction: 'manipulation' }}
                className="p-2 text-white/50 hover:text-white transition-colors active:scale-90"
                aria-label="Share track"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <EffectsPanel />

              {/* Volume control */}
              <div
                className="relative flex items-center"
                onMouseEnter={() => setVolumeHover(true)}
                onMouseLeave={() => setVolumeHover(false)}
              >
                <button
                  onClick={toggleMute}
                  style={{ touchAction: 'manipulation' }}
                  className="p-2 text-white/50 hover:text-white transition-colors active:scale-90"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    {isMuted || volume === 0 ? (
                      <>
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </>
                    ) : volume < 0.5 ? (
                      <>
                        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                      </>
                    ) : (
                      <>
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </>
                    )}
                  </svg>
                </button>
                <AnimatePresence>
                  {volumeHover && (
                    <motion.div
                      ref={volumeSliderRef}
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 100 }}
                      exit={{ opacity: 0, width: 0 }}
                      className="relative h-1 bg-white/10 rounded-full cursor-pointer overflow-hidden"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        handleVolumeChange(percent);
                      }}
                    >
                      <div
                        className="absolute h-full bg-brand-500 rounded-full"
                        style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                      />
                      <div
                        className="absolute w-3 h-3 bg-white rounded-full shadow-lg -translate-y-1/2 top-1/2 pointer-events-none"
                        style={{ left: `calc(${(isMuted ? 0 : volume) * 100}% - 6px)` }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Toast notification */}
          <AnimatePresence>
            {showToast && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-surface-1 border border-white/10 rounded-full shadow-xl text-sm text-primary"
              >
                {toastMessage}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

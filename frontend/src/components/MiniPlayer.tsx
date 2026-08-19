import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { usePlayerStore, useUIStore, useCastStore } from '../stores';
import { getArtworkUrl, formatDuration } from '../lib/utils';
import { audioEngine } from '../lib/audio-engine';

export default function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    togglePlay,
    next,
    previous,
    setProgress,
    setDuration,
    setIsPlaying,
    setAudio,
    eqEnabled,
    eqBands,
  } = usePlayerStore();
  const { toggleNowPlaying, toggleQueue, queueOpen } = useUIStore();
  const { isCasting, activeTarget, stopCasting } = useCastStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-120, 0], [0, 1]);
  const scale = useTransform(y, [-120, 0], [0.95, 1]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Always create audio element on mount — never skip this
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
      setAudio(audio);

      const handleTimeUpdate = () => {
        setProgress(audio.currentTime * 1000);

        // Update MediaSession position state
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setPositionState({
            duration: audio.duration || 0,
            playbackRate: audio.playbackRate,
            position: audio.currentTime || 0,
          });
        }
      };

      const handleLoadedMetadata = () => {
        setDuration(audio.duration * 1000);
      };

      const handleEnded = () => {
        const state = usePlayerStore.getState();
        if (state.repeat === 'one') {
          audio.currentTime = 0;
          audio.play().catch((e) => console.warn('Loop play failed:', e));
        } else {
          state.next();
        }
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);

      const handleError = (e: Event) => {
        const err = (e.target as HTMLAudioElement).error;
        console.error('Audio error:', err?.code, err?.message);
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('error', handleError);

      // Set up MediaSession action handlers
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
          usePlayerStore.getState().togglePlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          usePlayerStore.getState().togglePlay();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          usePlayerStore.getState().previous();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          usePlayerStore.getState().next();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null) {
            usePlayerStore.getState().seek(details.seekTime * 1000);
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const offset = details.seekOffset || 10;
          const state = usePlayerStore.getState();
          state.seek(Math.max(0, state.progress - offset * 1000));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const offset = details.seekOffset || 10;
          const state = usePlayerStore.getState();
          state.seek(Math.min((state.duration || 0), state.progress + offset * 1000));
        });
      }

      // Handle media commands from Android lock screen / notification
      (window as any).__mediaCommand = (cmd: string) => {
        const state = usePlayerStore.getState();
        switch (cmd) {
          case 'play':
            if (!state.isPlaying) state.togglePlay();
            break;
          case 'pause':
            if (state.isPlaying) state.togglePlay();
            break;
          case 'next':
            state.next();
            break;
          case 'prev':
            state.previous();
            break;
          case 'stop':
            if (state.isPlaying) state.togglePlay();
            break;
        }
      };

      return () => {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('previoustrack', null);
          navigator.mediaSession.setActionHandler('nexttrack', null);
          navigator.mediaSession.setActionHandler('seekto', null);
          navigator.mediaSession.setActionHandler('seekbackward', null);
          navigator.mediaSession.setActionHandler('seekforward', null);
        }
        if ((window as any).__mediaCommand) {
          delete (window as any).__mediaCommand;
        }
        if (audioRef.current) {
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
          audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audioRef.current.removeEventListener('ended', handleEnded);
          audioRef.current.removeEventListener('play', handlePlay);
          audioRef.current.removeEventListener('pause', handlePause);
          audioRef.current.removeEventListener('error', handleError);
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
  }, []);

  useEffect(() => {
    if (audioEngine.isReady) {
      audioEngine.setEQEnabled(eqEnabled);
      eqBands.forEach((gain, i) => audioEngine.setEQBand(i, gain));
    }
  }, [eqEnabled, eqBands]);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.y < -80) {
      toggleNowPlaying();
    }
  }, [toggleNowPlaying]);

  if (!currentTrack) {
    return (
      <div className="flex-shrink-0 h-0" />
    );
  }

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <motion.div
      style={{ y, opacity, scale }}
      drag="y"
      dragConstraints={{ top: -120, bottom: 0 }}
      dragElastic={0.3}
      onDragEnd={handleDragEnd}
      className="fixed bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] left-0 right-0 w-full max-w-full overflow-hidden bg-surface-1 border-t border-white/10 touch-pan-y z-30 safe-bottom"
    >
      {/* Progress bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 bg-white/5 cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          usePlayerStore.getState().seek(percent * duration);
        }}
        onTouchStart={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const touch = e.touches[0];
          const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
          usePlayerStore.getState().seek(percent * duration);
        }}
        onTouchMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const touch = e.touches[0];
          const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
          usePlayerStore.getState().seek(percent * duration);
        }}
      >
        <div
          className="h-full bg-brand-500 transition-all duration-100"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="absolute w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -translate-y-1/2 top-1/2"
          style={{ left: `calc(${progressPercent}% - 6px)` }}
        />
      </div>

      <div className="flex items-center gap-3 px-3 py-2 max-w-screen-2xl mx-auto">
        {/* Artwork - tap to open full player */}
        <button
          onClick={toggleNowPlaying}
          className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 album-shadow active:scale-95 transition-transform"
          aria-label="Open full player"
        >
          {currentTrack.has_artwork ? (
            <img
              src={getArtworkUrl(currentTrack.id)}
              alt={currentTrack.album}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-600/30 to-surface-2 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <button onClick={toggleNowPlaying} className="block text-left w-full">
            <p className="text-sm font-medium text-primary truncate">{currentTrack.title}</p>
            <p className="text-xs text-secondary truncate">{currentTrack.artist}</p>
          </button>
        </div>

        {/* Cast indicator */}
        {isCasting && (
          <button
            onClick={stopCasting}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs flex-shrink-0"
            title={`Casting to ${activeTarget?.name}`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
            </svg>
            <span className="hidden md:inline">{activeTarget?.name}</span>
          </button>
        )}

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={previous}
            className="p-3 text-white/60 hover:text-white active:text-white transition-colors"
            aria-label="Previous track"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={next}
            className="p-3 text-white/60 hover:text-white active:text-white transition-colors"
            aria-label="Next track"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          <button
            onClick={toggleQueue}
            className={`p-3 transition-colors ${queueOpen ? 'text-brand-500' : 'text-white/60 hover:text-white'}`}
            aria-label={queueOpen ? 'Close queue' : 'Open queue'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>

          {/* Time */}
          <div className="text-xs text-tertiary hidden md:block ml-2">
            {formatDuration(progress)} / {formatDuration(duration)}
          </div>
        </div>
      </div>

      {/* Swipe up hint */}
      {isMobile && (
        <div className="flex justify-center pb-1">
          <div className="w-8 h-1 rounded-full bg-white/20" />
        </div>
      )}
    </motion.div>
  );
}

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore, useUIStore } from '../stores';
import { getArtworkUrl, formatDuration } from '../lib/utils';

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
  } = usePlayerStore();
  const { toggleNowPlaying, toggleQueue, queueOpen } = useUIStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
      setAudio(audio);

      audio.addEventListener('timeupdate', () => {
        setProgress(audio.currentTime * 1000);
      });

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration * 1000);
      });

      audio.addEventListener('ended', () => {
        usePlayerStore.getState().next();
      });

      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-white/10 safe-bottom"
    >
      {/* Progress bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1 bg-white/5 cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
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

      <div className="flex items-center gap-3 px-4 py-2 max-w-screen-2xl mx-auto">
        {/* Artwork */}
        <button
          onClick={toggleNowPlaying}
          className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 album-shadow"
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

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={previous}
            className="p-2 text-white/60 hover:text-white transition-colors hidden sm:block"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
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
            className="p-2 text-white/60 hover:text-white transition-colors hidden sm:block"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          <button
            onClick={toggleQueue}
            className={`p-2 transition-colors hidden sm:block ${queueOpen ? 'text-brand-500' : 'text-white/60 hover:text-white'}`}
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
    </motion.div>
  );
}

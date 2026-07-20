import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore, useUIStore } from '../stores';
import { getArtworkUrl } from '../lib/utils';

export default function NowPlaying() {
  const { currentTrack, isPlaying, progress, duration, next, previous, togglePlay, seek } = usePlayerStore();
  const { nowPlayingOpen, toggleNowPlaying, lyricsOpen, toggleLyrics } = useUIStore();
  const [artworkError, setArtworkError] = useState(false);

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

          {/* Close button */}
          <button
            onClick={toggleNowPlaying}
            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
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
            <div className="flex items-center gap-4 text-xs text-tertiary mb-6">
              {currentTrack.codec && (
                <span className="px-2 py-1 rounded-lg bg-white/5">{currentTrack.codec}</span>
              )}
              {currentTrack.sample_rate && (
                <span>{(currentTrack.sample_rate / 1000).toFixed(1)}kHz</span>
              )}
              {currentTrack.bit_depth && <span>{currentTrack.bit_depth}bit</span>}
              {currentTrack.bitrate && <span>{currentTrack.bitrate}kbps</span>}
            </div>

            {/* Waveform visualization */}
            <div className="w-full h-12 flex items-end justify-center gap-[2px] mb-4">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full bg-brand-500/60"
                  animate={{
                    height: isPlaying
                      ? `${20 + Math.random() * 80}%`
                      : '20%',
                  }}
                  transition={{
                    duration: 0.3 + Math.random() * 0.4,
                    repeat: isPlaying ? Infinity : 0,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full mb-4">
              <div
                className="relative w-full h-1 bg-white/10 rounded-full cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
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
                <span>{formatTime(progress / 1000)}</span>
                <span>{formatTime(duration / 1000)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
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
            </div>

            {/* Secondary controls */}
            <div className="flex items-center gap-8 mt-6">
              <button onClick={previous} className="text-white/60 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>
              <button onClick={next} className="text-white/60 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
              <button
                onClick={toggleLyrics}
                className={`text-sm transition-colors ${lyricsOpen ? 'text-brand-500' : 'text-white/60 hover:text-white'}`}
              >
                Lyrics
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

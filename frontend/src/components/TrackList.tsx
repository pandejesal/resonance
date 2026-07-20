import React from 'react';
import { motion } from 'framer-motion';
import type { Track } from '../types';
import { usePlayerStore } from '../stores';
import { formatDuration, getArtworkUrl, cn } from '../lib/utils';

interface TrackListProps {
  tracks: Track[];
  showAlbum?: boolean;
  showArtwork?: boolean;
  className?: string;
}

export default function TrackList({ tracks, showAlbum = true, showArtwork = true, className }: TrackListProps) {
  const { playTrack, currentTrack, isPlaying } = usePlayerStore();

  return (
    <div className={cn('space-y-1', className)}>
      {tracks.map((track, index) => {
        const isActive = currentTrack?.id === track.id;

        return (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.02, 0.5) }}
            className={cn(
              'group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200',
              isActive
                ? 'bg-brand-600/20 text-brand-400'
                : 'hover:bg-white/5 text-primary'
            )}
            onClick={() => playTrack(track, tracks)}
          >
            {/* Track number / Play indicator */}
            <div className="w-8 text-center text-sm text-tertiary group-hover:hidden">
              {isActive && isPlaying ? (
                <div className="flex items-center justify-center gap-[2px]">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-[2px] bg-brand-500 rounded-full"
                      animate={{ height: [4, 12, 4] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <div className="w-8 text-center hidden group-hover:block">
              <svg className="w-4 h-4 mx-auto text-brand-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>

            {/* Artwork */}
            {showArtwork && (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                {track.has_artwork ? (
                  <img
                    src={getArtworkUrl(track.id)}
                    alt={track.album}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium truncate', isActive ? 'text-brand-400' : 'text-primary')}>
                {track.title}
              </p>
              <p className="text-xs text-secondary truncate">{track.artist}</p>
            </div>

            {/* Album */}
            {showAlbum && (
              <div className="hidden md:block flex-1 min-w-0">
                <p className="text-sm text-secondary truncate">{track.album}</p>
              </div>
            )}

            {/* Duration */}
            <div className="text-xs text-tertiary">
              {formatDuration(track.duration_ms)}
            </div>

            {/* More button */}
            <button
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-all"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <svg className="w-4 h-4 text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

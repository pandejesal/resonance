import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Track } from '../types';
import { usePlayerStore } from '../stores';
import { formatDuration, getArtworkUrl, cn } from '../lib/utils';
import MetadataEditor from './MetadataEditor';

interface TrackListProps {
  tracks: Track[];
  showAlbum?: boolean;
  showArtwork?: boolean;
  showRating?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onMetadataSaved?: () => void;
  className?: string;
}

export default function TrackList({ tracks, showAlbum = true, showArtwork = true, showRating = true, selectedIds, onToggleSelect, onMetadataSaved, className }: TrackListProps) {
  const { playTrack, addToQueue, currentTrack, isPlaying } = usePlayerStore();
  const selectionMode = selectedIds !== undefined && onToggleSelect !== undefined;
  const [contextMenuTrack, setContextMenuTrack] = useState<Track | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenuTrack) return;
    const handle = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuTrack(null);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [contextMenuTrack]);

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
              selectionMode && selectedIds?.has(track.id)
                ? 'bg-brand-600/20 ring-1 ring-brand-500/40'
                : isActive
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'active:bg-white/10 text-primary'
            )}
            onClick={() => {
              if (selectionMode) {
                onToggleSelect(track.id);
              } else {
                playTrack(track, tracks);
              }
            }}
          >
            {/* Checkbox */}
            {selectionMode && (
              <div className="w-6 flex-shrink-0 flex items-center justify-center">
                <div
                  className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
                    selectedIds?.has(track.id)
                      ? 'bg-brand-500 border-brand-500'
                      : 'border-white/30'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(track.id);
                  }}
                >
                  {selectedIds?.has(track.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* Track number / Play indicator */}
            {!selectionMode && (
              <>
            <div className="w-8 text-center text-sm text-tertiary group-hover:hidden max-md:hidden">
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
            <div className="w-8 text-center hidden group-hover:block max-md:hidden">
              <svg className="w-4 h-4 mx-auto text-brand-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            {/* Mobile: always show play icon or track number */}
            <div className="w-8 text-center md:hidden">
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
                <span className="text-sm text-tertiary">{index + 1}</span>
              )}
            </div>
              </>
            )}

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

            {/* Rating indicator */}
            {showRating && track.rating != null && track.rating > 0 && (
              <div className="hidden sm:flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    viewBox="0 0 24 24"
                    className={cn(
                      'w-3 h-3',
                      star <= (track.rating ?? 0) ? 'text-[#1DB954]' : 'text-white/10'
                    )}
                    fill={star <= (track.rating ?? 0) ? '#1DB954' : 'none'}
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                ))}
              </div>
            )}

            {/* Duration */}
            <div className="text-xs text-tertiary">
              {formatDuration(track.duration_ms)}
            </div>

            {/* More button - always visible on mobile */}
            <button
              className="p-1.5 rounded-lg active:bg-white/10 transition-all md:opacity-0 md:group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setContextMenuTrack(track);
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

      {/* Context menu - bottom sheet on mobile, positioned menu on desktop */}
      <AnimatePresence>
        {contextMenuTrack && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[89]"
              onClick={() => setContextMenuTrack(null)}
            />
            {/* Menu */}
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed z-[90] bg-surface-1 border border-white/10 shadow-xl overflow-hidden
                bottom-0 left-0 right-0 rounded-t-2xl
                md:bottom-auto md:left-auto md:right-auto md:top-1/2 md:-translate-y-1/2 md:w-48 md:rounded-xl md:rounded-t-xl"
            >
              <div className="md:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="px-2 py-1 md:p-0">
                <p className="px-3 py-2 text-xs text-tertiary truncate md:hidden">{contextMenuTrack.title}</p>
                <button
                  className="w-full px-3 py-3 flex items-center gap-3 active:bg-white/5 transition-colors text-sm text-primary text-left rounded-xl"
                  onClick={() => {
                    setEditingTrack(contextMenuTrack);
                    setContextMenuTrack(null);
                  }}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Metadata
                </button>
                <button
                  className="w-full px-3 py-3 flex items-center gap-3 active:bg-white/5 transition-colors text-sm text-primary text-left rounded-xl"
                  onClick={() => {
                    addToQueue(contextMenuTrack);
                    setContextMenuTrack(null);
                  }}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add to Queue
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Metadata editor */}
      {editingTrack && (
        <MetadataEditor
          track={editingTrack}
          isOpen={true}
          onClose={() => setEditingTrack(null)}
          onSave={() => {
            onMetadataSaved?.();
            setEditingTrack(null);
          }}
        />
      )}
    </div>
  );
}

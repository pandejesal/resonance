import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { usePlayerStore, useUIStore } from '../stores';
import { formatDuration, getArtworkUrl, cn } from '../lib/utils';
import type { QueueItem } from '../types';

export default function QueuePanel() {
  const {
    queue,
    queueIndex,
    currentTrack,
    isPlaying,
    removeFromQueue,
    moveInQueue,
    clearQueue,
    playTrack,
  } = usePlayerStore();
  const { queueOpen, toggleQueue } = useUIStore();

  const upcomingTracks = queue.slice(queueIndex + 1);

  return (
    <AnimatePresence>
      {queueOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed top-0 right-0 h-full w-80 glass-strong border-l border-white/10 z-40 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-primary">Queue</h2>
            <div className="flex items-center gap-2">
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="text-xs text-secondary hover:text-primary transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={toggleQueue}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Queue items */}
          <div className="flex-1 overflow-y-auto p-2">
            {queue.length === 0 ? (
              <div className="py-12 text-center text-secondary text-sm">
                Queue is empty
              </div>
            ) : (
              <>
                {/* Now playing */}
                {currentTrack && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-tertiary px-2 mb-2">Now Playing</h3>
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-brand-600/10">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                        {currentTrack.has_artwork ? (
                          <img
                            src={getArtworkUrl(currentTrack.id)}
                            alt={currentTrack.album}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-400 truncate">{currentTrack.title}</p>
                        <p className="text-xs text-secondary truncate">{currentTrack.artist}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Up next */}
                {upcomingTracks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-tertiary px-2 mb-2">
                      Up Next ({upcomingTracks.length})
                    </h3>
                    <div className="space-y-1">
                      {upcomingTracks.map((item, index) => (
                        <QueueItemRow
                          key={`${item.track.id}-${index}`}
                          item={item}
                          index={index}
                          onRemove={() => removeFromQueue(queueIndex + 1 + index)}
                          onPlay={() => {
                            const tracks = queue.map((q) => q.track);
                            playTrack(item.track, tracks);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QueueItemRow({
  item,
  index,
  onRemove,
  onPlay,
}: {
  item: QueueItem;
  index: number;
  onRemove: () => void;
  onPlay: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 transition-colors"
    >
      <button
        onClick={onPlay}
        className="flex-1 flex items-center gap-2 text-left min-w-0"
      >
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
          {item.track.has_artwork ? (
            <img
              src={getArtworkUrl(item.track.id)}
              alt={item.track.album}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-surface-2 flex items-center justify-center">
              <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary truncate">{item.track.title}</p>
          <p className="text-xs text-secondary truncate">{item.track.artist}</p>
        </div>
        <span className="text-xs text-tertiary">{formatDuration(item.track.duration_ms)}</span>
      </button>

      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-all"
      >
        <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

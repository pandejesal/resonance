import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { usePlayerStore, useUIStore } from '../stores';
import { formatDuration, getArtworkUrl, cn } from '../lib/utils';
import { api } from '../lib/api';
import { toast } from './Toast';
import SmartQueue from './SmartQueue';
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
  const [smartQueueOpen, setSmartQueueOpen] = useState(false);

  const upcomingTracks = queue.slice(queueIndex + 1);

  const totalDurationMs = queue.reduce((acc, item) => acc + item.track.duration_ms, 0);
  const trackCount = queue.length;

  const saveAsPlaylist = useCallback(async () => {
    if (queue.length === 0) return;
    const name = window.prompt('Enter playlist name:');
    if (!name) return;
    try {
      const playlist = await api.playlists.create({ name });
      for (const item of queue) {
        await api.playlists.addTrack(playlist.id, item.track.id);
      }
      toast.success(`Playlist "${name}" created with ${queue.length} tracks`);
    } catch (e) {
      toast.error('Failed to create playlist');
    }
  }, [queue]);

  return (
    <AnimatePresence>
      {queueOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed top-0 right-0 h-full w-80 max-w-[calc(100vw-1rem)] glass-strong border-l border-white/10 z-40 flex flex-col"
        >
          {/* Header */}
          <div className="px-4 py-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-primary">Queue</h2>
              <div className="flex items-center gap-2">
                {/* Smart Queue toggle */}
                <button
                  onClick={() => setSmartQueueOpen(!smartQueueOpen)}
                  className={cn(
                    'px-2 py-1 rounded-lg text-xs font-medium transition-all',
                    smartQueueOpen
                      ? 'bg-brand-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  )}
                  aria-label={smartQueueOpen ? 'Disable smart queue' : 'Enable smart queue'}
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Smart
                  </span>
                </button>
                {queue.length > 0 && (
                  <>
                    <button
                      onClick={saveAsPlaylist}
                      className="text-xs text-secondary hover:text-primary transition-colors"
                      aria-label="Save queue as playlist"
                    >
                      Save
                    </button>
                    <button
                      onClick={clearQueue}
                      className="text-xs text-secondary hover:text-primary transition-colors"
                      aria-label="Clear queue"
                    >
                      Clear
                    </button>
                  </>
                )}
                <button
                  onClick={toggleQueue}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close queue"
                >
                  <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {trackCount > 0 && (
              <div className="mt-2 text-xs text-tertiary">
                {trackCount} {trackCount === 1 ? 'track' : 'tracks'} &middot; {formatDuration(totalDurationMs)}
              </div>
            )}
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

      {/* Smart Queue floating panel */}
      <SmartQueue isOpen={smartQueueOpen} onClose={() => setSmartQueueOpen(false)} />
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
        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-all touch-visible"
        aria-label={`Remove ${item.track.title} from queue`}
      >
        <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

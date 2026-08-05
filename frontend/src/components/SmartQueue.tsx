import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../stores';
import { getArtworkUrl, formatDuration, cn } from '../lib/utils';
import { api } from '../lib/api';
import type { Track } from '../types';

interface SmartQueueProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SmartQueue({ isOpen, onClose }: SmartQueueProps) {
  const {
    currentTrack, queue, queueIndex, addToQueue,
  } = usePlayerStore();
  const [suggestions, setSuggestions] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [smartEnabled, setSmartEnabled] = useState(() => {
    const saved = localStorage.getItem('resonance-smart-queue');
    return saved ? JSON.parse(saved) : false;
  });
  const lastAutoAddRef = useRef<string>('');

  // Save smart queue preference
  useEffect(() => {
    localStorage.setItem('resonance-smart-queue', JSON.stringify(smartEnabled));
  }, [smartEnabled]);

  // Fetch suggestions based on current track's genre/mood
  const fetchSuggestions = useCallback(async () => {
    if (!currentTrack) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (currentTrack.genre) {
        params.genre = currentTrack.genre;
      } else if (currentTrack.mood) {
        params.mood = currentTrack.mood;
      } else {
        // Fallback: use artist to find similar tracks
        params.artist = currentTrack.artist;
      }

      const response = await api.tracks.list(params);
      // Filter out tracks already in queue and current track
      const queueTrackIds = new Set(queue.map((q) => q.track.id));
      const filtered = response.items.filter(
        (track) => track.id !== currentTrack.id && !queueTrackIds.has(track.id)
      );
      setSuggestions(filtered.slice(0, 10));
    } catch (e) {
      console.error('Failed to fetch smart queue suggestions:', e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [currentTrack, queue]);

  // Fetch suggestions when current track changes or panel opens
  useEffect(() => {
    if (isOpen && currentTrack) {
      fetchSuggestions();
    }
  }, [isOpen, currentTrack?.id, fetchSuggestions]);

  // Auto-add tracks when queue runs low
  useEffect(() => {
    if (!smartEnabled || !currentTrack) return;

    const remainingTracks = queue.length - queueIndex - 1;
    if (remainingTracks < 3 && suggestions.length > 0) {
      const nextTrack = suggestions[0];
      if (nextTrack && lastAutoAddRef.current !== nextTrack.id) {
        lastAutoAddRef.current = nextTrack.id;
        addToQueue(nextTrack);
        setSuggestions((prev) => prev.filter((t) => t.id !== nextTrack.id));
      }
    }
  }, [smartEnabled, queue, queueIndex, suggestions, currentTrack, addToQueue]);

  const handleAddTrack = useCallback((track: Track) => {
    addToQueue(track);
    setSuggestions((prev) => prev.filter((t) => t.id !== track.id));
  }, [addToQueue]);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-32 right-4 w-80 max-h-96 bg-surface-1 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-40 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-primary">Smart Queue</h3>
                <p className="text-xs text-tertiary">
                  {currentTrack.genre || currentTrack.mood || 'Similar artists'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close smart queue"
            >
              <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Smart Queue Toggle */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Auto-add tracks</span>
                {smartEnabled && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400">
                    &lt;3 remaining
                  </span>
                )}
              </div>
              <button
                onClick={() => setSmartEnabled(!smartEnabled)}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  smartEnabled ? 'bg-brand-500' : 'bg-white/20'
                )}
                aria-label={smartEnabled ? 'Disable smart queue' : 'Enable smart queue'}
              >
                <motion.div
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
                  animate={{ left: smartEnabled ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>

          {/* Suggestions list */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-tertiary">No suggestions available</p>
                <p className="text-xs text-tertiary mt-1">
                  {currentTrack.genre
                    ? `Try playing tracks from ${currentTrack.genre}`
                    : 'Add more tracks to your library'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {suggestions.map((track) => (
                  <motion.div
                    key={track.id}
                    layout
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="group flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      {track.has_artwork ? (
                        <img
                          src={getArtworkUrl(track.id)}
                          alt={track.album}
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
                      <p className="text-sm text-primary truncate">{track.title}</p>
                      <p className="text-xs text-secondary truncate">{track.artist}</p>
                    </div>
                    <span className="text-xs text-tertiary mr-1">{formatDuration(track.duration_ms)}</span>
                    <button
                      onClick={() => handleAddTrack(track)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 transition-all"
                      aria-label={`Add ${track.title} to queue`}
                    >
                      <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

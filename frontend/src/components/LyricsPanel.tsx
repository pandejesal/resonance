import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../stores';
import { api } from '../lib/api';
import type { LyricsLine, LyricsData } from '../types';

function parseLrc(lrc: string): LyricsLine[] {
  const lines: LyricsLine[] = [];
  for (const line of lrc.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('[')) continue;

    const match = trimmed.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = match[3].length === 2
        ? parseInt(match[3], 10) * 10
        : parseInt(match[3], 10);
      const timeMs = minutes * 60_000 + seconds * 1000 + millis;
      const text = match[4].trim();
      if (text) {
        lines.push({ timeMs, text });
      }
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

export default function LyricsPanel() {
  const { currentTrack, progress } = usePlayerStore();
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const syncedLines = useMemo(() => {
    if (!lyrics?.synced) return [];
    return parseLrc(lyrics.synced);
  }, [lyrics?.synced]);

  const hasSyncedLyrics = syncedLines.length > 0;

  const activeLineIndex = useMemo(() => {
    if (!hasSyncedLyrics) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (progress >= syncedLines[i].timeMs) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [progress, syncedLines, hasSyncedLyrics]);

  useEffect(() => {
    if (!currentTrack) return;
    setLoading(true);
    api.tracks.getLyrics(currentTrack.id)
      .then(setLyrics)
      .catch(() => setLyrics(null))
      .finally(() => setLoading(false));
  }, [currentTrack?.id]);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeLineRef.current;
      const containerHeight = container.clientHeight;
      const activeTop = active.offsetTop;
      const activeHeight = active.clientHeight;
      const scrollTo = activeTop - containerHeight / 2 + activeHeight / 2;
      container.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }
  }, [activeLineIndex]);

  const handleFetch = async () => {
    if (!currentTrack) return;
    setFetching(true);
    try {
      const result = await api.tracks.fetchLyrics(currentTrack.id);
      setLyrics(result);
    } catch (e) {
      console.error('Failed to fetch lyrics:', e);
    } finally {
      setFetching(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!currentTrack) return;
    try {
      await api.tracks.updateLyrics(currentTrack.id, editText);
      const updated = await api.tracks.getLyrics(currentTrack.id);
      setLyrics(updated);
      setEditing(false);
    } catch (e) {
      console.error('Failed to save lyrics:', e);
    }
  };

  const startEditing = () => {
    setEditText(lyrics?.synced || lyrics?.plain || '');
    setEditing(true);
  };

  if (!currentTrack) return null;

  return (
    <div className="w-full h-48 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-semibold text-primary">Lyrics</h3>
        <div className="flex gap-2">
          {!lyrics?.plain && !lyrics?.synced && !loading && (
            <button
              onClick={handleFetch}
              disabled={fetching}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
            >
              {fetching ? 'Fetching...' : 'Fetch Lyrics'}
            </button>
          )}
          {lyrics && !editing && (
            <button
              onClick={startEditing}
              className="text-xs text-tertiary hover:text-primary transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-hide mask-gradient"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full h-32 bg-surface-2 rounded-xl p-3 text-sm text-primary resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Paste lyrics here (LRC format for synced lyrics)..."
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1 text-xs text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : hasSyncedLyrics ? (
          <div className="space-y-1 py-4">
            {syncedLines.map((line, i) => (
              <div
                key={`${line.timeMs}-${i}`}
                ref={i === activeLineIndex ? activeLineRef : undefined}
                className={`px-2 py-1 rounded-lg transition-all duration-300 cursor-pointer hover:bg-white/5 ${
                  i === activeLineIndex
                    ? 'text-brand-400 text-base font-semibold scale-105'
                    : i < activeLineIndex
                    ? 'text-tertiary text-sm'
                    : 'text-secondary text-sm'
                }`}
                onClick={() => {
                  usePlayerStore.getState().seek(line.timeMs);
                }}
              >
                {line.text}
              </div>
            ))}
          </div>
        ) : lyrics?.plain ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-secondary text-sm text-center whitespace-pre-wrap leading-relaxed">
              {lyrics.plain}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-tertiary text-sm">No lyrics available</p>
            <button
              onClick={handleFetch}
              disabled={fetching}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
            >
              {fetching ? 'Searching...' : 'Search for lyrics'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

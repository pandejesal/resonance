import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { usePlayerStore } from '../stores';
import type { ListeningHistoryEntry } from '../types';

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function MusicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export default function HistoryPage() {
  const [history, setHistory] = useState<ListeningHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayerStore();

  useEffect(() => {
    api.history.get(100).then(setHistory).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handlePlayTrack = async (entry: ListeningHistoryEntry) => {
    try {
      const track = await api.tracks.get(entry.track_id);
      playTrack(track);
    } catch {
      // silently fail
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <ClockIcon className="w-6 h-6 text-brand-500" />
        <h1 className="text-2xl font-bold text-primary">Listening History</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-secondary">
          <MusicIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No listening history yet</p>
          <p className="text-sm mt-1 text-tertiary">Start playing some tracks!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {history.map((entry, i) => (
            <motion.div
              key={`${entry.track_id}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
              onClick={() => handlePlayTrack(entry)}
            >
              <div className="w-8 text-center text-sm text-white/40 group-hover:hidden">{i + 1}</div>
              <PlayIcon className="w-4 h-4 text-brand-500 hidden group-hover:block" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary truncate">{entry.title}</div>
                <div className="text-xs text-secondary truncate">{entry.artist}</div>
              </div>
              <div className="text-sm text-tertiary">
                {new Date(entry.played_at).toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

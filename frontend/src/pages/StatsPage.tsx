import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { formatDuration, formatNumber, formatDurationLong, formatFileSize, getArtworkUrl, cn } from '../lib/utils';
import { usePlayerStore } from '../stores';
import type { Stats } from '../types';

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayerStore();

  useEffect(() => {
    api.stats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-12 text-secondary">Failed to load statistics</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Statistics</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Tracks', value: formatNumber(stats.total_tracks), color: 'from-blue-500/20 to-blue-600/20' },
          { label: 'Total Albums', value: formatNumber(stats.total_albums), color: 'from-purple-500/20 to-purple-600/20' },
          { label: 'Total Artists', value: formatNumber(stats.total_artists), color: 'from-pink-500/20 to-pink-600/20' },
          { label: 'Total Duration', value: formatDurationLong(stats.total_duration_ms), color: 'from-green-500/20 to-green-600/20' },
          { label: 'Library Size', value: formatFileSize(stats.total_size_bytes), color: 'from-orange-500/20 to-orange-600/20' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="surface-card p-4"
          >
            <p className="text-xs text-secondary mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-primary">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Top artists */}
      {stats.top_artists.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-primary mb-3">Top Artists</h2>
          <div className="space-y-2">
            {stats.top_artists.map((artist, i) => (
              <motion.div
                key={artist.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <span className="w-8 text-center text-lg font-bold text-brand-500">{i + 1}</span>
                <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{artist.name}</p>
                  <p className="text-xs text-secondary">{artist.track_count} tracks</p>
                </div>
                <div className="w-20 sm:w-32 bg-surface-2 rounded-full h-2 overflow-hidden flex-shrink-0">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{
                      width: `${(artist.track_count / (stats.top_artists[0]?.track_count || 1)) * 100}%`,
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Most played */}
      {stats.most_played.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-primary mb-3">Most Played</h2>
          <div className="space-y-1">
            {stats.most_played.map((track, i) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => playTrack(track, stats.most_played)}
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
                  <p className="text-sm font-medium text-primary truncate">{track.title}</p>
                  <p className="text-xs text-secondary truncate">{track.artist}</p>
                </div>
                <span className="text-sm font-medium text-brand-500">{track.play_count}</span>
                <span className="text-xs text-tertiary">{formatDuration(track.duration_ms)}</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

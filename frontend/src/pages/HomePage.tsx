import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDuration, formatDurationLong, formatFileSize, formatNumber, getArtworkUrl, cn } from '../lib/utils';
import { usePlayerStore } from '../stores';
import { AlbumCard } from '../components/Cards';
import type { Stats, Track, Album } from '../types';

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentAlbums, setRecentAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayerStore();

  useEffect(() => {
    Promise.all([
      api.stats().catch(() => null),
      api.albums.list({ sort: 'date_added', order: 'DESC', per_page: 12 }).catch(() => ({ items: [], total: 0, page: 1, per_page: 12, total_pages: 1 })),
    ]).then(([statsData, albumsData]) => {
      setStats(statsData);
      setRecentAlbums(albumsData.items);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-primary mb-2"
        >
          Welcome to Resonance
        </motion.h1>
        <p className="text-secondary">
          {stats ? (
            <>
              {formatNumber(stats.total_tracks)} tracks across {formatNumber(stats.total_albums)} albums
              from {formatNumber(stats.total_artists)} artists
            </>
          ) : (
            'Add a library to get started'
          )}
        </p>
      </div>

      {/* Quick stats */}
      {stats && stats.total_tracks > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Tracks', value: formatNumber(stats.total_tracks), icon: '🎵' },
            { label: 'Albums', value: formatNumber(stats.total_albums), icon: '💿' },
            { label: 'Artists', value: formatNumber(stats.total_artists), icon: '👤' },
            { label: 'Duration', value: formatDurationLong(stats.total_duration_ms), icon: '⏱️' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="surface-card p-4"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <p className="text-2xl font-bold text-primary">{stat.value}</p>
              <p className="text-sm text-secondary">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recently added */}
      {recentAlbums.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-primary">Recently Added</h2>
            <Link to="/albums" className="text-sm text-brand-500 hover:text-brand-400 transition-colors">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}

      {/* Recently played */}
      {stats && stats.recently_played.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-primary mb-4">Recently Played</h2>
          <div className="space-y-1">
            {stats.recently_played.slice(0, 5).map((track, i) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => playTrack(track, stats.recently_played)}
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
                <span className="text-xs text-tertiary">{formatDuration(track.duration_ms)}</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Most played */}
      {stats && stats.most_played.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-primary mb-4">Most Played</h2>
          <div className="space-y-1">
            {stats.most_played.slice(0, 5).map((track, i) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => playTrack(track, stats.most_played)}
              >
                <span className="w-6 text-center text-sm text-tertiary">{i + 1}</span>
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
                <span className="text-xs text-tertiary">{track.play_count} plays</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {stats && stats.total_tracks === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-brand-600/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-primary mb-2">Your library is empty</h2>
          <p className="text-secondary mb-6">Add a music folder to start building your library</p>
          <Link to="/settings" className="btn-primary inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Library
          </Link>
        </motion.div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDuration, formatDurationLong, formatNumber, getArtworkUrl, cn } from '../lib/utils';
import { usePlayerStore } from '../stores';
import { AlbumCard } from '../components/Cards';
import type { Stats, Track, Album } from '../types';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function QuickPickCard({ track, queue, onClick }: { track: Track; queue: Track[]; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden transition-colors text-left group"
    >
      <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-l-xl overflow-hidden">
        {track.has_artwork ? (
          <img src={getArtworkUrl(track.id)} alt={track.album} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-600/30 to-surface-2 flex items-center justify-center">
            <svg className="w-6 h-6 text-white/20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>
      <span className="text-xs sm:text-sm font-medium text-primary truncate pr-3">{track.title}</span>
    </motion.button>
  );
}

function HorizontalTrackRow({ tracks, title, viewAllLink }: { tracks: Track[]; title: string; viewAllLink?: string }) {
  const { playTrack } = usePlayerStore();

  if (tracks.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-primary">{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink} className="text-xs font-semibold text-secondary hover:text-primary transition-colors">
            Show all
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {tracks.map((track, i) => (
          <motion.button
            key={track.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => playTrack(track, tracks)}
            className="flex-shrink-0 w-28 sm:w-36 snap-start group"
          >
            <div className="relative aspect-square rounded-xl overflow-hidden mb-2 album-shadow group-hover:shadow-lg transition-shadow">
              {track.has_artwork ? (
                <img src={getArtworkUrl(track.id)} alt={track.album} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-brand-600/20 to-surface-2 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-primary truncate">{track.title}</p>
            <p className="text-xs text-secondary truncate">{track.artist}</p>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

function HorizontalAlbumRow({ albums, title, viewAllLink }: { albums: Album[]; title: string; viewAllLink?: string }) {
  if (albums.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-primary">{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink} className="text-xs font-semibold text-secondary hover:text-primary transition-colors">
            Show all
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {albums.map((album, i) => (
          <motion.div
            key={album.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="flex-shrink-0 w-28 sm:w-36 snap-start"
          >
            <AlbumCard album={album} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentAlbums, setRecentAlbums] = useState<Album[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const { playTrack } = usePlayerStore();
  const navigate = useNavigate();
  const isAndroid = !!(window as any).AndroidBridge;

  useEffect(() => {
    Promise.all([
      api.stats().catch(() => null),
      api.albums.list({ sort: 'date_added', order: 'DESC', per_page: 12 }).catch(() => ({ items: [], total: 0, page: 1, per_page: 12, total_pages: 1 })),
      api.genres().catch(() => []),
    ]).then(([statsData, albumsData, genresData]) => {
      setStats(statsData);
      setRecentAlbums(albumsData.items);
      setGenres(genresData);
      setLoading(false);

      if (isAndroid && statsData && statsData.total_tracks === 0) {
        handleDeviceScan();
      }
    });
  }, []);

  const handleDeviceScan = async () => {
    if (!(window as any).AndroidBridge) return;
    setScanning(true);
    setScanResult('');
    try {
      const tracksJson = (window as any).AndroidBridge.scanDeviceMusic();
      const tracks = JSON.parse(tracksJson);
      if (tracks.length === 0) {
        setScanResult('No music files found on device');
        setScanning(false);
        return;
      }
      setScanResult(`Found ${tracks.length} tracks. Importing...`);
      const result = await api.import.deviceScan(null, tracks);
      setScanResult(`Added ${result.tracks_added} tracks!`);
      const [statsData, albumsData, genresData] = await Promise.all([
        api.stats().catch(() => null),
        api.albums.list({ sort: 'date_added', order: 'DESC', per_page: 12 }).catch(() => ({ items: [], total: 0, page: 1, per_page: 12, total_pages: 1 })),
        api.genres().catch(() => []),
      ]);
      setStats(statsData);
      setRecentAlbums(albumsData.items);
      setGenres(genresData);
    } catch (e: any) {
      setScanResult(`Scan failed: ${e.message || 'Unknown error'}`);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const quickPickTracks = stats?.recently_played.slice(0, 6) || [];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">
          {stats && stats.total_tracks > 0 ? getGreeting() : 'Welcome to Resonance'}
        </h1>
        {stats && stats.total_tracks > 0 && (
          <p className="text-sm text-secondary mt-1">
            {formatNumber(stats.total_tracks)} tracks across {formatNumber(stats.total_albums)} albums
          </p>
        )}
      </motion.div>

      {/* Empty state */}
      {stats && stats.total_tracks === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-brand-600/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM12 3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-primary mb-2">Your library is empty</h2>
          {isAndroid ? (
            <>
              <p className="text-secondary mb-6 text-sm">Scan your device to find all your music</p>
              <button
                onClick={handleDeviceScan}
                disabled={scanning}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                </svg>
                {scanning ? 'Scanning...' : 'Scan Device Music'}
              </button>
              {scanResult && <p className="text-sm text-secondary mt-4">{scanResult}</p>}
            </>
          ) : (
            <>
              <p className="text-secondary mb-6 text-sm">Add a music folder to start building your library</p>
              <Link to="/settings" className="btn-primary inline-flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Library
              </Link>
            </>
          )}
        </motion.div>
      )}

      {/* Quick Pick grid — Spotify-style 2x3 */}
      {quickPickTracks.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {quickPickTracks.slice(0, 6).map((track) => (
              <QuickPickCard
                key={track.id}
                track={track}
                queue={stats?.recently_played || []}
                onClick={() => playTrack(track, stats?.recently_played || [])}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* Recently Played — horizontal scroll */}
      {stats && stats.recently_played.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <HorizontalTrackRow tracks={stats.recently_played} title="Recently played" />
        </motion.div>
      )}

      {/* Recently Added — horizontal scroll */}
      {recentAlbums.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <HorizontalAlbumRow albums={recentAlbums} title="Recently added" viewAllLink="/albums" />
        </motion.div>
      )}

      {/* Most Played */}
      {stats && stats.most_played.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-primary">Most played</h2>
          </div>
          <div className="space-y-1">
            {stats.most_played.slice(0, 5).map((track, i) => (
              <motion.button
                key={track.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.04 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                onClick={() => playTrack(track, stats.most_played)}
              >
                <span className="w-6 text-center text-sm text-tertiary font-medium">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  {track.has_artwork ? (
                    <img src={getArtworkUrl(track.id)} alt={track.album} className="w-full h-full object-cover" />
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
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}

      {/* Browse by Genre */}
      {genres.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-primary">Browse by genre</h2>
            <Link to="/genres" className="text-xs font-semibold text-secondary hover:text-primary transition-colors">
              Show all
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {genres.slice(0, 12).map((genre) => (
              <button
                key={genre}
                onClick={() => navigate(`/genres?genre=${encodeURIComponent(genre)}`)}
                className="flex-shrink-0 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sm font-medium text-primary transition-colors border border-white/5"
              >
                {genre}
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {/* Quick Stats */}
      {stats && stats.total_tracks > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="pt-2"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Tracks', value: formatNumber(stats.total_tracks), icon: '🎵' },
              { label: 'Albums', value: formatNumber(stats.total_albums), icon: '💿' },
              { label: 'Artists', value: formatNumber(stats.total_artists), icon: '👤' },
              { label: 'Duration', value: formatDurationLong(stats.total_duration_ms), icon: '⏱️' },
            ].map((stat) => (
              <div key={stat.label} className="surface-card p-3 sm:p-4">
                <div className="text-lg mb-1">{stat.icon}</div>
                <p className="text-lg sm:text-xl font-bold text-primary">{stat.value}</p>
                <p className="text-xs text-secondary">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}

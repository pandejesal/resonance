import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, usePlayerStore } from '../stores';
import { api } from '../lib/api';
import { formatDuration, getArtworkUrl, cn } from '../lib/utils';
import type { Track, Album, Artist } from '../types';

export default function SearchModal() {
  const { searchOpen, toggleSearch } = useUIStore();
  const { playTrack } = usePlayerStore();
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setTracks([]);
      setAlbums([]);
      setArtists([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setTracks([]);
      setAlbums([]);
      setArtists([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.search(query, 10);
        setTracks(results.tracks);
        setAlbums(results.albums);
        setArtists(results.artists);
      } catch (e) {
        console.error('Search failed:', e);
      }
      setLoading(false);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
      }
      if (e.key === 'Escape' && searchOpen) {
        toggleSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, toggleSearch]);

  return (
    <AnimatePresence>
      {searchOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={toggleSearch}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-[10%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50"
          >
            <div className="glass-strong rounded-2xl overflow-hidden mx-4">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search songs, artists, albums..."
                  className="flex-1 bg-transparent text-primary placeholder-tertiary outline-none text-lg"
                />
                <kbd className="hidden sm:block text-xs text-tertiary px-2 py-1 rounded-lg bg-white/5">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {loading && (
                  <div className="py-8 text-center text-secondary">
                    <div className="inline-block w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {!loading && query && tracks.length === 0 && albums.length === 0 && artists.length === 0 && (
                  <div className="py-8 text-center text-secondary">
                    No results found for "{query}"
                  </div>
                )}

                {!loading && tracks.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-tertiary px-3 mb-2">Songs</h3>
                    {tracks.map((track) => (
                      <button
                        key={track.id}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                        onClick={() => {
                          playTrack(track, tracks);
                          toggleSearch();
                        }}
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
                          <p className="text-xs text-secondary truncate">{track.artist} - {track.album}</p>
                        </div>
                        <span className="text-xs text-tertiary">{formatDuration(track.duration_ms)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!loading && albums.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-tertiary px-3 mb-2">Albums</h3>
                    {albums.map((album) => (
                      <div
                        key={album.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          {album.has_artwork ? (
                            <img
                              src={getArtworkUrl(album.id)}
                              alt={album.title}
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
                          <p className="text-sm font-medium text-primary truncate">{album.title}</p>
                          <p className="text-xs text-secondary truncate">{album.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loading && artists.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-tertiary px-3 mb-2">Artists</h3>
                    {artists.map((artist) => (
                      <div
                        key={artist.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-surface-2 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{artist.name}</p>
                          <p className="text-xs text-secondary">{artist.track_count} tracks</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!query && (
                  <div className="py-8 text-center text-secondary text-sm">
                    Start typing to search your library
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { usePlayerStore, useUIStore } from '../stores';
import { formatDuration, getArtworkUrl, cn } from '../lib/utils';
import TrackList from '../components/TrackList';
import type { Track } from '../types';

type SortOption = { value: string; label: string; order: 'ASC' | 'DESC' };

const SORT_OPTIONS: SortOption[] = [
  { value: 'title', label: 'Title A-Z', order: 'ASC' },
  { value: 'title', label: 'Title Z-A', order: 'DESC' },
  { value: 'artist', label: 'Artist A-Z', order: 'ASC' },
  { value: 'artist', label: 'Artist Z-A', order: 'DESC' },
  { value: 'album', label: 'Album A-Z', order: 'ASC' },
  { value: 'album', label: 'Album Z-A', order: 'DESC' },
  { value: 'duration_ms', label: 'Duration (shortest)', order: 'ASC' },
  { value: 'duration_ms', label: 'Duration (longest)', order: 'DESC' },
  { value: 'date_added', label: 'Recently Added', order: 'DESC' },
  { value: 'play_count', label: 'Most Played', order: 'DESC' },
];

type FilterChip = { id: string; label: string; filter?: string; genre?: string; recent?: boolean; favorites?: boolean };

export default function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<string>('date_added');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [filter, setFilter] = useState<string>('');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [genreFilter, setGenreFilter] = useState<string>('');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { viewMode, setViewMode } = useUIStore();
  const observerRef = useRef<HTMLDivElement>(null);
  const filterTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const { playTrack, addToQueue } = usePlayerStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize from URL params
  useEffect(() => {
    const urlGenre = searchParams.get('genre');
    const urlSearch = searchParams.get('search');
    if (urlGenre) {
      setGenreFilter(urlGenre);
      setActiveChip(`genre-${urlGenre}`);
    }
    if (urlSearch) {
      setFilter(urlSearch);
    }
  }, []);

  const loadTracks = useCallback(async (pageNum: number, reset: boolean) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const params: Record<string, unknown> = {
        page: pageNum,
        per_page: 50,
        sort: sortField,
        order: sortOrder,
      };

      if (filter) params.search = filter;
      if (genreFilter) params.genre = genreFilter;
      if (activeChip === 'favorites') params.min_rating = 4;

      const result = await api.tracks.list(params as any);
      let items = result.items;

      if (activeChip === 'recent') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        items = items.filter((t: Track) => new Date(t.date_added) >= sevenDaysAgo);
      }

      if (reset) {
        setTracks(items);
      } else {
        setTracks((prev) => [...prev, ...items]);
      }
      setTotalPages(result.total_pages);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to load tracks:', e);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [sortField, sortOrder, filter, genreFilter, activeChip]);

  useEffect(() => {
    setTracks([]);
    setPage(1);
    loadTracks(1, true);
  }, [loadTracks]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && page < totalPages) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadTracks(nextPage, false);
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [page, totalPages, loading, loadingMore, loadTracks]);

  const handleFilterChange = (value: string) => {
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => {
      setFilter(value);
    }, 300);
  };

  const genres = useMemo(() => {
    const genreSet = new Set<string>();
    tracks.forEach((t) => {
      if (t.genre) genreSet.add(t.genre);
    });
    return Array.from(genreSet).sort();
  }, [tracks]);

  const handleChipClick = (chip: FilterChip) => {
    setActiveChip(chip.id);
    setGenreFilter(chip.genre || '');
  };

  const sortLabel = useMemo(() => {
    const match = SORT_OPTIONS.find((o) => o.value === sortField && o.order === sortOrder);
    return match?.label || 'Recently Added';
  }, [sortField, sortOrder]);

  const handleSortSelect = (option: SortOption) => {
    setSortField(option.value);
    setSortOrder(option.order);
    setShowSortDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePlayTrack = (track: Track) => {
    try {
      playTrack(track, tracks);
    } catch (e) {
      console.error('Failed to play track:', e);
    }
  };

  const handleAddToQueue = (track: Track) => {
    try {
      addToQueue(track);
    } catch (e) {
      console.error('Failed to add to queue:', e);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = tracks.length > 0 && tracks.every(t => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tracks.map(t => t.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await api.tracks.batchDelete(Array.from(selectedIds));
      setTracks(prev => prev.filter(t => !selectedIds.has(t.id)));
      setTotal(prev => prev - selectedIds.size);
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Failed to batch delete:', e);
    }
  };

  const handleBatchRate = async (rating: number) => {
    if (selectedIds.size === 0) return;
    try {
      await api.tracks.batchRate(Array.from(selectedIds), rating);
      setTracks(prev =>
        prev.map(t => selectedIds.has(t.id) ? { ...t, rating } : t)
      );
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Failed to batch rate:', e);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Library</h1>
          <p className="text-sm text-secondary">
            {total > 0 ? `${total} tracks` : 'Loading...'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Select All */}
          {tracks.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className={cn(
                'btn-secondary px-3 text-sm',
                allSelected && 'bg-brand-600/20 text-brand-400 border-brand-500/40'
              )}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filter}
              onChange={(e) => handleFilterChange(e.target.value)}
              placeholder="Filter tracks..."
              className="input-field pl-9 w-48"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="input-field w-auto flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <span className="hidden sm:inline">{sortLabel}</span>
            </button>
            <AnimatePresence>
              {showSortDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-1 w-52 bg-gray-800 border border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={`${option.value}-${option.order}`}
                      onClick={() => handleSortSelect(option)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm transition-colors',
                        sortField === option.value && sortOrder === option.order
                          ? 'bg-brand-600/20 text-brand-400'
                          : 'text-secondary hover:bg-white/5 hover:text-primary'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list' ? 'bg-brand-600/20 text-brand-400' : 'text-tertiary hover:text-secondary'
              )}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'grid' ? 'bg-brand-600/20 text-brand-400' : 'text-tertiary hover:text-secondary'
              )}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      {!loading && tracks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleChipClick({ id: 'all', label: 'All' })}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full border transition-all',
              activeChip === 'all'
                ? 'bg-brand-600/20 text-brand-400 border-brand-500/40'
                : 'bg-white/5 text-secondary border-white/10 hover:border-white/20 hover:text-primary'
            )}
          >
            All
          </button>
          <button
            onClick={() => handleChipClick({ id: 'recent', label: 'Recent', recent: true })}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full border transition-all',
              activeChip === 'recent'
                ? 'bg-brand-600/20 text-brand-400 border-brand-500/40'
                : 'bg-white/5 text-secondary border-white/10 hover:border-white/20 hover:text-primary'
            )}
          >
            Recent
          </button>
          <button
            onClick={() => handleChipClick({ id: 'favorites', label: 'Favorites', favorites: true })}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full border transition-all',
              activeChip === 'favorites'
                ? 'bg-brand-600/20 text-brand-400 border-brand-500/40'
                : 'bg-white/5 text-secondary border-white/10 hover:border-white/20 hover:text-primary'
            )}
          >
            Favorites
          </button>
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => handleChipClick({ id: `genre-${genre}`, label: genre, genre })}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-all',
                activeChip === `genre-${genre}`
                  ? 'bg-brand-600/20 text-brand-400 border-brand-500/40'
                  : 'bg-white/5 text-secondary border-white/10 hover:border-white/20 hover:text-primary'
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {/* Tracks */}
      {loading && tracks.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tracks.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {tracks.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index * 0.02, 0.5) }}
                  className="group relative bg-surface-2 rounded-xl overflow-hidden cursor-pointer hover:bg-white/5 transition-all"
                  onClick={() => {
                    if (selectedIds.size > 0) {
                      toggleSelect(track.id);
                    } else {
                      playTrack(track, tracks);
                    }
                  }}
                >
                  <div className="aspect-square w-full relative">
                    {track.has_artwork ? (
                      <img
                        src={getArtworkUrl(track.id)}
                        alt={track.album}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-3 flex items-center justify-center">
                        <svg className="w-12 h-12 text-white/10" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); playTrack(track, tracks); }}
                        className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                      >
                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(track.id);
                        }}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                          selectedIds.has(track.id)
                            ? 'bg-brand-500 text-white'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        )}
                      >
                        {selectedIds.has(track.id) ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-primary truncate">{track.title}</p>
                    <p className="text-xs text-secondary truncate">{track.artist}</p>
                    <p className="text-xs text-tertiary truncate mt-0.5">{track.album}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <TrackList
              tracks={tracks}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}

          {/* Infinite scroll sentinel */}
          <div ref={observerRef} className="h-4" />

          {/* Loading more indicator */}
          {loadingMore && (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* End of list */}
          {!loadingMore && page >= totalPages && tracks.length > 0 && (
            <p className="text-center text-sm text-tertiary py-4">
              All {total} tracks loaded
            </p>
          )}
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-brand-600/10 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-primary mb-2">Your library is empty</h3>
          <p className="text-secondary mb-6 max-w-md">
            {filter || activeChip !== 'all'
              ? 'No tracks match your current filters. Try adjusting your search or removing filters.'
              : 'Add your music collection to get started. Scan a folder to import your tracks.'}
          </p>
          {!filter && activeChip === 'all' && (
            <Link
              to="/settings"
              className="btn-primary inline-flex items-center gap-2 px-6 py-2.5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan Library
            </Link>
          )}
        </motion.div>
      )}

      {/* Floating Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-gray-900 border border-white/10 rounded-xl px-6 py-3 shadow-2xl flex items-center gap-4 z-50">
          <span className="text-sm text-secondary whitespace-nowrap">
            {selectedIds.size} track{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBatchDelete}
            className="px-3 py-1.5 text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            Delete Selected
          </button>
          <button
            onClick={() => handleBatchRate(5)}
            className="px-3 py-1.5 text-sm font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-colors"
          >
            Rate 5★
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-sm font-medium bg-white/5 text-secondary border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}

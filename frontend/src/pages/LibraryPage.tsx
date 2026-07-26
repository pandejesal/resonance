import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { usePlayerStore, useUIStore } from '../stores';
import { formatDuration, cn } from '../lib/utils';
import TrackList from '../components/TrackList';
import type { Track } from '../types';

export default function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<string>('date_added');
  const [order, setOrder] = useState<string>('DESC');
  const [filter, setFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { viewMode } = useUIStore();
  const observerRef = useRef<HTMLDivElement>(null);
  const filterTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { playTrack, addToQueue } = usePlayerStore();

  const loadTracks = useCallback(async (pageNum: number, reset: boolean) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const result = await api.tracks.list({
        page: pageNum,
        per_page: 50,
        sort,
        order: order as 'ASC' | 'DESC',
        search: filter || undefined,
      });
      if (reset) {
        setTracks(result.items);
      } else {
        setTracks((prev) => [...prev, ...result.items]);
      }
      setTotalPages(result.total_pages);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to load tracks:', e);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [sort, order, filter]);

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
    <div className="space-y-4">
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

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input-field w-auto"
          >
            <option value="date_added">Recently Added</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="album">Album</option>
            <option value="year">Year</option>
            <option value="duration_ms">Duration</option>
            <option value="play_count">Most Played</option>
            <option value="rating">Rating</option>
          </select>

          <button
            onClick={() => setOrder(order === 'ASC' ? 'DESC' : 'ASC')}
            className="btn-secondary px-3"
          >
            {order === 'ASC' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Tracks */}
      {loading && tracks.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tracks.length > 0 ? (
        <>
          <TrackList
            tracks={tracks}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />

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
        <div className="text-center py-12 text-secondary">
          {filter ? 'No tracks match your filter' : 'No tracks found. Scan a library to get started.'}
        </div>
      )}

      {/* Floating Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 border border-white/10 rounded-xl px-6 py-3 shadow-2xl flex items-center gap-4 z-50">
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

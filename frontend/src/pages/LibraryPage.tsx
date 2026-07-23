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
  const { viewMode } = useUIStore();
  const observerRef = useRef<HTMLDivElement>(null);
  const filterTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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
    setFilter(value);
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => {
      setTracks([]);
      setPage(1);
    }, 300);
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

        <div className="flex items-center gap-2">
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
          <TrackList tracks={tracks} />

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
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { usePlayerStore, useUIStore } from '../stores';
import { formatDuration, cn } from '../lib/utils';
import TrackList from '../components/TrackList';
import type { Track, PaginatedResponse } from '../types';

export default function LibraryPage() {
  const [data, setData] = useState<PaginatedResponse<Track> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string>('date_added');
  const [order, setOrder] = useState<string>('DESC');
  const [filter, setFilter] = useState<string>('');
  const { viewMode } = useUIStore();

  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.tracks.list({
        page,
        per_page: 50,
        sort,
        order: order as 'ASC' | 'DESC',
        search: filter || undefined,
      });
      setData(result);
    } catch (e) {
      console.error('Failed to load tracks:', e);
    }
    setLoading(false);
  }, [page, sort, order, filter]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Library</h1>
          <p className="text-sm text-secondary">
            {data ? `${data.total} tracks` : 'Loading...'}
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
              onChange={(e) => { setFilter(e.target.value); setPage(1); }}
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
      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <TrackList tracks={data.items} />

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-secondary">
                Page {page} of {data.total_pages}
              </span>
              <button
                onClick={() => setPage(Math.min(data.total_pages, page + 1))}
                disabled={page === data.total_pages}
                className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
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

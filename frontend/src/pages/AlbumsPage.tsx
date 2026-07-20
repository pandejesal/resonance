import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { AlbumCard } from '../components/Cards';
import type { Album, PaginatedResponse } from '../types';

export default function AlbumsPage() {
  const [data, setData] = useState<PaginatedResponse<Album> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('date_added');

  useEffect(() => {
    setLoading(true);
    api.albums.list({ page, per_page: 24, sort, order: 'DESC' })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, sort]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Albums</h1>
          <p className="text-sm text-secondary">
            {data ? `${data.total} albums` : 'Loading...'}
          </p>
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="input-field w-auto"
        >
          <option value="date_added">Recently Added</option>
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="year">Year</option>
          <option value="track_count">Track Count</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {data.items.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>

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
        <div className="text-center py-12 text-secondary">No albums found</div>
      )}
    </div>
  );
}

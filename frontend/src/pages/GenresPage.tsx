import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

export default function GenresPage() {
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.genres()
      .then(setGenres)
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary">Genres</h1>
        <p className="text-sm text-secondary">{genres.length} genres</p>
      </div>

      {genres.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {genres.map((genre, i) => (
            <motion.div
              key={genre}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
              className="surface-card p-6 text-center cursor-pointer hover:scale-[1.02] transition-transform"
            >
              <div
                className="w-16 h-16 mx-auto rounded-2xl mb-3 flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${(i * 37) % 360}, 70%, 35%) 0%, hsl(${(i * 37 + 40) % 360}, 60%, 25%) 100%)`,
                }}
              >
                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-primary">{genre}</h3>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-secondary">No genres found</div>
      )}
    </div>
  );
}

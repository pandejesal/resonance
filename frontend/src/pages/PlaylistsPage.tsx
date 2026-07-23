import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { formatDuration, cn } from '../lib/utils';
import type { Playlist } from '../types';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    api.playlists.list()
      .then(setPlaylists)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const playlist = await api.playlists.create({ name: newName });
      setPlaylists([...playlists, playlist]);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      console.error('Failed to create playlist:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Playlists</h1>
          <p className="text-sm text-secondary">{playlists.length} playlists</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Playlist
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="surface-card p-4"
        >
          <h3 className="text-lg font-medium text-primary mb-3">New Playlist</h3>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name"
            className="input-field mb-3"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="btn-primary disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </motion.div>
      )}

      {/* Playlists */}
      {playlists.length > 0 ? (
        <div className="space-y-2">
          {playlists.map((playlist, i) => (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-primary">{playlist.name}</p>
                <p className="text-sm text-secondary">
                  {playlist.track_count} tracks
                  {playlist.total_duration_ms > 0 && ` · ${formatDuration(playlist.total_duration_ms)}`}
                </p>
              </div>
              {playlist.is_smart && (
                <span className="text-xs px-2 py-1 rounded-lg bg-brand-600/20 text-brand-400">
                  Smart
                </span>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-secondary">
          <p className="mb-4">No playlists yet</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            Create your first playlist
          </button>
        </div>
      )}
    </div>
  );
}

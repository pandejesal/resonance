import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { usePlayerStore, useUIStore } from '../stores';
import { cn } from '../lib/utils';
import type { Playlist } from '../types';

type ToolResult = { success: boolean; message: string; details?: any };

export default function PlaylistToolsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ToolResult | null>(null);

  useEffect(() => {
    api.playlists.list()
      .then(setPlaylists)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Playlist Tools</h1>

      {/* Playlist Selector */}
      <div className="surface-card p-4">
        <label className="block text-sm text-secondary mb-2">Select a playlist to work with</label>
        <select
          value={selectedPlaylist}
          onChange={(e) => setSelectedPlaylist(e.target.value)}
          className="input-field w-full"
        >
          <option value="">Choose a playlist...</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.track_count} tracks)</option>
          ))}
        </select>
      </div>

      {/* Result Toast */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'p-4 rounded-xl border',
              result.success
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            )}
          >
            <p className="font-medium">{result.message}</p>
            {result.details && (
              <pre className="text-xs mt-2 opacity-70 overflow-x-auto">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ShuffleTool
          playlistId={selectedPlaylist}
          disabled={!selectedPlaylist}
          onResult={setResult}
        />
        <SortTool
          playlistId={selectedPlaylist}
          disabled={!selectedPlaylist}
          onResult={setResult}
        />
        <DedupeTool
          playlistId={selectedPlaylist}
          disabled={!selectedPlaylist}
          onResult={setResult}
        />
        <PlaylistStats
          playlistId={selectedPlaylist}
          disabled={!selectedPlaylist}
        />
        <GenerateTool onResult={setResult} />
        <ShareTool
          playlistId={selectedPlaylist}
          disabled={!selectedPlaylist}
          onResult={setResult}
        />
      </div>
    </div>
  );
}

function ShuffleTool({ playlistId, disabled, onResult }: { playlistId: string; disabled: boolean; onResult: (r: ToolResult) => void }) {
  const [mode, setMode] = useState('smart');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!playlistId || disabled) return;
    setLoading(true);
    try {
      const r = await api.playlists.shuffle(playlistId, mode);
      onResult({ success: r.success, message: r.message });
    } catch (e: any) {
      onResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-primary">Better Shuffle</h3>
          <p className="text-xs text-secondary">Fisher-Yates with smart ordering</p>
        </div>
      </div>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className="input-field w-full mb-3 text-sm"
      >
        <option value="smart">Smart (interleave popular/unpopular)</option>
        <option value="random">True Random</option>
        <option value="no-consecutive-artist">No Consecutive Same Artist</option>
      </select>
      <button
        onClick={handle}
        disabled={disabled || loading}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? 'Shuffling...' : 'Shuffle Playlist'}
      </button>
    </div>
  );
}

function SortTool({ playlistId, disabled, onResult }: { playlistId: string; disabled: boolean; onResult: (r: ToolResult) => void }) {
  const [sortBy, setSortBy] = useState('title');
  const [order, setOrder] = useState('asc');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!playlistId || disabled) return;
    setLoading(true);
    try {
      const r = await api.playlists.sort(playlistId, sortBy, order);
      onResult({ success: r.success, message: r.message });
    } catch (e: any) {
      onResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-primary">Sort Playlist</h3>
          <p className="text-xs text-secondary">Sort by any metadata field</p>
        </div>
      </div>
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-field w-full mb-3 text-sm">
        <option value="title">Title</option>
        <option value="artist">Artist</option>
        <option value="album">Album</option>
        <option value="duration">Duration</option>
        <option value="year">Year</option>
        <option value="date_added">Date Added</option>
        <option value="play_count">Play Count</option>
        <option value="rating">Rating</option>
        <option value="genre">Genre</option>
        <option value="random">Random</option>
      </select>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setOrder('asc')}
          className={cn('flex-1 py-1.5 rounded-lg text-sm font-medium transition-all', order === 'asc' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-secondary')}
        >
          Ascending
        </button>
        <button
          onClick={() => setOrder('desc')}
          className={cn('flex-1 py-1.5 rounded-lg text-sm font-medium transition-all', order === 'desc' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-secondary')}
        >
          Descending
        </button>
      </div>
      <button onClick={handle} disabled={disabled || loading} className="btn-primary w-full disabled:opacity-50">
        {loading ? 'Sorting...' : 'Sort Playlist'}
      </button>
    </div>
  );
}

function DedupeTool({ playlistId, disabled, onResult }: { playlistId: string; disabled: boolean; onResult: (r: ToolResult) => void }) {
  const [strategy, setStrategy] = useState('title_artist');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!playlistId || disabled) return;
    setLoading(true);
    try {
      const r = await api.playlists.dedupe(playlistId, strategy);
      onResult({ success: r.success, message: r.message, details: r.details });
    } catch (e: any) {
      onResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-primary">Remove Duplicates</h3>
          <p className="text-xs text-secondary">Clean up duplicate tracks</p>
        </div>
      </div>
      <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="input-field w-full mb-3 text-sm">
        <option value="title_artist">Same Title + Artist</option>
        <option value="exact">Exact Match (same file)</option>
        <option value="fingerprint">Audio Fingerprint</option>
      </select>
      <button onClick={handle} disabled={disabled || loading} className="btn-primary w-full disabled:opacity-50">
        {loading ? 'Removing...' : 'Remove Duplicates'}
      </button>
    </div>
  );
}

function PlaylistStats({ playlistId, disabled }: { playlistId: string; disabled: boolean }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playlistId || disabled) { setStats(null); return; }
    setLoading(true);
    api.playlists.stats(playlistId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [playlistId, disabled]);

  if (disabled) return (
    <div className="surface-card p-5 opacity-50">
      <h3 className="font-semibold text-primary mb-2">Playlist Stats</h3>
      <p className="text-sm text-secondary">Select a playlist to view stats</p>
    </div>
  );

  if (loading) return (
    <div className="surface-card p-5">
      <h3 className="font-semibold text-primary mb-2">Playlist Stats</h3>
      <div className="flex justify-center py-4">
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!stats) return null;

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-primary">Playlist Stats</h3>
          <p className="text-xs text-secondary">Detailed analytics</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-surface-1 rounded-lg p-2">
          <p className="text-tertiary text-xs">Tracks</p>
          <p className="text-primary font-semibold">{stats.track_count}</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-2">
          <p className="text-tertiary text-xs">Artists</p>
          <p className="text-primary font-semibold">{stats.unique_artists}</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-2">
          <p className="text-tertiary text-xs">Duration</p>
          <p className="text-primary font-semibold">{Math.round(stats.total_duration_ms / 60000)}m</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-2">
          <p className="text-tertiary text-xs">Size</p>
          <p className="text-primary font-semibold">{(stats.total_size_bytes / 1048576).toFixed(1)}MB</p>
        </div>
      </div>
      {stats.top_artists && stats.top_artists.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-tertiary mb-1">Top Artists</p>
          {stats.top_artists.slice(0, 3).map(([name, count]: [string, number]) => (
            <p key={name} className="text-xs text-secondary">{name} ({count})</p>
          ))}
        </div>
      )}
    </div>
  );
}

function GenerateTool({ onResult }: { onResult: (r: ToolResult) => void }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('library');
  const [sourceValue, setSourceValue] = useState('');
  const [count, setCount] = useState(20);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const r = await api.playlists.generate({
        name,
        source,
        source_value: sourceValue || undefined,
        count,
      });
      onResult({ success: r.success, message: r.message });
      if (r.success) setName('');
    } catch (e: any) {
      onResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-primary">Generate Playlist</h3>
          <p className="text-xs text-secondary">Create random playlists from library</p>
        </div>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Playlist name"
        className="input-field w-full mb-3 text-sm"
      />
      <select value={source} onChange={(e) => setSource(e.target.value)} className="input-field w-full mb-3 text-sm">
        <option value="library">Random from Library</option>
        <option value="genre">By Genre</option>
        <option value="artist">By Artist</option>
        <option value="mood">By Mood</option>
        <option value="recently_played">Recently Played</option>
        <option value="unplayed">Unplayed</option>
        <option value="top_rated">Top Rated</option>
      </select>
      {(source === 'genre' || source === 'artist' || source === 'mood') && (
        <input
          type="text"
          value={sourceValue}
          onChange={(e) => setSourceValue(e.target.value)}
          placeholder={`Enter ${source} name`}
          className="input-field w-full mb-3 text-sm"
        />
      )}
      <div className="mb-3">
        <label className="text-xs text-secondary">Track count: {count}</label>
        <input
          type="range"
          min={5}
          max={50}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <button onClick={handle} disabled={!name.trim() || loading} className="btn-primary w-full disabled:opacity-50">
        {loading ? 'Generating...' : 'Generate Playlist'}
      </button>
    </div>
  );
}

function ShareTool({ playlistId, disabled, onResult }: { playlistId: string; disabled: boolean; onResult: (r: ToolResult) => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handle = async () => {
    if (!playlistId || disabled || !name.trim()) return;
    setLoading(true);
    try {
      const r = await api.playlists.share(playlistId, name);
      onResult({ success: r.success, message: r.message });
      if (r.details?.share_url) setShareUrl(r.details.share_url);
    } catch (e: any) {
      onResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-primary">Share Playlist</h3>
          <p className="text-xs text-secondary">Create a shareable playlist link</p>
        </div>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Share name"
        className="input-field w-full mb-3 text-sm"
      />
      <button onClick={handle} disabled={disabled || !name.trim() || loading} className="btn-primary w-full disabled:opacity-50">
        {loading ? 'Creating...' : 'Create Shareable Link'}
      </button>
      {shareUrl && (
        <div className="mt-3 p-2 bg-surface-1 rounded-lg">
          <p className="text-xs text-secondary mb-1">Share URL</p>
          <code className="text-xs text-brand-400 break-all">{shareUrl}</code>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import ErrorState from '../components/ErrorState';
import { usePlayerStore, useUIStore } from '../stores';
import { cn } from '../lib/utils';
import type { Playlist, SmartPlaylistRule } from '../types';

type ToolResult = { success: boolean; message: string; details?: any };

const RULE_FIELDS = [
  { value: 'rating', label: 'Rating' },
  { value: 'play_count', label: 'Play Count' },
  { value: 'last_played', label: 'Last Played' },
  { value: 'date_added', label: 'Date Added' },
  { value: 'genre', label: 'Genre' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'year', label: 'Year' },
  { value: 'duration_ms', label: 'Duration (ms)' },
];

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  rating: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
  ],
  play_count: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
  ],
  year: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
  ],
  duration_ms: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
  ],
  last_played: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
  ],
  date_added: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
  ],
  genre: [
    { value: 'eq', label: 'Equals' },
    { value: 'neq', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
  ],
  artist: [
    { value: 'eq', label: 'Equals' },
    { value: 'neq', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
  ],
  album: [
    { value: 'eq', label: 'Equals' },
    { value: 'neq', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
  ],
};

export default function PlaylistToolsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<ToolResult | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.playlists.list()
      .then(setPlaylists)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load playlists'))
      .finally(() => setLoading(false));
  }, [reload]);

  const handlePlaylistUpdated = useCallback((updated: Playlist) => {
    setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Playlist Tools</h1>

      {error && <ErrorState message={error} onRetry={() => setReload((r) => r + 1)} />}

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
            <option key={p.id} value={p.id}>{p.name} ({p.track_count} tracks){p.is_smart ? ' [Smart]' : ''}</option>
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
                ? 'bg-brand-500/10 border-brand-500/20 text-brand-500'
                : 'bg-accent-500/10 border-accent-500/20 text-accent-500'
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

      {/* Smart Playlist Tool - Full Width */}
      {selectedPlaylist && (
        <SmartPlaylistTool
          playlistId={selectedPlaylist}
          playlists={playlists}
          onResult={setResult}
          onPlaylistUpdated={handlePlaylistUpdated}
        />
      )}

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

function SmartPlaylistTool({
  playlistId,
  playlists,
  onResult,
  onPlaylistUpdated,
}: {
  playlistId: string;
  playlists: Playlist[];
  onResult: (r: ToolResult) => void;
  onPlaylistUpdated: (p: Playlist) => void;
}) {
  const playlist = playlists.find((p) => p.id === playlistId);
  const isSmart = playlist?.is_smart ?? false;

  const [rules, setRules] = useState<SmartPlaylistRule[]>([]);
  const [matchAll, setMatchAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResults, setEvalResults] = useState<any[] | null>(null);

  useEffect(() => {
    if (playlist?.smart_filter) {
      try {
        const config = JSON.parse(playlist.smart_filter);
        setRules(config.rules || []);
        setMatchAll(config.match_all !== false);
      } catch {
        setRules([]);
        setMatchAll(true);
      }
    } else {
      setRules([]);
      setMatchAll(true);
    }
    setEvalResults(null);
  }, [playlistId, playlist?.smart_filter]);

  const addRule = () => {
    setRules((prev) => [...prev, { field: 'rating', op: 'gte', value: '4' }]);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, updates: Partial<SmartPlaylistRule>) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  };

  const saveRules = async () => {
    setLoading(true);
    try {
      const updated = await api.playlists.updateSmartRules(playlistId, rules, matchAll);
      onPlaylistUpdated(updated);
      onResult({ success: true, message: 'Smart playlist rules saved' });
    } catch (e: any) {
      onResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const evaluateRules = async () => {
    setEvaluating(true);
    try {
      const tracks = await api.playlists.evaluateSmart(playlistId);
      setEvalResults(tracks);
      onResult({ success: true, message: `Found ${tracks.length} matching tracks` });
    } catch (e: any) {
      onResult({ success: false, message: e.message });
      setEvalResults(null);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-primary">Smart Playlist</h3>
          <p className="text-xs text-secondary">
            {isSmart ? 'Active - rules will be applied dynamically' : 'Define rules for auto-updating this playlist'}
          </p>
        </div>
        {isSmart && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
            Smart
          </span>
        )}
      </div>

      {/* Rules */}
      <div className="space-y-2 mb-4">
        {rules.length === 0 && (
          <p className="text-sm text-tertiary text-center py-3">No rules defined. Add a rule to get started.</p>
        )}
        {rules.map((rule, index) => {
          const fieldOps = OPERATORS[rule.field] || OPERATORS.rating;
          return (
            <div key={index} className="flex items-center gap-2">
              <select
                value={rule.field}
                onChange={(e) => {
                  const newField = e.target.value;
                  const newOps = OPERATORS[newField] || OPERATORS.rating;
                  const validOp = newOps.find((o) => o.value === rule.op) ? rule.op : newOps[0].value;
                  updateRule(index, { field: newField, op: validOp });
                }}
                className="input-field flex-1 text-sm"
              >
                {RULE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={rule.op}
                onChange={(e) => updateRule(index, { op: e.target.value })}
                className="input-field w-20 text-sm"
              >
                {fieldOps.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type={rule.field === 'last_played' || rule.field === 'date_added' ? 'date' : 'text'}
                value={rule.value}
                onChange={(e) => updateRule(index, { value: e.target.value })}
                className="input-field flex-1 text-sm"
                placeholder={rule.field === 'rating' ? '0-5' : rule.field === 'year' ? '2024' : 'Value'}
              />
              <button
                onClick={() => removeRule(index)}
                className="p-1.5 rounded-lg hover:bg-accent-500/20 text-accent-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* AND/OR Toggle and Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={addRule}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-white/10 text-sm text-secondary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Rule
        </button>

        {rules.length > 1 && (
          <div className="flex items-center rounded-lg bg-surface-2 overflow-hidden">
            <button
              onClick={() => setMatchAll(true)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-all',
                matchAll ? 'bg-brand-600 text-white' : 'text-secondary hover:text-primary'
              )}
            >
              AND
            </button>
            <button
              onClick={() => setMatchAll(false)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-all',
                !matchAll ? 'bg-brand-600 text-white' : 'text-secondary hover:text-primary'
              )}
            >
              OR
            </button>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={saveRules}
          disabled={loading || rules.length === 0}
          className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Rules'}
        </button>

        <button
          onClick={evaluateRules}
          disabled={evaluating}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {evaluating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          Evaluate
        </button>
      </div>

      {/* Evaluation Results */}
      <AnimatePresence>
        {evalResults && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="bg-surface-1 rounded-xl p-4 max-h-64 overflow-y-auto">
              <p className="text-xs text-tertiary mb-2">{evalResults.length} matching tracks</p>
              {evalResults.length === 0 ? (
                <p className="text-sm text-secondary">No tracks match these rules.</p>
              ) : (
                <div className="space-y-1">
                  {evalResults.slice(0, 50).map((track: any) => (
                    <div key={track.id} className="flex items-center gap-3 py-1">
                      <span className="text-xs text-tertiary w-6 text-right">
                        {track.rating != null && track.rating > 0 ? `${track.rating}★` : '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-primary truncate">{track.title}</p>
                        <p className="text-xs text-secondary truncate">{track.artist}</p>
                      </div>
                      <span className="text-xs text-tertiary">{track.play_count} plays</span>
                    </div>
                  ))}
                  {evalResults.length > 50 && (
                    <p className="text-xs text-tertiary text-center pt-2">
                      ...and {evalResults.length - 50} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

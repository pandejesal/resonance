import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import type { Track } from '../types';

interface DuplicateTrack extends Track {}

export default function MusicToolsPage() {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'transfer' | 'utils' | 'spotify' | 'duplicates'>('search');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/tools/search?q=${encodeURIComponent(query)}&platform=${platform}&limit=30`);
      const data = await resp.json();
      setResults(data.tracks || []);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrack = (track: Track) => {
    setSelectedTracks(prev =>
      prev.find(t => t.id === track.id && t.platform === track.platform)
        ? prev.filter(t => !(t.id === track.id && t.platform === track.platform))
        : [...prev, track]
    );
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '--:--';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const platformIcon = (p: string) => {
    switch (p) {
      case 'spotify': return 'S';
      case 'youtube_music': return 'Y';
      case 'soundcloud': return 'SC';
      default: return '?';
    }
  };

  const platformColor = (p: string) => {
    switch (p) {
      case 'spotify': return 'bg-brand-500';
      case 'youtube_music': return 'bg-accent-500';
      case 'soundcloud': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Music Tools</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-surface-1 rounded-xl w-fit">
        {[
          { id: 'search', label: 'Search' },
          { id: 'transfer', label: 'Transfer' },
          { id: 'utils', label: 'Utilities' },
          { id: 'spotify', label: 'Spotify Tools' },
          { id: 'duplicates', label: 'Duplicates' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Search Bar */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search songs across all platforms..."
                className="input-field w-full pl-10"
              />
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="input-field"
            >
              <option value="all">All Platforms</option>
              <option value="spotify">Spotify</option>
              <option value="youtube_music">YouTube Music</option>
              <option value="soundcloud">SoundCloud</option>
            </select>
            <button onClick={handleSearch} disabled={loading} className="btn-primary">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Selected Tracks */}
          {selectedTracks.length > 0 && (
            <div className="surface-card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-primary">{selectedTracks.length} tracks selected</h3>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedTracks([])} className="btn-secondary text-sm">Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTracks.map((track, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-surface-2 rounded-lg text-xs">
                    <span className={`w-4 h-4 rounded text-[8px] font-bold text-white flex items-center justify-center ${platformColor(track.platform)}`}>
                      {platformIcon(track.platform)}
                    </span>
                    {track.artist} - {track.title}
                    <button onClick={() => toggleTrack(track)} className="ml-1 text-tertiary hover:text-accent-400">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="space-y-1">
            {results.map((track, i) => (
              <motion.div
                key={`${track.platform}-${track.id}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  selectedTracks.find(t => t.id === track.id && t.platform === track.platform)
                    ? 'bg-brand-600/20 border border-brand-500/30'
                    : 'surface-card hover:bg-white/5'
                }`}
                onClick={() => toggleTrack(track)}
              >
                {track.thumbnail ? (
                  <img src={track.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center">
                    <svg className="w-5 h-5 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{track.title}</p>
                  <p className="text-xs text-secondary truncate">{track.artist} · {track.album}</p>
                </div>
                <span className={`w-7 h-7 rounded-md text-[10px] font-bold text-white flex items-center justify-center shrink-0 ${platformColor(track.platform)}`}>
                  {platformIcon(track.platform)}
                </span>
                <span className="text-xs text-tertiary shrink-0">{formatDuration(track.duration_ms)}</span>
                {track.url && (
                  <a href={track.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-white/5 text-tertiary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Transfer Tab */}
      {activeTab === 'transfer' && <TransferTab />}

      {/* Utilities Tab */}
      {activeTab === 'utils' && <PlaylistUtilsTab />}

      {/* Spotify Tools Tab */}
      {activeTab === 'spotify' && <SpotifyToolsTab />}

      {/* Duplicates Tab */}
      {activeTab === 'duplicates' && <DuplicateDetectionTab />}
    </div>
  );
}

function TransferTab() {
  const [source, setSource] = useState('spotify');
  const [target, setTarget] = useState('youtube_music');
  const [playlistId, setPlaylistId] = useState('');
  const [token, setToken] = useState('');
  const [targetToken, setTargetToken] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [progress, setProgress] = useState<any>(null);

  const handleTransfer = async () => {
    if (!playlistId.trim()) return;
    setTransferring(true);
    try {
      const resp = await fetch('/api/tools/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_platform: source,
          source_playlist_id: playlistId,
          target_platform: target,
          target_playlist_name: playlistName || 'Transferred with Resonance',
          source_token: token || undefined,
          target_token: targetToken || undefined,
        }),
      });
      const data = await resp.json();
      setProgress(data.progress || data);
    } catch (e) {
      console.error('Transfer failed:', e);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-2xl">
      <div className="surface-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-primary">Transfer Playlist</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-secondary mb-1">From Platform</label>
            <select value={source} onChange={e => setSource(e.target.value)} className="input-field w-full">
              <option value="spotify">Spotify</option>
              <option value="youtube_music">YouTube Music</option>
              <option value="soundcloud">SoundCloud</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">To Platform</label>
            <select value={target} onChange={e => setTarget(e.target.value)} className="input-field w-full">
              <option value="spotify">Spotify</option>
              <option value="youtube_music">YouTube Music</option>
              <option value="soundcloud">SoundCloud</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1">Playlist ID or URL</label>
          <input type="text" value={playlistId} onChange={e => setPlaylistId(e.target.value)} placeholder="e.g., 37i9dQZF1DXcBWIGoYBM5M" className="input-field w-full" />
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1">New Playlist Name</label>
          <input type="text" value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="Transferred with Resonance" className="input-field w-full" />
        </div>

        {(source === 'spotify' || target === 'spotify') && (
          <div>
            <label className="block text-xs text-secondary mb-1">Spotify Access Token</label>
            <input type="password" value={source === 'spotify' ? token : targetToken} onChange={e => source === 'spotify' ? setToken(e.target.value) : setTargetToken(e.target.value)} placeholder="BQDj..." className="input-field w-full" />
          </div>
        )}

        <button onClick={handleTransfer} disabled={transferring || !playlistId.trim()} className="btn-primary w-full">
          {transferring ? 'Transferring...' : 'Transfer Playlist'}
        </button>
      </div>

      {progress && (
        <div className="surface-card p-4">
          <h3 className="font-medium text-primary mb-2">Transfer Progress</h3>
          <div className="space-y-1 text-sm">
            <p className="text-secondary">Status: <span className="text-primary">{progress.status}</span></p>
            <p className="text-secondary">Total: <span className="text-primary">{progress.total}</span></p>
            <p className="text-secondary">Matched: <span className="text-brand-400">{progress.matched}</span></p>
            <p className="text-secondary">Not Found: <span className="text-accent-400">{progress.not_found}</span></p>
            {progress.playlist_url && (
              <p className="text-secondary">URL: <a href={progress.playlist_url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">{progress.playlist_url}</a></p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function PlaylistUtilsTab() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [result, setResult] = useState<Track[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [activeTool, setActiveTool] = useState('');
  const [tracksInput, setTracksInput] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTracks = async () => {
    setLoading(true);
    try {
      const data = JSON.parse(tracksInput);
      setTracks(data);
      setResult(data);
    } catch {
      alert('Invalid JSON. Paste an array of track objects.');
    }
    setLoading(false);
  };

  const applyTool = async (tool: string) => {
    setActiveTool(tool);
    try {
      const resp = await fetch('/api/tools/playlist-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks, tool }),
      });
      const data = await resp.json();
      if (data.tracks) setResult(data.tracks);
      if (data.analysis) setAnalysis(data.analysis);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = async () => {
    try {
      const resp = await fetch('/api/tools/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: result, name: 'Resonance Export' }),
      });
      const data = await resp.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'playlist.json';
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  const tools = [
    { id: 'shuffle', label: 'Smart Shuffle', desc: 'Randomize with variety' },
    { id: 'smart_shuffle', label: 'Energy Shuffle', desc: 'Alternate energy levels' },
    { id: 'sort_artist', label: 'Sort by Artist', desc: 'A-Z by artist' },
    { id: 'sort_title', label: 'Sort by Title', desc: 'A-Z by title' },
    { id: 'sort_duration', label: 'Sort by Duration', desc: 'Short to long' },
    { id: 'sort_album', label: 'Sort by Album', desc: 'Group by album' },
    { id: 'deduplicate', label: 'Remove Duplicates', desc: 'Keep first occurrence' },
    { id: 'analyze', label: 'Analyze', desc: 'Get playlist stats' },
    { id: 'group_artist', label: 'Group by Artist', desc: 'Organize by artist' },
    { id: 'group_album', label: 'Group by Album', desc: 'Organize by album' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="surface-card p-4">
        <h3 className="font-medium text-primary mb-2">Load Tracks</h3>
        <p className="text-xs text-secondary mb-2">Paste your track data as JSON array, or use tracks from the search tab</p>
        <textarea
          value={tracksInput}
          onChange={e => setTracksInput(e.target.value)}
          placeholder='[{"id":"...","title":"...","artist":"...","platform":"spotify"}]'
          className="input-field w-full h-32 font-mono text-xs"
        />
        <button onClick={loadTracks} disabled={loading} className="btn-primary mt-2">
          Load Tracks ({tracks.length})
        </button>
      </div>

      {tracks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => applyTool(tool.id)}
              className={`p-3 rounded-xl text-left transition-all ${
                activeTool === tool.id ? 'bg-brand-600/20 border border-brand-500/30' : 'surface-card hover:bg-white/5'
              }`}
            >
              <p className="text-sm font-medium text-primary">{tool.label}</p>
              <p className="text-xs text-tertiary">{tool.desc}</p>
            </button>
          ))}
        </div>
      )}

      {analysis && (
        <div className="surface-card p-4">
          <h3 className="font-medium text-primary mb-2">Analysis</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-tertiary">Tracks:</span> <span className="text-primary">{analysis.total_tracks}</span></div>
            <div><span className="text-tertiary">Unique Artists:</span> <span className="text-primary">{analysis.unique_artists}</span></div>
            <div><span className="text-tertiary">Duplicates:</span> <span className="text-orange-400">{analysis.duplicates?.length || 0}</span></div>
          </div>
        </div>
      )}

      {result.length > 0 && (
        <div className="surface-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-primary">Result ({result.length} tracks)</h3>
            <button onClick={handleExport} className="btn-secondary text-sm">Export JSON</button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {result.map((track, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <span className="text-xs text-tertiary w-8 text-right">{i + 1}</span>
                <span className="flex-1 text-sm text-primary truncate">{track.artist} - {track.title}</span>
                <span className="text-xs text-tertiary">{track.platform}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SpotifyToolsTab() {
  const [token, setToken] = useState('');
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [canvasTrackId, setCanvasTrackId] = useState('');
  const [canvasResult, setCanvasResult] = useState<any>(null);

  const loadPlaylists = async () => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/tools/spotify/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json();
      setPlaylists(data.playlists || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const themes = [
    { name: 'Midnight', primary: '#1DB954', secondary: '#191414', background: '#121212', gradient: 'linear-gradient(135deg, #121212 0%, #1DB954 100%)' },
    { name: 'Neon', primary: '#FF006E', secondary: '#8338EC', background: '#0A0A0A', gradient: 'linear-gradient(135deg, #0A0A0A 0%, #FF006E 50%, #8338EC 100%)' },
    { name: 'Ocean', primary: '#0077B6', secondary: '#00B4D8', background: '#03045E', gradient: 'linear-gradient(135deg, #03045E 0%, #0077B6 50%, #00B4D8 100%)' },
    { name: 'Sunset', primary: '#FF6B35', secondary: '#F7C59F', background: '#1A1423', gradient: 'linear-gradient(135deg, #1A1423 0%, #FF6B35 50%, #F7C59F 100%)' },
    { name: 'Forest', primary: '#2D6A4F', secondary: '#52B788', background: '#1B4332', gradient: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #52B788 100%)' },
    { name: 'Galaxy', primary: '#7B2FF7', secondary: '#C77DFF', background: '#10002B', gradient: 'linear-gradient(135deg, #10002B 0%, #7B2FF7 50%, #C77DFF 100%)' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Token Input */}
      <div className="surface-card p-4">
        <h3 className="font-medium text-primary mb-2">Spotify Access Token</h3>
        <div className="flex gap-2">
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="BQDj..."
            className="input-field flex-1"
          />
          <button onClick={loadPlaylists} disabled={loading || !token} className="btn-primary">
            {loading ? 'Loading...' : 'Load Playlists'}
          </button>
        </div>
      </div>

      {/* Playlists */}
      {playlists.length > 0 && (
        <div className="surface-card p-4">
          <h3 className="font-medium text-primary mb-3">Your Playlists ({playlists.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {playlists.map((pl, i) => (
              <div key={i} className="p-3 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer">
                {pl.image_url && <img src={pl.image_url} alt="" className="w-full aspect-square rounded-lg object-cover mb-2" />}
                <p className="text-sm font-medium text-primary truncate">{pl.name}</p>
                <p className="text-xs text-tertiary">{pl.track_count} tracks</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spotify Themes */}
      <div className="surface-card p-4">
        <h3 className="font-medium text-primary mb-3">Spotify Themes</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {themes.map((theme, i) => (
            <div
              key={i}
              className="p-4 rounded-xl cursor-pointer transition-all hover:scale-105"
              style={{ background: theme.gradient }}
            >
              <p className="text-sm font-bold text-white mb-1">{theme.name}</p>
              <div className="flex gap-1">
                <span className="w-4 h-4 rounded-full" style={{ background: theme.primary }} />
                <span className="w-4 h-4 rounded-full" style={{ background: theme.secondary }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas Art Extractor */}
      <div className="surface-card p-4">
        <h3 className="font-medium text-primary mb-2">Spotify Canvas Extractor</h3>
        <p className="text-xs text-secondary mb-2">Extract Canvas video URLs from Spotify tracks</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={canvasTrackId}
            onChange={e => setCanvasTrackId(e.target.value)}
            placeholder="Spotify Track ID"
            className="input-field flex-1"
          />
        </div>
      </div>

      {/* Collage Generator Info */}
      <div className="surface-card p-4">
        <h3 className="font-medium text-primary mb-2">Playlist Collage Generator</h3>
        <p className="text-xs text-secondary">Generate beautiful collages from your playlist artwork. Select a playlist above to get started.</p>
      </div>
    </motion.div>
  );
}

function DuplicateDetectionTab() {
  const [fingerprintDuplicates, setFingerprintDuplicates] = useState<Record<string, DuplicateTrack[]>>({});
  const [similarTracks, setSimilarTracks] = useState<Array<{ title: string; artist: string; count: number; tracks: DuplicateTrack[] }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'fingerprint' | 'similar'>('fingerprint');
  const [message, setMessage] = useState<string | null>(null);

  const scanFingerprints = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.tracks.findDuplicates();
      setFingerprintDuplicates(result.duplicates);
      setMessage(`Found ${result.groups} groups with ${result.total_duplicates} total duplicates`);
    } catch (e) {
      console.error('Scan failed:', e);
      setMessage('Failed to scan for duplicates');
    } finally {
      setLoading(false);
    }
  };

  const scanSimilar = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.tracks.findSimilar();
      setSimilarTracks(result.duplicates);
      setMessage(`Found ${result.groups} groups of similar tracks`);
    } catch (e) {
      console.error('Scan failed:', e);
      setMessage('Failed to scan for similar tracks');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFromGroup = (tracks: DuplicateTrack[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const track of tracks) {
        next.add(track.id);
      }
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected tracks?`)) return;

    setLoading(true);
    try {
      const result = await api.tracks.deleteDuplicates(Array.from(selectedIds));
      setMessage(result.message);
      setSelectedIds(new Set());
      if (activeView === 'fingerprint') {
        await scanFingerprints();
      } else {
        await scanSimilar();
      }
    } catch (e) {
      console.error('Delete failed:', e);
      setMessage('Failed to delete tracks');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '--:--';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalGroups = activeView === 'fingerprint'
    ? Object.keys(fingerprintDuplicates).length
    : similarTracks.length;

  const totalTracks = activeView === 'fingerprint'
    ? Object.values(fingerprintDuplicates).reduce((sum, g) => sum + g.length, 0)
    : similarTracks.reduce((sum, g) => sum + g.tracks.length, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Scan Controls */}
      <div className="surface-card p-4">
        <h3 className="font-medium text-primary mb-3">Duplicate Detection</h3>
        <p className="text-xs text-secondary mb-4">Find exact duplicates (same content fingerprint) or similar tracks (same title + artist)</p>

        <div className="flex gap-3 mb-3">
          <div className="flex gap-1 p-1 bg-surface-1 rounded-lg">
            <button
              onClick={() => setActiveView('fingerprint')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeView === 'fingerprint'
                  ? 'bg-brand-600 text-white'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Exact Duplicates
            </button>
            <button
              onClick={() => setActiveView('similar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeView === 'similar'
                  ? 'bg-brand-600 text-white'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Similar Tracks
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {activeView === 'fingerprint' ? (
            <button onClick={scanFingerprints} disabled={loading} className="btn-primary">
              {loading ? 'Scanning...' : 'Scan for Exact Duplicates'}
            </button>
          ) : (
            <button onClick={scanSimilar} disabled={loading} className="btn-primary">
              {loading ? 'Scanning...' : 'Scan for Similar Tracks'}
            </button>
          )}

          {selectedIds.size > 0 && (
            <button onClick={deleteSelected} disabled={loading} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
              Delete Selected ({selectedIds.size})
            </button>
          )}
        </div>

        {message && (
          <p className="text-sm text-secondary mt-2">{message}</p>
        )}
      </div>

      {/* Results Summary */}
      {totalGroups > 0 && (
        <div className="surface-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-secondary">Found </span>
              <span className="text-primary font-medium">{totalGroups}</span>
              <span className="text-secondary"> groups with </span>
              <span className="text-primary font-medium">{totalTracks}</span>
              <span className="text-secondary"> total tracks</span>
            </div>
            {selectedIds.size > 0 && (
              <span className="text-sm text-brand-400">{selectedIds.size} selected</span>
            )}
          </div>
        </div>
      )}

      {/* Fingerprint Duplicates */}
      {activeView === 'fingerprint' && Object.keys(fingerprintDuplicates).length > 0 && (
        <div className="space-y-3">
          {Object.entries(fingerprintDuplicates).map(([fingerprint, tracks]) => (
            <div key={fingerprint} className="surface-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs text-tertiary font-mono">Fingerprint: {fingerprint.slice(0, 12)}...</span>
                  <span className="text-xs text-secondary ml-2">({tracks.length} copies)</span>
                </div>
                <button
                  onClick={() => selectAllFromGroup(tracks)}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Select All
                </button>
              </div>
              <div className="space-y-1">
                {tracks.map(track => (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                      selectedIds.has(track.id)
                        ? 'bg-red-600/20 border border-red-500/30'
                        : 'hover:bg-white/5'
                    }`}
                    onClick={() => toggleSelect(track.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(track.id)}
                      onChange={() => toggleSelect(track.id)}
                      className="w-4 h-4 rounded bg-surface-2 border-surface-3 text-brand-500 focus:ring-brand-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{track.title}</p>
                      <p className="text-xs text-secondary truncate">{track.artist} &middot; {track.album}</p>
                    </div>
                    <span className="text-xs text-tertiary shrink-0">{formatDuration(track.duration_ms)}</span>
                    <span className="text-xs text-tertiary shrink-0 truncate max-w-[200px]">{track.file_name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Similar Tracks */}
      {activeView === 'similar' && similarTracks.length > 0 && (
        <div className="space-y-3">
          {similarTracks.map((group, idx) => (
            <div key={idx} className="surface-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-medium text-primary">{group.title}</span>
                  <span className="text-sm text-secondary"> &middot; {group.artist}</span>
                  <span className="text-xs text-secondary ml-2">({group.count} copies)</span>
                </div>
                <button
                  onClick={() => selectAllFromGroup(group.tracks)}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Select All
                </button>
              </div>
              <div className="space-y-1">
                {group.tracks.map(track => (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                      selectedIds.has(track.id)
                        ? 'bg-red-600/20 border border-red-500/30'
                        : 'hover:bg-white/5'
                    }`}
                    onClick={() => toggleSelect(track.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(track.id)}
                      onChange={() => toggleSelect(track.id)}
                      className="w-4 h-4 rounded bg-surface-2 border-surface-3 text-brand-500 focus:ring-brand-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{track.title}</p>
                      <p className="text-xs text-secondary truncate">{track.artist} &middot; {track.album}</p>
                    </div>
                    <span className="text-xs text-tertiary shrink-0">{formatDuration(track.duration_ms)}</span>
                    <span className="text-xs text-tertiary shrink-0 truncate max-w-[200px]">{track.file_name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && totalGroups === 0 && (
        <div className="surface-card p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-tertiary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-secondary text-sm">Click scan to find duplicates in your library</p>
        </div>
      )}
    </motion.div>
  );
}

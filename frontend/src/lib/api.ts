import type {
  Track,
  Album,
  Artist,
  Playlist,
  Library,
  PaginatedResponse,
  SearchResults,
  ScanProgress,
  Stats,
  QueryParams,
  ScrobblingConfig,
  LyricsData,
  UpdateStatus,
  UpdaterConfig,
  ImportPreview,
  ImportFormat,
  ImportConfirmTrack,
  DeviceTrack,
  DeviceScanResult,
  TransferPlatform,
} from '../types';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  libraries: {
    list: () => fetchJson<Library[]>('/libraries'),
    create: (data: { name: string; path: string }) =>
      fetchJson<Library>('/libraries', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson(`/libraries/${id}`, { method: 'DELETE' }),
    scan: (id: string) =>
      fetchJson(`/libraries/${id}/scan`, { method: 'POST' }),
    scanProgress: (id: string) =>
      fetchJson<ScanProgress>(`/libraries/${id}/scan/progress`),
  },

  tracks: {
    list: (params?: QueryParams) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value));
          }
        });
      }
      const query = searchParams.toString();
      return fetchJson<PaginatedResponse<Track>>(`/tracks${query ? `?${query}` : ''}`);
    },
    get: (id: string) => fetchJson<Track>(`/tracks/${id}`),
    update: (id: string, data: Partial<Track>) =>
      fetchJson<Track>(`/tracks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    play: (id: string) =>
      fetchJson(`/tracks/${id}/play`, { method: 'POST' }),
    streamUrl: (id: string) => `${BASE_URL}/tracks/${id}/stream`,
    artworkUrl: (id: string) => `${BASE_URL}/tracks/${id}/artwork`,
    getLyrics: (id: string) => fetchJson<LyricsData>(`/tracks/${id}/lyrics`),
    fetchLyrics: (id: string) =>
      fetchJson<LyricsData>(`/tracks/${id}/lyrics/fetch`, { method: 'POST' }),
    updateLyrics: (id: string, lyrics: string) =>
      fetchJson(`/tracks/${id}/lyrics`, {
        method: 'PUT',
        body: JSON.stringify({ lyrics }),
      }),
  },

  albums: {
    list: (params?: QueryParams) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value));
          }
        });
      }
      const query = searchParams.toString();
      return fetchJson<PaginatedResponse<Album>>(`/albums${query ? `?${query}` : ''}`);
    },
  },

  artists: {
    list: (params?: QueryParams) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value));
          }
        });
      }
      const query = searchParams.toString();
      return fetchJson<PaginatedResponse<Artist>>(`/artists${query ? `?${query}` : ''}`);
    },
  },

  search: (q: string, limit?: number, offset?: number) => {
    const searchParams = new URLSearchParams({ q });
    if (limit) searchParams.set('limit', String(limit));
    if (offset) searchParams.set('offset', String(offset));
    return fetchJson<SearchResults>(`/search?${searchParams.toString()}`);
  },

  genres: () => fetchJson<string[]>('/genres'),
  folders: () => fetchJson<string[]>('/folders'),
  stats: () => fetchJson<Stats>('/stats'),

  browse: (path?: string) => {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return fetchJson<{ current: string; entries: { name: string; path: string; is_dir: boolean }[] }>(`/browse${query}`);
  },

  playlists: {
    list: (libraryId?: string) => {
      const params = libraryId ? `?library_id=${libraryId}` : '';
      return fetchJson<Playlist[]>(`/playlists${params}`);
    },
    create: (data: { name: string; description?: string; is_smart?: boolean; smart_filter?: string; parent_id?: string }) =>
      fetchJson<Playlist>('/playlists', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson(`/playlists/${id}`, { method: 'DELETE' }),
    tracks: (id: string) => fetchJson<Track[]>(`/playlists/${id}/tracks`),
    addTrack: (playlistId: string, trackId: string, position?: number) =>
      fetchJson(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ track_id: trackId, position }),
      }),
    shuffle: (id: string, mode?: string) =>
      fetchJson<{ success: boolean; message: string; affected_tracks?: number; details?: any }>(`/playlists/${id}/shuffle`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      }),
    sort: (id: string, sortBy: string, order?: string) =>
      fetchJson<{ success: boolean; message: string; affected_tracks?: number; details?: any }>(`/playlists/${id}/sort`, {
        method: 'POST',
        body: JSON.stringify({ sort_by: sortBy, order }),
      }),
    dedupe: (id: string, strategy?: string) =>
      fetchJson<{ success: boolean; message: string; affected_tracks?: number; details?: any }>(`/playlists/${id}/dedupe`, {
        method: 'POST',
        body: JSON.stringify({ strategy }),
      }),
    stats: (id: string) =>
      fetchJson<any>(`/playlists/${id}/stats`),
    share: (id: string, name: string, description?: string) =>
      fetchJson<{ success: boolean; message: string; details?: any }>(`/playlists/${id}/share`, {
        method: 'POST',
        body: JSON.stringify({ name, description, include_metadata: true }),
      }),
    generate: (data: { name: string; source: string; source_value?: string; count?: number; min_rating?: number; min_duration_ms?: number; max_duration_ms?: number }) =>
      fetchJson<{ success: boolean; message: string; playlist_id?: string; affected_tracks?: number }>(`/playlists/generate`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  settings: {
    getScrobbling: () => fetchJson<ScrobblingConfig>('/settings/scrobbling'),
    updateScrobbling: (data: Partial<ScrobblingConfig>) =>
      fetchJson<{ success: boolean; config: ScrobblingConfig }>('/settings/scrobbling', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    testScrobbling: (service: string = 'all') =>
      fetchJson<{ success: boolean; services: Record<string, { connected: boolean; username?: string }> }>(
        `/settings/scrobbling/test?service=${service}`,
        { method: 'POST' }
      ),
  },

  updater: {
    getStatus: () => fetchJson<UpdateStatus>('/updater/status'),
    check: () => fetchJson<UpdateStatus>('/updater/check', { method: 'POST' }),
    update: () => fetchJson<{ success: boolean; message: string }>('/updater/update', { method: 'POST' }),
    getConfig: () => fetchJson<UpdaterConfig>('/updater/config'),
    updateConfig: (data: UpdaterConfig) =>
      fetchJson<{ success: boolean; config: UpdaterConfig }>('/updater/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  import: {
    formats: () => fetchJson<{ formats: ImportFormat[] }>('/import/formats'),
    preview: (platform: string, content: string) =>
      fetchJson<ImportPreview>('/import/preview', {
        method: 'POST',
        body: JSON.stringify({ platform, content }),
      }),
    confirm: (platform: string, playlistName: string, tracks: ImportConfirmTrack[]) =>
      fetchJson<{ success: boolean; playlist_id: string; tracks_added: number }>('/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ platform, playlist_name: playlistName, tracks }),
      }),
    deviceScan: (libraryId: string | null, tracks: DeviceTrack[]) =>
      fetchJson<DeviceScanResult>('/import/device', {
        method: 'POST',
        body: JSON.stringify({ library_id: libraryId, tracks }),
      }),
  },

  transfer: {
    platforms: () => fetchJson<{ platforms: TransferPlatform[] }>('/transfer/platforms'),
    export: (playlistId: string, targetPlatform: string) =>
      fetch(`/api/transfer/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId, target_platform: targetPlatform }),
      }),
  },
};

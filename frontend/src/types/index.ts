export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  album_artist?: string;
  genre?: string;
  year?: number;
  track_number?: number;
  disc_number?: number;
  duration_ms: number;
  file_path: string;
  file_name: string;
  file_size: number;
  file_modified?: string;
  format: string;
  sample_rate?: number;
  bit_depth?: number;
  bitrate?: number;
  channels?: number;
  codec?: string;
  composer?: string;
  lyricist?: string;
  mood?: string;
  bpm?: number;
  rating?: number;
  play_count: number;
  skip_count: number;
  last_played?: string;
  date_added: string;
  has_artwork: boolean;
  artwork_hash?: string;
  lyrics?: string;
  comment?: string;
  grouping?: string;
  copyright?: string;
  custom_tags?: string;
  folder: string;
  library_id: string;
  fingerprint?: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  track_count: number;
  total_duration_ms: number;
  has_artwork: boolean;
  artwork_hash?: string;
  date_added: string;
  library_id: string;
}

export interface Artist {
  id: string;
  name: string;
  album_count: number;
  track_count: number;
  total_duration_ms: number;
  has_artwork: boolean;
  artwork_hash?: string;
  date_added: string;
  library_id: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  is_smart: boolean;
  smart_filter?: string;
  parent_id?: string;
  sort_order: number;
  track_count: number;
  total_duration_ms: number;
  created_at: string;
  updated_at: string;
  library_id: string;
}

export interface Library {
  id: string;
  name: string;
  path: string;
  is_scanning: boolean;
  track_count: number;
  last_scan?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  total: number;
}

export interface ScanProgress {
  files_found: number;
  files_processed: number;
  files_skipped: number;
  errors: number;
  is_scanning: boolean;
}

export interface QueryParams {
  page?: number;
  per_page?: number;
  sort?: string;
  order?: string;
  search?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  folder?: string;
  mood?: string;
  min_rating?: number;
  library_id?: string;
}

export interface Stats {
  total_tracks: number;
  total_albums: number;
  total_artists: number;
  total_duration_ms: number;
  total_size_bytes: number;
  top_artists: { name: string; track_count: number }[];
  recently_played: Track[];
  most_played: Track[];
}

export type ViewMode = 'grid' | 'list';
export type SortField = 'title' | 'artist' | 'album' | 'year' | 'date_added' | 'duration_ms' | 'play_count' | 'rating';
export type SortOrder = 'ASC' | 'DESC';
export type Theme = 'dark' | 'light' | 'amoled';
export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueItem {
  track: Track;
  addedAt: number;
}

export interface ScrobblingConfig {
  lastfm: {
    enabled: boolean;
    api_key: string | null;
    api_secret: string | null;
    session_key: string | null;
    username: string | null;
  };
  listenbrainz: {
    enabled: boolean;
    token: string | null;
  };
}

export interface LyricsLine {
  timeMs: number;
  text: string;
}

export interface LyricsData {
  plain: string;
  synced: string | null;
}

export interface UpdateStatus {
  current_version: string;
  current_commit: string;
  latest_version: string;
  latest_commit: string;
  update_available: boolean;
  last_checked: string;
  docker_socket: boolean;
}

export interface UpdaterConfig {
  auto_check: boolean;
  check_interval_hours: number;
  docker_socket: boolean;
}

export interface ImportTrack {
  title: string;
  artist: string;
  album?: string;
  duration_ms?: number;
  platform_id?: string;
}

export interface MatchedTrack {
  import_track: ImportTrack;
  track_id: string;
  match_type: string;
  confidence: number;
}

export interface ImportPreview {
  platform: string;
  playlist_name: string;
  total_tracks: number;
  matched: MatchedTrack[];
  unmatched: ImportTrack[];
}

export interface ImportFormat {
  id: string;
  name: string;
  description: string;
  extensions: string[];
  example: string;
}

export interface ImportConfirmTrack {
  title: string;
  artist: string;
  album?: string;
  duration_ms?: number;
  platform_id?: string;
  track_id?: string;
}

export interface DeviceTrack {
  path: string;
  title: string;
  artist: string;
  album: string;
  duration_ms?: number;
  year?: number;
  track_number?: number;
  file_name: string;
  mime_type?: string;
  file_size?: number;
  date_added?: number;
}

export interface DeviceScanResult {
  success: boolean;
  library_id: string;
  tracks_added: number;
  tracks_skipped: number;
  total_scanned: number;
}

export interface PlayerState {
  currentTrack: Track | null;
  queue: QueueItem[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  crossfade: boolean;
  crossfadeDuration: number;
  audioInfo: {
    format: string;
    codec: string;
    sampleRate: number;
    bitDepth?: number;
    bitrate: number;
    channels: number;
  } | null;
}

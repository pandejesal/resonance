use crate::models::Track;
use dashmap::DashMap;
use lofty::prelude::*;
use log::warn;
use rayon::prelude::*;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::Arc;
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "alac", "wav", "aiff", "aif", "ogg", "opus", "aac", "m4a", "mp4", "m4b", "dsf",
    "dff",
];

pub struct Scanner {
    libraries: DashMap<String, LibraryScanState>,
}

#[derive(Clone)]
pub struct LibraryScanState {
    pub is_scanning: Arc<AtomicBool>,
    pub files_found: Arc<AtomicI32>,
    pub files_processed: Arc<AtomicI32>,
    pub files_skipped: Arc<AtomicI32>,
    pub errors: Arc<AtomicI32>,
}

impl Default for Scanner {
    fn default() -> Self {
        Self::new()
    }
}

impl Scanner {
    pub fn new() -> Self {
        Self {
            libraries: DashMap::new(),
        }
    }

    #[allow(dead_code)]
    pub fn is_scanning(&self, library_id: &str) -> bool {
        self.libraries
            .get(library_id)
            .map(|s| s.is_scanning.load(Ordering::Relaxed))
            .unwrap_or(false)
    }

    pub fn get_progress(&self, library_id: &str) -> Option<(i32, i32, i32, i32, bool)> {
        self.libraries.get(library_id).map(|s| {
            (
                s.files_found.load(Ordering::Relaxed),
                s.files_processed.load(Ordering::Relaxed),
                s.files_skipped.load(Ordering::Relaxed),
                s.errors.load(Ordering::Relaxed),
                s.is_scanning.load(Ordering::Relaxed),
            )
        })
    }

    pub fn scan_library(&self, library_id: String, _path: String) -> Arc<LibraryScanState> {
        let state = Arc::new(LibraryScanState {
            is_scanning: Arc::new(AtomicBool::new(true)),
            files_found: Arc::new(AtomicI32::new(0)),
            files_processed: Arc::new(AtomicI32::new(0)),
            files_skipped: Arc::new(AtomicI32::new(0)),
            errors: Arc::new(AtomicI32::new(0)),
        });
        self.libraries.insert(library_id, (*state).clone());
        state
    }

    #[allow(dead_code)]
    pub fn stop_scanning(&self, library_id: &str) {
        if let Some(state) = self.libraries.get(library_id) {
            state.is_scanning.store(false, Ordering::Relaxed);
        }
    }

    pub fn collect_files(path: &str) -> Vec<PathBuf> {
        let root = match std::fs::canonicalize(path) {
            Ok(p) => p,
            Err(_) => return Vec::new(),
        };
        WalkDir::new(path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                e.path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
                    .unwrap_or(false)
            })
            .filter(|e| {
                // Ensure resolved path stays under library root
                e.path()
                    .canonicalize()
                    .map(|p| p.starts_with(&root))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
            .collect()
    }

    pub fn scan_files_parallel(
        files: Vec<PathBuf>,
        library_id: &str,
        state: &LibraryScanState,
    ) -> Vec<Track> {
        let files_found = files.len() as i32;
        state.files_found.store(files_found, Ordering::Relaxed);

        let results: Vec<Option<Track>> = files
            .par_iter()
            .map(|path| {
                if !state.is_scanning.load(Ordering::Relaxed) {
                    return None;
                }

                match extract_metadata(path, library_id) {
                    Ok(mut track) => {
                        let file_path_str = path.to_string_lossy().to_string();
                        track.fingerprint = compute_fingerprint(&file_path_str);
                        state.files_processed.fetch_add(1, Ordering::Relaxed);
                        Some(track)
                    }
                    Err(e) => {
                        warn!("Failed to read {}: {}", path.display(), e);
                        state.errors.fetch_add(1, Ordering::Relaxed);
                        None
                    }
                }
            })
            .collect();

        state.is_scanning.store(false, Ordering::Relaxed);
        results.into_iter().flatten().collect()
    }
}

pub fn extract_metadata(
    path: &Path,
    library_id: &str,
) -> Result<Track, Box<dyn std::error::Error>> {
    let path_str = path.to_string_lossy().to_string();
    let mut track = Track::new(path_str.clone(), library_id.to_string());

    let file_size = std::fs::metadata(path)?.len() as i64;
    track.file_size = file_size;

    if let Ok(modified) = std::fs::metadata(path).and_then(|m| m.modified()) {
        track.file_modified = Some(chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339());
    }

    let tagged_file = lofty::read_from_path(path)?;

    let properties = tagged_file.properties();
    track.duration_ms = properties.duration().as_millis() as i64;
    track.sample_rate = properties.sample_rate().map(|v| v as i32);
    track.bitrate = properties.audio_bitrate().map(|v| v as i32);
    track.channels = properties.channels().map(|v| v as i32);

    track.format = format!("{:?}", tagged_file.file_type()).to_lowercase();
    track.codec = Some(format!("{:?}", tagged_file.file_type()));

    if let Some(tag) = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())
    {
        track.title = tag
            .get_string(&ItemKey::TrackTitle)
            .unwrap_or("")
            .to_string();
        track.artist = tag
            .get_string(&ItemKey::TrackArtist)
            .unwrap_or("")
            .to_string();
        track.album = tag
            .get_string(&ItemKey::AlbumTitle)
            .unwrap_or("")
            .to_string();
        track.album_artist = tag.get_string(&ItemKey::AlbumArtist).map(|s| s.to_string());
        track.genre = tag.get_string(&ItemKey::Genre).map(|s| s.to_string());
        track.year = tag
            .get_string(&ItemKey::RecordingDate)
            .or_else(|| tag.get_string(&ItemKey::Year))
            .and_then(|s| s.parse::<i32>().ok());
        track.track_number = tag
            .get_string(&ItemKey::TrackNumber)
            .and_then(|s| s.parse::<i32>().ok());
        track.disc_number = tag
            .get_string(&ItemKey::DiscNumber)
            .and_then(|s| s.parse::<i32>().ok());
        track.composer = tag.get_string(&ItemKey::Composer).map(|s| s.to_string());
        track.lyricist = tag.get_string(&ItemKey::Lyricist).map(|s| s.to_string());
        track.comment = tag.get_string(&ItemKey::Comment).map(|s| s.to_string());
        track.lyrics = tag.get_string(&ItemKey::Lyrics).map(|s| s.to_string());

        let replaygain = [
            ItemKey::ReplayGainTrackGain,
            ItemKey::ReplayGainTrackPeak,
            ItemKey::ReplayGainAlbumGain,
            ItemKey::ReplayGainAlbumPeak,
        ]
        .iter()
        .any(|key| tag.get_string(key).is_some());
        if replaygain {
            track.track_gain = tag
                .get_string(&ItemKey::ReplayGainTrackGain)
                .and_then(parse_gain_db);
            track.track_peak = tag
                .get_string(&ItemKey::ReplayGainTrackPeak)
                .and_then(|s| s.trim().parse::<f64>().ok());
            track.album_gain = tag
                .get_string(&ItemKey::ReplayGainAlbumGain)
                .and_then(parse_gain_db);
            track.album_peak = tag
                .get_string(&ItemKey::ReplayGainAlbumPeak)
                .and_then(|s| s.trim().parse::<f64>().ok());
            track.gain_computed_at = Some(chrono::Utc::now().to_rfc3339());
        }

        track.has_artwork = !tag.pictures().is_empty();
    }

    if track.title.is_empty() {
        track.title = path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
    }
    if track.artist.is_empty() {
        track.artist = "Unknown Artist".to_string();
    }
    if track.album.is_empty() {
        track.album = "Unknown Album".to_string();
    }

    Ok(track)
}

fn parse_gain_db(s: &str) -> Option<f64> {
    let trimmed = s.trim();
    let value = trimmed.strip_suffix("dB").map(str::trim).unwrap_or(trimmed);
    value.parse::<f64>().ok()
}

pub fn extract_artwork(path: &Path) -> Result<Option<Vec<u8>>, Box<dyn std::error::Error>> {
    let tagged_file = lofty::read_from_path(path)?;

    if let Some(tag) = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())
    {
        if let Some(picture) = tag.pictures().first() {
            return Ok(Some(picture.data().to_vec()));
        }
    }

    Ok(None)
}

pub fn compute_waveform_peaks(file_path: &str) -> Option<String> {
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = std::fs::File::open(file_path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let hint = Hint::new();
    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &fmt_opts, &meta_opts)
        .ok()?;

    let mut format = probed.format;
    let track = format.default_track()?;
    let track_id = track.id;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .ok()?;

    let sample_rate = track.codec_params.sample_rate? as f64;
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);
    let chunk_duration_secs = 0.05; // 50ms chunks
    let samples_per_chunk = (sample_rate * chunk_duration_secs) as usize;

    let mut peaks: Vec<f32> = Vec::new();
    let mut chunk_samples: Vec<f32> = Vec::new();
    let mut max_in_chunk: f32 = 0.0;

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }

        if let Ok(audio_buf_ref) = decoder.decode(&packet) {
            let spec = *audio_buf_ref.spec();
            let frames = audio_buf_ref.frames();
            let mut sample_buf = SampleBuffer::<f32>::new(frames as u64, spec);
            sample_buf.copy_interleaved_ref(audio_buf_ref.clone());

            let samples = sample_buf.samples();
            let mono: Vec<f32> = if channels > 1 {
                samples
                    .chunks(channels)
                    .map(|frame| frame.iter().sum::<f32>() / channels as f32)
                    .collect()
            } else {
                samples.to_vec()
            };

            for &sample in &mono {
                let s = sample.abs();
                if s > max_in_chunk {
                    max_in_chunk = s;
                }
                chunk_samples.push(s);

                if chunk_samples.len() >= samples_per_chunk {
                    peaks.push(max_in_chunk);
                    chunk_samples.clear();
                    max_in_chunk = 0.0;
                }
            }
        }
    }

    // Flush remaining samples
    if !chunk_samples.is_empty() {
        peaks.push(max_in_chunk);
    }

    if peaks.is_empty() {
        return None;
    }

    // Downsample to ~2000 peaks max for storage
    let target_peaks = 2000.min(peaks.len());
    if peaks.len() > target_peaks {
        let ratio = peaks.len() as f64 / target_peaks as f64;
        let downsampled: Vec<f32> = (0..target_peaks)
            .map(|i| {
                let start = (i as f64 * ratio) as usize;
                let end = ((i + 1) as f64 * ratio) as usize;
                peaks[start..end.min(peaks.len())]
                    .iter()
                    .cloned()
                    .fold(0.0f32, f32::max)
            })
            .collect();
        Some(serde_json::to_string(&downsampled).unwrap_or_default())
    } else {
        Some(serde_json::to_string(&peaks).unwrap_or_default())
    }
}

pub fn compute_fingerprint(file_path: &str) -> Option<String> {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = std::fs::File::open(file_path).ok()?;
    let file_size = file.metadata().ok()?.len();
    let mut hasher = DefaultHasher::new();

    // Hash first 64KB
    let mut head = [0u8; 65536];
    let head_len = file.read(&mut head).unwrap_or(0);
    head[..head_len].hash(&mut hasher);

    // Hash last 64KB
    if file_size > 65536 {
        file.seek(SeekFrom::End(-65536)).ok()?;
        let mut tail = [0u8; 65536];
        file.read_exact(&mut tail).ok()?;
        tail.hash(&mut hasher);
    }

    // Hash file size
    file_size.hash(&mut hasher);

    // Hash middle of file
    if file_size > 131072 {
        let mid_pos = file_size / 2;
        file.seek(SeekFrom::Start(mid_pos)).ok()?;
        let mut mid = [0u8; 65536];
        file.read_exact(&mut mid).ok()?;
        mid.hash(&mut hasher);
    }

    Some(format!("{:016x}", hasher.finish()))
}

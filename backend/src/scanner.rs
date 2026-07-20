use lofty::prelude::*;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use rayon::prelude::*;
use dashmap::DashMap;
use std::sync::atomic::{AtomicI32, AtomicBool, Ordering};
use std::sync::Arc;
use log::warn;
use crate::models::Track;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "alac", "wav", "aiff", "aif", "ogg", "opus",
    "aac", "m4a", "mp4", "m4b", "dsf", "dff",
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

impl Scanner {
    pub fn new() -> Self {
        Self {
            libraries: DashMap::new(),
        }
    }

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

    pub fn scan_library(
        &self,
        library_id: String,
        _path: String,
    ) -> Arc<LibraryScanState> {
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

    pub fn stop_scanning(&self, library_id: &str) {
        if let Some(state) = self.libraries.get(library_id) {
            state.is_scanning.store(false, Ordering::Relaxed);
        }
    }

    pub fn collect_files(path: &str) -> Vec<PathBuf> {
        WalkDir::new(path)
            .follow_links(true)
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
                    Ok(track) => {
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

pub fn extract_metadata(path: &Path, library_id: &str) -> Result<Track, Box<dyn std::error::Error>> {
    let path_str = path.to_string_lossy().to_string();
    let mut track = Track::new(path_str.clone(), library_id.to_string());

    let file_size = std::fs::metadata(path)?.len() as i64;
    track.file_size = file_size;

    if let Ok(modified) = std::fs::metadata(path).and_then(|m| m.modified()) {
        track.file_modified = Some(
            chrono::DateTime::<chrono::Utc>::from(modified)
                .to_rfc3339(),
        );
    }

    let tagged_file = lofty::read_from_path(path)?;

    let properties = tagged_file.properties();
    track.duration_ms = properties.duration().as_millis() as i64;
    track.sample_rate = properties.sample_rate().map(|v| v as i32);
    track.bitrate = properties.audio_bitrate().map(|v| v as i32);
    track.channels = properties.channels().map(|v| v as i32);

    track.format = format!("{:?}", tagged_file.file_type()).to_lowercase();
    track.codec = Some(format!("{:?}", tagged_file.file_type()));

    if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
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
        track.album_artist = tag
            .get_string(&ItemKey::AlbumArtist)
            .map(|s| s.to_string());
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

pub fn extract_artwork(path: &Path) -> Result<Option<Vec<u8>>, Box<dyn std::error::Error>> {
    let tagged_file = lofty::read_from_path(path)?;

    if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
        if let Some(picture) = tag.pictures().first() {
            return Ok(Some(picture.data().to_vec()));
        }
    }

    Ok(None)
}

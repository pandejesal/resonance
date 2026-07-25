use dashmap::DashMap;
use log::{error, info, warn};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use sqlx::SqlitePool;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::scanner::Scanner;
use parking_lot::Mutex;

const DEBOUNCE_WINDOW: Duration = Duration::from_secs(5);

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "alac", "wav", "aiff", "aif", "ogg", "opus", "aac", "m4a", "mp4", "dsf", "dff",
];

pub struct WatcherService {
    watchers: DashMap<String, RecommendedWatcher>,
    library_paths: DashMap<String, String>,
    db: SqlitePool,
    scanner: Arc<Mutex<Scanner>>,
    last_event: DashMap<String, Instant>,
}

impl WatcherService {
    pub fn new(db: SqlitePool, scanner: Arc<Mutex<Scanner>>) -> Self {
        Self {
            watchers: DashMap::new(),
            library_paths: DashMap::new(),
            db,
            scanner,
            last_event: DashMap::new(),
        }
    }

    pub fn add_library(&mut self, library_id: &str, path: &str) -> Result<(), String> {
        if !Path::new(path).exists() {
            return Err(format!("Path does not exist: {}", path));
        }

        self.library_paths
            .insert(library_id.to_string(), path.to_string());

        let db = self.db.clone();
        let scanner = self.scanner.clone();
        let library_id_owned = library_id.to_string();
        let path_owned = path.to_string();
        let last_event = self.last_event.clone();

        let mut watcher =
            notify::recommended_watcher(move |res: Result<Event, notify::Error>| match res {
                Ok(event) => {
                    handle_event(
                        &event,
                        &library_id_owned,
                        &path_owned,
                        &db,
                        &scanner,
                        &last_event,
                    );
                }
                Err(e) => {
                    error!("Watch error for library {}: {}", library_id_owned, e);
                }
            })
            .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(path.as_ref(), RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to start watching {}: {}", path, e))?;

        self.watchers.insert(library_id.to_string(), watcher);
        info!("Started watching library {} at {}", library_id, path);

        Ok(())
    }

    pub fn remove_library(&mut self, library_id: &str) {
        if let Some((_, mut watcher)) = self.watchers.remove(library_id) {
            if let Some((_, path)) = self.library_paths.remove(library_id) {
                let _ = watcher.unwatch(Path::new(&path));
            }
            drop(watcher);
            info!("Stopped watching library {}", library_id);
        }
        self.last_event.remove(library_id);
    }

    pub fn start_watching(&mut self) -> Result<(), String> {
        let paths: Vec<(String, String)> = self.library_paths.iter()
            .map(|r| (r.key().clone(), r.value().clone()))
            .collect();
        let mut errors = Vec::new();

        for (library_id, path_str) in &paths {
            if let Err(e) = self.add_library(library_id, path_str) {
                errors.push(format!("Library {}: {}", library_id, e));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("; "))
        }
    }
}

fn handle_event(
    event: &Event,
    library_id: &str,
    library_path: &str,
    db: &SqlitePool,
    scanner: &Arc<Mutex<Scanner>>,
    last_event: &DashMap<String, Instant>,
) {
    let now = Instant::now();

    for path in &event.paths {
        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
            if filename.starts_with('.') || filename.starts_with('~') {
                return;
            }
        }

        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if !SUPPORTED_EXTENSIONS.contains(&ext_lower.as_str()) {
                return;
            }
        } else {
            return;
        }
    }

    match event.kind {
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
            last_event.insert(library_id.to_string(), now);

            if scanner.lock().is_scanning(library_id) {
                return;
            }

            let should_scan = last_event
                .get(library_id)
                .map(|r| now.duration_since(*r.value()) >= DEBOUNCE_WINDOW)
                .unwrap_or(true);

            if should_scan {
                let db = db.clone();
                let scanner = scanner.clone();
                let library_id = library_id.to_string();
                let library_path = library_path.to_string();

                tokio::spawn(async move {
                    info!(
                        "Triggering incremental rescan for library {} at {}",
                        library_id, library_path
                    );
                    let state = scanner
                        .lock()
                        .scan_library(library_id.clone(), library_path.clone());
                    let files = Scanner::collect_files(&library_path);
                    let tracks = Scanner::scan_files_parallel(files, &library_id, &state);

                    for track in &tracks {
                        let _ = sqlx::query(
                            "INSERT OR REPLACE INTO tracks (id, title, artist, album, album_artist, genre, year, track_number, disc_number, duration_ms, file_path, file_name, file_size, file_modified, format, sample_rate, bit_depth, bitrate, channels, codec, composer, lyricist, mood, bpm, rating, play_count, skip_count, last_played, date_added, has_artwork, artwork_hash, lyrics, comment, grouping, copyright, custom_tags, folder, library_id, fingerprint, waveform_peaks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                        )
                        .bind(&track.id)
                        .bind(&track.title)
                        .bind(&track.artist)
                        .bind(&track.album)
                        .bind(&track.album_artist)
                        .bind(&track.genre)
                        .bind(&track.year)
                        .bind(&track.track_number)
                        .bind(&track.disc_number)
                        .bind(&track.duration_ms)
                        .bind(&track.file_path)
                        .bind(&track.file_name)
                        .bind(&track.file_size)
                        .bind(&track.file_modified)
                        .bind(&track.format)
                        .bind(&track.sample_rate)
                        .bind(&track.bit_depth)
                        .bind(&track.bitrate)
                        .bind(&track.channels)
                        .bind(&track.codec)
                        .bind(&track.composer)
                        .bind(&track.lyricist)
                        .bind(&track.mood)
                        .bind(&track.bpm)
                        .bind(&track.rating)
                        .bind(&track.play_count)
                        .bind(&track.skip_count)
                        .bind(&track.last_played)
                        .bind(&track.date_added)
                        .bind(&track.has_artwork)
                        .bind(&track.artwork_hash)
                        .bind(&track.lyrics)
                        .bind(&track.comment)
                        .bind(&track.grouping)
                        .bind(&track.copyright)
                        .bind(&track.custom_tags)
                        .bind(&track.folder)
                        .bind(&track.library_id)
                        .bind(&track.fingerprint)
                        .bind(&track.waveform_peaks)
                        .execute(&db)
                        .await
                        .map_err(|e| warn!("Failed to insert track {}: {}", track.file_path, e))
                        .ok();
                    }

                    info!(
                        "Completed incremental rescan for library {}: {} tracks",
                        library_id,
                        tracks.len()
                    );
                });
            }
        }
        _ => {}
    }
}

pub async fn start_watching_task(service: Arc<Mutex<WatcherService>>) {
    info!("File watcher background task started");

    loop {
        tokio::time::sleep(Duration::from_secs(1)).await;

        let libraries: Vec<(String, String)> = {
            let svc = service.lock();
            svc.library_paths
                .iter()
                .map(|r| (r.key().clone(), r.value().clone()))
                .collect()
        };

        for (library_id, path) in libraries {
            let should_rescan = {
                let svc = service.lock();
                let now = Instant::now();
                svc.last_event
                    .get(&library_id)
                    .map(|r| {
                        now.duration_since(*r.value()) >= DEBOUNCE_WINDOW
                            && !svc.scanner.lock().is_scanning(&library_id)
                    })
                    .unwrap_or(false)
            };

            if should_rescan {
                info!(
                    "Debounce window elapsed for library {}, scanning",
                    library_id
                );

                let db = service.lock().db.clone();
                let scanner = service.lock().scanner.clone();

                let state = scanner
                    .lock()
                    .scan_library(library_id.clone(), path.clone());
                let files = Scanner::collect_files(&path);
                let tracks = Scanner::scan_files_parallel(files, &library_id, &state);

                for track in &tracks {
                    let _ = sqlx::query(
                        "INSERT OR REPLACE INTO tracks (id, title, artist, album, album_artist, genre, year, track_number, disc_number, duration_ms, file_path, file_name, file_size, file_modified, format, sample_rate, bit_depth, bitrate, channels, codec, composer, lyricist, mood, bpm, rating, play_count, skip_count, last_played, date_added, has_artwork, artwork_hash, lyrics, comment, grouping, copyright, custom_tags, folder, library_id, fingerprint, waveform_peaks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                    )
                    .bind(&track.id)
                    .bind(&track.title)
                    .bind(&track.artist)
                    .bind(&track.album)
                    .bind(&track.album_artist)
                    .bind(&track.genre)
                    .bind(&track.year)
                    .bind(&track.track_number)
                    .bind(&track.disc_number)
                    .bind(&track.duration_ms)
                    .bind(&track.file_path)
                    .bind(&track.file_name)
                    .bind(&track.file_size)
                    .bind(&track.file_modified)
                    .bind(&track.format)
                    .bind(&track.sample_rate)
                    .bind(&track.bit_depth)
                    .bind(&track.bitrate)
                    .bind(&track.channels)
                    .bind(&track.codec)
                    .bind(&track.composer)
                    .bind(&track.lyricist)
                    .bind(&track.mood)
                    .bind(&track.bpm)
                    .bind(&track.rating)
                    .bind(&track.play_count)
                    .bind(&track.skip_count)
                    .bind(&track.last_played)
                    .bind(&track.date_added)
                    .bind(&track.has_artwork)
                    .bind(&track.artwork_hash)
                    .bind(&track.lyrics)
                    .bind(&track.comment)
                    .bind(&track.grouping)
                    .bind(&track.copyright)
                    .bind(&track.custom_tags)
                    .bind(&track.folder)
                    .bind(&track.library_id)
                    .bind(&track.fingerprint)
                    .bind(&track.waveform_peaks)
                    .execute(&db)
                    .await
                    .map_err(|e| warn!("Failed to insert track {}: {}", track.file_path, e))
                    .ok();
                }

                service.lock().last_event.remove(&library_id);

                info!(
                    "Incremental rescan completed for library {}: {} tracks",
                    library_id,
                    tracks.len()
                );
            }
        }
    }
}

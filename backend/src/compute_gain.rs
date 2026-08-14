use ebur128::{EbuR128, Mode};
use log::warn;
use sqlx::SqlitePool;
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};

use crate::models::Track;

#[derive(Debug, Clone, serde::Serialize)]
pub struct TrackGain {
    pub track_gain: Option<f64>,
    pub track_peak: Option<f64>,
    pub album_gain: Option<f64>,
    pub album_peak: Option<f64>,
    pub computed: bool,
}

static IN_FLIGHT: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn in_flight() -> &'static Mutex<HashSet<String>> {
    IN_FLIGHT.get_or_init(|| Mutex::new(HashSet::new()))
}

pub async fn get_track_gain(db: &SqlitePool, track_id: &str) -> Option<TrackGain> {
    let row = sqlx::query_as::<_, (Option<f64>, Option<f64>, Option<f64>, Option<f64>, Option<String>)>(
        "SELECT track_gain, track_peak, album_gain, album_peak, gain_computed_at FROM tracks WHERE id = ?",
    )
    .bind(track_id)
    .fetch_optional(db)
    .await
    .ok()??;

    Some(TrackGain {
        track_gain: row.0,
        track_peak: row.1,
        album_gain: row.2,
        album_peak: row.3,
        computed: row.4.is_some(),
    })
}

/// Compute ReplayGain for a track by decoding it and measuring LUFS, or
/// return existing data if already computed.
pub async fn compute_track_gain(db: &SqlitePool, track_id: &str) -> Result<TrackGain, String> {
    if let Some(gain) = get_track_gain(db, track_id).await {
        if gain.computed && gain.track_gain.is_some() {
            return Ok(gain);
        }
    }

    {
        let mut guard = in_flight().lock().unwrap_or_else(|e| e.into_inner());
        if guard.contains(track_id) {
            return Ok(get_track_gain(db, track_id).await.unwrap_or(TrackGain {
                track_gain: None,
                track_peak: None,
                album_gain: None,
                album_peak: None,
                computed: false,
            }));
        }
        guard.insert(track_id.to_string());
    }

    let result = compute_inner(db, track_id).await;

    in_flight().lock().unwrap_or_else(|e| e.into_inner()).remove(track_id);
    result
}

async fn compute_inner(db: &SqlitePool, track_id: &str) -> Result<TrackGain, String> {
    let track = sqlx::query_as::<_, Track>(
        "SELECT * FROM tracks WHERE id = ?",
    )
    .bind(track_id)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("DB error: {}", e))?
    .ok_or_else(|| "Track not found".to_string())?;

    let path = track.file_path.clone();

    let (loudness, peak) = tokio::task::spawn_blocking(move || measure_loudness(&path))
        .await
        .map_err(|e| format!("measure task failed: {}", e))?
        .ok_or_else(|| "Failed to decode audio".to_string())?;

    let track_gain = (-loudness).clamp(-15.0, 15.0);
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE tracks SET track_gain = ?, track_peak = ?, track_loudness = ?, gain_computed_at = ? WHERE id = ?",
    )
    .bind(track_gain)
    .bind(peak)
    .bind(loudness)
    .bind(&now)
    .bind(track_id)
    .execute(db)
    .await
    .map_err(|e| format!("DB error: {}", e))?;

    maybe_compute_album_gain(db, &track.album, &track.artist).await;

    Ok(TrackGain {
        track_gain: Some(track_gain),
        track_peak: Some(peak),
        album_gain: None,
        album_peak: None,
        computed: true,
    })
}

/// Decode a file with symphonia and measure EBU R128 integrated loudness (LUFS)
/// and sample peak (0.0-1.0, max across channels).
fn measure_loudness(file_path: &str) -> Option<(f64, f64)> {
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

    let sample_rate = track.codec_params.sample_rate?;
    let channels = track
        .codec_params
        .channels
        .map(|c| c.count())
        .unwrap_or(2);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .ok()?;

    let mut ebur = EbuR128::new(channels as u32, sample_rate, Mode::I | Mode::SAMPLE_PEAK).ok()?;

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }
        if let Ok(audio_buf_ref) = decoder.decode(&packet) {
            let spec = *audio_buf_ref.spec();
            let frames = audio_buf_ref.frames();
            let mut sample_buf = SampleBuffer::<f32>::new(frames as u64, spec);
            sample_buf.copy_interleaved_ref(audio_buf_ref.clone());
            let _ = ebur.add_frames_f32(sample_buf.samples());
        }
    }

    let loudness = ebur.loudness_global().ok()?;
    let mut peak = 0.0f64;
    for ch in 0..channels as u32 {
        if let Ok(p) = ebur.sample_peak(ch) {
            peak = peak.max(p);
        }
    }

    Some((loudness, peak))
}

/// If every track in an album has measured loudness, compute the album gain
/// (ReplayGain 2.0 style: -10*log10(mean(10^(loudness/10)))) and store it on
/// every track of the album.
async fn maybe_compute_album_gain(db: &SqlitePool, album: &str, artist: &str) {
    let tracks = sqlx::query_as::<_, (String, Option<f64>, Option<f64>)>(
        "SELECT id, track_loudness, track_peak FROM tracks WHERE album = ? AND artist = ?",
    )
    .bind(album)
    .bind(artist)
    .fetch_all(db)
    .await;

    let Ok(tracks) = tracks else { return };
    if tracks.is_empty() {
        return;
    }

    // All tracks must be measured to compute the album loudness.
    if tracks.iter().any(|t| t.1.is_none()) {
        return;
    }

    let count = tracks.len() as f64;
    let mean_squared: f64 = tracks
        .iter()
        .map(|t| 10f64.powf(t.1.unwrap_or(-70.0) / 10.0))
        .sum::<f64>()
        / count;

    let album_gain = (-10.0 * mean_squared.log10()).clamp(-15.0, 15.0);
    let album_peak = tracks
        .iter()
        .filter_map(|t| t.2)
        .fold(0.0f64, f64::max);

    let _ = sqlx::query(
        "UPDATE tracks SET album_gain = ?, album_peak = ? WHERE album = ? AND artist = ?",
    )
    .bind(album_gain)
    .bind(album_peak)
    .bind(album)
    .bind(artist)
    .execute(db)
    .await
    .map_err(|e| warn!("Failed to update album gain: {}", e));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sine_wave_loudness_matches_expected_lufs() {
        // Calibration check: ebur128 applies K-weighting (BS.1770). For a 1 kHz
        // tone the K-weighting shelf gain is ~+3.02 dB, so:
        //   loudness ≈ 20*log10(amp/sqrt(2)) + 3.02
        // (amplitude 0.5 → -9.03 + 3.02 ≈ -6.01 LUFS)
        let sample_rate = 44100u32;
        let channels = 2u32;
        let seconds = 5;

        let measure = |amplitude: f64| -> f64 {
            let mut ebur = EbuR128::new(channels, sample_rate, Mode::I | Mode::SAMPLE_PEAK).expect("init ebur128");
            let frames = sample_rate * seconds;
            let mut interleaved = Vec::with_capacity((frames * channels) as usize);
            for i in 0..frames {
                let sample = amplitude * (2.0 * std::f64::consts::PI * 1000.0 * i as f64 / sample_rate as f64).sin();
                for _ in 0..channels {
                    interleaved.push(sample as f32);
                }
            }
            ebur.add_frames_f32(&interleaved).expect("add frames");
            ebur.loudness_global().expect("loudness_global")
        };

        let l05 = measure(0.5);
        let expected05 = -9.03 + 3.02;
        assert!(
            (l05 - expected05).abs() < 0.5,
            "loudness {l05} too far from expected {expected05} LUFS"
        );

        let l10 = measure(1.0);
        let expected10 = -3.01 + 3.02;
        assert!(
            (l10 - expected10).abs() < 0.5,
            "full-scale loudness {l10} too far from expected {expected10} LUFS"
        );

        // Loudness is amplitude-linear: doubling amplitude adds 6.02 dB.
        assert!(
            (l10 - l05 - 6.02).abs() < 0.2,
            "loudness not amplitude-linear: {l05} -> {l10}"
        );

        // Peak across channels must equal the sine amplitude.
        let mut ebur = EbuR128::new(channels, sample_rate, Mode::I | Mode::SAMPLE_PEAK).expect("init ebur128");
        let frames = sample_rate * seconds;
        let mut interleaved = Vec::with_capacity((frames * channels) as usize);
        for i in 0..frames {
            let sample = 0.5 * (2.0 * std::f64::consts::PI * 1000.0 * i as f64 / sample_rate as f64).sin();
            for _ in 0..channels {
                interleaved.push(sample as f32);
            }
        }
        ebur.add_frames_f32(&interleaved).expect("add frames");
        let peak = (0..channels)
            .map(|ch| ebur.sample_peak(ch).unwrap_or(0.0))
            .fold(0.0f64, f64::max);
        assert!((peak - 0.5).abs() < 0.01, "peak {peak} != 0.5");

        // Gain = -loudness, clamped to ±15 dB.
        let gain = (-l05).clamp(-15.0, 15.0);
        assert!((gain - 6.01).abs() < 0.5, "gain {gain} != ~6.01 dB");
    }
}
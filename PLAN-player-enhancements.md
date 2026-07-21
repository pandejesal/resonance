# Player Enhancements Plan

## Current State
- Audio: Single `HTMLAudioElement` created in `MiniPlayer.tsx`, shared via Zustand store
- Volume: Set directly on `audio.volume` property
- Crossfade: State exists (`crossfade`, `crossfadeDuration`) but NOT implemented
- Gapless: NOT implemented — `next()` sets `audio.src` causing a gap between tracks
- Equalizer: No implementation
- Visualization: Fake random bars, not based on actual audio data
- Backend streaming: `actix_files::NamedFile` with `Accept-Ranges: bytes` — range requests work

## Architecture

Migrate audio pipeline to **Web Audio API** while keeping `HTMLAudioElement` for streaming:

```
HTMLAudioElement
    ↓
MediaElementSourceNode
    ↓
BiquadFilterNode ×10 (EQ bands)
    ↓
GainNode (volume + crossfade)
    ↓
AnalyserNode (real visualization)
    ↓
AudioContext.destination
```

This approach:
- Preserves automatic range-request handling from `<audio>`
- Adds EQ, crossfade, and real visualization via Web Audio API
- Enables gapless playback via dual audio elements with crossfade routing

## Implementation Steps

### Step 1: Audio Engine Module
Create `frontend/src/lib/audio-engine.ts`:
- Singleton `AudioContext`
- `MediaElementSourceNode` connected to the existing `<audio>` element
- 10 `BiquadFilterNode`s (peaking filters at 31Hz–16kHz)
- `GainNode` for volume
- `AnalyserNode` for visualization data
- Methods: `setVolume()`, `setEQBand()`, `setEQPreset()`, `getAnalyserData()`
- EQ presets: Flat, Rock, Pop, Jazz, Classical, Bass Boost, Treble Boost, Vocal

### Step 2: PlayerStore Updates
Update `frontend/src/stores/index.ts`:
- Replace `audio.volume = volume` with `audioEngine.setVolume(volume)`
- Add `eqEnabled`, `eqBands`, `eqPreset` state
- Add `setEQBand()`, `setEQPreset()`, `toggleEQ()` actions
- Persist EQ settings via Zustand persist

### Step 3: Gapless Playback + Crossfade
Update `frontend/src/stores/index.ts`:
- Add second `<audio>` element for crossfade target
- Modify `next()` and `previous()`:
  - If crossfade enabled: ramp current gain down, ramp next gain up over `crossfadeDuration`
  - If gapless enabled: pre-load next track, swap audio elements at `ended` event
- Add `gapless` state (boolean, persisted)

### Step 4: Equalizer UI
Create `frontend/src/pages/EqualizerPage.tsx`:
- 10 vertical sliders (±12dB each band)
- Preset dropdown
- Enable/disable toggle
- Real-time frequency response curve display
- Glassmorphism card design matching existing UI

### Step 5: Crossfade UI
Add to `SettingsPage.tsx` or new section in NowPlaying:
- Crossfade toggle
- Duration slider (1–12 seconds)
- Gapless toggle (mutually exclusive with crossfade)

### Step 6: Real Audio Visualization
Update `frontend/src/components/NowPlaying.tsx`:
- Replace fake random bars with `AnalyserNode` frequency data
- Use `requestAnimationFrame` for smooth updates
- Keep the existing 40-bar layout but drive it with real audio data

### Step 7: Routes + Navigation
Update `frontend/src/App.tsx` and `frontend/src/components/Sidebar.tsx`:
- Add `/equalizer` route
- Add "Equalizer" nav item with sliders icon

### Step 8: Build + Test
- `docker compose up -d --build`
- Verify gapless playback between tracks
- Verify crossfade with configurable duration
- Verify EQ sliders affect audio output
- Verify real visualization responds to audio

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/lib/audio-engine.ts` | **Create** — AudioContext, EQ, gain, analyser |
| `frontend/src/stores/index.ts` | **Modify** — Add EQ state, gapless, crossfade logic |
| `frontend/src/pages/EqualizerPage.tsx` | **Create** — EQ UI with sliders + presets |
| `frontend/src/components/MiniPlayer.tsx` | **Modify** — Initialize audio engine on mount |
| `frontend/src/components/NowPlaying.tsx` | **Modify** — Real visualization from AnalyserNode |
| `frontend/src/pages/SettingsPage.tsx` | **Modify** — Add crossfade/gapless settings |
| `frontend/src/App.tsx` | **Modify** — Add `/equalizer` route |
| `frontend/src/components/Sidebar.tsx` | **Modify** — Add Equalizer nav item |
| `frontend/src/types/index.ts` | **Modify** — Add EQ types |
| `frontend/src/lib/api.ts` | No change needed |

## Verification
1. `docker compose up -d --build` — builds without errors
2. Play a track — audio plays, volume slider works
3. Enable EQ — sliders visibly affect audio frequency response
4. Enable crossfade — next track fades in while current fades out
5. Disable crossfade — gapless playback with no audible gap
6. NowPlaying — real frequency bars respond to audio, not random

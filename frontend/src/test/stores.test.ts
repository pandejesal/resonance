import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore, useUIStore } from '../stores';
import type { Track } from '../types';

// Helper to create a minimal valid track
const createMockTrack = (id: string, title: string): Track => ({
  id,
  title,
  artist: 'Test Artist',
  album: 'Test Album',
  duration_ms: 180000,
  file_path: `/music/${id}.mp3`,
  file_name: `${id}.mp3`,
  file_size: 1000000,
  format: 'mp3',
  play_count: 0,
  skip_count: 0,
  date_added: new Date().toISOString(),
  has_artwork: false,
  folder: '/music',
  library_id: 'lib1',
});

describe('Player Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePlayerStore.setState({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      volume: 0.8,
      progress: 0,
      duration: 0,
      shuffle: false,
      repeat: 'off',
      crossfade: false,
      crossfadeDuration: 3,
      gapless: true,
      eqEnabled: false,
      eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      eqPreset: 'flat',
    });
  });

  describe('Volume Control', () => {
    it('should set volume correctly', () => {
      const { setVolume } = usePlayerStore.getState();
      setVolume(0.5);
      expect(usePlayerStore.getState().volume).toBe(0.5);
    });

    it('should clamp volume between 0 and 1', () => {
      const { setVolume } = usePlayerStore.getState();
      setVolume(1.5);
      // Note: The store doesn't clamp, but the UI should
      expect(usePlayerStore.getState().volume).toBe(1);
    });
  });

  describe('Repeat Mode', () => {
    it('should cycle through repeat modes', () => {
      const { cycleRepeat } = usePlayerStore.getState();
      
      expect(usePlayerStore.getState().repeat).toBe('off');
      
      cycleRepeat();
      expect(usePlayerStore.getState().repeat).toBe('all');
      
      cycleRepeat();
      expect(usePlayerStore.getState().repeat).toBe('one');
      
      cycleRepeat();
      expect(usePlayerStore.getState().repeat).toBe('off');
    });
  });

  describe('Shuffle', () => {
    it('should not enable shuffle with empty queue', () => {
      const { toggleShuffle } = usePlayerStore.getState();
      
      expect(usePlayerStore.getState().shuffle).toBe(false);
      
      toggleShuffle();
      expect(usePlayerStore.getState().shuffle).toBe(false); // Can't shuffle with empty queue
    });

    it('should not enable shuffle with single item in queue', () => {
      const mockTrack = createMockTrack('1', 'Track');
      
      usePlayerStore.setState({
        queue: [{ track: mockTrack, addedAt: Date.now() }],
        queueIndex: 0,
      });
      
      const { toggleShuffle } = usePlayerStore.getState();
      toggleShuffle();
      
      expect(usePlayerStore.getState().shuffle).toBe(false); // Can't shuffle with single item
    });

    it('should enable shuffle with multiple items in queue', () => {
      const mockTrack1 = createMockTrack('1', 'Track 1');
      const mockTrack2 = createMockTrack('2', 'Track 2');
      
      usePlayerStore.setState({
        queue: [
          { track: mockTrack1, addedAt: Date.now() },
          { track: mockTrack2, addedAt: Date.now() },
        ],
        queueIndex: 0,
      });
      
      const { toggleShuffle } = usePlayerStore.getState();
      expect(usePlayerStore.getState().shuffle).toBe(false);
      
      toggleShuffle();
      expect(usePlayerStore.getState().shuffle).toBe(true);
      
      toggleShuffle();
      expect(usePlayerStore.getState().shuffle).toBe(false);
    });
  });

  describe('Queue Management', () => {
    it('should add track to queue', () => {
      const mockTrack = createMockTrack('1', 'Test Track');
      
      const { addToQueue } = usePlayerStore.getState();
      addToQueue(mockTrack);
      
      const { queue } = usePlayerStore.getState();
      expect(queue.length).toBe(1);
      expect(queue[0].track.id).toBe('1');
    });

    it('should remove track from queue', () => {
      const mockTrack1 = createMockTrack('1', 'Track 1');
      const mockTrack2 = createMockTrack('2', 'Track 2');
      
      usePlayerStore.setState({
        queue: [
          { track: mockTrack1, addedAt: Date.now() },
          { track: mockTrack2, addedAt: Date.now() },
        ],
        queueIndex: 0,
      });
      
      const { removeFromQueue } = usePlayerStore.getState();
      removeFromQueue(0);
      
      const { queue } = usePlayerStore.getState();
      expect(queue.length).toBe(1);
      expect(queue[0].track.id).toBe('2');
    });

    it('should clear queue', () => {
      const mockTrack = createMockTrack('1', 'Track');
      
      usePlayerStore.setState({
        queue: [{ track: mockTrack, addedAt: Date.now() }],
        queueIndex: 0,
        currentTrack: mockTrack,
      });
      
      const { clearQueue } = usePlayerStore.getState();
      clearQueue();
      
      const { queue, currentTrack, queueIndex } = usePlayerStore.getState();
      expect(queue.length).toBe(0);
      expect(currentTrack).toBeNull();
      expect(queueIndex).toBe(-1);
    });

    it('should move track in queue', () => {
      const mockTrack1 = createMockTrack('1', 'Track 1');
      const mockTrack2 = createMockTrack('2', 'Track 2');
      const mockTrack3 = createMockTrack('3', 'Track 3');
      
      usePlayerStore.setState({
        queue: [
          { track: mockTrack1, addedAt: Date.now() },
          { track: mockTrack2, addedAt: Date.now() },
          { track: mockTrack3, addedAt: Date.now() },
        ],
        queueIndex: 0,
      });
      
      const { moveInQueue } = usePlayerStore.getState();
      moveInQueue(2, 0);
      
      const { queue } = usePlayerStore.getState();
      expect(queue[0].track.id).toBe('3');
      expect(queue[2].track.id).toBe('2');
    });
  });

  describe('Crossfade Settings', () => {
    it('should toggle crossfade and affect gapless', () => {
      const { toggleCrossfade } = usePlayerStore.getState();
      
      expect(usePlayerStore.getState().crossfade).toBe(false);
      expect(usePlayerStore.getState().gapless).toBe(true);
      
      toggleCrossfade();
      expect(usePlayerStore.getState().crossfade).toBe(true);
      expect(usePlayerStore.getState().gapless).toBe(false);
    });

    it('should set crossfade duration within bounds', () => {
      const { setCrossfadeDuration } = usePlayerStore.getState();
      
      setCrossfadeDuration(5);
      expect(usePlayerStore.getState().crossfadeDuration).toBe(5);
      
      // Should clamp to 1-12 range
      setCrossfadeDuration(0);
      expect(usePlayerStore.getState().crossfadeDuration).toBe(1);
      
      setCrossfadeDuration(100);
      expect(usePlayerStore.getState().crossfadeDuration).toBe(12);
    });
  });

  describe('EQ Settings', () => {
    it('should toggle EQ', () => {
      const { toggleEQ } = usePlayerStore.getState();
      
      expect(usePlayerStore.getState().eqEnabled).toBe(false);
      
      toggleEQ();
      expect(usePlayerStore.getState().eqEnabled).toBe(true);
    });

    it('should set EQ band', () => {
      const { setEQBand } = usePlayerStore.getState();
      
      setEQBand(0, 5);
      
      const { eqBands, eqPreset } = usePlayerStore.getState();
      expect(eqBands[0]).toBe(5);
      expect(eqPreset).toBe('custom');
    });

    it('should set EQ preset', () => {
      const { setEQPreset } = usePlayerStore.getState();
      
      setEQPreset('rock');
      
      const { eqBands, eqPreset } = usePlayerStore.getState();
      expect(eqPreset).toBe('rock');
      // Rock preset has [5, 4, 3, 1.5, -0.5, -1, 1, 3, 4, 5]
      expect(eqBands[0]).toBe(5);
      expect(eqBands[5]).toBe(-1);
    });
  });
});

describe('UI Store', () => {
  beforeEach(() => {
    useUIStore.setState({
      theme: 'dark',
      viewMode: 'grid',
      sidebarOpen: true,
      searchOpen: false,
      nowPlayingOpen: false,
      queueOpen: false,
      lyricsOpen: false,
      settingsOpen: false,
    });
  });

  describe('Theme', () => {
    it('should set theme', () => {
      const { setTheme } = useUIStore.getState();
      
      setTheme('light');
      expect(useUIStore.getState().theme).toBe('light');
      
      setTheme('amoled');
      expect(useUIStore.getState().theme).toBe('amoled');
    });
  });

  describe('View Mode', () => {
    it('should toggle view mode', () => {
      const { setViewMode } = useUIStore.getState();
      
      expect(useUIStore.getState().viewMode).toBe('grid');
      
      setViewMode('list');
      expect(useUIStore.getState().viewMode).toBe('list');
    });
  });

  describe('Modals', () => {
    it('should toggle search', () => {
      const { toggleSearch } = useUIStore.getState();
      
      expect(useUIStore.getState().searchOpen).toBe(false);
      
      toggleSearch();
      expect(useUIStore.getState().searchOpen).toBe(true);
      
      toggleSearch();
      expect(useUIStore.getState().searchOpen).toBe(false);
    });

    it('should toggle now playing', () => {
      const { toggleNowPlaying } = useUIStore.getState();
      
      expect(useUIStore.getState().nowPlayingOpen).toBe(false);
      
      toggleNowPlaying();
      expect(useUIStore.getState().nowPlayingOpen).toBe(true);
      
      toggleNowPlaying();
      expect(useUIStore.getState().nowPlayingOpen).toBe(false);
    });

    it('should toggle queue', () => {
      const { toggleQueue } = useUIStore.getState();
      
      expect(useUIStore.getState().queueOpen).toBe(false);
      
      toggleQueue();
      expect(useUIStore.getState().queueOpen).toBe(true);
      
      toggleQueue();
      expect(useUIStore.getState().queueOpen).toBe(false);
    });

    it('should toggle lyrics and close queue', () => {
      const { toggleLyrics, toggleQueue } = useUIStore.getState();
      
      toggleQueue();
      expect(useUIStore.getState().queueOpen).toBe(true);
      
      toggleLyrics();
      expect(useUIStore.getState().lyricsOpen).toBe(true);
      expect(useUIStore.getState().queueOpen).toBe(false);
    });

    it('should toggle settings', () => {
      const { toggleSettings } = useUIStore.getState();
      
      expect(useUIStore.getState().settingsOpen).toBe(false);
      
      toggleSettings();
      expect(useUIStore.getState().settingsOpen).toBe(true);
    });
  });
});

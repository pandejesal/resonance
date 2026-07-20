import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track, RepeatMode, QueueItem, Theme, ViewMode } from '../types';
import { api } from '../lib/api';
import { shuffleArray } from '../lib/utils';

interface PlayerStore {
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
  audio: HTMLAudioElement | null;

  setAudio: (audio: HTMLAudioElement) => void;
  playTrack: (track: Track, queue?: Track[]) => void;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleCrossfade: () => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  addToQueue: (track: Track) => void;
  moveInQueue: (from: number, to: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>()((set, get) => ({
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
  audio: null,

  setAudio: (audio) => set({ audio }),

  playTrack: (track, queue) => {
    const { audio, shuffle } = get();
    if (!audio) return;

    const newQueue = queue
      ? queue.map((t) => ({ track: t, addedAt: Date.now() }))
      : [{ track, addedAt: Date.now() }];

    let startIndex = 0;
    if (queue) {
      startIndex = queue.findIndex((t) => t.id === track.id);
      if (startIndex === -1) startIndex = 0;
    }

    audio.src = `/api/tracks/${track.id}/stream`;
    audio.play().catch(() => {});
    api.tracks.play(track.id).catch(() => {});

    set({
      currentTrack: track,
      queue: newQueue,
      queueIndex: startIndex,
      isPlaying: true,
      progress: 0,
    });
  },

  playQueue: (tracks, startIndex = 0) => {
    const { audio, shuffle } = get();
    if (!audio || tracks.length === 0) return;

    let queue = tracks.map((t) => ({ track: t, addedAt: Date.now() }));
    let index = startIndex;

    if (shuffle) {
      const current = queue[index];
      const rest = queue.filter((_, i) => i !== index);
      const shuffled = shuffleArray(rest);
      queue = [current, ...shuffled];
      index = 0;
    }

    const track = queue[index].track;
    audio.src = `/api/tracks/${track.id}/stream`;
    audio.play().catch(() => {});
    api.tracks.play(track.id).catch(() => {});

    set({
      currentTrack: track,
      queue,
      queueIndex: index,
      isPlaying: true,
      progress: 0,
    });
  },

  togglePlay: () => {
    const { audio, isPlaying } = get();
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    set({ isPlaying: !isPlaying });
  },

  next: () => {
    const { queue, queueIndex, repeat, audio, shuffle } = get();
    if (!audio || queue.length === 0) return;

    let nextIndex = queueIndex + 1;

    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        audio.pause();
        set({ isPlaying: false });
        return;
      }
    }

    const nextTrack = queue[nextIndex].track;
    audio.src = `/api/tracks/${nextTrack.id}/stream`;
    audio.play().catch(() => {});
    api.tracks.play(nextTrack.id).catch(() => {});

    set({
      currentTrack: nextTrack,
      queueIndex: nextIndex,
      isPlaying: true,
      progress: 0,
    });
  },

  previous: () => {
    const { queue, queueIndex, audio, progress } = get();
    if (!audio || queue.length === 0) return;

    if (progress > 3000) {
      audio.currentTime = 0;
      set({ progress: 0 });
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) prevIndex = queue.length - 1;

    const prevTrack = queue[prevIndex].track;
    audio.src = `/api/tracks/${prevTrack.id}/stream`;
    audio.play().catch(() => {});
    api.tracks.play(prevTrack.id).catch(() => {});

    set({
      currentTrack: prevTrack,
      queueIndex: prevIndex,
      isPlaying: true,
      progress: 0,
    });
  },

  seek: (time) => {
    const { audio } = get();
    if (!audio) return;
    audio.currentTime = time / 1000;
    set({ progress: time });
  },

  setVolume: (volume) => {
    const { audio } = get();
    if (audio) audio.volume = volume;
    set({ volume });
  },

  toggleShuffle: () => {
    const { shuffle, queue, queueIndex } = get();
    const newShuffle = !shuffle;

    if (newShuffle && queue.length > 1) {
      const current = queue[queueIndex];
      const rest = queue.filter((_, i) => i !== queueIndex);
      const shuffled = shuffleArray(rest);
      set({
        shuffle: true,
        queue: [current, ...shuffled],
        queueIndex: 0,
      });
    } else {
      set({ shuffle: false });
    }
  },

  cycleRepeat: () => {
    const { repeat } = get();
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const nextIndex = (modes.indexOf(repeat) + 1) % modes.length;
    set({ repeat: modes[nextIndex] });
  },

  toggleCrossfade: () => {
    set((s) => ({ crossfade: !s.crossfade }));
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    let newIndex = queueIndex;
    if (index < queueIndex) newIndex--;
    if (index === queueIndex) newIndex = Math.min(newIndex, newQueue.length - 1);
    set({ queue: newQueue, queueIndex: Math.max(0, newIndex) });
  },

  clearQueue: () => {
    const { audio } = get();
    if (audio) audio.pause();
    set({
      queue: [],
      queueIndex: -1,
      currentTrack: null,
      isPlaying: false,
      progress: 0,
    });
  },

  addToQueue: (track) => {
    const { queue } = get();
    set({ queue: [...queue, { track, addedAt: Date.now() }] });
  },

  moveInQueue: (from, to) => {
    const { queue, queueIndex } = get();
    const newQueue = [...queue];
    const [item] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, item);

    let newQueueIndex = queueIndex;
    if (from === queueIndex) {
      newQueueIndex = to;
    } else if (from < queueIndex && to >= queueIndex) {
      newQueueIndex--;
    } else if (from > queueIndex && to <= queueIndex) {
      newQueueIndex++;
    }

    set({ queue: newQueue, queueIndex: newQueueIndex });
  },

  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
}));

interface UIStore {
  theme: Theme;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  searchOpen: boolean;
  nowPlayingOpen: boolean;
  queueOpen: boolean;
  lyricsOpen: boolean;
  settingsOpen: boolean;

  setTheme: (theme: Theme) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  toggleSearch: () => void;
  toggleNowPlaying: () => void;
  toggleQueue: () => void;
  toggleLyrics: () => void;
  toggleSettings: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      viewMode: 'grid',
      sidebarOpen: true,
      searchOpen: false,
      nowPlayingOpen: false,
      queueOpen: false,
      lyricsOpen: false,
      settingsOpen: false,

      setTheme: (theme) => {
        document.documentElement.className = theme === 'dark' ? '' : theme;
        set({ theme });
      },
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen, lyricsOpen: false })),
      toggleNowPlaying: () => set((s) => ({ nowPlayingOpen: !s.nowPlayingOpen, queueOpen: false, lyricsOpen: false })),
      toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen, lyricsOpen: false })),
      toggleLyrics: () => set((s) => ({ lyricsOpen: !s.lyricsOpen, queueOpen: false })),
      toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
    }),
    {
      name: 'resonance-ui',
      partialize: (state) => ({
        theme: state.theme,
        viewMode: state.viewMode,
      }),
    }
  )
);

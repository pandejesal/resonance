import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track, RepeatMode, QueueItem, Theme, ViewMode, UserInfo, CastTarget } from '../types';
import { api } from '../lib/api';
import { shuffleArray } from '../lib/utils';
import { audioEngine, EQ_PRESETS } from '../lib/audio-engine';

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
  gapless: boolean;
  audio: HTMLAudioElement | null;
  crossfadeAudio: HTMLAudioElement | null;
  isCrossfading: boolean;
  eqEnabled: boolean;
  eqBands: number[];
  eqPreset: string;

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
  setCrossfadeDuration: (duration: number) => void;
  toggleGapless: () => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  addToQueue: (track: Track) => void;
  moveInQueue: (from: number, to: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  toggleEQ: () => void;
  setEQBand: (index: number, gain: number) => void;
  setEQPreset: (preset: string) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
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
      audio: null,
      crossfadeAudio: null,
      isCrossfading: false,
      eqEnabled: false,
      eqBands: EQ_PRESETS.flat,
      eqPreset: 'flat',

      setAudio: (audio) => {
        audioEngine.init(audio);
        audioEngine.setVolume(get().volume);
        set({ audio });
      },

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
        audioEngine.resume().then(() => {
          audio.play().catch((e) => console.warn('Play failed:', e));
        });
        api.tracks.play(track.id).catch(() => {});

        // Update MediaSession metadata
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: [
              { src: `/api/tracks/${track.id}/artwork`, sizes: '512x512', type: 'image/jpeg' },
            ],
          });
        }

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
        audioEngine.resume().then(() => {
          audio.play().catch((e) => console.warn('Play failed:', e));
        });
        api.tracks.play(track.id).catch(() => {});

        // Update MediaSession metadata
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: [
              { src: `/api/tracks/${track.id}/artwork`, sizes: '512x512', type: 'image/jpeg' },
            ],
          });
        }

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
          audioEngine.resume().then(() => {
            audio.play().catch((e) => console.warn('Play failed:', e));
          });
        }
        const newPlaying = !isPlaying;
        set({ isPlaying: newPlaying });

        // Update MediaSession playback state
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = newPlaying ? 'playing' : 'paused';
        }
      },

      next: () => {
        const { queue, queueIndex, repeat, audio, shuffle, crossfade, crossfadeDuration, gapless } = get();
        if (!audio || queue.length === 0) return;

        let nextIndex;
        if (shuffle) {
          const availableIndices = queue
            .map((_, i) => i)
            .filter(i => i !== queueIndex);
          if (availableIndices.length === 0) {
            audio.pause();
            set({ isPlaying: false });
            return;
          }
          nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        } else {
          nextIndex = queueIndex + 1;
          if (nextIndex >= queue.length) {
            if (repeat === 'all') {
              nextIndex = 0;
            } else {
              audio.pause();
              set({ isPlaying: false });
              return;
            }
          }
        }

        const nextTrack = queue[nextIndex].track;

        if (crossfade && audioEngine.isReady && audio.duration > 0) {
          const ctx = (audioEngine as any).ctx as AudioContext;
          const gainNode = (audioEngine as any).gainNode as GainNode;
          if (!ctx || !gainNode) return;

          set({ isCrossfading: true });

          const crossfadeAudio = new Audio();
          crossfadeAudio.crossOrigin = 'anonymous';
          crossfadeAudio.src = `/api/tracks/${nextTrack.id}/stream`;
          crossfadeAudio.volume = 1;

          const crossfadeSource = ctx.createMediaElementSource(crossfadeAudio);
          const crossfadeGain = ctx.createGain();
          crossfadeGain.gain.value = 0;
          crossfadeSource.connect(crossfadeGain);
          crossfadeGain.connect(ctx.destination);

          crossfadeAudio.addEventListener('canplaythrough', () => {
            crossfadeAudio.play().catch(() => {});
          }, { once: true });
          crossfadeAudio.load();
          api.tracks.play(nextTrack.id).catch(() => {});

          const now = ctx.currentTime;
          gainNode.gain.setValueAtTime(get().volume, now);
          gainNode.gain.linearRampToValueAtTime(0, now + crossfadeDuration);
          crossfadeGain.gain.setValueAtTime(0, now);
          crossfadeGain.gain.linearRampToValueAtTime(get().volume, now + crossfadeDuration);

          const cleanup = () => {
            crossfadeAudio.pause();
            crossfadeSource.disconnect();
            crossfadeGain.disconnect();
            audio.removeEventListener('ended', cleanup);
            set({ crossfadeAudio: null, isCrossfading: false });
          };

          crossfadeAudio.addEventListener('ended', cleanup);
          audio.addEventListener('ended', cleanup, { once: true });

          setTimeout(() => {
            audio.pause();
            audio.src = '';
            audioEngine.destroy();
            audioEngine.init(crossfadeAudio);
            audioEngine.setVolume(get().volume);
            if (get().eqEnabled) {
              get().eqBands.forEach((gain, i) => audioEngine.setEQBand(i, gain));
            }
            gainNode.gain.setValueAtTime(get().volume, ctx.currentTime);

            set({
              audio: crossfadeAudio,
              currentTrack: nextTrack,
              queueIndex: nextIndex,
              isPlaying: true,
              progress: 0,
              duration: (crossfadeAudio.duration || 0) * 1000,
            });

            // Update MediaSession metadata for next track
            if ('mediaSession' in navigator) {
              navigator.mediaSession.metadata = new MediaMetadata({
                title: nextTrack.title,
                artist: nextTrack.artist,
                album: nextTrack.album,
                artwork: [
                  { src: `/api/tracks/${nextTrack.id}/artwork`, sizes: '512x512', type: 'image/jpeg' },
                ],
              });
            }
          }, crossfadeDuration * 1000);
        } else {
          audio.src = `/api/tracks/${nextTrack.id}/stream`;
          audio.play().catch(() => {});
          api.tracks.play(nextTrack.id).catch(() => {});

          // Update MediaSession metadata for next track
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: nextTrack.title,
              artist: nextTrack.artist,
              album: nextTrack.album,
              artwork: [
                { src: `/api/tracks/${nextTrack.id}/artwork`, sizes: '512x512', type: 'image/jpeg' },
              ],
            });
          }

          set({
            currentTrack: nextTrack,
            queueIndex: nextIndex,
            isPlaying: true,
            progress: 0,
          });
        }
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

        // Update MediaSession metadata for previous track
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: prevTrack.title,
            artist: prevTrack.artist,
            album: prevTrack.album,
            artwork: [
              { src: `/api/tracks/${prevTrack.id}/artwork`, sizes: '512x512', type: 'image/jpeg' },
            ],
          });
        }

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

        // Update MediaSession position state
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setPositionState({
            duration: audio.duration || 0,
            playbackRate: audio.playbackRate,
            position: audio.currentTime || 0,
          });
        }
      },

      setVolume: (volume) => {
        const { audio } = get();
        if (audio) audio.volume = volume;
        audioEngine.setVolume(volume);
        set({ volume });
      },

      toggleShuffle: () => {
        const { shuffle, queue, queueIndex } = get();

        if (!shuffle && queue.length > 1) {
          // Turning shuffle ON with a queue > 1
          const current = queue[queueIndex];
          const rest = queue.filter((_, i) => i !== queueIndex);
          const shuffled = shuffleArray(rest);
          set({
            shuffle: true,
            queue: [current, ...shuffled],
            queueIndex: 0,
          });
        } else {
          // Turning shuffle OFF (or can't shuffle with < 2 items)
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
        set((s) => ({ crossfade: !s.crossfade, gapless: s.crossfade ? s.gapless : false }));
      },

      setCrossfadeDuration: (duration) => {
        set({ crossfadeDuration: Math.max(1, Math.min(12, duration)) });
      },

      toggleGapless: () => {
        set((s) => ({ gapless: !s.gapless, crossfade: s.gapless ? s.crossfade : false }));
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

      toggleEQ: () => {
        const enabled = !get().eqEnabled;
        audioEngine.setEQEnabled(enabled);
        if (enabled) {
          get().eqBands.forEach((gain, i) => audioEngine.setEQBand(i, gain));
        }
        set({ eqEnabled: enabled });
      },

      setEQBand: (index, gain) => {
        const bands = [...get().eqBands];
        bands[index] = gain;
        audioEngine.setEQBand(index, gain);
        set({ eqBands: bands, eqPreset: 'custom' });
      },

      setEQPreset: (preset) => {
        const gains = EQ_PRESETS[preset];
        if (!gains) return;
        audioEngine.setEQPreset(preset);
        set({ eqBands: [...gains], eqPreset: preset });
      },
    }),
    {
      name: 'resonance-player',
      partialize: (state) => ({
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
        crossfade: state.crossfade,
        crossfadeDuration: state.crossfadeDuration,
        gapless: state.gapless,
        eqEnabled: state.eqEnabled,
        eqBands: state.eqBands,
        eqPreset: state.eqPreset,
      }),
    }
  )
);

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

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isGuest: false,

      login: async (username: string, password: string) => {
        const response = await api.auth.login(username, password);
        set({ user: response.user, isAuthenticated: true, isGuest: false });
      },

      register: async (username: string, password: string) => {
        const response = await api.auth.register(username, password);
        set({ user: response.user, isAuthenticated: true, isGuest: false });
      },

      loginAsGuest: async () => {
        const response = await api.auth.guest();
        set({ user: response.user, isAuthenticated: true, isGuest: true });
      },

      logout: async () => {
        try {
          await api.auth.logout();
        } catch {
          // Ignore logout errors
        }
        set({ user: null, isAuthenticated: false, isGuest: false });
      },

      checkAuth: async () => {
        try {
          const user = await api.auth.me();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false, isGuest: false });
        }
      },
    }),
    {
      name: 'resonance-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
      }),
    }
  )
);

interface CastState {
  targets: CastTarget[];
  activeTarget: CastTarget | null;
  isCasting: boolean;
  castMenuOpen: boolean;
  fetchTargets: () => Promise<void>;
  registerTarget: (target: Omit<CastTarget, 'id' | 'is_connected' | 'current_track_id'>) => Promise<void>;
  unregisterTarget: (id: string) => Promise<void>;
  castPlay: (targetId: string, trackId: string) => Promise<void>;
  castControl: (targetId: string, action: string, value?: number) => Promise<void>;
  stopCasting: () => void;
  setCastMenuOpen: (open: boolean) => void;
}

export const useCastStore = create<CastState>()(
  (set, get) => ({
    targets: [],
    activeTarget: null,
    isCasting: false,
    castMenuOpen: false,

    fetchTargets: async () => {
      try {
        const targets = await api.cast.listTargets();
        set({ targets });
      } catch (e) {
        console.error('Failed to fetch cast targets:', e);
      }
    },

    registerTarget: async (targetData) => {
      try {
        const target = await api.cast.registerTarget(targetData);
        set((state) => ({
          targets: [...state.targets, target],
        }));
      } catch (e) {
        console.error('Failed to register cast target:', e);
        throw e;
      }
    },

    unregisterTarget: async (id) => {
      try {
        await api.cast.unregisterTarget(id);
        set((state) => ({
          targets: state.targets.filter((t) => t.id !== id),
          activeTarget: state.activeTarget?.id === id ? null : state.activeTarget,
          isCasting: state.activeTarget?.id === id ? false : state.isCasting,
        }));
      } catch (e) {
        console.error('Failed to unregister cast target:', e);
      }
    },

    castPlay: async (targetId, trackId) => {
      try {
        const result = await api.cast.play(targetId, trackId);
        const target = result.target;
        set({
          activeTarget: target,
          isCasting: true,
          castMenuOpen: false,
        });
        // Update the targets list with updated target state
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === target.id ? target : t
          ),
        }));
      } catch (e) {
        console.error('Failed to cast play:', e);
      }
    },

    castControl: async (targetId, action, value) => {
      try {
        const result = await api.cast.control(targetId, action, value);
        if (action === 'stop') {
          set({
            activeTarget: null,
            isCasting: false,
          });
        } else if (result.target) {
          set({ activeTarget: result.target });
          set((state) => ({
            targets: state.targets.map((t) =>
              t.id === result.target.id ? result.target : t
            ),
          }));
        }
      } catch (e) {
        console.error('Failed to cast control:', e);
      }
    },

    stopCasting: () => {
      const { activeTarget } = get();
      if (activeTarget) {
        get().castControl(activeTarget.id, 'stop');
      }
      set({
        activeTarget: null,
        isCasting: false,
      });
    },

    setCastMenuOpen: (open) => set({ castMenuOpen: open }),
  })
);

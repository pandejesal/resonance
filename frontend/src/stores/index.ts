import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track, RepeatMode, QueueItem, Theme, ViewMode, UserInfo, CastTarget, LicenseStatus } from '../types';
import { api } from '../lib/api';
import { shuffleArray } from '../lib/utils';
import { audioEngine, EQ_PRESETS } from '../lib/audio-engine';
import { toast } from '../components/Toast';

function getStreamUrl(trackId: string): string {
  return `/api/tracks/${trackId}/stream`;
}

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
  crossfadeTimeoutId: ReturnType<typeof setTimeout> | null;
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
      crossfadeTimeoutId: null,
      eqEnabled: false,
      eqBands: EQ_PRESETS.flat,
      eqPreset: 'flat',

      setAudio: (audio) => {
        audioEngine.setVolume(get().volume);
        set({ audio });
      },

      playTrack: (track, queue) => {
        const state = get();
        let audio = state.audio;
        const shuffle = state.shuffle;

        if (!audio) {
          audio = new Audio();
          audio.preload = 'auto';
          state.setAudio(audio);
        }

        let newQueue = queue
          ? queue.map((t) => ({ track: t, addedAt: Date.now() }))
          : [{ track, addedAt: Date.now() }];

        let startIndex = 0;
        if (queue) {
          startIndex = queue.findIndex((t) => t.id === track.id);
          if (startIndex === -1) startIndex = 0;

          if (shuffle && newQueue.length > 1) {
            const current = newQueue[startIndex];
            const rest = newQueue.filter((_, i) => i !== startIndex);
            const shuffled = shuffleArray(rest);
            newQueue = [current, ...shuffled];
            startIndex = 0;
          }
        }

        set({
          currentTrack: track,
          queue: newQueue,
          queueIndex: startIndex,
          progress: 0,
        });

        audio.src = getStreamUrl(track.id);
        if (!audioEngine.isReady) {
          audioEngine.init(audio);
        }
        audioEngine.resume();
        audio.play().then(() => {
          set({ isPlaying: true });
        }).catch((e) => console.warn('Play failed:', e));

        api.tracks.play(track.id).catch(() => {});

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
      },

      playQueue: (tracks, startIndex = 0) => {
        const state = get();
        let audio = state.audio;
        const shuffle = state.shuffle;

        if (!audio || tracks.length === 0) {
          if (!audio && tracks.length > 0) {
            audio = new Audio();
            audio.preload = 'auto';
            state.setAudio(audio);
          } else {
            return;
          }
        }

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

        set({
          currentTrack: track,
          queue,
          queueIndex: index,
          progress: 0,
        });

        audio.src = getStreamUrl(track.id);
        if (!audioEngine.isReady) {
          audioEngine.init(audio);
        }
        audioEngine.resume();
        audio.play().then(() => {
          set({ isPlaying: true });
        }).catch((e) => console.warn('Play failed:', e));

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
      },

      togglePlay: () => {
        const { audio, isPlaying } = get();
        if (!audio) return;

        if (isPlaying) {
          audio.pause();
          set({ isPlaying: false });
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
        } else {
          audioEngine.resume();
          audio.play().then(() => {
            set({ isPlaying: true });
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
          }).catch((e) => {
            console.warn('Play failed:', e);
            set({ isPlaying: false });
          });
        }
      },

      next: () => {
        const state = get();
        if (state.crossfadeTimeoutId) {
          clearTimeout(state.crossfadeTimeoutId);
        }
        const { queue, queueIndex, repeat, audio, shuffle, crossfade, crossfadeDuration, gapless, isCrossfading } = state;
        if (!audio || queue.length === 0 || isCrossfading) return;

        if (repeat === 'one' && queueIndex >= 0 && queueIndex < queue.length) {
          audio.currentTime = 0;
          audioEngine.resume();
          audio.play().catch((e) => console.warn('Play failed:', e));
          api.tracks.play(queue[queueIndex].track.id).catch(() => {});
          set({ isPlaying: true, progress: 0 });
          return;
        }

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

        set({
          currentTrack: nextTrack,
          queueIndex: nextIndex,
          isPlaying: true,
          progress: 0,
        });

        if (crossfade && audioEngine.isReady && audio.duration > 0) {
          const ctx = audioEngine.context;
          const gainNode = audioEngine.masterGain;
          if (!ctx || !gainNode) {
            audio.src = getStreamUrl(nextTrack.id);
            audioEngine.resume();
            audio.play().catch((e) => console.warn('Play failed:', e));
            return;
          }

          set({ isCrossfading: true });

          const crossfadeAudio = new Audio();
          crossfadeAudio.preload = 'metadata';
          crossfadeAudio.src = getStreamUrl(nextTrack.id);
          crossfadeAudio.volume = 1;

          const crossfadeGain = ctx.createGain();
          crossfadeGain.gain.value = 0;

          // Route crossfade audio through Web Audio API
          let crossfadeSource: MediaElementAudioSourceNode | null = null;
          try {
            crossfadeSource = ctx.createMediaElementSource(crossfadeAudio);
            crossfadeSource.connect(crossfadeGain);
          } catch {
            // If source creation fails, fall back to direct connection
          }
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

          let cleaned = false;
          const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            crossfadeAudio.pause();
            if (crossfadeSource) {
              try { crossfadeSource.disconnect(); } catch {}
            }
            crossfadeGain.disconnect();
            audio.removeEventListener('ended', cleanup);
            crossfadeAudio.removeEventListener('ended', cleanup);
            set({ crossfadeAudio: null, isCrossfading: false });
          };

          crossfadeAudio.addEventListener('ended', cleanup, { once: true });
          audio.addEventListener('ended', cleanup, { once: true });

          const timeoutId = setTimeout(() => {
            audio.pause();
            audio.src = '';
            audioEngine.destroy();
            audioEngine.init(crossfadeAudio);
            audioEngine.setVolume(get().volume);
            if (get().eqEnabled) {
              get().eqBands.forEach((gain, i) => audioEngine.setEQBand(i, gain));
            }

            set({
              audio: crossfadeAudio,
              currentTrack: nextTrack,
              queueIndex: nextIndex,
              isPlaying: true,
              progress: 0,
              duration: (crossfadeAudio.duration || 0) * 1000,
              crossfadeTimeoutId: null,
            });

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
          set({ crossfadeTimeoutId: timeoutId });
        } else {
          audio.src = getStreamUrl(nextTrack.id);
          audioEngine.resume();
          audio.play().then(() => {
            set({ isPlaying: true });
          }).catch((e) => console.warn('Play failed:', e));
          api.tracks.play(nextTrack.id).catch(() => {});

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
        }
      },

      previous: () => {
        const state = get();
        const { queue, queueIndex, audio, progress } = state;
        if (!audio || queue.length === 0) return;

        if (progress > 3000) {
          audio.currentTime = 0;
          set({ progress: 0 });
          return;
        }

        let prevIndex = queueIndex - 1;
        if (prevIndex < 0) prevIndex = queue.length - 1;

        const prevTrack = queue[prevIndex].track;

        set({
          currentTrack: prevTrack,
          queueIndex: prevIndex,
          progress: 0,
        });

        audio.src = getStreamUrl(prevTrack.id);
        audioEngine.resume();
        audio.play().then(() => {
          set({ isPlaying: true });
        }).catch((e) => console.warn('Play failed:', e));

        api.tracks.play(prevTrack.id).catch(() => {});

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
        const clamped = Math.max(0, Math.min(1, volume));
        const { audio } = get();
        if (audio) audio.volume = clamped;
        audioEngine.setVolume(clamped);
        set({ volume: clamped });
      },

      toggleShuffle: () => {
        const { shuffle, queue, queueIndex } = get();

        if (!shuffle && queue.length > 1 && queueIndex >= 0) {
          // Turning shuffle ON with a queue > 1 and a valid current track
          const current = queue[queueIndex];
          const rest = queue.filter((_, i) => i !== queueIndex);
          const shuffled = shuffleArray(rest);
          set({
            shuffle: true,
            queue: [current, ...shuffled],
            queueIndex: 0,
          });
        } else {
          // Turning shuffle OFF (or can't shuffle with < 2 items or no current track)
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
        const { queue, queueIndex, audio } = get();
        const newQueue = queue.filter((_, i) => i !== index);
        let newIndex = queueIndex;

        if (index < queueIndex) {
          newIndex--;
        } else if (index === queueIndex) {
          // Removing the currently playing track
          if (newQueue.length === 0) {
            // Queue is now empty
            if (audio) audio.pause();
            set({ queue: [], queueIndex: -1, currentTrack: null, isPlaying: false });
            return;
          }
          newIndex = Math.min(newIndex, newQueue.length - 1);
          // Update current track to the new track at newIndex
          const newTrack = newQueue[newIndex].track;
          if (audio) {
             audio.src = getStreamUrl(newTrack.id);
          }
          set({ queue: newQueue, queueIndex: newIndex, currentTrack: newTrack });
          return;
        }

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
        if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
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
        queue: state.queue,
        queueIndex: state.queueIndex,
        repeat: state.repeat,
        shuffle: state.shuffle,
        volume: state.volume,
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
  authToken: string | null;
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
      authToken: null,

      login: async (username: string, password: string) => {
        const response = await api.auth.login(username, password);
        set({ user: response.user, isAuthenticated: true, isGuest: false, authToken: response.token });
      },

      register: async (username: string, password: string) => {
        const response = await api.auth.register(username, password);
        set({ user: response.user, isAuthenticated: true, isGuest: false, authToken: response.token });
      },

      loginAsGuest: async () => {
        const response = await api.auth.guest();
        set({ user: response.user, isAuthenticated: true, isGuest: true, authToken: response.token });
      },

      logout: async () => {
        try {
          await api.auth.logout();
        } catch {
          // Ignore logout errors
        }
        localStorage.removeItem('resonance-auth');
        set({ user: null, isAuthenticated: false, isGuest: false, authToken: null });
      },

      checkAuth: async () => {
        try {
          const user = await api.auth.me();
          const existingToken = useAuthStore.getState().authToken;
          if (existingToken) {
            set({ user, isAuthenticated: true, isLoading: false, authToken: existingToken });
          } else {
            try {
              const guestResponse = await api.auth.guest();
              set({ user: guestResponse.user, isAuthenticated: true, isLoading: false, isGuest: true, authToken: guestResponse.token });
            } catch {
              set({ user, isAuthenticated: true, isLoading: false });
            }
          }
        } catch {
          try {
            const guestResponse = await api.auth.guest();
            set({ user: guestResponse.user, isAuthenticated: true, isLoading: false, isGuest: true, authToken: guestResponse.token });
          } catch {
            set({ user: null, isAuthenticated: false, isLoading: false, isGuest: false, authToken: null });
          }
        }
      },
    }),
    {
      name: 'resonance-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
        authToken: state.authToken,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'resonance-auth' && e.newValue === null) {
      useAuthStore.getState().logout();
    }
  });
}

interface LicenseState {
  status: LicenseStatus | null;
  loading: boolean;
  fetchStatus: () => Promise<void>;
  hasFeature: (feature: string) => boolean;
  isPro: () => boolean;
  isEnterprise: () => boolean;
  isTrialing: () => boolean;
}

export const useLicenseStore = create<LicenseState>()(
  (set, get) => ({
    status: null,
    loading: false,

    fetchStatus: async () => {
      set({ loading: true });
      try {
        const status = await api.license.getStatus();
        set({ status, loading: false });
      } catch {
        // On error, default to free tier so features aren't blocked
        set({
          status: {
            tier: 'free',
            active: true,
            features: [],
            trial_remaining_days: null,
            expires_at: null,
            max_devices: 1,
            device_count: 1,
          },
          loading: false,
        });
      }
    },

    hasFeature: (feature: string) => {
      const { status, loading } = get();
      if (loading || !status) return true; // Don't block during loading
      return status.features.includes(feature);
    },

    isPro: () => get().status?.tier === 'pro',
    isEnterprise: () => get().status?.tier === 'enterprise',
    isTrialing: () => (get().status?.trial_remaining_days ?? 0) > 0,
  })
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
        toast.error('Failed to fetch cast targets');
      }
    },

    registerTarget: async (targetData) => {
      try {
        const target = await api.cast.registerTarget(targetData);
        set((state) => ({
          targets: [...state.targets, target],
        }));
      } catch (e) {
        toast.error('Failed to register cast target');
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
        toast.error('Failed to unregister cast target');
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
        toast.error('Failed to cast play');
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
        toast.error('Failed to cast control');
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

import { useEffect } from 'react';
import { usePlayerStore } from '../stores';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const store = usePlayerStore.getState();

      switch (e.key) {
        case ' ':
          e.preventDefault();
          store.togglePlay();
          break;
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            store.next();
          } else if (e.shiftKey) {
            e.preventDefault();
            const audio = document.querySelector('audio');
            if (audio) audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || 0);
          }
          break;
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            store.previous();
          } else if (e.shiftKey) {
            e.preventDefault();
            const audio = document.querySelector('audio');
            if (audio) audio.currentTime = Math.max(audio.currentTime - 10, 0);
          }
          break;
        case 'ArrowUp':
          if (e.shiftKey) {
            e.preventDefault();
            store.setVolume(Math.min(store.volume + 0.05, 1));
          }
          break;
        case 'ArrowDown':
          if (e.shiftKey) {
            e.preventDefault();
            store.setVolume(Math.max(store.volume - 0.05, 0));
          }
          break;
        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            store.toggleShuffle();
          }
          break;
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            store.cycleRepeat();
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

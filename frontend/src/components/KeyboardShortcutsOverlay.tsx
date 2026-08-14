import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const shortcuts = [
  { keys: ['Space'], action: 'Play / Pause' },
  { keys: ['←'], action: 'Previous track' },
  { keys: ['→'], action: 'Next track' },
  { keys: ['Shift', '←'], action: 'Seek backward 10s' },
  { keys: ['Shift', '→'], action: 'Seek forward 10s' },
  { keys: ['↑'], action: 'Volume up' },
  { keys: ['↓'], action: 'Volume down' },
  { keys: ['M'], action: 'Mute / Unmute' },
  { keys: ['S'], action: 'Toggle shuffle' },
  { keys: ['R'], action: 'Toggle repeat' },
  { keys: ['L'], action: 'Toggle lyrics' },
  { keys: ['Q'], action: 'Toggle queue' },
  { keys: ['F'], action: 'Toggle fullscreen player' },
  { keys: ['?'], action: 'Show this help' },
  { keys: ['Esc'], action: 'Close modal / overlay' },
  { keys: ['/', 'Ctrl', 'K'], action: 'Open search' },
];

export default function KeyboardShortcutsOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-1/95 backdrop-blur-xl rounded-2xl border border-white/10 p-6 max-w-md w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-primary">Keyboard Shortcuts</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-secondary transition-colors"
                  aria-label="Close keyboard shortcuts"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            <div className="space-y-2">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-sm text-secondary">{s.action}</span>
                  <div className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className="px-2 py-0.5 bg-surface-2 rounded text-xs font-mono text-primary border border-white/10">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-tertiary mt-4 text-center">Press ? to toggle</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

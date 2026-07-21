import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

interface FileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export default function FileBrowser({ isOpen, onClose, onSelect }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<{ name: string; path: string; is_dir: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadDirectory(currentPath);
  }, [isOpen, currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.browse(path);
      setCurrentPath(data.current);
      setEntries(data.entries);
    } catch (e) {
      setError('Failed to load directory');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClickEntry = (entry: { name: string; path: string; is_dir: boolean }) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
    }
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="glass-panel w-full max-w-lg mx-4 p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-primary">Select Music Folder</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-secondary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current path */}
          <div className="px-4 py-2 bg-surface-1 border-b border-white/5">
            <p className="text-xs text-tertiary mb-1">Current location</p>
            <p className="text-sm font-mono text-primary truncate">{currentPath}</p>
          </div>

          {/* Directory listing */}
          <div className="h-80 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-secondary">No folders found</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {entries.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => handleClickEntry(entry)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-colors group"
                  >
                    {entry.name === '..' ? (
                      <svg className="w-5 h-5 text-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    )}
                    <span className="text-sm text-primary truncate group-hover:text-brand-400 transition-colors">
                      {entry.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-white/5">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSelect} className="btn-primary">
              Select This Folder
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

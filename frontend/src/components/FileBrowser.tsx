import React, { useState, useEffect, useRef } from 'react';
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
  const [mode, setMode] = useState<'browser' | 'manual'>('browser');
  const [manualPath, setManualPath] = useState('/');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleManualSelect = () => {
    if (manualPath.trim()) {
      onSelect(manualPath.trim());
      onClose();
    }
  };

  const handleNativePicker = () => {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.openFolderPicker === 'function') {
      window.__onFolderSelected = (path: string) => {
        setManualPath(path);
        onSelect(path);
        onClose();
      };
      bridge.openFolderPicker();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const firstFile = files[0];
    const relativePath = firstFile.webkitRelativePath;
    if (!relativePath) return;

    const folderName = relativePath.split('/')[0];

    try {
      const data = await api.browse('/');
      const match = data.entries.find(
        (entry: { name: string; path: string; is_dir: boolean }) =>
          entry.is_dir && entry.name === folderName
      );
      if (match) {
        setCurrentPath(match.path);
        setManualPath(match.path);
      } else {
        setManualPath('/' + folderName);
      }
    } catch {
      setManualPath('/' + folderName);
    }

    setMode('manual');
    e.target.value = '';
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
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFilesSelected}
          />

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-primary">Select Music Folder</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-secondary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setMode('browser')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === 'browser'
                  ? 'text-brand-400 border-b-2 border-brand-400'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Browse Server
              </span>
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === 'manual'
                  ? 'text-brand-400 border-b-2 border-brand-400'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Type Path
              </span>
            </button>
          </div>

          {mode === 'browser' ? (
            <>
              {/* Native picker button */}
              <div className="px-4 pt-3">
                <button
                  onClick={handleNativePicker}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-brand-500/30 bg-brand-500/5 text-brand-400 hover:bg-brand-500/10 hover:border-brand-500/50 transition-all text-sm font-medium"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Open System File Explorer
                </button>
                <p className="text-xs text-tertiary text-center mt-2 mb-1">
                  Opens your OS native file picker to select a folder
                </p>
              </div>

              {/* Current path */}
              <div className="px-4 py-2 bg-surface-1 border-b border-white/5">
                <p className="text-xs text-tertiary mb-1">Current location</p>
                <p className="text-sm font-mono text-primary truncate">{currentPath}</p>
              </div>

              {/* Directory listing */}
              <div className="h-64 overflow-y-auto p-2">
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
            </>
          ) : (
            /* Manual path mode */
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Folder Path
                </label>
                <input
                  type="text"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSelect()}
                  placeholder="/home/user/Music"
                  className="input-field w-full font-mono text-sm"
                />
                <p className="text-xs text-tertiary mt-2">
                  Enter the full path to your music folder on the server.
                </p>
              </div>

              {/* Quick paths */}
              <div>
                <p className="text-xs text-tertiary mb-2">Common locations:</p>
                <div className="flex flex-wrap gap-2">
                  {['/home', '/media', '/mnt', '/sdcard', '/storage', '/data/data/com.termux/files/home/storage/shared/Music',
                    (window as any).AndroidBridge ? '/storage/emulated/0' : null,
                    (window as any).AndroidBridge ? '/storage/emulated/0/Music' : null
                  ].filter(Boolean).map((p) => (
                    <button
                      key={p}
                      onClick={() => setManualPath(p)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-secondary transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-white/5">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            {mode === 'manual' ? (
              <button onClick={handleManualSelect} className="btn-primary" disabled={!manualPath.trim()}>
                Select This Folder
              </button>
            ) : (
              <button onClick={handleSelect} className="btn-primary">
                Select This Folder
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

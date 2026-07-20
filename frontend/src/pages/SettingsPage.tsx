import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useUIStore } from '../stores';
import { cn } from '../lib/utils';
import type { Library, ScanProgress } from '../types';

export default function SettingsPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [scanProgress, setScanProgress] = useState<Record<string, ScanProgress>>({});
  const { theme, setTheme } = useUIStore();

  useEffect(() => {
    api.libraries.list()
      .then(setLibraries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newName.trim() || !newPath.trim()) return;
    try {
      const lib = await api.libraries.create({ name: newName, path: newPath });
      setLibraries([...libraries, lib]);
      setNewName('');
      setNewPath('');
      setShowAdd(false);
    } catch (e) {
      console.error('Failed to add library:', e);
    }
  };

  const handleScan = async (id: string) => {
    try {
      await api.libraries.scan(id);

      const poll = setInterval(async () => {
        try {
          const progress = await api.libraries.scanProgress(id);
          setScanProgress((prev) => ({ ...prev, [id]: progress }));
          if (!progress.is_scanning) {
            clearInterval(poll);
            const libs = await api.libraries.list();
            setLibraries(libs);
          }
        } catch {
          clearInterval(poll);
        }
      }, 1000);
    } catch (e) {
      console.error('Failed to start scan:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this library? This will not delete any music files.')) return;
    try {
      await api.libraries.delete(id);
      setLibraries(libraries.filter((l) => l.id !== id));
    } catch (e) {
      console.error('Failed to delete library:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-primary">Settings</h1>

      {/* Libraries */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Libraries</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Library
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-card p-4 mb-4"
          >
            <h3 className="font-medium text-primary mb-3">Add Music Library</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Library name (e.g., My Music)"
              className="input-field mb-3"
              autoFocus
            />
            <input
              type="text"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="Path to music folder (e.g., /home/user/Music)"
              className="input-field mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAdd(false); setNewName(''); setNewPath(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newPath.trim()}
                className="btn-primary disabled:opacity-50"
              >
                Add Library
              </button>
            </div>
          </motion.div>
        )}

        {/* Library list */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : libraries.length > 0 ? (
          <div className="space-y-3">
            {libraries.map((lib) => {
              const progress = scanProgress[lib.id];
              return (
                <motion.div
                  key={lib.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="surface-card p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-primary">{lib.name}</h3>
                      <p className="text-sm text-secondary truncate">{lib.path}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleScan(lib.id)}
                        disabled={lib.is_scanning || (progress?.is_scanning)}
                        className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-50"
                      >
                        {lib.is_scanning || progress?.is_scanning ? 'Scanning...' : 'Scan'}
                      </button>
                      <button
                        onClick={() => handleDelete(lib.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-tertiary">
                    <span>{lib.track_count} tracks</span>
                    {lib.last_scan && (
                      <span>Last scanned: {new Date(lib.last_scan).toLocaleDateString()}</span>
                    )}
                  </div>

                  {/* Scan progress */}
                  {progress && progress.is_scanning && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-secondary mb-1">
                        <span>Scanning...</span>
                        <span>{progress.files_processed} / {progress.files_found}</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-brand-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: progress.files_found > 0
                              ? `${(progress.files_processed / progress.files_found) * 100}%`
                              : '0%',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 surface-card">
            <p className="text-secondary mb-4">No libraries configured</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              Add your first library
            </button>
          </div>
        )}
      </section>

      {/* Appearance */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">Appearance</h2>
        <div className="surface-card p-4">
          <p className="text-sm text-secondary mb-3">Theme</p>
          <div className="flex gap-2">
            {(['dark', 'light', 'amoled'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  theme === t
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-2 text-secondary hover:text-primary'
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">About</h2>
        <div className="surface-card p-4 space-y-2">
          <p className="text-sm text-secondary">Resonance Music Library v0.1.0</p>
          <p className="text-sm text-secondary">
            A self-hosted music archival system that prioritizes speed, audio quality, and a premium user experience.
          </p>
        </div>
      </section>
    </div>
  );
}

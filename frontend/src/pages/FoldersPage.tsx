import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import ErrorState from '../components/ErrorState';
import { cn } from '../lib/utils';

export default function FoldersPage() {
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.folders()
      .then(setFolders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load folders'))
      .finally(() => setLoading(false));
  }, [reload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => setReload((r) => r + 1)} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary">Folders</h1>
        <p className="text-sm text-secondary">{folders.length} folders</p>
      </div>

      {folders.length > 0 ? (
        <div className="space-y-2">
          {folders.map((folder, i) => (
            <motion.div
              key={folder}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors"
              onClick={() => {
                const folderName = folder.split(/[/\\]/).pop() || folder;
                navigate(`/library?search=${encodeURIComponent(folderName)}`);
              }}
            >
              <svg className="w-5 h-5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-primary truncate">{folder.split(/[/\\]/).pop()}</p>
                <p className="text-xs text-tertiary truncate">{folder}</p>
              </div>
              <svg className="w-4 h-4 text-tertiary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-secondary">No folders found</div>
      )}
    </div>
  );
}

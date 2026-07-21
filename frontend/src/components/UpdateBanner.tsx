import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import type { UpdateStatus } from '../types';

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const result = await api.updater.getStatus();
      setStatus(result);
    } catch (e) {
      console.error('Failed to check for updates:', e);
    }
  };

  const handleCheckNow = async () => {
    setLoading(true);
    try {
      const result = await api.updater.check();
      setStatus(result);
    } catch (e) {
      console.error('Failed to check for updates:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateMessage('');
    try {
      const result = await api.updater.update();
      setUpdateMessage(result.message || 'Update applied successfully');
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (e: any) {
      setUpdateMessage(e.message || 'Update failed');
      setUpdating(false);
    }
  };

  if (!status || !status.update_available || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-brand-600 text-white px-4 py-3 shadow-lg"
      >
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-sm font-medium">
              Update available: v{status.latest_version}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {updateMessage ? (
              <span className="text-sm">{updateMessage}</span>
            ) : (
              <>
                {status.docker_socket && (
                  <button
                    onClick={handleUpdate}
                    disabled={updating}
                    className="px-3 py-1.5 bg-white text-brand-600 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : 'Update Now'}
                  </button>
                )}
                <button
                  onClick={handleCheckNow}
                  disabled={loading}
                  className="px-3 py-1.5 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Checking...' : 'Refresh'}
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

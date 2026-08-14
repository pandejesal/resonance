import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { toast } from './Toast';
import { useLicenseStore } from '../stores';
import { useNavigate } from 'react-router-dom';
import type { Track } from '../types';

interface MetadataEditorProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function MetadataEditor({ track, isOpen, onClose, onSave }: MetadataEditorProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [trackNum, setTrackNum] = useState('');
  const [bpm, setBpm] = useState('');
  const [musicalKey, setMusicalKey] = useState('');
  const [saving, setSaving] = useState(false);
  const { hasFeature } = useLicenseStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setAlbumArtist(track.album_artist || '');
      setGenre(track.genre || '');
      setYear(track.year?.toString() || '');
      setTrackNum(track.track_number?.toString() || '');
      setBpm(track.bpm?.toString() || '');
      setMusicalKey(track.musical_key || '');
    }
  }, [track]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.tracks.update(track.id, {
        title,
        artist,
        album,
        album_artist: albumArtist,
        genre,
        year: year ? parseInt(year) : undefined,
        track_number: trackNum ? parseInt(trackNum) : undefined,
        bpm: bpm ? parseFloat(bpm) : undefined,
        musical_key: musicalKey || undefined,
      });
      toast.success('Metadata saved');
      onSave();
      onClose();
    } catch (e) {
      toast.error('Failed to save metadata');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  if (!hasFeature('metadata_editor')) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface-1/95 backdrop-blur-xl rounded-2xl border border-white/10 p-6 max-w-sm w-full mx-4 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-primary mb-2">Pro Feature</h3>
            <p className="text-secondary text-sm mb-4">Metadata editing requires a Pro subscription.</p>
            <button
              onClick={() => { onClose(); navigate('/upgrade'); }}
              className="btn-primary w-full"
            >
              Upgrade to Pro
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-surface-1/95 backdrop-blur-xl rounded-2xl border border-white/10 p-6 max-w-lg w-full mx-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold text-primary mb-4">Edit Metadata</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-secondary mb-1">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-secondary mb-1">Artist</label>
                <input value={artist} onChange={(e) => setArtist(e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Album</label>
                <input value={album} onChange={(e) => setAlbum(e.target.value)} className="input-field w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-secondary mb-1">Album Artist</label>
                <input value={albumArtist} onChange={(e) => setAlbumArtist(e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Genre</label>
                <input value={genre} onChange={(e) => setGenre(e.target.value)} className="input-field w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-secondary mb-1">Year</label>
                <input value={year} onChange={(e) => setYear(e.target.value)} type="number" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Track #</label>
                <input value={trackNum} onChange={(e) => setTrackNum(e.target.value)} type="number" className="input-field w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-secondary mb-1">BPM</label>
                <input value={bpm} onChange={(e) => setBpm(e.target.value)} type="number" step="0.1" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Musical Key</label>
                <input value={musicalKey} onChange={(e) => setMusicalKey(e.target.value)} placeholder="e.g. C# minor" className="input-field w-full" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

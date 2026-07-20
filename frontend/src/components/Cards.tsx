import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Album } from '../types';
import { usePlayerStore } from '../stores';
import { getArtworkUrl, cn } from '../lib/utils';
import { api } from '../lib/api';

interface AlbumCardProps {
  album: Album;
  onClick?: () => void;
}

export function AlbumCard({ album, onClick }: AlbumCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="surface-card p-3 cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 album-shadow">
        {album.has_artwork ? (
          <img
            src={getArtworkUrl(album.id)}
            alt={album.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-600/20 to-surface-2 flex items-center justify-center">
            <svg className="w-12 h-12 text-white/20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.button>
        </div>
      </div>

      <h3 className="text-sm font-medium text-primary truncate">{album.title}</h3>
      <p className="text-xs text-secondary truncate">{album.artist}</p>
      {album.year && <p className="text-xs text-tertiary">{album.year}</p>}
    </motion.div>
  );
}

interface ArtistCardProps {
  artist: {
    id: string;
    name: string;
    track_count: number;
    album_count: number;
    has_artwork: boolean;
  };
  onClick?: () => void;
}

export function ArtistCard({ artist, onClick }: ArtistCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="surface-card p-3 cursor-pointer group text-center"
      onClick={onClick}
    >
      <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden mb-3 album-shadow">
        {artist.has_artwork ? (
          <img
            src={`/api/artists/${artist.id}/artwork`}
            alt={artist.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-600/30 to-surface-2 flex items-center justify-center">
            <svg className="w-10 h-10 text-white/30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        )}
      </div>

      <h3 className="text-sm font-medium text-primary truncate">{artist.name}</h3>
      <p className="text-xs text-secondary">
        {artist.track_count} tracks
      </p>
    </motion.div>
  );
}

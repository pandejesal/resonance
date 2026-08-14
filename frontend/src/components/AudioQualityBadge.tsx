import React from 'react';

interface AudioQualityBadgeProps {
  format?: string;
  bitrate?: number;
  sampleRate?: number;
  bitDepth?: number;
  className?: string;
}

export default function AudioQualityBadge({
  format,
  bitrate,
  sampleRate,
  bitDepth,
  className = '',
}: AudioQualityBadgeProps) {
  const getQualityLabel = () => {
    if (!format) return null;
    const f = format.toLowerCase();
    if (f.includes('flac') || f.includes('alac') || f === 'wav' || f === 'aiff') {
      return { text: 'LOSSLESS', color: 'text-green-400 bg-green-400/10 border-green-400/20' };
    }
    if (f.includes('dsd') || f.includes('dsf')) {
      return { text: 'HI-RES', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
    }
    if (bitrate && bitrate >= 320) {
      return { text: 'HIGH', color: 'text-brand-400 bg-brand-400/10 border-brand-400/20' };
    }
    return { text: 'STANDARD', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' };
  };

  const quality = getQualityLabel();
  if (!quality) return null;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${quality.color}`}>
        {quality.text}
      </span>
      {format && <span className="text-xs text-tertiary">{format.toUpperCase()}</span>}
      {bitrate && <span className="text-xs text-tertiary">{Math.round(bitrate / 1000)}kbps</span>}
      {sampleRate && <span className="text-xs text-tertiary">{sampleRate / 1000}kHz</span>}
      {bitDepth && <span className="text-xs text-tertiary">{bitDepth}bit</span>}
    </div>
  );
}

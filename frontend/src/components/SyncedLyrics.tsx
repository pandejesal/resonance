import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../stores';

interface LyricLine {
  time: number;
  text: string;
}

function parseLrc(lrc: string): LyricLine[] {
  if (!lrc) return [];
  return lrc
    .split('\n')
    .map(line => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (!match) return null;
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, '0'));
      return { time: min * 60 + sec + ms / 1000, text: match[4].trim() };
    })
    .filter((l): l is LyricLine => l !== null && l.text.length > 0)
    .sort((a, b) => a.time - b.time);
}

interface SyncedLyricsProps {
  lyrics: string;
  className?: string;
}

export default function SyncedLyrics({ lyrics, className = '' }: SyncedLyricsProps) {
  const progress = usePlayerStore(s => s.progress);
  const seek = usePlayerStore(s => s.seek);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const currentTime = progress / 1000;

  const parsedLines = useMemo(() => parseLrc(lyrics), [lyrics]);

  useEffect(() => {
    if (parsedLines.length === 0) return;
    let idx = -1;
    for (let i = parsedLines.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLines[i].time - 0.1) {
        idx = i;
        break;
      }
    }
    setActiveIndex(idx);
  }, [currentTime, parsedLines]);

  useEffect(() => {
    if (activeIndex < 0 || !containerRef.current) return;
    const container = containerRef.current;
    const activeEl = container.children[activeIndex] as HTMLElement;
    if (!activeEl) return;
    const containerHeight = container.clientHeight;
    const scrollTarget = activeEl.offsetTop - containerHeight / 2 + activeEl.clientHeight / 2;
    container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  }, [activeIndex]);

  if (parsedLines.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-secondary text-sm">No synced lyrics available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto scroll-smooth ${className}`}
      style={{ maskImage: 'linear-gradient(transparent, black 15%, black 85%, transparent)' }}
    >
      <div className="py-20 space-y-1">
        {parsedLines.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = activeIndex >= 0 && i < activeIndex;
          return (
            <motion.p
              key={`${i}-${line.time}`}
              className={`text-center transition-all duration-300 cursor-pointer select-none px-4 ${
                isActive
                  ? 'text-white text-2xl font-bold scale-105'
                  : isPast
                  ? 'text-white/20 text-lg'
                  : 'text-white/40 text-lg hover:text-white/60'
              }`}
              onClick={() => seek(line.time * 1000)}
              animate={{
                opacity: isActive ? 1 : isPast ? 0.2 : 0.4,
                scale: isActive ? 1.05 : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              {line.text}
            </motion.p>
          );
        })}
      </div>
    </div>
  );
}

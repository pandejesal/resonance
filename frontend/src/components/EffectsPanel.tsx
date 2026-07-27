import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioEngine } from '../lib/audio-engine';

interface EffectPreset {
  name: string;
  reverb: number;
  echo: number;
  speed: number;
}

const presets: EffectPreset[] = [
  { name: 'Normal', reverb: 0, echo: 0, speed: 1 },
  { name: 'Concert', reverb: 0.6, echo: 0, speed: 1 },
  { name: 'Studio', reverb: 0.2, echo: 0, speed: 1 },
  { name: 'Echo', reverb: 0.3, echo: 0.4, speed: 1 },
  { name: 'Nightcore', reverb: 0, echo: 0, speed: 1.25 },
  { name: 'Screwed', reverb: 0.2, echo: 0, speed: 0.75 },
  { name: 'Lo-Fi', reverb: 0.4, echo: 0.1, speed: 0.95 },
  { name: 'Live', reverb: 0.7, echo: 0.15, speed: 1 },
];

export default function EffectsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState('Normal');
  const [reverb, setReverb] = useState(0);
  const [echo, setEcho] = useState(0);
  const [speed, setSpeed] = useState(1);

  const applyPreset = (preset: EffectPreset) => {
    setActivePreset(preset.name);
    setReverb(preset.reverb);
    setEcho(preset.echo);
    setSpeed(preset.speed);
    audioEngine.setReverb(preset.reverb);
    audioEngine.setEcho(preset.echo * 0.5, preset.echo);
    audioEngine.setSpeed(preset.speed);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-white/5 text-tertiary hover:text-primary transition-colors"
        title="Audio Effects"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full right-0 mb-2 w-80 bg-surface-1/95 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-2xl z-50"
          >
            <h3 className="text-sm font-bold text-primary mb-3">Audio Effects</h3>

            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {presets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    activePreset === p.name
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-2 hover:bg-surface-3 text-secondary'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-secondary">Reverb</span>
                  <span className="text-primary">{Math.round(reverb * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.01" value={reverb}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setReverb(v);
                    audioEngine.setReverb(v);
                    setActivePreset('Custom');
                  }}
                  className="w-full h-1 bg-surface-3 rounded-full appearance-none cursor-pointer accent-brand-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-secondary">Echo</span>
                  <span className="text-primary">{Math.round(echo * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.01" value={echo}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setEcho(v);
                    audioEngine.setEcho(v * 0.5, v);
                    setActivePreset('Custom');
                  }}
                  className="w-full h-1 bg-surface-3 rounded-full appearance-none cursor-pointer accent-brand-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-secondary">Speed</span>
                  <span className="text-primary">{speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range" min="0.5" max="2" step="0.01" value={speed}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setSpeed(v);
                    audioEngine.setSpeed(v);
                    setActivePreset('Custom');
                  }}
                  className="w-full h-1 bg-surface-3 rounded-full appearance-none cursor-pointer accent-brand-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

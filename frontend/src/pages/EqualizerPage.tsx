import React from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../stores';
import { EQ_FREQUENCIES, EQ_PRESETS } from '../lib/audio-engine';
import { cn } from '../lib/utils';

const BAND_LABELS = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

function EQSlider({ index, label, gain, onChange }: { index: number; label: string; gain: number; onChange: (v: number) => void }) {
  const percentage = ((gain + 12) / 24) * 100;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-secondary font-mono">{gain > 0 ? '+' : ''}{gain.toFixed(1)}</span>
      <div className="relative h-48 w-8 flex items-center justify-center">
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 h-full bg-white/10 rounded-full" />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-1 rounded-full bg-brand-500"
          style={{
            bottom: '50%',
            height: `${Math.abs(gain) / 12 * 50}%`,
            background: gain >= 0 ? 'linear-gradient(to top, var(--color-brand-500), var(--color-brand-400))' : 'linear-gradient(to bottom, var(--color-brand-500), var(--color-brand-400))',
          }}
        />
        <input
          type="range"
          min={-12}
          max={12}
          step={0.5}
          value={gain}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-white shadow-lg border-2 border-brand-500 pointer-events-none"
          style={{ bottom: `calc(${percentage}% - 8px)` }}
        />
      </div>
      <span className="text-xs text-tertiary font-medium">{label}</span>
    </div>
  );
}

export default function EqualizerPage() {
  const { eqEnabled, eqBands, eqPreset, toggleEQ, setEQBand, setEQPreset } = usePlayerStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Equalizer</h1>
        <button
          onClick={toggleEQ}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-all',
            eqEnabled
              ? 'bg-brand-600 text-white'
              : 'bg-surface-2 text-secondary hover:text-primary'
          )}
        >
          {eqEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Presets */}
      <section>
        <h2 className="text-sm font-semibold text-secondary mb-3">Presets</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(EQ_PRESETS).map((preset) => (
            <button
              key={preset}
              onClick={() => setEQPreset(preset)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                eqPreset === preset
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-2 text-secondary hover:text-primary hover:bg-surface-3'
              )}
            >
              {preset.charAt(0).toUpperCase() + preset.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>
      </section>

      {/* EQ Sliders */}
      <section className="surface-card p-6 overflow-x-auto">
        <div className="flex items-end justify-between gap-1">
          {EQ_FREQUENCIES.map((freq, i) => (
            <EQSlider
              key={freq}
              index={i}
              label={BAND_LABELS[i]}
              gain={eqBands[i] || 0}
              onChange={(v) => setEQBand(i, v)}
            />
          ))}
        </div>
        <div className="flex justify-between mt-4 text-xs text-tertiary">
          <span>-12 dB</span>
          <span>0 dB</span>
          <span>+12 dB</span>
        </div>
      </section>

      {/* Frequency Response Curve */}
      <section className="surface-card p-4">
        <h2 className="text-sm font-semibold text-secondary mb-3">Frequency Response</h2>
        <div className="h-24 relative">
          <svg viewBox="0 0 400 100" className="w-full h-full">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            {/* Center line (0 dB) */}
            <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
            {/* Response curve */}
            <path
              d={(() => {
                const points = eqBands.map((gain, i) => {
                  const x = (i / (eqBands.length - 1)) * 400;
                  const y = 50 - (gain / 12) * 50;
                  return `${x},${y}`;
                });
                return `M ${points.join(' L ')}`;
              })()}
              fill="none"
              stroke={eqEnabled ? 'rgb(92, 124, 250)' : 'rgba(255,255,255,0.2)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots */}
            {eqBands.map((gain, i) => (
              <circle
                key={i}
                cx={(i / (eqBands.length - 1)) * 400}
                cy={50 - (gain / 12) * 50}
                r="3"
                fill={eqEnabled ? 'rgb(92, 124, 250)' : 'rgba(255,255,255,0.2)'}
              />
            ))}
          </svg>
        </div>
      </section>
    </div>
  );
}

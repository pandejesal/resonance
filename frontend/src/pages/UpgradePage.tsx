import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { toast } from '../components/Toast';
import { useLicenseStore } from '../stores';
import type { PricingPlan } from '../types';

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    features: [
      'Bit-perfect playback',
      '10-band equalizer',
      'Gapless & crossfade',
      'Import from Spotify/YouTube/Apple',
      'Unlimited playlists',
      'Waveform visualization',
      '1 user, 1 device',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5,
    period: 'month',
    highlighted: true,
    features: [
      'Everything in Free',
      'Cloud sync across devices',
      'AI-powered recommendations',
      'Audio effects (reverb, echo, pitch)',
      'Metadata editor',
      'Advanced analytics',
      'Custom themes',
      'Up to 3 devices',
      'Priority support',
      '14-day free trial',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 15,
    period: 'month',
    features: [
      'Everything in Pro',
      'Unlimited devices',
      'API access',
      'White-label options',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
  },
];

export default function UpgradePage() {
  const { status: license, fetchStatus } = useLicenseStore();
  const [activating, setActivating] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    try {
      const result = await api.license.activate(licenseKey);
      if (result.success) {
        toast.success(`Upgraded to ${result.tier}!`);
        await fetchStatus();
        setLicenseKey('');
      }
    } catch (e: any) {
      toast.error(e.message || 'Invalid license key');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">Upgrade Resonance</h1>
        <p className="text-secondary mt-2">Unlock premium features. Your music, your way.</p>
        {license?.trial_remaining_days && license.tier === 'free' && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            {license.trial_remaining_days} days left in your free trial
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = license?.tier === plan.id;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative rounded-2xl p-6 border transition-all ${
                plan.highlighted
                  ? 'bg-brand-500/10 border-brand-500/30 shadow-lg shadow-brand-500/10'
                  : 'bg-surface-1 border-white/5'
              } ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-500 text-white text-xs font-bold rounded-full">
                  MOST POPULAR
                </div>
              )}
              <h3 className="text-lg font-bold text-primary">{plan.name}</h3>
              <div className="mt-3 mb-4">
                <span className="text-4xl font-bold text-primary">${plan.price}</span>
                <span className="text-secondary text-sm">/{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-secondary">{f}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="w-full py-2 text-center text-sm font-medium text-brand-400 bg-brand-500/10 rounded-xl">
                  Current Plan
                </div>
              ) : plan.id === 'free' ? (
                <div className="w-full py-2 text-center text-sm font-medium text-tertiary bg-surface-2 rounded-xl">
                  Free Forever
                </div>
              ) : (
                <div className="text-xs text-tertiary text-center">
                  Contact us to get a license key
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* License Activation */}
      <div className="bg-surface-1 rounded-2xl border border-white/5 p-6">
        <h3 className="text-lg font-bold text-primary mb-4">Activate License</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="RES-PRO-XXXXXXXXXXXXXXXX"
            className="input-field flex-1 font-mono"
          />
          <button
            onClick={handleActivate}
            disabled={activating || !licenseKey.trim()}
            className="btn-primary"
          >
            {activating ? 'Activating...' : 'Activate'}
          </button>
        </div>
        <p className="text-xs text-tertiary mt-2">
          Get your license key at <span className="text-brand-400">resonance.app/pricing</span>
        </p>
      </div>

      {/* Current Status */}
      {license && (
        <div className="bg-surface-1 rounded-2xl border border-white/5 p-6">
          <h3 className="text-lg font-bold text-primary mb-4">Current Plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-tertiary">Tier</span>
              <p className="text-primary font-medium capitalize">{license.tier}</p>
            </div>
            <div>
              <span className="text-tertiary">Devices</span>
              <p className="text-primary font-medium">{license.device_count}/{license.max_devices}</p>
            </div>
            <div>
              <span className="text-tertiary">Features</span>
              <p className="text-primary font-medium">{license.features.length} unlocked</p>
            </div>
            <div>
              <span className="text-tertiary">Expires</span>
              <p className="text-primary font-medium">{license.expires_at || 'Never'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

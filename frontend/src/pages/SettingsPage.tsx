import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useUIStore, usePlayerStore } from '../stores';
import { cn } from '../lib/utils';
import FileBrowser from '../components/FileBrowser';
import type { Library, ScanProgress, ScrobblingConfig, UpdateStatus, UpdaterConfig, DeviceTrack } from '../types';

const DEFAULT_SCROBBLE_CONFIG: ScrobblingConfig = {
  lastfm: { enabled: false, api_key: null, api_secret: null, session_key: null, username: null },
  listenbrainz: { enabled: false, token: null },
};

const DEFAULT_UPDATER_CONFIG: UpdaterConfig = {
  auto_check: false,
  check_interval_hours: 6,
  docker_socket: false,
};

export default function SettingsPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [scanProgress, setScanProgress] = useState<Record<string, ScanProgress>>({});
  const [showBrowser, setShowBrowser] = useState(false);
  const { theme, setTheme } = useUIStore();
  const {
    crossfade, toggleCrossfade, crossfadeDuration, setCrossfadeDuration,
    gapless, toggleGapless,
  } = usePlayerStore();
  const [scrobblingConfig, setScrobblingConfig] = useState<ScrobblingConfig>(DEFAULT_SCROBBLE_CONFIG);
  const [scrobblingSaving, setScrobblingSaving] = useState(false);
  const [updaterStatus, setUpdaterStatus] = useState<UpdateStatus | null>(null);
  const [updaterConfig, setUpdaterConfig] = useState<UpdaterConfig>(DEFAULT_UPDATER_CONFIG);
  const [updaterChecking, setUpdaterChecking] = useState(false);
  const [updaterUpdating, setUpdaterUpdating] = useState(false);
  const [updaterMessage, setUpdaterMessage] = useState('');
  const [deviceScanning, setDeviceScanning] = useState(false);
  const [deviceScanResult, setDeviceScanResult] = useState<string>('');

  useEffect(() => {
    api.libraries.list()
      .then(setLibraries)
      .catch(console.error)
      .finally(() => setLoading(false));

    api.settings.getScrobbling()
      .then(setScrobblingConfig)
      .catch(console.error);

    api.updater.getStatus()
      .then(setUpdaterStatus)
      .catch(console.error);

    api.updater.getConfig()
      .then(setUpdaterConfig)
      .catch(console.error);
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

  const handleScrobbleToggle = (service: 'lastfm' | 'listenbrainz') => {
    setScrobblingConfig((prev) => ({
      ...prev,
      [service]: { ...prev[service], enabled: !prev[service].enabled },
    }));
  };

  const handleScrobbleChange = (service: 'lastfm' | 'listenbrainz', field: string, value: string) => {
    setScrobblingConfig((prev) => ({
      ...prev,
      [service]: { ...prev[service], [field]: value },
    }));
  };

  const handleSaveScrobbling = async () => {
    setScrobblingSaving(true);
    try {
      const result = await api.settings.updateScrobbling(scrobblingConfig);
      setScrobblingConfig(result.config);
    } catch (e) {
      console.error('Failed to save scrobbling settings:', e);
    } finally {
      setScrobblingSaving(false);
    }
  };

  const handleCheckForUpdates = async () => {
    setUpdaterChecking(true);
    setUpdaterMessage('');
    try {
      const result = await api.updater.check();
      setUpdaterStatus(result);
      if (result.update_available) {
        setUpdaterMessage(`Update available: v${result.latest_version}`);
      } else {
        setUpdaterMessage('Already up to date');
      }
    } catch (e) {
      setUpdaterMessage('Error checking for updates');
    } finally {
      setUpdaterChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    setUpdaterUpdating(true);
    setUpdaterMessage('');
    try {
      const result = await api.updater.update();
      setUpdaterMessage(result.message);
      setTimeout(() => window.location.reload(), 3000);
    } catch (e: any) {
      setUpdaterMessage(e.message || 'Update failed');
    } finally {
      setUpdaterUpdating(false);
    }
  };

  const handleUpdaterConfigChange = async (field: keyof UpdaterConfig) => {
    const newConfig = {
      ...updaterConfig,
      [field]: !updaterConfig[field],
    };
    setUpdaterConfig(newConfig);
    try {
      const result = await api.updater.updateConfig(newConfig);
      setUpdaterConfig(result.config);
    } catch (e) {
      console.error('Failed to update updater config:', e);
    }
  };

  const handleUpdaterIntervalChange = async (hours: number) => {
    const newConfig = { ...updaterConfig, check_interval_hours: hours };
    setUpdaterConfig(newConfig);
    try {
      const result = await api.updater.updateConfig(newConfig);
      setUpdaterConfig(result.config);
    } catch (e) {
      console.error('Failed to update updater config:', e);
    }
  };

  const handleDeviceScan = async () => {
    if (!(window as any).AndroidBridge) {
      setDeviceScanResult('Device scan is only available on Android');
      return;
    }
    setDeviceScanning(true);
    setDeviceScanResult('');
    try {
      const tracksJson = (window as any).AndroidBridge.scanDeviceMusic();
      const tracks: DeviceTrack[] = JSON.parse(tracksJson);
      if (tracks.length === 0) {
        setDeviceScanResult('No music files found on device');
        setDeviceScanning(false);
        return;
      }
      setDeviceScanResult(`Found ${tracks.length} tracks. Importing...`);
      const result = await api.import.deviceScan(null, tracks);
      setDeviceScanResult(
        `Scan complete! Added ${result.tracks_added} tracks, skipped ${result.tracks_skipped} (duplicates/invalid) out of ${result.total_scanned} found.`
      );
      const libs = await api.libraries.list();
      setLibraries(libs);
    } catch (e: any) {
      setDeviceScanResult(`Scan failed: ${e.message || 'Unknown error'}`);
    } finally {
      setDeviceScanning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-primary">Settings</h1>

      {/* Libraries */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Libraries</h2>
          {(window as any).AndroidBridge ? (
            <button
              onClick={handleDeviceScan}
              disabled={deviceScanning}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
              {deviceScanning ? 'Scanning...' : 'Scan Device Music'}
            </button>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Library
            </button>
          )}
        </div>
        {deviceScanResult && (
          <div className="surface-card p-3 mb-4 text-sm">
            <p className="text-primary">{deviceScanResult}</p>
          </div>
        )}

        {/* Add form and library list - hidden on Android (auto-scan only) */}
        {!(window as any).AndroidBridge && (
          <>
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
            <div className="mb-3">
              <label className="block text-xs text-secondary mb-1">Music folder path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="Click Browse to select folder"
                  className="input-field flex-1"
                  readOnly
                />
                <button
                  onClick={() => setShowBrowser(true)}
                  className="btn-secondary px-4 flex items-center gap-2 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Browse
                </button>
              </div>
            </div>
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
          </>
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

      {/* Playback */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">Playback</h2>
        <div className="surface-card p-4 space-y-4">
          {/* Gapless */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Gapless Playback</p>
              <p className="text-xs text-tertiary">No silence between tracks</p>
            </div>
            <button
              onClick={toggleGapless}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                gapless ? 'bg-brand-600' : 'bg-surface-3'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  gapless ? 'translate-x-5.5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          {/* Crossfade */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Crossfade</p>
              <p className="text-xs text-tertiary">Fade between tracks (disables gapless)</p>
            </div>
            <button
              onClick={toggleCrossfade}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                crossfade ? 'bg-brand-600' : 'bg-surface-3'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  crossfade ? 'translate-x-5.5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          {/* Crossfade duration */}
          {crossfade && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-secondary">Crossfade Duration</p>
                <span className="text-sm text-primary font-mono">{crossfadeDuration}s</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={crossfadeDuration}
                onChange={(e) => setCrossfadeDuration(parseInt(e.target.value))}
                className="w-full h-1.5 bg-surface-3 rounded-full appearance-none cursor-pointer accent-brand-500"
              />
              <div className="flex justify-between text-xs text-tertiary mt-1">
                <span>1s</span>
                <span>12s</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Scrobbling */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">Scrobbling</h2>
        <div className="space-y-4">
          {/* Last.fm */}
          <div className="surface-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Last.fm</p>
                <p className="text-xs text-tertiary">Track your listening habits</p>
              </div>
              <button
                onClick={() => handleScrobbleToggle('lastfm')}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  scrobblingConfig.lastfm.enabled ? 'bg-brand-600' : 'bg-surface-3'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    scrobblingConfig.lastfm.enabled ? 'translate-x-5.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {scrobblingConfig.lastfm.enabled && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={scrobblingConfig.lastfm.api_key || ''}
                  onChange={(e) => handleScrobbleChange('lastfm', 'api_key', e.target.value)}
                  placeholder="API Key"
                  className="input-field"
                />
                <input
                  type="password"
                  value={scrobblingConfig.lastfm.api_secret || ''}
                  onChange={(e) => handleScrobbleChange('lastfm', 'api_secret', e.target.value)}
                  placeholder="API Secret"
                  className="input-field"
                />
                <input
                  type="password"
                  value={scrobblingConfig.lastfm.session_key || ''}
                  onChange={(e) => handleScrobbleChange('lastfm', 'session_key', e.target.value)}
                  placeholder="Session Key"
                  className="input-field"
                />
                <p className="text-xs text-tertiary">
                  Get your API key at last.fm/api/account/create. Session key obtained via web auth flow.
                </p>
              </div>
            )}
          </div>

          {/* ListenBrainz */}
          <div className="surface-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">ListenBrainz</p>
                <p className="text-xs text-tertiary">Open source music tracking</p>
              </div>
              <button
                onClick={() => handleScrobbleToggle('listenbrainz')}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  scrobblingConfig.listenbrainz.enabled ? 'bg-brand-600' : 'bg-surface-3'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    scrobblingConfig.listenbrainz.enabled ? 'translate-x-5.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {scrobblingConfig.listenbrainz.enabled && (
              <div className="space-y-3">
                <input
                  type="password"
                  value={scrobblingConfig.listenbrainz.token || ''}
                  onChange={(e) => handleScrobbleChange('listenbrainz', 'token', e.target.value)}
                  placeholder="User Token"
                  className="input-field"
                />
                <p className="text-xs text-tertiary">
                  Get your token at listenbrainz.org/settings
                </p>
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSaveScrobbling}
            disabled={scrobblingSaving}
            className="btn-primary disabled:opacity-50"
          >
            {scrobblingSaving ? 'Saving...' : 'Save Scrobbling Settings'}
          </button>
        </div>
      </section>

      {/* Updater */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">Updates</h2>
        <div className="surface-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Current Version</p>
              <p className="text-xs text-tertiary">v{updaterStatus?.current_version || '0.1.0'}</p>
            </div>
            {updaterStatus?.update_available && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg font-medium">
                Update Available
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Auto-check for updates</p>
              <p className="text-xs text-tertiary">Periodically check GitHub for new versions</p>
            </div>
            <button
              onClick={() => handleUpdaterConfigChange('auto_check')}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                updaterConfig.auto_check ? 'bg-brand-600' : 'bg-surface-3'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  updaterConfig.auto_check ? 'translate-x-5.5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          {updaterConfig.auto_check && (
            <div>
              <p className="text-sm text-secondary mb-2">Check Interval</p>
              <div className="flex gap-2">
                {[1, 6, 12, 24, 168].map((hours) => (
                  <button
                    key={hours}
                    onClick={() => handleUpdaterIntervalChange(hours)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      updaterConfig.check_interval_hours === hours
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-2 text-secondary hover:text-primary'
                    )}
                  >
                    {hours === 1 ? '1h' : hours === 6 ? '6h' : hours === 12 ? '12h' : hours === 24 ? '24h' : 'Weekly'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Docker socket mounted</p>
              <p className="text-xs text-tertiary">Enable automatic updates (requires /var/run/docker.sock)</p>
            </div>
            <button
              onClick={() => handleUpdaterConfigChange('docker_socket')}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                updaterConfig.docker_socket ? 'bg-brand-600' : 'bg-surface-3'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  updaterConfig.docker_socket ? 'translate-x-5.5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          {updaterStatus?.last_checked && (
            <p className="text-xs text-tertiary">
              Last checked: {new Date(updaterStatus.last_checked).toLocaleString()}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCheckForUpdates}
              disabled={updaterChecking}
              className="btn-secondary disabled:opacity-50"
            >
              {updaterChecking ? 'Checking...' : 'Check Now'}
            </button>
            {updaterStatus?.update_available && updaterStatus?.docker_socket && (
              <button
                onClick={handleApplyUpdate}
                disabled={updaterUpdating}
                className="btn-primary disabled:opacity-50"
              >
                {updaterUpdating ? 'Updating...' : 'Update Now'}
              </button>
            )}
          </div>

          {updaterMessage && (
            <p className={cn(
              'text-sm',
              updaterMessage.includes('Error') || updaterMessage.includes('failed')
                ? 'text-red-400'
                : 'text-green-400'
            )}>
              {updaterMessage}
            </p>
          )}
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

      <FileBrowser
        isOpen={showBrowser}
        onClose={() => setShowBrowser(false)}
        onSelect={(path) => setNewPath(path)}
      />
    </div>
  );
}

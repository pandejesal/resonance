import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useUIStore, usePlayerStore, useAuthStore, useCastStore } from '../stores';
import { cn } from '../lib/utils';
import FileBrowser from '../components/FileBrowser';
import { toast } from '../components/Toast';
import type { Library, ScanProgress, ScrobblingConfig, UpdateStatus, UpdaterConfig, DeviceTrack, UserInfo, CastTarget } from '../types';

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
  const [updaterDownloading, setUpdaterDownloading] = useState(false);
  const [updaterMessage, setUpdaterMessage] = useState('');
  const [deviceScanning, setDeviceScanning] = useState(false);
  const [deviceScanResult, setDeviceScanResult] = useState('');
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [addUserError, setAddUserError] = useState('');
  const {
    targets: castTargets,
    fetchTargets: fetchCastTargets,
    registerTarget: registerCastTarget,
    unregisterTarget: unregisterCastTarget,
  } = useCastStore();
  const [showAddCastTarget, setShowAddCastTarget] = useState(false);
  const [newCastName, setNewCastName] = useState('');
  const [newCastHost, setNewCastHost] = useState('');
  const [newCastPort, setNewCastPort] = useState('8008');
  const bridge = (window as any).AndroidBridge;
  const [serverMode, setServerMode] = useState<'local' | 'remote' | ''>('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [lanIp, setLanIp] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    setServerMode(bridge.getServerMode() || 'local');
    setLanIp(bridge.getLanIp() || '');
    (window as any).__onConnectResult = (res: string) => {
      setConnecting(false);
      try {
        const r = JSON.parse(res);
        if (r.ok) {
          toast.success('Connected — switching servers...');
        } else {
          toast.error(r.error || 'Failed to connect');
        }
      } catch {
        toast.error('Failed to connect');
      }
    };
    return () => {
      delete (window as any).__onConnectResult;
    };
  }, [bridge]);

  const handleConnectServer = () => {
    if (!bridge || !remoteUrl.trim()) return;
    setConnecting(true);
    bridge.connectToServer(remoteUrl.trim());
  };
  const [newCastProtocol, setNewCastProtocol] = useState('chromecast');
  const scanPollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    api.libraries.list()
      .then(setLibraries)
      .catch(() => toast.error('Failed to load libraries'))
      .finally(() => setLoading(false));

    api.settings.getScrobbling()
      .then(setScrobblingConfig)
      .catch(() => toast.error('Failed to load scrobbling config'));

    api.updater.getStatus()
      .then(setUpdaterStatus)
      .catch(() => toast.error('Failed to load updater status'));

    api.updater.getConfig()
      .then(setUpdaterConfig)
      .catch(() => toast.error('Failed to load updater config'));

    fetchCastTargets().catch(() => toast.error('Failed to load cast targets'));

    if (user?.role === 'admin') {
      setUsersLoading(true);
      api.auth.listUsers()
        .then(setUsers)
        .catch(() => toast.error('Failed to load users'))
        .finally(() => setUsersLoading(false));
    }

    return () => {
      Object.values(scanPollRefs.current).forEach(clearInterval);
    };
  }, [user]);

  const handleAdd = async () => {
    if (!newName.trim() || !newPath.trim()) return;
    try {
      const lib = await api.libraries.create({ name: newName, path: newPath });
      setLibraries([...libraries, lib]);
      setNewName('');
      setNewPath('');
      setShowAdd(false);
    } catch (e) {
      toast.error('Failed to add library');
    }
  };

  const handleScan = async (id: string) => {
    try {
      await api.libraries.scan(id);

      // Clear any existing poll for this library
      if (scanPollRefs.current[id]) {
        clearInterval(scanPollRefs.current[id]);
      }

      const poll = setInterval(async () => {
        try {
          const progress = await api.libraries.scanProgress(id);
          setScanProgress((prev) => ({ ...prev, [id]: progress }));
          if (!progress.is_scanning) {
            clearInterval(poll);
            delete scanPollRefs.current[id];
            const libs = await api.libraries.list();
            setLibraries(libs);
          }
        } catch {
          clearInterval(poll);
          delete scanPollRefs.current[id];
        }
      }, 1000);

      scanPollRefs.current[id] = poll;
    } catch (e) {
      toast.error('Failed to start scan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this library? This will not delete any music files.')) return;
    try {
      await api.libraries.delete(id);
      setLibraries(libraries.filter((l) => l.id !== id));
    } catch (e) {
      toast.error('Failed to delete library');
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
      toast.error('Failed to save scrobbling settings');
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

  const handleOpenDownload = async () => {
    setUpdaterDownloading(true);
    setUpdaterMessage('');
    try {
      const result = await api.updater.openDownload();
      const bridge = (window as any).AndroidBridge;
      if (bridge?.openUrl) {
        bridge.openUrl(result.url);
      } else if (!result.success) {
        setUpdaterMessage('Could not open the download page');
      }
    } catch (e: any) {
      setUpdaterMessage(e.message || 'Could not open the download page');
    } finally {
      setUpdaterDownloading(false);
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
      toast.error('Failed to update updater config');
    }
  };

  const handleUpdaterIntervalChange = async (hours: number) => {
    const newConfig = { ...updaterConfig, check_interval_hours: hours };
    setUpdaterConfig(newConfig);
    try {
      const result = await api.updater.updateConfig(newConfig);
      setUpdaterConfig(result.config);
    } catch (e) {
      toast.error('Failed to update updater config');
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

  const handleAddUser = async () => {
    setAddUserError('');
    if (!newUsername.trim() || !newPassword.trim()) {
      setAddUserError('Username and password are required');
      return;
    }
    try {
      await api.auth.createUser({
        username: newUsername.trim(),
        password: newPassword.trim(),
        role: newUserRole,
      });
      const updatedUsers = await api.auth.listUsers();
      setUsers(updatedUsers);
      setNewUsername('');
      setNewPassword('');
      setNewUserRole('user');
      setShowAddUser(false);
    } catch (e: any) {
      setAddUserError(e.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.auth.deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (e: any) {
      toast.error('Failed to delete user');
    }
  };

  const handleAddCastTarget = async () => {
    if (!newCastName.trim() || !newCastHost.trim()) return;
    try {
      await registerCastTarget({
        name: newCastName.trim(),
        host: newCastHost.trim(),
        port: parseInt(newCastPort) || 8008,
        protocol: newCastProtocol,
        volume: 0.8,
      });
      setNewCastName('');
      setNewCastHost('');
      setNewCastPort('8008');
      setNewCastProtocol('chromecast');
      setShowAddCastTarget(false);
    } catch (e) {
      toast.error('Failed to add cast target');
    }
  };

  const handleDeleteCastTarget = async (id: string) => {
    if (!confirm('Remove this cast target?')) return;
    try {
      await unregisterCastTarget(id);
    } catch (e) {
      toast.error('Failed to delete cast target');
    }
  };

  const handleImportAutoEq = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const profile = JSON.parse(text);
        if (profile.profile_name) console.log('Profile:', profile.profile_name);
        if (profile.target_name) console.log('Target:', profile.target_name);
        if (profile.preamp != null) console.log('Preamp:', profile.preamp);
        if (Array.isArray(profile.filters)) {
          console.log('Filters loaded:', profile.filters.length);
        }
      } catch (err) {
        toast.error('Failed to parse AutoEQ profile');
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-primary">Settings</h1>

      {/* Server (Android: local backend or a shared remote server) */}
      {bridge && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">Server</h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${serverMode === 'remote' ? 'bg-brand-500/15 text-brand-400' : 'bg-white/5 text-tertiary'}`}>
              {serverMode === 'remote' ? 'Remote' : 'Local (this device)'}
            </span>
          </div>
          <div className="surface-card p-4 space-y-3">
            {serverMode === 'remote' ? (
              <>
                <p className="text-sm text-secondary">
                  Connected to a shared server. You're seeing the same library as your other devices.
                </p>
                <button
                  onClick={() => bridge.disconnectFromServer()}
                  className="btn-secondary flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
                  </svg>
                  Back to local server
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-secondary">
                  This device is running its own server. To see the same library as your
                  Windows/macOS/Linux machines, connect to that machine's Resonance server.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8080"
                    className="input-field flex-1 font-mono text-sm"
                  />
                  <button
                    onClick={handleConnectServer}
                    disabled={connecting || !remoteUrl.trim()}
                    className="btn-primary whitespace-nowrap"
                  >
                    {connecting ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
                {lanIp && (
                  <p className="text-xs text-tertiary">
                    Other devices on this network can connect to this phone: <span className="font-mono text-secondary">http://{lanIp}:8080</span>
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      )}

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
                        className="p-1.5 rounded-lg hover:bg-accent-500/10 text-accent-500 transition-colors"
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

      {/* Cast Targets */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Cast Targets</h2>
          <button
            onClick={() => setShowAddCastTarget(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Target
          </button>
        </div>

        {showAddCastTarget && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-card p-4 mb-4"
          >
            <h3 className="font-medium text-primary mb-3">Add Cast Target</h3>
            <input
              type="text"
              value={newCastName}
              onChange={(e) => setNewCastName(e.target.value)}
              placeholder="Target name (e.g., Living Room Speaker)"
              className="input-field mb-3"
              autoFocus
            />
            <input
              type="text"
              value={newCastHost}
              onChange={(e) => setNewCastHost(e.target.value)}
              placeholder="IP address or hostname"
              className="input-field mb-3"
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-secondary mb-1">Port</label>
                <input
                  type="number"
                  value={newCastPort}
                  onChange={(e) => setNewCastPort(e.target.value)}
                  placeholder="8008"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Protocol</label>
                <select
                  value={newCastProtocol}
                  onChange={(e) => setNewCastProtocol(e.target.value)}
                  className="input-field"
                >
                  <option value="chromecast">Chromecast</option>
                  <option value="airplay">AirPlay</option>
                  <option value="upnp">UPnP/DLNA</option>
                  <option value="generic">Generic HTTP</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddCastTarget(false);
                  setNewCastName('');
                  setNewCastHost('');
                  setNewCastPort('8008');
                  setNewCastProtocol('chromecast');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCastTarget}
                disabled={!newCastName.trim() || !newCastHost.trim()}
                className="btn-primary disabled:opacity-50"
              >
                Add Target
              </button>
            </div>
          </motion.div>
        )}

        {castTargets.length > 0 ? (
          <div className="space-y-3">
            {castTargets.map((target) => (
              <motion.div
                key={target.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="surface-card p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      target.is_connected ? 'bg-brand-500/20' : 'bg-surface-3'
                    }`}>
                      <svg className={`w-5 h-5 ${target.is_connected ? 'text-brand-500' : 'text-secondary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-primary">{target.name}</h3>
                      <p className="text-sm text-secondary">{target.host}:{target.port}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      target.is_connected
                        ? 'bg-brand-500/20 text-brand-400'
                        : 'bg-surface-3 text-secondary'
                    )}>
                      {target.is_connected ? 'Connected' : 'Disconnected'}
                    </span>
                    <button
                      onClick={() => handleDeleteCastTarget(target.id)}
                      className="p-1.5 rounded-lg hover:bg-accent-500/10 text-accent-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-tertiary">
                  <span className="capitalize">{target.protocol}</span>
                  <span>Volume: {Math.round(target.volume * 100)}%</span>
                  {target.current_track_id && (
                    <span className="text-brand-400">Playing track</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 surface-card">
            <svg className="w-12 h-12 mx-auto text-tertiary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
            </svg>
            <p className="text-secondary mb-1">No cast targets configured</p>
            <p className="text-xs text-tertiary mb-4">Add a target to stream music to other devices</p>
            <button onClick={() => setShowAddCastTarget(true)} className="btn-primary">
              Add your first target
            </button>
          </div>
        )}
        <p className="text-xs text-tertiary mt-2">
          Cast targets are HTTP endpoints that receive audio stream URLs. They support Chromecast, AirPlay, UPnP, or any custom HTTP receiver.
        </p>
      </section>

      {/* Users */}
      {user?.role === 'admin' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">Users</h2>
            <button
              onClick={() => setShowAddUser(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add User
            </button>
          </div>

          {showAddUser && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface-card p-4 mb-4"
            >
              <h3 className="font-medium text-primary mb-3">Add User</h3>
              {addUserError && (
                <div className="p-3 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-500 text-sm mb-3">
                  {addUserError}
                </div>
              )}
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username"
                className="input-field mb-3"
                autoFocus
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password"
                className="input-field mb-3"
              />
              <div className="mb-3">
                <label className="block text-xs text-secondary mb-1">Role</label>
                <div className="flex gap-2">
                  {['user', 'admin'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setNewUserRole(r)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                        newUserRole === r
                          ? 'bg-brand-600 text-white'
                          : 'bg-surface-2 text-secondary hover:text-primary'
                      )}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowAddUser(false); setNewUsername(''); setNewPassword(''); setAddUserError(''); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={!newUsername.trim() || !newPassword.trim()}
                  className="btn-primary disabled:opacity-50"
                >
                  Add User
                </button>
              </div>
            </motion.div>
          )}

          {usersLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length > 0 ? (
            <div className="space-y-3">
              {users.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="surface-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
                        <span className="text-brand-500 font-medium">
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-primary">{u.username}</p>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          u.role === 'admin' ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-3 text-secondary'
                        )}>
                          {u.role}
                        </span>
                      </div>
                    </div>
                    {u.id !== user?.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 rounded-lg hover:bg-accent-500/10 text-accent-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 surface-card">
              <p className="text-secondary">No users found</p>
            </div>
          )}
        </section>
      )}

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
              <span className="px-2 py-1 bg-brand-500/20 text-brand-400 text-xs rounded-lg font-medium">
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
            {updaterStatus?.update_available && !updaterStatus?.docker_socket && (
              <button
                onClick={handleOpenDownload}
                disabled={updaterDownloading}
                className="btn-primary disabled:opacity-50"
              >
                {updaterDownloading ? 'Opening...' : 'Download Update'}
              </button>
            )}
          </div>

          {updaterMessage && (
            <p className={cn(
              'text-sm',
              updaterMessage.includes('Error') || updaterMessage.includes('failed')
                ? 'text-accent-500'
                : 'text-brand-500'
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

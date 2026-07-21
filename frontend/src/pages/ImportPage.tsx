import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import type { ImportPreview, ImportFormat, ImportConfirmTrack } from '../types';

type Step = 'upload' | 'preview' | 'result';

const platformColors: Record<string, { bg: string; text: string; border: string }> = {
  spotify: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  youtube_music: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  apple_music: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  soundcloud: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  m3u: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  xspf: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
};

const platformIcons: Record<string, React.ReactNode> = {
  spotify: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),
  youtube_music: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
    </svg>
  ),
  apple_music: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.295a9.576 9.576 0 00-1.664-.174C17.373.06 16.703.05 15.013.05H8.987c-1.69 0-2.36.01-3.023.07-.574.05-1.13.143-1.664.364C3.216.757 2.27 1.47 1.54 2.546A5.02 5.02 0 00.7 5.24c-.184.53-.266 1.08-.31 1.65C.346 7.49.335 8.16.335 9.85v4.3c0 1.69.01 2.36.07 3.02.05.57.14 1.13.36 1.66.54 1.29 1.4 2.16 2.68 2.7.51.21 1.05.3 1.62.35.67.06 1.34.07 3.03.07h6.04c1.69 0 2.36-.01 3.02-.07.57-.05 1.13-.14 1.66-.36 1.29-.54 2.16-1.41 2.7-2.7.21-.51.3-1.05.35-1.62.06-.67.07-1.34.07-3.03V9.85c0-1.69-.01-2.36-.07-3.02a5.193 5.193 0 00-.36-1.66l-.003-.006zM16.95 14.53l-.002 3.52c0 .49-.04.97-.15 1.44-.18.77-.63 1.29-1.37 1.53-.42.14-.86.19-1.3.21-.89.04-1.71-.14-2.38-.71a2.514 2.514 0 01-.71-1.61c0-.83.4-1.52 1.02-2 .37-.29.78-.48 1.22-.6.46-.13.93-.22 1.39-.32.32-.07.51-.26.55-.58.01-.06.01-.13.01-.19V11.3c0-.21-.07-.36-.26-.43a3.4 3.4 0 00-.66-.15 8.15 8.15 0 00-.78-.04c-.46 0-.92.03-1.37.13a2.23 2.23 0 00-.78.42c-.26.24-.43.56-.5.92-.06.31-.09.63-.09.96v4.79c0 .49-.04.97-.15 1.44-.18.77-.63 1.29-1.37 1.53-.42.14-.86.19-1.3.21-.89.04-1.71-.14-2.38-.71a2.514 2.514 0 01-.71-1.61c0-.83.4-1.52 1.02-2 .37-.29.78-.48 1.22-.6.46-.13.93-.22 1.39-.32.32-.07.51-.26.55-.58.01-.06.01-.13.01-.19V8.45c0-.76.16-1.48.48-2.14.33-.67.8-1.22 1.42-1.64.62-.42 1.31-.69 2.06-.84.73-.15 1.48-.21 2.22-.24.25-.01.49-.01.74-.01H16.2c.72.01 1.36.06 2 .2.97.2 1.74.73 2.33 1.57.51.73.82 1.56.95 2.46.07.48.09.97.09 1.46l.002 3.52-.62.62z"/>
    </svg>
  ),
  soundcloud: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.057 0 .09-.038.099-.094l.21-1.282-.21-1.332c-.009-.057-.042-.094-.099-.094m1.8-1.32c-.063 0-.105.048-.111.107L1.5 14.479l.465 2.644c.006.06.048.107.111.107.06 0 .102-.048.108-.107l.54-2.644-.54-2.72c-.006-.06-.048-.107-.108-.107m.897-.447c-.072 0-.12.054-.126.12l-.42 3.034.42 2.819c.006.066.054.12.126.12.069 0 .117-.054.123-.12l.48-2.819-.48-3.034c-.006-.066-.054-.12-.123-.12m.918-.282c-.078 0-.132.06-.138.132l-.39 3.316.39 2.694c.006.072.06.132.138.132.075 0 .129-.06.135-.132l.444-2.694-.444-3.316c-.006-.072-.06-.132-.135-.132m.927-.186c-.084 0-.144.066-.15.15l-.36 3.502.36 2.556c.006.084.066.15.15.15.081 0 .141-.066.147-.15l.408-2.556-.408-3.502c-.006-.084-.066-.15-.147-.15m.948-.096c-.093 0-.156.072-.162.168l-.33 3.598.33 2.43c.006.09.069.168.162.168.09 0 .153-.078.159-.168l.372-2.43-.372-3.598c-.006-.096-.069-.168-.159-.168m.942-.03c-.099 0-.168.078-.174.186l-.3 3.628.3 2.304c.006.096.075.186.174.186.096 0 .165-.09.171-.186l.336-2.304-.336-3.628c-.006-.108-.075-.186-.171-.186m1.893-.522c-.036-.006-.072-.006-.108-.006h-.684l.18-3.456c.006-.114.108-.204.222-.204.111 0 .21.09.216.204l.18 3.456h-.666c-.036 0-.072 0-.108.006m.894-.162c-.042-.006-.084-.006-.126-.006h-1.254l.21-3.294c.006-.12.108-.216.228-.216.12 0 .222.096.228.216l.21 3.294h-.612l-.036.006m.912.036c-.048-.006-.096-.006-.144-.006h-1.374l.18-3.33c.009-.126.117-.228.24-.228.123 0 .231.102.24.228l.18 3.33h-.738l-.06.006m.942.012c-.054-.006-.108-.006-.162-.006h-1.434l.216-3.366c.012-.132.126-.234.258-.234.132 0 .246.102.258.234l.216 3.366h-.786l-.066-.006m.948-.024c-.06-.006-.114-.006-.174-.006h-1.464l.186-3.342c.012-.138.132-.246.27-.246.138 0 .258.108.27.246l.186 3.342h-.816l-.066-.006m.966.012c-.066-.006-.126-.006-.192-.006h-1.476l.192-3.354c.012-.144.138-.258.282-.258.144 0 .27.114.282.258l.192 3.354h-.816l-.078-.006m.972-.036c-.072-.006-.138-.006-.21-.006h-1.47l.204-3.318c.012-.15.144-.27.294-.27.15 0 .282.12.294.27l.204 3.318h-.816l-.084-.006m.978.012c-.078-.006-.15-.006-.228-.006h-1.458l.18-3.33c.015-.156.153-.282.306-.282.156 0 .291.126.306.282l.18 3.33h-.798l-.09-.006m1.938.012c-.084-.006-.162-.006-.246-.006h-1.446l.186-3.336c.015-.156.156-.282.312-.282.156 0 .294.126.309.282l.186 3.336h-.81l-.096-.006m.966.012c-.09-.006-.174-.006-.264-.006h-1.422l.18-3.336c.018-.162.162-.294.324-.294.162 0 .306.132.324.294l.18 3.336h-.804l-.096-.006m.984.012c-.096-.006-.186-.006-.282-.006h-1.404l.192-3.348c.018-.168.171-.306.336-.306.168 0 .318.138.336.306l.192 3.348h-.81l-.102-.006m.996.012c-.102-.006-.2-.006-.306-.006h-1.368l.18-3.342c.018-.168.171-.306.342-.306.171 0 .324.138.342.306l.18 3.342h-.786l-.108-.006m1.002.012c-.108-.006-.21-.006-.318-.006h-1.35l.186-3.348c.021-.174.18-.318.354-.318.174 0 .333.144.354.318l.186 3.348h-.774l-.108-.006"/>
    </svg>
  ),
  m3u: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  xspf: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
};

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [formats, setFormats] = useState<ImportFormat[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('spotify');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ playlist_id: string; tracks_added: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    api.import.formats().then((res) => setFormats(res.formats)).catch(() => {});
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!fileContent) {
      setError('Please select a file first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.import.preview(selectedPlatform, fileContent);
      setPreview(res);
      setPlaylistName(res.playlist_name);
      setStep('preview');
    } catch (e: any) {
      setError(e.message || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    try {
      const tracks: ImportConfirmTrack[] = [
        ...preview.matched.map((m) => ({
          title: m.import_track.title,
          artist: m.import_track.artist,
          album: m.import_track.album,
          duration_ms: m.import_track.duration_ms,
          platform_id: m.import_track.platform_id,
          track_id: m.track_id,
        })),
        ...preview.unmatched.map((u) => ({
          title: u.title,
          artist: u.artist,
          album: u.album,
          duration_ms: u.duration_ms,
          platform_id: u.platform_id,
          track_id: undefined as string | undefined,
        })),
      ];
      const res = await api.import.confirm(preview.platform, playlistName, tracks);
      setResult(res);
      setStep('result');
    } catch (e: any) {
      setError(e.message || 'Failed to import');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setFileContent('');
    setFileName('');
    setPreview(null);
    setPlaylistName('');
    setError('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Playlists</h1>
          <p className="text-sm text-tertiary mt-1">Import playlists from Spotify, YouTube Music, Apple Music, SoundCloud, and more</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <div className="w-8 h-px bg-white/10" />}
            <div className={`flex items-center gap-2 ${step === s ? 'text-brand-400' : 'text-tertiary'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'bg-brand-600 text-white' : step === 'result' || (step === 'preview' && s === 'upload') ? 'bg-green-600 text-white' : 'bg-white/10'
              }`}>
                {i + 1}
              </div>
              <span className="capitalize">{s}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Platform selector */}
            <div className="surface-card p-5">
              <h2 className="text-lg font-semibold mb-4">Select Platform</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {formats.map((fmt) => {
                  const colors = platformColors[fmt.id] || platformColors.m3u;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedPlatform(fmt.id)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                        selectedPlatform === fmt.id
                          ? `${colors.border} ${colors.bg} ring-2 ring-offset-0`
                          : 'border-white/10 hover:border-white/20 bg-white/5'
                      }`}
                    >
                      <div className={`flex justify-center mb-2 ${colors.text}`}>
                        {platformIcons[fmt.id]}
                      </div>
                      <div className="text-sm font-medium">{fmt.name}</div>
                    </button>
                  );
                })}
              </div>
              {selectedPlatform && (
                <div className="mt-4 p-3 rounded-lg bg-white/5 text-sm text-tertiary">
                  {formats.find((f) => f.id === selectedPlatform)?.example}
                </div>
              )}
            </div>

            {/* File upload */}
            <div className="surface-card p-5">
              <h2 className="text-lg font-semibold mb-4">Upload File</h2>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                  dragActive ? 'border-brand-500 bg-brand-500/10' : 'border-white/10 hover:border-white/20'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {fileName ? (
                  <div className="space-y-2">
                    <svg className="w-12 h-12 mx-auto text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-tertiary">{(fileContent.length / 1024).toFixed(1)} KB</p>
                    <button
                      onClick={() => { setFileName(''); setFileContent(''); }}
                      className="text-xs text-brand-400 hover:text-brand-300"
                    >
                      Choose different file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg className="w-12 h-12 mx-auto text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-secondary">Drag and drop your playlist file here, or</p>
                    <label className="inline-block">
                      <span className="btn-primary cursor-pointer text-sm px-4 py-2">Browse Files</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".json,.m3u,.m3u8,.xspf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handlePreview}
              disabled={!fileContent || loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Parsing...' : 'Preview Import'}
            </button>
          </motion.div>
        )}

        {step === 'preview' && preview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Summary */}
            <div className="surface-card p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={platformColors[preview.platform]?.bg || 'bg-white/5'}>
                  <div className={platformColors[preview.platform]?.text || 'text-white'}>
                    {platformIcons[preview.platform]}
                  </div>
                </div>
                <div className="flex-1">
                  <input
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    className="input-field w-full text-lg font-semibold"
                    placeholder="Playlist name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-2xl font-bold">{preview.total_tracks}</div>
                  <div className="text-xs text-tertiary">Total Tracks</div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10">
                  <div className="text-2xl font-bold text-green-400">{preview.matched.length}</div>
                  <div className="text-xs text-tertiary">Matched</div>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <div className="text-2xl font-bold text-yellow-400">{preview.unmatched.length}</div>
                  <div className="text-xs text-tertiary">Unmatched</div>
                </div>
              </div>
            </div>

            {/* Matched tracks */}
            {preview.matched.length > 0 && (
              <div className="surface-card p-5">
                <h3 className="text-lg font-semibold mb-3 text-green-400">
                  Matched Tracks ({preview.matched.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                  {preview.matched.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-green-500/5">
                      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.import_track.title}</p>
                        <p className="text-xs text-tertiary truncate">{m.import_track.artist}</p>
                      </div>
                      <span className="text-xs text-tertiary px-2 py-0.5 rounded bg-green-500/10">
                        {m.match_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched tracks */}
            {preview.unmatched.length > 0 && (
              <div className="surface-card p-5">
                <h3 className="text-lg font-semibold mb-3 text-yellow-400">
                  Unmatched Tracks ({preview.unmatched.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                  {preview.unmatched.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-yellow-500/5">
                      <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-tertiary truncate">{t.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={reset} className="btn-secondary flex-1">Back</button>
              <button
                onClick={handleConfirm}
                disabled={loading || preview.matched.length === 0}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {loading ? 'Importing...' : `Import ${preview.matched.length} Tracks`}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'result' && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="surface-card p-8 text-center"
          >
            <svg className="w-16 h-16 mx-auto text-green-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold mb-2">Import Complete</h2>
            <p className="text-tertiary mb-6">
              {result.tracks_added} tracks added to playlist "{playlistName}"
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={reset} className="btn-secondary">Import Another</button>
              <a href="/playlists" className="btn-primary">View Playlists</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import type { Playlist, TransferPlatform } from '../types';

const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1DB954',
  youtube_music: '#FF0000',
  apple_music: '#FC3C44',
  soundcloud: '#FF5500',
  m3u: '#8B5CF6',
  xspf: '#06B6D4',
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  spotify: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  ),
  youtube_music: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" />
    </svg>
  ),
  apple_music: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.2.04a9.576 9.576 0 00-1.92-.04H6.72a9.576 9.576 0 00-1.92.04 5.022 5.022 0 00-2.374.85C1.308 1.623.563 2.622.246 3.934a9.23 9.23 0 00-.24 2.19C0 6.506 0 6.888 0 7.27v9.46c0 .382 0 .764.006 1.146a9.23 9.23 0 00.24 2.19c.317 1.31 1.062 2.31 2.18 3.043a5.022 5.022 0 002.374.85c.64.054 1.28.074 1.92.04h10.56c.64.034 1.28.014 1.92-.04a5.022 5.022 0 002.374-.85c1.118-.733 1.863-1.733 2.18-3.043a9.23 9.23 0 00.24-2.19c.006-.382.006-.764.006-1.146V7.27c0-.382 0-.764-.006-1.146zM17.988 15.76l-.006.028v.014l-3.18 1.836c-.382.222-.7.06-.7-.36V9.722c0-.42.318-.582.7-.36l3.18 1.836c.382.222.382.582.006.804l.006.758z" />
    </svg>
  ),
  soundcloud: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.057-.05-.1-.1-.1zm-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.057.045.094.09.094s.08-.037.09-.094l.21-1.308-.21-1.332c-.01-.057-.04-.094-.09-.094zm1.83-1.229c-.063 0-.109.049-.116.104l-.217 2.546.217 2.455c.007.058.053.104.116.104.064 0 .11-.046.117-.104l.246-2.455-.246-2.546c-.007-.055-.053-.104-.117-.104zm.945-.089c-.07 0-.12.053-.126.112l-.2 2.635.2 2.508c.007.06.056.112.126.112.069 0 .118-.053.125-.112l.228-2.508-.228-2.635c-.007-.059-.056-.112-.125-.112zm.958-.073c-.077 0-.131.058-.137.12l-.187 2.708.187 2.543c.006.065.06.12.137.12.076 0 .13-.055.137-.12l.212-2.543-.212-2.708c-.007-.062-.061-.12-.137-.12zm.968-.059c-.083 0-.14.063-.146.128l-.173 2.767.173 2.564c.006.07.063.128.146.128.082 0 .14-.058.147-.128l.195-2.564-.195-2.767c-.007-.065-.065-.128-.147-.128zm.972-.044c-.09 0-.15.067-.156.135l-.16 2.811.16 2.575c.006.074.066.135.156.135.089 0 .15-.061.157-.135l.18-2.575-.18-2.811c-.007-.068-.068-.135-.157-.135zm.984-.03c-.096 0-.159.072-.165.141l-.146 2.841.146 2.583c.006.079.069.141.165.141.095 0 .158-.062.165-.141l.165-2.583-.165-2.841c-.007-.069-.07-.141-.165-.141zm1.968-.057c-.039 0-.074.01-.104.033-.187.141-.35.287-.513.434l-.037.034-.13 2.816.37 2.509c.006.083.073.148.171.148.099 0 .166-.065.172-.148l.435-2.509-.435-2.816c-.006-.082-.073-.148-.172-.148zm-.978.015c-.103 0-.169.077-.175.148l-.133 2.783.133 2.588c.006.087.072.148.175.148.102 0 .168-.061.175-.148l.151-2.588-.151-2.783c-.007-.071-.073-.148-.175-.148zm1.974-.057c-.048 0-.092.013-.131.038-.212.157-.4.316-.583.478l-.045.039-.117 2.747.4 2.487c.006.09.078.154.183.154.106 0 .18-.064.186-.154l.454-2.487-.454-2.747c-.006-.09-.08-.154-.186-.154zm-.984.029c-.109 0-.179.082-.185.155l-.12 2.718.12 2.592c.006.093.076.155.185.155.108 0 .178-.062.185-.155l.136-2.592-.136-2.718c-.007-.073-.077-.155-.185-.155zm1.98-.044c-.055 0-.106.015-.152.045-.236.174-.444.35-.645.525l-.05.044-.103 2.673.425 2.465c.007.095.083.16.192.16.11 0 .186-.065.193-.16l.478-2.465-.478-2.673c-.007-.094-.083-.16-.193-.16zm-.984.015c-.115 0-.189.086-.195.162l-.107 2.658.107 2.596c.006.098.08.162.195.162.114 0 .188-.064.195-.162l.12-2.596-.12-2.658c-.007-.076-.081-.162-.195-.162zm1.974-.029c-.061 0-.117.018-.168.052-.26.19-.489.383-.706.573l-.054.047-.09 2.612.447 2.44c.008.1.088.167.201.167.114 0 .194-.067.202-.167l.503-2.44-.503-2.612c-.008-.1-.088-.167-.202-.167zm-.984.014c-.12 0-.199.09-.205.168l-.093 2.598.093 2.599c.006.103.085.168.205.168.119 0 .198-.065.205-.168l.105-2.599-.105-2.598c-.007-.078-.086-.168-.205-.168zm2.967-1.043c-.165 0-.315.035-.456.095-.286.121-.533.284-.765.46l-.047.038-.083 2.556.465 2.414c.008.105.092.174.21.174.119 0 .203-.069.211-.174l.52-2.414-.52-2.556c-.008-.104-.092-.174-.211-.174zm-.99.015c-.126 0-.208.094-.214.174l-.08 2.541.08 2.601c.006.108.088.174.214.174.125 0 .207-.066.214-.174l.091-2.601-.091-2.541c-.007-.08-.089-.174-.214-.174zm1.98-.015c-.13 0-.215.098-.22.18l-.067 2.556.067 2.604c.005.112.09.18.22.18.129 0 .214-.068.22-.18l.076-2.604-.076-2.556c-.006-.082-.091-.18-.22-.18zm-.99.015c-.133 0-.221.101-.227.186l-.054 2.541.054 2.605c.006.116.094.186.227.186.132 0 .22-.07.227-.186l.06-2.605-.06-2.541c-.007-.085-.095-.186-.227-.186zm1.986-.029c-.137 0-.226.105-.232.192l-.04 2.57.04 2.608c.006.12.095.192.232.192.136 0 .225-.072.232-.192l.046-2.608-.046-2.57c-.007-.087-.096-.192-.232-.192zm.996-.014c-.14 0-.232.108-.238.198l-.027 2.584.027 2.61c.006.124.098.198.238.198.14 0 .232-.074.238-.198l.03-2.61-.03-2.584c-.006-.09-.098-.198-.238-.198zm.996-.015c-.143 0-.237.112-.243.204l-.014 2.599.014 2.61c.006.128.1.204.243.204.142 0 .236-.076.243-.204l.016-2.61-.016-2.599c-.007-.092-.101-.204-.243-.204z" />
    </svg>
  ),
};

export default function TransferPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [targetPlatform, setTargetPlatform] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.playlists.list()
      .then(setPlaylists)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    if (!selectedPlaylist || !targetPlatform) return;
    setExporting(true);
    try {
      const response = await api.transfer.export(selectedPlaylist, targetPlatform);
      if (!response.ok) {
        const err = await response.json();
        alert(err.error || 'Export failed');
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'playlist';
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const platforms = [
    { id: 'spotify', name: 'Spotify', desc: 'CSV format - import via Spotify web player', color: '#1DB954' },
    { id: 'youtube_music', name: 'YouTube Music', desc: 'Text list - search & add manually', color: '#FF0000' },
    { id: 'apple_music', name: 'Apple Music', desc: 'M3U format - import via iTunes/File menu', color: '#FC3C44' },
    { id: 'soundcloud', name: 'SoundCloud', desc: 'Text list - search & add manually', color: '#FF5500' },
  ];

  const selectedPlaylistData = playlists.find(p => p.id === selectedPlaylist);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-primary">Transfer Playlists</h1>
        <p className="text-sm text-secondary mt-1">
          Export your Resonance playlists to other music platforms
        </p>
      </div>

      {/* Step 1: Select Playlist */}
      <section className="surface-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">1</div>
          <h2 className="text-lg font-semibold text-primary">Select Playlist</h2>
        </div>

        {playlists.length === 0 ? (
          <p className="text-secondary text-sm">No playlists found. Create a playlist first.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => setSelectedPlaylist(playlist.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left',
                  selectedPlaylist === playlist.id
                    ? 'bg-brand-600/20 border border-brand-500/50'
                    : 'bg-surface-2 hover:bg-surface-3 border border-transparent'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary truncate">{playlist.name}</p>
                  <p className="text-xs text-secondary">{playlist.track_count} tracks</p>
                </div>
                {selectedPlaylist === playlist.id && (
                  <svg className="w-5 h-5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 2: Select Target Platform */}
      <section className="surface-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">2</div>
          <h2 className="text-lg font-semibold text-primary">Export To</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => setTargetPlatform(platform.id)}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl transition-all text-left',
                targetPlatform === platform.id
                  ? 'bg-brand-600/20 border border-brand-500/50'
                  : 'bg-surface-2 hover:bg-surface-3 border border-transparent'
              )}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${platform.color}20` }}
              >
                <div style={{ color: platform.color }}>
                  {PLATFORM_ICONS[platform.id]}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-primary">{platform.name}</p>
                <p className="text-xs text-secondary">{platform.desc}</p>
              </div>
              {targetPlatform === platform.id && (
                <svg className="w-5 h-5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Step 3: Export */}
      <section className="surface-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">3</div>
          <h2 className="text-lg font-semibold text-primary">Download</h2>
        </div>

        {selectedPlaylist && targetPlatform ? (
          <div className="space-y-4">
            <div className="bg-surface-2 rounded-xl p-4">
              <p className="text-sm text-secondary">
                Exporting <span className="text-primary font-medium">{selectedPlaylistData?.name}</span> to{' '}
                <span className="text-primary font-medium">{platforms.find(p => p.id === targetPlatform)?.name}</span>
              </p>
              <p className="text-xs text-tertiary mt-1">
                {selectedPlaylistData?.track_count} tracks will be exported
              </p>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Export File
                </>
              )}
            </button>

            <p className="text-xs text-tertiary text-center">
              {targetPlatform === 'spotify' && 'Import the CSV file into Spotify via the web player'}
              {targetPlatform === 'youtube_music' && 'Search and add each track manually in YouTube Music'}
              {targetPlatform === 'apple_music' && 'Import the M3U file via File > Library > Import in iTunes'}
              {targetPlatform === 'soundcloud' && 'Search and add each track manually in SoundCloud'}
            </p>
          </div>
        ) : (
          <p className="text-secondary text-sm">
            {!selectedPlaylist ? 'Select a playlist above to continue' : 'Select a target platform above to continue'}
          </p>
        )}
      </section>
    </div>
  );
}

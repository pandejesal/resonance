import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { formatDuration, getArtworkUrl } from '../lib/utils';
import { usePlayerStore, useLicenseStore } from '../stores';
import { useNavigate } from 'react-router-dom';
import type { Track, DecadeMix, SoundAlikeResult, RediscoverMix } from '../types';

function TrackRow({ track, queue, subtitle }: { track: Track; queue: Track[]; subtitle?: string }) {
  const { playTrack } = usePlayerStore();
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => playTrack(track, queue)}
      className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white/5 transition-colors text-left group"
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
        {track.has_artwork ? (
          <img src={getArtworkUrl(track.id)} alt={track.album} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{track.title}</p>
        <p className="text-xs text-secondary truncate">{subtitle || track.artist}</p>
      </div>
      {track.play_count > 0 && <span className="text-xs text-tertiary">{track.play_count} plays</span>}
      <span className="text-xs text-tertiary">{formatDuration(track.duration_ms)}</span>
    </motion.button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg sm:text-xl font-bold text-primary">{title}</h2>
      {subtitle && <p className="text-xs text-secondary mt-0.5">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="surface-card p-6 text-center text-sm text-secondary">{message}</div>
  );
}

function TeaserCard() {
  const navigate = useNavigate();
  const { status } = useLicenseStore();
  const trialDays = status?.trial_remaining_days ?? 0;

  const features = [
    { title: 'Forgotten Gems', desc: 'Your highest-rated songs you haven\u2019t heard in months' },
    { title: 'Decade Mixes', desc: 'Album journeys through the eras of your library' },
    { title: 'Sound Alikes', desc: 'Find artists that sound like the ones you love' },
    { title: 'Rediscover', desc: 'Revisit the music you loved a while back' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface-card p-6 sm:p-8 text-center"
    >
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-primary mb-1">Resonance Intelligence</h3>
      <p className="text-sm text-secondary max-w-lg mx-auto mb-6">
        Personalized listening intelligence, computed entirely on your device. Your listening
        history never leaves your server.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-6 text-left">
        {features.map((f) => (
          <div key={f.title} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-sm font-semibold text-primary mb-0.5">{f.title}</p>
            <p className="text-xs text-secondary">{f.desc}</p>
          </div>
        ))}
      </div>
      <button onClick={() => navigate('/upgrade')} className="btn-primary text-sm">
        Upgrade to Pro
      </button>
      {trialDays > 0 && (
        <p className="text-xs text-secondary mt-3">
          {trialDays} day{trialDays === 1 ? '' : 's'} of Pro trial remaining
        </p>
      )}
    </motion.div>
  );
}

function SoundAlikeList({ result, onSelect }: { result: SoundAlikeResult; onSelect: (artist: string) => void }) {
  if (result.matches.length === 0) {
    return <EmptyState message={`No similar artists found for ${result.artist}. Add genre, mood, key or BPM metadata to get better matches.`} />;
  }
  const maxScore = Math.max(...result.matches.map((m) => m.score), 1);
  return (
    <div className="space-y-2">
      {result.matches.map((m, i) => (
        <motion.div
          key={m.artist}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
        >
          <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white/30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => onSelect(m.artist)}
                className="text-sm font-medium text-primary truncate hover:text-brand-400 transition-colors"
              >
                {m.artist}
              </button>
              <span className="text-xs font-semibold text-brand-500">{m.score}</span>
            </div>
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden mt-1.5">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(m.score / maxScore) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {m.shared_genres.map((g) => (
                <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400">genre: {g}</span>
              ))}
              {m.shared_moods.map((g) => (
                <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-500/10 text-accent-400">mood: {g}</span>
              ))}
              {m.shared_keys.map((g) => (
                <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">key: {g}</span>
              ))}
              {m.bpm_match && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">bpm match</span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function IntelligencePage() {
  const [gems, setGems] = useState<Track[]>([]);
  const [decades, setDecades] = useState<DecadeMix[]>([]);
  const [rediscover, setRediscover] = useState<RediscoverMix[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [soundAlikes, setSoundAlikes] = useState<SoundAlikeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { hasFeature } = useLicenseStore();
  const hasIntelligence = hasFeature('intelligence');

  const loadSoundAlikes = useCallback((artist: string) => {
    setSelectedArtist(artist);
    api.intelligence.soundAlikes(artist, 10)
      .then(setSoundAlikes)
      .catch(() => setSoundAlikes(null));
  }, []);

  useEffect(() => {
    if (!hasIntelligence) {
      setLoading(false);
      return;
    }
    Promise.all([
      api.intelligence.forgottenGems(20),
      api.intelligence.decadeMixes(20),
      api.intelligence.rediscover(15),
      api.intelligence.suggestedArtists(),
    ])
      .then(([gemsData, decadesData, rediscoverData, artistsData]) => {
        setGems(gemsData.tracks);
        setDecades(decadesData.decades);
        setRediscover(rediscoverData.mixes);
        setSuggested(artistsData.artists);
        if (artistsData.artists.length > 0) {
          loadSoundAlikes(artistsData.artists[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hasIntelligence, loadSoundAlikes]);

  const [activeDecade, setActiveDecade] = useState<string>('');

  useEffect(() => {
    if (decades.length > 0 && !decades.some((d) => d.decade === activeDecade)) {
      setActiveDecade(decades[0].decade);
    }
  }, [decades, activeDecade]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeDecadeData = decades.find((d) => d.decade === activeDecade);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">Resonance Intelligence</h1>
        <p className="text-sm text-secondary mt-1">
          Personalized listening intelligence, computed on your device. Nothing leaves your server.
        </p>
      </div>

      {!hasIntelligence ? (
        <TeaserCard />
      ) : (
        <>
          {/* Forgotten Gems */}
          <section>
            <SectionHeader
              title="Forgotten Gems"
              subtitle="Your highest-rated songs you haven't played in a while"
            />
            {gems.length === 0 ? (
              <EmptyState message="Rate songs with 4+ stars and play them — gems appear here after 60 days of silence." />
            ) : (
              <div className="space-y-1">
                {gems.map((track, i) => (
                  <TrackRow key={track.id} track={track} queue={gems} subtitle={`${track.artist} · ${track.album}`} />
                ))}
              </div>
            )}
          </section>

          {/* Rediscover */}
          {rediscover.length > 0 && (
            <section>
              <SectionHeader
                title="Rediscover"
                subtitle="Music you loved one to twelve months ago"
              />
              <div className="space-y-6">
                {rediscover.map((mix) => (
                  <div key={mix.name}>
                    <h3 className="text-sm font-semibold text-primary mb-2">{mix.name}</h3>
                    <div className="space-y-1">
                      {mix.tracks.map((track) => (
                        <TrackRow key={track.id} track={track} queue={mix.tracks} subtitle={`${track.artist} · ${track.album}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Decade Mixes */}
          {decades.length > 0 && (
            <section>
              <SectionHeader
                title="Decade Mixes"
                subtitle="The albums that defined each era of your library"
              />
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
                {decades.map((d) => (
                  <button
                    key={d.decade}
                    onClick={() => setActiveDecade(d.decade)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                      activeDecade === d.decade
                        ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                        : 'bg-white/5 hover:bg-white/10 text-primary border-white/5'
                    }`}
                  >
                    {d.decade}
                  </button>
                ))}
              </div>
              {activeDecadeData && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {activeDecadeData.albums.map((album, i) => (
                    <motion.div
                      key={`${album.album}-${album.artist}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="group"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-2 album-shadow">
                        {album.has_artwork && album.artwork_track_id ? (
                          <img
                            src={getArtworkUrl(album.artwork_track_id)}
                            alt={album.album}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-brand-600/20 to-surface-2 flex items-center justify-center">
                            <svg className="w-8 h-8 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-primary truncate">{album.album}</p>
                      <p className="text-xs text-secondary truncate">{album.artist}</p>
                      <p className="text-[10px] text-tertiary">
                        {album.track_count} tracks · {album.plays} plays
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Sound Alikes */}
          <section>
            <SectionHeader
              title="Sound Alikes"
              subtitle="Artists that share your favorite artists' sound"
            />
            {suggested.length === 0 ? (
              <EmptyState message="Add genre, mood, key and BPM metadata to enable sound-alike matching." />
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
                  {suggested.map((artist) => (
                    <button
                      key={artist}
                      onClick={() => loadSoundAlikes(artist)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                        selectedArtist === artist
                          ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                          : 'bg-white/5 hover:bg-white/10 text-primary border-white/5'
                      }`}
                    >
                      {artist}
                    </button>
                  ))}
                </div>
                {soundAlikes && (
                  <SoundAlikeList result={soundAlikes} onSelect={loadSoundAlikes} />
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
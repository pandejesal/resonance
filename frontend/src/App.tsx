import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useUIStore, usePlayerStore } from './stores';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MiniPlayer from './components/MiniPlayer';
import NowPlaying from './components/NowPlaying';
import QueuePanel from './components/QueuePanel';
import SearchModal from './components/SearchModal';
import UpdateBanner from './components/UpdateBanner';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import AlbumsPage from './pages/AlbumsPage';
import ArtistsPage from './pages/ArtistsPage';
import GenresPage from './pages/GenresPage';
import FoldersPage from './pages/FoldersPage';
import PlaylistsPage from './pages/PlaylistsPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import PlaylistToolsPage from './pages/PlaylistToolsPage';
import EqualizerPage from './pages/EqualizerPage';
import ImportPage from './pages/ImportPage';

export default function App() {
  const { theme } = useUIStore();
  const { currentTrack } = usePlayerStore();

  useEffect(() => {
    document.documentElement.className = theme === 'dark' ? '' : theme;
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col bg-surface-0 overflow-hidden">
        <UpdateBanner />

        <div className="flex flex-1 min-h-0">
          <Sidebar />

          <div className="flex-1 flex flex-col min-h-0 lg:ml-64">
            <Header />

            <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-screen-2xl mx-auto w-full">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/albums" element={<AlbumsPage />} />
                <Route path="/artists" element={<ArtistsPage />} />
                <Route path="/genres" element={<GenresPage />} />
                <Route path="/folders" element={<FoldersPage />} />
                <Route path="/playlists" element={<PlaylistsPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/tools" element={<PlaylistToolsPage />} />
                <Route path="/equalizer" element={<EqualizerPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </div>

        {currentTrack && <MiniPlayer />}
        <NowPlaying />
        <QueuePanel />
        <SearchModal />
      </div>
    </BrowserRouter>
  );
}

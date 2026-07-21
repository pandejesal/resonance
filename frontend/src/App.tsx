import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useUIStore } from './stores';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MiniPlayer from './components/MiniPlayer';
import NowPlaying from './components/NowPlaying';
import QueuePanel from './components/QueuePanel';
import SearchModal from './components/SearchModal';
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
import { cn } from './lib/utils';

export default function App() {
  const { theme } = useUIStore();

  useEffect(() => {
    document.documentElement.className = theme === 'dark' ? '' : theme;
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-0">
        <Sidebar />

        <div className="lg:ml-64 min-h-screen pb-20">
          <Header />

          <main className="p-4 md:p-6 max-w-screen-2xl mx-auto">
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
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>

        <MiniPlayer />
        <NowPlaying />
        <QueuePanel />
        <SearchModal />
      </div>
    </BrowserRouter>
  );
}

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore, usePlayerStore, useAuthStore } from './stores';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MiniPlayer from './components/MiniPlayer';
import NowPlaying from './components/NowPlaying';
import QueuePanel from './components/QueuePanel';
import SearchModal from './components/SearchModal';
import UpdateBanner from './components/UpdateBanner';
import MobileBottomNav from './components/MobileBottomNav';
import LoginPage from './pages/LoginPage';
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
import TransferPage from './pages/TransferPage';
import ImportPage from './pages/ImportPage';

function BackButtonHandler() {
  const navigate = useNavigate();
  const { nowPlayingOpen, toggleNowPlaying } = useUIStore();

  useEffect(() => {
    window.history.pushState({ page: 'resonance' }, '', window.location.href);

    const handlePopState = () => {
      if (nowPlayingOpen) {
        toggleNowPlaying();
      } else {
        window.history.pushState({ page: 'resonance' }, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [nowPlayingOpen, toggleNowPlaying, navigate]);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  const { playTrack } = usePlayerStore();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15, ease: 'easeInOut' }}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 max-w-screen-2xl mx-auto w-full pb-32 lg:pb-6"
      >
        <Routes location={location}>
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
          <Route path="/transfer" element={<TransferPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const { theme } = useUIStore();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    document.documentElement.className = theme === 'dark' ? '' : theme;
  }, [theme]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-0">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <BackButtonHandler />
      <div className="h-screen flex flex-col bg-surface-0 overflow-hidden">
        <UpdateBanner />

        <div className="flex flex-1 min-h-0">
          <Sidebar />

          <div className="flex-1 flex flex-col min-h-0 lg:ml-64">
            <Header />
            <AnimatedRoutes />
          </div>
        </div>

        <MiniPlayer />
        <MobileBottomNav />
        <NowPlaying />
        <QueuePanel />
        <SearchModal />
      </div>
    </BrowserRouter>
  );
}

import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore, useAuthStore, useLicenseStore } from './stores';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MiniPlayer from './components/MiniPlayer';
import NowPlaying from './components/NowPlaying';
import QueuePanel from './components/QueuePanel';
import SearchModal from './components/SearchModal';
import KeyboardShortcutsOverlay from './components/KeyboardShortcutsOverlay';
import ToastContainer from './components/Toast';
import UpdateBanner from './components/UpdateBanner';
import ErrorBoundary from './components/ErrorBoundary';
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
import HistoryPage from './pages/HistoryPage';
import UpgradePage from './pages/UpgradePage';
import IntelligencePage from './pages/IntelligencePage';

function BackButtonHandler() {
  const navigate = useNavigate();
  const nowPlayingOpenRef = useRef(false);
  const { nowPlayingOpen, toggleNowPlaying } = useUIStore();

  useEffect(() => {
    nowPlayingOpenRef.current = nowPlayingOpen;
  }, [nowPlayingOpen]);

  useEffect(() => {
    (window as any).__androidBack = () => {
      const ui = useUIStore.getState();
      if (ui.nowPlayingOpen) {
        ui.toggleNowPlaying();
        return 'handled';
      }
      if (ui.queueOpen) {
        ui.toggleQueue();
        return 'handled';
      }
      if (ui.searchOpen) {
        ui.toggleSearch();
        return 'handled';
      }
      if (ui.moreOpen) {
        ui.toggleMore();
        return 'handled';
      }
      const idx = (window.history.state as any)?.idx ?? 0;
      if (idx > 0) {
        navigate(-1);
        return 'handled';
      }
      return 'unhandled';
    };

    return () => {
      delete (window as any).__androidBack;
    };
  }, [navigate, toggleNowPlaying]);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

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
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/upgrade" element={<UpgradePage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const { theme } = useUIStore();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { fetchStatus } = useLicenseStore();

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
    }
  }, [isAuthenticated, fetchStatus]);

  useKeyboardShortcuts();

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
      <ErrorBoundary>
        <div className="h-screen bg-surface-0 overflow-hidden relative">
          <UpdateBanner />

          <div className="flex h-full">
            <Sidebar />

            <div className="flex-1 flex flex-col min-h-0 min-w-0 lg:ml-64">
              <Header />
              <AnimatedRoutes />
            </div>
          </div>

        <MobileBottomNav />
        <MiniPlayer />
        <NowPlaying />
        <QueuePanel />
        <SearchModal />
        <KeyboardShortcutsOverlay />
        <ToastContainer />
      </div>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../stores';
import { cn } from '../lib/utils';

export default function Header() {
  const { toggleSidebar, toggleSearch, sidebarOpen } = useUIStore();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-20 bg-surface-0/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-xl hover:bg-white/[0.06] transition-all duration-200 active:scale-95"
          aria-label="Open navigation menu"
        >
          <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Search */}
        <button
          onClick={toggleSearch}
          className="search-bar-premium flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-secondary hover:text-primary transition-all duration-300 flex-1 max-w-md group"
          aria-label="Open search"
        >
          <svg className="w-4 h-4 text-tertiary group-hover:text-brand-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm text-tertiary group-hover:text-secondary transition-colors">Search your library...</span>
          <kbd className="hidden sm:flex ml-auto items-center gap-0.5 text-[10px] text-tertiary/70 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] font-mono">
            <span className="text-[11px]">{isMac ? '⌘' : 'Ctrl'}</span>K
          </kbd>
        </button>

        {/* Right side actions */}
        <div className="flex items-center gap-1">
          {/* Settings */}
          <Link
            to="/settings"
            className="p-2.5 rounded-xl hover:bg-white/[0.06] transition-all duration-200 text-secondary hover:text-primary active:scale-95"
            aria-label="Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}

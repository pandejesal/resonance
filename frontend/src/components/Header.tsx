import React from 'react';
import { useUIStore } from '../stores';
import { cn } from '../lib/utils';

export default function Header() {
  const { toggleSidebar, toggleSearch, sidebarOpen } = useUIStore();

  return (
    <header className="sticky top-0 z-20 glass border-b border-white/5">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Search */}
        <button
          onClick={toggleSearch}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-1 border border-white/5 text-secondary hover:text-primary hover:border-white/10 transition-all flex-1 max-w-md"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm">Search your library...</span>
          <kbd className="hidden sm:block ml-auto text-xs text-tertiary px-1.5 py-0.5 rounded bg-white/5">
            ⌘K
          </kbd>
        </button>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Settings */}
          <a
            href="/settings"
            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-secondary hover:text-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}

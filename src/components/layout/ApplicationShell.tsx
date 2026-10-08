import React, { useState } from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { Header } from './Header';

interface ApplicationShellProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingFollowUpsCount?: number;
  children: React.ReactNode;
  onGlobalSearch: (term: string) => void;
  onQuickAction: (action: 'company' | 'contact' | 'lead' | 'followup') => void;
  onSeedData: () => void;
  isSeeding: boolean;
}

export function ApplicationShell({
  currentTab,
  onSelectTab,
  pendingFollowUpsCount = 0,
  children,
  onGlobalSearch,
  onQuickAction,
  onSeedData,
  isSeeding,
}: ApplicationShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100/70 flex text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        pendingFollowUpsCount={pendingFollowUpsCount}
        isOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        <Header
          currentTab={currentTab}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          onGlobalSearch={onGlobalSearch}
          onQuickAction={onQuickAction}
          onSeedData={onSeedData}
          isSeeding={isSeeding}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

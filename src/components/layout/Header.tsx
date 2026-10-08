import React, { useState } from 'react';
import { Menu, Plus, Search, Database, ChevronDown } from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileMenu: () => void;
  onGlobalSearch: (term: string) => void;
  onQuickAction: (action: 'company' | 'contact' | 'lead' | 'followup') => void;
  onSeedData: () => void;
  isSeeding: boolean;
}

export function Header({
  currentTab,
  onOpenMobileMenu,
  onGlobalSearch,
  onQuickAction,
  onSeedData,
  isSeeding,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Executive CRM Dashboard', subtitle: 'Real-time database analytics & key operational metrics' },
    companies: { title: 'Companies Directory', subtitle: 'Manage authorized B2B organizations and accounts' },
    contacts: { title: 'Contacts & Decision Makers', subtitle: 'Verified business emails, phones and outreach status' },
    leads: { title: 'Leads & Deal Pipeline', subtitle: '10-stage sales progression from research to win' },
    products: { title: 'YALIX Product Master', subtitle: 'Catalog of powders, seeds, leaves, and minerals' },
    import: { title: 'Excel / CSV Import Engine', subtitle: 'Multi-stage parser, normalization & duplicate detection' },
    followups: { title: 'Scheduled Follow-ups', subtitle: 'Track overdue, today, and upcoming touchpoints' },
    templates: { title: 'HTML Email Templates', subtitle: 'Compliant B2B templates with personalized merge tags' },
    campaigns: { title: 'Campaigns & Dispatch Queue', subtitle: 'Safe server-side batching with suppression enforcement' },
    reports: { title: 'Business Reports & Intelligence', subtitle: 'Country distribution, bounce rates & conversion analytics' },
    settings: { title: 'Security & Audit Logs', subtitle: 'Tamper-evident activity logs & access permissions' },
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onGlobalSearch(e.target.value);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
            {titles[currentTab]?.title || 'YALIX CRM'}
          </h1>
          <span className="hidden sm:inline text-[11px] text-slate-500 font-normal">
            {titles[currentTab]?.subtitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Quick Search */}
        <div className="hidden md:flex items-center relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search CRM..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Firestore Status / Seed Data helper */}
        <button
          onClick={onSeedData}
          disabled={isSeeding}
          title="Seed or verify YALIX product catalog & sample records in Firestore"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors"
        >
          <Database className={`w-3.5 h-3.5 text-emerald-600 ${isSeeding ? 'animate-pulse' : ''}`} />
          <span>{isSeeding ? 'Syncing...' : 'Sync Products'}</span>
        </button>

        {/* Quick Add Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-700/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden xs:inline">New Record</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-40 text-xs text-slate-700 animate-in fade-in zoom-in-95">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onQuickAction('company');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-medium flex items-center justify-between"
                >
                  <span>+ Add Company</span>
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onQuickAction('contact');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-medium flex items-center justify-between"
                >
                  <span>+ Add Contact</span>
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onQuickAction('lead');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-medium flex items-center justify-between"
                >
                  <span>+ Add Pipeline Lead</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onQuickAction('followup');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-medium flex items-center justify-between"
                >
                  <span>+ Schedule Follow-up</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

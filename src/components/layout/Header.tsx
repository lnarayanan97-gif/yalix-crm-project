import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Plus,
  Search,
  Database,
  ChevronDown,
  Building2,
  User,
  TrendingUp,
  X,
  ExternalLink,
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { Company, Contact, Lead } from '../../types/crm';
import { Badge } from '../common/Badge';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileMenu: () => void;
  onGlobalSearch: (term: string) => void;
  onQuickAction: (action: 'company' | 'contact' | 'lead' | 'followup') => void;
  onSeedData: () => void;
  isSeeding: boolean;
  companies?: Company[];
  contacts?: Contact[];
  leads?: Lead[];
  onSelectCompany?: (companyId: string) => void;
  onSelectContact?: (contactId: string) => void;
  onSelectTab?: (tab: NavTab) => void;
}

export function Header({
  currentTab,
  onOpenMobileMenu,
  onGlobalSearch,
  onQuickAction,
  onSeedData,
  isSeeding,
  companies = [],
  contacts = [],
  leads = [],
  onSelectCompany,
  onSelectContact,
  onSelectTab,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    onGlobalSearch(term);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    onGlobalSearch('');
  };

  // Calculate matching records across real database state
  const cleanQuery = searchTerm.trim().toLowerCase();

  const matchingCompanies = cleanQuery
    ? companies.filter((c) => {
        const text = [
          c.companyName,
          c.website,
          c.country,
          c.city,
          c.state,
          c.industry,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(cleanQuery);
      }).slice(0, 5)
    : [];

  const matchingContacts = cleanQuery
    ? contacts.filter((cnt) => {
        const text = [
          cnt.firstName,
          cnt.lastName,
          cnt.businessEmail,
          cnt.secondaryEmail,
          cnt.companyName,
          cnt.phone,
          cnt.jobTitle,
          cnt.country,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(cleanQuery);
      }).slice(0, 5)
    : [];

  const matchingLeads = cleanQuery
    ? leads.filter((l) => {
        const text = [
          l.companyName,
          l.contactName,
          l.contactEmail,
          l.productInterest,
          l.leadStatus,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(cleanQuery);
      }).slice(0, 3)
    : [];

  const totalResults =
    matchingCompanies.length + matchingContacts.length + matchingLeads.length;

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
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
        {/* Real Global CRM Search Bar with interactive dropdown */}
        <div ref={searchRef} className="relative w-64 md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search organizations, emails, domains..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Search Results Dropdown Overlay */}
          {searchFocused && searchTerm.trim().length >= 2 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-200/90 py-2 z-50 text-xs max-h-96 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100">
                <span>Database Query Results ({totalResults})</span>
                <span className="text-slate-400 font-normal lowercase">exact & prefix matching</span>
              </div>

              {totalResults === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  <p className="text-xs">No records matched "{searchTerm}"</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Searched companies, contacts, emails, and pipeline leads.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Companies results */}
                  {matchingCompanies.length > 0 && (
                    <div className="p-2 space-y-1">
                      <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" /> Companies
                      </span>
                      {matchingCompanies.map((c) => (
                        <button
                          key={c.companyId}
                          onClick={() => {
                            if (onSelectCompany) onSelectCompany(c.companyId);
                            if (onSelectTab) onSelectTab('companies');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 rounded-lg flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-emerald-700">
                              {c.companyName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {[c.industry, c.country].filter(Boolean).join(' • ') || c.website || 'Organization'}
                            </div>
                          </div>
                          <Badge variant="default">View Profile</Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Contacts results */}
                  {matchingContacts.length > 0 && (
                    <div className="p-2 space-y-1">
                      <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" /> Contacts
                      </span>
                      {matchingContacts.map((cnt) => (
                        <button
                          key={cnt.contactId}
                          onClick={() => {
                            if (onSelectContact) onSelectContact(cnt.contactId);
                            if (onSelectTab) onSelectTab('contacts');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 rounded-lg flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-emerald-700">
                              {cnt.firstName} {cnt.lastName || ''}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {cnt.businessEmail} {cnt.companyName ? `• ${cnt.companyName}` : ''}
                            </div>
                          </div>
                          <Badge variant={cnt.emailStatus === 'VALID' ? 'success' : 'default'}>
                            {cnt.emailStatus}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Leads results */}
                  {matchingLeads.length > 0 && (
                    <div className="p-2 space-y-1">
                      <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-slate-400" /> Pipeline Leads
                      </span>
                      {matchingLeads.map((l) => (
                        <button
                          key={l.leadId}
                          onClick={() => {
                            if (onSelectTab) onSelectTab('leads');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 rounded-lg flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-emerald-700">
                              {l.companyName || l.contactName || l.leadId}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {l.productInterest ? `Product: ${l.productInterest}` : 'Pipeline item'}
                            </div>
                          </div>
                          <Badge variant="warning">{l.leadStatus}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Firestore Status / Seed Data helper */}
        <button
          onClick={onSeedData}
          disabled={isSeeding}
          title="Seed or verify YALIX product catalog & sample records in Firestore"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors cursor-pointer"
        >
          <Database className={`w-3.5 h-3.5 text-emerald-600 ${isSeeding ? 'animate-pulse' : ''}`} />
          <span>{isSeeding ? 'Syncing...' : 'Sync Products'}</span>
        </button>

        {/* Quick Add Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-700/20 transition-colors cursor-pointer"
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
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>+ Add Company</span>
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onQuickAction('contact');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>+ Add Contact</span>
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onQuickAction('lead');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>+ Add Pipeline Lead</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onQuickAction('followup');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 transition-colors font-medium flex items-center justify-between cursor-pointer"
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

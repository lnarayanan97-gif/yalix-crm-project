import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  Package,
  FileSpreadsheet,
  CalendarClock,
  Mail,
  Send,
  BarChart3,
  ShieldCheck,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'companies'
  | 'contacts'
  | 'leads'
  | 'products'
  | 'import'
  | 'followups'
  | 'templates'
  | 'campaigns'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingFollowUpsCount?: number;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  pendingFollowUpsCount = 0,
  isOpen,
  onCloseMobile,
}: SidebarProps) {
  const { currentUser, userProfile, isAdmin, signOut } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.ElementType; badge?: number | string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'leads', label: 'Leads Pipeline', icon: Target },
    { id: 'products', label: 'Product Master', icon: Package },
    { id: 'import', label: 'Excel / CSV Import', icon: FileSpreadsheet },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: CalendarClock,
      badge: pendingFollowUpsCount > 0 ? pendingFollowUpsCount : undefined,
    },
    { id: 'templates', label: 'Email Templates', icon: Mail },
    { id: 'campaigns', label: 'Campaigns & Queue', icon: Send },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Security & Audit', icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-emerald-900/40 tracking-wider">
              Y
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-base tracking-tight leading-none flex items-center gap-1.5">
                YALIX <span className="text-emerald-400 font-semibold text-xs tracking-widest">CRM</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-1 uppercase">
                Private B2B Database
              </span>
            </div>
          </div>
        </div>

        {/* Private Badge */}
        <div className="px-4 pt-3 pb-1">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2 text-[11px] text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium truncate">Internal YALIX System</span>
          </div>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            CRM Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      active
                        ? 'bg-emerald-700 text-emerald-100'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User profile & Sign out */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/30">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {(currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate leading-none">
                  {currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'User')}
                </span>
                <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  {isAdmin ? 'ADMIN' : userProfile?.role || 'MEMBER'}
                </span>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign Out of YALIX CRM"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

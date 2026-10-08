import React from 'react';
import {
  Building2,
  Users,
  MailCheck,
  Target,
  Sparkles,
  Send,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
} from 'lucide-react';
import { DashboardStats, Company, Contact, Lead, FollowUp } from '../../types/crm';
import { NavTab } from '../layout/Sidebar';
import { Badge } from '../common/Badge';

interface DashboardViewProps {
  stats: DashboardStats;
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  followUps: FollowUp[];
  onNavigate: (tab: NavTab) => void;
  onOpenQuickAction: (action: 'company' | 'contact' | 'lead' | 'followup') => void;
}

export function DashboardView({
  stats,
  companies,
  contacts,
  leads,
  followUps,
  onNavigate,
  onOpenQuickAction,
}: DashboardViewProps) {
  const statCards = [
    {
      label: 'Total Companies',
      value: stats.totalCompanies,
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      tab: 'companies' as NavTab,
    },
    {
      label: 'Total Contacts',
      value: stats.totalContacts,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      tab: 'contacts' as NavTab,
    },
    {
      label: 'Valid Emails',
      value: stats.validEmails,
      icon: MailCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      tab: 'contacts' as NavTab,
    },
    {
      label: 'New Leads',
      value: stats.newLeads,
      icon: Target,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      tab: 'leads' as NavTab,
    },
    {
      label: 'Interested Leads',
      value: stats.interestedLeads,
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      tab: 'leads' as NavTab,
    },
    {
      label: 'Active Campaigns',
      value: stats.activeCampaigns,
      icon: Send,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      border: 'border-teal-100',
      tab: 'campaigns' as NavTab,
    },
    {
      label: "Today's Follow-ups",
      value: stats.todayFollowUps,
      icon: Calendar,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      border: 'border-sky-100',
      tab: 'followups' as NavTab,
      highlight: stats.todayFollowUps > 0,
    },
    {
      label: 'Overdue Follow-ups',
      value: stats.overdueFollowUps,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      tab: 'followups' as NavTab,
      alert: stats.overdueFollowUps > 0,
    },
    {
      label: 'Total Imports',
      value: stats.recentImportsCount,
      icon: FileSpreadsheet,
      color: 'text-slate-600',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      tab: 'import' as NavTab,
    },
    {
      label: 'Total Campaigns',
      value: stats.recentCampaignsCount,
      icon: Sparkles,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      border: 'border-cyan-100',
      tab: 'campaigns' as NavTab,
    },
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingUrgentFollowUps = followUps.filter(
    (f) => f.status === 'PENDING' && (f.dueDate <= todayStr)
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-medium mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            YALIX Private Intelligence Platform
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Welcome to YALIX B2B CRM
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            Manage your permanent proprietary B2B buyer database, import daily spreadsheets, progress leads through the 10-stage pipeline, and run compliant campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenQuickAction('lead')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-950/40 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Target className="w-3.5 h-3.5" />
            <span>+ New Lead</span>
          </button>
          <button
            onClick={() => onNavigate('import')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
            <span>Import Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* 10 Core Required Dashboard Statistics Cards */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Key Performance Indicators
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigate(card.tab)}
                className={`bg-white rounded-xl p-4 border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
                  card.alert
                    ? 'border-rose-300 ring-2 ring-rose-500/10 bg-rose-50/30'
                    : card.highlight
                    ? 'border-emerald-300 ring-2 ring-emerald-500/10 bg-emerald-50/20'
                    : 'border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500 truncate max-w-[120px]">
                    {card.label}
                  </span>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.border} border flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className={`text-2xl font-extrabold tracking-tight ${card.alert ? 'text-rose-700' : 'text-slate-900'}`}>
                    {card.value}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5 font-medium group-hover:text-emerald-600">
                    View <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Grid: Urgent Follow-ups & Recent Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Follow-ups Widget */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Action Required: Today & Overdue Follow-ups
              </h3>
            </div>
            <button
              onClick={() => onNavigate('followups')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              View All ({followUps.length})
            </button>
          </div>

          <div className="flex-1 space-y-2.5">
            {pendingUrgentFollowUps.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
                🎉 No overdue or pending follow-ups for today. Great job!
              </div>
            ) : (
              pendingUrgentFollowUps.slice(0, 5).map((fu) => {
                const isOverdue = fu.dueDate < todayStr;
                return (
                  <div
                    key={fu.id}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-colors ${
                      isOverdue
                        ? 'bg-rose-50/40 border-rose-200/70 text-rose-950'
                        : 'bg-amber-50/40 border-amber-200/70 text-amber-950'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate">
                          {fu.title}
                        </span>
                        <Badge variant={isOverdue ? 'danger' : 'warning'}>
                          {isOverdue ? 'OVERDUE' : 'TODAY'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        {fu.companyName && <span>🏢 {fu.companyName}</span>}
                        {fu.contactName && <span>👤 {fu.contactName}</span>}
                        <span>📅 Due: {fu.dueDate}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('followups')}
                      className="px-2.5 py-1 text-[11px] font-medium bg-white rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
                    >
                      Handle
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pipeline & Recent Leads */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                <Target className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Recent Pipeline Leads</h3>
            </div>
            <button
              onClick={() => onNavigate('leads')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              Pipeline View ({leads.length})
            </button>
          </div>

          <div className="flex-1 space-y-2.5">
            {leads.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
                No leads created yet. Click "+ New Lead" or import a file to start tracking.
              </div>
            ) : (
              leads.slice(0, 5).map((lead) => {
                const statusColors: Record<string, 'default' | 'success' | 'warning' | 'info' | 'purple'> = {
                  NEW: 'info',
                  RESEARCHED: 'default',
                  CONTACTED: 'warning',
                  REPLIED: 'purple',
                  INTERESTED: 'success',
                  QUOTATION: 'warning',
                  NEGOTIATION: 'purple',
                  WON: 'success',
                  LOST: 'default',
                  NOT_INTERESTED: 'default',
                };
                return (
                  <div
                    key={lead.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {lead.companyName || lead.contactName || lead.leadId}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 truncate">
                        {lead.productInterest && (
                          <span className="font-medium text-emerald-700">
                            📦 {lead.productInterest}
                          </span>
                        )}
                        {lead.contactName && <span>• {lead.contactName}</span>}
                      </div>
                    </div>
                    <Badge variant={statusColors[lead.leadStatus] || 'default'}>
                      {lead.leadStatus}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

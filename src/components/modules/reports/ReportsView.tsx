import React from 'react';
import { BarChart3, Globe, PieChart, Users, Package, Target, Calendar, CheckCircle2 } from 'lucide-react';
import { Company, Contact, Lead, Product, FollowUp, DashboardStats } from '../../../types/crm';

interface ReportsViewProps {
  stats: DashboardStats;
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  products: Product[];
  followUps: FollowUp[];
}

export function ReportsView({
  stats,
  companies,
  contacts,
  leads,
  products,
  followUps,
}: ReportsViewProps) {
  // Compute Country Distribution
  const countryCounts: Record<string, number> = {};
  companies.forEach((c) => {
    const country = c.country?.trim() || 'Unspecified';
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  });
  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

  // Compute Product Interest Distribution
  const productCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const prod = l.productInterest?.trim() || 'General';
    productCounts[prod] = (productCounts[prod] || 0) + 1;
  });
  const sortedProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]);

  // Compute Lead Status Breakdown
  const statusCounts: Record<string, number> = {};
  leads.forEach((l) => {
    statusCounts[l.leadStatus] = (statusCounts[l.leadStatus] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Database Size</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.totalCompanies + stats.totalContacts}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {stats.totalCompanies} companies • {stats.totalContacts} contacts
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Email Deliverability Ratio</span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
            {contacts.length > 0
              ? `${Math.round((stats.validEmails / contacts.length) * 100)}%`
              : '100%'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {stats.validEmails} verified addresses
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Active Pipeline Deals</span>
          <span className="text-2xl font-extrabold text-indigo-600 mt-1 block">
            {leads.length}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {stats.interestedLeads} high-intent stages
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Follow-up On-Time Rate</span>
          <span className="text-2xl font-extrabold text-amber-600 mt-1 block">
            {followUps.length > 0
              ? `${Math.round(
                  ((followUps.length - stats.overdueFollowUps) / followUps.length) * 100
                )}%`
              : '100%'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {stats.overdueFollowUps} overdue tasks
          </span>
        </div>
      </div>

      {/* Two Column Visual Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Country Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Geographic Buyer Distribution</h3>
          </div>

          <div className="space-y-3">
            {sortedCountries.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No company records yet.</p>
            ) : (
              sortedCountries.slice(0, 7).map(([country, count]) => {
                const percent = Math.round((count / companies.length) * 100) || 0;
                return (
                  <div key={country} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800">{country}</span>
                      <span className="text-slate-500 font-semibold">
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Product Demand Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Product Inquiries & Demand</h3>
          </div>

          <div className="space-y-3">
            {sortedProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No product leads tracked yet.</p>
            ) : (
              sortedProducts.slice(0, 7).map(([prod, count]) => {
                const percent = Math.round((count / (leads.length || 1)) * 100) || 0;
                return (
                  <div key={prod} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800">{prod}</span>
                      <span className="text-slate-500 font-semibold">
                        {count} leads ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
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

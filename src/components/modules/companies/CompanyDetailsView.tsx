import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  Linkedin,
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  User,
  Users,
  Briefcase,
  FileText,
  Activity as ActivityIcon,
  CheckCircle,
} from 'lucide-react';
import { Company, Contact, Activity } from '../../../types/crm';
import { Badge } from '../../common/Badge';
import { crmService } from '../../../services/crmService';
import { useAuth } from '../../../context/AuthContext';

interface CompanyDetailsViewProps {
  company: Company;
  relatedContacts: Contact[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectContact: (contactId: string) => void;
  onAddContact: () => void;
}

export function CompanyDetailsView({
  company,
  relatedContacts,
  onBack,
  onEdit,
  onDelete,
  onSelectContact,
  onAddContact,
}: CompanyDetailsViewProps) {
  const { isAdmin } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadActivities() {
      if (!company.companyId) return;
      setLoadingActivities(true);
      try {
        const list = await crmService.getActivitiesForTarget('companyId', company.companyId);
        if (isMounted) {
          setActivities(list || []);
        }
      } catch (err) {
        console.warn('Failed to load company activities:', err);
      } finally {
        if (isMounted) setLoadingActivities(false);
      }
    }
    loadActivities();
    return () => {
      isMounted = false;
    };
  }, [company.companyId]);

  const cleanWebsite = company.website
    ? company.website.startsWith('http')
      ? company.website
      : `https://${company.website}`
    : '';

  const cleanDomain = company.website
    ? company.website.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
    : '';

  const cleanLinkedin = company.linkedinUrl
    ? company.linkedinUrl.startsWith('http')
      ? company.linkedinUrl
      : `https://${company.linkedinUrl}`
    : '';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Return to companies list"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Companies</span>
          </button>
          <span className="text-slate-300 font-light text-lg">/</span>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              {company.companyName}
            </h1>
            <Badge variant={company.status === 'ACTIVE_PROSPECT' ? 'success' : 'default'}>
              {company.status || 'Active'}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onAddContact}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Contact</span>
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Profile</span>
          </button>
          {isAdmin && (
            <button
              onClick={onDelete}
              className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-medium text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Details Overview + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Company Data & Related Contacts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Primary Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  <Building2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {company.companyName}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span>ID: {company.companyId}</span>
                    {company.industry && (
                      <>
                        <span>•</span>
                        <span className="font-medium text-slate-700">{company.industry}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Field Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Website / Domain
                </span>
                {cleanWebsite ? (
                  <a
                    href={cleanWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>{cleanDomain}</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Headquarters & Location
                </span>
                <span className="text-slate-700 font-medium">
                  {[company.address, company.city, company.state, company.country]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  Industry Sector
                </span>
                <span className="text-slate-700 font-medium">
                  {company.industry || '—'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Company Size / Revenue
                </span>
                <span className="text-slate-700 font-medium">
                  {company.companySize ? `${company.companySize} employees` : '—'}
                  {company.revenue ? ` • ${company.revenue}` : ''}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Linkedin className="w-3.5 h-3.5 text-slate-400" />
                  LinkedIn Profile
                </span>
                {cleanLinkedin ? (
                  <a
                    href={cleanLinkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Company Page</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Source & Acquisition
                </span>
                <span className="text-slate-700 font-medium">
                  {company.source || 'Direct Entry'}
                  {company.sourceDate ? ` (${company.sourceDate})` : ''}
                </span>
              </div>
            </div>

            {/* Notes Section */}
            {company.notes && (
              <div className="pt-4 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Account Notes & Intelligence
                </span>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {company.notes}
                </div>
              </div>
            )}
          </div>

          {/* Related Contacts Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Linked Decision Makers & Contacts ({relatedContacts.length})
                </h3>
              </div>
              <button
                onClick={onAddContact}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Add Contact</span>
              </button>
            </div>

            {relatedContacts.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600 mb-1">
                  No contacts linked to this company yet.
                </p>
                <p className="text-[11px] text-slate-400 mb-3">
                  Add verified decision makers, emails, and phone numbers.
                </p>
                <button
                  onClick={onAddContact}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>+ Link New Contact</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-medium">
                      <th className="py-2 pr-4">Contact</th>
                      <th className="py-2 pr-4">Role & Dept</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2 pr-4">Email Status</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relatedContacts.map((cnt) => (
                      <tr key={cnt.contactId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 pr-4 font-semibold text-slate-900">
                          <button
                            onClick={() => onSelectContact(cnt.contactId)}
                            className="text-left hover:text-emerald-700 transition-colors font-semibold"
                          >
                            {cnt.firstName} {cnt.lastName || ''}
                          </button>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600">
                          {cnt.jobTitle || '—'}
                          {cnt.department ? ` (${cnt.department})` : ''}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-700">
                          <a
                            href={`mailto:${cnt.businessEmail}`}
                            className="text-emerald-700 hover:underline flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{cnt.businessEmail}</span>
                          </a>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600">
                          {cnt.phone || cnt.mobile || '—'}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant={
                              cnt.emailStatus === 'VALID'
                                ? 'success'
                                : cnt.emailStatus === 'INVALID' || cnt.emailStatus === 'BOUNCED'
                                ? 'danger'
                                : cnt.emailStatus === 'RISKY'
                                ? 'warning'
                                : 'default'
                            }
                          >
                            {cnt.emailStatus}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => onSelectContact(cnt.contactId)}
                            className="px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Record Metadata & Activity Log */}
        <div className="space-y-6">
          {/* Quick Metrics Widget */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Account Summary
            </h4>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="block text-xl font-bold text-slate-900">
                  {relatedContacts.length}
                </span>
                <span className="text-[11px] text-slate-500">Linked Contacts</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="block text-xl font-bold text-emerald-600">
                  {relatedContacts.filter((c) => c.emailStatus === 'VALID').length}
                </span>
                <span className="text-[11px] text-slate-500">Verified Emails</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Created:
                </span>
                <span className="font-mono text-slate-700">
                  {company.createdAt ? new Date(company.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Updated:
                </span>
                <span className="font-mono text-slate-700">
                  {company.updatedAt ? new Date(company.updatedAt).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ActivityIcon className="w-3.5 h-3.5 text-emerald-600" />
                Audit & Activity Log
              </h4>
            </div>

            {loadingActivities ? (
              <div className="text-center py-4 text-xs text-slate-400">Loading audit log...</div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                No recent activity recorded.
              </p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 8).map((act) => (
                  <div key={act.id} className="text-xs border-l-2 border-slate-200 pl-3 py-0.5 space-y-0.5">
                    <p className="text-slate-800 font-medium leading-tight">{act.description}</p>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

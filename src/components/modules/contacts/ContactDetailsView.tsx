import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Calendar,
  Clock,
  Edit,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Briefcase,
  FileText,
  Activity as ActivityIcon,
  Send,
} from 'lucide-react';
import { Contact, Company, Activity } from '../../../types/crm';
import { Badge } from '../../common/Badge';
import { crmService } from '../../../services/crmService';
import { useAuth } from '../../../context/AuthContext';

interface ContactDetailsViewProps {
  contact: Contact;
  company?: Company | null;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectCompany: (companyId: string) => void;
}

export function ContactDetailsView({
  contact,
  company,
  onBack,
  onEdit,
  onDelete,
  onSelectCompany,
}: ContactDetailsViewProps) {
  const { isAdmin } = useAuth();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadActivities() {
      if (!contact.contactId) return;
      setLoadingActivities(true);
      try {
        const list = await crmService.getActivitiesForTarget('contactId', contact.contactId);
        if (isMounted) {
          setActivities(list || []);
        }
      } catch (err) {
        console.warn('Failed to load contact activities:', err);
      } finally {
        if (isMounted) setLoadingActivities(false);
      }
    }
    loadActivities();
    return () => {
      isMounted = false;
    };
  }, [contact.contactId]);

  const handleCopyEmail = () => {
    if (contact.businessEmail) {
      navigator.clipboard.writeText(contact.businessEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const cleanLinkedin = contact.linkedinUrl
    ? contact.linkedinUrl.startsWith('http')
      ? contact.linkedinUrl
      : `https://${contact.linkedinUrl}`
    : '';

  const emailBadgeVariant = (status: Contact['emailStatus']) => {
    switch (status) {
      case 'VALID':
        return 'success';
      case 'BOUNCED':
      case 'INVALID':
        return 'danger';
      case 'RISKY':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Return to contacts list"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Contacts</span>
          </button>
          <span className="text-slate-300 font-light text-lg">/</span>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              {contact.firstName} {contact.lastName || ''}
            </h1>
            <Badge variant={emailBadgeVariant(contact.emailStatus)}>
              {contact.emailStatus}
            </Badge>
            <Badge variant={contact.contactStatus === 'ACTIVE' ? 'success' : 'slate'}>
              {contact.contactStatus}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`mailto:${contact.businessEmail}`}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Email Contact</span>
          </a>
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

      {/* Main Grid: Contact Profile + Organization Card + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Contact Profile & Linked Company */}
        <div className="lg:col-span-2 space-y-6">
          {/* Primary Contact Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  <User className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {contact.firstName} {contact.lastName || ''}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span>{contact.jobTitle || 'Decision Maker'}</span>
                    {contact.department && (
                      <>
                        <span>•</span>
                        <span>{contact.department}</span>
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
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Business Email
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${contact.businessEmail}`}
                    className="text-emerald-700 hover:underline font-mono font-medium"
                  >
                    {contact.businessEmail}
                  </a>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                    title="Copy email address"
                  >
                    {copiedEmail ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {contact.secondaryEmail && (
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Secondary Email
                  </span>
                  <a
                    href={`mailto:${contact.secondaryEmail}`}
                    className="text-slate-700 hover:underline font-mono font-medium block"
                  >
                    {contact.secondaryEmail}
                  </a>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Direct Phone & Mobile
                </span>
                <div className="text-slate-700 font-medium">
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="hover:text-emerald-700">
                      {contact.phone}
                    </a>
                  ) : contact.mobile ? (
                    <a href={`tel:${contact.mobile}`} className="hover:text-emerald-700">
                      {contact.mobile}
                    </a>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                  {contact.phone && contact.mobile && (
                    <span className="text-slate-400 text-[11px] block">
                      Mob: {contact.mobile}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Country / Region
                </span>
                <span className="text-slate-700 font-medium">
                  {contact.country || '—'}
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
                    <span>Personal Profile</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Acquisition Source
                </span>
                <span className="text-slate-700 font-medium">
                  {contact.source || 'Direct Contact'}
                </span>
              </div>
            </div>

            {/* Notes Section */}
            {contact.notes && (
              <div className="pt-4 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Contact Notes & Engagement History
                </span>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {contact.notes}
                </div>
              </div>
            )}
          </div>

          {/* Linked Organization (Company-Contact Relationship) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Linked B2B Organization
                </h3>
              </div>
              {company && (
                <button
                  onClick={() => onSelectCompany(company.companyId)}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View Company Profile →</span>
                </button>
              )}
            </div>

            {company ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {company.companyName}
                    </span>
                    <Badge variant={company.status === 'ACTIVE_PROSPECT' ? 'success' : 'default'}>
                      {company.status || 'Active'}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    {company.industry && <p>Industry: {company.industry}</p>}
                    {company.country && <p>Location: {[company.city, company.state, company.country].filter(Boolean).join(', ')}</p>}
                    {company.website && (
                      <p className="text-emerald-700 font-mono text-[11px]">
                        {company.website}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onSelectCompany(company.companyId)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  Open Company Details
                </button>
              </div>
            ) : contact.companyName ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 text-sm">
                    {contact.companyName}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Company name recorded on contact record.
                  </p>
                </div>
                <button
                  onClick={onEdit}
                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 font-medium text-xs rounded-xl shadow-2xs hover:bg-slate-100 transition-colors"
                >
                  Link to Company Master
                </button>
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600 mb-1">
                  No organization currently linked to this contact.
                </p>
                <p className="text-[11px] text-slate-400 mb-3">
                  Link to an authorized B2B company in the YALIX database.
                </p>
                <button
                  onClick={onEdit}
                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Link to Organization
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline & Record Metadata */}
        <div className="space-y-6">
          {/* Quick Metrics Widget */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Verification & Timestamps
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500">Email Status:</span>
                <Badge variant={emailBadgeVariant(contact.emailStatus)}>
                  {contact.emailStatus}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500">Contact Status:</span>
                <Badge variant={contact.contactStatus === 'ACTIVE' ? 'success' : 'slate'}>
                  {contact.contactStatus}
                </Badge>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Created:
                </span>
                <span className="font-mono text-slate-700">
                  {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Updated:
                </span>
                <span className="font-mono text-slate-700">
                  {contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ActivityIcon className="w-3.5 h-3.5 text-emerald-600" />
              Activity History
            </h4>

            {loadingActivities ? (
              <div className="text-center py-4 text-xs text-slate-400">Loading audit log...</div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                No recent activity recorded for this contact.
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

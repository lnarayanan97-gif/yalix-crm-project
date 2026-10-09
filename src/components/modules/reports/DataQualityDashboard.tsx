import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Copy,
  Building2,
  Users,
  Eye,
  FileSpreadsheet,
  Download,
  Filter,
  Info,
} from 'lucide-react';
import { Company, Contact, Lead } from '../../../types/crm';
import { analyzeDataQuality, DataQualityReport } from '../../../utils/dataQuality';
import { Badge } from '../../common/Badge';
import { generateCsvString, downloadCsvFile } from '../../../utils/csvExport';

interface DataQualityDashboardProps {
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  onSelectCompany?: (companyId: string) => void;
  onSelectContact?: (contactId: string) => void;
}

export function DataQualityDashboard({
  companies,
  contacts,
  leads,
  onSelectCompany,
  onSelectContact,
}: DataQualityDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'suspectContacts' | 'suspectCompanies' | 'duplicateGroups'>('overview');
  const [duplicateFilter, setDuplicateFilter] = useState<'ALL' | 'EMAIL' | 'COMPANY_DOMAIN' | 'COMPANY_NAME'>('ALL');

  const report: DataQualityReport = analyzeDataQuality(companies, contacts, leads);

  const filteredDuplicateGroups = report.duplicateCandidateGroups.filter((g) => {
    if (duplicateFilter === 'ALL') return true;
    return g.type === duplicateFilter;
  });

  const exportSuspectContactsCsv = () => {
    const rows = report.suspectContacts.map((sc) => ({
      contactId: sc.contact.contactId,
      firstName: sc.contact.firstName,
      lastName: sc.contact.lastName,
      businessEmail: sc.contact.businessEmail,
      companyName: sc.contact.companyName,
      source: sc.contact.source || 'Direct',
      issues: sc.issues.join('; '),
    }));

    const csv = generateCsvString(rows, [
      { key: 'contactId', label: 'Contact ID' },
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'businessEmail', label: 'Business Email' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'source', label: 'Source' },
      { key: 'issues', label: 'Hygiene & Format Issues' },
    ]);
    downloadCsvFile(csv, `yalix_suspect_contacts_review_${Date.now()}.csv`);
  };

  const exportSuspectCompaniesCsv = () => {
    const rows = report.suspectCompanies.map((sc) => ({
      companyId: sc.company.companyId,
      companyName: sc.company.companyName,
      website: sc.company.website || '',
      country: sc.company.country || '',
      source: sc.company.source || 'Direct',
      issues: sc.issues.join('; '),
    }));

    const csv = generateCsvString(rows, [
      { key: 'companyId', label: 'Company ID' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'website', label: 'Website' },
      { key: 'country', label: 'Country' },
      { key: 'source', label: 'Source' },
      { key: 'issues', label: 'Quality Issues' },
    ]);
    downloadCsvFile(csv, `yalix_suspect_companies_review_${Date.now()}.csv`);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-6 p-6">
      {/* Title & Important Legal / Technical Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Data Quality & Hygiene Audit Center
            </h3>
            <p className="text-xs text-slate-500">
              Syntax validation, format consistency, and manual duplicate candidate review.
            </p>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('suspectContacts')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'suspectContacts' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suspect Contacts ({report.suspectContacts.length})
          </button>
          <button
            onClick={() => setActiveTab('suspectCompanies')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'suspectCompanies' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suspect Companies ({report.suspectCompanies.length})
          </button>
          <button
            onClick={() => setActiveTab('duplicateGroups')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'duplicateGroups' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Duplicate Candidates ({report.duplicateCandidateGroups.length})
          </button>
        </div>
      </div>

      {/* Disclaimers & Safety Principles */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">Important Integrity & Deliverability Disclaimers:</span>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            1. <strong>Email Syntax vs Deliverability:</strong> Syntactic regex conformance verifies standard string formatting (<code className="font-mono text-amber-900">user@domain.com</code>) but <em>does not guarantee active inbox deliverability or valid SMTP server reception</em> without live MX/SMTP handshake pinging.
          </p>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            2. <strong>Zero Automatic Merging:</strong> Potential duplicate candidates are surfaced in review lists only. <em>Records are never automatically merged or deleted without manual human review</em>, protecting CRM-managed notes, lead stages, and source history.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Companies</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{report.totalCompanies}</span>
          <span className="text-[10px] text-slate-500">Authorized accounts</span>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Contacts</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{report.totalContacts}</span>
          <span className="text-[10px] text-slate-500">Decision makers</span>
        </div>

        <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-rose-700 block">Blank Emails</span>
          <span className="text-2xl font-extrabold text-rose-800 mt-1 block">{report.blankEmailsCount}</span>
          <span className="text-[10px] text-rose-600">Requires enrichment</span>
        </div>

        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-amber-700 block">Invalid Syntax</span>
          <span className="text-2xl font-extrabold text-amber-800 mt-1 block">{report.invalidEmailFormatCount}</span>
          <span className="text-[10px] text-amber-600">Malformed format</span>
        </div>

        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-indigo-700 block">Duplicate Candidates</span>
          <span className="text-2xl font-extrabold text-indigo-800 mt-1 block">
            {report.duplicateContactsCount + report.duplicateCompaniesCount}
          </span>
          <span className="text-[10px] text-indigo-600">{report.duplicateCandidateGroups.length} candidate groups</span>
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/70 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Email Syntax Hygiene Breakdown</span>
              <span className="text-[11px] text-slate-500">
                {report.totalContacts > 0
                  ? `${Math.round((report.validEmailSyntaxCount / report.totalContacts) * 100)}% valid syntax`
                  : 'N/A'}
              </span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-600">Valid Syntax Format:</span>
                <span className="font-bold text-emerald-600">{report.validEmailSyntaxCount}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-600">Blank Email Address:</span>
                <span className="font-bold text-rose-600">{report.blankEmailsCount}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-600">Malformed Syntax Format:</span>
                <span className="font-bold text-amber-600">{report.invalidEmailFormatCount}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Duplicate Email Matches:</span>
                <span className="font-bold text-indigo-600">{report.duplicateContactsCount}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/70 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Company Domain & Profile Completeness</span>
              <span className="text-[11px] text-slate-500">
                {report.totalCompanies - report.suspectCompanies.length} fully verified
              </span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-600">Companies in Database:</span>
                <span className="font-bold text-slate-800">{report.totalCompanies}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-600">Missing Website / Domain:</span>
                <span className="font-bold text-amber-600">
                  {report.suspectCompanies.filter((s) => s.issues.some((i) => i.includes('website') || i.includes('domain'))).length}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-600">Candidate Company Duplicates:</span>
                <span className="font-bold text-indigo-600">{report.duplicateCompaniesCount}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Unlinked Contacts (No Company):</span>
                <span className="font-bold text-rose-600">
                  {report.suspectContacts.filter((s) => s.issues.some((i) => i.includes('Unlinked'))).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Suspect Contacts */}
      {activeTab === 'suspectContacts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Showing {report.suspectContacts.length} contacts with missing or invalid fields
            </span>
            {report.suspectContacts.length > 0 && (
              <button
                onClick={exportSuspectContactsCsv}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Suspect Contacts (CSV)</span>
              </button>
            )}
          </div>

          {report.suspectContacts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All contacts meet syntactic email and required profile completeness checks!
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Business Email</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Identified Issues</th>
                    <th className="py-2.5 px-3 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.suspectContacts.map((item) => (
                    <tr key={item.contact.contactId} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {item.contact.firstName || '—'} {item.contact.lastName || ''}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {item.contact.businessEmail || <span className="text-rose-500 italic">BLANK</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{item.contact.companyName || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{item.contact.source || 'Direct'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {item.issues.map((iss, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                              {iss}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {onSelectContact && (
                          <button
                            onClick={() => onSelectContact(item.contact.contactId)}
                            className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-md cursor-pointer"
                            title="Open contact"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Suspect Companies */}
      {activeTab === 'suspectCompanies' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Showing {report.suspectCompanies.length} companies with missing or invalid fields
            </span>
            {report.suspectCompanies.length > 0 && (
              <button
                onClick={exportSuspectCompaniesCsv}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Suspect Companies (CSV)</span>
              </button>
            )}
          </div>

          {report.suspectCompanies.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All company records possess valid names, domains, and location profiles!
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Company Name</th>
                    <th className="py-2.5 px-3">Website / Domain</th>
                    <th className="py-2.5 px-3">Country</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Identified Issues</th>
                    <th className="py-2.5 px-3 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.suspectCompanies.map((item) => (
                    <tr key={item.company.companyId} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.company.companyName}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {item.company.website || <span className="text-amber-500 italic">MISSING</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{item.company.country || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{item.company.source || 'Direct'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {item.issues.map((iss, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              {iss}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {onSelectCompany && (
                          <button
                            onClick={() => onSelectCompany(item.company.companyId)}
                            className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-md cursor-pointer"
                            title="Open company"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Duplicate Candidates Review (Human review only, never auto-merge) */}
      {activeTab === 'duplicateGroups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Duplicate Candidates Review Queue</h4>
              <p className="text-[11px] text-slate-500">
                Records sharing identical business emails, websites, or clean organization titles.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Filter candidate type:</span>
              <select
                value={duplicateFilter}
                onChange={(e) => setDuplicateFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Duplicate Types ({report.duplicateCandidateGroups.length})</option>
                <option value="EMAIL">Identical Business Emails</option>
                <option value="COMPANY_DOMAIN">Matching Web Domains</option>
                <option value="COMPANY_NAME">Matching Clean Company Names</option>
              </select>
            </div>
          </div>

          {filteredDuplicateGroups.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              No duplicate candidate groups detected in the database.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDuplicateGroups.map((group, gIdx) => (
                <div key={gIdx} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                        {group.type}
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-800">{group.key}</span>
                      <span className="text-[11px] text-slate-500">({group.items.length} records)</span>
                    </div>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Manual Review Required (No Auto-Merge)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {group.items.map((item: any, iIdx) => (
                      <div key={iIdx} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                        <div className="font-semibold text-slate-800 truncate">
                          {item.firstName ? `${item.firstName} ${item.lastName || ''}` : item.companyName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          ID: {item.contactId || item.companyId}
                        </div>
                        {item.businessEmail && (
                          <div className="text-[11px] text-slate-600 truncate">{item.businessEmail}</div>
                        )}
                        <div className="text-[10px] text-slate-400">
                          Source: {item.source || 'Direct'} ({item.createdAt ? item.createdAt.split('T')[0] : '—'})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

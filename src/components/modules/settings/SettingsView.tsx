import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Download,
  Users,
  Database,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Company, Contact, Lead, FollowUp, AuditLog } from '../../../types/crm';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { generateCsvString, downloadCsvFile } from '../../../utils/csvExport';

interface SettingsViewProps {
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  followUps: FollowUp[];
}

export function SettingsView({ companies, contacts, leads, followUps }: SettingsViewProps) {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    async function fetchAudit() {
      if (!isAdmin) return;
      setLoadingLogs(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(20))
        );
        const list: AuditLog[] = [];
        snap.forEach((d) => list.push(d.data() as AuditLog));
        setAuditLogs(list);
      } catch (err) {
        console.warn('Audit fetch note:', err);
      } finally {
        setLoadingLogs(false);
      }
    }
    fetchAudit();
  }, [isAdmin]);

  const handleExportCompaniesCsv = () => {
    const csv = generateCsvString(companies, [
      { key: 'companyId', label: 'Company ID' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'website', label: 'Website / Domain' },
      { key: 'country', label: 'Country' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'industry', label: 'Industry' },
      { key: 'companySize', label: 'Company Size' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'status', label: 'Status' },
      { key: 'source', label: 'Source' },
      { key: 'sourceDate', label: 'Source Date' },
      { key: 'importId', label: 'Import Batch ID' },
      { key: 'notes', label: 'Notes' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'updatedAt', label: 'Updated At' },
    ]);
    downloadCsvFile(csv, `YALIX_COMPANIES_ALL_${Date.now()}.csv`);
  };

  const handleExportContactsCsv = () => {
    const csv = generateCsvString(contacts, [
      { key: 'contactId', label: 'Contact ID' },
      { key: 'companyId', label: 'Linked Company ID' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'businessEmail', label: 'Business Email' },
      { key: 'emailStatus', label: 'Email Status' },
      { key: 'jobTitle', label: 'Job Title' },
      { key: 'department', label: 'Department' },
      { key: 'phone', label: 'Phone' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'country', label: 'Country' },
      { key: 'linkedinUrl', label: 'LinkedIn Profile' },
      { key: 'contactStatus', label: 'Contact Status' },
      { key: 'source', label: 'Source' },
      { key: 'sourceDate', label: 'Source Date' },
      { key: 'importId', label: 'Import Batch ID' },
      { key: 'notes', label: 'Notes' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'updatedAt', label: 'Updated At' },
    ]);
    downloadCsvFile(csv, `YALIX_CONTACTS_ALL_${Date.now()}.csv`);
  };

  const handleExportFullBackup = async (format: 'xlsx' | 'csv') => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    // 1. Companies
    const compSheet = XLSX.utils.json_to_sheet(companies);
    XLSX.utils.book_append_sheet(workbook, compSheet, 'Companies');

    // 2. Contacts
    const cntSheet = XLSX.utils.json_to_sheet(contacts);
    XLSX.utils.book_append_sheet(workbook, cntSheet, 'Contacts');

    // 3. Leads
    const leadSheet = XLSX.utils.json_to_sheet(leads);
    XLSX.utils.book_append_sheet(workbook, leadSheet, 'Leads');

    // 4. Follow-ups
    const fuSheet = XLSX.utils.json_to_sheet(followUps);
    XLSX.utils.book_append_sheet(workbook, fuSheet, 'Follow-ups');

    XLSX.writeFile(workbook, `YALIX_CRM_FULL_BACKUP_${Date.now()}.${format}`);
  };

  return (
    <div className="space-y-6">
      {/* Security Architecture Summary */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              YALIX CRM Security Architecture & Policy
            </h3>
            <p className="text-xs text-slate-500">
              Zero public access, Firestore security rules enforced, RBAC team roles.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="font-bold text-slate-800 block mb-1">Authenticated Account</span>
            <span className="text-slate-600 block truncate">{currentUser?.email}</span>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
              Role: {isAdmin ? 'ADMIN (Authorized)' : userProfile?.role || 'MEMBER'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="font-bold text-slate-800 block mb-1">Firestore Database</span>
            <span className="text-slate-600 block">Status: Online & Connected</span>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
              Enterprise Rules Active
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="font-bold text-slate-800 block mb-1">Registration Policy</span>
            <span className="text-slate-600 block">Self-Registration: Disabled</span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Private to YALIX Domain
            </span>
          </div>
        </div>
      </div>

      {/* Backup and Full Export */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">CRM Database Backup & Complete Exports</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Export all authorized company and contact master datasets in RFC 4180 Unicode CSV with BOM, or download the full multi-table backup workbook.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCompaniesCsv}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export all authorized company records"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Export All Companies (CSV)</span>
            </button>
            <button
              onClick={handleExportContactsCsv}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export all authorized contact records"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Export All Contacts (CSV)</span>
            </button>
            <button
              onClick={() => handleExportFullBackup('xlsx')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download entire CRM backup workbook"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Full Backup (XLSX)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Stream */}
      {isAdmin && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Sensitive Action Audit Trail</h3>
            </div>
            <span className="text-xs text-slate-400">Append-only audit log</span>
          </div>

          <div className="overflow-x-auto">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Audit records will appear here as records are modified.
              </p>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Action</th>
                    <th className="p-2.5">Collection</th>
                    <th className="p-2.5">Actor</th>
                    <th className="p-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.auditId} className="hover:bg-slate-50">
                      <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                        {log.createdAt?.replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-800">{log.action}</td>
                      <td className="p-2.5 text-slate-600 font-mono">{log.targetCollection}</td>
                      <td className="p-2.5 text-slate-600">{log.performedByEmail || log.performedBy}</td>
                      <td className="p-2.5 text-slate-500">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

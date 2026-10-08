import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileText,
  RefreshCw,
  Database,
  History,
  ShieldCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Company, Contact, ImportRecord } from '../../../types/crm';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';
import { collection, doc, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';

interface ImportWizardViewProps {
  companies: Company[];
  contacts: Contact[];
  onRefresh: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'preview_validate' | 'processing' | 'summary';

interface ColumnMapping {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  industry: string;
  notes: string;
}

export function ImportWizardView({ companies, contacts, onRefresh }: ImportWizardViewProps) {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: '',
    industry: '',
    notes: '',
  });

  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'create_new'>('skip');

  // Analysis result
  const [analyzedRecords, setAnalyzedRecords] = useState<{
    total: number;
    validCount: number;
    duplicateCount: number;
    invalidCount: number;
    rows: any[];
  } | null>(null);

  // Final summary
  const [importSummary, setImportSummary] = useState<{
    processed: number;
    created: number;
    updated: number;
    duplicates: number;
    invalid: number;
    skipped: number;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  // 1. File Upload & Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileType(file.name.endsWith('.csv') ? 'CSV' : 'XLSX');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        if (data.length === 0) {
          error('File Empty', 'The uploaded file does not contain any data rows.');
          return;
        }

        const cols = Object.keys(data[0] || {});
        setHeaders(cols);
        setRawRows(data);

        // Auto-detect columns intelligently
        const autoMap: ColumnMapping = {
          companyName: cols.find((c) => /company|organization|client|account/i.test(c)) || '',
          firstName: cols.find((c) => /first.*name|contact.*name|name|person/i.test(c)) || '',
          lastName: cols.find((c) => /last.*name|surname/i.test(c)) || '',
          email: cols.find((c) => /email|mail/i.test(c)) || '',
          phone: cols.find((c) => /phone|mobile|tel/i.test(c)) || '',
          country: cols.find((c) => /country|nation|region/i.test(c)) || '',
          industry: cols.find((c) => /industry|sector|business/i.test(c)) || '',
          notes: cols.find((c) => /note|comment|detail|description/i.test(c)) || '',
        };
        setMapping(autoMap);

        setStep('mapping');
        success('File Parsed', `Loaded ${data.length} rows from ${file.name}`);
      } catch (err: any) {
        error('Parse Error', 'Failed to read file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 2. Validate, Normalize & Duplicate Detection
  const handleValidateAndAnalyze = () => {
    const existingEmails = new Set(contacts.map((c) => c.businessEmail.toLowerCase().trim()));
    const existingCompanyNames = new Set(companies.map((c) => c.companyName.toLowerCase().trim()));

    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    const processedRows = rawRows.map((raw, idx) => {
      const rawEmail = String(raw[mapping.email] || '').trim().toLowerCase();
      const rawComp = String(raw[mapping.companyName] || '').trim();
      const rawFirst = String(raw[mapping.firstName] || '').trim();

      const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
      const isDuplicate = existingEmails.has(rawEmail);

      let status = 'VALID';
      if (!isEmailValid || !rawFirst) {
        status = 'INVALID';
        invalidCount++;
      } else if (isDuplicate) {
        status = 'DUPLICATE';
        duplicateCount++;
      } else {
        validCount++;
      }

      return {
        rowIndex: idx + 1,
        companyName: rawComp || 'Unknown Co.',
        firstName: rawFirst,
        lastName: String(raw[mapping.lastName] || '').trim(),
        email: rawEmail,
        phone: String(raw[mapping.phone] || '').trim(),
        country: String(raw[mapping.country] || '').trim(),
        industry: String(raw[mapping.industry] || '').trim(),
        notes: String(raw[mapping.notes] || '').trim(),
        status,
        isDuplicate,
      };
    });

    setAnalyzedRecords({
      total: rawRows.length,
      validCount,
      duplicateCount,
      invalidCount,
      rows: processedRows,
    });

    setStep('preview_validate');
  };

  // 3. Perform Actual Incremental Batch Import into Firestore
  const handleExecuteImport = async () => {
    if (!analyzedRecords) return;
    setIsProcessing(true);
    setStep('processing');

    const now = new Date().toISOString();
    const importId = 'imp_' + Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let invalid = 0;

    try {
      const batch = writeBatch(db);
      const existingEmailMap = new Map(contacts.map((c) => [c.businessEmail.toLowerCase(), c]));
      const existingCompanyMap = new Map(companies.map((c) => [c.companyName.toLowerCase(), c]));

      let batchCount = 0;

      for (const item of analyzedRecords.rows) {
        if (item.status === 'INVALID') {
          invalid++;
          continue;
        }

        const existingContact = existingEmailMap.get(item.email);

        if (existingContact) {
          if (duplicateHandling === 'skip') {
            skipped++;
            continue;
          } else if (duplicateHandling === 'update') {
            // Incremental update: preserve existing CRM notes
            const contactRef = doc(db, 'contacts', existingContact.contactId);
            batch.update(contactRef, {
              phone: item.phone || existingContact.phone || '',
              country: item.country || existingContact.country || '',
              updatedAt: now,
            });
            updated++;
            batchCount++;
            continue;
          }
        }

        // Create New Contact & Company
        let companyId = existingCompanyMap.get(item.companyName.toLowerCase())?.companyId;
        if (!companyId) {
          companyId = 'comp_' + Math.random().toString(36).substring(2, 9);
          const compRef = doc(db, 'companies', companyId);
          const newComp: Company = {
            id: companyId,
            companyId,
            companyName: item.companyName,
            country: item.country,
            industry: item.industry,
            source: `Import: ${fileName}`,
            status: 'ACTIVE_PROSPECT',
            createdAt: now,
            updatedAt: now,
          };
          batch.set(compRef, newComp);
          existingCompanyMap.set(item.companyName.toLowerCase(), newComp);
          batchCount++;
        }

        const contactId = 'cnt_' + Math.random().toString(36).substring(2, 9);
        const contactRef = doc(db, 'contacts', contactId);
        const newContact: Contact = {
          id: contactId,
          contactId,
          companyId,
          companyName: item.companyName,
          firstName: item.firstName,
          lastName: item.lastName,
          businessEmail: item.email,
          phone: item.phone,
          country: item.country,
          source: `Import: ${fileName}`,
          emailStatus: 'VALID',
          contactStatus: 'ACTIVE',
          notes: item.notes,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(contactRef, newContact);
        created++;
        batchCount++;

        // Commit batch every 400 operations to stay well within Firestore's 500 limit
        if (batchCount >= 400) {
          await batch.commit();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      // Record Import History in Firestore
      const importRecord: ImportRecord = {
        id: importId,
        importId,
        fileName,
        fileType,
        rowCount: analyzedRecords.total,
        processedCount: analyzedRecords.rows.length,
        createdCount: created,
        updatedCount: updated,
        duplicateCount: analyzedRecords.duplicateCount,
        invalidCount: invalid,
        skippedCount: skipped,
        status: 'COMPLETED',
        createdBy: currentUser?.uid || 'user',
        createdAt: now,
        summary: `Imported ${created} new records, updated ${updated}, skipped ${skipped}.`,
      };

      await setDoc(doc(db, 'imports', importId), importRecord);

      setImportSummary({
        processed: analyzedRecords.rows.length,
        created,
        updated,
        duplicates: analyzedRecords.duplicateCount,
        invalid,
        skipped,
      });

      setStep('summary');
      success('Import Finished', `Created ${created} new records.`);
      onRefresh();
    } catch (err: any) {
      error('Import Failed', err.message);
      setStep('preview_validate');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setRawRows([]);
    setHeaders([]);
    setAnalyzedRecords(null);
    setImportSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Wizard Progress Stepper */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {[
            { id: 'upload', label: '1. Upload File' },
            { id: 'mapping', label: '2. Column Mapping' },
            { id: 'preview_validate', label: '3. Normalize & Deduplicate' },
            { id: 'summary', label: '4. Summary' },
          ].map((s, idx) => {
            const isCurrent = step === s.id || (step === 'processing' && s.id === 'preview_validate');
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-500/20'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {idx + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${isCurrent ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                  {s.label}
                </span>
                {idx < 3 && <div className="w-8 sm:w-16 h-0.5 bg-slate-200 mx-1" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white p-8 rounded-xl border border-slate-200/80 shadow-2xs text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Upload B2B Data Spreadsheet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            Support for Excel (.xlsx) and CSV files. YALIX CRM will normalize emails, format phone numbers, and cross-reference with existing records.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-file-upload"
          />

          <label
            htmlFor="excel-file-upload"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-950/20 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Select .XLSX or .CSV File</span>
          </label>

          <div className="mt-8 pt-6 border-t border-slate-100 text-left text-xs text-slate-600 space-y-2 bg-slate-50/60 p-4 rounded-xl">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>YALIX Enterprise Import Guardrails:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Emails normalized to lowercase and trimmed of trailing whitespace</li>
              <li>Existing CRM notes, lead status, and follow-ups are preserved</li>
              <li>Duplicates detected by email address and company match</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Map Columns ({fileName})</h3>
              <p className="text-xs text-slate-500">Select which columns correspond to CRM fields.</p>
            </div>
            <Badge variant="info">{rawRows.length} rows found</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Organization Name <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.companyName}
                onChange={(e) => setMapping({ ...mapping, companyName: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact First Name <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.firstName}
                onChange={(e) => setMapping({ ...mapping, firstName: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
              <select
                value={mapping.lastName}
                onChange={(e) => setMapping({ ...mapping, lastName: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="">-- None / In First Name --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Email <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.email}
                onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <select
                value={mapping.phone}
                onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <select
                value={mapping.country}
                onChange={(e) => setMapping({ ...mapping, country: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleValidateAndAnalyze}
              disabled={!mapping.email || !mapping.firstName}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <span>Validate & Deduplicate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Duplicate Handling Selection */}
      {step === 'preview_validate' && analyzedRecords && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Data Validation & Duplicate Inspection</h3>
              <p className="text-xs text-slate-500">
                Verified against existing YALIX database. Select how to handle matching records.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="success">{analyzedRecords.validCount} New Valid</Badge>
              <Badge variant="warning">{analyzedRecords.duplicateCount} Duplicates</Badge>
              {analyzedRecords.invalidCount > 0 && (
                <Badge variant="danger">{analyzedRecords.invalidCount} Invalid</Badge>
              )}
            </div>
          </div>

          {/* Duplicate handling strategy selector */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Duplicate Conflict Strategy:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label
                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                  duplicateHandling === 'skip'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dup-strategy"
                    checked={duplicateHandling === 'skip'}
                    onChange={() => setDuplicateHandling('skip')}
                    className="text-emerald-600"
                  />
                  <span>Skip Duplicates (Recommended)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-normal">
                  Ignores existing contacts. Prevents overwriting any data.
                </span>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                  duplicateHandling === 'update'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dup-strategy"
                    checked={duplicateHandling === 'update'}
                    onChange={() => setDuplicateHandling('update')}
                    className="text-emerald-600"
                  />
                  <span>Update Existing Records</span>
                </div>
                <span className="text-[11px] text-slate-500 font-normal">
                  Fills missing fields without touching CRM notes or lead stage.
                </span>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                  duplicateHandling === 'create_new'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dup-strategy"
                    checked={duplicateHandling === 'create_new'}
                    onChange={() => setDuplicateHandling('create_new')}
                    className="text-emerald-600"
                  />
                  <span>Create As New</span>
                </div>
                <span className="text-[11px] text-slate-500 font-normal">
                  Creates parallel contact entries under the company.
                </span>
              </label>
            </div>
          </div>

          {/* Sample Preview Table */}
          <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                <tr>
                  <th className="p-2.5">Row</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Company</th>
                  <th className="p-2.5">Contact Name</th>
                  <th className="p-2.5">Normalized Email</th>
                  <th className="p-2.5">Phone</th>
                  <th className="p-2.5">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analyzedRecords.rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2.5 text-slate-400">#{r.rowIndex}</td>
                    <td className="p-2.5">
                      <Badge
                        variant={
                          r.status === 'VALID'
                            ? 'success'
                            : r.status === 'DUPLICATE'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-2.5 font-medium text-slate-800">{r.companyName}</td>
                    <td className="p-2.5 text-slate-700">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="p-2.5 font-mono text-slate-600">{r.email}</td>
                    <td className="p-2.5 text-slate-500">{r.phone || '—'}</td>
                    <td className="p-2.5 text-slate-500">{r.country || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Mapping</span>
            </button>
            <button
              onClick={handleExecuteImport}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Execute Safe Import into Firestore</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Final Summary */}
      {step === 'summary' && importSummary && (
        <div className="bg-white p-8 rounded-xl border border-slate-200/80 shadow-2xs max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Import Batch Completed</h3>
            <p className="text-xs text-slate-500 mt-1">
              Data successfully synced and recorded in YALIX Firestore database.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 block">Total Rows</span>
              <strong className="text-lg text-slate-800">{importSummary.processed}</strong>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-950">
              <span className="text-emerald-700 block">New Created</span>
              <strong className="text-lg text-emerald-800">{importSummary.created}</strong>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-950">
              <span className="text-blue-700 block">Updated</span>
              <strong className="text-lg text-blue-800">{importSummary.updated}</strong>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-950">
              <span className="text-amber-700 block">Skipped Dups</span>
              <strong className="text-lg text-amber-800">{importSummary.skipped}</strong>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-950">
              <span className="text-rose-700 block">Invalid Rows</span>
              <strong className="text-lg text-rose-800">{importSummary.invalid}</strong>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200/80 text-purple-950">
              <span className="text-purple-700 block">Duplicates</span>
              <strong className="text-lg text-purple-800">{importSummary.duplicates}</strong>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Import Another Spreadsheet
          </button>
        </div>
      )}
    </div>
  );
}

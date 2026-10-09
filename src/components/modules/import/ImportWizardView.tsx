import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Database,
  History,
  ShieldCheck,
  Download,
  Check,
  AlertCircle,
  Sparkles,
  Sliders,
  Building2,
  Users,
  Target,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Company,
  Contact,
  Lead,
  LeadStatus,
  Priority,
  Product,
  ImportRecord,
} from '../../../types/crm';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';
import { doc, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import {
  CRM_TARGET_FIELDS,
  ColumnMappingState,
  DuplicateAnalysisResult,
  FileValidationResult,
  FinalImportSummary,
  ImportDecisionConfig,
  NormalizationConfig,
  NormalizedRecord,
  RecordValidationResult,
  RejectedRowDetail,
  WIZARD_STEPS,
  WizardStepNumber,
} from './importTypes';
import { applyNormalization } from './importNormalizer';
import {
  detectDuplicates,
  validateNormalizedRecord,
  validateSpreadsheetFile,
} from './importValidator';
import {
  generateDeterministicCompanyId,
  generateDeterministicContactId,
  generateDeterministicLeadId,
  sha256Sync,
} from './importCrypto';
import { ImportHistoryList } from './ImportHistoryList';

interface ImportWizardViewProps {
  companies: Company[];
  contacts: Contact[];
  products?: Product[];
  onRefresh: () => void;
  onNavigate?: (tab: any) => void;
}

export function ImportWizardView({
  companies,
  contacts,
  products = [],
  onRefresh,
  onNavigate,
}: ImportWizardViewProps) {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Wizard Step (1 through 10)
  const [currentStep, setCurrentStep] = useState<WizardStepNumber>(1);
  const [showHistoryTab, setShowHistoryTab] = useState(false);

  // STEP 1 & 2: File upload & raw parsing
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileValidation, setFileValidation] = useState<FileValidationResult | null>(null);
  const [rawWorkbook, setRawWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // STEP 4: Column Mapping
  const [mapping, setMapping] = useState<ColumnMappingState>({});

  // STEP 5: Normalization settings
  const [normalizationConfig, setNormalizationConfig] = useState<NormalizationConfig>({
    trimWhitespace: true,
    cleanEmails: true,
    standardizePhones: true,
    titleCaseNames: true,
    titleCaseCompanies: false, // Default FALSE to protect McDonald's, 3M, eBay, ABC GLOBAL PTE LTD
    normalizeCountries: true,
    extractDomains: true,
    splitFullNames: true,
  });

  // STEP 6: Validation filtering
  const [validationFilter, setValidationFilter] = useState<'all' | 'valid' | 'errors'>('all');

  // STEP 7: Deduplication filtering
  const [duplicateFilter, setDuplicateFilter] = useState<'all' | 'new' | 'duplicates'>('all');

  // STEP 8: Decision configuration
  const [decisionConfig, setDecisionConfig] = useState<ImportDecisionConfig>({
    duplicateHandling: 'skip',
    autoCreateLeads: true,
    defaultLeadStatus: 'NEW',
    defaultPriority: 'MEDIUM',
    productInterest: products[0]?.name || 'Egg Shell Powder',
    skipInvalidRows: true,
    batchSize: 200, // Safe batch size (well below Firestore 500 limit)
  });

  // STEP 9: Execution Progress & Error Recovery
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({
    percent: 0,
    currentStep: 'Preparing batched operations...',
    processed: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0,
    createdCompanies: 0,
    createdContacts: 0,
    updatedRecords: 0,
    skippedDuplicates: 0,
    invalidRecords: 0,
    createdLeads: 0,
    hasErrors: false,
    errorMessage: '',
    failedBatchIndex: 0,
    failedRowRange: '',
  });

  // STEP 10: Final summary
  const [finalSummary, setFinalSummary] = useState<FinalImportSummary | null>(null);

  // -------------------------------------------------------------
  // COMPUTED STATES & PIPELINES
  // -------------------------------------------------------------

  // Compute normalized records from rawRows + mapping + normalizationConfig
  const normalizedRecords: NormalizedRecord[] = useMemo(() => {
    if (rawRows.length === 0 || Object.keys(mapping).length === 0) return [];
    return rawRows.map((raw, idx) =>
      applyNormalization(raw, mapping, normalizationConfig, idx + 1)
    );
  }, [rawRows, mapping, normalizationConfig]);

  // Compute validation results for all records
  const validationResults: RecordValidationResult[] = useMemo(() => {
    if (normalizedRecords.length === 0) return [];
    return normalizedRecords.map((rec) => validateNormalizedRecord(rec));
  }, [normalizedRecords]);

  const validationStats = useMemo(() => {
    const total = validationResults.length;
    const valid = validationResults.filter((v) => v.isValid).length;
    const invalid = total - valid;
    const warnings = validationResults.filter((v) => v.warnings.length > 0).length;
    return { total, valid, invalid, warnings };
  }, [validationResults]);

  // Compute duplicate analysis
  const duplicateResults: DuplicateAnalysisResult[] = useMemo(() => {
    if (normalizedRecords.length === 0) return [];
    return detectDuplicates(normalizedRecords, validationResults, contacts, companies);
  }, [normalizedRecords, validationResults, contacts, companies]);

  const duplicateStats = useMemo(() => {
    let inFileDups = 0;
    let dbContactMatches = 0;
    let dbCompanyMatches = 0;
    let uniqueNew = 0;

    duplicateResults.forEach((d) => {
      if (d.isFileDuplicate) inFileDups++;
      if (d.isDbDuplicate && d.matchedContact) dbContactMatches++;
      if (d.matchedCompany && !d.matchedContact) dbCompanyMatches++;
      if (!d.isFileDuplicate && !d.isDbDuplicate) uniqueNew++;
    });

    return { inFileDups, dbContactMatches, dbCompanyMatches, uniqueNew };
  }, [duplicateResults]);

  // Auto-map columns intelligently with strict negative guards
  const autoMapColumns = (cols: string[]) => {
    const newMapping: ColumnMappingState = {};
    const claimedCols = new Set<string>();

    const isCompanyColumn = (colName: string) => {
      const lower = colName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        lower.includes('company') ||
        lower.includes('organization') ||
        lower.includes('organisation') ||
        lower.includes('account') ||
        lower.includes('business') ||
        lower.includes('employer') ||
        lower.includes('firm') ||
        lower.includes('corp')
      );
    };

    // Priority field order: required fields first
    const fieldOrder = [
      'companyName',
      'businessEmail',
      'firstName',
      'lastName',
      'fullName',
      'website',
      'phone',
      'country',
      'industry',
      'jobTitle',
      'city',
      'state',
      'department',
      'linkedinUrl',
      'notes',
    ];

    // Pass 1: Exact matches against synonyms
    fieldOrder.forEach((fieldKey) => {
      const fieldDef = CRM_TARGET_FIELDS.find((f) => f.key === fieldKey);
      if (!fieldDef || newMapping[fieldKey]) return;

      const isPersonField = ['firstName', 'lastName', 'fullName'].includes(fieldKey);

      const exactMatch = cols.find((col) => {
        if (claimedCols.has(col)) return false;
        if (isPersonField && isCompanyColumn(col)) return false;
        const cleanCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
        return fieldDef.synonyms.some((syn) => {
          const cleanSyn = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanCol === cleanSyn;
        });
      });

      if (exactMatch) {
        newMapping[fieldKey] = exactMatch;
        claimedCols.add(exactMatch);
      }
    });

    // Pass 2: Partial matches for unassigned fields
    fieldOrder.forEach((fieldKey) => {
      const fieldDef = CRM_TARGET_FIELDS.find((f) => f.key === fieldKey);
      if (!fieldDef || newMapping[fieldKey]) return;

      const isPersonField = ['firstName', 'lastName', 'fullName'].includes(fieldKey);

      const partialMatch = cols.find((col) => {
        if (claimedCols.has(col)) return false;
        if (isPersonField && isCompanyColumn(col)) return false;
        const cleanCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
        return fieldDef.synonyms.some((syn) => {
          const cleanSyn = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanSyn.length <= 3) return cleanCol === cleanSyn;
          return cleanCol.includes(cleanSyn) || cleanSyn.includes(cleanCol);
        });
      });

      if (partialMatch) {
        newMapping[fieldKey] = partialMatch;
        claimedCols.add(partialMatch);
      }
    });

    setMapping(newMapping);
    return newMapping;
  };

  // -------------------------------------------------------------
  // STEP 1 -> STEP 2: FILE UPLOAD & VALIDATION
  // -------------------------------------------------------------
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    const { validation, workbook, firstSheetData, headers: detectedHeaders } =
      await validateSpreadsheetFile(file);

    setFileValidation(validation);

    if (workbook && firstSheetData && detectedHeaders) {
      setRawWorkbook(workbook);
      setActiveSheetName(workbook.SheetNames[0]);
      setRawRows(firstSheetData);
      setHeaders(detectedHeaders);
      autoMapColumns(detectedHeaders);
    }

    setCurrentStep(2);
  };

  const handleSheetChange = (sheetName: string) => {
    if (!rawWorkbook) return;
    setActiveSheetName(sheetName);
    const ws = rawWorkbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    setRawRows(data);
    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    setHeaders(cols);
    autoMapColumns(cols);
  };

  // -------------------------------------------------------------
  // STEP 9: EXECUTE IMPORT (Batched & Failure-Aware with Idempotency)
  // -------------------------------------------------------------
  const handleExecuteImport = async () => {
    if (!uploadedFile || duplicateResults.length === 0) return;

    setIsImporting(true);
    setCurrentStep(9);

    const startTime = Date.now();
    const importId = 'imp_' + Date.now();
    const nowIso = new Date().toISOString();

    // Map existing contacts by deterministic SHA-256 email key
    const existingEmailHashMap = new Map<string, Contact>();
    contacts.forEach((c) => {
      if (c.businessEmail) {
        existingEmailHashMap.set(sha256Sync(c.businessEmail.toLowerCase().trim()), c);
      }
    });

    // Map existing companies by domain and exact name
    const existingCompanyMap = new Map<string, Company>();
    companies.forEach((c) => {
      if (c.companyName) {
        existingCompanyMap.set(c.companyName.toLowerCase().trim(), c);
      }
      if (c.website) {
        const dom = c.website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
        if (dom) existingCompanyMap.set(dom, c);
      }
    });

    let createdCompanies = 0;
    let createdContacts = 0;
    let updatedRecords = 0;
    let skippedDuplicates = 0;
    let invalidRecords = 0;
    let createdLeads = 0;
    const rejectedRows: RejectedRowDetail[] = [];

    // Filter valid vs rejected records
    const recordsToProcess = duplicateResults.filter((item) => {
      if (!item.validation.isValid) {
        if (decisionConfig.skipInvalidRows) {
          invalidRecords++;
          rejectedRows.push({
            rowNumber: item.rowIndex,
            company: item.record.companyName,
            name: item.record.fullName || item.record.firstName,
            email: item.record.businessEmail,
            reasons: item.validation.errors,
          });
          return false;
        }
      }
      return true;
    });

    const total = recordsToProcess.length;
    const batchOperationLimit = decisionConfig.batchSize || 200;
    const estimatedTotalBatches = Math.ceil((total * 3) / batchOperationLimit) || 1;

    setImportProgress({
      percent: 5,
      currentStep: 'Initializing failure-aware batch persistence...',
      processed: 0,
      total,
      currentBatch: 1,
      totalBatches: estimatedTotalBatches,
      createdCompanies: 0,
      createdContacts: 0,
      updatedRecords: 0,
      skippedDuplicates: 0,
      invalidRecords,
      createdLeads: 0,
      hasErrors: false,
      errorMessage: '',
      failedBatchIndex: 0,
      failedRowRange: '',
    });

    let currentBatch = writeBatch(db);
    let opsInBatch = 0;
    let batchIndex = 1;
    let batchStartRow = 1;

    try {
      for (let i = 0; i < recordsToProcess.length; i++) {
        const item = recordsToProcess[i];
        const rec = item.record;
        const normEmail = rec.businessEmail.toLowerCase().trim();
        const emailHash = rec.emailHash || sha256Sync(normEmail);
        const normCompanyName = rec.companyName.toLowerCase().trim();
        const normDomain = rec.domain.toLowerCase().trim();

        // 1. Idempotent Deterministic Document Identifiers
        const contactId = generateDeterministicContactId(normEmail);
        const companyId = generateDeterministicCompanyId(normDomain || normCompanyName);

        // Calculate operations needed for this logical record
        // Up to 3 ops: Company (set), Contact (set/update), Lead (set)
        if (opsInBatch + 3 >= batchOperationLimit) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          opsInBatch = 0;
          batchIndex++;
          batchStartRow = i + 1;
        }

        // 2. Check Duplicate Contact using Deterministic Email Hash
        const existingContact = existingEmailHashMap.get(emailHash);

        if (existingContact) {
          if (decisionConfig.duplicateHandling === 'skip') {
            skippedDuplicates++;
            continue;
          } else if (decisionConfig.duplicateHandling === 'update') {
            // CRM FIELD PROTECTION:
            // NEVER overwrite existing CRM fields with blank imported values.
            // Preserves leadStatus, priority, notes, nextFollowUpAt, lastContactedAt.
            const contactRef = doc(db, 'contacts', existingContact.contactId || contactId);
            const updatePayload: Record<string, any> = {
              updatedAt: nowIso,
            };

            // Only enrich missing values; never overwrite with empty
            if (rec.phone && !existingContact.phone) updatePayload.phone = rec.phone;
            else if (rec.phone && existingContact.phone && rec.phone !== existingContact.phone) {
              updatePayload.phone = rec.phone; // Update if new phone provided
            }

            if (rec.jobTitle && !existingContact.jobTitle) updatePayload.jobTitle = rec.jobTitle;
            if (rec.country && !existingContact.country) updatePayload.country = rec.country;
            if (rec.linkedinUrl && !existingContact.linkedinUrl) updatePayload.linkedinUrl = rec.linkedinUrl;

            // Preserve notes by non-destructively appending
            if (rec.notes && rec.notes !== existingContact.notes) {
              updatePayload.notes = existingContact.notes
                ? `${existingContact.notes} | Import: ${rec.notes}`
                : rec.notes;
            }

            currentBatch.update(contactRef, updatePayload);
            opsInBatch++;
            updatedRecords++;
            continue;
          }
        }

        // 3. Deterministic Company Creation / Linking
        let parentCompanyId = existingCompanyMap.get(normDomain)?.companyId ||
                              existingCompanyMap.get(normCompanyName)?.companyId;

        if (!parentCompanyId) {
          parentCompanyId = companyId;
          const compRef = doc(db, 'companies', companyId);
          const newCompany: Company = {
            id: companyId,
            companyId,
            companyName: rec.companyName, // Preserves exact original casing (McDonald's, 3M, eBay)
            originalCompanyName: rec.rawCompanyName,
            website: rec.website || (rec.domain ? `https://${rec.domain}` : undefined),
            country: rec.country || undefined,
            city: rec.city || undefined,
            state: rec.state || undefined,
            industry: rec.industry || undefined,
            source: `Import: ${uploadedFile.name}`,
            status: 'ACTIVE_PROSPECT',
            notes: rec.notes ? `Import: ${rec.notes}` : undefined,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          currentBatch.set(compRef, newCompany, { merge: true });
          existingCompanyMap.set(normCompanyName, newCompany);
          if (normDomain) existingCompanyMap.set(normDomain, newCompany);
          opsInBatch++;
          createdCompanies++;
        }

        // 4. Deterministic Contact Creation (Idempotent via cnt_<sha256>)
        const contactRef = doc(db, 'contacts', contactId);
        const newContact: Contact = {
          id: contactId,
          contactId,
          companyId: parentCompanyId,
          companyName: rec.companyName,
          firstName: rec.firstName || '', // Blank allowed if company + email present
          lastName: rec.lastName || undefined,
          jobTitle: rec.jobTitle || undefined,
          department: rec.department || undefined,
          businessEmail: rec.businessEmail,
          emailHash, // Stored for indexed O(1) lookup
          phone: rec.phone || undefined,
          country: rec.country || undefined,
          linkedinUrl: rec.linkedinUrl || undefined,
          source: `Import: ${uploadedFile.name}`,
          emailStatus: 'VALID',
          contactStatus: 'ACTIVE',
          notes: rec.notes || undefined,
          rawSourceValues: {
            rawCompanyName: rec.rawCompanyName,
            rawFirstName: rec.rawFirstName,
            rawLastName: rec.rawLastName,
            rawJobTitle: rec.rawJobTitle,
            rawWebsite: rec.rawWebsite,
            rawCountry: rec.rawCountry,
            rawEmail: rec.rawEmail,
          },
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        currentBatch.set(contactRef, newContact, { merge: true });
        existingEmailHashMap.set(emailHash, newContact);
        opsInBatch++;
        createdContacts++;

        // 5. Deterministic Lead Creation (if enabled)
        if (decisionConfig.autoCreateLeads) {
          const leadId = generateDeterministicLeadId(contactId, decisionConfig.productInterest);
          const leadRef = doc(db, 'leads', leadId);
          const newLead: Lead = {
            id: leadId,
            leadId,
            companyId: parentCompanyId,
            companyName: rec.companyName,
            contactId,
            contactName:
              rec.contactName ||
              (rec.firstName ? `${rec.firstName} ${rec.lastName || ''}`.trim() : '') ||
              undefined,
            contactEmail: rec.businessEmail,
            productInterest: decisionConfig.productInterest || 'Egg Shell Powder',
            leadSource: `Import: ${uploadedFile.name}`,
            leadStatus: decisionConfig.defaultLeadStatus || 'NEW',
            priority: decisionConfig.defaultPriority || 'MEDIUM',
            assignedTo: currentUser?.email || 'lakshmi@yalixvalor.com',
            notes: rec.notes ? `Import: ${rec.notes}` : `Generated from import ${uploadedFile.name}`,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          currentBatch.set(leadRef, newLead, { merge: true });
          opsInBatch++;
          createdLeads++;
        }

        // Update progress state smoothly
        if (i % 20 === 0 || i === total - 1) {
          const percent = Math.min(95, Math.round(((i + 1) / total) * 90) + 5);
          setImportProgress((prev) => ({
            ...prev,
            percent,
            currentStep: `Processed row ${i + 1} of ${total} (Batch ${batchIndex})...`,
            processed: i + 1,
            currentBatch: batchIndex,
            createdCompanies,
            createdContacts,
            updatedRecords,
            skippedDuplicates,
            invalidRecords,
            createdLeads,
          }));
        }
      }

      // Commit final batch
      if (opsInBatch > 0) {
        await currentBatch.commit();
      }

      // Record Import Audit in Firestore
      const durationMs = Date.now() - startTime;
      const importRecord: ImportRecord = {
        id: importId,
        importId,
        fileName: uploadedFile.name,
        fileType: uploadedFile.name.endsWith('.csv') ? 'CSV' : 'XLSX',
        rowCount: rawRows.length,
        processedCount: total,
        createdCount: createdContacts,
        updatedCount: updatedRecords,
        duplicateCount: duplicateStats.inFileDups + duplicateStats.dbContactMatches,
        invalidCount: invalidRecords,
        skippedCount: skippedDuplicates,
        leadsCreatedCount: createdLeads,
        status: 'COMPLETED',
        createdBy: currentUser?.uid || 'user',
        createdAt: nowIso,
        summary: `Created ${createdCompanies} companies, ${createdContacts} contacts, ${createdLeads} leads. Updated ${updatedRecords}, skipped ${skippedDuplicates}.`,
      };

      await setDoc(doc(db, 'imports', importId), importRecord);

      await crmService.logAudit(
        'IMPORT_COMPLETED',
        'imports',
        importId,
        currentUser?.uid || 'user',
        currentUser?.email || undefined,
        importRecord.summary
      );

      const summary: FinalImportSummary = {
        importId,
        fileName: uploadedFile.name,
        durationMs,
        totalRows: rawRows.length,
        processed: total,
        createdCompanies,
        createdContacts,
        updatedRecords,
        skippedDuplicates,
        invalidRecords,
        createdLeads,
        rejectedRows,
        status: 'COMPLETED',
      };

      setFinalSummary(summary);
      setCurrentStep(10);
      success('Import Finished', `Synchronized ${createdContacts} contacts without duplicates.`);
      onRefresh();
    } catch (err: any) {
      console.error('Batch import execution failure:', err);
      const failedRowRange = `Rows ${batchStartRow} to ${Math.min(batchStartRow + batchOperationLimit, total)}`;

      // Record failure state in Firestore audit
      const partialRecord: ImportRecord = {
        id: importId,
        importId,
        fileName: uploadedFile.name,
        fileType: uploadedFile.name.endsWith('.csv') ? 'CSV' : 'XLSX',
        rowCount: rawRows.length,
        processedCount: createdContacts + updatedRecords,
        createdCount: createdContacts,
        updatedCount: updatedRecords,
        duplicateCount: duplicateStats.inFileDups + duplicateStats.dbContactMatches,
        invalidCount: invalidRecords,
        skippedCount: skippedDuplicates,
        leadsCreatedCount: createdLeads,
        status: 'FAILED',
        createdBy: currentUser?.uid || 'user',
        createdAt: nowIso,
        summary: `Partial failure in Batch #${batchIndex} (${failedRowRange}): ${err.message}`,
      };
      await setDoc(doc(db, 'imports', importId), partialRecord).catch(() => {});

      setImportProgress((prev) => ({
        ...prev,
        hasErrors: true,
        errorMessage: err.message || 'Unknown network or quota error',
        failedBatchIndex: batchIndex,
        failedRowRange,
      }));

      error(
        'Batch Failed',
        `Batch #${batchIndex} halted at ${failedRowRange}. Previously committed batches are safe; retry will not duplicate records.`
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Export rejected rows CSV
  const downloadRejectedRowsCsv = () => {
    if (!finalSummary || finalSummary.rejectedRows.length === 0) return;
    const headers = ['Row Number', 'Company Name', 'Contact Name', 'Email', 'Error Reasons'];
    const rows = finalSummary.rejectedRows.map((r) => [
      r.rowNumber,
      `"${(r.company || '').replace(/"/g, '""')}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.email || '').replace(/"/g, '""')}"`,
      `"${(r.reasons || []).join('; ').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `yalix_import_errors_${finalSummary.importId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setUploadedFile(null);
    setFileValidation(null);
    setRawWorkbook(null);
    setActiveSheetName('');
    setRawRows([]);
    setHeaders([]);
    setMapping({});
    setFinalSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Step 4 requirement: Company Name + Business Email are sufficient
  const isStep4Valid = Boolean(mapping.companyName && mapping.businessEmail);

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Enterprise Excel / CSV Import Engine
            </h2>
            <Badge variant="purple" size="sm">Idempotent & Failure-Aware</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            10-step incremental data synchronization pipeline for authorized YALIX B2B accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistoryTab(!showHistoryTab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showHistoryTab
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{showHistoryTab ? 'Show Import Wizard' : 'View Import History'}</span>
          </button>
        </div>
      </div>

      {showHistoryTab ? (
        <ImportHistoryList onRefreshParent={onRefresh} />
      ) : (
        <>
          {/* 10-Step Wizard Stepper Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto">
            <div className="flex items-center justify-between min-w-[760px] gap-2">
              {WIZARD_STEPS.map((s) => {
                const isPassed = currentStep > s.number;
                const isCurrent = currentStep === s.number;
                return (
                  <div key={s.number} className="flex items-center flex-1 last:flex-none">
                    <button
                      onClick={() => {
                        if (rawRows.length > 0 && s.number < currentStep && currentStep < 9) {
                          setCurrentStep(s.number);
                        }
                      }}
                      disabled={s.number > currentStep || currentStep >= 9}
                      className="flex items-center gap-2 group text-left cursor-pointer disabled:cursor-not-allowed"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                          isPassed
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20 shadow-xs'
                            : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                        }`}
                      >
                        {isPassed ? <Check className="w-3.5 h-3.5" /> : s.number}
                      </div>
                      <div className="hidden lg:block leading-none">
                        <div
                          className={`text-[11px] font-bold ${
                            isCurrent
                              ? 'text-emerald-700'
                              : isPassed
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          Step {s.number}
                        </div>
                        <div
                          className={`text-[10px] truncate max-w-[72px] ${
                            isCurrent
                              ? 'text-slate-900 font-semibold'
                              : isPassed
                              ? 'text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {s.shortLabel}
                        </div>
                      </div>
                    </button>
                    {s.number < 10 && (
                      <div
                        className={`h-0.5 flex-1 mx-2 transition-colors ${
                          currentStep > s.number ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* STEP 1: UPLOAD FILE */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="bg-white p-8 rounded-xl border border-slate-200/80 shadow-2xs max-w-2xl mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 1: Upload B2B Spreadsheet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Upload an authorized spreadsheet in <strong>.XLSX</strong> or{' '}
                  <strong>.CSV</strong> format. Processed in-memory in browser with deterministic SHA-256
                  idempotency before persistence.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileSelected}
                className="hidden"
                id="file-upload-step1"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl p-8 cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-700">
                  <Upload className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Click to select file or drag & drop here
                  </span>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Excel (.xlsx, .xls) or CSV files up to 25 MB
                  </div>
                </div>
              </div>

              {/* Compliance & Security Guardrails Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-left space-y-2 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Enterprise Compliance & Data Safety Notice:</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Only authorized B2B data legally retained by YALIX is processed. Raw files are never stored
                  in Firestore. Deterministic document keys prevent duplicate records even if an import is accidentally
                  re-run.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: FILE VALIDATION */}
          {/* ========================================================= */}
          {currentStep === 2 && fileValidation && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 2: File Validation</h3>
                  <p className="text-xs text-slate-500">
                    Automated structural and encoding verification for {fileValidation.fileName}.
                  </p>
                </div>
                <Badge variant={fileValidation.valid ? 'success' : 'danger'}>
                  {fileValidation.valid ? 'Checks Passed' : 'Validation Failed'}
                </Badge>
              </div>

              {/* File details overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Format</span>
                  <span className="font-semibold text-slate-800 uppercase">
                    .{fileValidation.fileExtension}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Size</span>
                  <span className="font-semibold text-slate-800">{fileValidation.formattedSize}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Data Rows</span>
                  <span className="font-semibold text-slate-800">{fileValidation.totalRows}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Columns</span>
                  <span className="font-semibold text-slate-800">{fileValidation.totalColumns}</span>
                </div>
              </div>

              {/* Checks checklist */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Automated Pre-Flight Checks:
                </div>
                {fileValidation.checks.map((check, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                      check.pass
                        ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                        : 'bg-rose-50/50 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {check.pass ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-bold">{check.name}</div>
                        <div className="text-[11px] opacity-80">{check.message}</div>
                      </div>
                    </div>
                    {check.details && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/70 border border-slate-200/60 text-slate-600">
                        {check.details}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Choose Another File</span>
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!fileValidation.valid}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>Step 3: Preview Raw Data</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: PREVIEW */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 3: Raw Data Preview</h3>
                  <p className="text-xs text-slate-500">
                    Inspecting first 20 rows of {rawRows.length} total rows parsed from source spreadsheet.
                  </p>
                </div>

                {rawWorkbook && rawWorkbook.SheetNames.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-semibold">Active Sheet:</span>
                    <select
                      value={activeSheetName}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="p-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium"
                    >
                      {rawWorkbook.SheetNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Scrollable table preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 font-semibold">
                      <tr>
                        <th className="p-2.5 w-12 text-slate-400">#</th>
                        {headers.map((h) => (
                          <th key={h} className="p-2.5 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rawRows.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-2.5 text-slate-400 font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          {headers.map((h) => (
                            <td key={h} className="p-2.5 text-slate-700 whitespace-nowrap max-w-xs truncate">
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Validation</span>
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Step 4: Column Mapping</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: COLUMN MAPPING */}
          {/* ========================================================= */}
          {currentStep === 4 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 4: Column Mapping</h3>
                  <p className="text-xs text-slate-500">
                    Match source columns to CRM fields. Only <strong>Company Name</strong> and{' '}
                    <strong>Business Email</strong> are strictly required.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => autoMapColumns(headers)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Detect Again</span>
                  </button>
                  <button
                    onClick={() => setMapping({})}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {!isStep4Valid && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Required mapping: Please map <strong>Company Name</strong> and{' '}
                    <strong>Business Email</strong> to proceed.
                  </span>
                </div>
              )}

              {/* Mapping grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CRM_TARGET_FIELDS.map((field) => {
                  const currentMappedCol = mapping[field.key] || '';
                  const sampleVal = currentMappedCol && rawRows[0] ? rawRows[0][currentMappedCol] : '';

                  return (
                    <div
                      key={field.key}
                      className={`p-3.5 rounded-xl border transition-all ${
                        currentMappedCol
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : field.required
                          ? 'border-amber-200 bg-amber-50/10'
                          : 'border-slate-200 bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">{field.label}</span>
                          {field.required && (
                            <span className="text-rose-500 font-bold" title="Required field">
                              *
                            </span>
                          )}
                        </div>
                        <Badge
                          variant={
                            field.entity === 'company'
                              ? 'purple'
                              : field.entity === 'contact'
                              ? 'info'
                              : 'slate'
                          }
                          size="sm"
                        >
                          {field.entity}
                        </Badge>
                      </div>

                      <select
                        value={currentMappedCol}
                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">-- Unmapped / Skip --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>

                      {sampleVal !== undefined && sampleVal !== '' && (
                        <div className="mt-1.5 text-[11px] text-slate-500 truncate">
                          <span className="text-slate-400">Sample: </span>
                          <span className="font-mono text-slate-700">{String(sampleVal)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Preview</span>
                </button>
                <button
                  onClick={() => setCurrentStep(5)}
                  disabled={!isStep4Valid}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>Step 5: Data Normalization</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 5: DATA NORMALIZATION */}
          {/* ========================================================= */}
          {currentStep === 5 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-6">
              <div className="pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">
                    Step 5: Data Normalization & Source Preservation
                  </h3>
                  <Badge variant="purple">Original Data Preserved</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Raw source values are preserved intact. Company names are never aggressively transformed (e.g.
                  McDonald&apos;s, ABC GLOBAL PTE LTD, 3M, eBay are safely preserved).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  {
                    key: 'trimWhitespace',
                    title: 'Trim Leading & Trailing Whitespace',
                    desc: 'Removes unnecessary blank padding while keeping internal spaces',
                  },
                  {
                    key: 'cleanEmails',
                    title: 'Email Syntactic Cleansing',
                    desc: 'Converts to lowercase, removes mailto:, brackets and spaces',
                  },
                  {
                    key: 'extractDomains',
                    title: 'Derive Normalized Corporate Domain',
                    desc: 'Extracts domain key from website or email for account grouping',
                  },
                  {
                    key: 'titleCaseNames',
                    title: 'Preserve Mixed Casing on Names',
                    desc: 'Keeps intentional capitalization (e.g. Dr. Elena Rostova, McDonald)',
                  },
                  {
                    key: 'splitFullNames',
                    title: 'Auto-Split Full Names',
                    desc: 'Splits full name into First & Last if separate columns absent',
                  },
                  {
                    key: 'standardizePhones',
                    title: 'Standardize Telephone Format',
                    desc: 'Sanitizes formatting while preserving country codes (+)',
                  },
                  {
                    key: 'normalizeCountries',
                    title: 'Country Standardization',
                    desc: 'Maps ISO / acronyms (USA, DE, UAE) while storing raw input',
                  },
                ].map((rule) => {
                  const isChecked = (normalizationConfig as any)[rule.key];
                  return (
                    <label
                      key={rule.key}
                      className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                        isChecked
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : 'border-slate-200 bg-slate-50/40 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setNormalizationConfig({
                            ...normalizationConfig,
                            [rule.key]: e.target.checked,
                          })
                        }
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{rule.title}</div>
                        <div className="text-[11px] text-slate-500">{rule.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Sample Comparison */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Normalized Inspection (First 3 Records):</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Company (Preserved)</th>
                        <th className="p-2.5">Contact Name</th>
                        <th className="p-2.5">Clean Email</th>
                        <th className="p-2.5">Email Hash (Key)</th>
                        <th className="p-2.5">Country</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {normalizedRecords.slice(0, 3).map((rec) => (
                        <tr key={rec.rowIndex} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-400 font-mono">#{rec.rowIndex}</td>
                          <td className="p-2.5 font-bold text-slate-800">{rec.companyName}</td>
                          <td className="p-2.5 text-slate-700">
                            {rec.contactName ? (
                              rec.contactName
                            ) : (
                              <span className="text-slate-400 italic">(blank)</span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-emerald-700">{rec.businessEmail}</td>
                          <td className="p-2.5 font-mono text-slate-400 text-[10px]">
                            {rec.emailHash ? rec.emailHash.substring(0, 12) + '...' : '—'}
                          </td>
                          <td className="p-2.5 text-slate-600">{rec.country || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Mapping</span>
                </button>
                <button
                  onClick={() => setCurrentStep(6)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Step 6: Record Validation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 6: VALIDATION */}
          {/* ========================================================= */}
          {currentStep === 6 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 6: Record Validation Audit</h3>
                  <p className="text-xs text-slate-500">
                    Syntax verification (RFC 5322 regex). Note: Syntactic validity does not prove mailbox deliverability.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="success">{validationStats.valid} Syntactically Valid</Badge>
                  {validationStats.invalid > 0 && (
                    <Badge variant="danger">{validationStats.invalid} Invalid Records</Badge>
                  )}
                  {validationStats.warnings > 0 && (
                    <Badge variant="warning">{validationStats.warnings} Warnings</Badge>
                  )}
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <button
                  onClick={() => setValidationFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    validationFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All Records ({validationStats.total})
                </button>
                <button
                  onClick={() => setValidationFilter('valid')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    validationFilter === 'valid'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Valid Only ({validationStats.valid})
                </button>
                <button
                  onClick={() => setValidationFilter('errors')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    validationFilter === 'errors'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Errors Only ({validationStats.invalid})
                </button>
              </div>

              {/* Validation table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 font-semibold">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Syntax Status</th>
                        <th className="p-2.5">Company</th>
                        <th className="p-2.5">Contact</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Validation Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationResults
                        .filter((v) => {
                          if (validationFilter === 'valid') return v.isValid;
                          if (validationFilter === 'errors') return !v.isValid;
                          return true;
                        })
                        .slice(0, 50)
                        .map((v) => (
                          <tr key={v.rowIndex} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-400 font-mono">#{v.rowIndex}</td>
                            <td className="p-2.5">
                              <Badge variant={v.isValid ? 'success' : 'danger'} size="sm">
                                {v.isValid ? 'SYNTAX_VALID' : 'INVALID'}
                              </Badge>
                            </td>
                            <td className="p-2.5 font-bold text-slate-800">{v.record.companyName}</td>
                            <td className="p-2.5 text-slate-700">
                              {v.record.fullName || (
                                <span className="text-slate-400 italic">Blank (Company Account)</span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600">{v.record.businessEmail}</td>
                            <td className="p-2.5">
                              {v.errors.length > 0 ? (
                                <span className="text-rose-600 font-medium">
                                  {v.errors.join(', ')}
                                </span>
                              ) : v.warnings.length > 0 ? (
                                <span className="text-amber-600">{v.warnings.join(', ')}</span>
                              ) : (
                                <span className="text-emerald-600">RFC 5322 syntax verified</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Normalization</span>
                </button>
                <button
                  onClick={() => setCurrentStep(7)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Step 7: Duplicate Detection</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 7: DUPLICATE DETECTION */}
          {/* ========================================================= */}
          {currentStep === 7 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Step 7: Deterministic Duplicate Detection
                  </h3>
                  <p className="text-xs text-slate-500">
                    Matching contacts via deterministic SHA-256 email key. Fuzzy company matches are labeled for review only.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="success">{duplicateStats.uniqueNew} Unique New</Badge>
                  {duplicateStats.dbContactMatches > 0 && (
                    <Badge variant="warning">{duplicateStats.dbContactMatches} CRM Matches</Badge>
                  )}
                  {duplicateStats.inFileDups > 0 && (
                    <Badge variant="purple">{duplicateStats.inFileDups} In-File Dups</Badge>
                  )}
                </div>
              </div>

              {/* Stats metric cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <span className="text-emerald-700 block text-[10px] uppercase font-bold">
                    Unique New Records
                  </span>
                  <strong className="text-lg text-emerald-900">{duplicateStats.uniqueNew}</strong>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                  <span className="text-amber-700 block text-[10px] uppercase font-bold">
                    Existing CRM Contacts
                  </span>
                  <strong className="text-lg text-amber-900">{duplicateStats.dbContactMatches}</strong>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950">
                  <span className="text-blue-700 block text-[10px] uppercase font-bold">
                    Existing CRM Companies
                  </span>
                  <strong className="text-lg text-blue-900">{duplicateStats.dbCompanyMatches}</strong>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950">
                  <span className="text-purple-700 block text-[10px] uppercase font-bold">
                    In-File Duplicates
                  </span>
                  <strong className="text-lg text-purple-900">{duplicateStats.inFileDups}</strong>
                </div>
              </div>

              {/* Duplicate Filter buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDuplicateFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    duplicateFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All ({duplicateResults.length})
                </button>
                <button
                  onClick={() => setDuplicateFilter('new')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    duplicateFilter === 'new'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  New Only ({duplicateStats.uniqueNew})
                </button>
                <button
                  onClick={() => setDuplicateFilter('duplicates')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    duplicateFilter === 'duplicates'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Duplicates Only ({duplicateStats.inFileDups + duplicateStats.dbContactMatches})
                </button>
              </div>

              {/* Deduplication inspection table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 font-semibold">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Confidence</th>
                        <th className="p-2.5">Company</th>
                        <th className="p-2.5">Contact</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Match Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {duplicateResults
                        .filter((d) => {
                          if (duplicateFilter === 'new') return !d.isFileDuplicate && !d.isDbDuplicate;
                          if (duplicateFilter === 'duplicates') return d.isFileDuplicate || d.isDbDuplicate;
                          return true;
                        })
                        .slice(0, 50)
                        .map((d) => (
                          <tr key={d.rowIndex} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-400 font-mono">#{d.rowIndex}</td>
                            <td className="p-2.5">
                              {d.isDbDuplicate ? (
                                <Badge variant="warning" size="sm">
                                  EXACT_EMAIL
                                </Badge>
                              ) : d.isFileDuplicate ? (
                                <Badge variant="purple" size="sm">
                                  IN_FILE_DUP
                                </Badge>
                              ) : d.confidence === 'POSSIBLE_DUPLICATE' ? (
                                <Badge variant="slate" size="sm">
                                  REVIEW_ONLY
                                </Badge>
                              ) : (
                                <Badge variant="success" size="sm">
                                  NEW RECORD
                                </Badge>
                              )}
                            </td>
                            <td className="p-2.5 font-bold text-slate-800">{d.record.companyName}</td>
                            <td className="p-2.5 text-slate-700">{d.record.fullName || '—'}</td>
                            <td className="p-2.5 font-mono text-slate-600">{d.record.businessEmail}</td>
                            <td className="p-2.5 text-slate-500">
                              {d.matchedContact ? (
                                <span>
                                  Matches CRM contact:{' '}
                                  <strong className="text-slate-800">
                                    {d.matchedContact.businessEmail}
                                  </strong>
                                </span>
                              ) : d.isFileDuplicate ? (
                                <span>Duplicate email with row #{d.fileDuplicateWithRow}</span>
                              ) : d.matchedCompanyMethod === 'FUZZY_NAME' ? (
                                <span className="text-amber-600">
                                  Similar company name ({d.matchedCompany?.companyName}) - Will not auto-merge
                                </span>
                              ) : (
                                <span className="text-emerald-600">Unique corporate record</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(6)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Validation</span>
                </button>
                <button
                  onClick={() => setCurrentStep(8)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Step 8: Import Decision</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 8: IMPORT DECISION */}
          {/* ========================================================= */}
          {currentStep === 8 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-6 max-w-3xl mx-auto">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">
                  Step 8: Conflict Strategy & Idempotency Controls
                </h3>
                <p className="text-xs text-slate-500">
                  Existing CRM records, notes, and stages are strictly protected. Default conflict behavior:
                  <strong> KEEP EXISTING</strong>.
                </p>
              </div>

              {/* Conflict strategy selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  1. Conflict Resolution Strategy:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                      decisionConfig.duplicateHandling === 'skip'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dup-strategy"
                        checked={decisionConfig.duplicateHandling === 'skip'}
                        onChange={() =>
                          setDecisionConfig({ ...decisionConfig, duplicateHandling: 'skip' })
                        }
                        className="text-emerald-600 cursor-pointer"
                      />
                      <span>Skip Duplicates (Default)</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Preserves existing contacts. Leaves all established fields 100% untouched.
                    </span>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                      decisionConfig.duplicateHandling === 'update'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dup-strategy"
                        checked={decisionConfig.duplicateHandling === 'update'}
                        onChange={() =>
                          setDecisionConfig({ ...decisionConfig, duplicateHandling: 'update' })
                        }
                        className="text-emerald-600 cursor-pointer"
                      />
                      <span>Update Missing Fields</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Enriches missing phone or job title. Never overwrites notes or stages with blanks.
                    </span>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                      decisionConfig.duplicateHandling === 'create_new'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dup-strategy"
                        checked={decisionConfig.duplicateHandling === 'create_new'}
                        onChange={() =>
                          setDecisionConfig({ ...decisionConfig, duplicateHandling: 'create_new' })
                        }
                        className="text-emerald-600 cursor-pointer"
                      />
                      <span>Allow As New</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Inserts contacts with distinct deterministic alias IDs.
                    </span>
                  </label>
                </div>
              </div>

              {/* Automatic Lead Generation Settings */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">
                      2. Automatic Lead Generation
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={decisionConfig.autoCreateLeads}
                      onChange={(e) =>
                        setDecisionConfig({
                          ...decisionConfig,
                          autoCreateLeads: e.target.checked,
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-slate-800">Generate Leads for Contacts</span>
                  </label>
                </div>

                {decisionConfig.autoCreateLeads && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Default Lead Status
                      </label>
                      <select
                        value={decisionConfig.defaultLeadStatus}
                        onChange={(e) =>
                          setDecisionConfig({
                            ...decisionConfig,
                            defaultLeadStatus: e.target.value as LeadStatus,
                          })
                        }
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="NEW">NEW</option>
                        <option value="RESEARCHED">RESEARCHED</option>
                        <option value="CONTACTED">CONTACTED</option>
                        <option value="INTERESTED">INTERESTED</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Default Priority
                      </label>
                      <select
                        value={decisionConfig.defaultPriority}
                        onChange={(e) =>
                          setDecisionConfig({
                            ...decisionConfig,
                            defaultPriority: e.target.value as Priority,
                          })
                        }
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                        <option value="URGENT">URGENT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Target Product Interest
                      </label>
                      <select
                        value={decisionConfig.productInterest}
                        onChange={(e) =>
                          setDecisionConfig({
                            ...decisionConfig,
                            productInterest: e.target.value,
                          })
                        }
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                      >
                        {products.length > 0 ? (
                          products.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Egg Shell Powder">Egg Shell Powder</option>
                            <option value="Egg Membrane Powder">Egg Membrane Powder</option>
                            <option value="Organic Seeds">Organic Seeds</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Invalid Rows Exclusion */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <div className="font-bold text-slate-800">Skip Invalid Records</div>
                  <div className="text-[11px] text-slate-500">
                    Omit {validationStats.invalid} syntax-failed records from import. An exportable error
                    report will be provided in Step 10.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={decisionConfig.skipInvalidRows}
                  onChange={(e) =>
                    setDecisionConfig({
                      ...decisionConfig,
                      skipInvalidRows: e.target.checked,
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(7)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Duplicates</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteImport}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Database className="w-4 h-4" />
                    <span>Execute Batched Import</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 9: IMPORT EXECUTION */}
          {/* ========================================================= */}
          {currentStep === 9 && (
            <div className="bg-white p-8 rounded-xl border border-slate-200/80 shadow-2xs max-w-xl mx-auto text-center space-y-6">
              {importProgress.hasErrors ? (
                <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 mx-auto flex items-center justify-center animate-pulse">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {importProgress.hasErrors ? 'Batch Halted' : 'Step 9: Batched & Failure-Aware Import'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{importProgress.currentStep}</p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Batch Sync Progress</span>
                  <span>{importProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 shadow-sm ${
                      importProgress.hasErrors ? 'bg-rose-500' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${importProgress.percent}%` }}
                  />
                </div>
              </div>

              {/* Real-time counters */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-2">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Processed</span>
                  <span className="text-sm font-bold text-slate-800">
                    {importProgress.processed} / {importProgress.total}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-950">
                  <span className="text-[10px] text-emerald-600 block font-bold uppercase">Contacts</span>
                  <span className="text-sm font-bold text-emerald-700">
                    +{importProgress.createdContacts}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-950">
                  <span className="text-[10px] text-blue-600 block font-bold uppercase">Companies</span>
                  <span className="text-sm font-bold text-blue-700">
                    +{importProgress.createdCompanies}
                  </span>
                </div>
              </div>

              {importProgress.hasErrors ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-left space-y-2 text-xs">
                  <div className="font-bold text-rose-900">
                    Failure in Batch #{importProgress.failedBatchIndex} ({importProgress.failedRowRange})
                  </div>
                  <div className="text-[11px] text-rose-700 font-mono">
                    {importProgress.errorMessage}
                  </div>
                  <div className="text-[11px] text-slate-600 pt-1">
                    Safe Idempotency: All previously committed records are permanently recorded under
                    deterministic keys. Retrying will not produce duplicate records.
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={handleExecuteImport}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Import</span>
                    </button>
                    <button
                      onClick={() => setCurrentStep(8)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Back to Decisions
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  Operating in chunks of {decisionConfig.batchSize} writes. Deterministic keys guarantee idempotent retry safety.
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 10: IMPORT SUMMARY */}
          {/* ========================================================= */}
          {currentStep === 10 && finalSummary && (
            <div className="bg-white p-8 rounded-xl border border-slate-200/80 shadow-2xs max-w-2xl mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 10: Import Completed Successfully</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Batch <strong>{finalSummary.importId}</strong> safely recorded in YALIX Firestore database in{' '}
                  {(finalSummary.durationMs / 1000).toFixed(1)}s.
                </p>
              </div>

              {/* Results scorecard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <span className="text-emerald-700 block text-[10px] uppercase font-bold">
                    New Contacts
                  </span>
                  <strong className="text-xl text-emerald-900">+{finalSummary.createdContacts}</strong>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950">
                  <span className="text-blue-700 block text-[10px] uppercase font-bold">
                    New Companies
                  </span>
                  <strong className="text-xl text-blue-900">+{finalSummary.createdCompanies}</strong>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950">
                  <span className="text-purple-700 block text-[10px] uppercase font-bold">
                    Leads Generated
                  </span>
                  <strong className="text-xl text-purple-900">+{finalSummary.createdLeads}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Skipped Duplicates
                  </span>
                  <strong className="text-xl text-slate-800">{finalSummary.skippedDuplicates}</strong>
                </div>
              </div>

              {/* Error report export if rejected rows exist */}
              {finalSummary.rejectedRows.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-left flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-rose-900">
                      {finalSummary.rejectedRows.length} Invalid Records Excluded
                    </div>
                    <div className="text-[11px] text-rose-700">
                      Export rejected rows with exact validation failure reasons to rectify in spreadsheet.
                    </div>
                  </div>
                  <button
                    onClick={downloadRejectedRowsCsv}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Rejections (.CSV)</span>
                  </button>
                </div>
              )}

              {/* Action Buttons & Fast Navigation */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {onNavigate && (
                  <>
                    <button
                      onClick={() => onNavigate('companies')}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>View Companies</span>
                    </button>
                    <button
                      onClick={() => onNavigate('contacts')}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>View Contacts</span>
                    </button>
                    {finalSummary.createdLeads > 0 && (
                      <button
                        onClick={() => onNavigate('leads')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>View Leads</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

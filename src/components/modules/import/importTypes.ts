import { Company, Contact, LeadStatus, Priority } from '../../../types/crm';

export type WizardStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface StepMeta {
  number: WizardStepNumber;
  key: string;
  title: string;
  shortLabel: string;
  description: string;
}

export const WIZARD_STEPS: StepMeta[] = [
  { number: 1, key: 'upload', title: 'Upload File', shortLabel: 'Upload', description: 'Select an authorized CSV or XLSX spreadsheet.' },
  { number: 2, key: 'file_validation', title: 'File Validation', shortLabel: 'Integrity', description: 'Verify format, encoding, structure, and integrity.' },
  { number: 3, key: 'preview', title: 'Data Preview', shortLabel: 'Preview', description: 'Inspect raw rows and detected sheet headers.' },
  { number: 4, key: 'column_mapping', title: 'Column Mapping', shortLabel: 'Mapping', description: 'Map source columns to YALIX CRM entity fields.' },
  { number: 5, key: 'normalization', title: 'Data Normalization', shortLabel: 'Normalize', description: 'Preserve raw data while cleansing whitespace, email & domain.' },
  { number: 6, key: 'validation', title: 'Record Validation', shortLabel: 'Validate', description: 'Audit syntactic email validity and company name presence.' },
  { number: 7, key: 'duplicate_detection', title: 'Duplicate Detection', shortLabel: 'Deduplicate', description: 'Deterministic email lookup and domain/name matching.' },
  { number: 8, key: 'decision', title: 'Import Decision', shortLabel: 'Decision', description: 'Configure non-destructive conflict strategy and lead generation.' },
  { number: 9, key: 'importing', title: 'Import Execution', shortLabel: 'Execute', description: 'Batched and failure-aware idempotent persistence.' },
  { number: 10, key: 'summary', title: 'Import Summary', shortLabel: 'Summary', description: 'Review audit metrics, rejections report, and quick links.' },
];

export interface FileCheckItem {
  name: string;
  pass: boolean;
  message: string;
  details?: string;
}

export interface FileValidationResult {
  valid: boolean;
  fileName: string;
  fileSizeBytes: number;
  formattedSize: string;
  fileExtension: string;
  mimeType: string;
  sheetCount: number;
  sheetNames: string[];
  totalRows: number;
  totalColumns: number;
  checks: FileCheckItem[];
}

export interface TargetFieldDef {
  key: string;
  label: string;
  required: boolean;
  entity: 'company' | 'contact' | 'lead' | 'general';
  description: string;
  synonyms: string[];
}

export const CRM_TARGET_FIELDS: TargetFieldDef[] = [
  {
    key: 'companyName',
    label: 'Company Name',
    required: true,
    entity: 'company',
    description: 'B2B Account or Organization name (Primary required field)',
    synonyms: ['company', 'company name', 'organization', 'organisation', 'client', 'account', 'business', 'employer', 'account name', 'firm'],
  },
  {
    key: 'businessEmail',
    label: 'Business Email',
    required: true,
    entity: 'contact',
    description: 'Official corporate email address (Deterministic lookup key)',
    synonyms: ['email', 'business email', 'work email', 'e-mail', 'mail', 'contact email', 'corporate email', 'email address'],
  },
  {
    key: 'firstName',
    label: 'Contact First Name',
    required: false,
    entity: 'contact',
    description: 'Given name of contact (Optional: Company + Email is sufficient)',
    synonyms: ['first name', 'firstname', 'fname', 'given name', 'contact first name'],
  },
  {
    key: 'lastName',
    label: 'Contact Last Name',
    required: false,
    entity: 'contact',
    description: 'Family name / surname of contact',
    synonyms: ['last name', 'lastname', 'lname', 'surname', 'family name', 'contact last name'],
  },
  {
    key: 'fullName',
    label: 'Contact Full Name (Auto-split)',
    required: false,
    entity: 'contact',
    description: 'Combined name: parses into First and Last name if provided',
    synonyms: ['full name', 'fullname', 'contact full name', 'contact name', 'person name', 'lead name', 'contact person'],
  },
  {
    key: 'website',
    label: 'Website / Domain',
    required: false,
    entity: 'company',
    description: 'Company website URL used for domain-level matching',
    synonyms: ['website', 'site', 'url', 'web', 'domain', 'company url', 'homepage', 'web site'],
  },
  {
    key: 'industry',
    label: 'Industry / Sector',
    required: false,
    entity: 'company',
    description: 'Industry vertical (e.g. Nutraceuticals, Food, Agriculture)',
    synonyms: ['industry', 'sector', 'vertical', 'business type', 'category', 'line of business'],
  },
  {
    key: 'country',
    label: 'Country',
    required: false,
    entity: 'general',
    description: 'Geographic location or registered headquarters country',
    synonyms: ['country', 'nation', 'region', 'state/country', 'location'],
  },
  {
    key: 'city',
    label: 'City',
    required: false,
    entity: 'company',
    description: 'City or town of headquarters',
    synonyms: ['city', 'town', 'municipality', 'metro'],
  },
  {
    key: 'state',
    label: 'State / Province',
    required: false,
    entity: 'company',
    description: 'State or province',
    synonyms: ['state', 'province', 'region', 'territory', 'st'],
  },
  {
    key: 'phone',
    label: 'Phone / Mobile',
    required: false,
    entity: 'contact',
    description: 'Direct telephone number or office line',
    synonyms: ['phone', 'telephone', 'mobile', 'cell', 'tel', 'phone number', 'contact phone', 'direct line'],
  },
  {
    key: 'jobTitle',
    label: 'Job Title / Designation',
    required: false,
    entity: 'contact',
    description: 'Executive title (e.g. Sourcing Manager, VP Procurement)',
    synonyms: ['job title', 'title', 'role', 'designation', 'position', 'job', 'function'],
  },
  {
    key: 'department',
    label: 'Department',
    required: false,
    entity: 'contact',
    description: 'Department unit (e.g. Procurement, R&D)',
    synonyms: ['department', 'dept', 'division', 'unit'],
  },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn Profile URL',
    required: false,
    entity: 'contact',
    description: 'LinkedIn personal or corporate page link',
    synonyms: ['linkedin', 'linkedin url', 'linkedin profile', 'social'],
  },
  {
    key: 'notes',
    label: 'Notes / Comments',
    required: false,
    entity: 'general',
    description: 'Observations, requirements, or raw source context',
    synonyms: ['notes', 'comments', 'remarks', 'description', 'detail', 'summary', 'about'],
  },
];

export type ColumnMappingState = Record<string, string>;

export interface NormalizationConfig {
  trimWhitespace: boolean;
  cleanEmails: boolean;
  standardizePhones: boolean;
  titleCaseNames: boolean;
  titleCaseCompanies: boolean;
  normalizeCountries: boolean;
  extractDomains: boolean;
  splitFullNames: boolean;
}

export interface NormalizedRecord {
  rowIndex: number;
  companyName: string;
  website: string;
  domain: string;
  industry: string;
  country: string;
  city: string;
  state: string;
  firstName: string;
  lastName: string;
  fullName: string;
  contactName: string;
  businessEmail: string;
  emailHash: string; // Deterministic SHA-256 email key
  phone: string;
  jobTitle: string;
  department: string;
  linkedinUrl: string;
  notes: string;
  // Raw Source Values Preserved Intact
  rawCompanyName: string;
  rawFirstName: string;
  rawLastName: string;
  rawJobTitle: string;
  rawWebsite: string;
  rawCountry: string;
  rawEmail: string;
  rawOriginal: Record<string, any>;
}

export interface RecordValidationResult {
  rowIndex: number;
  record: NormalizedRecord;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DuplicateAnalysisResult {
  rowIndex: number;
  record: NormalizedRecord;
  validation: RecordValidationResult;
  isFileDuplicate: boolean;
  fileDuplicateWithRow?: number;
  isDbDuplicate: boolean;
  matchedContact?: Contact;
  matchedCompany?: Company;
  matchType: 'NONE' | 'EXACT_EMAIL' | 'COMPANY_NAME' | 'DOMAIN' | 'POSSIBLE_DUPLICATE';
  confidence: 'EXACT_MATCH' | 'POSSIBLE_DUPLICATE' | 'NONE';
  matchedCompanyMethod?: 'EXACT_DOMAIN' | 'EXACT_NAME' | 'FUZZY_NAME';
}

export interface ImportDecisionConfig {
  duplicateHandling: 'skip' | 'update' | 'create_new';
  autoCreateLeads: boolean;
  defaultLeadStatus: LeadStatus;
  defaultPriority: Priority;
  productInterest: string;
  skipInvalidRows: boolean;
  batchSize: number;
}

export interface ExecutionProgress {
  currentStep: string;
  processed: number;
  total: number;
  percent: number;
  currentBatch: number;
  totalBatches: number;
  createdCompanies: number;
  createdContacts: number;
  updatedRecords: number;
  skippedDuplicates: number;
  invalidRecords: number;
  createdLeads: number;
  hasErrors?: boolean;
  failedBatchIndex?: number;
  failedRowRange?: string;
  errorMessage?: string;
}

export interface RejectedRowDetail {
  rowNumber: number;
  company: string;
  name: string;
  email: string;
  reasons: string[];
}

export interface FinalImportSummary {
  importId: string;
  fileName: string;
  durationMs: number;
  totalRows: number;
  processed: number;
  createdCompanies: number;
  createdContacts: number;
  updatedRecords: number;
  skippedDuplicates: number;
  invalidRecords: number;
  createdLeads: number;
  rejectedRows: RejectedRowDetail[];
  status: 'COMPLETED' | 'PARTIALLY_FAILED';
  failedBatchIndex?: number;
  failedRowRange?: string;
  errorMessage?: string;
}

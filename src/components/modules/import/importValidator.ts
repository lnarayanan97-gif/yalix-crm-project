import * as XLSX from 'xlsx';
import { Company, Contact } from '../../../types/crm';
import {
  DuplicateAnalysisResult,
  FileCheckItem,
  FileValidationResult,
  NormalizedRecord,
  RecordValidationResult,
} from './importTypes';
import { sha256Sync } from './importCrypto';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 1. File Validation
export async function validateSpreadsheetFile(file: File): Promise<{
  validation: FileValidationResult;
  workbook?: XLSX.WorkBook;
  firstSheetData?: Record<string, any>[];
  headers?: string[];
}> {
  const checks: FileCheckItem[] = [];
  const fileName = file.name;
  const ext = fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
  const size = file.size;
  const mime = file.type || 'unknown/binary';

  // Check 1: File Extension
  const allowedExtensions = ['csv', 'xlsx', 'xls'];
  const extPass = allowedExtensions.includes(ext);
  checks.push({
    name: 'File Extension',
    pass: extPass,
    message: extPass
      ? `Valid extension (.${ext.toUpperCase()})`
      : `Invalid extension (.${ext}). Only .XLSX, .XLS, and .CSV are supported.`,
    details: `Detected: .${ext}`,
  });

  // Check 2: File Size
  const sizePass = size > 0 && size <= MAX_FILE_SIZE_BYTES;
  checks.push({
    name: 'File Size',
    pass: sizePass,
    message:
      size === 0
        ? 'File is empty (0 Bytes)'
        : size > MAX_FILE_SIZE_BYTES
        ? `File exceeds maximum 25 MB limit (${formatBytes(size)})`
        : `Acceptable file size (${formatBytes(size)})`,
    details: formatBytes(size),
  });

  // Check 3: MIME Type
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/octet-stream',
    'application/csv',
    '',
  ];
  const mimePass = allowedMimes.includes(mime.toLowerCase()) || extPass;
  checks.push({
    name: 'MIME Type & Integrity',
    pass: mimePass,
    message: mimePass
      ? `MIME type validated (${mime || 'standard binary'})`
      : `Unrecognized MIME type: ${mime}`,
    details: mime || 'application/octet-stream',
  });

  if (!extPass || !sizePass) {
    return {
      validation: {
        valid: false,
        fileName,
        fileSizeBytes: size,
        formattedSize: formatBytes(size),
        fileExtension: ext,
        mimeType: mime,
        sheetCount: 0,
        sheetNames: [],
        totalRows: 0,
        totalColumns: 0,
        checks,
      },
    };
  }

  // Check 4 & 5: Readability, Sheets & Encoding
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, raw: false });

    const sheetCount = wb.SheetNames.length;
    const sheetsPass = sheetCount > 0;
    checks.push({
      name: 'Workbook Structure',
      pass: sheetsPass,
      message: sheetsPass
        ? `Readable workbook with ${sheetCount} sheet${sheetCount > 1 ? 's' : ''}`
        : 'Workbook contains no readable sheets',
      details: wb.SheetNames.join(', '),
    });

    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

    const rowsPass = rawJson.length > 0;
    checks.push({
      name: 'Data Density & Encoding',
      pass: rowsPass,
      message: rowsPass
        ? `Successfully parsed ${rawJson.length} data rows from sheet "${firstSheetName}"`
        : `Sheet "${firstSheetName}" is empty with 0 data rows`,
      details: rowsPass ? `Rows: ${rawJson.length}` : 'Empty',
    });

    const headers = rawJson.length > 0 ? Object.keys(rawJson[0]) : [];
    const overallValid = checks.every((c) => c.pass);

    return {
      validation: {
        valid: overallValid,
        fileName,
        fileSizeBytes: size,
        formattedSize: formatBytes(size),
        fileExtension: ext,
        mimeType: mime,
        sheetCount,
        sheetNames: wb.SheetNames,
        totalRows: rawJson.length,
        totalColumns: headers.length,
        checks,
      },
      workbook: wb,
      firstSheetData: rawJson,
      headers,
    };
  } catch (err: any) {
    checks.push({
      name: 'Spreadsheet Parsing',
      pass: false,
      message: 'Failed to parse spreadsheet buffer: ' + err.message,
      details: 'Corrupted file or incompatible format',
    });

    return {
      validation: {
        valid: false,
        fileName,
        fileSizeBytes: size,
        formattedSize: formatBytes(size),
        fileExtension: ext,
        mimeType: mime,
        sheetCount: 0,
        sheetNames: [],
        totalRows: 0,
        totalColumns: 0,
        checks,
      },
    };
  }
}

// 2. Individual Record Validation (Syntax only)
// RFC 5322 compliant regex for syntactic validation (does not guarantee SMTP deliverability)
const EMAIL_SYNTAX_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateNormalizedRecord(record: NormalizedRecord): RecordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required Field 1: Business Email (Syntax Verification Only)
  if (!record.businessEmail) {
    errors.push('Missing business email address');
  } else if (!EMAIL_SYNTAX_REGEX.test(record.businessEmail)) {
    errors.push(`Syntactically invalid email format: "${record.businessEmail}"`);
  } else if (record.businessEmail.length > 200) {
    errors.push('Email address exceeds 200 characters');
  }

  // Required Field 2: Company Name
  if (!record.companyName) {
    errors.push('Missing company name');
  } else if (record.companyName.length > 200) {
    errors.push('Company name exceeds 200 characters');
  }

  // Contact First Name is OPTIONAL (Company Name + valid Business Email is sufficient)
  if (!record.firstName) {
    warnings.push('Contact name blank (registered under corporate account)');
  } else if (record.firstName.length > 100) {
    errors.push('First name exceeds 100 characters');
  }

  // Non-fatal quality warnings
  if (record.phone) {
    const digitsOnly = record.phone.replace(/\D/g, '');
    if (digitsOnly.length > 0 && digitsOnly.length < 6) {
      warnings.push(`Irregular phone number length: ${record.phone}`);
    }
  }

  if (!record.country) {
    warnings.push('Country unspecified');
  }

  return {
    rowIndex: record.rowIndex,
    record,
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 3. Multi-level Duplicate Detection & Deterministic Matching
 * Primary Contact Key: Normalized Business Email (via deterministic SHA-256 key)
 * Primary Company Key: Exact Normalized Domain or Exact Normalized Company Name
 * Secondary: Fuzzy name similarity is flagged ONLY as POSSIBLE_DUPLICATE (Never auto-merged)
 */
export function detectDuplicates(
  records: NormalizedRecord[],
  validations: RecordValidationResult[],
  existingContacts: Contact[],
  existingCompanies: Company[]
): DuplicateAnalysisResult[] {
  // DB indexes by email hash and normalized email
  const existingEmailMap = new Map<string, Contact>();
  const existingEmailHashMap = new Map<string, Contact>();

  existingContacts.forEach((c) => {
    if (c.businessEmail) {
      const cleanEmail = c.businessEmail.toLowerCase().trim();
      existingEmailMap.set(cleanEmail, c);
      existingEmailHashMap.set(sha256Sync(cleanEmail), c);
    }
  });

  // DB indexes for companies
  const existingCompanyNameMap = new Map<string, Company>();
  const existingDomainMap = new Map<string, Company>();

  existingCompanies.forEach((co) => {
    if (co.companyName) {
      existingCompanyNameMap.set(co.companyName.toLowerCase().trim(), co);
    }
    if (co.website) {
      const dom = co.website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
      if (dom) existingDomainMap.set(dom, co);
    }
  });

  // Intra-file tracker by email hash
  const seenFileEmailHashes = new Map<string, number>();

  return records.map((rec, idx) => {
    const val = validations[idx] || validateNormalizedRecord(rec);
    const emailNorm = rec.businessEmail.toLowerCase().trim();
    const emailHash = rec.emailHash || (emailNorm ? sha256Sync(emailNorm) : '');
    const compNorm = rec.companyName.toLowerCase().trim();
    const domainNorm = rec.domain.toLowerCase().trim();

    // 1. In-File Duplicate Check
    let isFileDuplicate = false;
    let fileDuplicateWithRow: number | undefined;

    if (emailHash) {
      if (seenFileEmailHashes.has(emailHash)) {
        isFileDuplicate = true;
        fileDuplicateWithRow = seenFileEmailHashes.get(emailHash);
      } else {
        seenFileEmailHashes.set(emailHash, rec.rowIndex);
      }
    }

    // 2. Database Contact Duplicate (Exact Email Match Only)
    let isDbDuplicate = false;
    let matchedContact: Contact | undefined;
    let matchType: 'NONE' | 'EXACT_EMAIL' | 'COMPANY_NAME' | 'DOMAIN' | 'POSSIBLE_DUPLICATE' = 'NONE';
    let confidence: 'EXACT_MATCH' | 'POSSIBLE_DUPLICATE' | 'NONE' = 'NONE';

    if (emailHash && (existingEmailHashMap.has(emailHash) || existingEmailMap.has(emailNorm))) {
      isDbDuplicate = true;
      matchedContact = existingEmailHashMap.get(emailHash) || existingEmailMap.get(emailNorm);
      matchType = 'EXACT_EMAIL';
      confidence = 'EXACT_MATCH';
    }

    // 3. Database Company Duplicate (Domain > Exact Name > Fuzzy)
    let matchedCompany: Company | undefined;
    let matchedCompanyMethod: 'EXACT_DOMAIN' | 'EXACT_NAME' | 'FUZZY_NAME' | undefined;

    if (domainNorm && existingDomainMap.has(domainNorm)) {
      matchedCompany = existingDomainMap.get(domainNorm);
      matchedCompanyMethod = 'EXACT_DOMAIN';
      if (matchType === 'NONE') {
        matchType = 'DOMAIN';
        confidence = 'EXACT_MATCH';
      }
    } else if (compNorm && existingCompanyNameMap.has(compNorm)) {
      matchedCompany = existingCompanyNameMap.get(compNorm);
      matchedCompanyMethod = 'EXACT_NAME';
      if (matchType === 'NONE') {
        matchType = 'COMPANY_NAME';
        confidence = 'EXACT_MATCH';
      }
    } else if (compNorm.length > 5) {
      // Fuzzy check: only flag as POSSIBLE_DUPLICATE / REVIEW, NEVER auto-merge
      for (const [existingName, existingCo] of existingCompanyNameMap.entries()) {
        if (
          existingName.includes(compNorm) ||
          compNorm.includes(existingName) ||
          (existingName.slice(0, 8) === compNorm.slice(0, 8) && compNorm.length >= 8)
        ) {
          // Found plausible fuzzy match
          matchedCompany = existingCo;
          matchedCompanyMethod = 'FUZZY_NAME';
          if (matchType === 'NONE') {
            matchType = 'POSSIBLE_DUPLICATE';
            confidence = 'POSSIBLE_DUPLICATE';
          }
          break;
        }
      }
    }

    return {
      rowIndex: rec.rowIndex,
      record: rec,
      validation: val,
      isFileDuplicate,
      fileDuplicateWithRow,
      isDbDuplicate,
      matchedContact,
      matchedCompany,
      matchType,
      confidence,
      matchedCompanyMethod,
    };
  });
}

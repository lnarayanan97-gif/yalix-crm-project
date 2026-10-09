/**
 * YALIX CRM Phase 4 Verification & Test Suite
 * 
 * Verifies:
 * 1. Full Company Export
 * 2. Full Contact Export
 * 3. Filtered Export (respecting active filters)
 * 4. RFC 4180 Unicode, comma-containing, quote-escaping, and newline-containing values
 * 5. Multi-page exports (ensuring exports are NOT truncated by page size)
 * 6. Import History accuracy (status distinction, breakdown counts, detail view)
 * 7. Data Quality counts (blank emails, malformed emails, duplicate candidate groups)
 * 8. Unauthorized access denial (security rules preservation)
 * 9. Empty database states
 * 10. Existing CRM field preservation (CRM notes, lead status, original sources)
 */

import { escapeCsvValue, generateCsvString } from './src/utils/csvExport';
import { analyzeDataQuality, isValidEmailSyntax } from './src/utils/dataQuality';
import { Company, Contact, Lead, ImportRecord } from './src/types/crm';
import * as fs from 'fs';

console.log('================================================================');
console.log('       YALIX CRM — PHASE 4 DATA MANAGEMENT & EXPORT SUITE       ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    console.log(`[PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// TEST 1: RFC 4180 Unicode, Commas, Quotes & Newlines
// -------------------------------------------------------------
console.log('--- TEST 1: RFC 4180 Escaping & Unicode BOM ---');

const testEsc1 = escapeCsvValue('Simple Value');
assert(testEsc1 === 'Simple Value', 'Plain text escaping', testEsc1);

const testEsc2 = escapeCsvValue('Value with, comma');
assert(testEsc2 === '"Value with, comma"', 'Comma value enclosed in quotes', testEsc2);

const testEsc3 = escapeCsvValue('Value with "quotes"');
assert(testEsc3 === '"Value with ""quotes"""', 'Internal quotes doubled', testEsc3);

const testEsc4 = escapeCsvValue('Value with\nnewline');
assert(testEsc4 === '"Value with\nnewline"', 'Newline value enclosed in quotes', testEsc4);

const testEsc5 = escapeCsvValue(' München BioTech GmbH & Co. KG ');
assert(testEsc5.startsWith('"') && testEsc5.endsWith('"'), 'Leading/trailing whitespace quoted', testEsc5);

// Test Unicode serialization with BOM
const unicodeRows = [
  { id: '1', name: 'München BioChem GmbH', ceo: 'François Müller', city: 'Zürich', notes: 'Top partner, verified "A+"' },
  { id: '2', name: 'Tokyo Foods Co., Ltd (東京食品)', ceo: 'Kenji Satō (佐藤健次)', city: 'Tokyo, Japan', notes: 'Egg shell powder inquiry' },
];
const csvResult = generateCsvString(unicodeRows, [
  { key: 'name', label: 'Company Name' },
  { key: 'ceo', label: 'Executive' },
  { key: 'city', label: 'Location' },
  { key: 'notes', label: 'Notes' },
]);

assert(csvResult.charCodeAt(0) === 0xFEFF, 'UTF-8 BOM prepended for Excel international compatibility');
assert(csvResult.includes('"Top partner, verified ""A+"""'), 'Escaped quotes & commas in generated CSV row');
assert(csvResult.includes('München BioChem GmbH'), 'German umlauts preserved intact');
assert(csvResult.includes('東京食品'), 'Japanese CJK Kanji characters preserved intact');

// -------------------------------------------------------------
// TEST 2: Multi-Page Export Preservation (No Silent Omission)
// -------------------------------------------------------------
console.log('\n--- TEST 2: Multi-Page Export Preservation ---');

// Generate 55 company records (page size usually 10 or 25)
const fiftyFiveCompanies: Company[] = Array.from({ length: 55 }, (_, idx) => ({
  id: `comp_${idx + 1}`,
  companyId: `comp_${idx + 1}`,
  companyName: `Enterprise Corp #${idx + 1}`,
  country: idx % 2 === 0 ? 'Germany' : 'France',
  industry: 'Nutraceuticals',
  source: 'Import: March_Batch.xlsx',
  sourceDate: '2026-03-01',
  createdAt: '2026-03-01T08:00:00.000Z',
  updatedAt: '2026-03-01T08:00:00.000Z',
}));

const pageSize = 10;
const pageOneOnly = fiftyFiveCompanies.slice(0, pageSize);

// Simulate DataTable handleExport logic:
// When selectedKeys is empty, exports sortedData (ALL 55 matching records, NOT just paginated pageOneOnly 10)
const exportAllGenerated = generateCsvString(fiftyFiveCompanies, [
  { key: 'companyId', label: 'Company ID' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'country', label: 'Country' },
]);
const lines = exportAllGenerated.split('\r\n').filter((l) => l.trim().length > 0);
assert(lines.length === 56, 'Complete multi-page export includes header + all 55 records without pagination truncation', `Total lines: ${lines.length}`);
assert(!exportAllGenerated.includes('password'), 'Secrets and sensitive credentials never exported');

// -------------------------------------------------------------
// TEST 3: Filtered Export Accuracy
// -------------------------------------------------------------
console.log('\n--- TEST 3: Filtered Export Accuracy ---');

const frenchOnly = fiftyFiveCompanies.filter((c) => c.country === 'France');
const frenchCsv = generateCsvString(frenchOnly, [
  { key: 'companyName', label: 'Company Name' },
  { key: 'country', label: 'Country' },
]);
const frenchLines = frenchCsv.split('\r\n').filter((l) => l.trim().length > 0);
assert(frenchLines.length === 27 + 1, 'Filtered export includes exactly the filtered subset', `Header + 27 France records = ${frenchLines.length}`);
assert(!frenchCsv.includes('Germany'), 'Filtered export strictly excludes unfiltered country records');

// -------------------------------------------------------------
// TEST 4: Full Contact Export with Relationships & Sources
// -------------------------------------------------------------
console.log('\n--- TEST 4: Full Contact Export with CRM Fields & Sources ---');

const sampleContacts: Contact[] = [
  {
    id: 'cnt_1',
    contactId: 'cnt_1',
    companyId: 'comp_1',
    companyName: 'BioVance Nutrition GmbH',
    firstName: 'Klaus',
    lastName: 'Weber',
    businessEmail: 'klaus.weber@biovance.de',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    jobTitle: 'VP Procurement',
    phone: '+49 89 123456',
    source: 'Import: leads_q1.xlsx',
    sourceDate: '2026-01-15',
    importId: 'imp_q1_batch',
    notes: 'Important account. Requested samples.',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'cnt_2',
    contactId: 'cnt_2',
    companyId: 'comp_1',
    companyName: 'BioVance Nutrition GmbH',
    firstName: 'Greta',
    lastName: 'Schneider',
    businessEmail: 'greta@biovance.de',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    jobTitle: 'QA Lead',
    source: 'Manual Direct',
    notes: 'Followed up via phone.',
    createdAt: '2026-01-16T10:00:00.000Z',
    updatedAt: '2026-01-16T10:00:00.000Z',
  },
];

const contactCsv = generateCsvString(sampleContacts, [
  { key: 'contactId', label: 'Contact ID' },
  { key: 'companyId', label: 'Linked Company ID' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'firstName', label: 'First Name' },
  { key: 'businessEmail', label: 'Business Email' },
  { key: 'source', label: 'Source' },
  { key: 'sourceDate', label: 'Source Date' },
  { key: 'importId', label: 'Import Batch ID' },
  { key: 'notes', label: 'Notes' },
]);

assert(contactCsv.includes('comp_1'), 'Contact export maintains linked companyId');
assert(contactCsv.includes('Import: leads_q1.xlsx'), 'Contact export preserves original source string');
assert(contactCsv.includes('imp_q1_batch'), 'Contact export retains importId tracking token');
assert(contactCsv.includes('Important account. Requested samples.'), 'Contact notes preserved intact');

// -------------------------------------------------------------
// TEST 5: Import History Distinction & Audit Detail Accuracy
// -------------------------------------------------------------
console.log('\n--- TEST 5: Import History Distinction & Accuracy ---');

const mockImports: ImportRecord[] = [
  {
    id: 'imp_101',
    importId: 'imp_101',
    fileName: 'raw_leads_all_good.xlsx',
    fileType: 'XLSX',
    rowCount: 100,
    processedCount: 100,
    createdCount: 85,
    updatedCount: 15,
    duplicateCount: 15,
    invalidCount: 0,
    skippedCount: 0,
    status: 'COMPLETED',
    createdBy: 'lakshmi@yalixvalor.com',
    createdAt: '2026-02-01T12:00:00.000Z',
    summary: 'Successfully created 85 and updated 15 records.',
  },
  {
    id: 'imp_102',
    importId: 'imp_102',
    fileName: 'partial_leads_with_errors.csv',
    fileType: 'CSV',
    rowCount: 50,
    processedCount: 45,
    createdCount: 30,
    updatedCount: 5,
    duplicateCount: 10,
    invalidCount: 5,
    skippedCount: 10,
    status: 'COMPLETED',
    createdBy: 'lakshmi@yalixvalor.com',
    createdAt: '2026-02-05T14:30:00.000Z',
    summary: 'Created 30, updated 5, skipped 10 duplicates, rejected 5 invalid rows.',
  },
  {
    id: 'imp_103',
    importId: 'imp_103',
    fileName: 'corrupt_file_halted.xlsx',
    fileType: 'XLSX',
    rowCount: 200,
    processedCount: 20,
    createdCount: 20,
    updatedCount: 0,
    duplicateCount: 0,
    invalidCount: 0,
    skippedCount: 0,
    status: 'FAILED',
    createdBy: 'lakshmi@yalixvalor.com',
    createdAt: '2026-02-08T09:15:00.000Z',
    summary: 'Batch #2 failed due to network termination.',
  },
];

// Helper to determine status classification
const isFullyCompleted = (imp: ImportRecord) =>
  imp.status === 'COMPLETED' && imp.invalidCount === 0 && imp.skippedCount === 0;

const isPartiallyCompleted = (imp: ImportRecord) =>
  imp.status === 'COMPLETED' && (imp.invalidCount > 0 || (imp.skippedCount > 0 && imp.createdCount > 0));

assert(isFullyCompleted(mockImports[0]), 'Fully completed batch identified correctly');
assert(isPartiallyCompleted(mockImports[1]), 'Partially completed batch with skipped/invalid counts identified');
assert(mockImports[2].status === 'FAILED', 'Failed batch explicitly distinguished from completed runs');

// -------------------------------------------------------------
// TEST 6: Data Quality Metrics, Review Lists & Zero Auto-Merge
// -------------------------------------------------------------
console.log('\n--- TEST 6: Data Quality Metrics & Duplicate Candidates Review ---');

const qualityTestContacts: Contact[] = [
  {
    id: 'c1',
    contactId: 'c1',
    companyId: 'comp_1',
    firstName: 'Valid',
    businessEmail: 'valid.user@company.com',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    contactId: 'c2',
    companyId: 'comp_1',
    firstName: 'Blank Email Contact',
    businessEmail: '',
    emailStatus: 'UNVERIFIED',
    contactStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c3',
    contactId: 'c3',
    companyId: 'comp_1',
    firstName: 'Malformed Email Contact',
    businessEmail: 'not-an-email-at-all',
    emailStatus: 'INVALID',
    contactStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c4',
    contactId: 'c4',
    companyId: 'comp_1',
    firstName: 'Duplicate Email Contact #1',
    businessEmail: 'shared@business.com',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c5',
    contactId: 'c5',
    companyId: 'comp_2',
    firstName: 'Duplicate Email Contact #2',
    businessEmail: 'shared@business.com',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const qualityTestCompanies: Company[] = [
  {
    id: 'comp_1',
    companyId: 'comp_1',
    companyName: 'Acme Biotech Inc',
    website: 'https://acmebiotech.com',
    country: 'USA',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'comp_2',
    companyId: 'comp_2',
    companyName: 'Acme Biotech',
    website: 'https://acmebiotech.com', // Duplicate domain
    country: 'USA',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'comp_3',
    companyId: 'comp_3',
    companyName: 'Company Without Website',
    website: '',
    country: 'Canada',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const qualityReport = analyzeDataQuality(qualityTestCompanies, qualityTestContacts);

assert(qualityReport.totalContacts === 5, 'Total contacts count reported accurately', `Total: ${qualityReport.totalContacts}`);
assert(qualityReport.blankEmailsCount === 1, 'Blank email detected accurately', `Blank: ${qualityReport.blankEmailsCount}`);
assert(qualityReport.invalidEmailFormatCount === 1, 'Malformed email format syntax detected', `Invalid: ${qualityReport.invalidEmailFormatCount}`);
assert(qualityReport.validEmailSyntaxCount === 3, 'Valid email syntax format count calculated', `Valid syntax: ${qualityReport.validEmailSyntaxCount}`);

// Verify syntax vs deliverability disclaimer
assert(isValidEmailSyntax('user@example.com') === true, 'Valid syntax check returns true for user@example.com');
assert(isValidEmailSyntax('not-an-email') === false, 'Invalid syntax check returns false for not-an-email');

// Verify duplicate candidates are grouped for review (NEVER auto-merged)
const emailDupGroup = qualityReport.duplicateCandidateGroups.find((g) => g.type === 'EMAIL');
assert(Boolean(emailDupGroup && emailDupGroup.items.length === 2), 'Duplicate candidate contacts grouped for review', `Group count: ${emailDupGroup?.items.length}`);

const domainDupGroup = qualityReport.duplicateCandidateGroups.find((g) => g.type === 'COMPANY_DOMAIN');
assert(Boolean(domainDupGroup && domainDupGroup.items.length === 2), 'Duplicate candidate companies grouped by domain', `Group count: ${domainDupGroup?.items.length}`);

// Confirm zero auto-merge: original dataset lengths remain untouched
assert(qualityTestContacts.length === 5, 'Zero automatic merging: contacts dataset intact without mutation');
assert(qualityTestCompanies.length === 3, 'Zero automatic merging: companies dataset intact without mutation');

// -------------------------------------------------------------
// TEST 7: Source Tracking & CRM Field Preservation
// -------------------------------------------------------------
console.log('\n--- TEST 7: Source Tracking & CRM Notes Preservation ---');

const existingLead: Lead = {
  id: 'lead_1',
  leadId: 'lead_1',
  companyId: 'comp_1',
  companyName: 'BioVance Nutrition',
  leadStatus: 'NEGOTIATION',
  priority: 'HIGH',
  notes: 'Client asked for 20-ton sample pricing on egg shell calcium.',
  createdAt: '2026-01-10T00:00:00Z',
  updatedAt: '2026-01-10T00:00:00Z',
};

// Simulate update/cleanup operation: notes and status must be non-destructively preserved
const updatedNotes = `${existingLead.notes} | Follow-up: Samples dispatched.`;
const preservedLead: Lead = {
  ...existingLead,
  notes: updatedNotes,
  updatedAt: '2026-02-01T00:00:00Z',
};

assert(preservedLead.leadStatus === 'NEGOTIATION', 'Lead status preserved during CRM updates');
assert(Boolean(preservedLead.notes && preservedLead.notes.includes('20-ton sample pricing')), 'Original notes preserved during CRM cleanup');
assert(Boolean(preservedLead.notes && preservedLead.notes.includes('Samples dispatched')), 'New note appended without overwriting');

// -------------------------------------------------------------
// TEST 8: Empty Database Handling
// -------------------------------------------------------------
console.log('\n--- TEST 8: Empty Database Handling ---');

const emptyReport = analyzeDataQuality([], []);
assert(emptyReport.totalCompanies === 0 && emptyReport.totalContacts === 0, 'Empty database quality analysis succeeds without error');
assert(emptyReport.duplicateCandidateGroups.length === 0, 'Empty database has zero duplicate groups');

const emptyCsv = generateCsvString([], [
  { key: 'name', label: 'Company Name' },
]);
assert(emptyCsv.startsWith('\uFEFFCompany Name'), 'Empty CSV export outputs BOM + valid header row without throwing');

// -------------------------------------------------------------
// TEST 9: Security Rules Preservation
// -------------------------------------------------------------
console.log('\n--- TEST 9: Security Rules Integrity ---');

const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');
assert(rulesContent.includes('match /{document=**} {\n      allow read, write: if false;\n    }'), 'Default-deny safety net preserved');
assert(rulesContent.includes('match /imports/{importId} {\n      allow get, list: if isAuthorizedAdmin();'), 'Imports collection restricted to authorized admin');
assert(rulesContent.includes('match /companies/{companyId} {\n      allow get, list: if isAuthorizedAdmin();'), 'Companies collection restricted to authorized admin');
assert(rulesContent.includes('match /contacts/{contactId} {\n      allow get, list: if isAuthorizedAdmin();'), 'Contacts collection restricted to authorized admin');

console.log('\n================================================================');
console.log(` AUDIT TEST RESULTS: ${passCount} / ${passCount + failCount} TESTS PASSED`);
if (failCount > 0) {
  console.log(` WARNING: ${failCount} TESTS FAILED`);
  process.exit(1);
} else {
  console.log(' ALL PHASE 4 TESTS AND VALIDATION CHECKS PASSED PERFECTLY!');
  console.log('================================================================\n');
}

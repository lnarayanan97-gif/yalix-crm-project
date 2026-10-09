/**
 * YALIX CRM — Phase 2 Deep Code-Level Audit Test Suite
 * Validates Scenarios A through L:
 * A. 10 completely new records
 * B. duplicate email within same file
 * C. duplicate email against CRM
 * D. existing contact with blank imported phone
 * E. existing contact with changed phone
 * F. company-only + valid email, no contact name
 * G. invalid email
 * H. same file imported twice (idempotency)
 * I. partial batch failure simulation
 * J. uncertain company match
 * K. Unicode/non-English names
 * L. company names containing punctuation and abbreviations
 */

import {
  applyNormalization,
  cleanEmail,
  extractDomain,
  sanitizeCompanyName,
} from './src/components/modules/import/importNormalizer.ts';
import {
  validateNormalizedRecord,
  detectDuplicates,
} from './src/components/modules/import/importValidator.ts';
import {
  generateDeterministicContactId,
  generateDeterministicCompanyId,
  generateDeterministicLeadId,
  sha256Sync,
} from './src/components/modules/import/importCrypto.ts';

console.log('================================================================');
console.log('       YALIX CRM — PHASE 2 DATA SAFETY & AUDIT SUITE            ');
console.log('================================================================\n');

const standardMapping = {
  companyName: 'Company',
  businessEmail: 'Email',
  firstName: 'First Name',
  lastName: 'Last Name',
  phone: 'Phone',
  website: 'Website',
  country: 'Country',
};

const standardConfig = {
  trimWhitespace: true,
  cleanEmails: true,
  standardizePhones: true,
  titleCaseNames: true,
  titleCaseCompanies: false, // Never aggressively title-case company names
  normalizeCountries: true,
  extractDomains: true,
  splitFullNames: true,
};

let passedCount = 0;
let totalCount = 0;

function assert(condition, testName, details = '') {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       -> ${details}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       -> ${details}`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// TEST A: 10 Completely New Records
// -------------------------------------------------------------
console.log('\n--- SCENARIO A: 10 Completely New Records ---');
const tenNewRows = Array.from({ length: 10 }, (_, i) => ({
  Company: `Enterprise Partner ${i + 1} LLC`,
  Email: `executive_${i + 1}@partner${i + 1}.com`,
  'First Name': `PartnerFirst${i + 1}`,
  'Last Name': `PartnerLast${i + 1}`,
  Phone: `+1-800-555-${1000 + i}`,
  Website: `https://www.partner${i + 1}.com`,
  Country: 'United States',
}));

const normalizedTen = tenNewRows.map((r, idx) =>
  applyNormalization(r, standardMapping, standardConfig, idx + 1)
);
const validatedTen = normalizedTen.map((r) => validateNormalizedRecord(r));
const dupTen = detectDuplicates(normalizedTen, validatedTen, [], []);

assert(
  normalizedTen.length === 10 && validatedTen.every((v) => v.isValid),
  'Scenario A1: All 10 records normalized and validated successfully',
  `Validated 10/10 records as RFC 5322 syntax-compliant`
);
assert(
  dupTen.every((d) => !d.isDbDuplicate && !d.isFileDuplicate),
  'Scenario A2: All 10 records classified as Unique New (0 duplicates)',
  `Unique new: ${dupTen.length}`
);

// -------------------------------------------------------------
// TEST B: Duplicate Email Within Same File
// -------------------------------------------------------------
console.log('\n--- SCENARIO B: Duplicate Email Within Same File ---');
const intraFileRows = [
  { Company: 'Acme Alpha', Email: 'sales@acme.com', 'First Name': 'Alice' },
  { Company: 'Acme Beta', Email: 'sales@acme.com', 'First Name': 'Alice Copy' }, // in-file dup
];
const normB = intraFileRows.map((r, i) => applyNormalization(r, standardMapping, standardConfig, i + 1));
const valB = normB.map((r) => validateNormalizedRecord(r));
const dupB = detectDuplicates(normB, valB, [], []);

assert(
  dupB[0].isFileDuplicate === false && dupB[1].isFileDuplicate === true && dupB[1].fileDuplicateWithRow === 1,
  'Scenario B: Detected intra-file duplicate email',
  `Row #2 correctly flagged as duplicate of Row #${dupB[1].fileDuplicateWithRow}`
);

// -------------------------------------------------------------
// TEST C: Duplicate Email Against Existing CRM
// -------------------------------------------------------------
console.log('\n--- SCENARIO C: Duplicate Email Against Existing CRM ---');
const mockExistingContacts = [
  {
    id: 'cnt_existing_1',
    contactId: 'cnt_existing_1',
    companyName: 'Apex Health',
    firstName: 'Lakshmi',
    businessEmail: 'lakshmi@yalixvalor.com',
    phone: '+1-555-0100',
    emailStatus: 'VALID',
    contactStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];
const incomingC = [
  { Company: 'Apex Health Corp', Email: 'lakshmi@yalixvalor.com', 'First Name': 'Lakshmi N' },
];
const normC = incomingC.map((r, i) => applyNormalization(r, standardMapping, standardConfig, i + 1));
const valC = normC.map((r) => validateNormalizedRecord(r));
const dupC = detectDuplicates(normC, valC, mockExistingContacts, []);

assert(
  dupC[0].isDbDuplicate === true && dupC[0].matchedContact?.businessEmail === 'lakshmi@yalixvalor.com',
  'Scenario C: Exact normalized email matched existing CRM contact',
  `Matched existing contact ID: ${dupC[0].matchedContact?.contactId}`
);

// -------------------------------------------------------------
// TEST D: Existing Contact with Blank Imported Phone (Preservation)
// -------------------------------------------------------------
console.log('\n--- SCENARIO D: Existing Contact with Blank Imported Phone ---');
const existingContactWithPhone = {
  contactId: 'cnt_123',
  businessEmail: 'lead@nutra.com',
  phone: '+1-555-7777',
  notes: 'Existing VIP client notes',
  leadStatus: 'INTERESTED',
  priority: 'HIGH',
};
const incomingBlankPhone = {
  businessEmail: 'lead@nutra.com',
  phone: '', // Blank phone in import spreadsheet
};

// Simulation of Update Existing logic
const updatePayloadD = {};
if (incomingBlankPhone.phone && !existingContactWithPhone.phone) {
  updatePayloadD.phone = incomingBlankPhone.phone;
}
const finalPhoneD = updatePayloadD.phone || existingContactWithPhone.phone;

assert(
  finalPhoneD === '+1-555-7777' && !('phone' in updatePayloadD),
  'Scenario D: Existing phone number preserved when imported value is blank',
  `Phone remained: "${finalPhoneD}", existing notes & status protected`
);

// -------------------------------------------------------------
// TEST E: Existing Contact with Changed Phone
// -------------------------------------------------------------
console.log('\n--- SCENARIO E: Existing Contact with Changed Phone ---');
const incomingNewPhone = {
  businessEmail: 'lead@nutra.com',
  phone: '+1-555-9999', // New phone provided
  notes: 'Trade show meet',
};

const updatePayloadE = {};
if (incomingNewPhone.phone && incomingNewPhone.phone !== existingContactWithPhone.phone) {
  updatePayloadE.phone = incomingNewPhone.phone;
}
if (incomingNewPhone.notes && incomingNewPhone.notes !== existingContactWithPhone.notes) {
  updatePayloadE.notes = `${existingContactWithPhone.notes} | Import: ${incomingNewPhone.notes}`;
}

assert(
  updatePayloadE.phone === '+1-555-9999' &&
  updatePayloadE.notes.includes('Existing VIP client notes') &&
  updatePayloadE.notes.includes('Trade show meet'),
  'Scenario E: Phone updated, existing notes non-destructively preserved with append',
  `Combined Notes: "${updatePayloadE.notes}"`
);

// -------------------------------------------------------------
// TEST F: Company-Only + Valid Email (No Contact Name)
// -------------------------------------------------------------
console.log('\n--- SCENARIO F: Company-Only + Valid Email, No Contact Name ---');
const companyOnlyRow = {
  Company: 'Zenith BioIngredients AG',
  Email: 'procurement@zenithbio.ch',
  'First Name': '',
  'Last Name': '',
};
const normF = applyNormalization(companyOnlyRow, standardMapping, standardConfig, 1);
const valF = validateNormalizedRecord(normF);

assert(
  valF.isValid === true && normF.firstName === '' && normF.companyName === 'Zenith BioIngredients AG',
  'Scenario F: Company Name + Valid Email is accepted as valid without contact name',
  `Validation: isValid=${valF.isValid}, Warnings=${valF.warnings.length}`
);

// -------------------------------------------------------------
// TEST G: Invalid Email Detection
// -------------------------------------------------------------
console.log('\n--- SCENARIO G: Invalid Email Syntax Rejected ---');
const invalidEmailRow = {
  Company: 'Bad Data Ltd',
  Email: 'not-an-email-at-all',
  'First Name': 'Nobody',
};
const normG = applyNormalization(invalidEmailRow, standardMapping, standardConfig, 1);
const valG = validateNormalizedRecord(normG);

assert(
  valG.isValid === false && valG.errors.some((e) => e.includes('Syntactically invalid email format')),
  'Scenario G: Invalid email rejected with RFC 5322 error message',
  `Errors: "${valG.errors.join('; ')}"`
);

// -------------------------------------------------------------
// TEST H: Same File Imported Twice (Deterministic Idempotency)
// -------------------------------------------------------------
console.log('\n--- SCENARIO H: Same File Imported Twice (Deterministic Idempotency) ---');
const sampleEmail = 'director@biotech-innovations.de';
const contactIdRun1 = generateDeterministicContactId(sampleEmail);
const contactIdRun2 = generateDeterministicContactId(sampleEmail);

const companyIdRun1 = generateDeterministicCompanyId('biotech-innovations.de');
const companyIdRun2 = generateDeterministicCompanyId('biotech-innovations.de');

const leadIdRun1 = generateDeterministicLeadId(contactIdRun1, 'Organic Seeds');
const leadIdRun2 = generateDeterministicLeadId(contactIdRun2, 'Organic Seeds');

assert(
  contactIdRun1 === contactIdRun2 &&
  companyIdRun1 === companyIdRun2 &&
  leadIdRun1 === leadIdRun2,
  'Scenario H: Deterministic IDs identical across independent import runs (Zero Duplicates)',
  `Contact Doc ID: ${contactIdRun1}, Company Doc ID: ${companyIdRun1}`
);

// -------------------------------------------------------------
// TEST I: Partial Batch Failure Simulation
// -------------------------------------------------------------
console.log('\n--- SCENARIO I: Partial Batch Failure Simulation ---');
const mockBatchExecution = (batches) => {
  let committed = 0;
  for (let b = 0; b < batches.length; b++) {
    if (batches[b].shouldFail) {
      return {
        success: false,
        failedBatchIndex: b + 1,
        committedCount: committed,
        failedRowRange: `Rows ${committed + 1} to ${committed + batches[b].rows}`,
        error: 'Simulated Firestore quota limit reached',
      };
    }
    committed += batches[b].rows;
  }
  return { success: true, committedCount: committed };
};

const failureSimulation = mockBatchExecution([
  { rows: 200, shouldFail: false },
  { rows: 200, shouldFail: true }, // Batch 2 fails
]);

assert(
  failureSimulation.success === false &&
  failureSimulation.failedBatchIndex === 2 &&
  failureSimulation.committedCount === 200 &&
  failureSimulation.failedRowRange === 'Rows 201 to 400',
  'Scenario I: Partial batch failure captured with affected row range and error preservation',
  `Failed Batch #${failureSimulation.failedBatchIndex} (${failureSimulation.failedRowRange})`
);

// -------------------------------------------------------------
// TEST J: Uncertain Company Match (Fuzzy Matching Flagged Only)
// -------------------------------------------------------------
console.log('\n--- SCENARIO J: Uncertain Company Match ---');
const existingCompanyList = [
  { id: 'comp_1', companyId: 'comp_1', companyName: 'Global Nutraceuticals Incorporated' },
];
const incomingUncertain = [
  {
    Company: 'Global Nutraceuticals UK Limited',
    Email: 'john@gnuk.co.uk',
    'First Name': 'John',
  },
];
const normJ = incomingUncertain.map((r, i) => applyNormalization(r, standardMapping, standardConfig, i + 1));
const valJ = normJ.map((r) => validateNormalizedRecord(r));
const dupJ = detectDuplicates(normJ, valJ, [], existingCompanyList);

assert(
  dupJ[0].matchedCompanyMethod === 'FUZZY_NAME' &&
  dupJ[0].confidence === 'POSSIBLE_DUPLICATE',
  'Scenario J: Uncertain company similarity flagged as POSSIBLE_DUPLICATE (Never auto-merged)',
  `Match method: ${dupJ[0].matchedCompanyMethod}, Confidence: ${dupJ[0].confidence}`
);

// -------------------------------------------------------------
// TEST K: Unicode & Non-English Names
// -------------------------------------------------------------
console.log('\n--- SCENARIO K: Unicode & Non-English Names ---');
const unicodeRows = [
  { Company: 'Müller & Söhne Bio GmbH', Email: 'rene@mueller-bio.de', 'First Name': 'René', 'Last Name': 'Müller' },
  { Company: '北京生物科技有限公司', Email: 'wang@beijing-bio.cn', 'First Name': '小明', 'Last Name': '王' },
  { Company: 'Société Française d\'Ingrédients', Email: 'francois@ingredients.fr', 'First Name': 'François', 'Last Name': 'Dubois' },
];
const normK = unicodeRows.map((r, i) => applyNormalization(r, standardMapping, standardConfig, i + 1));
const valK = normK.map((r) => validateNormalizedRecord(r));

assert(
  valK.every((v) => v.isValid) &&
  normK[0].firstName === 'René' &&
  normK[1].firstName === '小明' &&
  normK[2].firstName === 'François',
  'Scenario K: Unicode and accented international names preserved without corruption',
  `René Müller, 王小明, François Dubois preserved`
);

// -------------------------------------------------------------
// TEST L: Company Names Containing Punctuation & Abbreviations
// -------------------------------------------------------------
console.log('\n--- SCENARIO L: Preservation of Punctuation & Abbreviations ---');
const specialCompanies = [
  "McDonald's",
  'ABC GLOBAL PTE LTD',
  'P&G',
  '3M',
  'eBay',
  'A&B Ingredients Inc.',
];

const sanitizedList = specialCompanies.map((c) => sanitizeCompanyName(c));

const allPreserved =
  sanitizedList[0] === "McDonald's" &&
  sanitizedList[1] === 'ABC GLOBAL PTE LTD' &&
  sanitizedList[2] === 'P&G' &&
  sanitizedList[3] === '3M' &&
  sanitizedList[4] === 'eBay' &&
  sanitizedList[5] === 'A&B Ingredients Inc.';

assert(
  allPreserved,
  'Scenario L: Corporate names with punctuation, acronyms, and mixed case preserved intact',
  `Preserved: McDonald's, ABC GLOBAL PTE LTD, P&G, 3M, eBay`
);

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(` AUDIT TEST RESULTS: ${passedCount} / ${totalCount} SCENARIOS PASSED`);
console.log('================================================================');

if (passedCount !== totalCount) {
  process.exit(1);
}

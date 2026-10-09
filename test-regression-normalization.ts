import {
  applyNormalization,
  normalizeCountry,
} from './src/components/modules/import/importNormalizer';
import { ColumnMappingState, NormalizationConfig } from './src/components/modules/import/importTypes';

console.log('====================================================');
console.log('   REGRESSION TEST: NORMALIZATION BUGS 1 & 2        ');
console.log('====================================================\n');

// ----------------------------------------------------
// BUG 1 REGRESSION TEST: Contact Name Fallback
// ----------------------------------------------------
console.log('[TEST 1] BUG 1 — CONTACT NAME MUST NEVER FALL BACK TO COMPANY NAME');

const defaultConfig: NormalizationConfig = {
  trimWhitespace: true,
  cleanEmails: true,
  standardizePhones: true,
  titleCaseNames: true,
  titleCaseCompanies: false,
  extractDomains: true,
  normalizeCountries: true,
  splitFullNames: true,
};

// Scenario A: Source row with Company Name, Business Email, and Blank First/Last Name
const rowScenarioA = {
  'Company Name': 'Lotus Foods Co.',
  'First Name': '',
  'Last Name': '',
  'Business Email': 'purchasing@lotusfoods.example',
};

const mappingScenarioA: ColumnMappingState = {
  companyName: 'Company Name',
  firstName: 'First Name',
  lastName: 'Last Name',
  businessEmail: 'Business Email',
};

const normalizedA = applyNormalization(rowScenarioA, mappingScenarioA, defaultConfig, 1);

console.log('Scenario A (Blank First/Last Name):');
console.log(` - companyName : "${normalizedA.companyName}" (expected: "Lotus Foods Co.")`);
console.log(` - firstName   : "${normalizedA.firstName}" (expected: "")`);
console.log(` - lastName    : "${normalizedA.lastName}" (expected: "")`);
console.log(` - contactName : "${normalizedA.contactName}" (expected: "")`);
console.log(` - fullName    : "${normalizedA.fullName}" (expected: "")`);

const passA =
  normalizedA.companyName === 'Lotus Foods Co.' &&
  normalizedA.firstName === '' &&
  normalizedA.lastName === '' &&
  normalizedA.contactName === '' &&
  normalizedA.fullName === '';

if (!passA) {
  console.error('❌ FAIL: Scenario A did not meet required behavior!');
  process.exit(1);
} else {
  console.log('✅ PASS: Scenario A meets all required behavior.\n');
}

// Scenario B: Erroneously or loosely mapped fullName pointing to company column
const mappingScenarioB: ColumnMappingState = {
  companyName: 'Company Name',
  fullName: 'Company Name', // Even if fullName was mapped to company column
  businessEmail: 'Business Email',
};

const normalizedB = applyNormalization(rowScenarioA, mappingScenarioB, defaultConfig, 2);

console.log('Scenario B (FullName mapped to Company Name column guard):');
console.log(` - companyName : "${normalizedB.companyName}"`);
console.log(` - contactName : "${normalizedB.contactName}" (must be blank)`);
console.log(` - firstName   : "${normalizedB.firstName}" (must be blank)`);
console.log(` - lastName    : "${normalizedB.lastName}" (must be blank)`);

const passB =
  normalizedB.companyName === 'Lotus Foods Co.' &&
  normalizedB.contactName === '' &&
  normalizedB.firstName === '' &&
  normalizedB.lastName === '';

if (!passB) {
  console.error('❌ FAIL: Scenario B allowed company name to leak into contact name!');
  process.exit(1);
} else {
  console.log('✅ PASS: Scenario B correctly blocked company name leakage.\n');
}

// Scenario C: Source row without separate first/last name, but distinct Full Name column
const rowScenarioC = {
  'Company Name': 'Lotus Foods Co.',
  'Contact Person': 'Ananya Sharma',
  'Business Email': 'purchasing@lotusfoods.example',
};

const mappingScenarioC: ColumnMappingState = {
  companyName: 'Company Name',
  fullName: 'Contact Person',
  businessEmail: 'Business Email',
};

const normalizedC = applyNormalization(rowScenarioC, mappingScenarioC, defaultConfig, 3);

console.log('Scenario C (Legitimate distinct Full Name mapped):');
console.log(` - companyName : "${normalizedC.companyName}"`);
console.log(` - firstName   : "${normalizedC.firstName}" (expected: "Ananya")`);
console.log(` - lastName    : "${normalizedC.lastName}" (expected: "Sharma")`);
console.log(` - contactName : "${normalizedC.contactName}" (expected: "Ananya Sharma")`);

const passC =
  normalizedC.companyName === 'Lotus Foods Co.' &&
  normalizedC.firstName === 'Ananya' &&
  normalizedC.lastName === 'Sharma' &&
  normalizedC.contactName === 'Ananya Sharma';

if (!passC) {
  console.error('❌ FAIL: Scenario C failed to split legitimately mapped contact name!');
  process.exit(1);
} else {
  console.log('✅ PASS: Scenario C legitimate full name mapped successfully.\n');
}

// ----------------------------------------------------
// BUG 2 REGRESSION TEST: Country Normalization
// ----------------------------------------------------
console.log('[TEST 2] BUG 2 — COUNTRY NORMALIZATION (VIETNAM & ALIASES)');

const vietnamCases = [
  { input: 'Viet Nam', expected: 'Vietnam' },
  { input: 'VIET NAM', expected: 'Vietnam' },
  { input: 'viet nam', expected: 'Vietnam' },
  { input: 'Vietnam', expected: 'Vietnam' },
  { input: 'VIETNAM', expected: 'Vietnam' },
  { input: 'vietnam', expected: 'Vietnam' },
  { input: 'VN', expected: 'Vietnam' },
  { input: 'vn', expected: 'Vietnam' },
  { input: 'VNM', expected: 'Vietnam' },
  { input: 'vnm', expected: 'Vietnam' },
  { input: 'Viet-Nam', expected: 'Vietnam' },
  { input: 'VIET-NAM', expected: 'Vietnam' },
  { input: 'Socialist Republic of Vietnam', expected: 'Vietnam' },
  { input: 'SOCIALIST REPUBLIC OF VIETNAM', expected: 'Vietnam' },
];

let allVietnamPass = true;
vietnamCases.forEach(({ input, expected }) => {
  const result = normalizeCountry(input);
  const pass = result === expected;
  console.log(` - normalizeCountry("${input}") => "${result}" (expected: "${expected}") [${pass ? 'PASS' : 'FAIL'}]`);
  if (!pass) allVietnamPass = false;
});

if (!allVietnamPass) {
  console.error('❌ FAIL: One or more Vietnam country alias tests failed!');
  process.exit(1);
} else {
  console.log('✅ PASS: All Vietnam country alias tests passed.\n');
}

// Additional Global Country Aliases
const globalCases = [
  { input: 'USA', expected: 'United States' },
  { input: 'U.S.A.', expected: 'United States' },
  { input: 'US', expected: 'United States' },
  { input: 'UK', expected: 'United Kingdom' },
  { input: 'GB', expected: 'United Kingdom' },
  { input: 'DE', expected: 'Germany' },
  { input: 'DEU', expected: 'Germany' },
  { input: 'UAE', expected: 'United Arab Emirates' },
  { input: 'IND', expected: 'India' },
  { input: 'SG', expected: 'Singapore' },
  { input: 'JP', expected: 'Japan' },
  { input: 'CN', expected: 'China' },
  { input: 'KR', expected: 'South Korea' },
  { input: 'CA', expected: 'Canada' },
  { input: 'AU', expected: 'Australia' },
  { input: 'BR', expected: 'Brazil' },
  { input: 'MX', expected: 'Mexico' },
];

let allGlobalPass = true;
globalCases.forEach(({ input, expected }) => {
  const result = normalizeCountry(input);
  const pass = result === expected;
  console.log(` - normalizeCountry("${input}") => "${result}" [${pass ? 'PASS' : 'FAIL'}]`);
  if (!pass) allGlobalPass = false;
});

if (!allGlobalPass) {
  console.error('❌ FAIL: Global country normalization tests failed!');
  process.exit(1);
} else {
  console.log('✅ PASS: All global country normalization tests passed.\n');
}

console.log('====================================================');
console.log('   ALL REGRESSION TESTS COMPLETED SUCCESSFULLY!     ');
console.log('====================================================');

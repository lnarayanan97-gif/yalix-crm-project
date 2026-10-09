import {
  ColumnMappingState,
  NormalizationConfig,
  NormalizedRecord,
} from './importTypes';
import { sha256Sync } from './importCrypto';

// Extract bare root domain from a URL or an email address
export function extractDomain(input: string): string {
  if (!input) return '';
  let str = input.trim().toLowerCase();

  // If it's an email address, take the domain portion
  if (str.includes('@')) {
    const parts = str.split('@');
    str = parts[parts.length - 1];
  }

  // Remove protocol
  str = str.replace(/^(https?:\/\/)?(www\.)?/, '');
  // Remove trailing slashes and paths/query params
  str = str.split('/')[0].split('?')[0].split('#')[0];
  // Remove port if present
  str = str.split(':')[0];
  return str.trim();
}

// Clean and standardize email addresses (syntactic normalization only)
export function cleanEmail(email: string): string {
  if (!email) return '';
  let str = email.trim().toLowerCase();
  str = str.replace(/^mailto:/i, '');
  // Remove enclosing angle brackets if present e.g. <john@acme.com>
  str = str.replace(/^<|>$/g, '');
  // Remove internal spaces
  str = str.replace(/\s+/g, '');
  return str;
}

// Sanitize phone numbers into readable international or local formats
export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  let str = String(phone).trim();
  // Handle scientific notation from Excel (e.g. 1.2345E+10)
  if (/^[0-9.]+[eE]\+[0-9]+$/.test(str)) {
    try {
      str = Number(str).toFixed(0);
    } catch {
      // ignore
    }
  }
  // Retain digits, +, spaces, dashes, parentheses and x for extensions
  return str.replace(/[^\d+\-() x.]/g, '').trim();
}

/**
 * Intelligent Casing Helper:
 * Preserves intentional mixed casing (e.g. "McDonald", "O'Connor", "Dr. Elena Rostova", "eBay", "3M", "P&G").
 * Only normalizes when the input is ALL-UPPERCASE or ALL-LOWERCASE.
 */
export function formatPreservedName(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // If already mixed-cased, preserve user's intentional capitalisation
  const isAllUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const isAllLower = trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed);

  if (!isAllUpper && !isAllLower) {
    return trimmed; // Preserve exact representation
  }

  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return '';
      if (['and', 'or', 'of', 'in', 'at', 'for', 'the', '&'].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Non-destructive Company Name Preservation:
 * NEVER corrupts entities like "McDonald's", "ABC GLOBAL PTE LTD", "P&G", "3M", "eBay".
 * Trims leading/trailing whitespace while preserving original casing and legal entity suffixes.
 */
export function sanitizeCompanyName(name: string): string {
  if (!name) return '';
  return name.trim();
}

// Split full names into First and Last names
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

// Standardize common country names while preserving original in rawCountry
const COUNTRY_MAP: Record<string, string> = {
  // Vietnam & Aliases
  VN: 'Vietnam',
  VNM: 'Vietnam',
  VIETNAM: 'Vietnam',
  'VIET NAM': 'Vietnam',
  'VIET-NAM': 'Vietnam',
  'SOCIALIST REPUBLIC OF VIETNAM': 'Vietnam',

  // United States & North America
  US: 'United States',
  USA: 'United States',
  'U S A': 'United States',
  'UNITED STATES': 'United States',
  'UNITED STATES OF AMERICA': 'United States',
  AMERICA: 'United States',
  CA: 'Canada',
  CAN: 'Canada',
  CANADA: 'Canada',
  MX: 'Mexico',
  MEX: 'Mexico',
  MEXICO: 'Mexico',

  // United Kingdom & Europe
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  GBR: 'United Kingdom',
  'GREAT BRITAIN': 'United Kingdom',
  'UNITED KINGDOM': 'United Kingdom',
  ENG: 'United Kingdom',
  ENGLAND: 'United Kingdom',
  SCOTLAND: 'United Kingdom',
  WALES: 'United Kingdom',
  DE: 'Germany',
  DEU: 'Germany',
  GERMANY: 'Germany',
  DEUTSCHLAND: 'Germany',
  FR: 'France',
  FRA: 'France',
  FRANCE: 'France',
  IT: 'Italy',
  ITA: 'Italy',
  ITALY: 'Italy',
  ITALIA: 'Italy',
  ES: 'Spain',
  ESP: 'Spain',
  SPAIN: 'Spain',
  ESPANA: 'Spain',
  ESPAÑA: 'Spain',
  NL: 'Netherlands',
  NLD: 'Netherlands',
  NETHERLANDS: 'Netherlands',
  HOLLAND: 'Netherlands',
  'THE NETHERLANDS': 'Netherlands',
  CH: 'Switzerland',
  CHE: 'Switzerland',
  SWITZERLAND: 'Switzerland',
  SCHWEIZ: 'Switzerland',
  SUISSE: 'Switzerland',
  BE: 'Belgium',
  BEL: 'Belgium',
  BELGIUM: 'Belgium',
  AT: 'Austria',
  AUT: 'Austria',
  AUSTRIA: 'Austria',
  IE: 'Ireland',
  IRL: 'Ireland',
  IRELAND: 'Ireland',
  SE: 'Sweden',
  SWE: 'Sweden',
  SWEDEN: 'Sweden',
  NO: 'Norway',
  NOR: 'Norway',
  NORWAY: 'Norway',
  DK: 'Denmark',
  DNK: 'Denmark',
  DENMARK: 'Denmark',
  FI: 'Finland',
  FIN: 'Finland',
  FINLAND: 'Finland',
  PL: 'Poland',
  POL: 'Poland',
  POLAND: 'Poland',
  PT: 'Portugal',
  PRT: 'Portugal',
  PORTUGAL: 'Portugal',
  GR: 'Greece',
  GRC: 'Greece',
  GREECE: 'Greece',
  TR: 'Turkey',
  TUR: 'Turkey',
  TURKEY: 'Turkey',
  TURKIYE: 'Turkey',
  TÜRKIYE: 'Turkey',
  RU: 'Russia',
  RUS: 'Russia',
  RUSSIA: 'Russia',
  'RUSSIAN FEDERATION': 'Russia',
  UA: 'Ukraine',
  UKR: 'Ukraine',
  UKRAINE: 'Ukraine',

  // Asia Pacific
  IND: 'India',
  IN: 'India',
  INDIA: 'India',
  BHARAT: 'India',
  SG: 'Singapore',
  SGP: 'Singapore',
  SINGAPORE: 'Singapore',
  MY: 'Malaysia',
  MYS: 'Malaysia',
  MALAYSIA: 'Malaysia',
  ID: 'Indonesia',
  IDN: 'Indonesia',
  INDONESIA: 'Indonesia',
  TH: 'Thailand',
  THA: 'Thailand',
  THAILAND: 'Thailand',
  PH: 'Philippines',
  PHL: 'Philippines',
  PHILIPPINES: 'Philippines',
  'THE PHILIPPINES': 'Philippines',
  JP: 'Japan',
  JPN: 'Japan',
  JAPAN: 'Japan',
  NIPPON: 'Japan',
  CN: 'China',
  CHN: 'China',
  CHINA: 'China',
  PRC: 'China',
  'PEOPLES REPUBLIC OF CHINA': 'China',
  KR: 'South Korea',
  KOR: 'South Korea',
  'SOUTH KOREA': 'South Korea',
  'REPUBLIC OF KOREA': 'South Korea',
  'KOREA SOUTH': 'South Korea',
  HK: 'Hong Kong',
  HKG: 'Hong Kong',
  'HONG KONG': 'Hong Kong',
  TW: 'Taiwan',
  TWN: 'Taiwan',
  TAIWAN: 'Taiwan',
  AU: 'Australia',
  AUS: 'Australia',
  AUSTRALIA: 'Australia',
  NZ: 'New Zealand',
  NZL: 'New Zealand',
  'NEW ZEALAND': 'New Zealand',

  // Middle East & Africa
  UAE: 'United Arab Emirates',
  'UNITED ARAB EMIRATES': 'United Arab Emirates',
  AE: 'United Arab Emirates',
  EMIRATES: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  SAU: 'Saudi Arabia',
  'SAUDI ARABIA': 'Saudi Arabia',
  KSA: 'Saudi Arabia',
  QA: 'Qatar',
  QAT: 'Qatar',
  QATAR: 'Qatar',
  KW: 'Kuwait',
  KWT: 'Kuwait',
  KUWAIT: 'Kuwait',
  BH: 'Bahrain',
  BHR: 'Bahrain',
  BAHRAIN: 'Bahrain',
  OM: 'Oman',
  OMN: 'Oman',
  OMAN: 'Oman',
  EG: 'Egypt',
  EGY: 'Egypt',
  EGYPT: 'Egypt',
  IL: 'Israel',
  ISR: 'Israel',
  ISRAEL: 'Israel',
  ZA: 'South Africa',
  ZAF: 'South Africa',
  'SOUTH AFRICA': 'South Africa',

  // South America
  BR: 'Brazil',
  BRA: 'Brazil',
  BRAZIL: 'Brazil',
  BRASIL: 'Brazil',
  AR: 'Argentina',
  ARG: 'Argentina',
  ARGENTINA: 'Argentina',
  CL: 'Chile',
  CHL: 'Chile',
  CHILE: 'Chile',
  CO: 'Colombia',
  COL: 'Colombia',
  COLOMBIA: 'Colombia',
  PE: 'Peru',
  PER: 'Peru',
  PERU: 'Peru',
};

export function normalizeCountry(country: string): string {
  if (!country) return '';
  const trimmed = country.trim();
  if (!trimmed) return '';

  // 1. Direct uppercase match
  const upper = trimmed.toUpperCase();
  if (COUNTRY_MAP[upper]) {
    return COUNTRY_MAP[upper];
  }

  // 2. Sanitized key (strip dots, dashes, punctuation, collapse spaces)
  const sanitized = upper.replace(/[.,\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
  if (COUNTRY_MAP[sanitized]) {
    return COUNTRY_MAP[sanitized];
  }

  // 3. Alphanumeric only
  const alphaOnly = upper.replace(/[^A-Z0-9]/g, '');
  if (COUNTRY_MAP[alphaOnly]) {
    return COUNTRY_MAP[alphaOnly];
  }

  return formatPreservedName(trimmed);
}

// Apply normalization pipeline with full raw value preservation
export function applyNormalization(
  rawRow: Record<string, any>,
  mapping: ColumnMappingState,
  config: NormalizationConfig,
  rowIndex: number
): NormalizedRecord {
  const getRawVal = (fieldKey: string): string => {
    const colName = mapping[fieldKey];
    if (!colName || rawRow[colName] === undefined || rawRow[colName] === null) {
      return '';
    }
    return String(rawRow[colName]);
  };

  // Check if an actual, distinct Full Name column was explicitly mapped
  const isActualFullNameMapped = Boolean(
    mapping['fullName'] &&
    mapping['fullName'] !== mapping['companyName'] &&
    mapping['fullName'] !== mapping['website'] &&
    mapping['fullName'] !== mapping['businessEmail']
  );

  // Preserve exact raw values
  const rawCompanyName = getRawVal('companyName');
  const rawWebsite = getRawVal('website');
  const rawIndustry = getRawVal('industry');
  const rawCountry = getRawVal('country');
  const rawCity = getRawVal('city');
  const rawState = getRawVal('state');
  const rawFirstName = getRawVal('firstName');
  const rawLastName = getRawVal('lastName');
  // Only read rawFullName if an actual Full Name field was explicitly mapped
  const rawFullName = isActualFullNameMapped ? getRawVal('fullName') : '';
  const rawEmail = getRawVal('businessEmail');
  const rawPhone = getRawVal('phone');
  const rawJobTitle = getRawVal('jobTitle');
  const rawDepartment = getRawVal('department');
  const rawLinkedinUrl = getRawVal('linkedinUrl');
  const rawNotes = getRawVal('notes');

  let companyName = rawCompanyName;
  let website = rawWebsite;
  let industry = rawIndustry;
  let country = rawCountry;
  let city = rawCity;
  let state = rawState;
  let firstName = rawFirstName;
  let lastName = rawLastName;
  let fullName = rawFullName;
  let businessEmail = rawEmail;
  let phone = rawPhone;
  let jobTitle = rawJobTitle;
  let department = rawDepartment;
  let linkedinUrl = rawLinkedinUrl;
  let notes = rawNotes;

  // 1. Trimming (Always safe)
  if (config.trimWhitespace) {
    companyName = companyName.trim();
    website = website.trim();
    industry = industry.trim();
    country = country.trim();
    city = city.trim();
    state = state.trim();
    firstName = firstName.trim();
    lastName = lastName.trim();
    fullName = fullName.trim();
    businessEmail = businessEmail.trim();
    phone = phone.trim();
    jobTitle = jobTitle.trim();
    department = department.trim();
    linkedinUrl = linkedinUrl.trim();
    notes = notes.trim();
  }

  // 2. Full Name Auto-Splitting
  // ONLY auto-split a full-name source column when an actual distinct Full Name field was explicitly mapped.
  // A company name must NEVER be used as a contact person's name.
  if (config.splitFullNames && !firstName && fullName && isActualFullNameMapped) {
    if (companyName && fullName.toLowerCase() === companyName.toLowerCase()) {
      fullName = '';
    } else {
      const split = splitFullName(fullName);
      firstName = split.firstName;
      if (!lastName) {
        lastName = split.lastName;
      }
    }
  } else if (!isActualFullNameMapped) {
    fullName = '';
  }

  // 3. Name Casing (Non-destructive formatPreservedName)
  if (config.titleCaseNames) {
    if (firstName) firstName = formatPreservedName(firstName);
    if (lastName) lastName = formatPreservedName(lastName);
    if (jobTitle) jobTitle = formatPreservedName(jobTitle);
  }

  // 4. Contact Name Guarantee:
  // A company name must NEVER be used as a contact person's name.
  // If First Name and Last Name are both blank, Contact Name must remain blank.
  let contactName = '';
  if (firstName || lastName) {
    contactName = `${firstName} ${lastName}`.trim();
  } else if (fullName && isActualFullNameMapped && (!companyName || fullName.toLowerCase() !== companyName.toLowerCase())) {
    contactName = fullName.trim();
  } else {
    // Both First Name and Last Name are blank: Contact Name MUST remain blank!
    contactName = '';
    firstName = '';
    lastName = '';
    fullName = '';
  }

  // 5. Company Name: Never aggressively transform or strip suffixes!
  companyName = sanitizeCompanyName(companyName);

  // 6. Email Normalization
  if (config.cleanEmails) {
    businessEmail = cleanEmail(businessEmail);
  }

  // 7. Domain Extraction
  let domain = '';
  if (config.extractDomains) {
    if (website) {
      domain = extractDomain(website);
    } else if (businessEmail) {
      domain = extractDomain(businessEmail);
    }
  }

  // 8. Phone Sanitization
  if (config.standardizePhones && phone) {
    phone = sanitizePhone(phone);
  }

  // 9. Country Normalization
  if (config.normalizeCountries && country) {
    country = normalizeCountry(country);
  }

  // Generate deterministic SHA-256 email key
  const emailHash = businessEmail ? sha256Sync(businessEmail) : '';

  return {
    rowIndex,
    companyName: companyName || (domain ? domain.split('.')[0] : 'Unspecified Company'),
    website,
    domain,
    industry,
    country,
    city,
    state,
    firstName: firstName || '', // Blank if not provided
    lastName: lastName || '',
    fullName: contactName,
    contactName,
    businessEmail,
    emailHash,
    phone,
    jobTitle,
    department,
    linkedinUrl,
    notes,
    rawCompanyName,
    rawFirstName,
    rawLastName,
    rawJobTitle,
    rawWebsite,
    rawCountry,
    rawEmail,
    rawOriginal: rawRow,
  };
}

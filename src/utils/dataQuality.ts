import { Company, Contact, Lead } from '../types/crm';

/**
 * Validates basic email RFC format (syntactic check only, NOT deliverability).
 */
export function isValidEmailSyntax(email?: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  // Standard RFC 5322 regex approximation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

export interface DataQualityReport {
  totalCompanies: number;
  totalContacts: number;
  totalLeads: number;
  
  // Email syntax & hygiene metrics (explicitly disclaimed: does NOT guarantee SMTP inbox deliverability)
  blankEmailsCount: number;
  invalidEmailFormatCount: number;
  validEmailSyntaxCount: number;

  // Duplicate candidate analysis
  duplicateContactsCount: number; // groups or candidate items
  duplicateCompaniesCount: number;

  // Suspect review lists
  suspectContacts: {
    contact: Contact;
    issues: string[];
  }[];
  suspectCompanies: {
    company: Company;
    issues: string[];
  }[];
  duplicateCandidateGroups: {
    key: string;
    type: 'EMAIL' | 'COMPANY_DOMAIN' | 'COMPANY_NAME';
    items: (Contact | Company)[];
  }[];
}

/**
 * Analyzes the CRM dataset for hygiene, formatting, syntax, and potential duplicate candidates.
 * NOTE: Syntax validation verifies string format conformance only; it cannot determine whether
 * a mailbox actively accepts delivery on the recipient SMTP server.
 */
export function analyzeDataQuality(
  companies: Company[],
  contacts: Contact[],
  leads: Lead[] = []
): DataQualityReport {
  const suspectContacts: { contact: Contact; issues: string[] }[] = [];
  const suspectCompanies: { company: Company; issues: string[] }[] = [];

  let blankEmailsCount = 0;
  let invalidEmailFormatCount = 0;
  let validEmailSyntaxCount = 0;

  // Track emails for duplicate candidates
  const emailMap = new Map<string, Contact[]>();
  const phoneMap = new Map<string, Contact[]>();

  contacts.forEach((cnt) => {
    const issues: string[] = [];
    const email = (cnt.businessEmail || '').trim().toLowerCase();

    if (!email) {
      blankEmailsCount++;
      issues.push('Missing business email address');
    } else if (!isValidEmailSyntax(email)) {
      invalidEmailFormatCount++;
      issues.push(`Invalid email format syntax: "${email}"`);
    } else {
      validEmailSyntaxCount++;
      const group = emailMap.get(email) || [];
      group.push(cnt);
      emailMap.set(email, group);
    }

    if (!cnt.firstName || !cnt.firstName.trim()) {
      issues.push('Missing first name');
    }

    if (!cnt.companyId && !cnt.companyName) {
      issues.push('Unlinked to any organization');
    }

    if (issues.length > 0) {
      suspectContacts.push({ contact: cnt, issues });
    }
  });

  // Track company duplicates by normalized domain and name
  const domainMap = new Map<string, Company[]>();
  const nameMap = new Map<string, Company[]>();

  companies.forEach((comp) => {
    const issues: string[] = [];
    const name = (comp.companyName || '').trim();
    const cleanDomain = (comp.website || comp.domain || '')
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim();

    if (!name) {
      issues.push('Missing company name');
    } else {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const group = nameMap.get(cleanName) || [];
      group.push(comp);
      nameMap.set(cleanName, group);
    }

    if (cleanDomain && cleanDomain.includes('.')) {
      const group = domainMap.get(cleanDomain) || [];
      group.push(comp);
      domainMap.set(cleanDomain, group);
    } else if (!cleanDomain) {
      issues.push('Missing domain / website');
    }

    if (issues.length > 0) {
      suspectCompanies.push({ company: comp, issues });
    }
  });

  // Identify duplicate groups
  const duplicateCandidateGroups: {
    key: string;
    type: 'EMAIL' | 'COMPANY_DOMAIN' | 'COMPANY_NAME';
    items: (Contact | Company)[];
  }[] = [];

  let duplicateContactsCount = 0;
  emailMap.forEach((contactsWithSameEmail, email) => {
    if (contactsWithSameEmail.length > 1) {
      duplicateContactsCount += contactsWithSameEmail.length;
      duplicateCandidateGroups.push({
        key: email,
        type: 'EMAIL',
        items: contactsWithSameEmail,
      });
    }
  });

  let duplicateCompaniesCount = 0;
  domainMap.forEach((compsWithSameDomain, domain) => {
    if (compsWithSameDomain.length > 1) {
      duplicateCompaniesCount += compsWithSameDomain.length;
      duplicateCandidateGroups.push({
        key: domain,
        type: 'COMPANY_DOMAIN',
        items: compsWithSameDomain,
      });
    }
  });

  nameMap.forEach((compsWithSameName, nameKey) => {
    // Only add if not already captured by domain duplicate
    if (
      compsWithSameName.length > 1 &&
      !duplicateCandidateGroups.some(
        (g) => g.type === 'COMPANY_DOMAIN' && g.items.some((c) => compsWithSameName.includes(c as Company))
      )
    ) {
      duplicateCompaniesCount += compsWithSameName.length;
      duplicateCandidateGroups.push({
        key: compsWithSameName[0].companyName,
        type: 'COMPANY_NAME',
        items: compsWithSameName,
      });
    }
  });

  return {
    totalCompanies: companies.length,
    totalContacts: contacts.length,
    totalLeads: leads.length,
    blankEmailsCount,
    invalidEmailFormatCount,
    validEmailSyntaxCount,
    duplicateContactsCount,
    duplicateCompaniesCount,
    suspectContacts,
    suspectCompanies,
    duplicateCandidateGroups,
  };
}

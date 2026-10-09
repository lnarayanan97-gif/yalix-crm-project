import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase/config';
import { OperationType } from '../firebase/errors';
import {
  Company,
  Contact,
  Lead,
  Product,
  FollowUp,
  Activity,
  AuditLog,
  DashboardStats,
  ImportRecord,
  Campaign,
} from '../types/crm';

// --- Performance Caching & Request Deduplication Engine ---
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60000; // 60 seconds TTL

const cacheStore = {
  companies: null as CacheEntry<Company[]> | null,
  contacts: null as CacheEntry<Contact[]> | null,
  leads: null as CacheEntry<Lead[]> | null,
  products: null as CacheEntry<Product[]> | null,
  followUps: null as CacheEntry<FollowUp[]> | null,
  campaigns: null as CacheEntry<Campaign[]> | null,
  imports: null as CacheEntry<ImportRecord[]> | null,
  activities: new Map<string, CacheEntry<Activity[]>>(),
};

const inFlightRequests = new Map<string, Promise<any>>();

async function fetchWithCache<T>(
  key: keyof typeof cacheStore,
  forceRefresh: boolean,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  if (!forceRefresh && (cacheStore as any)[key] && (now - (cacheStore as any)[key].timestamp < CACHE_TTL_MS)) {
    return (cacheStore as any)[key].data as T;
  }
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }
  const promise = (async () => {
    try {
      const data = await fetcher();
      (cacheStore as any)[key] = { data, timestamp: Date.now() };
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();
  inFlightRequests.set(key, promise);
  return promise;
}

export const crmService = {
  // --- Cache Management ---
  clearCache(key?: keyof typeof cacheStore): void {
    if (key) {
      if (key === 'activities') {
        cacheStore.activities.clear();
      } else {
        (cacheStore as any)[key] = null;
      }
    } else {
      cacheStore.companies = null;
      cacheStore.contacts = null;
      cacheStore.leads = null;
      cacheStore.products = null;
      cacheStore.followUps = null;
      cacheStore.campaigns = null;
      cacheStore.imports = null;
      cacheStore.activities.clear();
    }
  },

  // --- Audit Logs ---
  async logAudit(
    action: string,
    targetCollection: string,
    targetId: string,
    performedBy: string,
    performedByEmail?: string,
    details?: string
  ): Promise<void> {
    const auditId = 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const path = `audit_logs/${auditId}`;
    try {
      const payload: AuditLog = {
        id: auditId,
        auditId,
        action,
        targetCollection,
        targetId,
        performedBy,
        performedByEmail,
        details,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'audit_logs', auditId), payload);
    } catch (err) {
      console.warn('Audit log write error:', err);
    }
  },

  // --- Activities ---
  async addActivity(activity: Omit<Activity, 'id' | 'activityId' | 'createdAt'>): Promise<Activity> {
    const activityId = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const path = `activities/${activityId}`;
    try {
      const payload: Activity = {
        ...activity,
        id: activityId,
        activityId,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'activities', activityId), payload);
      // Invalidate target activities cache
      cacheStore.activities.clear();
      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async getActivitiesForTarget(
    targetType: 'companyId' | 'contactId' | 'leadId',
    targetId: string,
    forceRefresh: boolean = false
  ): Promise<Activity[]> {
    const cacheKey = `${targetType}_${targetId}`;
    const now = Date.now();
    if (!forceRefresh && cacheStore.activities.has(cacheKey)) {
      const entry = cacheStore.activities.get(cacheKey)!;
      if (now - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<Activity[]>;
    }

    const path = 'activities';
    const promise = (async () => {
      try {
        const q = query(collection(db, path), where(targetType, '==', targetId), limit(50));
        const snap = await getDocs(q);
        const items: Activity[] = [];
        snap.forEach((d) => items.push(d.data() as Activity));
        const sorted = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        cacheStore.activities.set(cacheKey, { data: sorted, timestamp: Date.now() });
        return sorted;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, promise);
    return promise;
  },

  // --- Companies ---
  async getCompanies(forceRefresh: boolean = false): Promise<Company[]> {
    const path = 'companies';
    return fetchWithCache('companies', forceRefresh, async () => {
      try {
        const snap = await getDocs(collection(db, path));
        const list: Company[] = [];
        snap.forEach((d) => list.push(d.data() as Company));
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });
  },

  async getCompany(companyId: string): Promise<Company | null> {
    // Check in-memory companies cache first to avoid Firestore read
    if (cacheStore.companies?.data) {
      const cached = cacheStore.companies.data.find((c) => c.companyId === companyId);
      if (cached) return cached;
    }
    const path = `companies/${companyId}`;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId));
      if (!snap.exists()) return null;
      return snap.data() as Company;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  },

  async saveCompany(
    company: Partial<Company> & { companyName: string },
    userId: string,
    userEmail?: string
  ): Promise<Company> {
    const companyId = company.companyId || 'comp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const path = `companies/${companyId}`;
    const now = new Date().toISOString();

    try {
      const docRef = doc(db, 'companies', companyId);
      const existingSnap = await getDoc(docRef);
      const isNew = !existingSnap.exists();

      const payload: Company = {
        ...((existingSnap.data() as Company) || {}),
        ...company,
        id: companyId,
        companyId,
        createdAt: isNew ? now : existingSnap.data()?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(docRef, payload);
      // Invalidate companies cache
      cacheStore.companies = null;

      await this.logAudit(
        isNew ? 'CREATE_COMPANY' : 'UPDATE_COMPANY',
        'companies',
        companyId,
        userId,
        userEmail,
        `Saved company ${company.companyName}`
      );

      await this.addActivity({
        companyId,
        type: isNew ? 'imported' : 'updated',
        description: isNew
          ? `Company ${company.companyName} created in YALIX database`
          : `Company details updated for ${company.companyName}`,
        performedBy: userId,
      });

      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteCompany(companyId: string, userId: string, userEmail?: string): Promise<void> {
    const path = `companies/${companyId}`;
    try {
      await deleteDoc(doc(db, 'companies', companyId));
      // Invalidate companies cache
      cacheStore.companies = null;
      await this.logAudit('DELETE_COMPANY', 'companies', companyId, userId, userEmail, `Deleted company ${companyId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Contacts ---
  async getContacts(forceRefresh: boolean = false): Promise<Contact[]> {
    const path = 'contacts';
    return fetchWithCache('contacts', forceRefresh, async () => {
      try {
        const snap = await getDocs(collection(db, path));
        const list: Contact[] = [];
        snap.forEach((d) => list.push(d.data() as Contact));
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });
  },

  async saveContact(
    contact: Partial<Contact> & { firstName: string; businessEmail: string },
    userId: string,
    userEmail?: string
  ): Promise<Contact> {
    const contactId = contact.contactId || 'cnt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const path = `contacts/${contactId}`;
    const now = new Date().toISOString();

    try {
      const docRef = doc(db, 'contacts', contactId);
      const existingSnap = await getDoc(docRef);
      const isNew = !existingSnap.exists();

      // Normalize email
      const normalizedEmail = contact.businessEmail.trim().toLowerCase();

      const payload: Contact = {
        ...((existingSnap.data() as Contact) || {}),
        ...contact,
        businessEmail: normalizedEmail,
        id: contactId,
        contactId,
        emailStatus: contact.emailStatus || 'VALID',
        contactStatus: contact.contactStatus || 'ACTIVE',
        createdAt: isNew ? now : existingSnap.data()?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(docRef, payload);
      // Invalidate contacts cache
      cacheStore.contacts = null;

      await this.logAudit(
        isNew ? 'CREATE_CONTACT' : 'UPDATE_CONTACT',
        'contacts',
        contactId,
        userId,
        userEmail,
        `Saved contact ${contact.firstName} ${contact.lastName || ''} (${normalizedEmail})`
      );

      await this.addActivity({
        contactId,
        companyId: payload.companyId,
        type: isNew ? 'imported' : 'updated',
        description: isNew
          ? `Contact ${payload.firstName} ${payload.lastName || ''} added`
          : `Contact info updated for ${payload.firstName} ${payload.lastName || ''}`,
        performedBy: userId,
      });

      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteContact(contactId: string, userId: string, userEmail?: string): Promise<void> {
    const path = `contacts/${contactId}`;
    try {
      await deleteDoc(doc(db, 'contacts', contactId));
      // Invalidate contacts cache
      cacheStore.contacts = null;
      await this.logAudit('DELETE_CONTACT', 'contacts', contactId, userId, userEmail, `Deleted contact ${contactId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Leads ---
  async getLeads(forceRefresh: boolean = false): Promise<Lead[]> {
    const path = 'leads';
    return fetchWithCache('leads', forceRefresh, async () => {
      try {
        const snap = await getDocs(collection(db, path));
        const list: Lead[] = [];
        snap.forEach((d) => list.push(d.data() as Lead));
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });
  },

  async saveLead(
    lead: Partial<Lead> & { leadStatus: Lead['leadStatus']; priority: Lead['priority'] },
    userId: string,
    userEmail?: string
  ): Promise<Lead> {
    const leadId = lead.leadId || 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const path = `leads/${leadId}`;
    const now = new Date().toISOString();

    try {
      const docRef = doc(db, 'leads', leadId);
      const existingSnap = await getDoc(docRef);
      const isNew = !existingSnap.exists();

      const payload: Lead = {
        ...((existingSnap.data() as Lead) || {}),
        ...lead,
        id: leadId,
        leadId,
        createdAt: isNew ? now : existingSnap.data()?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(docRef, payload);
      // Invalidate leads cache
      cacheStore.leads = null;

      await this.logAudit(
        isNew ? 'CREATE_LEAD' : 'UPDATE_LEAD',
        'leads',
        leadId,
        userId,
        userEmail,
        `Saved lead ${leadId} (Status: ${lead.leadStatus})`
      );

      await this.addActivity({
        leadId,
        companyId: payload.companyId,
        contactId: payload.contactId,
        type: isNew ? 'imported' : 'status_changed',
        description: isNew ? `New lead generated: ${payload.leadStatus}` : `Lead updated to ${payload.leadStatus}`,
        performedBy: userId,
      });

      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteLead(leadId: string, userId: string, userEmail?: string): Promise<void> {
    const path = `leads/${leadId}`;
    try {
      await deleteDoc(doc(db, 'leads', leadId));
      // Invalidate leads cache
      cacheStore.leads = null;
      await this.logAudit('DELETE_LEAD', 'leads', leadId, userId, userEmail, `Deleted lead ${leadId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Products Master ---
  async getProducts(forceRefresh: boolean = false): Promise<Product[]> {
    const path = 'products';
    return fetchWithCache('products', forceRefresh, async () => {
      try {
        const snap = await getDocs(collection(db, path));
        const list: Product[] = [];
        snap.forEach((d) => list.push(d.data() as Product));
        return list.sort((a, b) => a.name.localeCompare(b.name));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });
  },

  async saveProduct(
    product: Partial<Product> & { name: string },
    userId: string,
    userEmail?: string
  ): Promise<Product> {
    const productId = product.productId || 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const path = `products/${productId}`;
    const now = new Date().toISOString();

    try {
      const docRef = doc(db, 'products', productId);
      const existingSnap = await getDoc(docRef);
      const isNew = !existingSnap.exists();

      const payload: Product = {
        ...((existingSnap.data() as Product) || {}),
        ...product,
        id: productId,
        productId,
        active: product.active ?? true,
        createdAt: isNew ? now : existingSnap.data()?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(docRef, payload);
      // Invalidate products cache
      cacheStore.products = null;

      await this.logAudit(
        isNew ? 'CREATE_PRODUCT' : 'UPDATE_PRODUCT',
        'products',
        productId,
        userId,
        userEmail,
        `Saved product ${product.name}`
      );
      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  // --- Follow-ups ---
  async getFollowUps(forceRefresh: boolean = false): Promise<FollowUp[]> {
    const path = 'followups';
    return fetchWithCache('followUps', forceRefresh, async () => {
      try {
        const snap = await getDocs(collection(db, path));
        const list: FollowUp[] = [];
        snap.forEach((d) => list.push(d.data() as FollowUp));
        return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });
  },

  async saveFollowUp(
    followUp: Partial<FollowUp> & { title: string; dueDate: string; priority: FollowUp['priority'] },
    userId: string,
    userEmail?: string
  ): Promise<FollowUp> {
    const followUpId = followUp.followUpId || 'fu_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const path = `followups/${followUpId}`;
    const now = new Date().toISOString();

    try {
      const docRef = doc(db, 'followups', followUpId);
      const existingSnap = await getDoc(docRef);
      const isNew = !existingSnap.exists();

      const payload: FollowUp = {
        ...((existingSnap.data() as FollowUp) || {}),
        ...followUp,
        id: followUpId,
        followUpId,
        status: followUp.status || 'PENDING',
        createdAt: isNew ? now : existingSnap.data()?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(docRef, payload);
      // Invalidate followUps cache
      cacheStore.followUps = null;

      await this.addActivity({
        companyId: payload.companyId,
        contactId: payload.contactId,
        leadId: payload.leadId,
        type: isNew ? 'follow_up_created' : 'status_changed',
        description: `Follow-up "${payload.title}" scheduled for ${payload.dueDate}`,
        performedBy: userId,
      });

      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async markFollowUpComplete(followUpId: string, userId: string): Promise<void> {
    const path = `followups/${followUpId}`;
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'followups', followUpId), {
        status: 'COMPLETED',
        completedAt: now,
        updatedAt: now,
      });
      // Invalidate followUps cache
      cacheStore.followUps = null;
      await this.addActivity({
        type: 'follow_up_completed',
        description: `Follow-up ${followUpId} completed`,
        performedBy: userId,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // --- In-Memory Zero-Firestore-Read Stats Computation Engine ---
  calculateDashboardStats(
    companies: Company[],
    contacts: Contact[],
    leads: Lead[],
    campaigns: Campaign[],
    followUps: FollowUp[],
    recentImportsCount: number = 0
  ): DashboardStats {
    let validEmails = 0;
    for (const c of contacts) {
      if (c.emailStatus === 'VALID') validEmails++;
    }

    let newLeads = 0;
    let interestedLeads = 0;
    for (const l of leads) {
      if (l.leadStatus === 'NEW') newLeads++;
      if (l.leadStatus === 'INTERESTED' || l.leadStatus === 'QUOTATION' || l.leadStatus === 'NEGOTIATION') {
        interestedLeads++;
      }
    }

    let activeCampaigns = 0;
    for (const camp of campaigns) {
      if (camp.status === 'RUNNING' || camp.status === 'SCHEDULED') activeCampaigns++;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let todayFollowUps = 0;
    let overdueFollowUps = 0;

    for (const fu of followUps) {
      if (fu.status === 'PENDING') {
        if (fu.dueDate === todayStr) {
          todayFollowUps++;
        } else if (fu.dueDate < todayStr) {
          overdueFollowUps++;
        }
      }
    }

    return {
      totalCompanies: companies.length,
      totalContacts: contacts.length,
      validEmails,
      newLeads,
      interestedLeads,
      activeCampaigns,
      todayFollowUps,
      overdueFollowUps,
      recentImportsCount,
      recentCampaignsCount: campaigns.length,
    };
  },

  // --- Real Dynamic Dashboard Stats from Firestore (Cache-Aware & Deduplicated) ---
  async getDashboardStats(forceRefresh: boolean = false): Promise<DashboardStats> {
    try {
      // Re-uses cached collections or deduplicated promises — zero redundant reads!
      const [comps, cnts, lds, camps, fus, imps] = await Promise.all([
        this.getCompanies(forceRefresh),
        this.getContacts(forceRefresh),
        this.getLeads(forceRefresh),
        this.getCampaigns(forceRefresh),
        this.getFollowUps(forceRefresh),
        this.getImports(forceRefresh),
      ]);

      return this.calculateDashboardStats(comps, cnts, lds, camps, fus, imps.length);
    } catch (err: any) {
      console.warn('Dashboard stats calculation notice (offline/deferred):', err?.message || err);
      return {
        totalCompanies: 0,
        totalContacts: 0,
        validEmails: 0,
        newLeads: 0,
        interestedLeads: 0,
        activeCampaigns: 0,
        todayFollowUps: 0,
        overdueFollowUps: 0,
        recentImportsCount: 0,
        recentCampaignsCount: 0,
      };
    }
  },

  // --- Imports list ---
  async getImports(forceRefresh: boolean = false): Promise<ImportRecord[]> {
    const path = 'imports';
    return fetchWithCache('imports', forceRefresh, async () => {
      try {
        const snap = await getDocs(collection(db, path));
        const list: ImportRecord[] = [];
        snap.forEach((d) => list.push(d.data() as ImportRecord));
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });
  },

  async createImportRecord(importRecord: ImportRecord, userId: string, userEmail?: string): Promise<void> {
    const path = `imports/${importRecord.importId}`;
    try {
      await setDoc(doc(db, 'imports', importRecord.importId), importRecord);
      cacheStore.imports = null;
      await this.logAudit(
        'IMPORT_BATCH',
        'imports',
        importRecord.importId,
        userId,
        userEmail,
        `Imported file ${importRecord.fileName} (${importRecord.rowCount} rows)`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  // --- Campaigns list ---
  async getCampaigns(forceRefresh: boolean = false): Promise<Campaign[]> {
    const path = 'campaigns';
    return fetchWithCache('campaigns', forceRefresh, async () => {
      try {
        const snap = await getDocs(collection(db, path));
        const list: Campaign[] = [];
        snap.forEach((d) => list.push(d.data() as Campaign));
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });
  },

  async saveCampaign(
    campaign: Partial<Campaign> & { name: string; subject: string },
    userId: string,
    userEmail?: string
  ): Promise<Campaign> {
    const campaignId = campaign.campaignId || 'camp_' + Date.now();
    const path = `campaigns/${campaignId}`;
    const now = new Date().toISOString();

    try {
      const docRef = doc(db, 'campaigns', campaignId);
      const existingSnap = await getDoc(docRef);
      const isNew = !existingSnap.exists();

      const payload: Campaign = {
        ...((existingSnap.data() as Campaign) || {}),
        ...campaign,
        id: campaignId,
        campaignId,
        status: campaign.status || 'SCHEDULED',
        createdBy: isNew ? userId : (existingSnap.data() as Campaign)?.createdBy || userId,
        createdAt: isNew ? now : (existingSnap.data() as Campaign)?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(docRef, payload);
      cacheStore.campaigns = null;

      await this.logAudit(
        isNew ? 'CREATE_CAMPAIGN' : 'UPDATE_CAMPAIGN',
        'campaigns',
        campaignId,
        userId,
        userEmail,
        `Saved campaign ${campaign.name}`
      );

      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteCampaign(campaignId: string, userId: string, userEmail?: string): Promise<void> {
    const path = `campaigns/${campaignId}`;
    try {
      await deleteDoc(doc(db, 'campaigns', campaignId));
      cacheStore.campaigns = null;
      await this.logAudit('DELETE_CAMPAIGN', 'campaigns', campaignId, userId, userEmail, `Deleted campaign ${campaignId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Company Contacts Relationship ---
  async getCompanyContacts(companyId: string): Promise<Contact[]> {
    // If contacts are already loaded in memory, filter synchronously
    if (cacheStore.contacts?.data) {
      return cacheStore.contacts.data
        .filter((c) => c.companyId === companyId)
        .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
    }
    const path = 'contacts';
    try {
      const q = query(collection(db, path), where('companyId', '==', companyId));
      const snap = await getDocs(q);
      const list: Contact[] = [];
      snap.forEach((d) => list.push(d.data() as Contact));
      return list.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  // --- Duplicate Prevention Query ---
  async findContactByEmail(email: string): Promise<Contact | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (cacheStore.contacts?.data) {
      const found = cacheStore.contacts.data.find((c) => (c.businessEmail || '').toLowerCase() === cleanEmail);
      if (found) return found;
    }
    const path = 'contacts';
    try {
      const q = query(collection(db, path), where('businessEmail', '==', cleanEmail), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return snap.docs[0].data() as Contact;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  // --- Real Global CRM Search across supported fields ---
  async searchCRM(term: string): Promise<{
    companies: Company[];
    contacts: Contact[];
    leads: Lead[];
  }> {
    const queryStr = term.trim().toLowerCase();
    if (!queryStr) return { companies: [], contacts: [], leads: [] };

    try {
      const [comps, cnts, lds] = await Promise.all([
        this.getCompanies(),
        this.getContacts(),
        this.getLeads(),
      ]);

      const companies = comps.filter((c) => {
        const searchable = [
          c.companyName,
          c.website,
          c.country,
          c.city,
          c.state,
          c.industry,
          c.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(queryStr);
      });

      const contacts = cnts.filter((c) => {
        const searchable = [
          c.firstName,
          c.lastName,
          c.businessEmail,
          c.secondaryEmail,
          c.companyName,
          c.phone,
          c.mobile,
          c.jobTitle,
          c.department,
          c.country,
          c.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(queryStr);
      });

      const leads = lds.filter((l) => {
        const searchable = [
          l.companyName,
          l.contactName,
          l.contactEmail,
          l.productInterest,
          l.leadStatus,
          l.priority,
          l.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(queryStr);
      });

      return { companies, contacts, leads };
    } catch (err) {
      console.warn('Search query warning:', err);
      return { companies: [], contacts: [], leads: [] };
    }
  },
};


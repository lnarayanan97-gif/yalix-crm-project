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

export const crmService = {
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
      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async getActivitiesForTarget(
    targetType: 'companyId' | 'contactId' | 'leadId',
    targetId: string
  ): Promise<Activity[]> {
    const path = 'activities';
    try {
      const q = query(collection(db, path), where(targetType, '==', targetId), limit(50));
      const snap = await getDocs(q);
      const items: Activity[] = [];
      snap.forEach((d) => items.push(d.data() as Activity));
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  // --- Companies ---
  async getCompanies(): Promise<Company[]> {
    const path = 'companies';
    try {
      const snap = await getDocs(collection(db, path));
      const list: Company[] = [];
      snap.forEach((d) => list.push(d.data() as Company));
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async getCompany(companyId: string): Promise<Company | null> {
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
      await this.logAudit('DELETE_COMPANY', 'companies', companyId, userId, userEmail, `Deleted company ${companyId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Contacts ---
  async getContacts(): Promise<Contact[]> {
    const path = 'contacts';
    try {
      const snap = await getDocs(collection(db, path));
      const list: Contact[] = [];
      snap.forEach((d) => list.push(d.data() as Contact));
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
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
      await this.logAudit('DELETE_CONTACT', 'contacts', contactId, userId, userEmail, `Deleted contact ${contactId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Leads ---
  async getLeads(): Promise<Lead[]> {
    const path = 'leads';
    try {
      const snap = await getDocs(collection(db, path));
      const list: Lead[] = [];
      snap.forEach((d) => list.push(d.data() as Lead));
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
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
      await this.logAudit('DELETE_LEAD', 'leads', leadId, userId, userEmail, `Deleted lead ${leadId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Products Master ---
  async getProducts(): Promise<Product[]> {
    const path = 'products';
    try {
      const snap = await getDocs(collection(db, path));
      const list: Product[] = [];
      snap.forEach((d) => list.push(d.data() as Product));
      return list.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
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
  async getFollowUps(): Promise<FollowUp[]> {
    const path = 'followups';
    try {
      const snap = await getDocs(collection(db, path));
      const list: FollowUp[] = [];
      snap.forEach((d) => list.push(d.data() as FollowUp));
      return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
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
      await this.addActivity({
        type: 'follow_up_completed',
        description: `Follow-up ${followUpId} completed`,
        performedBy: userId,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // --- Real Dynamic Dashboard Stats from Firestore ---
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [companiesSnap, contactsSnap, leadsSnap, campaignsSnap, followupsSnap, importsSnap] = await Promise.all([
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'contacts')),
        getDocs(collection(db, 'leads')),
        getDocs(collection(db, 'campaigns')),
        getDocs(collection(db, 'followups')),
        getDocs(collection(db, 'imports')),
      ]);

      let validEmails = 0;
      contactsSnap.forEach((doc) => {
        const c = doc.data() as Contact;
        if (c.emailStatus === 'VALID') validEmails++;
      });

      let newLeads = 0;
      let interestedLeads = 0;
      leadsSnap.forEach((doc) => {
        const l = doc.data() as Lead;
        if (l.leadStatus === 'NEW') newLeads++;
        if (l.leadStatus === 'INTERESTED' || l.leadStatus === 'QUOTATION' || l.leadStatus === 'NEGOTIATION') {
          interestedLeads++;
        }
      });

      let activeCampaigns = 0;
      campaignsSnap.forEach((doc) => {
        const camp = doc.data() as Campaign;
        if (camp.status === 'RUNNING' || camp.status === 'SCHEDULED') activeCampaigns++;
      });

      const todayStr = new Date().toISOString().split('T')[0];
      let todayFollowUps = 0;
      let overdueFollowUps = 0;

      followupsSnap.forEach((doc) => {
        const fu = doc.data() as FollowUp;
        if (fu.status === 'PENDING') {
          if (fu.dueDate === todayStr) {
            todayFollowUps++;
          } else if (fu.dueDate < todayStr) {
            overdueFollowUps++;
          }
        }
      });

      return {
        totalCompanies: companiesSnap.size,
        totalContacts: contactsSnap.size,
        validEmails,
        newLeads,
        interestedLeads,
        activeCampaigns,
        todayFollowUps,
        overdueFollowUps,
        recentImportsCount: importsSnap.size,
        recentCampaignsCount: campaignsSnap.size,
      };
    } catch (err) {
      console.error('Error calculating dashboard stats:', err);
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
  async getImports(): Promise<ImportRecord[]> {
    const path = 'imports';
    try {
      const snap = await getDocs(collection(db, path));
      const list: ImportRecord[] = [];
      snap.forEach((d) => list.push(d.data() as ImportRecord));
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  // --- Campaigns list ---
  async getCampaigns(): Promise<Campaign[]> {
    const path = 'campaigns';
    try {
      const snap = await getDocs(collection(db, path));
      const list: Campaign[] = [];
      snap.forEach((d) => list.push(d.data() as Campaign));
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },
};

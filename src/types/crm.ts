export type LeadStatus =
  | 'NEW'
  | 'RESEARCHED'
  | 'CONTACTED'
  | 'REPLIED'
  | 'INTERESTED'
  | 'QUOTATION'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST'
  | 'NOT_INTERESTED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type EmailStatus = 'VALID' | 'INVALID' | 'RISKY' | 'UNVERIFIED' | 'BOUNCED';

export type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'UNSUBSCRIBED';

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER' | 'admin' | 'manager' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active?: boolean;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizedUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
  active: boolean;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string; // Firestore document ID (same as companyId)
  companyId: string;
  companyName: string;
  website?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  industry?: string;
  companySize?: string;
  revenue?: string;
  linkedinUrl?: string;
  source?: string;
  sourceDate?: string;
  status?: string;
  notes?: string;
  originalCompanyName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string; // Firestore document ID
  contactId: string;
  companyId?: string;
  companyName?: string; // Denormalized for rapid searching
  firstName: string;
  lastName?: string;
  jobTitle?: string;
  department?: string;
  businessEmail: string;
  emailHash?: string; // Deterministic SHA-256 email key for O(1) indexed lookup
  secondaryEmail?: string;
  phone?: string;
  mobile?: string;
  linkedinUrl?: string;
  country?: string;
  source?: string;
  emailStatus: EmailStatus;
  contactStatus: ContactStatus;
  lastContactedAt?: string;
  lastRepliedAt?: string;
  notes?: string;
  rawSourceValues?: Record<string, any>; // Preserves original un-normalized input
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  leadId: string;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  productInterest?: string;
  leadSource?: string;
  leadStatus: LeadStatus;
  priority: Priority;
  assignedTo?: string;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  productId: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  followUpId: string;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  contactName?: string;
  leadId?: string;
  title: string;
  note?: string;
  dueDate: string; // YYYY-MM-DD or ISO
  priority: Priority;
  status: FollowUpStatus;
  assignedTo?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  activityId: string;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  type:
    | 'imported'
    | 'updated'
    | 'email_sent'
    | 'email_bounced'
    | 'email_replied'
    | 'note_added'
    | 'status_changed'
    | 'follow_up_created'
    | 'follow_up_completed';
  description: string;
  performedBy: string;
  performedByName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ImportRecord {
  id: string;
  importId: string;
  fileName: string;
  fileType: string;
  rowCount: number;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  invalidCount: number;
  skippedCount: number;
  leadsCreatedCount?: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdBy: string;
  createdAt: string;
  summary?: string;
}

export interface ImportLog {
  id: string;
  logId: string;
  importId: string;
  rowNumber: number;
  status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'INVALID';
  reason?: string;
  dataSnapshot?: Record<string, any>;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  templateId: string;
  name: string;
  subject: string;
  htmlBody: string;
  textFallback: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  campaignId: string;
  name: string;
  subject: string;
  templateId?: string;
  product?: string;
  audienceFilters?: Record<string, any>;
  recipientCount: number;
  status: CampaignStatus;
  scheduledAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  auditId: string;
  action: string;
  targetCollection: string;
  targetId: string;
  details?: string;
  performedBy: string;
  performedByEmail?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalCompanies: number;
  totalContacts: number;
  validEmails: number;
  newLeads: number;
  interestedLeads: number;
  activeCampaigns: number;
  todayFollowUps: number;
  overdueFollowUps: number;
  recentImportsCount: number;
  recentCampaignsCount: number;
}

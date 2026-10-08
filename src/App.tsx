import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { LoginView } from './components/auth/LoginView';
import { AccessDeniedView } from './components/auth/AccessDeniedView';
import { ApplicationShell } from './components/layout/ApplicationShell';
import { NavTab } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { CompaniesView } from './components/modules/companies/CompaniesView';
import { ContactsView } from './components/modules/contacts/ContactsView';
import { LeadsView } from './components/modules/leads/LeadsView';
import { ProductsView } from './components/modules/products/ProductsView';
import { FollowUpsView } from './components/modules/followups/FollowUpsView';
import { ImportWizardView } from './components/modules/import/ImportWizardView';
import { TemplatesView } from './components/modules/templates/TemplatesView';
import { CampaignsView } from './components/modules/campaigns/CampaignsView';
import { ReportsView } from './components/modules/reports/ReportsView';
import { SettingsView } from './components/modules/settings/SettingsView';
import { Modal } from './components/common/Modal';
import { LoadingSpinner } from './components/common/LoadingSpinner';

import {
  Company,
  Contact,
  Lead,
  Product,
  FollowUp,
  Campaign,
  DashboardStats,
} from './types/crm';
import { crmService } from './services/crmService';
import { ensureYalixProducts, seedSampleCRMData } from './services/seedService';
import { testConnection } from './firebase/config';

function MainApp() {
  const { currentUser, isAuthorized, loading: authLoading } = useAuth();
  const { success, error, info } = useToast();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');

  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
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
  });

  const [dataLoading, setDataLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Quick Action Modal states
  const [quickActionModal, setQuickActionModal] = useState<'company' | 'contact' | 'lead' | 'followup' | null>(null);

  // Quick form states
  const [newCompany, setNewCompany] = useState({ companyName: '', country: '', industry: '', website: '' });
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', businessEmail: '', companyId: '', phone: '' });
  const [newLead, setNewLead] = useState({ companyId: '', contactId: '', productInterest: '', leadStatus: 'NEW' as const, priority: 'HIGH' as const, notes: '' });
  const [newFollowUp, setNewFollowUp] = useState({ title: '', dueDate: new Date().toISOString().split('T')[0], priority: 'HIGH' as const, note: '', companyId: '' });

  // Load all CRM data
  const loadCRMData = useCallback(async () => {
    if (!currentUser || !isAuthorized) return;
    setDataLoading(true);
    try {
      // Test server connection as per skill
      await testConnection();

      const [comps, cnts, lds, prods, fus, camps, dashboardStats] = await Promise.all([
        crmService.getCompanies(),
        crmService.getContacts(),
        crmService.getLeads(),
        crmService.getProducts(),
        crmService.getFollowUps(),
        crmService.getCampaigns(),
        crmService.getDashboardStats(),
      ]);

      setCompanies(comps);
      setContacts(cnts);
      setLeads(lds);
      setProducts(prods);
      setFollowUps(fus);
      setCampaigns(camps);
      setStats(dashboardStats);

      // Auto-initialize standard YALIX catalog if empty
      if (prods.length === 0) {
        await ensureYalixProducts(currentUser.uid);
        const refreshedProds = await crmService.getProducts();
        setProducts(refreshedProds);
      }
    } catch (err: any) {
      console.error('Error fetching CRM data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [currentUser, isAuthorized]);

  useEffect(() => {
    if (currentUser && isAuthorized) {
      loadCRMData();
    }
  }, [currentUser, isAuthorized, loadCRMData]);

  const handleSeedData = async () => {
    if (!currentUser) return;
    setIsSeeding(true);
    try {
      await ensureYalixProducts(currentUser.uid);
      await seedSampleCRMData(currentUser.uid);
      success('Database Seeded', 'Sample YALIX companies, contacts, leads and follow-ups loaded into Firestore.');
      await loadCRMData();
    } catch (err: any) {
      error('Seeding Failed', err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  // Quick action submits
  const handleSaveQuickCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.companyName.trim()) return;
    try {
      await crmService.saveCompany(newCompany, currentUser?.uid || 'user', currentUser?.email || undefined);
      success('Company Created', newCompany.companyName);
      setQuickActionModal(null);
      setNewCompany({ companyName: '', country: '', industry: '', website: '' });
      loadCRMData();
    } catch (err: any) {
      error('Create Failed', err.message);
    }
  };

  const handleSaveQuickContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.firstName.trim() || !newContact.businessEmail.trim()) return;
    try {
      const parentCo = companies.find((c) => c.companyId === newContact.companyId);
      await crmService.saveContact(
        {
          ...newContact,
          companyName: parentCo?.companyName,
          emailStatus: 'VALID',
          contactStatus: 'ACTIVE',
        },
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Contact Created', `${newContact.firstName} (${newContact.businessEmail})`);
      setQuickActionModal(null);
      setNewContact({ firstName: '', lastName: '', businessEmail: '', companyId: '', phone: '' });
      loadCRMData();
    } catch (err: any) {
      error('Create Failed', err.message);
    }
  };

  const handleSaveQuickLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parentCo = companies.find((c) => c.companyId === newLead.companyId);
      const parentCnt = contacts.find((c) => c.contactId === newLead.contactId);
      await crmService.saveLead(
        {
          ...newLead,
          companyName: parentCo?.companyName,
          contactName: parentCnt ? `${parentCnt.firstName} ${parentCnt.lastName || ''}`.trim() : undefined,
          contactEmail: parentCnt?.businessEmail,
        },
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Lead Created', 'Added to pipeline.');
      setQuickActionModal(null);
      loadCRMData();
    } catch (err: any) {
      error('Create Failed', err.message);
    }
  };

  const handleSaveQuickFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFollowUp.title.trim()) return;
    try {
      const parentCo = companies.find((c) => c.companyId === newFollowUp.companyId);
      await crmService.saveFollowUp(
        {
          ...newFollowUp,
          companyName: parentCo?.companyName,
          status: 'PENDING',
        },
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Follow-up Scheduled', newFollowUp.title);
      setQuickActionModal(null);
      loadCRMData();
    } catch (err: any) {
      error('Create Failed', err.message);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-extrabold text-xl shadow-lg">
          Y
        </div>
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs uppercase font-medium tracking-wider text-slate-500">
          Initializing YALIX Secure CRM...
        </span>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView />;
  }

  if (!isAuthorized) {
    return <AccessDeniedView />;
  }

  const pendingFollowUps = followUps.filter((f) => f.status === 'PENDING').length;

  return (
    <ApplicationShell
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      pendingFollowUpsCount={pendingFollowUps}
      onGlobalSearch={setGlobalSearch}
      onQuickAction={(action) => setQuickActionModal(action)}
      onSeedData={handleSeedData}
      isSeeding={isSeeding}
    >
      {/* Tab routing */}
      {currentTab === 'dashboard' && (
        <DashboardView
          stats={stats}
          companies={companies}
          contacts={contacts}
          leads={leads}
          followUps={followUps}
          onNavigate={setCurrentTab}
          onOpenQuickAction={(action) => setQuickActionModal(action)}
        />
      )}

      {currentTab === 'companies' && (
        <CompaniesView
          companies={companies}
          onRefresh={loadCRMData}
          isLoading={dataLoading}
        />
      )}

      {currentTab === 'contacts' && (
        <ContactsView
          contacts={contacts}
          companies={companies}
          onRefresh={loadCRMData}
          isLoading={dataLoading}
        />
      )}

      {currentTab === 'leads' && (
        <LeadsView
          leads={leads}
          companies={companies}
          contacts={contacts}
          products={products}
          onRefresh={loadCRMData}
          isLoading={dataLoading}
        />
      )}

      {currentTab === 'products' && (
        <ProductsView
          products={products}
          onRefresh={loadCRMData}
          isLoading={dataLoading}
        />
      )}

      {currentTab === 'followups' && (
        <FollowUpsView
          followUps={followUps}
          companies={companies}
          contacts={contacts}
          leads={leads}
          onRefresh={loadCRMData}
          isLoading={dataLoading}
        />
      )}

      {currentTab === 'import' && (
        <ImportWizardView
          companies={companies}
          contacts={contacts}
          onRefresh={loadCRMData}
        />
      )}

      {currentTab === 'templates' && (
        <TemplatesView products={products} isLoading={dataLoading} />
      )}

      {currentTab === 'campaigns' && (
        <CampaignsView
          campaigns={campaigns}
          contacts={contacts}
          products={products}
          onRefresh={loadCRMData}
          isLoading={dataLoading}
        />
      )}

      {currentTab === 'reports' && (
        <ReportsView
          stats={stats}
          companies={companies}
          contacts={contacts}
          leads={leads}
          products={products}
          followUps={followUps}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsView
          companies={companies}
          contacts={contacts}
          leads={leads}
          followUps={followUps}
        />
      )}

      {/* Quick Add Company Modal */}
      {quickActionModal === 'company' && (
        <Modal
          isOpen={true}
          onClose={() => setQuickActionModal(null)}
          title="Quick Add Company"
          footer={
            <button
              form="quick-comp-form"
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              Save Company
            </button>
          }
        >
          <form id="quick-comp-form" onSubmit={handleSaveQuickCompany} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
              <input
                required
                type="text"
                value={newCompany.companyName}
                onChange={(e) => setNewCompany({ ...newCompany, companyName: e.target.value })}
                placeholder="e.g. European Nutraceuticals BV"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={newCompany.country}
                  onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                  placeholder="e.g. Netherlands"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  value={newCompany.industry}
                  onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                  placeholder="e.g. Health Supplements"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Add Contact Modal */}
      {quickActionModal === 'contact' && (
        <Modal
          isOpen={true}
          onClose={() => setQuickActionModal(null)}
          title="Quick Add Contact"
          footer={
            <button
              form="quick-cnt-form"
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              Save Contact
            </button>
          }
        >
          <form id="quick-cnt-form" onSubmit={handleSaveQuickContact} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                <input
                  required
                  type="text"
                  value={newContact.firstName}
                  onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={newContact.lastName}
                  onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Email *</label>
              <input
                required
                type="email"
                value={newContact.businessEmail}
                onChange={(e) => setNewContact({ ...newContact, businessEmail: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
              <select
                value={newContact.companyId}
                onChange={(e) => setNewContact({ ...newContact, companyId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              >
                <option value="">None / Unassigned</option>
                {companies.map((c) => (
                  <option key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Add Lead Modal */}
      {quickActionModal === 'lead' && (
        <Modal
          isOpen={true}
          onClose={() => setQuickActionModal(null)}
          title="Quick Add Pipeline Lead"
          footer={
            <button
              form="quick-lead-form"
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              Add Lead
            </button>
          }
        >
          <form id="quick-lead-form" onSubmit={handleSaveQuickLead} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
              <select
                value={newLead.companyId}
                onChange={(e) => setNewLead({ ...newLead, companyId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              >
                <option value="">Select Company</option>
                {companies.map((c) => (
                  <option key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Interest</label>
              <select
                value={newLead.productInterest}
                onChange={(e) => setNewLead({ ...newLead, productInterest: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              >
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stage</label>
                <select
                  value={newLead.leadStatus}
                  onChange={(e) => setNewLead({ ...newLead, leadStatus: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium"
                >
                  <option value="NEW">NEW</option>
                  <option value="RESEARCHED">RESEARCHED</option>
                  <option value="INTERESTED">INTERESTED</option>
                  <option value="QUOTATION">QUOTATION</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={newLead.priority}
                  onChange={(e) => setNewLead({ ...newLead, priority: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                >
                  <option value="URGENT">URGENT</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Add Follow-up Modal */}
      {quickActionModal === 'followup' && (
        <Modal
          isOpen={true}
          onClose={() => setQuickActionModal(null)}
          title="Schedule Follow-up"
          footer={
            <button
              form="quick-fu-form"
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              Schedule
            </button>
          }
        >
          <form id="quick-fu-form" onSubmit={handleSaveQuickFollowUp} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Task Action *</label>
              <input
                required
                type="text"
                value={newFollowUp.title}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, title: e.target.value })}
                placeholder="e.g. Call to follow up on container price quote"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date *</label>
                <input
                  required
                  type="date"
                  value={newFollowUp.dueDate}
                  onChange={(e) => setNewFollowUp({ ...newFollowUp, dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={newFollowUp.priority}
                  onChange={(e) => setNewFollowUp({ ...newFollowUp, priority: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                >
                  <option value="URGENT">URGENT</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
              <select
                value={newFollowUp.companyId}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, companyId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              >
                <option value="">None / Unassigned</option>
                {companies.map((c) => (
                  <option key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}
    </ApplicationShell>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}

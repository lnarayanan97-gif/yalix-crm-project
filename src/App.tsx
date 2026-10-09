import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { LoginView } from './components/auth/LoginView';
import { AccessDeniedView } from './components/auth/AccessDeniedView';
import { ApplicationShell } from './components/layout/ApplicationShell';
import { NavTab } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { Modal } from './components/common/Modal';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { YalixWordmark } from './components/common/YalixWordmark';

// Code-split modular views to shrink initial bundle and boost navigation speed
const CompaniesView = React.lazy(() =>
  import('./components/modules/companies/CompaniesView').then((m) => ({ default: m.CompaniesView }))
);
const ContactsView = React.lazy(() =>
  import('./components/modules/contacts/ContactsView').then((m) => ({ default: m.ContactsView }))
);
const LeadsView = React.lazy(() =>
  import('./components/modules/leads/LeadsView').then((m) => ({ default: m.LeadsView }))
);
const ProductsView = React.lazy(() =>
  import('./components/modules/products/ProductsView').then((m) => ({ default: m.ProductsView }))
);
const FollowUpsView = React.lazy(() =>
  import('./components/modules/followups/FollowUpsView').then((m) => ({ default: m.FollowUpsView }))
);
const ImportWizardView = React.lazy(() =>
  import('./components/modules/import/ImportWizardView').then((m) => ({ default: m.ImportWizardView }))
);
const TemplatesView = React.lazy(() =>
  import('./components/modules/templates/TemplatesView').then((m) => ({ default: m.TemplatesView }))
);
const CampaignsView = React.lazy(() =>
  import('./components/modules/campaigns/CampaignsView').then((m) => ({ default: m.CampaignsView }))
);
const ReportsView = React.lazy(() =>
  import('./components/modules/reports/ReportsView').then((m) => ({ default: m.ReportsView }))
);
const SettingsView = React.lazy(() =>
  import('./components/modules/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);

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

function MainApp() {
  const {
    currentUser,
    isAuthorized,
    loading: authLoading,
    initError,
    retryInitialization,
  } = useAuth();
  const { success, error, info } = useToast();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const handleSelectCompany = (id: string | null) => {
    setSelectedCompanyId(id);
    if (id) {
      setCurrentTab('companies');
    }
  };

  const handleSelectContact = (id: string | null) => {
    setSelectedContactId(id);
    if (id) {
      setCurrentTab('contacts');
    }
  };

  const handleTabChange = (tab: NavTab) => {
    setCurrentTab(tab);
    if (tab === 'companies') {
      setSelectedCompanyId(null);
    }
    if (tab === 'contacts') {
      setSelectedContactId(null);
    }
  };

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

  // Optimized full CRM sync (Deduplicated, zero-redundant-read, zero-unnecessary-testConnection)
  const loadCRMData = useCallback(async () => {
    if (!currentUser || !isAuthorized) return;
    setDataLoading(true);
    try {
      const [comps, cnts, lds, prods, fus, camps, imps] = await Promise.all([
        crmService.getCompanies(),
        crmService.getContacts(),
        crmService.getLeads(),
        crmService.getProducts(),
        crmService.getFollowUps(),
        crmService.getCampaigns(),
        crmService.getImports(),
      ]);

      setCompanies(comps);
      setContacts(cnts);
      setLeads(lds);
      setProducts(prods);
      setFollowUps(fus);
      setCampaigns(camps);

      // Instant in-memory zero-read stats calculation
      const dashboardStats = crmService.calculateDashboardStats(comps, cnts, lds, camps, fus, imps.length);
      setStats(dashboardStats);

      // Auto-initialize standard YALIX catalog if empty
      if (prods.length === 0) {
        await ensureYalixProducts(currentUser.uid);
        const refreshedProds = await crmService.getProducts(true);
        setProducts(refreshedProds);
      }
    } catch (err: any) {
      console.warn('CRM data fetch notice (offline/deferred):', err?.message || err);
    } finally {
      setDataLoading(false);
    }
  }, [currentUser, isAuthorized]);

  // Targeted granular refreshes to avoid re-fetching the entire database on single CRUD saves
  const refreshCompanies = useCallback(async () => {
    try {
      const comps = await crmService.getCompanies(true);
      setCompanies(comps);
      setStats((prev) => ({ ...prev, totalCompanies: comps.length }));
    } catch (err: any) {
      console.warn('Failed to refresh companies:', err);
    }
  }, []);

  const refreshContacts = useCallback(async () => {
    try {
      const cnts = await crmService.getContacts(true);
      setContacts(cnts);
      const validEmails = cnts.filter((c) => c.emailStatus === 'VALID').length;
      setStats((prev) => ({ ...prev, totalContacts: cnts.length, validEmails }));
    } catch (err: any) {
      console.warn('Failed to refresh contacts:', err);
    }
  }, []);

  const refreshCompaniesAndContacts = useCallback(async () => {
    await Promise.all([refreshCompanies(), refreshContacts()]);
  }, [refreshCompanies, refreshContacts]);

  const refreshLeads = useCallback(async () => {
    try {
      const lds = await crmService.getLeads(true);
      setLeads(lds);
      let newLeads = 0;
      let interestedLeads = 0;
      for (const l of lds) {
        if (l.leadStatus === 'NEW') newLeads++;
        if (l.leadStatus === 'INTERESTED' || l.leadStatus === 'QUOTATION' || l.leadStatus === 'NEGOTIATION') {
          interestedLeads++;
        }
      }
      setStats((prev) => ({ ...prev, newLeads, interestedLeads }));
    } catch (err: any) {
      console.warn('Failed to refresh leads:', err);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const prods = await crmService.getProducts(true);
      setProducts(prods);
    } catch (err: any) {
      console.warn('Failed to refresh products:', err);
    }
  }, []);

  const refreshFollowUps = useCallback(async () => {
    try {
      const fus = await crmService.getFollowUps(true);
      setFollowUps(fus);
      const todayStr = new Date().toISOString().split('T')[0];
      let todayFollowUps = 0;
      let overdueFollowUps = 0;
      for (const f of fus) {
        if (f.status === 'PENDING') {
          if (f.dueDate === todayStr) todayFollowUps++;
          else if (f.dueDate < todayStr) overdueFollowUps++;
        }
      }
      setStats((prev) => ({ ...prev, todayFollowUps, overdueFollowUps }));
    } catch (err: any) {
      console.warn('Failed to refresh follow-ups:', err);
    }
  }, []);

  const refreshCampaigns = useCallback(async () => {
    try {
      const camps = await crmService.getCampaigns(true);
      setCampaigns(camps);
      const activeCampaigns = camps.filter((c) => c.status === 'RUNNING' || c.status === 'SCHEDULED').length;
      setStats((prev) => ({ ...prev, activeCampaigns, recentCampaignsCount: camps.length }));
    } catch (err: any) {
      console.warn('Failed to refresh campaigns:', err);
    }
  }, []);

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
      crmService.clearCache();
      await loadCRMData();
    } catch (err: any) {
      error('Seeding Failed', err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  // Quick action submits with targeted single-collection refresh
  const handleSaveQuickCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.companyName.trim()) return;
    try {
      await crmService.saveCompany(newCompany, currentUser?.uid || 'user', currentUser?.email || undefined);
      success('Company Created', newCompany.companyName);
      setQuickActionModal(null);
      setNewCompany({ companyName: '', country: '', industry: '', website: '' });
      refreshCompanies();
    } catch (err: any) {
      error('Create Failed', err.message);
    }
  };

  const handleSaveQuickContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.firstName.trim() || !newContact.businessEmail.trim()) return;
    const cleanEmail = newContact.businessEmail.trim().toLowerCase();
    const duplicate = contacts.find((c) => c.businessEmail.trim().toLowerCase() === cleanEmail);
    if (duplicate) {
      error('Duplicate Contact Detected', `Contact with email "${cleanEmail}" already exists (${duplicate.firstName} ${duplicate.lastName || ''}).`);
      return;
    }
    try {
      const parentCo = companies.find((c) => c.companyId === newContact.companyId);
      await crmService.saveContact(
        {
          ...newContact,
          businessEmail: cleanEmail,
          companyName: parentCo?.companyName,
          emailStatus: 'VALID',
          contactStatus: 'ACTIVE',
        },
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Contact Created', `${newContact.firstName} (${cleanEmail})`);
      setQuickActionModal(null);
      setNewContact({ firstName: '', lastName: '', businessEmail: '', companyId: '', phone: '' });
      refreshContacts();
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
      refreshLeads();
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
      refreshFollowUps();
    } catch (err: any) {
      error('Create Failed', err.message);
    }
  };

  // Initialization Error screen with Retry option
  if (initError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-6 p-6">
        <div className="flex items-center justify-center">
          <YalixWordmark size="xl" />
        </div>
        <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Initialization Error</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            {initError}
          </p>
          <button
            onClick={retryInitialization}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs tracking-wider uppercase transition-colors shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Active Loading screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-6 p-4">
        <div className="flex items-center justify-center">
          <YalixWordmark size="xl" />
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
      onSelectTab={handleTabChange}
      pendingFollowUpsCount={pendingFollowUps}
      onGlobalSearch={setGlobalSearch}
      onQuickAction={(action) => setQuickActionModal(action)}
      onSeedData={handleSeedData}
      isSeeding={isSeeding}
      companies={companies}
      contacts={contacts}
      leads={leads}
      onSelectCompany={handleSelectCompany}
      onSelectContact={handleSelectContact}
    >
      {/* Tab routing with Suspense for on-demand lazy chunk loading */}
      <Suspense fallback={<LoadingSpinner message="Loading YALIX CRM module..." />}>
        {currentTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            companies={companies}
            contacts={contacts}
            leads={leads}
            followUps={followUps}
            onNavigate={handleTabChange}
            onOpenQuickAction={(action) => setQuickActionModal(action)}
          />
        )}

        {currentTab === 'companies' && (
          <CompaniesView
            companies={companies}
            contacts={contacts}
            onRefresh={refreshCompaniesAndContacts}
            isLoading={dataLoading}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={handleSelectCompany}
            onSelectContact={handleSelectContact}
          />
        )}

        {currentTab === 'contacts' && (
          <ContactsView
            contacts={contacts}
            companies={companies}
            onRefresh={refreshContacts}
            isLoading={dataLoading}
            selectedContactId={selectedContactId}
            onSelectContact={handleSelectContact}
            onSelectCompany={handleSelectCompany}
          />
        )}

        {currentTab === 'leads' && (
          <LeadsView
            leads={leads}
            companies={companies}
            contacts={contacts}
            products={products}
            onRefresh={refreshLeads}
            isLoading={dataLoading}
          />
        )}

        {currentTab === 'products' && (
          <ProductsView
            products={products}
            onRefresh={refreshProducts}
            isLoading={dataLoading}
          />
        )}

        {currentTab === 'followups' && (
          <FollowUpsView
            followUps={followUps}
            companies={companies}
            contacts={contacts}
            leads={leads}
            onRefresh={refreshFollowUps}
            isLoading={dataLoading}
          />
        )}

        {currentTab === 'import' && (
          <ImportWizardView
            companies={companies}
            contacts={contacts}
            products={products}
            onRefresh={loadCRMData}
            onNavigate={setCurrentTab}
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
            onRefresh={refreshCampaigns}
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
            onSelectCompany={handleSelectCompany}
            onSelectContact={handleSelectContact}
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
      </Suspense>

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

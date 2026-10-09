import React, { useState } from 'react';
import {
  Plus,
  Building2,
  Globe,
  MapPin,
  Trash2,
  Edit,
  ExternalLink,
  Eye,
  Users,
} from 'lucide-react';
import { Company, Contact } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';
import { CompanyDetailsView } from './CompanyDetailsView';

interface CompaniesViewProps {
  companies: Company[];
  contacts?: Contact[];
  onRefresh: () => void;
  isLoading: boolean;
  selectedCompanyId?: string | null;
  onSelectCompany?: (companyId: string | null) => void;
  onSelectContact?: (contactId: string) => void;
}

export function CompaniesView({
  companies,
  contacts = [],
  onRefresh,
  isLoading,
  selectedCompanyId,
  onSelectCompany,
  onSelectContact,
}: CompaniesViewProps) {
  const { currentUser, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<Company> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Quick Add Contact modal from company view
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [newContactData, setNewContactData] = useState<{
    firstName: string;
    lastName: string;
    businessEmail: string;
    jobTitle: string;
    phone: string;
    country: string;
  }>({
    firstName: '',
    lastName: '',
    businessEmail: '',
    jobTitle: '',
    phone: '',
    country: '',
  });

  // Filter state
  const [countryFilter, setCountryFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Extract unique filters
  const countries = Array.from(new Set(companies.map((c) => c.country).filter(Boolean))) as string[];
  const industries = Array.from(new Set(companies.map((c) => c.industry).filter(Boolean))) as string[];
  const statuses = Array.from(new Set(companies.map((c) => c.status).filter(Boolean))) as string[];

  const filteredCompanies = companies.filter((c) => {
    if (countryFilter && c.country !== countryFilter) return false;
    if (industryFilter && c.industry !== industryFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  // Check if viewing details of a specific company
  const activeCompany = selectedCompanyId
    ? companies.find((c) => c.companyId === selectedCompanyId)
    : null;

  const handleOpenAdd = () => {
    setEditingCompany({
      companyName: '',
      website: '',
      country: '',
      state: '',
      city: '',
      address: '',
      industry: '',
      companySize: '',
      revenue: '',
      linkedinUrl: '',
      source: '',
      sourceDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE_PROSPECT',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (comp: Company) => {
    setEditingCompany({ ...comp });
    setIsModalOpen(true);
  };

  const handleDelete = async (comp: Company) => {
    if (!confirm(`Are you sure you want to delete ${comp.companyName}? This action cannot be undone.`)) return;
    try {
      await crmService.deleteCompany(comp.companyId, currentUser?.uid || 'admin', currentUser?.email || undefined);
      success('Company Deleted', `${comp.companyName} was removed from the database.`);
      if (selectedCompanyId === comp.companyId && onSelectCompany) {
        onSelectCompany(null);
      }
      onRefresh();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany?.companyName?.trim()) {
      error('Validation Error', 'Company Name is required.');
      return;
    }

    const trimmedName = editingCompany.companyName.trim();

    // Prevent accidental duplicate company name check
    const isNew = !editingCompany.companyId;
    if (isNew) {
      const duplicate = companies.find(
        (c) => c.companyName.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        if (!confirm(`A company with the name "${trimmedName}" already exists. Do you still want to create another record?`)) {
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      await crmService.saveCompany(
        {
          ...editingCompany,
          companyName: trimmedName,
        } as any,
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Company Saved', `${trimmedName} has been recorded.`);
      setIsModalOpen(false);
      setEditingCompany(null);
      onRefresh();
    } catch (err: any) {
      error('Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle adding contact directly to active company
  const handleSaveContactToCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;
    if (!newContactData.firstName.trim() || !newContactData.businessEmail.trim()) {
      error('Validation Error', 'First Name and Business Email are required.');
      return;
    }

    const emailLower = newContactData.businessEmail.trim().toLowerCase();

    // Prevent duplicate contacts
    const duplicate = contacts.find((c) => c.businessEmail.trim().toLowerCase() === emailLower);
    if (duplicate) {
      error(
        'Duplicate Contact Detected',
        `A contact with email "${emailLower}" already exists (${duplicate.firstName} ${duplicate.lastName || ''}).`
      );
      return;
    }

    setIsSaving(true);
    try {
      await crmService.saveContact(
        {
          firstName: newContactData.firstName.trim(),
          lastName: newContactData.lastName.trim(),
          businessEmail: emailLower,
          jobTitle: newContactData.jobTitle.trim(),
          phone: newContactData.phone.trim(),
          country: newContactData.country.trim() || activeCompany.country,
          companyId: activeCompany.companyId,
          companyName: activeCompany.companyName,
          emailStatus: 'VALID',
          contactStatus: 'ACTIVE',
        },
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Contact Added', `${newContactData.firstName} linked to ${activeCompany.companyName}`);
      setIsAddContactModalOpen(false);
      setNewContactData({
        firstName: '',
        lastName: '',
        businessEmail: '',
        jobTitle: '',
        phone: '',
        country: '',
      });
      onRefresh();
    } catch (err: any) {
      error('Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // If a specific company is selected, render Company Details View
  if (activeCompany) {
    const relatedContacts = contacts.filter((c) => c.companyId === activeCompany.companyId);
    return (
      <>
        <CompanyDetailsView
          company={activeCompany}
          relatedContacts={relatedContacts}
          onBack={() => onSelectCompany && onSelectCompany(null)}
          onEdit={() => handleOpenEdit(activeCompany)}
          onDelete={() => handleDelete(activeCompany)}
          onSelectContact={(contactId) => onSelectContact && onSelectContact(contactId)}
          onAddContact={() => {
            setNewContactData({
              firstName: '',
              lastName: '',
              businessEmail: '',
              jobTitle: '',
              phone: '',
              country: activeCompany.country || '',
            });
            setIsAddContactModalOpen(true);
          }}
        />

        {/* Edit Company Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Edit Company Record"
          description="Maintain authorized company profile, location, and industry."
          maxWidth="2xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                form="company-edit-form"
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Update Company'}
              </button>
            </>
          }
        >
          <form id="company-edit-form" onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingCompany?.companyName || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, companyName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Website / Domain</label>
                <input
                  type="text"
                  value={editingCompany?.website || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, website: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  value={editingCompany?.industry || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, industry: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={editingCompany?.status || 'ACTIVE_PROSPECT'}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, status: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                >
                  <option value="ACTIVE_PROSPECT">Active Prospect</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="PARTNER">Partner</option>
                  <option value="CHURNED">Churned</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={editingCompany?.country || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, country: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={editingCompany?.city || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, city: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State / Region</label>
                <input
                  type="text"
                  value={editingCompany?.state || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, state: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Size</label>
                <input
                  type="text"
                  value={editingCompany?.companySize || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, companySize: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Revenue</label>
                <input
                  type="text"
                  value={editingCompany?.revenue || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, revenue: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={editingCompany?.notes || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* Add Contact directly to company */}
        <Modal
          isOpen={isAddContactModalOpen}
          onClose={() => setIsAddContactModalOpen(false)}
          title={`Add Decision Maker to ${activeCompany.companyName}`}
          description="Create a new contact directly linked to this authorized organization."
          maxWidth="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsAddContactModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                form="direct-contact-form"
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Linking...' : 'Add Contact'}
              </button>
            </>
          }
        >
          <form id="direct-contact-form" onSubmit={handleSaveContactToCompany} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={newContactData.firstName}
                  onChange={(e) => setNewContactData({ ...newContactData, firstName: e.target.value })}
                  placeholder="e.g. Klaus"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={newContactData.lastName}
                  onChange={(e) => setNewContactData({ ...newContactData, lastName: e.target.value })}
                  placeholder="e.g. Weber"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Email <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="email"
                value={newContactData.businessEmail}
                onChange={(e) => setNewContactData({ ...newContactData, businessEmail: e.target.value })}
                placeholder="klaus.weber@company.de"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={newContactData.jobTitle}
                  onChange={(e) => setNewContactData({ ...newContactData, jobTitle: e.target.value })}
                  placeholder="e.g. Head of Procurement"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={newContactData.phone}
                  onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })}
                  placeholder="+49 89 123456"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </form>
        </Modal>
      </>
    );
  }

  // Columns for the Companies listing table
  const columns: Column<Company>[] = [
    {
      key: 'companyName',
      label: 'Company Name',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <button
            onClick={() => onSelectCompany && onSelectCompany(item.companyId)}
            className="font-semibold text-slate-900 hover:text-emerald-700 text-left flex items-center gap-1.5 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{item.companyName}</span>
          </button>
          {item.website && (
            <a
              href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
            >
              <Globe className="w-3 h-3 text-emerald-500" />
              <span>{item.website.replace(/^https?:\/\//, '')}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'country',
      label: 'Location',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1 text-slate-600 text-xs">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{[item.city, item.state, item.country].filter(Boolean).join(', ') || '—'}</span>
        </div>
      ),
    },
    {
      key: 'industry',
      label: 'Industry',
      sortable: true,
      render: (item) => (
        <span className="text-xs text-slate-700 font-medium">
          {item.industry || '—'}
        </span>
      ),
    },
    {
      key: 'companySize',
      label: 'Size / Rev',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col text-xs text-slate-600">
          <span>{item.companySize ? `${item.companySize}` : '—'}</span>
          {item.revenue && <span className="text-[11px] text-slate-400">{item.revenue}</span>}
        </div>
      ),
    },
    {
      key: 'contactsCount',
      label: 'Contacts',
      sortable: false,
      render: (item) => {
        const count = contacts.filter((c) => c.companyId === item.companyId).length;
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            <Users className="w-3 h-3 text-slate-400" />
            {count}
          </span>
        );
      },
    },
    {
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (item) => (
        <Badge variant="slate">{item.source || 'Direct'}</Badge>
      ),
    },
    {
      key: 'sourceDate',
      label: 'Source Date',
      sortable: true,
      render: (item) => (
        <span className="text-[11px] text-slate-500 font-mono">
          {item.sourceDate || (item.createdAt ? item.createdAt.split('T')[0] : '—')}
        </span>
      ),
    },
    {
      key: 'companyId',
      label: 'Company ID',
      sortable: true,
      render: (item) => (
        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[90px] block" title={item.companyId}>
          {item.companyId}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item) => (
        <Badge variant={item.status === 'ACTIVE_PROSPECT' ? 'success' : 'default'}>
          {item.status || 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onSelectCompany && onSelectCompany(item.companyId)}
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="View company details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleOpenEdit(item)}
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Edit company"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => handleDelete(item)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete company"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top action & filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500">Filter By:</span>
          {countries.length > 0 && (
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
            >
              <option value="">All Countries ({countries.length})</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {industries.length > 0 && (
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
            >
              <option value="">All Industries ({industries.length})</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          )}
          {statuses.length > 0 && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
            >
              <option value="">All Statuses ({statuses.length})</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {(countryFilter || industryFilter || statusFilter) && (
            <button
              onClick={() => {
                setCountryFilter('');
                setIndustryFilter('');
                setStatusFilter('');
              }}
              className="text-xs text-rose-600 hover:underline px-2 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ Add Company</span>
        </button>
      </div>

      {/* Reusable Data Table with Sorting, Pagination, and Search */}
      <DataTable
        data={filteredCompanies}
        columns={columns}
        keyField="companyId"
        searchFields={['companyName', 'website', 'country', 'city', 'state', 'industry', 'notes', 'status']}
        searchPlaceholder="Search by company name, website, country, industry, notes..."
        exportFilename="yalix_companies"
        isLoading={isLoading}
        emptyMessage="No company records in YALIX database yet."
      />

      {/* Add / Edit Company Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCompany?.companyId ? 'Edit Company Record' : 'Add New B2B Company'}
        description="Maintain authorized company profiles, verified location, industry, and notes."
        maxWidth="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              form="company-form"
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Saving to Firestore...' : 'Save Company'}
            </button>
          </>
        }
      >
        <form id="company-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingCompany?.companyName || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, companyName: e.target.value })
                }
                placeholder="e.g. NutraNordic Bioactives AB"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website / Domain</label>
              <input
                type="text"
                value={editingCompany?.website || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, website: e.target.value })
                }
                placeholder="e.g. nutranordic.com"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <input
                type="text"
                value={editingCompany?.industry || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, industry: e.target.value })
                }
                placeholder="e.g. Nutraceuticals, Botanicals, Health"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={editingCompany?.status || 'ACTIVE_PROSPECT'}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, status: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="ACTIVE_PROSPECT">Active Prospect</option>
                <option value="CUSTOMER">Customer</option>
                <option value="PARTNER">Partner</option>
                <option value="CHURNED">Churned</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={editingCompany?.country || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, country: e.target.value })
                }
                placeholder="e.g. Germany, Sweden, United States"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={editingCompany?.city || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, city: e.target.value })
                }
                placeholder="e.g. Munich"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State / Province</label>
              <input
                type="text"
                value={editingCompany?.state || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, state: e.target.value })
                }
                placeholder="e.g. Bavaria"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Size</label>
              <input
                type="text"
                value={editingCompany?.companySize || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, companySize: e.target.value })
                }
                placeholder="e.g. 50-200 employees"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Annual Revenue</label>
              <input
                type="text"
                value={editingCompany?.revenue || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, revenue: e.target.value })
                }
                placeholder="e.g. $10M - $25M"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Source</label>
              <input
                type="text"
                value={editingCompany?.source || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, source: e.target.value })
                }
                placeholder="e.g. BioFach 2026, Directory, Web"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source Date</label>
              <input
                type="date"
                value={editingCompany?.sourceDate || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, sourceDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn Profile</label>
              <input
                type="text"
                value={editingCompany?.linkedinUrl || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, linkedinUrl: e.target.value })
                }
                placeholder="https://linkedin.com/company/..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                value={editingCompany?.address || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, address: e.target.value })
                }
                placeholder="Street address, building, suite"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal CRM Notes & Specifications
              </label>
              <textarea
                rows={3}
                value={editingCompany?.notes || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, notes: e.target.value })
                }
                placeholder="Procurement requirements, product demands, certificate criteria..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

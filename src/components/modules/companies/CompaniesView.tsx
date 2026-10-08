import React, { useState } from 'react';
import { Plus, Building2, Globe, MapPin, Trash2, Edit, ExternalLink, Calendar } from 'lucide-react';
import { Company } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';

interface CompaniesViewProps {
  companies: Company[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function CompaniesView({ companies, onRefresh, isLoading }: CompaniesViewProps) {
  const { currentUser, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<Company> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter state
  const [countryFilter, setCountryFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');

  // Extract unique countries and industries
  const countries = Array.from(new Set(companies.map((c) => c.country).filter(Boolean))) as string[];
  const industries = Array.from(new Set(companies.map((c) => c.industry).filter(Boolean))) as string[];

  const filteredCompanies = companies.filter((c) => {
    if (countryFilter && c.country !== countryFilter) return false;
    if (industryFilter && c.industry !== industryFilter) return false;
    return true;
  });

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
    if (!confirm(`Are you sure you want to delete ${comp.companyName}?`)) return;
    try {
      await crmService.deleteCompany(comp.companyId, currentUser?.uid || 'admin', currentUser?.email || undefined);
      success('Company Deleted', `${comp.companyName} was removed from the database.`);
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

    setIsSaving(true);
    try {
      await crmService.saveCompany(
        {
          ...editingCompany,
          companyName: editingCompany.companyName.trim(),
        } as any,
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Company Saved', `${editingCompany.companyName} has been recorded.`);
      setIsModalOpen(false);
      setEditingCompany(null);
      onRefresh();
    } catch (err: any) {
      error('Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const columns: Column<Company>[] = [
    {
      key: 'companyName',
      label: 'Company Name',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {item.companyName}
          </span>
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
          <span>{item.companySize ? `${item.companySize} emp` : '—'}</span>
          {item.revenue && <span className="text-[11px] text-slate-400">{item.revenue}</span>}
        </div>
      ),
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
          {(countryFilter || industryFilter) && (
            <button
              onClick={() => {
                setCountryFilter('');
                setIndustryFilter('');
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

      {/* Reusable Data Table */}
      <DataTable
        data={filteredCompanies}
        columns={columns}
        keyField="companyId"
        searchFields={['companyName', 'website', 'country', 'city', 'industry', 'notes']}
        searchPlaceholder="Search by company name, country, industry, notes..."
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
              <input
                type="text"
                value={editingCompany?.website || ''}
                onChange={(e) =>
                  setEditingCompany({ ...editingCompany, website: e.target.value })
                }
                placeholder="e.g. https://company.com"
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
                placeholder="e.g. Nutraceuticals, Food Ingredients, Minerals"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn URL</label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
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

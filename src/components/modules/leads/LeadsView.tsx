import React, { useState } from 'react';
import {
  Plus,
  Target,
  LayoutGrid,
  List,
  Calendar,
  Building2,
  Trash2,
  Edit,
  ArrowRight,
  User,
  Clock,
} from 'lucide-react';
import { Lead, Company, Contact, Product, LeadStatus, Priority } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';

const ALL_STATUSES: LeadStatus[] = [
  'NEW',
  'RESEARCHED',
  'CONTACTED',
  'REPLIED',
  'INTERESTED',
  'QUOTATION',
  'NEGOTIATION',
  'WON',
  'LOST',
  'NOT_INTERESTED',
];

interface LeadsViewProps {
  leads: Lead[];
  companies: Company[];
  contacts: Contact[];
  products: Product[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function LeadsView({
  leads,
  companies,
  contacts,
  products,
  onRefresh,
  isLoading,
}: LeadsViewProps) {
  const { currentUser, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead>>({
    leadStatus: 'NEW',
    priority: 'MEDIUM',
    productInterest: '',
    leadSource: '',
    assignedTo: 'YALIX Sales Team',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const filteredLeads = leads.filter((l) => {
    if (statusFilter && l.leadStatus !== statusFilter) return false;
    if (priorityFilter && l.priority !== priorityFilter) return false;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingLead({
      leadStatus: 'NEW',
      priority: 'MEDIUM',
      companyId: companies[0]?.companyId || '',
      contactId: contacts[0]?.contactId || '',
      productInterest: products[0]?.name || '',
      leadSource: 'B2B Inquiry',
      assignedTo: 'YALIX Team',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditingLead({ ...lead });
    setIsModalOpen(true);
  };

  const handleDelete = async (lead: Lead) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await crmService.deleteLead(lead.leadId, currentUser?.uid || 'admin', currentUser?.email || undefined);
      success('Lead Deleted', 'Record was removed.');
      onRefresh();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const handleQuickStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
    try {
      await crmService.saveLead(
        {
          ...lead,
          leadStatus: newStatus,
        },
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Status Updated', `Lead moved to ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      error('Status Update Failed', err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead.leadStatus || !editingLead.priority) {
      error('Validation Error', 'Lead Status and Priority are required.');
      return;
    }

    const linkedCompany = companies.find((c) => c.companyId === editingLead.companyId);
    const linkedContact = contacts.find((c) => c.contactId === editingLead.contactId);

    setIsSaving(true);
    try {
      await crmService.saveLead(
        {
          ...editingLead,
          leadStatus: editingLead.leadStatus,
          priority: editingLead.priority,
          companyName: linkedCompany ? linkedCompany.companyName : editingLead.companyName,
          contactName: linkedContact ? `${linkedContact.firstName} ${linkedContact.lastName || ''}`.trim() : editingLead.contactName,
          contactEmail: linkedContact ? linkedContact.businessEmail : editingLead.contactEmail,
        } as any,
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Lead Saved', 'Pipeline record updated successfully.');
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      error('Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const priorityBadge = (p: Priority) => {
    switch (p) {
      case 'URGENT':
        return <Badge variant="danger">URGENT</Badge>;
      case 'HIGH':
        return <Badge variant="warning">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="info">MEDIUM</Badge>;
      case 'LOW':
        return <Badge variant="slate">LOW</Badge>;
    }
  };

  const columns: Column<Lead>[] = [
    {
      key: 'organization',
      label: 'Prospect & Contact',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {item.companyName || 'Unknown Company'}
          </span>
          {item.contactName && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-slate-400" />
              <span>{item.contactName}</span>
              {item.contactEmail && <span className="text-slate-400">({item.contactEmail})</span>}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'productInterest',
      label: 'Product Interest',
      sortable: true,
      render: (item) => (
        <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          {item.productInterest || 'General Inquiry'}
        </span>
      ),
    },
    {
      key: 'leadStatus',
      label: 'Pipeline Stage',
      sortable: true,
      render: (item) => (
        <select
          value={item.leadStatus}
          onChange={(e) => handleQuickStatusChange(item, e.target.value as LeadStatus)}
          className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (item) => priorityBadge(item.priority),
    },
    {
      key: 'nextFollowUpAt',
      label: 'Next Follow-up',
      sortable: true,
      render: (item) => (
        <span className="text-xs text-slate-600 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          <span>{item.nextFollowUpAt || '—'}</span>
        </span>
      ),
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      sortable: true,
      render: (item) => (
        <span className="text-xs text-slate-600">{item.assignedTo || 'Unassigned'}</span>
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
            title="Edit lead"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => handleDelete(item)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete lead"
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
      {/* View Switcher & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle View mode */}
          <div className="flex items-center p-0.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 mr-2">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                viewMode === 'pipeline'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Pipeline Stages</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
          </div>

          <span className="text-xs font-semibold text-slate-500 hidden md:inline">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="">All Stages</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">URGENT</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          {(statusFilter || priorityFilter) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setPriorityFilter('');
              }}
              className="text-xs text-rose-600 hover:underline px-2 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ Add Lead</span>
        </button>
      </div>

      {/* Main View: Pipeline Kanban or Table */}
      {viewMode === 'table' ? (
        <DataTable
          data={filteredLeads}
          columns={columns}
          keyField="leadId"
          searchFields={['companyName', 'contactName', 'contactEmail', 'productInterest', 'notes']}
          searchPlaceholder="Search leads by company, contact, product, notes..."
          exportFilename="yalix_leads"
          isLoading={isLoading}
          emptyMessage="No leads in the pipeline yet."
        />
      ) : (
        /* 10-Stage Pipeline Board */
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-[1700px]">
            {ALL_STATUSES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.leadStatus === stage);
              return (
                <div
                  key={stage}
                  className="w-56 bg-slate-100/80 rounded-xl p-3 border border-slate-200/80 flex flex-col shrink-0 min-h-[500px]"
                >
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-800 tracking-tight">
                      {stage}
                    </span>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2.5 overflow-y-auto">
                    {stageLeads.length === 0 ? (
                      <div className="h-24 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                        No leads
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
                              {lead.companyName || 'Unassigned Co.'}
                            </h4>
                            {priorityBadge(lead.priority)}
                          </div>

                          {lead.contactName && (
                            <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{lead.contactName}</span>
                            </p>
                          )}

                          {lead.productInterest && (
                            <div className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mb-2">
                              📦 {lead.productInterest}
                            </div>
                          )}

                          {lead.notes && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 italic mb-2">
                              "{lead.notes}"
                            </p>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                              {lead.nextFollowUpAt ? `Due: ${lead.nextFollowUpAt}` : 'No date'}
                            </span>
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                              <button
                                onClick={() => handleOpenEdit(lead)}
                                className="p-1 hover:text-emerald-700"
                                title="Edit"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Lead Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLead.leadId ? 'Edit Lead' : 'Create Sales Pipeline Lead'}
        description="Track product interest, deal progression, assigned rep, and follow-ups."
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
              form="lead-form"
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Lead'}
            </button>
          </>
        }
      >
        <form id="lead-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Prospect
              </label>
              <select
                value={editingLead.companyId || ''}
                onChange={(e) => setEditingLead({ ...editingLead, companyId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Contact
              </label>
              <select
                value={editingLead.contactId || ''}
                onChange={(e) => setEditingLead({ ...editingLead, contactId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="">Select Contact</option>
                {contacts.map((cnt) => (
                  <option key={cnt.contactId} value={cnt.contactId}>
                    {cnt.firstName} {cnt.lastName || ''} ({cnt.businessEmail})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Interest
              </label>
              <select
                value={editingLead.productInterest || ''}
                onChange={(e) =>
                  setEditingLead({ ...editingLead, productInterest: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="">Select YALIX Product</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Source</label>
              <input
                type="text"
                value={editingLead.leadSource || ''}
                onChange={(e) => setEditingLead({ ...editingLead, leadSource: e.target.value })}
                placeholder="e.g. BioFach 2026, Web Inquiry, Referral"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pipeline Stage <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={editingLead.leadStatus || 'NEW'}
                onChange={(e) =>
                  setEditingLead({ ...editingLead, leadStatus: e.target.value as LeadStatus })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
              >
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={editingLead.priority || 'MEDIUM'}
                onChange={(e) =>
                  setEditingLead({ ...editingLead, priority: e.target.value as Priority })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="URGENT">URGENT</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-Up Date</label>
              <input
                type="date"
                value={editingLead.nextFollowUpAt || ''}
                onChange={(e) =>
                  setEditingLead({ ...editingLead, nextFollowUpAt: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Rep</label>
              <input
                type="text"
                value={editingLead.assignedTo || ''}
                onChange={(e) => setEditingLead({ ...editingLead, assignedTo: e.target.value })}
                placeholder="YALIX Sales Team"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lead Notes & Deal Discussion
              </label>
              <textarea
                rows={3}
                value={editingLead.notes || ''}
                onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                placeholder="Volume required, price target, samples required, specification nuances..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

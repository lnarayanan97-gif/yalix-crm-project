import React, { useState } from 'react';
import { Plus, Mail, Phone, Building2, Trash2, Edit, ExternalLink, Linkedin } from 'lucide-react';
import { Contact, Company, EmailStatus, ContactStatus } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';

interface ContactsViewProps {
  contacts: Contact[];
  companies: Company[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function ContactsView({ contacts, companies, onRefresh, isLoading }: ContactsViewProps) {
  const { currentUser, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [emailStatusFilter, setEmailStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  const filteredContacts = contacts.filter((c) => {
    if (emailStatusFilter && c.emailStatus !== emailStatusFilter) return false;
    if (companyFilter && c.companyId !== companyFilter) return false;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingContact({
      firstName: '',
      lastName: '',
      jobTitle: '',
      department: '',
      businessEmail: '',
      secondaryEmail: '',
      phone: '',
      mobile: '',
      linkedinUrl: '',
      country: '',
      companyId: companies[0]?.companyId || '',
      emailStatus: 'VALID',
      contactStatus: 'ACTIVE',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cnt: Contact) => {
    setEditingContact({ ...cnt });
    setIsModalOpen(true);
  };

  const handleDelete = async (cnt: Contact) => {
    if (!confirm(`Are you sure you want to delete ${cnt.firstName} ${cnt.lastName || ''}?`)) return;
    try {
      await crmService.deleteContact(cnt.contactId, currentUser?.uid || 'admin', currentUser?.email || undefined);
      success('Contact Deleted', `${cnt.firstName} was removed.`);
      onRefresh();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact?.firstName?.trim() || !editingContact?.businessEmail?.trim()) {
      error('Validation Error', 'First name and Business email are required.');
      return;
    }

    const selectedCompany = companies.find((c) => c.companyId === editingContact.companyId);

    setIsSaving(true);
    try {
      await crmService.saveContact(
        {
          ...editingContact,
          firstName: editingContact.firstName.trim(),
          lastName: editingContact.lastName?.trim(),
          businessEmail: editingContact.businessEmail.trim().toLowerCase(),
          companyName: selectedCompany ? selectedCompany.companyName : editingContact.companyName,
        } as any,
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Contact Saved', `${editingContact.firstName} has been recorded.`);
      setIsModalOpen(false);
      setEditingContact(null);
      onRefresh();
    } catch (err: any) {
      error('Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const emailBadgeVariant = (status: EmailStatus) => {
    switch (status) {
      case 'VALID':
        return 'success';
      case 'BOUNCED':
      case 'INVALID':
        return 'danger';
      case 'RISKY':
        return 'warning';
      default:
        return 'default';
    }
  };

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      label: 'Contact Name',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">
            {item.firstName} {item.lastName || ''}
          </span>
          {item.jobTitle && (
            <span className="text-[11px] text-slate-500">
              {item.jobTitle} {item.department ? `(${item.department})` : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'companyName',
      label: 'Organization',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-medium truncate max-w-[150px]">
            {item.companyName || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'businessEmail',
      label: 'Email & Status',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col gap-1 items-start">
          <a
            href={`mailto:${item.businessEmail}`}
            className="text-xs text-emerald-700 hover:underline font-mono flex items-center gap-1"
          >
            <Mail className="w-3 h-3 text-slate-400" />
            <span>{item.businessEmail}</span>
          </a>
          <Badge variant={emailBadgeVariant(item.emailStatus)}>
            {item.emailStatus}
          </Badge>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone / Country',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col text-xs text-slate-600">
          {item.phone || item.mobile ? (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{item.phone || item.mobile}</span>
            </span>
          ) : (
            <span>—</span>
          )}
          {item.country && <span className="text-[11px] text-slate-400">{item.country}</span>}
        </div>
      ),
    },
    {
      key: 'contactStatus',
      label: 'Status',
      sortable: true,
      render: (item) => (
        <Badge variant={item.contactStatus === 'ACTIVE' ? 'success' : 'default'}>
          {item.contactStatus}
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
          {item.linkedinUrl && (
            <a
              href={item.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="LinkedIn Profile"
            >
              <Linkedin className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => handleOpenEdit(item)}
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Edit contact"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => handleDelete(item)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete contact"
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
      {/* Action and Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500">Filter By:</span>
          <select
            value={emailStatusFilter}
            onChange={(e) => setEmailStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="">All Email Statuses</option>
            <option value="VALID">VALID</option>
            <option value="RISKY">RISKY</option>
            <option value="UNVERIFIED">UNVERIFIED</option>
            <option value="BOUNCED">BOUNCED</option>
          </select>

          {companies.length > 0 && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600 max-w-[200px] truncate"
            >
              <option value="">All Companies ({companies.length})</option>
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.companyName}
                </option>
              ))}
            </select>
          )}

          {(emailStatusFilter || companyFilter) && (
            <button
              onClick={() => {
                setEmailStatusFilter('');
                setCompanyFilter('');
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
          <span>+ Add Contact</span>
        </button>
      </div>

      <DataTable
        data={filteredContacts}
        columns={columns}
        keyField="contactId"
        searchFields={['firstName', 'lastName', 'businessEmail', 'companyName', 'jobTitle', 'country']}
        searchPlaceholder="Search by name, email, company, job title..."
        exportFilename="yalix_contacts"
        isLoading={isLoading}
        emptyMessage="No contacts recorded in YALIX database yet."
      />

      {/* Add / Edit Contact Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingContact?.contactId ? 'Edit Contact' : 'Add New B2B Contact'}
        description="Ensure email addresses are valid business emails for compliant campaigns."
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
              form="contact-form"
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Contact'}
            </button>
          </>
        }
      >
        <form id="contact-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingContact?.firstName || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, firstName: e.target.value })
                }
                placeholder="e.g. Elena"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
              <input
                type="text"
                value={editingContact?.lastName || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, lastName: e.target.value })
                }
                placeholder="e.g. Lindqvist"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={editingContact?.businessEmail || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, businessEmail: e.target.value })
                }
                placeholder="e.g. elena@company.com"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Organization
              </label>
              <select
                value={editingContact?.companyId || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, companyId: e.target.value })
                }
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
              <input
                type="text"
                value={editingContact?.jobTitle || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, jobTitle: e.target.value })
                }
                placeholder="e.g. Head of Procurement"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={editingContact?.department || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, department: e.target.value })
                }
                placeholder="e.g. Sourcing, Quality Control"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Direct Phone</label>
              <input
                type="text"
                value={editingContact?.phone || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, phone: e.target.value })
                }
                placeholder="+46 8 123 4567"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={editingContact?.country || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, country: e.target.value })
                }
                placeholder="e.g. Sweden"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Status</label>
              <select
                value={editingContact?.emailStatus || 'VALID'}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, emailStatus: e.target.value as EmailStatus })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="VALID">VALID (Verified)</option>
                <option value="UNVERIFIED">UNVERIFIED</option>
                <option value="RISKY">RISKY</option>
                <option value="INVALID">INVALID</option>
                <option value="BOUNCED">BOUNCED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Status</label>
              <select
                value={editingContact?.contactStatus || 'ACTIVE'}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, contactStatus: e.target.value as ContactStatus })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="UNSUBSCRIBED">UNSUBSCRIBED (Suppressed)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn Profile</label>
              <input
                type="text"
                value={editingContact?.linkedinUrl || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, linkedinUrl: e.target.value })
                }
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={editingContact?.notes || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, notes: e.target.value })
                }
                placeholder="Specific discussions, preferred communication times..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

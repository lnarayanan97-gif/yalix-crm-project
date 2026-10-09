import React, { useState } from 'react';
import {
  Plus,
  Mail,
  Phone,
  Building2,
  Trash2,
  Edit,
  ExternalLink,
  Linkedin,
  Eye,
  Filter,
} from 'lucide-react';
import { Contact, Company, EmailStatus, ContactStatus } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';
import { ContactDetailsView } from './ContactDetailsView';

interface ContactsViewProps {
  contacts: Contact[];
  companies: Company[];
  onRefresh: () => void;
  isLoading: boolean;
  selectedContactId?: string | null;
  onSelectContact?: (contactId: string | null) => void;
  onSelectCompany?: (companyId: string) => void;
}

export function ContactsView({
  contacts,
  companies,
  onRefresh,
  isLoading,
  selectedContactId,
  onSelectContact,
  onSelectCompany,
}: ContactsViewProps) {
  const { currentUser, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [countryFilter, setCountryFilter] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('');
  const [contactStatusFilter, setContactStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  // Extract unique filter lists
  const countries = Array.from(new Set(contacts.map((c) => c.country).filter(Boolean))) as string[];
  const sources = Array.from(new Set(contacts.map((c) => c.source).filter(Boolean))) as string[];

  const filteredContacts = contacts.filter((c) => {
    if (countryFilter && c.country !== countryFilter) return false;
    if (emailStatusFilter && c.emailStatus !== emailStatusFilter) return false;
    if (contactStatusFilter && c.contactStatus !== contactStatusFilter) return false;
    if (sourceFilter && c.source !== sourceFilter) return false;
    if (companyFilter && c.companyId !== companyFilter) return false;
    return true;
  });

  // Active contact for details view
  const activeContact = selectedContactId
    ? contacts.find((c) => c.contactId === selectedContactId)
    : null;

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
      source: 'Direct Entry',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cnt: Contact) => {
    setEditingContact({ ...cnt });
    setIsModalOpen(true);
  };

  const handleDelete = async (cnt: Contact) => {
    if (!confirm(`Are you sure you want to delete ${cnt.firstName} ${cnt.lastName || ''}? This action cannot be undone.`)) {
      return;
    }
    try {
      await crmService.deleteContact(cnt.contactId, currentUser?.uid || 'admin', currentUser?.email || undefined);
      success('Contact Deleted', `${cnt.firstName} was removed.`);
      if (selectedContactId === cnt.contactId && onSelectContact) {
        onSelectContact(null);
      }
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

    const cleanFirstName = editingContact.firstName.trim();
    const cleanLastName = editingContact.lastName?.trim() || '';
    const cleanEmail = editingContact.businessEmail.trim().toLowerCase();

    // Accidental duplicate contact check
    const duplicate = contacts.find(
      (c) =>
        c.businessEmail.trim().toLowerCase() === cleanEmail &&
        c.contactId !== editingContact.contactId
    );
    if (duplicate) {
      error(
        'Duplicate Contact Detected',
        `A contact with email "${cleanEmail}" already exists (${duplicate.firstName} ${duplicate.lastName || ''} at ${duplicate.companyName || 'unassigned organization'}).`
      );
      return;
    }

    // Resolve company name from selected companyId
    const selectedCompany = companies.find((c) => c.companyId === editingContact.companyId);

    setIsSaving(true);
    try {
      await crmService.saveContact(
        {
          ...editingContact,
          firstName: cleanFirstName,
          lastName: cleanLastName,
          businessEmail: cleanEmail,
          companyId: editingContact.companyId || undefined,
          companyName: selectedCompany ? selectedCompany.companyName : editingContact.companyName,
          emailStatus: editingContact.emailStatus || 'VALID',
          contactStatus: editingContact.contactStatus || 'ACTIVE',
        } as any,
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Contact Saved', `${cleanFirstName} (${cleanEmail}) has been recorded.`);
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

  // If a specific contact is selected, render Contact Details View
  if (activeContact) {
    const linkedCompany = companies.find((c) => c.companyId === activeContact.companyId);
    return (
      <>
        <ContactDetailsView
          contact={activeContact}
          company={linkedCompany}
          onBack={() => onSelectContact && onSelectContact(null)}
          onEdit={() => handleOpenEdit(activeContact)}
          onDelete={() => handleDelete(activeContact)}
          onSelectCompany={(companyId) => onSelectCompany && onSelectCompany(companyId)}
        />

        {/* Edit Contact Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Edit Contact Record"
          description="Update verified decision maker details, email validity, and linked organization."
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
                form="contact-edit-form"
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Update Contact'}
              </button>
            </>
          }
        >
          <form id="contact-edit-form" onSubmit={handleSave} className="space-y-4">
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Secondary Email
                </label>
                <input
                  type="email"
                  value={editingContact?.secondaryEmail || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, secondaryEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Linked B2B Organization
                </label>
                <select
                  value={editingContact?.companyId || ''}
                  onChange={(e) => {
                    const chosenComp = companies.find((c) => c.companyId === e.target.value);
                    setEditingContact({
                      ...editingContact,
                      companyId: e.target.value,
                      companyName: chosenComp?.companyName || '',
                    });
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                >
                  <option value="">— Unassigned (No Organization) —</option>
                  {companies.map((comp) => (
                    <option key={comp.companyId} value={comp.companyId}>
                      {comp.companyName} {comp.country ? `(${comp.country})` : ''}
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editingContact?.phone || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile</label>
                <input
                  type="text"
                  value={editingContact?.mobile || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, mobile: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Status</label>
                <select
                  value={editingContact?.emailStatus || 'VALID'}
                  onChange={(e) =>
                    setEditingContact({
                      ...editingContact,
                      emailStatus: e.target.value as EmailStatus,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                >
                  <option value="VALID">VALID (Verified)</option>
                  <option value="UNVERIFIED">UNVERIFIED</option>
                  <option value="RISKY">RISKY (Catch-all)</option>
                  <option value="INVALID">INVALID</option>
                  <option value="BOUNCED">BOUNCED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Status</label>
                <select
                  value={editingContact?.contactStatus || 'ACTIVE'}
                  onChange={(e) =>
                    setEditingContact({
                      ...editingContact,
                      contactStatus: e.target.value as ContactStatus,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={editingContact?.notes || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </form>
        </Modal>
      </>
    );
  }

  // Columns for Contacts listing table
  const columns: Column<Contact>[] = [
    {
      key: 'name',
      label: 'Contact Name',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <button
            onClick={() => onSelectContact && onSelectContact(item.contactId)}
            className="font-semibold text-slate-900 hover:text-emerald-700 text-left transition-colors"
          >
            {item.firstName} {item.lastName || ''}
          </button>
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
          {item.companyId && onSelectCompany ? (
            <button
              onClick={() => onSelectCompany(item.companyId!)}
              className="font-medium text-slate-800 hover:text-emerald-700 hover:underline truncate max-w-[150px] text-left"
              title="View company profile"
            >
              {item.companyName || 'View Company'}
            </button>
          ) : (
            <span className="font-medium truncate max-w-[150px]">
              {item.companyName || '—'}
            </span>
          )}
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
        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[80px] block" title={item.companyId}>
          {item.companyId || '—'}
        </span>
      ),
    },
    {
      key: 'contactStatus',
      label: 'Status',
      sortable: true,
      render: (item) => (
        <Badge variant={item.contactStatus === 'ACTIVE' ? 'success' : 'slate'}>
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
          <button
            onClick={() => onSelectContact && onSelectContact(item.contactId)}
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="View contact profile"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
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
      {/* Top action & filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500">Filter By:</span>

          {/* Country Filter */}
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

          {/* Email Status Filter */}
          <select
            value={emailStatusFilter}
            onChange={(e) => setEmailStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="">All Email Statuses</option>
            <option value="VALID">VALID (Verified)</option>
            <option value="RISKY">RISKY</option>
            <option value="UNVERIFIED">UNVERIFIED</option>
            <option value="INVALID">INVALID</option>
            <option value="BOUNCED">BOUNCED</option>
          </select>

          {/* Contact Status Filter */}
          <select
            value={contactStatusFilter}
            onChange={(e) => setContactStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="">All Contact Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
          </select>

          {/* Source Filter */}
          {sources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600"
            >
              <option value="">All Sources ({sources.length})</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Company Quick Filter */}
          {companies.length > 0 && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-600 max-w-[140px] truncate"
            >
              <option value="">All Organizations</option>
              {companies.map((co) => (
                <option key={co.companyId} value={co.companyId}>
                  {co.companyName}
                </option>
              ))}
            </select>
          )}

          {(countryFilter || emailStatusFilter || contactStatusFilter || sourceFilter || companyFilter) && (
            <button
              onClick={() => {
                setCountryFilter('');
                setEmailStatusFilter('');
                setContactStatusFilter('');
                setSourceFilter('');
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

      {/* Reusable Data Table with Sorting, Pagination, and Search across fields */}
      <DataTable
        data={filteredContacts}
        columns={columns}
        keyField="contactId"
        searchFields={[
          'firstName',
          'lastName',
          'businessEmail',
          'secondaryEmail',
          'companyName',
          'jobTitle',
          'department',
          'phone',
          'mobile',
          'country',
          'source',
          'notes',
        ]}
        searchPlaceholder="Search by name, email, company, domain, phone..."
        exportFilename="yalix_contacts"
        isLoading={isLoading}
        emptyMessage="No contacts found in YALIX database."
      />

      {/* Add / Edit Contact Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingContact?.contactId ? 'Edit Decision Maker Record' : 'Add New Contact'}
        description="Maintain verified business communication credentials, identity integrity and company link."
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
                placeholder="e.g. Thomas"
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
                placeholder="e.g. t.lindqvist@nutranordic.se"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Secondary Email
              </label>
              <input
                type="email"
                value={editingContact?.secondaryEmail || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, secondaryEmail: e.target.value })
                }
                placeholder="e.g. procurement@nutranordic.se"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Linked B2B Organization
              </label>
              <select
                value={editingContact?.companyId || ''}
                onChange={(e) => {
                  const chosen = companies.find((c) => c.companyId === e.target.value);
                  setEditingContact({
                    ...editingContact,
                    companyId: e.target.value,
                    companyName: chosen?.companyName || '',
                  });
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="">— Unassigned (Select an organization) —</option>
                {companies.map((comp) => (
                  <option key={comp.companyId} value={comp.companyId}>
                    {comp.companyName} {comp.country ? `(${comp.country})` : ''}
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
                placeholder="e.g. VP Global Sourcing"
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
                placeholder="e.g. Supply Chain / Ingredients"
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
                placeholder="+46 8 555 1234"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone</label>
              <input
                type="text"
                value={editingContact?.mobile || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, mobile: e.target.value })
                }
                placeholder="+46 70 123 4567"
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
                placeholder="e.g. Sweden, Germany, United States"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Status</label>
              <select
                value={editingContact?.emailStatus || 'VALID'}
                onChange={(e) =>
                  setEditingContact({
                    ...editingContact,
                    emailStatus: e.target.value as EmailStatus,
                  })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="VALID">VALID (Verified Active)</option>
                <option value="UNVERIFIED">UNVERIFIED</option>
                <option value="RISKY">RISKY (Catch-all domain)</option>
                <option value="INVALID">INVALID</option>
                <option value="BOUNCED">BOUNCED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Status</label>
              <select
                value={editingContact?.contactStatus || 'ACTIVE'}
                onChange={(e) =>
                  setEditingContact({
                    ...editingContact,
                    contactStatus: e.target.value as ContactStatus,
                  })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source</label>
              <input
                type="text"
                value={editingContact?.source || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, source: e.target.value })
                }
                placeholder="e.g. BioFach 2026, Inbound, LinkedIn"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Contact Notes
              </label>
              <textarea
                rows={3}
                value={editingContact?.notes || ''}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, notes: e.target.value })
                }
                placeholder="Communication preferences, language, requirements..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

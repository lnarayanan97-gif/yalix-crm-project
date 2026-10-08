import React, { useState } from 'react';
import { Plus, Calendar, CheckCircle2, Clock, Building2, User, Check, Trash2, Edit } from 'lucide-react';
import { FollowUp, Company, Contact, Lead, Priority, FollowUpStatus } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';

interface FollowUpsViewProps {
  followUps: FollowUp[];
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function FollowUpsView({
  followUps,
  companies,
  contacts,
  leads,
  onRefresh,
  isLoading,
}: FollowUpsViewProps) {
  const { currentUser, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'completed'>('today');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<Partial<FollowUp>>({
    title: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'HIGH',
    status: 'PENDING',
    assignedTo: 'YALIX Team',
    note: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const filteredFollowUps = followUps.filter((f) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'completed') return f.status === 'COMPLETED';
    if (f.status === 'COMPLETED') return false; // don't show completed in pending date tabs

    if (activeTab === 'overdue') return f.dueDate < todayStr;
    if (activeTab === 'today') return f.dueDate === todayStr;
    if (activeTab === 'tomorrow') return f.dueDate === tomorrowStr;
    if (activeTab === 'upcoming') return f.dueDate > tomorrowStr;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingFollowUp({
      title: '',
      dueDate: todayStr,
      priority: 'HIGH',
      status: 'PENDING',
      companyId: companies[0]?.companyId || '',
      contactId: contacts[0]?.contactId || '',
      leadId: leads[0]?.leadId || '',
      assignedTo: 'YALIX Sales Rep',
      note: '',
    });
    setIsModalOpen(true);
  };

  const handleMarkComplete = async (fu: FollowUp) => {
    try {
      await crmService.markFollowUpComplete(fu.followUpId, currentUser?.uid || 'user');
      success('Completed', `Follow-up marked as completed.`);
      onRefresh();
    } catch (err: any) {
      error('Update Failed', err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFollowUp.title?.trim() || !editingFollowUp.dueDate) {
      error('Validation Error', 'Title and Due Date are required.');
      return;
    }

    const linkedCompany = companies.find((c) => c.companyId === editingFollowUp.companyId);
    const linkedContact = contacts.find((c) => c.contactId === editingFollowUp.contactId);

    setIsSaving(true);
    try {
      await crmService.saveFollowUp(
        {
          ...editingFollowUp,
          title: editingFollowUp.title.trim(),
          dueDate: editingFollowUp.dueDate,
          priority: editingFollowUp.priority || 'MEDIUM',
          companyName: linkedCompany ? linkedCompany.companyName : editingFollowUp.companyName,
          contactName: linkedContact ? `${linkedContact.firstName} ${linkedContact.lastName || ''}`.trim() : editingFollowUp.contactName,
        } as any,
        currentUser?.uid || 'user',
        currentUser?.email || undefined
      );
      success('Follow-up Scheduled', 'Saved to calendar.');
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      error('Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const columns: Column<FollowUp>[] = [
    {
      key: 'title',
      label: 'Follow-Up Task',
      sortable: true,
      render: (item) => {
        const isOverdue = item.status === 'PENDING' && item.dueDate < todayStr;
        return (
          <div className="flex flex-col">
            <span className={`font-semibold ${item.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
              {item.title}
            </span>
            {item.note && <span className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.note}</span>}
          </div>
        );
      },
    },
    {
      key: 'related',
      label: 'Related Entity',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col text-xs text-slate-700">
          {item.companyName && (
            <span className="flex items-center gap-1 font-medium">
              <Building2 className="w-3 h-3 text-slate-400" />
              <span>{item.companyName}</span>
            </span>
          )}
          {item.contactName && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              <span>{item.contactName}</span>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      sortable: true,
      render: (item) => {
        const isOverdue = item.status === 'PENDING' && item.dueDate < todayStr;
        const isToday = item.status === 'PENDING' && item.dueDate === todayStr;
        return (
          <div className="flex items-center gap-1.5">
            <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-600' : isToday ? 'text-amber-600' : 'text-slate-400'}`} />
            <span className={`text-xs font-semibold ${isOverdue ? 'text-rose-700' : isToday ? 'text-amber-700' : 'text-slate-700'}`}>
              {item.dueDate}
            </span>
          </div>
        );
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (item) => {
        const variants: Record<Priority, 'danger' | 'warning' | 'info' | 'slate'> = {
          URGENT: 'danger',
          HIGH: 'warning',
          MEDIUM: 'info',
          LOW: 'slate',
        };
        return <Badge variant={variants[item.priority]}>{item.priority}</Badge>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item) => (
        <Badge variant={item.status === 'COMPLETED' ? 'success' : 'warning'}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          {item.status !== 'COMPLETED' && (
            <button
              onClick={() => handleMarkComplete(item)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center gap-1"
              title="Mark as completed"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  // Tab counts
  const overdueCount = followUps.filter((f) => f.status === 'PENDING' && f.dueDate < todayStr).length;
  const todayCount = followUps.filter((f) => f.status === 'PENDING' && f.dueDate === todayStr).length;
  const tomorrowCount = followUps.filter((f) => f.status === 'PENDING' && f.dueDate === tomorrowStr).length;

  return (
    <div className="space-y-4">
      {/* Tab Filter and New Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Overdue</span>
            {overdueCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'overdue' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-700'}`}>
                {overdueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'today'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Today</span>
            {todayCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'today' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-700'}`}>
                {todayCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tomorrow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'tomorrow'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Tomorrow</span>
            {tomorrowCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'tomorrow' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {tomorrowCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Upcoming
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Pending ({followUps.filter((f) => f.status === 'PENDING').length})
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'completed'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Completed
          </button>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ Schedule Follow-up</span>
        </button>
      </div>

      <DataTable
        data={filteredFollowUps}
        columns={columns}
        keyField="followUpId"
        searchFields={['title', 'companyName', 'contactName', 'note', 'dueDate']}
        searchPlaceholder="Search follow-ups by task, company, contact, note..."
        exportFilename="yalix_followups"
        isLoading={isLoading}
        emptyMessage={`No follow-ups found for ${activeTab}.`}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Client Follow-Up"
        description="Never miss a buyer communication touchpoint or sample feedback call."
        maxWidth="lg"
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
              form="fu-form"
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Follow-Up'}
            </button>
          </>
        }
      >
        <form id="fu-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Task Action Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editingFollowUp.title || ''}
              onChange={(e) => setEditingFollowUp({ ...editingFollowUp, title: e.target.value })}
              placeholder="e.g. Call Elena to confirm Egg Membrane sample test results"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={editingFollowUp.dueDate || ''}
                onChange={(e) =>
                  setEditingFollowUp({ ...editingFollowUp, dueDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={editingFollowUp.priority || 'HIGH'}
                onChange={(e) =>
                  setEditingFollowUp({ ...editingFollowUp, priority: e.target.value as Priority })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="URGENT">URGENT</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Related Company</label>
              <select
                value={editingFollowUp.companyId || ''}
                onChange={(e) =>
                  setEditingFollowUp({ ...editingFollowUp, companyId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="">None / General</option>
                {companies.map((c) => (
                  <option key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Related Contact</label>
              <select
                value={editingFollowUp.contactId || ''}
                onChange={(e) =>
                  setEditingFollowUp({ ...editingFollowUp, contactId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="">None</option>
                {contacts.map((cnt) => (
                  <option key={cnt.contactId} value={cnt.contactId}>
                    {cnt.firstName} {cnt.lastName || ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-Up Notes</label>
            <textarea
              rows={3}
              value={editingFollowUp.note || ''}
              onChange={(e) => setEditingFollowUp({ ...editingFollowUp, note: e.target.value })}
              placeholder="What needs to be asked? Details of previous email/phone call..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

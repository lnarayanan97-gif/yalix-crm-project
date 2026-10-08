import React, { useState } from 'react';
import { Plus, Send, ShieldAlert, CheckCircle2, Clock, Users, AlertTriangle, Layers, Server } from 'lucide-react';
import { Campaign, Contact, Product, CampaignStatus } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';

interface CampaignsViewProps {
  campaigns: Campaign[];
  contacts: Contact[];
  products: Product[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function CampaignsView({
  campaigns,
  contacts,
  products,
  onRefresh,
  isLoading,
}: CampaignsViewProps) {
  const { currentUser } = useAuth();
  const { success, error } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    name: '',
    subject: '',
    product: products[0]?.name || '',
    status: 'DRAFT',
  });
  const [targetCountry, setTargetCountry] = useState('');

  // Eligible recipient count with Safety filters enforced
  const eligibleRecipients = contacts.filter((c) => {
    // 1. Must be VALID email
    if (c.emailStatus !== 'VALID') return false;
    // 2. Must NOT be unsubscribed or inactive
    if (c.contactStatus !== 'ACTIVE') return false;
    // 3. Country filter if chosen
    if (targetCountry && c.country !== targetCountry) return false;
    return true;
  });

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.name || !newCampaign.subject) {
      error('Validation Error', 'Campaign name and subject are required.');
      return;
    }

    const campaignId = 'camp_' + Date.now();
    const payload: Campaign = {
      id: campaignId,
      campaignId,
      name: newCampaign.name,
      subject: newCampaign.subject,
      product: newCampaign.product || 'General',
      recipientCount: eligibleRecipients.length,
      status: 'SCHEDULED',
      scheduledAt: new Date().toISOString(),
      createdBy: currentUser?.uid || 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'campaigns', campaignId), payload);
      success('Campaign Scheduled', `Queued ${eligibleRecipients.length} verified B2B recipients.`);
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      error('Save Failed', err.message);
    }
  };

  const statusBadge = (s: CampaignStatus) => {
    switch (s) {
      case 'RUNNING':
        return <Badge variant="warning">RUNNING</Badge>;
      case 'SCHEDULED':
        return <Badge variant="info">SCHEDULED</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>;
      case 'PAUSED':
        return <Badge variant="slate">PAUSED</Badge>;
      default:
        return <Badge variant="default">{s}</Badge>;
    }
  };

  const columns: Column<Campaign>[] = [
    {
      key: 'name',
      label: 'Campaign Name',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{item.name}</span>
          <span className="text-xs text-slate-500 font-mono mt-0.5">{item.subject}</span>
        </div>
      ),
    },
    {
      key: 'product',
      label: 'Target Product',
      sortable: true,
      render: (item) => (
        <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          {item.product || 'General'}
        </span>
      ),
    },
    {
      key: 'recipientCount',
      label: 'Recipients Queued',
      sortable: true,
      render: (item) => (
        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{item.recipientCount} verified</span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Queue Status',
      sortable: true,
      render: (item) => statusBadge(item.status),
    },
    {
      key: 'scheduledAt',
      label: 'Scheduled At',
      sortable: true,
      render: (item) => (
        <span className="text-xs text-slate-500">{item.scheduledAt?.split('T')[0] || '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Email Safety & Architecture Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Server-Side Batching Queue & B2B Compliance</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                ACTIVE
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Browser-side mass sending is strictly barred. The server-side email queue processes verified contacts in controlled batches, checking against suppression lists and hard bounces to preserve domain reputation.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ Create Campaign</span>
        </button>
      </div>

      <DataTable
        data={campaigns}
        columns={columns}
        keyField="campaignId"
        searchFields={['name', 'subject', 'product']}
        searchPlaceholder="Search campaigns by name, subject, product..."
        exportFilename="yalix_campaigns"
        isLoading={isLoading}
        emptyMessage="No outreach campaigns created yet."
      />

      {/* Campaign Creation Wizard Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Compliant B2B Outreach Campaign"
        description="Recipients are automatically pre-filtered against suppression and unverified emails."
        maxWidth="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              form="camp-form"
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              Queue Campaign
            </button>
          </>
        }
      >
        <form id="camp-form" onSubmit={handleCreateCampaign} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Campaign Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newCampaign.name || ''}
              onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
              placeholder="e.g. Q4 Europe Organic Sesame Buyer Outreach"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject Line <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newCampaign.subject || ''}
              onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
              placeholder="e.g. Pure Sesame Seeds Export Availability for {{company_name}}"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-600 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Product
              </label>
              <select
                value={newCampaign.product || ''}
                onChange={(e) => setNewCampaign({ ...newCampaign, product: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              >
                {products.map((p) => (
                  <option key={p.productId} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Country (Optional)
              </label>
              <input
                type="text"
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
                placeholder="e.g. Germany, Sweden"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* Safety Check Box */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Safety Gate Evaluation:</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1">
              <span>Audience Pool:</span>
              <strong>{contacts.length} total contacts</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span>Excluded (Unsubscribed/Invalid/Risky):</span>
              <span className="text-rose-700 font-semibold">
                -{contacts.length - eligibleRecipients.length} excluded
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-emerald-200">
              <span>Final Verified Queue:</span>
              <span className="text-emerald-700 text-sm">{eligibleRecipients.length} recipients</span>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

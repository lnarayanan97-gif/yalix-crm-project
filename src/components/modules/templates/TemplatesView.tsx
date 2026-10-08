import React, { useState } from 'react';
import { Plus, Mail, Code, Eye, Edit, Trash2 } from 'lucide-react';
import { EmailTemplate, Product } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';

interface TemplatesViewProps {
  products: Product[];
  isLoading: boolean;
}

const DEFAULT_TEMPLATES: Partial<EmailTemplate>[] = [
  {
    templateId: 'tmpl_egg_membrane_intro',
    name: 'Egg Membrane Powder — B2B Introduction',
    subject: 'Pure Egg Membrane Powder for {{company_name}} Joint Formulations',
    htmlBody: `<p>Dear {{first_name}},</p>
<p>I hope this email finds you well at {{company_name}} in {{country}}.</p>
<p>At YALIX, we specialize in high-purity natural ingredients. We recently noted {{company_name}}'s focus on joint-health supplements and wanted to introduce our pure <strong>Egg Membrane Powder</strong> (naturally standardized for Collagen, Hyaluronic Acid, and Glycosaminoglycans).</p>
<p>Would you be open to reviewing our technical specification sheet and trial batch certificates?</p>
<p>Best regards,<br/>The YALIX Commercial Team</p>`,
    textFallback: `Dear {{first_name}},\n\nI hope this email finds you well at {{company_name}} in {{country}}.\n\nAt YALIX, we specialize in high-purity natural ingredients including Egg Membrane Powder.\n\nWould you be open to reviewing our technical specification sheet?\n\nBest regards,\nThe YALIX Team`,
  },
  {
    templateId: 'tmpl_seeds_export',
    name: 'Organic Seeds & Sesame Bulk Quotation',
    subject: 'Bulk {{product_name}} Export Availability for {{company_name}}',
    htmlBody: `<p>Hello {{first_name}},</p>
<p>Reaching out from YALIX regarding commercial container shipments of <strong>{{product_name}}</strong>.</p>
<p>We are currently contracting for the upcoming harvest with direct export packing out of our certified facilities to {{country}}.</p>
<p>Please let us know your estimated volume requirements for prompt CIF quotations.</p>
<p>Kind regards,<br/>YALIX Agro Sourcing</p>`,
    textFallback: `Hello {{first_name}},\n\nReaching out from YALIX regarding commercial container shipments of {{product_name}}.\n\nPlease let us know your estimated volume requirements.\n\nKind regards,\nYALIX Agro Sourcing`,
  },
];

export function TemplatesView({ products }: TemplatesViewProps) {
  const { currentUser, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES as EmailTemplate[]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate>>({
    name: '',
    subject: '',
    htmlBody: '',
    textFallback: '',
  });

  const handleOpenAdd = () => {
    setEditingTemplate({
      name: '',
      subject: '',
      htmlBody: '<p>Dear {{first_name}},</p>\n<p>...</p>',
      textFallback: 'Dear {{first_name}},\n...',
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.htmlBody) {
      error('Validation Error', 'Name, Subject, and HTML Body are required.');
      return;
    }
    const templateId = editingTemplate.templateId || 'tmpl_' + Date.now();
    const item: EmailTemplate = {
      id: templateId,
      templateId,
      name: editingTemplate.name,
      subject: editingTemplate.subject,
      htmlBody: editingTemplate.htmlBody,
      textFallback: editingTemplate.textFallback || '',
      createdBy: currentUser?.uid || 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTemplates((prev) => [item, ...prev.filter((t) => t.templateId !== templateId)]);
    success('Template Saved', `${item.name} is ready for outreach.`);
    setIsModalOpen(false);
  };

  const columns: Column<EmailTemplate>[] = [
    {
      key: 'name',
      label: 'Template Name',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{item.name}</span>
          <span className="text-xs text-slate-500 font-mono mt-0.5">{item.subject}</span>
        </div>
      ),
    },
    {
      key: 'variables',
      label: 'Merge Tags Supported',
      sortable: false,
      render: () => (
        <div className="flex flex-wrap gap-1 text-[10px]">
          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
            {'{{first_name}}'}
          </span>
          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
            {'{{company_name}}'}
          </span>
          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
            {'{{country}}'}
          </span>
          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
            {'{{product_name}}'}
          </span>
        </div>
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
            onClick={() => setPreviewTemplate(item)}
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Preview HTML output"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setEditingTemplate(item);
              setIsModalOpen(true);
            }}
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Edit template"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Compliant B2B Email Outreach Templates
          </h3>
          <p className="text-xs text-slate-500">
            Supports personal merge tags and mandatory unsubscribe footer headers.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ Create Template</span>
        </button>
      </div>

      <DataTable
        data={templates}
        columns={columns}
        keyField="templateId"
        searchFields={['name', 'subject', 'htmlBody']}
        searchPlaceholder="Search email templates..."
        exportFilename="yalix_email_templates"
        emptyMessage="No email templates found."
      />

      {/* Preview Modal */}
      {previewTemplate && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewTemplate(null)}
          title={`Preview: ${previewTemplate.name}`}
          description={`Subject: ${previewTemplate.subject}`}
          maxWidth="2xl"
          footer={
            <button
              onClick={() => setPreviewTemplate(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-xl"
            >
              Close Preview
            </button>
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div>
                <strong>Subject:</strong> {previewTemplate.subject}
              </div>
            </div>
            <div
              className="p-4 border border-slate-200 rounded-xl bg-white text-sm prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewTemplate.htmlBody }}
            />
            <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-500 font-mono">
              <strong>Plain Text Fallback:</strong>
              <pre className="mt-1 whitespace-pre-wrap">{previewTemplate.textFallback}</pre>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit / Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTemplate.templateId ? 'Edit Email Template' : 'Create Email Template'}
        description="Insert variable tags: {{first_name}}, {{last_name}}, {{company_name}}, {{country}}, {{product_name}}"
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
              form="tmpl-form"
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              Save Template
            </button>
          </>
        }
      >
        <form id="tmpl-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Template Internal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editingTemplate.name || ''}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
              placeholder="e.g. Cardamom Export Introduction"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Subject Line <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editingTemplate.subject || ''}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
              placeholder="e.g. Premium Grade Cardamom Available for {{company_name}}"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              HTML Body Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={8}
              required
              value={editingTemplate.htmlBody || ''}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, htmlBody: e.target.value })}
              placeholder="<p>Dear {{first_name}},</p>..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Text Fallback Version
            </label>
            <textarea
              rows={4}
              value={editingTemplate.textFallback || ''}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, textFallback: e.target.value })}
              placeholder="Plain text version for email clients without HTML..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:border-emerald-600"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

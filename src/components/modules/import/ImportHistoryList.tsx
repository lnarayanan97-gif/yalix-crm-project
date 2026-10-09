import React, { useState, useEffect } from 'react';
import {
  History,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  XCircle,
  Calendar,
  User,
  Hash,
  Database,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { ImportRecord } from '../../../types/crm';
import { crmService } from '../../../services/crmService';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';

interface ImportHistoryListProps {
  onRefreshParent?: () => void;
  onSelectImportDetail?: (importRecord: ImportRecord) => void;
}

export function ImportHistoryList({ onRefreshParent, onSelectImportDetail }: ImportHistoryListProps) {
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PARTIAL' | 'FAILED'>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<ImportRecord | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const records = await crmService.getImports();
      setHistory(records);
    } catch (err: any) {
      console.warn('Import history fetch notice (offline/deferred):', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredHistory = history.filter((item) => {
    // Status filter
    if (statusFilter !== 'ALL') {
      const isPartial = item.status === 'COMPLETED' && (item.invalidCount > 0 || (item.skippedCount > 0 && item.createdCount > 0));
      if (statusFilter === 'PARTIAL' && !isPartial) return false;
      if (statusFilter === 'COMPLETED' && (item.status !== 'COMPLETED' || isPartial)) return false;
      if (statusFilter === 'FAILED' && item.status !== 'FAILED') return false;
    }

    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.fileName.toLowerCase().includes(q) ||
      item.importId.toLowerCase().includes(q) ||
      (item.createdBy && item.createdBy.toLowerCase().includes(q)) ||
      (item.summary && item.summary.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (item: ImportRecord) => {
    if (item.status === 'FAILED') {
      return (
        <Badge variant="danger" size="sm">
          FAILED
        </Badge>
      );
    }
    // Distinguish completed vs partially completed
    const isPartial = (item.invalidCount > 0 || (item.skippedCount > 0 && item.createdCount > 0));
    if (isPartial) {
      return (
        <Badge variant="warning" size="sm">
          PARTIAL ({item.invalidCount ? `${item.invalidCount} inv` : 'skipped'})
        </Badge>
      );
    }
    return (
      <Badge variant="success" size="sm">
        COMPLETED
      </Badge>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Historical Import Audits</h4>
            <p className="text-[11px] text-slate-500">
              Audit log of previous spreadsheet synchronization batches with detailed breakdowns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Outcomes</option>
            <option value="COMPLETED">Fully Completed</option>
            <option value="PARTIAL">Partially Completed</option>
            <option value="FAILED">Failed Runs</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search filename, batch, user..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
            />
          </div>

          <button
            onClick={() => {
              loadHistory();
              onRefreshParent?.();
            }}
            disabled={loading}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80 cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && history.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading import logs...</div>
      ) : filteredHistory.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          No import runs matching criteria. Use the wizard above to import B2B records.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Batch ID / File</th>
                <th className="py-2.5 px-3">Date & User</th>
                <th className="py-2.5 px-3">Total Rows</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3">Updated</th>
                <th className="py-2.5 px-3">Skipped / Inv</th>
                <th className="py-2.5 px-3">Outcome Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800">{item.fileName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{item.importId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                    <div>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</div>
                    <div className="text-[10px] text-slate-400">By: {item.createdBy || 'Authorized User'}</div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">{item.rowCount}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-emerald-600">+{item.createdCount}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-blue-600">{item.updatedCount}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    <span className="text-amber-600 font-medium">{item.skippedCount}</span>
                    {item.invalidCount > 0 && (
                      <span className="text-rose-500 ml-1">({item.invalidCount} inv)</span>
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getStatusBadge(item)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedRecord(item);
                        onSelectImportDetail?.(item);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                      title="Open full import breakdown"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import Detail Modal */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title="Import Audit Record Details"
          description={`Comprehensive verification of batch ${selectedRecord.importId}`}
          maxWidth="2xl"
          footer={
            <button
              onClick={() => setSelectedRecord(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Close Record
            </button>
          }
        >
          <div className="space-y-4">
            {/* Header statistics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Rows</span>
                <span className="text-lg font-bold text-slate-900 mt-0.5 block">{selectedRecord.rowCount}</span>
                <span className="text-[10px] text-slate-500">{selectedRecord.fileType} format</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Created</span>
                <span className="text-lg font-bold text-emerald-800 mt-0.5 block">+{selectedRecord.createdCount}</span>
                <span className="text-[10px] text-emerald-600">New contacts synced</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200/60">
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Updated</span>
                <span className="text-lg font-bold text-blue-800 mt-0.5 block">{selectedRecord.updatedCount}</span>
                <span className="text-[10px] text-blue-600">Merged / updated</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Skipped / Inv</span>
                <span className="text-lg font-bold text-amber-800 mt-0.5 block">{selectedRecord.skippedCount}</span>
                <span className="text-[10px] text-rose-600 font-medium">
                  {selectedRecord.invalidCount} invalid rows
                </span>
              </div>
            </div>

            {/* Detailed metadata */}
            <div className="bg-slate-50 rounded-xl border border-slate-200/70 p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Batch / Import ID:</span>
                <span className="font-mono text-slate-800 font-semibold">{selectedRecord.importId}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Original Filename:</span>
                <span className="text-slate-800 font-semibold">{selectedRecord.fileName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Status Outcome:</span>
                <div>{getStatusBadge(selectedRecord)}</div>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Execution Timestamp:</span>
                <span className="text-slate-800">{new Date(selectedRecord.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Uploaded By:</span>
                <span className="text-slate-800 font-mono">{selectedRecord.createdBy}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Leads Generated:</span>
                <span className="text-slate-800 font-semibold">{selectedRecord.leadsCreatedCount ?? '—'}</span>
              </div>
            </div>

            {/* Summary narrative */}
            {selectedRecord.summary && (
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 block mb-1">Execution Summary</span>
                <p className="text-xs text-slate-600 leading-relaxed font-sans">{selectedRecord.summary}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

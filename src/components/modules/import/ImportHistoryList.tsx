import React, { useState, useEffect } from 'react';
import {
  History,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { ImportRecord } from '../../../types/crm';
import { crmService } from '../../../services/crmService';
import { Badge } from '../../common/Badge';

interface ImportHistoryListProps {
  onRefreshParent?: () => void;
}

export function ImportHistoryList({ onRefreshParent }: ImportHistoryListProps) {
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

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
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.fileName.toLowerCase().includes(q) ||
      item.importId.toLowerCase().includes(q) ||
      (item.summary && item.summary.toLowerCase().includes(q))
    );
  });

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
              Audit log of previous incremental spreadsheet synchronization batches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search past imports..."
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
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80"
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
          No import runs recorded yet. Use the wizard above to import B2B records.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Batch ID / File</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Total Rows</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3">Updated</th>
                <th className="py-2.5 px-3">Skipped / Inv</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-4">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800">{item.fileName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{item.importId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
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
                  <td className="py-3 px-3">
                    <Badge variant={item.status === 'COMPLETED' ? 'success' : 'warning'}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                    {item.summary || 'Execution completed.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

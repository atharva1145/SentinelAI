import React from 'react';
import { History, CheckCircle2, AlertCircle, Clock, FileSpreadsheet, ArrowRight } from 'lucide-react';
import type { Dataset } from '../types';

interface HistoryPageProps {
  datasets: Dataset[];
  onNavigate: (tab: any, datasetId?: number) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ datasets, onNavigate }) => {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
          <History className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dataset Processing History</h2>
          <p className="text-xs text-slate-500">
            Audit log of all datasets, profile jobs, and validation runs persisted in PostgreSQL.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {datasets.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No processing history yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Dataset ID</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Record Count</th>
                  <th className="py-3 px-4">Column Count</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uploaded At</th>
                  <th className="py-3 px-4">Processed At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {datasets.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">#{d.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="truncate max-w-xs">{d.original_filename}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {d.row_count?.toLocaleString() ?? '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{d.column_count ?? '—'}</td>
                    <td className="py-3.5 px-4 text-slate-500">{(d.file_size / 1024).toFixed(1)} KB</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(d.uploaded_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {d.processed_at ? new Date(d.processed_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onNavigate('dataset-detail', d.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

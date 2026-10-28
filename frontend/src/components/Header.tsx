import React from 'react';
import { Activity, Database, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import type { Dataset } from '../types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  health: { status: string; database: string } | null;
  datasets: Dataset[];
  selectedDatasetId: number | null;
  onSelectDataset: (id: number) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  health,
  datasets,
  selectedDatasetId,
  onSelectDataset,
  onRefresh,
  isRefreshing,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-normal">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Active Dataset Selector */}
        {datasets.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Dataset:</span>
            <select
              value={selectedDatasetId ?? ''}
              onChange={(e) => onSelectDataset(Number(e.target.value))}
              className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 max-w-xs truncate"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.original_filename} ({d.row_count ?? 0} rows)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        )}

        {/* System Health Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 border-slate-200">
          <span className="flex items-center gap-1.5">
            {isHealthy ? (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            )}
            <span className="text-slate-700">{isHealthy ? 'Backend Ready' : 'Connecting...'}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Database className="h-3 w-3" />
            {health?.database === 'connected' ? 'DB Active' : health?.database ?? 'DB'}
          </span>
        </div>
      </div>
    </header>
  );
};

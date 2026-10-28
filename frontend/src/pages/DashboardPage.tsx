import React from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  BrainCircuit,
  Database,
  ArrowRight,
  TrendingUp,
  PieChart as PieChartIcon,
  CheckCircle2,
  AlertOctagon,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import type { DashboardStats, TrendPoint, Dataset } from '../types';
import { StatCard } from '../components/StatCard';
import { SeverityBadge } from '../components/SeverityBadge';

interface DashboardPageProps {
  stats: DashboardStats | null;
  trends: TrendPoint[];
  loading: boolean;
  onNavigate: (tab: any, datasetId?: number) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  stats,
  trends,
  loading,
  onNavigate,
}) => {
  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500 font-medium">Loading platform analytics...</p>
        </div>
      </div>
    );
  }

  const severityData = stats?.severity_distribution?.map((item) => ({
    name: item.severity.charAt(0).toUpperCase() + item.severity.slice(1),
    severity: item.severity,
    count: item.count,
    color: SEVERITY_COLORS[item.severity.toLowerCase()] || '#94a3b8',
  })) || [];

  const trendData = trends.map((t) => ({
    date: t.day.slice(5), // MM-DD
    issues: t.count,
  }));

  const totalIssues = stats?.total_issues ?? 0;
  const criticalCount = stats?.severity_distribution?.find((s) => s.severity === 'critical')?.count ?? 0;
  const highCount = stats?.severity_distribution?.find((s) => s.severity === 'high')?.count ?? 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner / Overview Summary */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Production Data Quality & Anomaly Suite
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Data Health & Transaction Integrity Overview
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Automatic rule-based data quality checks combined with Scikit-learn Isolation Forest ML detection
              to protect downstream analytics from bad records.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('upload')}
              className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl text-xs shadow transition flex items-center gap-2 cursor-pointer"
            >
              Upload New CSV
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Datasets Analyzed"
          value={stats?.total_datasets ?? 0}
          subtitle="Processed in PostgreSQL"
          icon={FileSpreadsheet}
          color="indigo"
        />
        <StatCard
          title="Total Records Examined"
          value={(stats?.total_records ?? 0).toLocaleString()}
          subtitle="Across all active batches"
          icon={Database}
          color="blue"
        />
        <StatCard
          title="Quality Issues Detected"
          value={totalIssues.toLocaleString()}
          subtitle={`${criticalCount} Critical • ${highCount} High`}
          icon={AlertTriangle}
          color={criticalCount > 0 ? 'rose' : 'amber'}
        />
        <StatCard
          title="ML Anomalies Flagged"
          value={(stats?.total_anomalies ?? 0).toLocaleString()}
          subtitle="Isolation Forest pipeline"
          icon={BrainCircuit}
          color="emerald"
        />
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Distribution */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Issues by Severity</h3>
              <p className="text-xs text-slate-500">Breakdown of all detected findings</p>
            </div>
            <PieChartIcon className="h-4 w-4 text-slate-400" />
          </div>

          {severityData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No issues recorded yet. Upload a dataset to validate.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                {severityData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-slate-50">
                    <span className="flex items-center gap-1.5 font-medium text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-bold text-slate-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Issue Trends Over Time */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Issue Ingestion Velocity</h3>
              <p className="text-xs text-slate-500">Quality issues detected over the last 30 days</p>
            </div>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </div>

          <div className="h-56">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No timeline data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="issues"
                    name="Issues"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent Datasets Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Datasets</h3>
            <p className="text-xs text-slate-500">Latest CSV files ingested and profiled</p>
          </div>
          <button
            onClick={() => onNavigate('datasets')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            View all datasets
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {(!stats?.recent_datasets || stats.recent_datasets.length === 0) ? (
          <div className="p-8 text-center">
            <Database className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">No datasets uploaded yet</p>
            <p className="text-xs text-slate-400 mt-1">Upload the synthetic transaction dataset to get started.</p>
            <button
              onClick={() => onNavigate('upload')}
              className="mt-4 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm"
            >
              Go to Upload
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-5">Filename</th>
                  <th className="py-3 px-4">Records</th>
                  <th className="py-3 px-4">Columns</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {stats.recent_datasets.map((dataset) => (
                  <tr key={dataset.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-5 text-slate-900 font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="truncate max-w-xs">{dataset.original_filename}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {dataset.row_count !== null ? dataset.row_count.toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {dataset.column_count !== null ? dataset.column_count : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {(dataset.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {dataset.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(dataset.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => onNavigate('dataset-detail', dataset.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        Investigate →
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

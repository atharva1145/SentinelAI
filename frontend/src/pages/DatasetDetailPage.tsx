import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  BrainCircuit,
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  Hash,
  Type,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { Dataset, DatasetProfile, ColumnProfile, Issue, AnomalyResult } from '../types';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';

interface DatasetDetailPageProps {
  datasetId: number;
  onNavigate: (tab: any, datasetId?: number) => void;
  onRefreshStats: () => void;
}

export const DatasetDetailPage: React.FC<DatasetDetailPageProps> = ({
  datasetId,
  onNavigate,
  onRefreshStats,
}) => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'preview' | 'issues' | 'anomalies'>('profile');
  const [validating, setValidating] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDatasetDetails = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getDataset(datasetId);
      setDataset(data);
      if (data.profile) {
        setProfile(data.profile);
      } else if (data.profile_json) {
        try {
          setProfile(JSON.parse(data.profile_json));
        } catch {
          // ignore
        }
      }

      // Fetch issues
      const issueRes = await apiClient.getDatasetIssues(datasetId, { page_size: 100 });
      setIssues(issueRes.items || []);

      // Fetch anomalies
      const anomalyRes = await apiClient.getDatasetAnomalies(datasetId, { page_size: 100 });
      setAnomalies(anomalyRes.items || []);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to load dataset details' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasetDetails();
  }, [datasetId]);

  const handleRunValidation = async () => {
    setValidating(true);
    setActionMessage(null);
    try {
      const res = await apiClient.validateDataset(datasetId);
      setActionMessage({ type: 'success', text: `Rule validation complete! ${res.issues_found} issues identified.` });
      await fetchDatasetDetails();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.response?.data?.detail || 'Validation failed' });
    } finally {
      setValidating(false);
    }
  };

  const handleRunAnomalyDetection = async () => {
    setDetecting(true);
    setActionMessage(null);
    try {
      const res = await apiClient.detectAnomalies(datasetId);
      setActionMessage({
        type: 'success',
        text: `Isolation Forest ML detection complete! ${res.anomalies_detected} anomalous records flagged.`,
      });
      await fetchDatasetDetails();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Anomaly detection failed. Ensure dataset has at least 2 numeric columns and 10 rows.',
      });
    } finally {
      setDetecting(false);
    }
  };

  if (loading && !dataset) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">Loading dataset details...</p>
        </div>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
        <p className="text-sm font-semibold text-slate-900 mt-2">Dataset not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs underline font-medium hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dataset Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {dataset.original_filename}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span>ID: #{dataset.id}</span>
                  <span>•</span>
                  <span>Uploaded {new Date(dataset.uploaded_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>{(dataset.file_size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunValidation}
              disabled={validating}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              {validating ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Running Validation...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Run Quality Rules
                </>
              )}
            </button>

            <button
              onClick={handleRunAnomalyDetection}
              disabled={detecting}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              {detecting ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Training Isolation Forest...
                </>
              ) : (
                <>
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Detect ML Anomalies
                </>
              )}
            </button>

            <a
              href={apiClient.getReportDownloadUrl(dataset.id)}
              download={`sentinel_report_${dataset.id}.csv`}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Export Report (CSV)
            </a>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Total Rows</span>
            <p className="text-base font-bold text-slate-900 mt-0.5">
              {dataset.row_count?.toLocaleString() ?? '—'}
            </p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Columns</span>
            <p className="text-base font-bold text-slate-900 mt-0.5">{dataset.column_count ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Detected Quality Issues</span>
            <p className="text-base font-bold text-amber-600 mt-0.5">{issues.length}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">ML Anomaly Flags</span>
            <p className="text-base font-bold text-violet-600 mt-0.5">
              {anomalies.filter((a) => a.is_anomaly).length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Column Profiles ({profile?.columns?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'preview'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          Data Preview ({(profile?.preview || profile?.preview_rows || []).length} rows)
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'issues'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Quality Issues ({issues.length})
        </button>
        <button
          onClick={() => setActiveTab('anomalies')}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'anomalies'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <BrainCircuit className="h-4 w-4" />
          ML Anomalies ({anomalies.filter((a) => a.is_anomaly).length})
        </button>
      </div>

      {/* Tab 1: Column Profiling Breakdown */}
      {activeTab === 'profile' && profile && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profile.columns.map((col) => {
            const isNumeric = col.mean !== undefined && col.mean !== null;
            const hasNulls = col.null_count > 0;

            return (
              <div
                key={col.name}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 truncate max-w-[200px]" title={col.name}>
                      {col.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-mono text-slate-500">
                      {isNumeric ? <Hash className="h-3 w-3 text-indigo-500" /> : <Type className="h-3 w-3 text-emerald-500" />}
                      {col.dtype}
                    </span>
                  </div>
                  {hasNulls ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      {col.null_pct.toFixed(1)}% null
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      100% complete
                    </span>
                  )}
                </div>

                {/* Progress Bar for Missing Values */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Completeness</span>
                    <span>{(100 - col.null_pct).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${col.null_pct > 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.max(0, 100 - col.null_pct)}%` }}
                    />
                  </div>
                </div>

                {/* Numeric Statistics */}
                {isNumeric ? (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Mean</span>
                      <p className="font-mono text-slate-800 font-medium">{col.mean?.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Std Dev</span>
                      <p className="font-mono text-slate-800 font-medium">{col.std?.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Min</span>
                      <p className="font-mono text-slate-800 font-medium">{col.min}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Max</span>
                      <p className="font-mono text-slate-800 font-medium">{col.max}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Unique Values</span>
                      <span className="font-semibold">{col.unique_count} ({col.unique_pct.toFixed(1)}%)</span>
                    </div>
                    {col.avg_length && (
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-400">Avg Length</span>
                        <span className="font-semibold">{col.avg_length.toFixed(1)} chars</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sample Values Preview */}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Sample Values</p>
                  <div className="flex flex-wrap gap-1">
                    {col.sample_values?.slice(0, 4).map((val, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-[10px] font-mono bg-slate-50 text-slate-700 border border-slate-200 rounded truncate max-w-[120px]"
                      >
                        {val === null || val === undefined ? 'null' : String(val)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Interactive Data Preview */}
      {activeTab === 'preview' && profile && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Showing first {(profile.preview || profile.preview_rows || []).length} rows of original dataset
            </span>
            <span className="text-slate-400">Original structure preserved without modifications</span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr className="text-slate-600 font-semibold text-[11px]">
                  <th className="py-2.5 px-4 font-mono text-slate-400">#</th>
                  {profile.columns.map((col) => (
                    <th key={col.name} className="py-2.5 px-4 whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {(profile.preview || profile.preview_rows || []).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2 px-4 text-slate-400">{idx + 1}</td>
                    {profile.columns.map((col) => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined || val === '';
                      return (
                        <td key={col.name} className="py-2 px-4 whitespace-nowrap text-slate-800">
                          {isNull ? <span className="text-slate-300 italic">null</span> : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Dataset Issues */}
      {activeTab === 'issues' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              {issues.length} Issues Detected for this Dataset
            </span>
            <button
              onClick={() => onNavigate('issues')}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Open in Issue Studio →
            </button>
          </div>

          {issues.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No issues detected. Click &quot;Run Quality Rules&quot; above to scan for issues.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/60 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Row</th>
                    <th className="py-3 px-4">Column</th>
                    <th className="py-3 px-4">Rule</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Actual Value</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.slice(0, 50).map((issue) => (
                    <tr key={issue.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {issue.row_index !== null ? `#${issue.row_index + 1}` : '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{issue.column_name ?? 'Dataset'}</td>
                      <td className="py-3 px-4 text-slate-700">{issue.rule_name}</td>
                      <td className="py-3 px-4">
                        <SeverityBadge severity={issue.severity} size="sm" />
                      </td>
                      <td className="py-3 px-4 font-mono text-red-600">
                        {issue.actual_value === null ? '<null>' : issue.actual_value}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={issue.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={issue.explanation}>
                        {issue.explanation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: ML Anomalies */}
      {activeTab === 'anomalies' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Isolation Forest ML Detections</h3>
              <p className="text-[11px] text-slate-500">
                Unsupervised anomaly scoring with feature z-score explanations
              </p>
            </div>
            <button
              onClick={() => onNavigate('anomalies')}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Open Full ML Studio →
            </button>
          </div>

          {anomalies.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No anomaly detection jobs run yet. Click &quot;Detect ML Anomalies&quot; to evaluate this dataset.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/60 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Row</th>
                    <th className="py-3 px-4">Anomaly Score</th>
                    <th className="py-3 px-4">Prediction</th>
                    <th className="py-3 px-4">Feature Deviations (|z-score| &gt; 2)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {anomalies
                    .filter((a) => a.is_anomaly)
                    .slice(0, 30)
                    .map((item) => {
                      let contribs: Record<string, number> = {};
                      if (item.feature_contributions_json) {
                        try {
                          contribs = JSON.parse(item.feature_contributions_json);
                        } catch {
                          // ignore
                        }
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                            #{item.row_index + 1}
                          </td>
                          <td className="py-3 px-4 font-mono text-violet-700 font-bold">
                            {item.anomaly_score.toFixed(4)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                              ANOMALY
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(contribs)
                                .filter(([_, z]) => Math.abs(z) >= 1.5)
                                .map(([col, z]) => (
                                  <span
                                    key={col}
                                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {col}: <strong className={z > 0 ? 'text-red-600' : 'text-blue-600'}>z={z.toFixed(2)}</strong>
                                  </span>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  BarChart,
  RefreshCw,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  X,
  Wrench,
  Printer,
  Sliders,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { Dataset, DatasetProfile, ColumnProfile, Issue, AnomalyResult, HealthScoreData } from '../types';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { HealthScoreCard } from '../components/HealthScoreCard';
import { AutoRemediationModal } from '../components/AutoRemediationModal';
import { CustomRulesManager } from '../components/CustomRulesManager';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'preview' | 'issues' | 'anomalies' | 'drift' | 'custom_rules'>('profile');
  const [validating, setValidating] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('isolation_forest');
  const [driftReport, setDriftReport] = useState<any>(null);
  const [loadingDrift, setLoadingDrift] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedShapAnomaly, setSelectedShapAnomaly] = useState<AnomalyResult | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScoreData | null>(null);
  const [isRemediationOpen, setIsRemediationOpen] = useState(false);
  const [selectedCellIssue, setSelectedCellIssue] = useState<{ issue: Issue; rowIdx: number; colName: string } | null>(null);

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

      // Fetch health score
      try {
        const hs = await apiClient.getDatasetHealthScore(datasetId);
        setHealthScore(hs);
      } catch (e) {
        console.error('Failed to load health score', e);
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

  const fetchDrift = async () => {
    setLoadingDrift(true);
    try {
      const report = await apiClient.getDatasetDrift(datasetId);
      setDriftReport(report);
    } catch (err) {
      console.error('Failed to load drift report', err);
    } finally {
      setLoadingDrift(false);
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
      const res = await apiClient.detectAnomalies(datasetId, selectedAlgorithm, 0.05);
      const algoLabels: Record<string, string> = {
        isolation_forest: 'Isolation Forest',
        local_outlier_factor: 'Local Outlier Factor (LOF)',
        one_class_svm: 'One-Class SVM',
        ensemble: 'Ensemble Suite (IF + LOF)',
      };
      setActionMessage({
        type: 'success',
        text: `${algoLabels[selectedAlgorithm] || selectedAlgorithm} ML detection complete! ${res.anomalies_detected} anomalous records flagged.`,
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

  const qualityScore = profile?.quality_score ?? Math.max(10, Math.round(100 - (issues.length * 0.4) - (anomalies.filter(a => a.is_anomaly).length * 0.8)));
  const completenessScore = profile?.completeness_score ?? (dataset.row_count && profile?.columns && profile.columns.length > 0 ? Math.round((1 - (profile.columns.reduce((acc, c) => acc + (c.null_count || 0), 0) / (dataset.row_count * profile.columns.length))) * 1000) / 10 : 98.5);
  const uniquenessScore = profile?.uniqueness_score ?? (dataset.row_count ? Math.round((1 - (profile?.duplicate_row_count || 0) / dataset.row_count) * 100) : 100);

  const topFailingRule = issues.length > 0
    ? Object.entries(
        issues.reduce((acc, issue) => {
          acc[issue.rule_name] = (acc[issue.rule_name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1])[0]
    : null;

  const anomalyCount = anomalies.filter((a) => a.is_anomaly).length;

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

          {/* Action Buttons with Model Selector */}
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

            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <select
                value={selectedAlgorithm}
                onChange={(e) => setSelectedAlgorithm(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-700 px-2.5 py-1 focus:outline-none cursor-pointer"
              >
                <option value="isolation_forest">Isolation Forest (Default)</option>
                <option value="local_outlier_factor">Local Outlier Factor (LOF)</option>
                <option value="one_class_svm">One-Class SVM</option>
                <option value="ensemble">Ensemble (IF + LOF)</option>
              </select>

              <button
                onClick={handleRunAnomalyDetection}
                disabled={detecting}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {detecting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Detect ML
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setIsRemediationOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5 cursor-pointer"
              title="Launch autonomous data repair & remediation studio"
            >
              <Wrench className="h-3.5 w-3.5 text-indigo-200" />
              <span>Auto-Remediate</span>
            </button>

            <button
              onClick={() => window.open(apiClient.getAuditCertificateUrl(dataset.id), '_blank')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              title="Generate printable executive compliance audit certificate"
            >
              <Printer className="h-3.5 w-3.5 text-cyan-400" />
              <span>Audit Certificate</span>
            </button>

            <a
              href={apiClient.getCleanDownloadUrl(dataset.id)}
              download={`clean_${dataset.original_filename}`}
              title="Download verified clean records excluding critical issues and anomalies"
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-medium text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Clean Data (ETL)
            </a>

            <a
              href={apiClient.getQuarantineDownloadUrl(dataset.id)}
              download={`quarantine_${dataset.original_filename}`}
              title="Download quarantined records with explanation codes"
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-medium text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              Quarantine CSV
            </a>

            <a
              href={apiClient.getReportDownloadUrl(dataset.id)}
              download={`sentinel_report_${dataset.id}.csv`}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Audit Report
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

      {/* Automated Executive Diagnostics & Quality Score Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              Automated Root Cause Diagnostics & Integrity Score
            </div>
            <h3 className="text-base font-bold text-white">
              Data Reliability Assessment: {qualityScore >= 80 ? 'Production Ready' : qualityScore >= 60 ? 'Moderate Data Debt' : 'High Operational Risk'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              {issues.length === 0 && anomalyCount === 0 ? (
                'Dataset has passed preliminary schema profiling with no immediate violations. Run rule validation and ML detection to verify integrity.'
              ) : (
                <>
                  Validation flagged <strong className="text-amber-400">{issues.length} data quality rule violations</strong>
                  {topFailingRule && <> (led by <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded text-[11px]">{topFailingRule[0]}</code> with {topFailingRule[1]} hits)</>}
                  {anomalyCount > 0 && <> and <strong className="text-violet-400">{anomalyCount} multivariate anomalies</strong> flagged via {selectedAlgorithm}</>}.
                  Clean records are ready for export, and quarantined rows are isolated with root-cause reason codes.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 shrink-0">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <span className={`text-2xl font-black font-mono ${qualityScore >= 80 ? 'text-emerald-400' : qualityScore >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {qualityScore}
                </span>
                <span className="text-xs text-slate-400 font-bold ml-0.5">/100</span>
              </div>
              <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 tracking-wider">Quality Score</p>
            </div>
            <div className="h-10 w-px bg-slate-700" />
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-3 text-slate-300">
                <span className="text-slate-400">Completeness:</span>
                <span className="font-semibold text-white">{completenessScore}%</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-300">
                <span className="text-slate-400">Uniqueness:</span>
                <span className="font-semibold text-white">{uniquenessScore}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 1: Enterprise Quality Health Scorecard */}
      <HealthScoreCard
        scoreData={healthScore}
        onViewCertificate={() => window.open(apiClient.getAuditCertificateUrl(dataset.id), '_blank')}
      />

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
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
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'preview'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          Data Inspector ({(profile?.preview || profile?.preview_rows || []).length} rows)
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
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
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'anomalies'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <BrainCircuit className="h-4 w-4" />
          ML Anomalies ({anomalies.filter((a) => a.is_anomaly).length})
        </button>
        <button
          onClick={() => {
            setActiveTab('drift');
            fetchDrift();
          }}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'drift'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          Distribution Drift (KS-Test)
        </button>
        <button
          onClick={() => setActiveTab('custom_rules')}
          className={`pb-3 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'custom_rules'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Custom Business Rules
        </button>
      </div>

      {/* Tab 1: Column Profiling Breakdown */}
      {activeTab === 'profile' && profile && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(profile.columns || []).map((col) => {
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

                {/* Progress Bar for Completeness */}
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

                {/* Histogram Visualizer (Numeric Columns) */}
                {isNumeric && col.histogram && col.histogram.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase">
                      <span>Distribution</span>
                      <span className="font-mono text-[9px]">5 Bins</span>
                    </div>
                    <div className="flex items-end gap-1 h-7 bg-slate-50 p-1 rounded-md border border-slate-100">
                      {col.histogram.map((binItem, bIdx) => {
                        const maxCount = Math.max(...(col.histogram?.map((h) => h.count) || [1]), 1);
                        const pctHeight = Math.max(12, Math.round((binItem.count / maxCount) * 100));
                        return (
                          <div
                            key={bIdx}
                            className="flex-1 bg-indigo-400 hover:bg-indigo-600 rounded-xs transition cursor-pointer"
                            style={{ height: `${pctHeight}%` }}
                            title={`${binItem.bin}: ${binItem.count} rows`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top Categories Frequency (Categorical Columns) */}
                {!isNumeric && col.top_categories && col.top_categories.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Top Categories</p>
                    <div className="space-y-0.5">
                      {col.top_categories.slice(0, 3).map((cat, cIdx) => (
                        <div key={cIdx} className="flex items-center justify-between text-[10px] text-slate-600">
                          <span className="truncate max-w-[120px] font-mono">{cat.value}</span>
                          <span className="text-slate-400 font-medium">{cat.pct}%</span>
                        </div>
                      ))}
                    </div>
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

      {/* Tab 2: Interactive Data Preview & Cell-Level Issue Inspector */}
      {activeTab === 'preview' && profile && (() => {
        const cellIssueMap = new Map<string, Issue>();
        issues.forEach((iss) => {
          if (iss.row_index !== null && iss.row_index !== undefined && iss.column_name) {
            const key = `${iss.row_index}:${iss.column_name}`;
            if (!cellIssueMap.has(key)) cellIssueMap.set(key, iss);
          }
        });
        const rowAnomalySet = new Set<number>();
        anomalies.filter((a) => a.is_anomaly).forEach((a) => rowAnomalySet.add(a.row_index));

        return (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-800 font-bold">
                  Data Grid Inspector (Showing first {(profile.preview || profile.preview_rows || []).length} rows)
                </span>
                <span className="block text-slate-500 text-[11px] mt-0.5">
                  Click on any highlighted cell with a colored indicator to inspect the underlying rule violation.
                </span>
              </div>

              {/* Inspector Legend */}
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-rose-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Critical/High Issue
                </span>
                <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Warning Issue
                </span>
                <span className="flex items-center gap-1.5 text-purple-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  ML Anomaly Record
                </span>
              </div>
            </div>

            {/* Active Cell Inspector Drawer */}
            {selectedCellIssue && (
              <div className="mx-4 p-4 rounded-xl border border-rose-200 bg-rose-50/90 flex items-start justify-between text-xs animate-in fade-in">
                <div className="space-y-1.5 flex-1 mr-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-bold text-slate-900">
                      Cell Violation: Row #{selectedCellIssue.rowIdx + 1}, Column '{selectedCellIssue.colName}'
                    </span>
                    <SeverityBadge severity={selectedCellIssue.issue.severity} />
                  </div>
                  <div className="text-slate-700"><strong>Rule Violated:</strong> {selectedCellIssue.issue.rule_name}</div>
                  <div className="text-slate-700"><strong>Explanation:</strong> {selectedCellIssue.issue.explanation}</div>
                  <div className="text-slate-700 font-mono text-[11px]"><strong>Expected Condition:</strong> {selectedCellIssue.issue.expected_condition}</div>
                  <div className="text-indigo-700 font-semibold"><strong>Suggested Action:</strong> {selectedCellIssue.issue.suggested_action}</div>
                </div>
                <button
                  onClick={() => setSelectedCellIssue(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-rose-100 transition cursor-pointer"
                  title="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr className="text-slate-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4 font-mono text-slate-400">#</th>
                    {(profile.columns || []).map((col) => (
                      <th key={col.name} className="py-2.5 px-4 whitespace-nowrap font-mono">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {(profile.preview || profile.preview_rows || []).map((row, idx) => {
                    const isRowAnomaly = rowAnomalySet.has(idx);
                    return (
                      <tr key={idx} className={`hover:bg-slate-50/80 transition ${isRowAnomaly ? 'bg-purple-50/30' : ''}`}>
                        <td className="py-2 px-4 text-slate-400">
                          <span className="flex items-center gap-1">
                            {idx + 1}
                            {isRowAnomaly && (
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Flagged as ML Anomaly row" />
                            )}
                          </span>
                        </td>
                        {(profile.columns || []).map((col) => {
                          const val = row[col.name];
                          const isNull = val === null || val === undefined || val === '';
                          const issue = cellIssueMap.get(`${idx}:${col.name}`);

                          let cellClasses = 'py-2 px-4 whitespace-nowrap text-slate-800 transition';
                          if (issue) {
                            cellClasses += ' cursor-pointer ';
                            if (issue.severity === 'critical' || issue.severity === 'high') {
                              cellClasses += 'bg-rose-50/90 text-rose-900 border-l-2 border-rose-500 font-bold hover:bg-rose-100';
                            } else {
                              cellClasses += 'bg-amber-50/80 text-amber-900 border-l-2 border-amber-400 font-semibold hover:bg-amber-100';
                            }
                          }

                          return (
                            <td
                              key={col.name}
                              className={cellClasses}
                              onClick={() => {
                                if (issue) {
                                  setSelectedCellIssue({ issue, rowIdx: idx, colName: col.name });
                                }
                              }}
                              title={issue ? `⚠️ [${issue.severity.toUpperCase()}] ${issue.rule_name}: ${issue.explanation} (Click to inspect)` : undefined}
                            >
                              <div className="flex items-center gap-1.5">
                                {issue && (
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      issue.severity === 'critical' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                                    }`}
                                  />
                                )}
                                <span>{isNull ? <span className="text-slate-300 italic">null</span> : String(val)}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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

      {/* Tab 4: ML Anomalies with TreeSHAP and z-scores */}
      {activeTab === 'anomalies' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Machine Learning Anomaly Detections</h3>
              <p className="text-[11px] text-slate-500">
                Isolation Forest and multi-model scoring with empirical z-scores and TreeSHAP marginal contributions
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
              No anomaly detection jobs run yet. Click &quot;Detect ML&quot; to evaluate this dataset.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/60 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Row</th>
                    <th className="py-3 px-4">Anomaly Score</th>
                    <th className="py-3 px-4">Prediction</th>
                    <th className="py-3 px-4">Feature Deviations (|z-score| &gt; 1.5)</th>
                    <th className="py-3 px-4 text-right">Attribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {anomalies
                    .filter((a) => a.is_anomaly)
                    .slice(0, 30)
                    .map((item) => {
                      let contribs: Record<string, any> = {};
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
                                .filter(([k, z]) => k !== '_shap' && typeof z === 'number' && Math.abs(z) >= 1.5)
                                .map(([col, z]) => (
                                   <span
                                    key={col}
                                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {col}: <strong className={Number(z) > 0 ? 'text-red-600' : 'text-blue-600'}>z={Number(z).toFixed(2)}</strong>
                                  </span>
                                ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setSelectedShapAnomaly(item)}
                              className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold text-[10px] rounded-lg border border-violet-200 transition cursor-pointer"
                            >
                              Explain (TreeSHAP) →
                            </button>
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

      {/* Tab 5: Data Drift Analysis (Kolmogorov-Smirnov Test) */}
      {activeTab === 'drift' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Kolmogorov-Smirnov Distribution Drift Analysis</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Two-sample KS-test evaluating empirical cumulative distribution shift against baseline dataset.
              </p>
            </div>
            <button
              onClick={fetchDrift}
              disabled={loadingDrift}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDrift ? 'animate-spin' : ''}`} />
              Re-evaluate Drift
            </button>
          </div>

          {loadingDrift ? (
            <div className="p-12 text-center text-xs text-slate-500">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto mb-2" />
              Evaluating empirical cumulative distributions...
            </div>
          ) : !driftReport ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No drift data available. Click Re-evaluate above.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Drift Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                driftReport.has_drift
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${driftReport.has_drift ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">
                      {driftReport.has_drift ? 'Statistically Significant Drift Detected' : 'Distributions Stable (No Drift Detected)'}
                    </h4>
                    <p className="text-xs opacity-90">
                      {driftReport.drifted_features_count} of {driftReport.total_features_evaluated} features drifted ({(driftReport.drift_share * 100).toFixed(1)}% drift share) compared to baseline: <strong>{driftReport.baseline_filename}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Drift Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Feature Name</th>
                      <th className="py-3 px-4">KS-Statistic (D)</th>
                      <th className="py-3 px-4">p-value</th>
                      <th className="py-3 px-4">Wasserstein Distance</th>
                      <th className="py-3 px-4">Current vs Baseline Mean</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {driftReport.features?.map((f: any) => (
                      <tr key={f.column} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-bold text-slate-900">{f.column}</td>
                        <td className="py-3 px-4 font-mono text-slate-700">{f.ks_statistic.toFixed(4)}</td>
                        <td className="py-3 px-4 font-mono">
                          <span className={f.p_value < 0.05 ? 'text-red-600 font-bold' : 'text-slate-600'}>
                            {f.p_value < 0.0001 ? '< 0.0001' : f.p_value.toFixed(4)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">{f.wasserstein_distance.toFixed(4)}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {f.current_mean} vs {f.baseline_mean}
                        </td>
                        <td className="py-3 px-4">
                          {f.is_drifted ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              DRIFT DETECTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              STABLE
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TreeSHAP Anomaly Explainability Modal */}
      {selectedShapAnomaly && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 text-violet-700 rounded-xl">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Model Decision Attribution: Row #{selectedShapAnomaly.row_index + 1}
                  </h3>
                  <p className="text-xs text-slate-500">
                    TreeSHAP local feature attribution and standardized z-score deviations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedShapAnomaly(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Score & Prediction Bar */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Anomaly Score</span>
                <p className="text-base font-bold text-violet-700 mt-0.5 font-mono">
                  {selectedShapAnomaly.anomaly_score.toFixed(4)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Model Classification</span>
                <p className="mt-0.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                    ANOMALY
                  </span>
                </p>
              </div>
            </div>

            {/* TreeSHAP Feature Attribution Waterfall / Bar Chart */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Feature Importance (SHAP Impact on Anomaly Score)
                </h4>
                <span className="text-[10px] text-slate-400">Positive = Pushes toward anomaly</span>
              </div>

              {(() => {
                let parsed: Record<string, any> = {};
                try {
                  parsed = JSON.parse(selectedShapAnomaly.feature_contributions_json || '{}');
                } catch {
                  // ignore
                }

                const shapVals: Record<string, number> = parsed._shap || {};
                const entries = Object.entries(shapVals).length > 0
                  ? Object.entries(shapVals)
                  : Object.entries(parsed).filter(([k, v]) => k !== '_shap' && typeof v === 'number');

                if (entries.length === 0) {
                  return <p className="text-xs text-slate-400 italic">No feature contribution data recorded.</p>;
                }

                const maxAbs = Math.max(...entries.map(([_, v]) => Math.abs(Number(v))), 0.001);

                return (
                  <div className="space-y-2 pt-1">
                    {entries.map(([feat, val]) => {
                      const numVal = Number(val);
                      const isRisk = numVal > 0;
                      const widthPct = Math.min(100, Math.round((Math.abs(numVal) / maxAbs) * 100));
                      const zScore = typeof parsed[feat] === 'number' ? parsed[feat] : null;

                      return (
                        <div key={feat} className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="font-semibold text-slate-700">{feat}</span>
                            <span className={isRisk ? 'text-rose-600 font-bold' : 'text-emerald-600 font-medium'}>
                              {numVal > 0 ? `+${numVal.toFixed(3)}` : numVal.toFixed(3)}
                              {zScore !== null && <span className="text-slate-400 ml-1.5 font-normal">(z={zScore.toFixed(1)})</span>}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                            <div
                              className={`h-full rounded-full transition-all ${isRisk ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedShapAnomaly(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 2: Custom Rules Studio Tab */}
      {activeTab === 'custom_rules' && (
        <CustomRulesManager
          datasetId={datasetId}
          availableColumns={(profile?.columns || []).map((c) => c.name)}
          onRulesChanged={() => {
            handleRunValidation();
            onRefreshStats();
          }}
        />
      )}

      {/* Feature 1: Autonomous Remediation Modal */}
      {dataset && (
        <AutoRemediationModal
          datasetId={datasetId}
          filename={dataset.original_filename}
          isOpen={isRemediationOpen}
          onClose={() => setIsRemediationOpen(false)}
          onSuccess={(newId) => {
            fetchDatasetDetails();
            onRefreshStats();
            if (newId) onNavigate('dataset-detail', newId);
          }}
        />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Wrench,
  Check,
  X,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Sliders,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { RemediationPreview, RemediationSummary } from '../types';

interface AutoRemediationModalProps {
  datasetId: number;
  filename: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDatasetId: number | null) => void;
}

export const AutoRemediationModal: React.FC<AutoRemediationModalProps> = ({
  datasetId,
  filename,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [deduplicate, setDeduplicate] = useState(true);
  const [imputeMissing, setImputeMissing] = useState(true);
  const [imputeStrategy, setImputeStrategy] = useState<'median_mode' | 'drop_rows'>('median_mode');
  const [clampRanges, setClampRanges] = useState(true);
  const [standardizeDates, setStandardizeDates] = useState(true);
  const [cleanWhitespace, setCleanWhitespace] = useState(true);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyingLoading, setApplyingLoading] = useState(false);
  const [previewData, setPreviewData] = useState<RemediationPreview | null>(null);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const buildConfig = () => ({
    deduplicate,
    impute_missing: {
      enabled: imputeMissing,
      strategy: imputeStrategy,
    },
    clamp_ranges: clampRanges,
    standardize_dates: standardizeDates,
    clean_whitespace: cleanWhitespace,
  });

  const handlePreview = async () => {
    setPreviewLoading(true);
    setResultMessage(null);
    try {
      const res = await apiClient.previewRemediation(datasetId, buildConfig());
      setPreviewData(res);
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to simulate remediation preview.',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApply = async () => {
    setApplyingLoading(true);
    setResultMessage(null);
    try {
      const res = await apiClient.applyRemediation(datasetId, buildConfig(), true);
      setResultMessage({
        type: 'success',
        text: `✓ Remediation successful! ${res.summary.total_repairs} total repairs applied across ${res.summary.final_rows} rows. Clean dataset saved to workspace.`,
      });
      setDownloadUrl(res.download_url);
      onSuccess(res.new_dataset_id);
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to apply remediation.',
      });
    } finally {
      setApplyingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Autonomous Data Remediation & Repair Studio</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                  AI & Rule Assisted
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">Target: {filename}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {resultMessage && (
            <div
              className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{resultMessage.text}</span>
              </div>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5 shrink-0 ml-4"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Clean CSV</span>
                </a>
              )}
            </div>
          )}

          {/* Configuration Toggles */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              <span>Select Remediation Actions to Apply</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* 1. Deduplication */}
              <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 cursor-pointer flex items-start gap-3 transition">
                <input
                  type="checkbox"
                  checked={deduplicate}
                  onChange={(e) => setDeduplicate(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0"
                />
                <div>
                  <div className="font-bold text-slate-900">Remove Exact Duplicate Records</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Deduplicates rows keeping the first valid record and eliminating identical redundancies.
                  </div>
                </div>
              </label>

              {/* 2. Range Clamping */}
              <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 cursor-pointer flex items-start gap-3 transition">
                <input
                  type="checkbox"
                  checked={clampRanges}
                  onChange={(e) => setClampRanges(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0"
                />
                <div>
                  <div className="font-bold text-slate-900">Clamp Boundaries & Floor Negatives</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Clamps negative financial amounts (price, salary, amount) to 0.0 and percentages to [0, 100].
                  </div>
                </div>
              </label>

              {/* 3. Date Standardization */}
              <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 cursor-pointer flex items-start gap-3 transition">
                <input
                  type="checkbox"
                  checked={standardizeDates}
                  onChange={(e) => setStandardizeDates(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0"
                />
                <div>
                  <div className="font-bold text-slate-900">Standardize Dates to ISO-8601</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Converts mixed string formats (MM/DD/YYYY, DD-MM-YY) into uniform YYYY-MM-DD.
                  </div>
                </div>
              </label>

              {/* 4. Whitespace Sanitization */}
              <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 cursor-pointer flex items-start gap-3 transition">
                <input
                  type="checkbox"
                  checked={cleanWhitespace}
                  onChange={(e) => setCleanWhitespace(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0"
                />
                <div>
                  <div className="font-bold text-slate-900">Normalize String Whitespace</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Strips erroneous trailing and leading whitespace from all categorical text columns.
                  </div>
                </div>
              </label>
            </div>

            {/* 5. Missing Values Configuration */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-900">
                  <input
                    type="checkbox"
                    checked={imputeMissing}
                    onChange={(e) => setImputeMissing(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                  />
                  <span>Handle Missing & Null Values</span>
                </label>
                {imputeMissing && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Strategy:</span>
                    <select
                      value={imputeStrategy}
                      onChange={(e) => setImputeStrategy(e.target.value as any)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="median_mode">Auto-Impute (Median for numbers, Mode for text)</option>
                      <option value="drop_rows">Drop Incomplete Rows</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Preview & Apply */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || applyingLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Sparkles className="w-4 h-4 text-indigo-600" />}
              <span>Simulate & Preview Changes</span>
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={previewLoading || applyingLoading}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
            >
              {applyingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Execute Repairs & Save Clean Dataset</span>
            </button>
          </div>

          {/* Preview Results Area */}
          {previewData && (
            <div className="space-y-4 pt-4 border-t border-slate-200 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Simulation Results Diff ({previewData.summary.total_repairs} repairs detected)
                </h4>
                <div className="text-xs text-slate-500 font-mono">
                  Rows: {previewData.summary.initial_rows} → {previewData.summary.final_rows}
                </div>
              </div>

              {/* Repair Metrics Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] text-emerald-600 font-medium">Duplicates Removed</div>
                  <div className="text-lg font-bold text-emerald-800">{previewData.summary.duplicates_removed}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-[11px] text-blue-600 font-medium">Cells Imputed</div>
                  <div className="text-lg font-bold text-blue-800">{previewData.summary.imputed_cells}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-[11px] text-amber-600 font-medium">Values Clamped</div>
                  <div className="text-lg font-bold text-amber-800">{previewData.summary.clamped_values}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="text-[11px] text-purple-600 font-medium">Dates Normalized</div>
                  <div className="text-lg font-bold text-purple-800">{previewData.summary.standardized_dates}</div>
                </div>
              </div>

              {/* Audit Log Breakdown */}
              {previewData.summary.audit_log.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-36 overflow-y-auto space-y-1.5 text-[11px]">
                  <div className="font-bold text-slate-700 mb-1">Audit Trail of Simulated Repairs:</div>
                  {previewData.summary.audit_log.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-600">
                      <span>• {entry.description}</span>
                      <span className="font-mono text-indigo-600 font-semibold">{entry.affected_count} affected</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

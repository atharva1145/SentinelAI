import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  AlertTriangle,
  Info,
  CheckCircle2,
  TrendingDown,
  Layers,
  Sparkles,
  BarChart,
  HelpCircle,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { AnomalyResult } from '../types';

interface AnomaliesPageProps {
  datasetId: number | null;
}

export const AnomaliesPage: React.FC<AnomaliesPageProps> = ({ datasetId }) => {
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAnomaliesOnly, setFilterAnomaliesOnly] = useState(true);

  useEffect(() => {
    if (!datasetId) return;
    setLoading(true);
    apiClient
      .getDatasetAnomalies(datasetId, { page_size: 200 })
      .then((res) => setAnomalies(res.items || []))
      .catch((err) => console.error('Failed to load anomalies', err))
      .finally(() => setLoading(false));
  }, [datasetId]);

  const displayedList = filterAnomaliesOnly
    ? anomalies.filter((a) => a.is_anomaly)
    : anomalies;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div>
        <div className="flex items-center gap-2">
          <span className="p-2 bg-violet-100 text-violet-700 rounded-xl">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Machine Learning Anomaly Detection Studio
            </h2>
            <p className="text-xs text-slate-500">
              Scikit-learn Isolation Forest pipeline with feature-level statistical z-score explanations.
            </p>
          </div>
        </div>
      </div>

      {/* Critical Methodological Note */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 text-xs text-amber-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-950">
          <Info className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Architectural &amp; ML Methodology Notice</span>
        </div>
        <p className="leading-relaxed text-amber-800">
          <strong>Important:</strong> An unusual record is not necessarily an incorrect, malicious, or fraudulent record. 
          The Isolation Forest model measures multivariate statistical isolation in continuous feature space. 
          The feature deviations presented below represent empirical z-scores relative to dataset baselines—they provide 
          interpretable context on which dimensions triggered isolation, and should be distinguished from formal causal or SHAP explanations.
        </p>
      </div>

      {/* Baseline Evaluation Card (from offline synthetic benchmark) */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-indigo-400 uppercase">
              Offline Benchmark Evaluation
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Synthetic Benchmark Performance (Contamination = 5.0%)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Random State: 42 • Unsupervised</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
          <div>
            <span className="text-xs text-slate-400">ROC AUC Score</span>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">0.9368</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Ranking discriminability</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Anomaly F1-Score</span>
            <p className="text-2xl font-bold text-indigo-400 mt-0.5">0.6070</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Harmonic precision/recall</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Precision (Anomaly)</span>
            <p className="text-2xl font-bold text-white mt-0.5">60.4%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Flagged txns truly anomalous</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Recall (Anomaly)</span>
            <p className="text-2xl font-bold text-white mt-0.5">61.0%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">True injected anomalies caught</p>
          </div>
        </div>
      </div>

      {/* Controls & Filter */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filterAnomaliesOnly}
              onChange={(e) => setFilterAnomaliesOnly(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            Show only flagged anomalies (is_anomaly = true)
          </label>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing <strong>{displayedList.length}</strong> records
        </span>
      </div>

      {/* Anomaly Records Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto mb-2" />
            Loading anomaly model outputs...
          </div>
        ) : displayedList.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No records match this view. Run &quot;Detect ML Anomalies&quot; on the dataset detail page to evaluate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Row Index</th>
                  <th className="py-3 px-4">Decision Score</th>
                  <th className="py-3 px-4">Prediction Flag</th>
                  <th className="py-3 px-4">Feature Statistical Deviations (|z-score| &gt; 1.5)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {displayedList.map((item) => {
                  let contribs: Record<string, number> = {};
                  if (item.feature_contributions_json) {
                    try {
                      contribs = JSON.parse(item.feature_contributions_json);
                    } catch {
                      // ignore
                    }
                  }

                  const extremeDeviations = Object.entries(contribs).filter(
                    ([_, z]) => Math.abs(z) >= 1.5
                  );

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        #{item.row_index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span
                          className={`font-bold ${
                            item.anomaly_score > 0.1 ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {item.anomaly_score.toFixed(4)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.is_anomaly ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                            FLAGGED ANOMALY
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                            NORMAL
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {extremeDeviations.length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">
                            No single feature &gt; 1.5&sigma; (multivariate isolation)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {extremeDeviations.map(([feature, z]) => (
                              <div
                                key={feature}
                                className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono flex items-center gap-1.5"
                              >
                                <span className="font-semibold text-slate-700">{feature}:</span>
                                <span
                                  className={`font-bold ${
                                    Math.abs(z) >= 3 ? 'text-red-600' : 'text-amber-600'
                                  }`}
                                >
                                  {z > 0 ? `+${z.toFixed(2)}σ` : `${z.toFixed(2)}σ`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

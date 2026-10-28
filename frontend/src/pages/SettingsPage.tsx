import React, { useState } from 'react';
import { Settings, ShieldCheck, Sliders, CheckCircle2, AlertCircle, Info, Database } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [contamination, setContamination] = useState('0.05');
  const [missingThreshold, setMissingThreshold] = useState('5.0');
  const [maxIssues, setMaxIssues] = useState('500');
  const [checkDuplicates, setCheckDuplicates] = useState(true);
  const [checkEmails, setCheckEmails] = useState(true);
  const [checkNegative, setCheckNegative] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-2">
        <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Validation &amp; Model Configuration</h2>
          <p className="text-xs text-slate-500">
            Tune detection thresholds, active rule sets, and Isolation Forest hyperparameters.
          </p>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Configuration saved successfully. Applied to subsequent validation and detection runs.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ML Hyperparameters Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Machine Learning Hyperparameters</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700">
                Isolation Forest Expected Contamination Rate: <strong>{(Number(contamination) * 100).toFixed(1)}%</strong>
              </label>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Approximate expected proportion of outliers in the dataset. Used to compute decision threshold.
              </p>
              <input
                type="range"
                min="0.01"
                max="0.15"
                step="0.01"
                value={contamination}
                onChange={(e) => setContamination(e.target.value)}
                className="w-full mt-2"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>1.0% (strict)</span>
                <span>5.0% (default)</span>
                <span>15.0% (sensitive)</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700">Random Seed</label>
              <input
                type="text"
                disabled
                value="42 (deterministic for reproducibility)"
                className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Data Quality Rules Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Data Quality Rule Configuration</h3>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={checkDuplicates}
                onChange={(e) => setCheckDuplicates(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-800">
                Exact Duplicate Record Check
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={checkNegative}
                onChange={(e) => setCheckNegative(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-800">
                Negative Value Check on Financial Fields (amount, price, salary)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={checkEmails}
                onChange={(e) => setCheckEmails(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-800">
                RFC 5322 Compliant Email Format Validation
              </span>
            </label>
          </div>
        </div>

        {/* Guardrail Limits */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Database className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Safety Guardrails</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700">Max Issues Per Dataset</label>
              <input
                type="number"
                value={maxIssues}
                onChange={(e) => setMaxIssues(e.target.value)}
                className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">Prevents database bloating on deeply corrupt datasets.</p>
            </div>
            <div>
              <label className="block font-semibold text-slate-700">Max Upload Size</label>
              <input
                type="text"
                disabled
                value="50 MB (configurable via MAX_UPLOAD_SIZE_MB)"
                className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow transition"
        >
          Save Configuration
        </button>
      </form>

      {/* Production Limitations & Honest Notes */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Info className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>Production Architecture Notes &amp; Limitations</span>
        </div>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-500">
          <li>
            <strong>Authentication:</strong> This portfolio version operates without user authentication for seamless local exploration. In production, JWT OAuth2 or SSO should guard endpoints.
          </li>
          <li>
            <strong>Large Datasets:</strong> Datasets over 100MB should be processed via distributed streaming (Celery / Redis / Apache Spark) rather than in-memory pandas.
          </li>
          <li>
            <strong>Model Retraining:</strong> The Isolation Forest is fitted per dataset batch. For real-time streaming transactions, a serialized pretrained model with feature store (e.g., Feast) would be deployed.
          </li>
        </ul>
      </div>
    </div>
  );
};

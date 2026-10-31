import React from 'react';
import { Award, ShieldCheck, FileCheck, CheckCircle2, AlertTriangle, AlertOctagon, Printer } from 'lucide-react';
import type { HealthScoreData } from '../types';

interface HealthScoreCardProps {
  scoreData: HealthScoreData | null;
  loading?: boolean;
  onViewCertificate?: () => void;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({
  scoreData,
  loading = false,
  onViewCertificate,
}) => {
  if (loading || !scoreData) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="h-16 bg-slate-100 rounded mb-4" />
        <div className="grid grid-cols-4 gap-2">
          <div className="h-8 bg-slate-100 rounded" />
          <div className="h-8 bg-slate-100 rounded" />
          <div className="h-8 bg-slate-100 rounded" />
          <div className="h-8 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  const { overall_score, grade, status_label, color, dimensions, metrics } = scoreData;

  const getGradeBadge = () => {
    switch (grade) {
      case 'A':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-emerald-500/20';
      case 'B':
        return 'bg-blue-50 text-blue-700 border-blue-300 ring-blue-500/20';
      case 'C':
        return 'bg-amber-50 text-amber-700 border-amber-300 ring-amber-500/20';
      case 'D':
        return 'bg-orange-50 text-orange-700 border-orange-300 ring-orange-500/20';
      default:
        return 'bg-rose-50 text-rose-700 border-rose-300 ring-rose-500/20';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black border-2 ring-4 ${getGradeBadge()}`}
          >
            <span className="text-2xl leading-none">{grade}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Grade</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Data Quality Health Index</h3>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${color}15`, color: color }}
              >
                {status_label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-dimensional score evaluated across Completeness, Validity, Uniqueness, and Anomaly Integrity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-3xl font-extrabold tracking-tight" style={{ color: color }}>
              {overall_score}
              <span className="text-xs font-medium text-slate-400"> / 100</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Composite Score</div>
          </div>

          {onViewCertificate && (
            <button
              onClick={onViewCertificate}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-2 cursor-pointer shrink-0"
              title="Generate printable executive compliance audit certificate"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Audit Certificate</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Core Quality Dimensions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Completeness</span>
            <span className="font-bold text-slate-900">{dimensions.completeness}%</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${dimensions.completeness}%` }}
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Validity & Schema</span>
            <span className="font-bold text-slate-900">{dimensions.validity}%</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${dimensions.validity}%` }}
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Uniqueness</span>
            <span className="font-bold text-slate-900">{dimensions.uniqueness}%</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${dimensions.uniqueness}%` }}
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Anomaly-Free</span>
            <span className="font-bold text-slate-900">{dimensions.anomaly_free}%</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${dimensions.anomaly_free}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

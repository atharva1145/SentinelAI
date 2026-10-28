import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  BrainCircuit,
  History,
  Settings,
  ShieldCheck,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'upload'
  | 'datasets'
  | 'issues'
  | 'anomalies'
  | 'history'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  datasetCount?: number;
  issueCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  datasetCount,
  issueCount,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'upload' as NavTab, label: 'Upload Dataset', icon: UploadCloud },
    { id: 'datasets' as NavTab, label: 'Datasets & Profiles', icon: FileSpreadsheet, badge: datasetCount },
    { id: 'issues' as NavTab, label: 'Quality Issues', icon: AlertTriangle, badge: issueCount },
    { id: 'anomalies' as NavTab, label: 'ML Anomalies', icon: BrainCircuit },
    { id: 'history' as NavTab, label: 'Processing History', icon: History },
    { id: 'settings' as NavTab, label: 'Rule Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen text-slate-300">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="h-9 w-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
            Sentinel<span className="text-indigo-400">AI</span>
          </span>
          <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Data Quality & Anomaly ML</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Platform
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400">Isolation Forest ML</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-semibold border border-emerald-500/20">
            Active
          </span>
        </div>
        <p className="text-[11px] text-slate-400">v1.0.0 • Python 3.12 + FastAPI</p>
      </div>
    </aside>
  );
};

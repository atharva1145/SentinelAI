import React from 'react';
import type { Severity } from '../types';

interface SeverityBadgeProps {
  severity: Severity | string;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const sev = severity.toLowerCase();
  
  const styles: Record<string, string> = {
    critical: 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-200/50',
    high: 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-200/50',
    medium: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-200/50',
    low: 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-200/50',
  };

  const currentStyle = styles[sev] || 'bg-slate-50 text-slate-700 border-slate-200';
  const sizeStyle = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center rounded-full border uppercase tracking-wider font-semibold ${sizeStyle} ${currentStyle}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
        sev === 'critical' ? 'bg-red-500' :
        sev === 'high' ? 'bg-orange-500' :
        sev === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
      }`} />
      {severity}
    </span>
  );
};

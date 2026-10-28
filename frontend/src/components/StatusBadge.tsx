import React from 'react';
import type { IssueStatus } from '../types';

interface StatusBadgeProps {
  status: IssueStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const st = status.toLowerCase();

  const styles: Record<string, string> = {
    open: 'bg-rose-50 text-rose-700 border-rose-200',
    investigating: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ignored: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const currentStyle = styles[st] || 'bg-slate-50 text-slate-700 border-slate-200';
  const sizeStyle = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center rounded-md border capitalize font-medium ${sizeStyle} ${currentStyle}`}>
      {status}
    </span>
  );
};

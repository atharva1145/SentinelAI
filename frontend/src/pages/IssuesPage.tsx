import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldAlert,
  ChevronRight,
  Send,
  History as HistoryIcon,
  X,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { Issue, InvestigationNote, AuditEvent, Severity, IssueStatus } from '../types';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';

interface IssuesPageProps {
  datasetId: number | null;
  onRefreshStats: () => void;
}

export const IssuesPage: React.FC<IssuesPageProps> = ({ datasetId, onRefreshStats }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [detectorFilter, setDetectorFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Issue for Drawer/Modal
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [notes, setNotes] = useState<InvestigationNote[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const fetchIssues = async () => {
    if (!datasetId) return;
    setLoading(true);
    try {
      const res = await apiClient.getDatasetIssues(datasetId, {
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        detector: detectorFilter || undefined,
        page_size: 100,
      });
      setIssues(res.items || []);
    } catch (err) {
      console.error('Failed to load issues', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [datasetId, severityFilter, statusFilter, detectorFilter]);

  const openDrawer = async (issue: Issue) => {
    setSelectedIssue(issue);
    setStatusFeedback(null);
    try {
      const [notesRes, auditRes] = await Promise.all([
        apiClient.getIssueNotes(issue.id),
        apiClient.getIssueAudit(issue.id),
      ]);
      setNotes(notesRes);
      setAuditEvents(auditRes);
    } catch (err) {
      console.error('Failed to load issue details', err);
    }
  };

  const handleUpdateStatus = async (newStatus: IssueStatus) => {
    if (!selectedIssue) return;
    setUpdatingStatus(true);
    setStatusFeedback(null);
    try {
      const updated = await apiClient.updateIssue(selectedIssue.id, {
        status: newStatus,
        author: 'data_analyst',
      });
      setSelectedIssue(updated);
      setIssues((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setStatusFeedback(`Status changed to ${newStatus}`);

      // Refresh audit trail
      const auditRes = await apiClient.getIssueAudit(selectedIssue.id);
      setAuditEvents(auditRes);
      onRefreshStats();
    } catch (err: any) {
      setStatusFeedback('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !newNoteContent.trim()) return;
    setSavingNote(true);
    try {
      await apiClient.updateIssue(selectedIssue.id, {
        note: newNoteContent.trim(),
        author: 'data_analyst',
      });
      setNewNoteContent('');
      // Refresh notes & audit
      const [notesRes, auditRes] = await Promise.all([
        apiClient.getIssueNotes(selectedIssue.id),
        apiClient.getIssueAudit(selectedIssue.id),
      ]);
      setNotes(notesRes);
      setAuditEvents(auditRes);
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setSavingNote(false);
    }
  };

  const filteredIssues = issues.filter((iss) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (iss.column_name && iss.column_name.toLowerCase().includes(q)) ||
      iss.rule_name.toLowerCase().includes(q) ||
      iss.explanation.toLowerCase().includes(q) ||
      (iss.actual_value && iss.actual_value.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Issue Investigation Studio</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track, investigate, annotate, and resolve findings with a full persistent audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchIssues}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search rule, column, value..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-56"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>

          {/* Detector Filter */}
          <select
            value={detectorFilter}
            onChange={(e) => setDetectorFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none"
          >
            <option value="">All Detectors</option>
            <option value="rule_based">Rule Based</option>
            <option value="isolation_forest">Isolation Forest</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredIssues.length}</strong> findings
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto mb-2" />
            Loading findings...
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No issues match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Row</th>
                  <th className="py-3 px-4">Column</th>
                  <th className="py-3 px-4">Rule / Detector</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Actual Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Explanation</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => openDrawer(issue)}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-slate-400 font-mono">#{issue.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {issue.row_index !== null ? `#${issue.row_index + 1}` : 'Global'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{issue.column_name ?? 'Dataset'}</td>
                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-medium">{issue.rule_name}</span>
                      <span className="block text-[10px] text-slate-400 capitalize">{issue.detector.replace('_', ' ')}</span>
                    </td>
                    <td className="py-3 px-4">
                      <SeverityBadge severity={issue.severity} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800">
                      {issue.actual_value === null ? (
                        <span className="text-slate-400 italic">null</span>
                      ) : (
                        <span className="truncate max-w-[120px] inline-block">{issue.actual_value}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={issue.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={issue.explanation}>
                      {issue.explanation}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs text-indigo-600 group-hover:translate-x-0.5 inline-block transition-transform">
                        Investigate →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Investigation Drawer / Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 transition-opacity">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">Issue #{selectedIssue.id}</span>
                  <SeverityBadge severity={selectedIssue.severity} size="sm" />
                  <StatusBadge status={selectedIssue.status} size="sm" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{selectedIssue.rule_name}</h3>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Status Update Banner */}
              {statusFeedback && (
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
                  {statusFeedback}
                </div>
              )}

              {/* Status Action Controls */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Change Resolution Status
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(['open', 'investigating', 'resolved', 'ignored'] as IssueStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(st)}
                      disabled={updatingStatus || selectedIssue.status === st}
                      className={`px-3 py-1.5 rounded-lg font-medium text-xs capitalize transition ${
                        selectedIssue.status === st
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Finding Specification Details */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                  Finding Details
                </h4>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400">Affected Column</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{selectedIssue.column_name ?? 'Dataset-wide'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Row Index</span>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {selectedIssue.row_index !== null ? `Record #${selectedIssue.row_index + 1}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Actual Value</span>
                    <p className="font-mono font-semibold text-red-600 mt-0.5">
                      {selectedIssue.actual_value === null ? '<null>' : selectedIssue.actual_value}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Expected Condition</span>
                    <p className="font-semibold text-emerald-700 mt-0.5">{selectedIssue.expected_condition}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Diagnostic Explanation</span>
                  <p className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/60 text-slate-800 leading-relaxed">
                    {selectedIssue.explanation}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Suggested Corrective Action</span>
                  <p className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-200/60 text-indigo-900 leading-relaxed">
                    {selectedIssue.suggested_action}
                  </p>
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                    Investigation Notes ({notes.length})
                  </h4>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {notes.length === 0 ? (
                    <p className="text-slate-400 italic text-xs">No investigation notes recorded yet.</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-semibold text-slate-700">{note.author}</span>
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Add an investigation note..."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !newNoteContent.trim()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-medium text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    Save Note
                  </button>
                </form>
              </div>

              {/* Audit Trail Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <HistoryIcon className="h-3.5 w-3.5 text-slate-600" />
                  Audit Trail
                </h4>

                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {auditEvents.length === 0 ? (
                    <p className="text-slate-400 italic text-xs">No audit events recorded.</p>
                  ) : (
                    auditEvents.map((evt) => (
                      <div key={evt.id} className="text-[11px] p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{evt.action}</span>
                          {evt.old_value && evt.new_value && (
                            <span className="text-slate-500 ml-1">
                              ({evt.old_value} → {evt.new_value})
                            </span>
                          )}
                          <span className="text-slate-400 block text-[10px]">by {evt.actor}</span>
                        </div>
                        <span className="text-slate-400 text-[10px]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

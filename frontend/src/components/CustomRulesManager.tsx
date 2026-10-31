import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle, Sliders, ShieldCheck, Tag } from 'lucide-react';
import { apiClient } from '../api/client';
import type { CustomRule, CustomRuleCreate, Severity } from '../types';
import { SeverityBadge } from './SeverityBadge';

interface CustomRulesManagerProps {
  datasetId?: number;
  availableColumns?: string[];
  onRulesChanged?: () => void;
}

export const CustomRulesManager: React.FC<CustomRulesManagerProps> = ({
  datasetId,
  availableColumns = [],
  onRulesChanged,
}) => {
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [columnName, setColumnName] = useState(availableColumns[0] || '');
  const [ruleType, setRuleType] = useState<string>('between');
  const [minVal, setMinVal] = useState<string>('0');
  const [maxVal, setMaxVal] = useState<string>('10000');
  const [allowedSet, setAllowedSet] = useState<string>('APPROVED, PENDING, COMPLETED');
  const [regexPattern, setRegexPattern] = useState<string>('^[A-Z0-9_-]+$');
  const [severity, setSeverity] = useState<Severity>('high');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getCustomRules(datasetId);
      setRules(data);
    } catch (err) {
      console.error('Failed to load custom rules', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [datasetId]);

  useEffect(() => {
    if (availableColumns.length > 0 && !columnName) {
      setColumnName(availableColumns[0]);
    }
  }, [availableColumns]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Rule name is required.');
      return;
    }
    if (!columnName.trim()) {
      setErrorMsg('Target column is required.');
      return;
    }

    let params: Record<string, any> = {};
    if (ruleType === 'between') {
      params = {
        min: minVal !== '' ? parseFloat(minVal) : null,
        max: maxVal !== '' ? parseFloat(maxVal) : null,
      };
    } else if (ruleType === 'in_set') {
      const items = allowedSet.split(',').map((s) => s.trim()).filter(Boolean);
      if (items.length === 0) {
        setErrorMsg('Please specify at least one allowed value.');
        return;
      }
      params = { allowed: items };
    } else if (ruleType === 'regex') {
      if (!regexPattern.trim()) {
        setErrorMsg('Regex pattern cannot be empty.');
        return;
      }
      params = { pattern: regexPattern.trim() };
    }

    try {
      const payload: CustomRuleCreate = {
        name: name.trim(),
        column_name: columnName.trim(),
        rule_type: ruleType,
        parameters_json: JSON.stringify(params),
        severity: severity,
        is_active: true,
        dataset_id: datasetId || null,
      };

      await apiClient.createCustomRule(payload);
      setName('');
      setIsCreating(false);
      await fetchRules();
      if (onRulesChanged) onRulesChanged();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create custom rule.');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      await apiClient.deleteCustomRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      if (onRulesChanged) onRulesChanged();
    } catch (err) {
      console.error('Failed to delete rule', err);
    }
  };

  const handleToggleRule = async (rule: CustomRule) => {
    try {
      const updated = await apiClient.updateCustomRule(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      if (onRulesChanged) onRulesChanged();
    } catch (err) {
      console.error('Failed to toggle rule', err);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Custom Validation Rules Studio</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Define domain-specific validation constraints evaluated automatically during dataset validation runs.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isCreating ? 'Cancel' : 'Add New Rule'}</span>
        </button>
      </div>

      {/* Creation Form */}
      {isCreating && (
        <form onSubmit={handleCreateRule} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="font-bold text-xs text-slate-900 uppercase tracking-wider">Configure New Custom Rule</div>
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Valid Transaction Range"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Column</label>
              {availableColumns.length > 0 ? (
                <select
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium focus:outline-none focus:border-indigo-500 text-xs font-mono"
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. amount, status"
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium focus:outline-none focus:border-indigo-500 text-xs font-mono"
                />
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Constraint Type</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value="between">Numeric Range (Between Min & Max)</option>
                <option value="in_set">Allowed Categories (In Set)</option>
                <option value="regex">Pattern Matching (Regex)</option>
                <option value="not_null">Mandatory Field (Not Null)</option>
              </select>
            </div>
          </div>

          {/* Conditional Constraint Fields */}
          <div className="pt-2 text-xs">
            {ruleType === 'between' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Minimum Permitted Value</label>
                  <input
                    type="number"
                    step="any"
                    value={minVal}
                    onChange={(e) => setMinVal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Maximum Permitted Value</label>
                  <input
                    type="number"
                    step="any"
                    value={maxVal}
                    onChange={(e) => setMaxVal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {ruleType === 'in_set' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Allowed Category Values (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. APPROVED, PENDING, REJECTED"
                  value={allowedSet}
                  onChange={(e) => setAllowedSet(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {ruleType === 'regex' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Regular Expression Pattern</label>
                <input
                  type="text"
                  placeholder="e.g. ^ACC-[0-9]{6}$"
                  value={regexPattern}
                  onChange={(e) => setRegexPattern(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">Violation Severity:</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-medium text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Save & Activate Rule
            </button>
          </div>
        </form>
      )}

      {/* Rules List Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading custom rules...</div>
        ) : rules.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No custom rules configured yet. Click <span className="font-bold text-indigo-600">Add New Rule</span> above to create your first domain check.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Rule Name</th>
                <th className="py-2.5 px-3">Target Column</th>
                <th className="py-2.5 px-3">Constraint Specification</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => {
                let spec = '';
                try {
                  const p = JSON.parse(rule.parameters_json || '{}');
                  if (rule.rule_type === 'between') {
                    spec = `Range: [${p.min ?? '-∞'}, ${p.max ?? '+∞'}]`;
                  } else if (rule.rule_type === 'in_set') {
                    spec = `Allowed: ${(p.allowed || []).join(', ')}`;
                  } else if (rule.rule_type === 'regex') {
                    spec = `Regex: ${p.pattern}`;
                  } else if (rule.rule_type === 'not_null') {
                    spec = 'Must not be null';
                  }
                } catch {
                  spec = rule.rule_type;
                }

                return (
                  <tr key={rule.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleRule(rule)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                          rule.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{rule.name}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-700">{rule.column_name}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{spec}</td>
                    <td className="py-2.5 px-3">
                      <SeverityBadge severity={rule.severity} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

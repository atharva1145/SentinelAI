import axios from 'axios';
import type {
  Dataset,
  Issue,
  InvestigationNote,
  AuditEvent,
  AnomalyResult,
  DashboardStats,
  TrendPoint,
  PaginatedResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = {
  // Health
  async getHealth(): Promise<{ status: string; version: string; database: string }> {
    const res = await api.get('/health');
    return res.data;
  },

  // Datasets
  async uploadDataset(file: File): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<Dataset>('/api/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async loadDemoDataset(): Promise<Dataset> {
    const res = await api.post<Dataset>('/api/datasets/demo');
    return res.data;
  },

  async getDatasets(page = 1, pageSize = 20): Promise<PaginatedResponse<Dataset>> {
    const res = await api.get<PaginatedResponse<Dataset>>('/api/datasets', {
      params: { page, page_size: pageSize },
    });
    return res.data;
  },

  async getDataset(id: number): Promise<Dataset> {
    const res = await api.get<Dataset>(`/api/datasets/${id}`);
    return res.data;
  },

  async validateDataset(id: number): Promise<{ job_id: number; status: string; issues_found: number; message: string }> {
    const res = await api.post(`/api/datasets/${id}/validate`);
    return res.data;
  },

  async detectAnomalies(
    id: number,
    algorithm: string = 'isolation_forest',
    contamination: number = 0.05
  ): Promise<{ job_id: number; status: string; anomalies_detected: number; message: string; algorithm?: string }> {
    const res = await api.post(`/api/datasets/${id}/detect-anomalies`, null, {
      params: { algorithm, contamination },
    });
    return res.data;
  },

  async getDatasetDrift(
    id: number,
    baselineId?: number
  ): Promise<{
    has_drift: boolean;
    drift_share: number;
    drifted_features_count: number;
    total_features_evaluated: number;
    current_dataset_id: number;
    current_filename: string;
    baseline_dataset_id: number;
    baseline_filename: string;
    features: Array<{
      column: string;
      ks_statistic: number;
      p_value: number;
      wasserstein_distance: number;
      current_mean: number;
      baseline_mean: number;
      is_drifted: boolean;
    }>;
  }> {
    const res = await api.get(`/api/datasets/${id}/drift`, {
      params: baselineId ? { baseline_id: baselineId } : undefined,
    });
    return res.data;
  },

  async getDatasetIssues(
    id: number,
    params?: {
      page?: number;
      page_size?: number;
      severity?: string;
      column_name?: string;
      detector?: string;
      status?: string;
    }
  ): Promise<PaginatedResponse<Issue>> {
    const res = await api.get<PaginatedResponse<Issue>>(`/api/datasets/${id}/issues`, {
      params,
    });
    return res.data;
  },

  async getDatasetAnomalies(
    id: number,
    params?: { page?: number; page_size?: number }
  ): Promise<PaginatedResponse<AnomalyResult>> {
    const res = await api.get<PaginatedResponse<AnomalyResult>>(`/api/datasets/${id}/anomalies`, {
      params,
    });
    return res.data;
  },

  getReportDownloadUrl(datasetId: number): string {
    const base = API_BASE_URL || window.location.origin;
    return `${base}/api/datasets/${datasetId}/report`;
  },

  getCleanDownloadUrl(datasetId: number): string {
    const base = API_BASE_URL || window.location.origin;
    return `${base}/api/datasets/${datasetId}/export-clean`;
  },

  getQuarantineDownloadUrl(datasetId: number): string {
    const base = API_BASE_URL || window.location.origin;
    return `${base}/api/datasets/${datasetId}/export-quarantine`;
  },

  // Issues
  async getIssue(id: number): Promise<Issue> {
    const res = await api.get<Issue>(`/api/issues/${id}`);
    return res.data;
  },

  async updateIssue(
    id: number,
    payload: { status?: string; note?: string; author?: string }
  ): Promise<Issue> {
    const res = await api.patch<Issue>(`/api/issues/${id}`, payload);
    return res.data;
  },

  async getIssueNotes(id: number): Promise<InvestigationNote[]> {
    const res = await api.get<InvestigationNote[]>(`/api/issues/${id}/notes`);
    return res.data;
  },

  async getIssueAudit(id: number): Promise<AuditEvent[]> {
    const res = await api.get<AuditEvent[]>(`/api/issues/${id}/audit`);
    return res.data;
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await api.get<DashboardStats>('/api/dashboard/stats');
    return res.data;
  },

  async getDashboardTrends(): Promise<TrendPoint[]> {
    const res = await api.get<{ issues_by_day?: TrendPoint[] } | TrendPoint[]>('/api/dashboard/trends');
    if (res.data && typeof res.data === 'object' && 'issues_by_day' in res.data && Array.isArray((res.data as any).issues_by_day)) {
      return (res.data as any).issues_by_day;
    }
    return Array.isArray(res.data) ? res.data : [];
  },
};

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'ignored';
export type DetectorType = 'rule_based' | 'isolation_forest';

export interface ColumnProfile {
  name: string;
  dtype: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
  unique_pct: number;
  sample_values: (string | number | boolean | null)[];
  // Numeric stats
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  std?: number | null;
  median?: number | null;
  q25?: number | null;
  q75?: number | null;
  // String stats
  min_length?: number | null;
  max_length?: number | null;
  avg_length?: number | null;
  // Distributions
  histogram?: { bin: string; count: number }[];
  top_categories?: { value: string; count: number; pct: number }[];
}

export interface DatasetProfile {
  row_count: number;
  column_count: number;
  duplicate_row_count: number;
  memory_usage_bytes: number;
  quality_score?: number | null;
  completeness_score?: number | null;
  uniqueness_score?: number | null;
  columns: ColumnProfile[];
  preview_rows: Record<string, any>[];
}

export interface Dataset {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  row_count: number | null;
  column_count: number | null;
  status: string;
  error_message: string | null;
  profile_json: string | null;
  uploaded_at: string;
  processed_at: string | null;
  profile?: DatasetProfile;
}

export interface Issue {
  id: number;
  dataset_id: number;
  job_id: number | null;
  row_index: number | null;
  column_name: string | null;
  detector: DetectorType;
  rule_name: string;
  actual_value: string | null;
  expected_condition: string;
  severity: Severity;
  status: IssueStatus;
  explanation: string;
  suggested_action: string;
  created_at: string;
  updated_at: string;
}

export interface InvestigationNote {
  id: number;
  issue_id: number;
  author: string;
  content: string;
  created_at: string;
}

export interface AuditEvent {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  actor: string;
  timestamp: string;
}

export interface AnomalyResult {
  id: number;
  dataset_id: number;
  job_id: number;
  row_index: number;
  anomaly_score: number;
  is_anomaly: boolean;
  feature_contributions_json: string | null;
  feature_contributions?: Record<string, number>;
}

export interface ProcessingJob {
  id: number;
  dataset_id: number;
  job_type: 'validate' | 'detect_anomalies';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  result_summary_json: string | null;
}

export interface SeverityCount {
  severity: Severity;
  count: number;
}

export interface TrendPoint {
  day: string;
  count: number;
}

export interface DashboardStats {
  total_datasets: number;
  total_records: number;
  total_issues: number;
  total_anomalies: number;
  severity_distribution: SeverityCount[];
  recent_datasets: Dataset[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

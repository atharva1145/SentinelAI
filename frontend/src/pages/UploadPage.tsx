import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { Dataset, DatasetProfile } from '../types';

interface UploadPageProps {
  onUploadSuccess: (dataset: Dataset) => void;
  onNavigate: (tab: any, datasetId?: number) => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onUploadSuccess, onNavigate }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedDataset, setUploadedDataset] = useState<Dataset | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    setError(null);
    try {
      const dataset = await apiClient.loadDemoDataset();
      setUploadedDataset(dataset);
      if (dataset.profile) {
        setProfile(dataset.profile);
      } else if (dataset.profile_json) {
        try {
          setProfile(JSON.parse(dataset.profile_json));
        } catch {
          // ignore
        }
      }
      onUploadSuccess(dataset);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load demo dataset');
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      validateAndSetFile(selected);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Invalid file format. Please upload a standard CSV file (.csv).');
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB maximum upload limit.');
      return;
    }
    if (f.size === 0) {
      setError('Uploaded file is empty.');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const dataset = await apiClient.uploadDataset(file);
      setUploadedDataset(dataset);
      if (dataset.profile) {
        setProfile(dataset.profile);
      } else if (dataset.profile_json) {
        try {
          const parsed = JSON.parse(dataset.profile_json);
          setProfile(parsed);
        } catch {
          // ignore
        }
      }
      onUploadSuccess(dataset);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed. Check server logs.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dataset Ingestion & Auto-Profiling</h2>
        <p className="text-xs text-slate-500 mt-1">
          Upload any CSV transaction or tabular dataset. The platform automatically validates structure, computes statistical profiles, and prepares features for ML anomaly detection.
        </p>
      </div>

      {/* Upload Box */}
      {!uploadedDataset ? (
        <div className="space-y-5">
          {/* 1-Click Demo Loader */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-indigo-950 text-sm">Want to test the platform instantly?</p>
                <p className="mt-0.5 text-indigo-800">
                  Load the synthetic benchmark dataset (2,010 transactions with injected outliers, missing amounts, negative prices, and velocity spikes) with 1 click.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLoadDemo}
              disabled={loadingDemo || uploading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {loadingDemo ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Loading Demo Data...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Load Demo Dataset (1-Click)
                </>
              )}
            </button>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/60'
                : file
                ? 'border-emerald-300 bg-emerald-50/20'
                : 'border-slate-300 hover:border-indigo-400 bg-white'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className={`p-4 rounded-2xl ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {file ? <FileCheck className="h-8 w-8" /> : <UploadCloud className="h-8 w-8" />}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-900">
                  {file ? file.name : 'Click to select or drag and drop a CSV file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB • Ready to upload`
                    : 'Standard CSV files up to 50MB (UTF-8 encoded)'}
                </p>
              </div>

              {!file && (
                <div className="pt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition">
                    Browse Local Files
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {file && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setError(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Uploading & Profiling...
                  </>
                ) : (
                  <>
                    Upload & Ingest Dataset
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Quick Tip / Sample Data Suggestion */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Synthetic Portfolio Dataset Available</p>
              <p className="mt-0.5 text-slate-500">
                You can upload the included <code>data/synthetic/transactions.csv</code> (2,010 transactions with realistic outliers, missing values, duplicates, and category anomalies) to test the platform immediately.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Post-Upload Success State & Immediate Profile View */
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  {uploadedDataset.original_filename} successfully ingested and profiled!
                </h3>
                <p className="text-xs text-emerald-800">
                  {uploadedDataset.row_count?.toLocaleString()} records • {uploadedDataset.column_count} columns • {(uploadedDataset.file_size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setUploadedDataset(null);
                  setProfile(null);
                  setFile(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm"
              >
                Upload Another
              </button>
              <button
                onClick={() => onNavigate('dataset-detail', uploadedDataset.id)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
              >
                View Full Dataset Detail
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          {profile && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Rows</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{profile.row_count.toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Columns</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{profile.column_count}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duplicate Rows</p>
                <p className={`text-xl font-bold mt-1 ${profile.duplicate_row_count > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {profile.duplicate_row_count}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Memory Footprint</p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {(profile.memory_usage_bytes / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Next Recommended Actions</h4>
              <p className="text-xs text-slate-500">Run quality rule validation and ML Isolation Forest on this dataset.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate('dataset-detail', uploadedDataset.id)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow flex items-center gap-2"
              >
                Go to Validation & ML Studio →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { DatasetDetailPage } from './pages/DatasetDetailPage';
import { IssuesPage } from './pages/IssuesPage';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { apiClient } from './api/client';
import type { Dataset, DashboardStats, TrendPoint } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [health, setHealth] = useState<{ status: string; version: string; database: string } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch initial dashboard stats, datasets, and health
  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthRes, datasetsRes, statsRes, trendsRes] = await Promise.allSettled([
        apiClient.getHealth(),
        apiClient.getDatasets(1, 100),
        apiClient.getDashboardStats(),
        apiClient.getDashboardTrends(),
      ]);

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (datasetsRes.status === 'fulfilled') {
        const items = datasetsRes.value.items || [];
        setDatasets(items);
        if (items.length > 0 && selectedDatasetId === null) {
          setSelectedDatasetId(items[0].id);
        }
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoadingStats(false);
      setIsRefreshing(false);
    }
  }, [selectedDatasetId]);

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleNavigate = (tab: NavTab | 'dataset-detail', datasetId?: number) => {
    if (tab === 'dataset-detail' && datasetId) {
      setSelectedDatasetId(datasetId);
      setCurrentTab('datasets');
    } else {
      setCurrentTab(tab as NavTab);
      if (datasetId) {
        setSelectedDatasetId(datasetId);
      }
    }
  };

  const handleUploadSuccess = (newDataset: Dataset) => {
    setDatasets((prev) => [newDataset, ...prev]);
    setSelectedDatasetId(newDataset.id);
    refreshAllData();
  };

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'Executive Overview', subtitle: 'Real-time data quality & transaction integrity metrics' };
      case 'upload':
        return { title: 'Upload & Profile Dataset', subtitle: 'Upload CSV datasets with automatic schema and null profiling' };
      case 'datasets':
        return { title: 'Dataset Details & Profiling Studio', subtitle: 'Explore column profiles, preview data, and trigger analysis' };
      case 'issues':
        return { title: 'Data Quality Issue Management', subtitle: 'Investigate, annotate, and resolve rule violations' };
      case 'anomalies':
        return { title: 'Isolation Forest Anomaly Exploration', subtitle: 'Unsupervised ML anomaly scoring with feature z-scores' };
      case 'history':
        return { title: 'Batch Processing History', subtitle: 'Audit log of all dataset ingestion and validation runs' };
      case 'settings':
        return { title: 'Rule & Model Settings', subtitle: 'Configure thresholds, validation checks, and ML parameters' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Permanent Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        datasetCount={datasets.length}
        issueCount={stats?.total_issues}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title={title}
          subtitle={subtitle}
          health={health}
          datasets={datasets}
          selectedDatasetId={selectedDatasetId}
          onSelectDataset={(id) => setSelectedDatasetId(id)}
          onRefresh={refreshAllData}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 pb-16">
          {currentTab === 'dashboard' && (
            <DashboardPage
              stats={stats}
              trends={trends}
              loading={loadingStats}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'upload' && (
            <UploadPage
              onUploadSuccess={handleUploadSuccess}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'datasets' && (
            selectedDatasetId ? (
              <DatasetDetailPage
                key={selectedDatasetId}
                datasetId={selectedDatasetId}
                onNavigate={handleNavigate}
                onRefreshStats={refreshAllData}
              />
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No dataset selected.</p>
                <button
                  onClick={() => setCurrentTab('upload')}
                  className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs"
                >
                  Upload your first dataset
                </button>
              </div>
            )
          )}

          {currentTab === 'issues' && (
            <IssuesPage
              datasetId={selectedDatasetId}
              onRefreshStats={refreshAllData}
            />
          )}

          {currentTab === 'anomalies' && (
            <AnomaliesPage datasetId={selectedDatasetId} />
          )}

          {currentTab === 'history' && (
            <HistoryPage
              datasets={datasets}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default App;

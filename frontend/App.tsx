import React, { useEffect, useState } from 'react';
import { Layout, ViewType } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { HierarchyTree } from './components/HierarchyTree';
import { CidrPlanner } from './components/CidrPlanner';
import { GceInventory } from './components/GceInventory';
import { CidrAllocations } from './components/CidrAllocations';
import { FirewallInspector } from './components/FirewallInspector';
import { LoadBalancerInventory } from './components/LoadBalancerInventory';
import { CloudArmorInventory } from './components/CloudArmorInventory';
import { NetworkPeeringMap } from './components/NetworkPeeringMap';
import { RouteExplorer } from './components/RouteExplorer';
import { ConnectivityAnalyzer } from './components/ConnectivityAnalyzer';
import { IamExplorer } from './components/IamExplorer';
import { GkeInventory } from './components/GkeInventory';
import { GkeWorkloads } from './components/GkeWorkloads';
import { GkeServices } from './components/GkeServices';
import { GkeStorage } from './components/GkeStorage';
import { GkeConfiguration } from './components/GkeConfiguration';
import { CommandPalette } from './components/CommandPalette';
import { ServiceAccounts } from './components/ServiceAccounts';
import { fetchInventory, fetchScan, startScan, type ScanRecord } from './services/api';
import { GcpProject } from './types';

function App() {
  const [projects, setProjects] = useState<GcpProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [selectedServiceAccountId, setSelectedServiceAccountId] = useState<string>('');
  const [scanId, setScanId] = useState<string>('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'queued' | 'running' | 'partial' | 'success' | 'failed'>('idle');
  const [scanErrors, setScanErrors] = useState<{ projectId: string; error: string }[]>([]);
  const [lastScannedAt, setLastScannedAt] = useState<string>('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const resolveLastScannedAt = (projectData: GcpProject[], fallback: string): string => {
    const latest = projectData
      .map((project) => project.lastScannedAt)
      .filter((value) => value)
      .sort()
      .at(-1);
    return latest || fallback;
  };

  // Navigation State
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  // Global Project Filter State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const pollScanUntilFinished = async (id: string): Promise<ScanRecord> => {
    const maxPolls = 240;
    for (let poll = 0; poll < maxPolls; poll++) {
      const result = await fetchScan(id);
      setScanStatus(result.status);
      setScanErrors(result.errors);

      if (result.status === 'queued' || result.status === 'running') {
        const total = result.totalProjects > 0 ? result.totalProjects : '?';
        setLoadingProgress(`Scanning projects (${result.completedProjects}/${total})...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      return result;
    }

    throw new Error('Scan timed out after 8 minutes.');
  };

  const runScanAndLoadData = async (accountId: string) => {
    setLoading(true);
    setLoadingProgress('Queueing project scan...');
    setScanErrors([]);
    setProjects([]);

    try {
      const scan = await startScan(accountId, 'project');
      setScanId(scan.scanId);
      setScanStatus(scan.status);

      const finalScan = await pollScanUntilFinished(scan.scanId);

      if (finalScan.status === 'failed') {
        const fallback = await fetchInventory(accountId);
        setProjects(fallback);
        setLastScannedAt(resolveLastScannedAt(fallback, new Date().toISOString()));
        setLoadingProgress('Scan failed. Showing latest available inventory.');
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else {
        const finalProjects = finalScan.projects.length > 0 ? finalScan.projects : await fetchInventory(accountId);
        setProjects(finalProjects);
        setScanErrors(finalScan.errors);
        setLastScannedAt(resolveLastScannedAt(finalProjects, finalScan.completedAt || new Date().toISOString()));
        setLoadingProgress('');
      }
    } catch (error) {
      console.error('Failed to scan GCP data:', error);
      setLoadingProgress('Failed to fetch data');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setLoadingProgress('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedAccountId = localStorage.getItem('selectedServiceAccountId');
    if (!storedAccountId) {
      return;
    }
    setSelectedServiceAccountId(storedAccountId);
    runScanAndLoadData(storedAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCommandNavigate = (view: ViewType, projectId?: string) => {
    setCurrentView(view);
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  };

  const handleServiceAccountChange = (accountId: string) => {
    setSelectedServiceAccountId(accountId);
    setSelectedProjectId('all');
    localStorage.setItem('selectedServiceAccountId', accountId);
    runScanAndLoadData(accountId);
  };

  const handleExportClick = () => {
    setIsExportModalOpen(true);
    // 這裡可以加入匯出邏輯
  };

  const renderContent = () => {
    switch (currentView) {
      case 'service_accounts': return <ServiceAccounts onSelectAccount={handleServiceAccountChange} />;
      case 'dashboard': return (
        <Dashboard
          projects={projects}
          selectedProjectId={selectedProjectId}
          scanStatus={scanStatus}
          scanId={scanId}
          scanErrors={scanErrors}
          lastScannedAt={lastScannedAt}
        />
      );
      case 'topology': return <HierarchyTree projects={projects} selectedProjectId={selectedProjectId} />;
      case 'peering': return <NetworkPeeringMap projects={projects} />;
      case 'allocations': return <CidrAllocations projects={projects} selectedProjectId={selectedProjectId} />;
      case 'gce': return <GceInventory projects={projects} selectedProjectId={selectedProjectId} />;
      case 'gke_clusters': return <GkeInventory projects={projects} selectedProjectId={selectedProjectId} />;
      case 'gke_workloads': return <GkeWorkloads projects={projects} selectedProjectId={selectedProjectId} />;
      case 'gke_services': return <GkeServices projects={projects} selectedProjectId={selectedProjectId} />;
      case 'gke_storage': return <GkeStorage projects={projects} selectedProjectId={selectedProjectId} />;
      case 'gke_config': return <GkeConfiguration projects={projects} selectedProjectId={selectedProjectId} />;
      case 'loadbalancer': return <LoadBalancerInventory projects={projects} selectedProjectId={selectedProjectId} />;
      case 'cloudarmor': return <CloudArmorInventory projects={projects} selectedProjectId={selectedProjectId} />;
      case 'firewall': return <FirewallInspector projects={projects} selectedProjectId={selectedProjectId} />;
      case 'cidr': return <CidrPlanner projects={projects} />;
      case 'routes': return <RouteExplorer projects={projects} selectedProjectId={selectedProjectId} />;
      case 'connectivity': return <ConnectivityAnalyzer projects={projects} />;
      case 'iam': return <IamExplorer projects={projects} selectedProjectId={selectedProjectId} />;
      default: return <div>View not found</div>;
    }
  };

  return (
    <>
      <Layout
        currentView={currentView}
        onViewChange={setCurrentView}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
      >
        {loading ? (
          <div className="h-full bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-500">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-800 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <span className="font-medium text-lg text-slate-300">
              {loadingProgress || 'Loading GCP Inventory...'}
            </span>
          </div>
        ) : projects.length === 0 && !selectedServiceAccountId && currentView !== 'service_accounts' ? (
          <div className="h-full bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-500">
            <div className="text-center p-8">
              <h2 className="text-2xl font-bold text-white mb-4">No Service Account Selected</h2>
              <p className="text-slate-400 mb-6">Please add a GCP service account to view your network data.</p>
              <button
                onClick={() => setCurrentView('service_accounts')}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Manage Service Accounts
              </button>
            </div>
          </div>
        ) : (
          <div className="relative h-full">
            {/* 匯出按鈕可以放在這裡或 Layout 內 */}
            <div className="absolute bottom-8 right-8 z-50">
              <button
                onClick={handleExportClick}
                className="px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/50 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Data
              </button>
            </div>
            {renderContent()}
          </div>
        )}
      </Layout>

      {!loading && <CommandPalette projects={projects} onNavigate={handleCommandNavigate} />}
    </>
  );
}

export default App;

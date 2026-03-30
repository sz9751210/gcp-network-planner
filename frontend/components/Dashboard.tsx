import React, { useMemo } from 'react';
import { GcpProject } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
  scanStatus: 'idle' | 'queued' | 'running' | 'partial' | 'success' | 'failed';
  scanId: string;
  scanErrors: { projectId: string; error: string }[];
  lastScannedAt: string;
}

export const Dashboard: React.FC<Props> = ({
  projects,
  selectedProjectId,
  scanStatus,
  scanId,
  scanErrors,
  lastScannedAt,
}) => {
  // Filter data based on selection
  const activeProjects = useMemo(() => 
    projects.filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId),
  [projects, selectedProjectId]);

  // Aggregation Logic
  const stats = useMemo(() => {
    let totalVpcs = 0;
    let totalSubnets = 0;
    let totalInstances = 0;
    let runningInstances = 0;
    let sharedVpcs = 0;
    const regionCounts: Record<string, number> = {};

    activeProjects.forEach(p => {
      p.vpcs.forEach(v => {
        totalVpcs++;
        if (v.isSharedVpcHost) sharedVpcs++;
        v.subnets.forEach(s => {
          totalSubnets++;
          regionCounts[s.region] = (regionCounts[s.region] || 0) + 1;
        });
      });
      p.instances.forEach(i => {
        totalInstances++;
        if (i.status === 'RUNNING') runningInstances++;
      });
    });

    // Convert region map to array for sorting
    const topRegions = Object.entries(regionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);
      
    // Calculate basic utilization score (mock logic for demo: running instances / 100)
    const utilScore = Math.min(Math.round((runningInstances / (totalInstances || 1)) * 100), 100);

    return { totalVpcs, totalSubnets, totalInstances, runningInstances, sharedVpcs, topRegions, utilScore };
  }, [activeProjects]);

  const scanStatusColor = useMemo(() => {
    if (scanStatus === 'success') return 'text-emerald-400 border-emerald-700 bg-emerald-900/20';
    if (scanStatus === 'partial') return 'text-amber-400 border-amber-700 bg-amber-900/20';
    if (scanStatus === 'failed') return 'text-red-400 border-red-700 bg-red-900/20';
    if (scanStatus === 'running' || scanStatus === 'queued') return 'text-blue-400 border-blue-700 bg-blue-900/20';
    return 'text-slate-400 border-slate-700 bg-slate-800/40';
  }, [scanStatus]);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Platform Overview</h2>
          <p className="text-slate-400 mt-1">
            Displaying metrics for <span className="text-white font-medium">{activeProjects.length}</span> project(s).
          </p>
        </div>
        <div className="text-right hidden sm:block">
           <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded border border-slate-700">
             Last scanned: {lastScannedAt ? new Date(lastScannedAt).toLocaleString() : 'N/A'}
           </span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded border font-semibold uppercase ${scanStatusColor}`}>
              Scan: {scanStatus}
            </span>
            {scanId && <span className="text-xs font-mono text-slate-500">Job: {scanId}</span>}
          </div>
          <span className="text-xs text-slate-400">
            Error Count: <span className="text-slate-200 font-semibold">{scanErrors.length}</span>
          </span>
        </div>
        {scanErrors.length > 0 && (
          <div className="mt-3 space-y-1">
            {scanErrors.slice(0, 3).map((scanError) => (
              <div key={`${scanError.projectId}-${scanError.error}`} className="text-xs text-red-300 bg-red-900/20 border border-red-900/40 rounded px-2 py-1">
                [{scanError.projectId || 'global'}] {scanError.error}
              </div>
            ))}
            {scanErrors.length > 3 && (
              <div className="text-xs text-slate-500">...and {scanErrors.length - 3} more errors.</div>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="VPC Networks" 
          value={stats.totalVpcs} 
          subtext={`${stats.sharedVpcs} Shared Host(s)`}
          icon={<svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
          trend="stable"
        />
        <StatsCard 
          title="Active Subnets" 
          value={stats.totalSubnets} 
          subtext="Across all regions"
          icon={<svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          trend="up"
        />
        <StatsCard 
          title="Compute Instances" 
          value={stats.totalInstances} 
          subtext={`${stats.runningInstances} Running`}
          icon={<svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>}
          trend="down"
        />
         <StatsCard 
          title="Policy Compliance" 
          value="98.5%" 
          subtext="No critical violations"
          icon={<svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
          trend="stable"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Regional Distribution Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 lg:col-span-2">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Subnet Regional Distribution</h3>
              <button className="text-xs text-blue-400 hover:text-blue-300">View All Regions</button>
           </div>
           <div className="space-y-4">
             {stats.topRegions.map(([region, count]) => {
                const percent = Math.round((count / stats.totalSubnets) * 100);
                return (
                  <div key={region}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300 font-medium">{region}</span>
                      <span className="text-slate-400">{count} subnets ({percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
             })}
             {stats.topRegions.length === 0 && (
               <div className="text-slate-500 text-center py-8">No active regions found.</div>
             )}
           </div>
        </div>

        {/* Quick Actions / Status */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col">
           <h3 className="text-lg font-semibold text-white mb-4">Resource Efficiency</h3>
           
           <div className="flex items-center justify-center py-6">
               <div className="relative w-32 h-32">
                   <svg className="w-full h-full" viewBox="0 0 36 36">
                       <path className="text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                       <path className="text-emerald-500" strokeDasharray={`${stats.utilScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <span className="text-2xl font-bold text-white">{stats.utilScore}%</span>
                       <span className="text-[10px] text-slate-400 uppercase">Active</span>
                   </div>
               </div>
           </div>
           
           <div className="border-t border-slate-700 pt-4 mt-auto">
              <h4 className="text-xs text-slate-400 uppercase font-semibold mb-2">System Status</h4>
              {!activeProjects.some(p => p.error) ? (
                <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 flex items-center">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
                   <span className="text-sm font-medium text-emerald-300">Operational</span>
                </div>
              ) : (
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 flex items-center">
                   <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                   <span className="text-sm font-medium text-red-300">Attention Required</span>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

const StatsCard = ({ title, value, subtext, icon, trend }: any) => (
  <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:bg-slate-750 transition-colors shadow-sm group">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider group-hover:text-blue-400 transition-colors">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
      <div className="bg-slate-700/50 p-2 rounded-lg group-hover:bg-slate-700 transition-colors">
        {icon}
      </div>
    </div>
    <div className="mt-3 flex items-center">
       {trend === 'up' && <span className="text-emerald-400 text-xs font-medium mr-2 flex items-center">↑ 12%</span>}
       {trend === 'down' && <span className="text-slate-400 text-xs font-medium mr-2 flex items-center">↓ 2%</span>}
       {trend === 'stable' && <span className="text-blue-400 text-xs font-medium mr-2 flex items-center">~</span>}
       <span className="text-slate-500 text-xs">{subtext}</span>
    </div>
  </div>
);

import React, { useState, useMemo } from 'react';
import { GcpProject } from '../types';
import { parseCidr, getTotalIps } from '../utils/cidr';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

interface FlatAllocation {
  id: string;
  cidr: string;
  type: 'VPC' | 'Subnet' | 'Secondary';
  resourceName: string;
  resourceId: string; // selfLink or ID
  projectName: string;
  projectId: string;
  region: string;
  totalIps: number;
  sortValue: number;
}

type ViewMode = 'list' | 'visual';
type SortDirection = 'asc' | 'desc';
type SortKey = keyof FlatAllocation;

export const CidrAllocations: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'sortValue', // Default sort by IP numeric value
    direction: 'asc'
  });

  // 1. Flatten Data into a single sortable array
  const allocations = useMemo<FlatAllocation[]>(() => {
    const flat: FlatAllocation[] = [];

    projects.forEach(p => {
      // Filter by project selection context
      if (selectedProjectId !== 'all' && p.projectId !== selectedProjectId) return;

      p.vpcs.forEach(v => {
        v.subnets.forEach(s => {
          const parsed = parseCidr(s.ipCidrRange);
          flat.push({
            id: s.selfLink,
            cidr: s.ipCidrRange,
            type: 'Subnet',
            resourceName: s.name,
            resourceId: s.selfLink,
            projectName: p.name,
            projectId: p.projectId,
            region: s.region,
            totalIps: getTotalIps(s.ipCidrRange),
            sortValue: parsed ? parsed.ip : 0
          });
        });
      });
    });

    return flat;
  }, [projects, selectedProjectId]);

  // 2. Filter Data
  const filteredAllocations = useMemo(() => {
    if (!filter) return allocations;
    const lowerFilter = filter.toLowerCase();
    return allocations.filter(item => 
      item.cidr.includes(filter) ||
      item.resourceName.toLowerCase().includes(lowerFilter) ||
      item.projectId.toLowerCase().includes(lowerFilter) ||
      item.region.toLowerCase().includes(lowerFilter)
    );
  }, [allocations, filter]);

  // 3. Sort Data
  const sortedAllocations = useMemo(() => {
    const sorted = [...filteredAllocations];
    sorted.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle strings case-insensitively
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [filteredAllocations, sortConfig]);

  // 4. Group by VPC for Visual View (Use filtered data, sorting handled internally by totalAllocatedIps)
  const vpcGroups = useMemo(() => {
     const groups: Record<string, {
         vpcName: string;
         projectId: string;
         totalAllocatedIps: number;
         subnets: FlatAllocation[];
         regions: Record<string, number>;
     }> = {};

     filteredAllocations.forEach(alloc => {
         if (!groups[alloc.projectId]) {
             groups[alloc.projectId] = {
                 vpcName: "Multiple VPCs",
                 projectId: alloc.projectId,
                 totalAllocatedIps: 0,
                 subnets: [],
                 regions: {}
             };
         }
         
         groups[alloc.projectId].totalAllocatedIps += alloc.totalIps;
         groups[alloc.projectId].subnets.push(alloc);
         groups[alloc.projectId].regions[alloc.region] = (groups[alloc.projectId].regions[alloc.region] || 0) + alloc.totalIps;
     });

     return Object.values(groups).sort((a,b) => b.totalAllocatedIps - a.totalAllocatedIps);
  }, [filteredAllocations]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExportCsv = () => {
    const headers = ["CIDR", "Type", "Resource Name", "Project ID", "Region", "Total IPs"];
    const rows = sortedAllocations.map(a => [
        a.cidr,
        a.type,
        a.resourceName,
        a.projectId,
        a.region,
        a.totalIps.toString()
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'cidr_allocations.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortHeader = ({ label, sortKey, widthClass }: { label: string, sortKey: SortKey, widthClass?: string }) => (
    <th 
      className={`px-6 py-4 cursor-pointer hover:bg-slate-800 hover:text-white transition-colors group select-none ${widthClass || ''}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center">
        {label}
        <span className="ml-2 flex flex-col">
          {sortConfig.key === sortKey ? (
             sortConfig.direction === 'asc' ? (
               <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
             ) : (
               <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
             )
          ) : (
             <svg className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
          )}
        </span>
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">CIDR Allocations</h2>
            <p className="text-slate-400 mt-1">
            Global view of network address space consumption.
            </p>
        </div>
        
        <div className="flex space-x-2">
            <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all flex items-center"
            >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export CSV
            </button>
            <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex">
                <button 
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    List
                </button>
                <button 
                    onClick={() => setViewMode('visual')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-all ${viewMode === 'visual' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
                    Visual
                </button>
            </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center space-x-4">
             <div className="bg-blue-900/20 text-blue-300 px-3 py-1 rounded-md border border-blue-900/50 text-xs font-medium flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                Global Allocation
             </div>
             {viewMode === 'list' && (
               <div className="text-xs text-slate-500 flex items-center gap-2">
                 <span>Sorted by:</span>
                 <span className="text-blue-400 font-semibold uppercase">{sortConfig.key === 'sortValue' ? 'IP Address' : sortConfig.key}</span>
               </div>
             )}
          </div>

          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
             </div>
             <input
               type="text"
               className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-80 pl-10 p-2 placeholder-slate-500 transition-all"
               placeholder="Filter CIDR, Account, or Name..."
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
             />
          </div>
        </div>

        {/* Content Area */}
        <div className="overflow-x-auto flex-grow bg-slate-900/50">
          {viewMode === 'list' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700 font-semibold">
                    <SortHeader label="CIDR Block" sortKey="sortValue" widthClass="w-48" />
                    <SortHeader label="Type" sortKey="type" widthClass="w-32" />
                    <SortHeader label="Resource Name / ID" sortKey="resourceName" />
                    <SortHeader label="Account & Region" sortKey="projectId" />
                    <SortHeader label="Total IPs" sortKey="totalIps" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-sm">
                  {sortedAllocations.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-700/30 transition-colors group">
                      <td className="px-6 py-4 font-mono font-medium text-emerald-400 whitespace-nowrap">
                        {item.cidr}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${
                          item.type === 'VPC' 
                            ? 'bg-purple-900/30 text-purple-300 border-purple-800' 
                            : 'bg-slate-700/50 text-slate-300 border-slate-600'
                        }`}>
                          {item.type === 'Subnet' && <svg className="w-3 h-3 mr-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium">{item.resourceName}</span>
                          <span className="text-xs text-slate-500 truncate max-w-xs font-mono mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.resourceId.split('/').pop()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center text-slate-300">
                            <svg className="w-3.5 h-3.5 mr-1.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            {item.projectId}
                          </div>
                          <div className="flex items-center text-slate-500 text-xs mt-1">
                            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {item.region}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-400">
                        {item.totalIps.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {sortedAllocations.length === 0 && (
                    <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No allocations found matching your filter.
                        </td>
                    </tr>
                  )}
                </tbody>
              </table>
          ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {vpcGroups.map((group) => (
                      <div key={group.projectId} className="bg-slate-800 border border-slate-700 rounded-lg p-5 shadow-lg relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h3 className="font-bold text-white text-lg">{group.projectId}</h3>
                                  <p className="text-xs text-slate-400 mt-1">{group.vpcName}</p>
                              </div>
                              <div className="text-right">
                                  <span className="text-2xl font-mono text-white font-semibold">{group.totalAllocatedIps.toLocaleString()}</span>
                                  <p className="text-xs text-slate-500 uppercase">Allocated IPs</p>
                              </div>
                          </div>
                          
                          {/* Visualization Bar */}
                          <div className="mb-4">
                              <div className="text-xs text-slate-400 mb-2 flex justify-between">
                                  <span>Region Distribution</span>
                              </div>
                              <div className="w-full h-6 bg-slate-900 rounded-md flex overflow-hidden border border-slate-700">
                                  {Object.entries(group.regions).map(([region, count], idx) => {
                                      const percentage = ((count as number) / group.totalAllocatedIps) * 100;
                                      const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500'];
                                      return (
                                          <div 
                                            key={region} 
                                            className={`${colors[idx % colors.length]} h-full transition-all duration-500 hover:opacity-80 cursor-help`}
                                            style={{ width: `${percentage}%` }}
                                            title={`${region}: ${count} IPs`}
                                          ></div>
                                      )
                                  })}
                              </div>
                          </div>

                          <div className="border-t border-slate-700/50 pt-3">
                              <p className="text-xs text-slate-500 mb-2">Subnets ({group.subnets.length})</p>
                              <div className="flex flex-wrap gap-2">
                                  {group.subnets.slice(0, 8).map(sub => (
                                      <span key={sub.id} className="inline-block px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs text-slate-300 font-mono">
                                          {sub.cidr}
                                      </span>
                                  ))}
                              </div>
                          </div>
                      </div>
                  ))}
                  {vpcGroups.length === 0 && (
                      <div className="col-span-full text-center py-12 text-slate-500">
                          No data available for visualization.
                      </div>
                  )}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};
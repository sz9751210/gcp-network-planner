import React, { useState, useMemo } from 'react';
import { GcpProject, GcpInstance } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

type GroupBy = 'none' | 'zone' | 'vpc';

type InstanceWithProject = GcpInstance & { projectId: string };

export const GceInventory: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [selectedInstance, setSelectedInstance] = useState<GcpInstance | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [search, setSearch] = useState('');

  // 1. Flatten Data
  const allInstances = useMemo<InstanceWithProject[]>(() =>
    projects
      .filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId)
      .flatMap(p => (p.instances || []).map(i => ({ ...i, projectId: p.projectId })))
      .filter(i =>
        search === '' ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.internalIp.includes(search)
      ),
    [projects, selectedProjectId, search]);

  // 2. Group Data
  const groupedData = useMemo<Record<string, InstanceWithProject[]>>(() => {
    if (groupBy === 'none') return { 'All Instances': allInstances };

    const groups: Record<string, InstanceWithProject[]> = {};
    allInstances.forEach(instance => {
      const key = groupBy === 'zone' ? instance.zone : instance.network;
      if (!groups[key]) groups[key] = [];
      groups[key].push(instance);
    });
    // Sort keys
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {} as Record<string, InstanceWithProject[]>);
  }, [allInstances, groupBy]);

  return (
    <>
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Compute Engine Inventory</h2>
            <p className="text-xs text-slate-400 mt-1">Found {allInstances.length} instances</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search name or IP..."
                className="bg-slate-900 border border-slate-600 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-200 w-48"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg className="w-4 h-4 text-slate-500 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="flex items-center bg-slate-900 rounded-md border border-slate-600 p-0.5">
              <span className="text-xs text-slate-500 font-medium px-2">Group By:</span>
              {(['none', 'zone', 'vpc'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setGroupBy(type)}
                  className={`px-3 py-1 text-xs font-medium rounded capitalize transition-colors ${groupBy === type ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  {type === 'vpc' ? 'VPC' : type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto flex-grow bg-slate-900/30">
          {Object.entries(groupedData).map(([groupName, rawInstances]) => {
            const groupInstances = rawInstances as InstanceWithProject[];
            return (
              <div key={groupName} className="mb-4">
                {groupBy !== 'none' && (
                  <div className="px-6 py-2 bg-slate-800/80 border-y border-slate-700 text-sm font-bold text-slate-300 flex items-center sticky top-0">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                    {groupBy === 'vpc' ? 'Network: ' : 'Zone: '} {groupName}
                    <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded-full text-xs font-normal text-slate-400">{groupInstances.length}</span>
                  </div>
                )}

                <table className="w-full text-left border-collapse">
                  {groupBy === 'none' && (
                    <thead>
                      <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                        <th className="px-6 py-4">Instance</th>
                        <th className="px-6 py-4">Project</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4">Network IP</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-slate-700/50 text-sm bg-slate-800/20">
                    {groupInstances.map((instance) => (
                      <tr key={`${instance.projectId}-${instance.id}`} className="hover:bg-slate-700/40 transition-colors group">
                        <td className="px-6 py-3 font-medium text-slate-200">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center mr-3 text-slate-400">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                            </div>
                            <div className="flex flex-col">
                              <span>{instance.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono uppercase">{instance.machineType}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-400">{instance.projectId}</td>
                        <td className="px-6 py-3 text-slate-400">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs text-slate-300">{instance.zone}</span>
                            {groupBy !== 'vpc' && <span className="text-[10px] text-slate-500">{instance.network}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs">{instance.internalIp}</td>
                        <td className="px-6 py-3">
                          <StatusBadge
                            status={instance.status === 'RUNNING' ? 'success' : 'error'}
                            text={instance.status}
                          />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => setSelectedInstance(instance)}
                            className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-700 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {allInstances.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p>No instances found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Reusing Modal logic - kept simple as per request, just copying structure implicitly via component */}
      {selectedInstance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setSelectedInstance(null)}></div>
          <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-600 max-w-lg w-full transform transition-all p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6 border-b border-slate-700 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {selectedInstance.name}
                </h3>
                <p className="text-sm text-slate-400 mt-1 font-mono">ID: {selectedInstance.id}</p>
              </div>
              <button onClick={() => setSelectedInstance(null)} className="text-slate-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-slate-500 uppercase font-semibold">Status</div>
                  <div className="mt-1 font-medium text-slate-200 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selectedInstance.status === 'RUNNING' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                    {selectedInstance.status}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-slate-500 uppercase font-semibold">Zone</div>
                  <div className="mt-1 font-medium text-slate-200">{selectedInstance.zone}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs uppercase text-slate-500 font-semibold mb-2">Network Configuration</h4>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 text-sm space-y-3">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-500">Network</span>
                    <span className="text-slate-300 font-medium">{selectedInstance.network}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-500">Subnetwork</span>
                    <span className="text-slate-300">{selectedInstance.subnetwork}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Internal IP</span>
                    <span className="text-emerald-400 font-mono font-bold">{selectedInstance.internalIp}</span>
                  </div>
                  {selectedInstance.externalIp && (
                    <div className="flex justify-between pt-2 border-t border-slate-800">
                      <span className="text-slate-500">External IP</span>
                      <span className="text-blue-400 font-mono">{selectedInstance.externalIp}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedInstance.tags.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase text-slate-500 font-semibold mb-2">Network Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedInstance.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-blue-900/20 text-blue-300 border border-blue-800/50 text-xs rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setSelectedInstance(null)} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors shadow-lg">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
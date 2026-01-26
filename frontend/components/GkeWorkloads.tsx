import React, { useState, useMemo } from 'react';
import { GcpProject, GkeWorkload } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const GkeWorkloads: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('all');

  const allWorkloads = useMemo(() => {
    return projects
      .filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId)
      .flatMap(p => 
        (p.gkeClusters || []).flatMap(cluster => 
          (cluster.workloads || []).map(w => ({
            ...w,
            clusterName: cluster.name,
            location: cluster.location,
            projectId: p.projectId
          }))
        )
      );
  }, [projects, selectedProjectId]);

  const namespaces = useMemo(() => {
    const ns = new Set(allWorkloads.map(w => w.namespace));
    return Array.from(ns).sort();
  }, [allWorkloads]);

  const filteredWorkloads = useMemo(() => {
    return allWorkloads.filter(w => {
       const matchesText = filter === '' ||
         w.name.toLowerCase().includes(filter.toLowerCase());
       
       const matchesNs = selectedNamespace === 'all' || w.namespace === selectedNamespace;
       
       return matchesText && matchesNs;
    });
  }, [allWorkloads, filter, selectedNamespace]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Kubernetes Workloads</h2>
          <p className="text-slate-400 mt-1">
            Deployments, StatefulSets, DaemonSets, and Jobs across all clusters.
          </p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
           <div className="flex items-center space-x-2">
             <span className="text-xs text-slate-500">
               Showing {filteredWorkloads.length} workloads
             </span>
           </div>

           <div className="flex items-center gap-3">
             {/* Namespace Filter */}
             <div className="relative group">
                <div className="flex items-center space-x-2 bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5">
                  <span className="text-xs text-slate-400 uppercase font-bold">Namespace</span>
                  <select
                    value={selectedNamespace}
                    onChange={(e) => setSelectedNamespace(e.target.value)}
                    className="appearance-none bg-transparent text-white text-sm focus:outline-none min-w-[100px] cursor-pointer"
                  >
                    <option value="all">All</option>
                    {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                  </select>
                </div>
             </div>

             <div className="relative">
               <input
                 type="text"
                 className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-64 pl-9 p-2 placeholder-slate-500 transition-all"
                 placeholder="Filter by name..."
                 value={filter}
                 onChange={(e) => setFilter(e.target.value)}
               />
               <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
           </div>
        </div>

        {/* Content */}
        <div className="overflow-x-auto flex-grow bg-slate-900/50">
           <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700 font-semibold">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Namespace</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Pods</th>
                  <th className="px-6 py-4">Cluster</th>
                  <th className="px-6 py-4">Images</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
               {filteredWorkloads.map((workload, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/30 transition-colors group">
                     <td className="px-6 py-4">
                        <StatusBadge status={workload.status === 'OK' ? 'success' : workload.status === 'Warning' ? 'warning' : 'error'} text={workload.status} />
                     </td>
                     <td className="px-6 py-4 font-medium text-slate-200">
                        {workload.name}
                     </td>
                     <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                        {workload.namespace}
                     </td>
                     <td className="px-6 py-4 text-slate-300 text-xs">
                        {workload.type}
                     </td>
                     <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                        {workload.pods}
                     </td>
                     <td className="px-6 py-4 text-slate-400 text-xs">
                        <div className="font-semibold text-slate-300">{workload.clusterName}</div>
                        <div className="text-[10px]">{workload.location}</div>
                     </td>
                     <td className="px-6 py-4 text-slate-500 text-[10px] max-w-xs truncate font-mono">
                        {workload.images.join(', ')}
                     </td>
                  </tr>
               ))}
               
               {filteredWorkloads.length === 0 && (
                  <tr>
                     <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No workloads found matching criteria.
                     </td>
                  </tr>
               )}
            </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};
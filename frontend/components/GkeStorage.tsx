import React, { useState, useMemo } from 'react';
import { GcpProject } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const GkeStorage: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'PVCs' | 'StorageClasses'>('PVCs');

  const { allPvcs, allStorageClasses } = useMemo(() => {
    const pvcs = [];
    const scs = [];

    const filteredProjects = projects.filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId);

    for (const p of filteredProjects) {
      if (!p.gkeClusters) continue;
      for (const c of p.gkeClusters) {
        if (c.pvcs) {
          pvcs.push(...c.pvcs.map(item => ({
            ...item,
            clusterName: c.name,
            location: c.location,
            projectId: p.projectId
          })));
        }
        if (c.storageClasses) {
          scs.push(...c.storageClasses.map(item => ({
            ...item,
            clusterName: c.name,
            location: c.location,
            projectId: p.projectId
          })));
        }
      }
    }
    
    // Apply text filter
    const fLower = filter.toLowerCase();
    return {
        allPvcs: pvcs.filter(item => item.name.toLowerCase().includes(fLower) || item.namespace.toLowerCase().includes(fLower)),
        allStorageClasses: scs.filter(item => item.name.toLowerCase().includes(fLower) || item.provisioner.toLowerCase().includes(fLower))
    };

  }, [projects, selectedProjectId, filter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Kubernetes Storage</h2>
          <p className="text-slate-400 mt-1">
            Persistent storage resources and storage class definitions.
          </p>
        </div>
        <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex">
            <button 
                onClick={() => setActiveTab('PVCs')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'PVCs' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
                PVCs
            </button>
            <button 
                onClick={() => setActiveTab('StorageClasses')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'StorageClasses' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
                Storage Classes
            </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
           <div className="flex items-center space-x-2">
             <span className="text-xs text-slate-500">
               Showing {activeTab === 'PVCs' ? allPvcs.length : allStorageClasses.length} items
             </span>
           </div>

           <div className="relative">
             <input
               type="text"
               className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 pl-10 p-2 placeholder-slate-500 transition-all"
               placeholder="Filter..."
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
             />
             <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
        </div>

        {/* Content */}
        <div className="overflow-x-auto flex-grow bg-slate-900/50">
           <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700 font-semibold">
                  <th className="px-6 py-4">Name</th>
                  {activeTab === 'PVCs' && <th className="px-6 py-4">Status</th>}
                  {activeTab === 'PVCs' && <th className="px-6 py-4">Namespace</th>}
                  {activeTab === 'PVCs' && <th className="px-6 py-4">Capacity</th>}
                  {activeTab === 'PVCs' && <th className="px-6 py-4">Volume</th>}
                  {activeTab === 'StorageClasses' && <th className="px-6 py-4">Provisioner</th>}
                  {activeTab === 'StorageClasses' && <th className="px-6 py-4">Reclaim Policy</th>}
                  <th className="px-6 py-4">Cluster</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
               {activeTab === 'PVCs' ? (
                   allPvcs.map((pvc, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors group">
                        <td className="px-6 py-4 font-medium text-slate-200">
                            {pvc.name}
                            <div className="text-xs text-slate-500 mt-0.5">{pvc.storageClass}</div>
                        </td>
                        <td className="px-6 py-4">
                            <StatusBadge status={pvc.status === 'Bound' ? 'success' : pvc.status === 'Pending' ? 'warning' : 'error'} text={pvc.status} />
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                            {pvc.namespace}
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                            {pvc.capacity}
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                            {pvc.volume}
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                            <div className="font-semibold text-slate-300">{pvc.clusterName}</div>
                            <div className="text-[10px]">{pvc.projectId}</div>
                        </td>
                    </tr>
                   ))
               ) : (
                   allStorageClasses.map((sc, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors group">
                        <td className="px-6 py-4 font-medium text-slate-200">
                            {sc.name}
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                            {sc.provisioner}
                        </td>
                        <td className="px-6 py-4 text-slate-300 text-xs">
                            <span className={`px-2 py-0.5 rounded border ${sc.reclaimPolicy === 'Delete' ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-blue-900/20 border-blue-800 text-blue-300'}`}>
                                {sc.reclaimPolicy}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                            <div className="font-semibold text-slate-300">{sc.clusterName}</div>
                            <div className="text-[10px]">{sc.projectId}</div>
                        </td>
                    </tr>
                   ))
               )}
               
               {((activeTab === 'PVCs' && allPvcs.length === 0) || (activeTab === 'StorageClasses' && allStorageClasses.length === 0)) && (
                  <tr>
                     <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No {activeTab === 'PVCs' ? 'Persistent Volume Claims' : 'Storage Classes'} found matching criteria.
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
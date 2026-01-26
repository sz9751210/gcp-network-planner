import React, { useState, useMemo } from 'react';
import { GcpProject, GcpGkeCluster } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
   projects: GcpProject[];
   selectedProjectId: string;
}

type ClusterWithProject = GcpGkeCluster & { projectId: string };

export const GkeInventory: React.FC<Props> = ({ projects, selectedProjectId }) => {
   const [filter, setFilter] = useState('');
   const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

   const allClusters = useMemo<ClusterWithProject[]>(() => {
      return projects
         .filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId)
         .flatMap(p => (p.gkeClusters || []).map(c => ({ ...c, projectId: p.projectId })))
         .filter(c =>
            filter === '' ||
            c.name.toLowerCase().includes(filter.toLowerCase()) ||
            c.location.toLowerCase().includes(filter.toLowerCase()) ||
            c.id.includes(filter)
         );
   }, [projects, selectedProjectId, filter]);

   const toggleExpand = (id: string) => {
      const newSet = new Set(expandedClusters);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedClusters(newSet);
   };

   const getTotalNodes = (cluster: GcpGkeCluster) => {
      return (cluster.nodePools || []).reduce((acc, pool) => acc + pool.nodeCount, 0);
   };

   const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
   };

   return (
      <div className="space-y-6">
         <div className="flex justify-between items-end">
            <div>
               <h2 className="text-2xl font-bold text-white tracking-tight">Kubernetes Clusters (GKE)</h2>
               <p className="text-slate-400 mt-1">
                  Manage container orchestration infrastructure, node pools, and networking.
               </p>
            </div>
         </div>

         <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
               <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">
                     Showing {allClusters.length} clusters
                  </span>
               </div>

               <div className="relative">
                  <input
                     type="text"
                     className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 pl-10 p-2 placeholder-slate-500 transition-all"
                     placeholder="Filter by name, location, or ID..."
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
                        <th className="px-6 py-4 w-8"></th>
                        <th className="px-6 py-4">Cluster Name</th>
                        <th className="px-6 py-4">Project & Location</th>
                        <th className="px-6 py-4">Network</th>
                        <th className="px-6 py-4">IP Ranges (Pod / Svc)</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Nodes</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                     {allClusters.map(cluster => (
                        <React.Fragment key={`${cluster.projectId}-${cluster.id}`}>
                           <tr
                              onClick={() => toggleExpand(cluster.id)}
                              className={`hover:bg-slate-700/30 transition-colors cursor-pointer group ${expandedClusters.has(cluster.id) ? 'bg-slate-800/80' : ''}`}
                           >
                              <td className="px-6 py-4 text-slate-500">
                                 <svg className={`w-4 h-4 transform transition-transform ${expandedClusters.has(cluster.id) ? 'rotate-90 text-blue-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                 </svg>
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-200">
                                 <div className="flex items-center">
                                    <div className="p-2 bg-blue-600/20 rounded mr-3 text-blue-400 border border-blue-600/30">
                                       {/* Kubernetes Icon (Simplified) */}
                                       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="12" cy="12" r="3"></circle>
                                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                       </svg>
                                    </div>
                                    <div className="flex flex-col">
                                       <span>{cluster.name}</span>
                                       {cluster.privateCluster && <span className="text-[10px] text-slate-500 flex items-center"><svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Private</span>}
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-xs">
                                 <div className="text-slate-300">{cluster.projectId}</div>
                                 <div className="text-slate-500 mt-0.5">{cluster.location}</div>
                              </td>
                              <td className="px-6 py-4 text-xs">
                                 <div className="text-slate-300">{cluster.network}</div>
                                 <div className="text-slate-500 font-mono mt-0.5">{cluster.subnetwork}</div>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex flex-col text-xs font-mono">
                                    <span className="text-emerald-400" title="Pod Range">P: {cluster.clusterIpv4Cidr}</span>
                                    <span className="text-blue-400" title="Service Range">S: {cluster.servicesIpv4Cidr}</span>
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <StatusBadge status={cluster.status === 'RUNNING' ? 'success' : cluster.status === 'PROVISIONING' ? 'info' : 'error'} text={cluster.status} />
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <span className="bg-slate-700 text-white px-2 py-1 rounded-md text-xs font-bold border border-slate-600">
                                    {getTotalNodes(cluster)}
                                 </span>
                              </td>
                           </tr>

                           {/* Expanded Details Panel */}
                           {expandedClusters.has(cluster.id) && (
                              <tr className="bg-slate-900/40 border-t border-slate-800">
                                 <td colSpan={7} className="px-6 py-6">
                                    <div className="flex flex-col gap-6">

                                       {/* Top Section: Labels & Connect */}
                                       <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                          <div className="flex-1">
                                             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Labels</h4>
                                             {cluster.labels ? (
                                                <div className="flex flex-wrap gap-2">
                                                   {Object.entries(cluster.labels).map(([k, v]) => (
                                                      <span key={k} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">
                                                         <span className="text-slate-500 mr-1">{k}:</span>{v}
                                                      </span>
                                                   ))}
                                                </div>
                                             ) : (
                                                <span className="text-xs text-slate-500 italic">No labels defined</span>
                                             )}
                                          </div>
                                          <div className="w-full md:w-auto">
                                             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Connect</h4>
                                             <div className="flex items-center bg-slate-950 border border-slate-700 rounded px-3 py-2">
                                                <code className="text-xs font-mono text-slate-300 truncate max-w-[300px]">
                                                   gcloud container clusters get-credentials {cluster.name} --region {cluster.location}
                                                </code>
                                                <button
                                                   onClick={() => copyToClipboard(`gcloud container clusters get-credentials ${cluster.name} --region ${cluster.location} --project ${cluster.projectId}`)}
                                                   className="ml-3 text-slate-500 hover:text-white"
                                                   title="Copy to clipboard"
                                                >
                                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                </button>
                                             </div>
                                          </div>
                                       </div>

                                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                          {/* Column 1: Control Plane Details */}
                                          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-sm">
                                             <h4 className="text-sm font-semibold text-white mb-4 flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                Control Plane
                                             </h4>
                                             <div className="space-y-3 text-sm">
                                                <div className="flex justify-between">
                                                   <span className="text-slate-400">Master Version</span>
                                                   <span className="text-slate-200">{cluster.masterVersion || 'Unknown'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                   <span className="text-slate-400">Endpoint</span>
                                                   <span className="text-slate-200 font-mono">{cluster.endpoint || 'Pending'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                   <span className="text-slate-400">Master CIDR</span>
                                                   <span className="text-slate-200 font-mono">{cluster.masterIpv4Cidr || 'N/A'}</span>
                                                </div>
                                                <div className="border-t border-slate-700 pt-2 mt-2">
                                                   <span className="text-slate-400 block mb-1">Authorized Networks</span>
                                                   <div className="flex flex-wrap gap-1">
                                                      {cluster.masterAuthorizedNetworks?.length ? (
                                                         cluster.masterAuthorizedNetworks.map(net => (
                                                            <span key={net} className="bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">{net}</span>
                                                         ))
                                                      ) : (
                                                         <span className="text-xs text-slate-500 italic">Disabled (0.0.0.0/0)</span>
                                                      )}
                                                   </div>
                                                </div>
                                             </div>
                                          </div>

                                          {/* Column 2: Node Pools */}
                                          <div className="bg-slate-800 rounded-lg border border-slate-700 p-0 overflow-hidden shadow-sm md:col-span-2 flex flex-col">
                                             <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/20">
                                                <h4 className="text-sm font-semibold text-white flex items-center">
                                                   <svg className="w-4 h-4 mr-2 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                                                   Node Pools
                                                </h4>
                                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{cluster.nodePools.length} Pools</span>
                                             </div>
                                             <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                   <thead className="bg-slate-900/50 text-slate-400 uppercase font-semibold">
                                                      <tr>
                                                         <th className="px-4 py-3">Name</th>
                                                         <th className="px-4 py-3">Node Count</th>
                                                         <th className="px-4 py-3">Machine Type</th>
                                                         <th className="px-4 py-3">Version</th>
                                                         <th className="px-4 py-3">Auto-Upgrade</th>
                                                      </tr>
                                                   </thead>
                                                   <tbody className="divide-y divide-slate-700/50">
                                                      {(cluster.nodePools || []).map((pool, idx) => (
                                                         <tr key={idx} className="hover:bg-slate-700/20">
                                                            <td className="px-4 py-3 font-medium text-slate-200">{pool.name}</td>
                                                            <td className="px-4 py-3 text-slate-300">{pool.nodeCount}</td>
                                                            <td className="px-4 py-3 font-mono text-slate-400">{pool.machineType}</td>
                                                            <td className="px-4 py-3 text-slate-400">{pool.version}</td>
                                                            <td className="px-4 py-3">
                                                               <span className="text-emerald-500 font-bold">On</span>
                                                            </td>
                                                         </tr>
                                                      ))}
                                                   </tbody>
                                                </table>
                                             </div>
                                          </div>
                                       </div>

                                       <div className="flex justify-end pt-2">
                                          <a
                                             href={`https://console.cloud.google.com/kubernetes/clusters/details/${cluster.location}/${cluster.name}/details?project=${cluster.projectId}`}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             className="inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                                          >
                                             View full details in Google Cloud Console
                                             <svg className="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                          </a>
                                       </div>

                                    </div>
                                 </td>
                              </tr>
                           )}
                        </React.Fragment>
                     ))}

                     {allClusters.length === 0 && (
                        <tr>
                           <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                              No GKE clusters found matching criteria.
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
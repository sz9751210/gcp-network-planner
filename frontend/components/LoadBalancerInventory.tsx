import React, { useState, useMemo } from 'react';
import { GcpProject } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const LoadBalancerInventory: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [expandedLbs, setExpandedLbs] = useState<Set<string>>(new Set());

  // Helper to generate console URL
  const getConsoleUrl = (projectId: string) => {
     return `https://console.cloud.google.com/net-services/loadbalancing/list/loadBalancers?project=${projectId}`;
  };

  const filteredData = useMemo(() => {
    return projects
      .filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId)
      .flatMap(p => p.loadBalancers.map(lb => ({ ...lb, projectId: p.projectId })))
      .filter(lb => lb.name.toLowerCase().includes(filter.toLowerCase()) || lb.ipAddress.includes(filter));
  }, [projects, selectedProjectId, filter]);

  const toggleExpand = (id: string) => {
      const newSet = new Set(expandedLbs);
      if(newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedLbs(newSet);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Load Balancing Topology</h2>
          <p className="text-slate-400 mt-1">
            Visual inspection of Forwarding Rules, Backend Services, and Health Status.
          </p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
           <div className="flex items-center space-x-2">
             <span className="text-xs text-slate-500">
               Showing {filteredData.length} load balancers
             </span>
           </div>

           <div className="relative">
             <input
               type="text"
               className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 pl-10 p-2 placeholder-slate-500 transition-all"
               placeholder="Filter by name or IP..."
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
             />
             <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
        </div>

        {/* Content Table */}
        <div className="overflow-x-auto flex-grow bg-slate-900/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700 font-semibold">
                <th className="px-6 py-4 w-8"></th>
                <th className="px-6 py-4">Name / ID</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Frontend</th>
                <th className="px-6 py-4">Backends</th>
                <th className="px-6 py-4">Security</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {filteredData.map((item) => (
                <React.Fragment key={`${item.projectId}-${item.id}`}>
                <tr 
                    onClick={() => toggleExpand(item.id)}
                    className={`hover:bg-slate-700/30 transition-colors cursor-pointer group ${expandedLbs.has(item.id) ? 'bg-slate-800/80' : ''}`}
                >
                  <td className="px-6 py-4 text-slate-500">
                      <svg className={`w-4 h-4 transform transition-transform ${expandedLbs.has(item.id) ? 'rotate-90 text-blue-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-200">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-900/20 rounded mr-3 text-blue-400 border border-blue-800/30">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <div>
                            <div>{item.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.forwardingRuleName}</div>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {item.projectId}
                  </td>
                  
                  {/* Type Column */}
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-xs font-mono text-slate-300">
                      {item.type.replace('_', ' ')}
                    </span>
                  </td>

                  {/* LB Specific Columns */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-xs">
                      <span className="text-emerald-400 font-mono font-bold bg-emerald-900/10 px-1.5 rounded w-fit mb-1">{item.ipAddress}:{item.portRange}</span>
                      <span className="text-slate-500">{item.protocol} • {item.region || 'Global'}</span>
                    </div>
                  </td>

                  {/* Backends Column */}
                  <td className="px-6 py-4">
                     <div className="flex flex-col gap-1">
                        {item.backends && item.backends.length > 0 ? (
                           item.backends.slice(0, 2).map((be, i) => (
                             <span key={i} className="flex items-center text-xs text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded border border-slate-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></span>
                                {be}
                             </span>
                           ))
                        ) : (
                           <span className="text-xs text-slate-500 italic">No backends</span>
                        )}
                        {item.backends && item.backends.length > 2 && (
                           <span className="text-[10px] text-slate-500 pl-1">+{item.backends.length - 2} more...</span>
                        )}
                     </div>
                  </td>

                  <td className="px-6 py-4">
                    {item.securityPolicy ? (
                        <span className="flex items-center text-xs text-indigo-300 bg-indigo-900/20 px-2 py-1 rounded border border-indigo-800/50 w-fit">
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        {item.securityPolicy}
                        </span>
                    ) : (
                        <span className="text-slate-600 text-xs italic">No Cloud Armor</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                     <div onClick={(e) => e.stopPropagation()}>
                        <a 
                        href={getConsoleUrl(item.projectId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 hover:text-blue-300 transition-colors"
                        title="Edit in Google Cloud Console"
                        >
                        <span>Console</span>
                        <svg className="w-3 h-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                     </div>
                  </td>
                </tr>
                {/* Visual Topology Row */}
                {expandedLbs.has(item.id) && (
                    <tr className="bg-slate-900/40">
                        <td colSpan={8} className="px-6 py-6">
                            <div className="flex items-start overflow-x-auto pb-4">
                                {/* Step 1: Frontend */}
                                <div className="flex flex-col items-center min-w-[150px]">
                                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg mb-3">
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-slate-300">Frontend</div>
                                        <div className="text-[10px] font-mono text-emerald-400 mt-1">{item.ipAddress}</div>
                                        <div className="text-[10px] text-slate-500">{item.protocol} :{item.portRange}</div>
                                    </div>
                                </div>

                                {/* Connector */}
                                <div className="h-12 w-16 border-t-2 border-dashed border-slate-600 mt-6 relative">
                                    <div className="absolute -top-1.5 right-0 w-3 h-3 bg-slate-600 rounded-full"></div>
                                </div>

                                {/* Step 2: URL Map (Proxy) */}
                                <div className="flex flex-col items-center min-w-[150px]">
                                    <div className="w-12 h-12 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center shadow-md mb-3">
                                       <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-slate-300">Target Proxy / Map</div>
                                        <div className="text-[10px] text-slate-500 mt-1">Default Rule</div>
                                    </div>
                                </div>

                                {/* Connector */}
                                <div className="h-12 w-16 border-t-2 border-dashed border-slate-600 mt-6 relative">
                                    <div className="absolute -top-1.5 right-0 w-3 h-3 bg-slate-600 rounded-full"></div>
                                </div>

                                {/* Step 3: Backend Services */}
                                <div className="flex flex-col space-y-4">
                                    {item.backends.map((backendName: string, idx: number) => (
                                        <div key={idx} className="flex items-center">
                                            <div className="flex flex-col items-center min-w-[180px]">
                                                <div className="p-3 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-between w-full shadow-md group-hover:border-blue-500/50 transition-colors">
                                                    <div className="flex items-center">
                                                        <svg className="w-4 h-4 text-purple-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-200">{backendName}</span>
                                                            <span className="text-[10px] text-slate-500">Instance Group</span>
                                                        </div>
                                                    </div>
                                                    {/* Mock Health Status */}
                                                    <div className="flex items-center ml-4">
                                                        <span className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-green-500' : 'bg-green-500'} mr-1`}></span>
                                                        <span className="text-[10px] text-slate-400">1/1</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
                </React.Fragment>
              ))}
              
              {filteredData.length === 0 && (
                <tr>
                   <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No Load Balancers found matching criteria.
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
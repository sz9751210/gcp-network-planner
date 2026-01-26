import React, { useState, useMemo } from 'react';
import { GcpProject, GcpRoute } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const RouteExplorer: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');

  // Flatten Data
  const allRoutes = useMemo(() => {
    return projects
      .filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId)
      .flatMap(p => 
        p.vpcs.flatMap(v => 
           (v.routes || []).map(r => ({
             ...r,
             projectId: p.projectId,
             vpcName: v.name
           }))
        )
      );
  }, [projects, selectedProjectId]);

  // Unique Networks for dropdown
  const networks = useMemo(() => {
     return Array.from(new Set(allRoutes.map(r => r.vpcName))).sort();
  }, [allRoutes]);

  // Filtering
  const filteredRoutes = useMemo(() => {
     return allRoutes.filter(r => {
        const matchesSearch = 
           r.name.toLowerCase().includes(filter.toLowerCase()) || 
           r.destRange.includes(filter) ||
           r.nextHop.toLowerCase().includes(filter.toLowerCase());
        const matchesNetwork = selectedNetwork === 'all' || r.vpcName === selectedNetwork;
        return matchesSearch && matchesNetwork;
     });
  }, [allRoutes, filter, selectedNetwork]);

  const getRouteType = (nextHop: string) => {
     if (nextHop.toLowerCase().includes('peering')) return 'PEERING';
     if (nextHop.toLowerCase().includes('gateway')) return 'GATEWAY';
     if (nextHop.toLowerCase().includes('vpn')) return 'VPN';
     return 'STATIC';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Route Explorer</h2>
          <p className="text-slate-400 mt-1">
            Analyze effective routes, static paths, and peering next-hops.
          </p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
         {/* Toolbar */}
         <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-col sm:flex-row gap-4 justify-between items-center sticky top-0 z-10 backdrop-blur-md">
            <div className="flex items-center gap-3 w-full sm:w-auto">
               <div className="flex items-center space-x-2 bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5">
                  <span className="text-xs text-slate-400 uppercase font-bold">Network</span>
                  <select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className="appearance-none bg-transparent text-white text-sm focus:outline-none min-w-[120px] cursor-pointer"
                  >
                    <option value="all">All Networks</option>
                    {networks.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
               </div>
               <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
               <div className="text-xs text-slate-400">
                  Showing {filteredRoutes.length} routes
               </div>
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 p-2 placeholder-slate-500 transition-all"
                placeholder="Search destination, hop, or name..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
         </div>

         {/* Table */}
         <div className="overflow-x-auto flex-grow bg-slate-900/50">
           <table className="w-full text-left border-collapse">
             <thead>
               <tr className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700 font-semibold">
                 <th className="px-6 py-4">Name</th>
                 <th className="px-6 py-4">Destination Range</th>
                 <th className="px-6 py-4">Next Hop</th>
                 <th className="px-6 py-4">Priority</th>
                 <th className="px-6 py-4">Network</th>
                 <th className="px-6 py-4">Type</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-700/50 text-sm">
               {filteredRoutes.map(route => {
                  const type = getRouteType(route.nextHop);
                  return (
                    <tr key={`${route.projectId}-${route.id}`} className="hover:bg-slate-700/30 transition-colors">
                       <td className="px-6 py-4 font-medium text-slate-200">
                          {route.name}
                          {route.description && <div className="text-[10px] text-slate-500 mt-0.5">{route.description}</div>}
                       </td>
                       <td className="px-6 py-4 font-mono text-emerald-400">
                          {route.destRange}
                       </td>
                       <td className="px-6 py-4 text-slate-300">
                          {route.nextHop}
                       </td>
                       <td className="px-6 py-4 text-slate-400 font-mono">
                          {route.priority}
                       </td>
                       <td className="px-6 py-4 text-xs text-slate-400">
                          <div className="font-semibold text-slate-300">{route.vpcName}</div>
                          <div>{route.projectId}</div>
                       </td>
                       <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                             type === 'PEERING' ? 'bg-purple-900/30 text-purple-300 border-purple-800' :
                             type === 'GATEWAY' ? 'bg-blue-900/30 text-blue-300 border-blue-800' :
                             'bg-slate-700 text-slate-300 border-slate-600'
                          }`}>
                             {type}
                          </span>
                       </td>
                    </tr>
                  );
               })}
               {filteredRoutes.length === 0 && (
                 <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                       No routes found matching your criteria.
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
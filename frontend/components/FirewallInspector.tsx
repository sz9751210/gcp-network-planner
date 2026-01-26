import React, { useState, useMemo } from 'react';
import { GcpProject, GcpFirewallRule, FirewallPort } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const FirewallInspector: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());

  // 1. Flatten Rules
  const allRules = useMemo(() => {
    return projects
      .filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId)
      .flatMap(p => 
        (p.firewallRules || []).map(rule => ({
          ...rule,
          projectId: p.projectId
        }))
      );
  }, [projects, selectedProjectId]);

  // 2. Extract unique networks for filter
  const networks = useMemo(() => {
    const nets = new Set(allRules.map(r => r.network));
    return Array.from(nets).sort();
  }, [allRules]);

  // 3. Filter Logic
  const filteredRules = useMemo(() => {
    return allRules.filter(rule => {
      const matchText = 
        rule.name.toLowerCase().includes(filter.toLowerCase()) || 
        rule.projectId.toLowerCase().includes(filter.toLowerCase()) ||
        rule.id.includes(filter);
      
      const matchNetwork = selectedNetwork === 'all' || rule.network === selectedNetwork;

      return matchText && matchNetwork;
    });
  }, [allRules, filter, selectedNetwork]);

  // 4. Group by Network (Key: projectId::networkName)
  const groupedRules = useMemo(() => {
    const groups: Record<string, { projectId: string; network: string; rules: typeof allRules }> = {};
    
    filteredRules.forEach(rule => {
      const key = `${rule.projectId}::${rule.network}`;
      if (!groups[key]) {
        groups[key] = { projectId: rule.projectId, network: rule.network, rules: [] };
      }
      groups[key].rules.push(rule);
    });

    // Sort groups by Project then Network
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRules]);

  const toggleExpand = (key: string) => {
    const newSet = new Set(expandedNetworks);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedNetworks(newSet);
  };

  const renderPorts = (ports?: FirewallPort[]) => {
    if (!ports || ports.length === 0) return <span className="text-slate-500">None</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {ports.map((p, idx) => (
          <span key={idx} className="bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-600">
            {p.IPProtocol}{p.ports ? `:${p.ports.join(',')}` : ''}
          </span>
        ))}
      </div>
    );
  };

  const isHighRisk = (rule: GcpFirewallRule) => {
    if (rule.action !== 'ALLOW' || rule.direction !== 'INGRESS') return false;
    const isPublic = rule.sourceRanges?.includes('0.0.0.0/0');
    if (!isPublic) return false;
    
    // Check for risky ports
    const riskyPorts = ['22', '3389', '23', '21'];
    const opensRisky = rule.allowed?.some(a => 
      a.IPProtocol === 'all' || 
      (a.IPProtocol === 'tcp' && a.ports?.some(p => riskyPorts.includes(p)))
    );

    return opensRisky;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Firewall Rules Inspector</h2>
          <p className="text-slate-400 mt-1">
            Audit ingress and egress rules across your VPC networks.
          </p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-col sm:flex-row gap-4 justify-between items-center sticky top-0 z-10 backdrop-blur-md">
           
           <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="relative group">
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
             </div>
             <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
             <div className="text-xs text-slate-400">
               Showing {filteredRules.length} rules
             </div>
           </div>

           <div className="relative w-full sm:w-72">
             <input
               type="text"
               className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 p-2 placeholder-slate-500 transition-all"
               placeholder="Search rule name, ID, or project..."
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
             />
             <svg className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
        </div>

        <div className="overflow-x-auto flex-grow bg-slate-900/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700 font-semibold">
                <th className="px-6 py-4">Priority / Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Targets</th>
                <th className="px-6 py-4">Filters (Source/Dest)</th>
                <th className="px-6 py-4">Protocols / Ports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {groupedRules.map(([key, group]) => {
                const isExpanded = expandedNetworks.has(key);
                const sortedRules = group.rules.sort((a, b) => a.priority - b.priority);
                
                return (
                  <React.Fragment key={key}>
                    {/* Network Group Header */}
                    <tr 
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-slate-800' : 'bg-slate-800/40 hover:bg-slate-700/30'}`}
                      onClick={() => toggleExpand(key)}
                    >
                      <td colSpan={6} className="px-4 py-3 border-l-4 border-l-transparent hover:border-l-blue-500 transition-all">
                        <div className="flex items-center">
                          <button className="mr-3 p-1 rounded-full hover:bg-slate-700 text-slate-400">
                             <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90 text-blue-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                             </svg>
                          </button>
                          
                          <div className="flex items-center space-x-3">
                             <div className="bg-slate-700/50 p-1.5 rounded text-slate-300">
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                             </div>
                             <span className="font-bold text-slate-200">{group.network}</span>
                             <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-0.5 rounded">{group.projectId}</span>
                          </div>

                          <div className="ml-auto flex items-center space-x-2">
                             <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full">{group.rules.length} rules</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Rule Rows */}
                    {isExpanded && sortedRules.map((rule) => {
                      const highRisk = isHighRisk(rule);
                      return (
                        <tr key={`${rule.projectId}-${rule.id}`} className={`hover:bg-slate-700/30 transition-colors ${highRisk ? 'bg-red-900/5' : 'bg-slate-900/20'}`}>
                          <td className="px-6 py-3 pl-12">
                            <div className="flex items-center relative">
                              <div className="absolute -left-6 top-1/2 w-4 h-px bg-slate-700"></div>
                              <span className="font-mono text-xs text-slate-500 mr-2 w-10 text-right">{rule.priority}</span>
                              <div className="flex flex-col">
                                <span className={`font-medium ${highRisk ? 'text-red-300' : 'text-slate-200'}`}>
                                  {rule.name}
                                  {highRisk && <span className="ml-2 text-[10px] bg-red-900 text-red-300 px-1.5 py-0.5 rounded border border-red-700">RISKY</span>}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{rule.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {rule.direction === 'INGRESS' ? (
                              <span className="inline-flex items-center text-xs text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-800/50">
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                Ingress
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs text-amber-300 bg-amber-900/20 px-2 py-0.5 rounded border border-amber-800/50">
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                Egress
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {rule.action === 'ALLOW' ? (
                              <span className="inline-block px-2 py-1 text-xs font-bold text-green-400 bg-green-900/20 rounded border border-green-800/50">ALLOW</span>
                            ) : (
                              <span className="inline-block px-2 py-1 text-xs font-bold text-red-400 bg-red-900/20 rounded border border-red-800/50">DENY</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <div className="text-xs">
                                {rule.targetTags && rule.targetTags.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {rule.targetTags.map(t => (
                                      <span key={t} className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded flex items-center">
                                          <svg className="w-2.5 h-2.5 mr-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                          {t}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic">All instances in network</span>
                                )}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="text-xs font-mono text-slate-300">
                                {rule.sourceRanges && rule.sourceRanges.map(r => (
                                  <div key={r} className={r === '0.0.0.0/0' ? 'text-amber-400 font-bold' : ''}>{r}</div>
                                ))}
                                {rule.sourceTags && rule.sourceTags.map(t => (
                                  <div key={t} className="flex items-center text-slate-400">
                                    <span className="mr-1 opacity-50">tag:</span>{t}
                                  </div>
                                ))}
                                {!rule.sourceRanges && !rule.sourceTags && <span className="text-slate-600">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-xs">
                            {rule.action === 'ALLOW' ? renderPorts(rule.allowed) : renderPorts(rule.denied)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              
              {filteredRules.length === 0 && (
                <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No firewall rules match your filter.
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
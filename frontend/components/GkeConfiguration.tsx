import React, { useState, useMemo } from 'react';
import { GcpProject, GkeConfigMap, GkeSecret } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

interface DetailModalProps {
  item: (GkeConfigMap | GkeSecret) & { projectId: string; clusterName: string; type: 'ConfigMap' | 'Secret' };
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ item, onClose }) => {
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const toggleValue = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-600 max-w-3xl w-full transform transition-all p-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b border-slate-700 pb-4 shrink-0">
          <div>
            <div className="flex items-center space-x-3 mb-1">
               <h3 className="text-xl font-bold text-white">{item.name}</h3>
               <span className={`px-2 py-0.5 rounded text-xs font-medium border ${item.type === 'Secret' ? 'bg-indigo-900/30 text-indigo-300 border-indigo-700' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  {item.type}
               </span>
            </div>
            <div className="text-sm text-slate-400 font-mono">
               Namespace: <span className="text-slate-200">{item.namespace}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-700">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-2 custom-scrollbar">
           {/* Metadata Grid */}
           <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                 <div className="text-xs text-slate-500 uppercase font-semibold">Cluster</div>
                 <div className="mt-1 font-medium text-slate-200">{item.clusterName}</div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                 <div className="text-xs text-slate-500 uppercase font-semibold">Project</div>
                 <div className="mt-1 font-medium text-slate-200">{item.projectId}</div>
              </div>
           </div>

           {/* Data Section */}
           <div>
              <h4 className="text-xs uppercase text-slate-500 font-semibold mb-3">Data</h4>
              {item.data && Object.keys(item.data).length > 0 ? (
                 <div className="space-y-4">
                    {Object.entries(item.data).map(([key, value]) => (
                       <div key={key} className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                          <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                             <span className="font-mono text-xs text-blue-300 font-medium">{key}</span>
                             {item.type === 'Secret' && (
                                <button 
                                   onClick={() => toggleValue(key)}
                                   className="text-xs text-slate-500 hover:text-white flex items-center"
                                >
                                   {showValues[key] ? 'Hide' : 'Reveal'}
                                   <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      {showValues[key] 
                                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      }
                                      {!showValues[key] && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                                   </svg>
                                </button>
                             )}
                          </div>
                          <div className="p-4 overflow-x-auto">
                             {item.type === 'Secret' && !showValues[key] ? (
                                <div className="text-slate-600 font-mono text-xs select-none">••••••••••••••••••••••••</div>
                             ) : (
                                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
                                   {value}
                                </pre>
                             )}
                          </div>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="text-slate-500 text-sm italic">No data entries found.</div>
              )}
           </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end shrink-0 pt-4 border-t border-slate-700">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors shadow-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const GkeConfiguration: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'ConfigMaps' | 'Secrets'>('ConfigMaps');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const { allConfigMaps, allSecrets } = useMemo(() => {
    const cms = [];
    const secrets = [];

    const filteredProjects = projects.filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId);

    for (const p of filteredProjects) {
      if (!p.gkeClusters) continue;
      for (const c of p.gkeClusters) {
        if (c.configMaps) {
          cms.push(...c.configMaps.map(item => ({
            ...item,
            clusterName: c.name,
            location: c.location,
            projectId: p.projectId,
            type: 'ConfigMap'
          })));
        }
        if (c.secrets) {
          secrets.push(...c.secrets.map(item => ({
            ...item,
            clusterName: c.name,
            location: c.location,
            projectId: p.projectId,
            type: 'Secret'
          })));
        }
      }
    }
    
    const fLower = filter.toLowerCase();
    return {
        allConfigMaps: cms.filter(item => item.name.toLowerCase().includes(fLower) || item.namespace.toLowerCase().includes(fLower)),
        allSecrets: secrets.filter(item => item.name.toLowerCase().includes(fLower) || item.namespace.toLowerCase().includes(fLower))
    };

  }, [projects, selectedProjectId, filter]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Configuration & Secrets</h2>
            <p className="text-slate-400 mt-1">
              Application configuration data and sensitive credentials.
            </p>
          </div>
          <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex">
              <button 
                  onClick={() => setActiveTab('ConfigMaps')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'ConfigMaps' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                  ConfigMaps
              </button>
              <button 
                  onClick={() => setActiveTab('Secrets')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'Secrets' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                  Secrets
              </button>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
             <div className="flex items-center space-x-2">
               <span className="text-xs text-slate-500">
                 Showing {activeTab === 'ConfigMaps' ? allConfigMaps.length : allSecrets.length} items
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
                    <th className="px-6 py-4">Namespace</th>
                    {activeTab === 'ConfigMaps' && <th className="px-6 py-4">Keys</th>}
                    {activeTab === 'Secrets' && <th className="px-6 py-4">Type</th>}
                    <th className="px-6 py-4">Cluster</th>
                    <th className="px-6 py-4"></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                 {activeTab === 'ConfigMaps' ? (
                     allConfigMaps.map((cm, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedItem(cm)}
                        className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      >
                          <td className="px-6 py-4 font-medium text-slate-200">
                              {cm.name}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                              {cm.namespace}
                          </td>
                          <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                              <div className="flex flex-wrap gap-1">
                                  {cm.data && Object.keys(cm.data).map(k => (
                                      <span key={k} className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">{k}</span>
                                  ))}
                              </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs">
                              <div className="font-semibold text-slate-300">{cm.clusterName}</div>
                              <div className="text-[10px]">{cm.projectId}</div>
                          </td>
                          <td className="px-6 py-4 text-right text-slate-500">
                             <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </td>
                      </tr>
                     ))
                 ) : (
                     allSecrets.map((secret, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedItem(secret)}
                        className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      >
                          <td className="px-6 py-4 font-medium text-slate-200">
                              <div className="flex items-center">
                                  <svg className="w-3 h-3 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                  {secret.name}
                              </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                              {secret.namespace}
                          </td>
                          <td className="px-6 py-4 text-slate-300 text-xs">
                              <span className="font-mono bg-slate-800 px-2 py-1 rounded border border-slate-600 text-slate-400">
                                  {secret.type}
                              </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs">
                              <div className="font-semibold text-slate-300">{secret.clusterName}</div>
                              <div className="text-[10px]">{secret.projectId}</div>
                          </td>
                          <td className="px-6 py-4 text-right text-slate-500">
                             <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </td>
                      </tr>
                     ))
                 )}
                 
                 {((activeTab === 'ConfigMaps' && allConfigMaps.length === 0) || (activeTab === 'Secrets' && allSecrets.length === 0)) && (
                    <tr>
                       <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          No {activeTab} found matching criteria.
                       </td>
                    </tr>
                 )}
              </tbody>
             </table>
          </div>
        </div>
      </div>

      {selectedItem && (
        <DetailModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
        />
      )}
    </>
  );
};
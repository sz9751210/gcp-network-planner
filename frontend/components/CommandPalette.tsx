import React, { useState, useEffect, useRef } from 'react';
import { GcpProject } from '../types';
import { ViewType } from './Layout';

interface Props {
  projects: GcpProject[];
  onNavigate: (view: ViewType, projectId?: string) => void;
}

interface SearchResult {
  id: string;
  type: 'Project' | 'VPC' | 'Subnet' | 'Instance' | 'Firewall' | 'LoadBalancer' | 'GKE' | 'Workload' | 'Service' | 'Storage' | 'Config' | 'Tool';
  title: string;
  subtitle: string;
  projectId: string;
  view: ViewType;
}

export const CommandPalette: React.FC<Props> = ({ projects, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle on Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Indexing Data
  const results = React.useMemo<SearchResult[]>(() => {
    if (!query) return [];
    
    const q = query.toLowerCase();
    const hits: SearchResult[] = [];

    const toolResults: Array<{ id: string; title: string; subtitle: string; view: ViewType; keywords: string[] }> = [
      {
        id: 'tool-cidr-manager',
        title: 'CIDR Manager',
        subtitle: 'Unified subnet CIDR inventory + conflict + planning',
        view: 'cidr_manager',
        keywords: ['cidr manager', 'cidr', 'ipam', 'subnet planning', 'allocation manager'],
      },
      {
        id: 'tool-cidr-planner-legacy',
        title: 'CIDR Planner (Legacy)',
        subtitle: 'Legacy page redirected to CIDR Manager',
        view: 'cidr',
        keywords: ['cidr planner', 'legacy cidr'],
      },
      {
        id: 'tool-ip-allocations-legacy',
        title: 'IP Allocations (Legacy)',
        subtitle: 'Legacy page redirected to CIDR Manager',
        view: 'allocations',
        keywords: ['ip allocations', 'allocation list', 'legacy allocations'],
      },
    ];

    toolResults.forEach((tool) => {
      const matches = tool.keywords.some((keyword) => keyword.includes(q) || q.includes(keyword));
      if (!matches) {
        return;
      }
      hits.push({
        id: tool.id,
        type: 'Tool',
        title: tool.title,
        subtitle: tool.subtitle,
        projectId: '',
        view: tool.view,
      });
    });

    projects.forEach(p => {
      // Index Project
      if (p.projectId.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
        hits.push({
          id: p.projectId,
          type: 'Project',
          title: p.projectId,
          subtitle: p.name,
          projectId: p.projectId,
          view: 'dashboard'
        });
      }

      // Index VPCs
      p.vpcs.forEach(v => {
        if (v.name.toLowerCase().includes(q)) {
          hits.push({
            id: v.id,
            type: 'VPC',
            title: v.name,
            subtitle: `VPC in ${p.projectId}`,
            projectId: p.projectId,
            view: 'topology'
          });
        }
        // Index Subnets
        v.subnets.forEach(s => {
          if (s.name.toLowerCase().includes(q) || s.ipCidrRange.includes(q)) {
            hits.push({
              id: s.selfLink,
              type: 'Subnet',
              title: s.name,
              subtitle: `${s.ipCidrRange} (${s.region})`,
              projectId: p.projectId,
              view: 'topology'
            });
          }
        });
      });

      // Index Instances
      p.instances.forEach(i => {
        if (i.name.toLowerCase().includes(q) || i.internalIp.includes(q)) {
          hits.push({
            id: i.id,
            type: 'Instance',
            title: i.name,
            subtitle: `${i.internalIp} (${i.zone})`,
            projectId: p.projectId,
            view: 'gce'
          });
        }
      });
      
      // Index LBs
      p.loadBalancers.forEach(lb => {
          if(lb.name.toLowerCase().includes(q) || lb.ipAddress.includes(q)) {
              hits.push({
                  id: lb.id,
                  type: 'LoadBalancer',
                  title: lb.name,
                  subtitle: `IP: ${lb.ipAddress}`,
                  projectId: p.projectId,
                  view: 'loadbalancer'
              });
          }
      });

      // Index GKE Resources
      if (p.gkeClusters) {
        p.gkeClusters.forEach(c => {
           // Cluster
           if (c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) {
             hits.push({
               id: c.id,
               type: 'GKE',
               title: c.name,
               subtitle: `Cluster in ${c.location}`,
               projectId: p.projectId,
               view: 'gke_clusters'
             });
           }

           // Workloads
           c.workloads?.forEach(w => {
               if (w.name.toLowerCase().includes(q)) {
                   hits.push({
                       id: `${c.id}-${w.name}`,
                       type: 'Workload',
                       title: w.name,
                       subtitle: `${w.type} in ${c.name}`,
                       projectId: p.projectId,
                       view: 'gke_workloads'
                   });
               }
           });

           // Services
           c.services?.forEach(s => {
               if (s.name.toLowerCase().includes(q) || s.clusterIp.includes(q)) {
                   hits.push({
                       id: `${c.id}-${s.name}`,
                       type: 'Service',
                       title: s.name,
                       subtitle: `${s.type} in ${c.name}`,
                       projectId: p.projectId,
                       view: 'gke_services'
                   });
               }
           });

           // PVCs
           c.pvcs?.forEach(pvc => {
               if (pvc.name.toLowerCase().includes(q)) {
                   hits.push({
                       id: `${c.id}-${pvc.name}`,
                       type: 'Storage',
                       title: pvc.name,
                       subtitle: `PVC in ${c.name}`,
                       projectId: p.projectId,
                       view: 'gke_storage'
                   });
               }
           });

           // ConfigMaps
           c.configMaps?.forEach(cm => {
               if (cm.name.toLowerCase().includes(q)) {
                   hits.push({
                       id: `${c.id}-${cm.name}`,
                       type: 'Config',
                       title: cm.name,
                       subtitle: `ConfigMap in ${c.name}`,
                       projectId: p.projectId,
                       view: 'gke_config'
                   });
               }
           });
        });
      }
    });

    return hits.slice(0, 10); // Limit results
  }, [query, projects]);

  const handleSelect = (result: SearchResult) => {
    onNavigate(result.view, result.projectId);
    setIsOpen(false);
  };

  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-32 px-4">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
        onClick={() => setIsOpen(false)}
      ></div>
      
      <div className="relative w-full max-w-2xl bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 border-b border-slate-700">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-0 py-4 px-4 text-white placeholder-slate-500 focus:ring-0 text-lg"
            placeholder="Search projects, VPCs, IPs, Workloads, PVCs..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyNav}
          />
          <div className="text-xs text-slate-500 border border-slate-600 rounded px-1.5 py-0.5">ESC</div>
        </div>
        
        {results.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {results.map((result, index) => (
              <div
                key={result.id}
                onClick={() => handleSelect(result)}
                className={`px-4 py-3 mx-2 rounded-lg cursor-pointer flex items-center justify-between group transition-all ${
                  index === selectedIndex ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                 <div className="flex items-center">
                    <div className={`mr-3 p-1.5 rounded-md ${index === selectedIndex ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {result.type === 'Project' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                        {result.type === 'VPC' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        {result.type === 'Instance' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>}
                        {(result.type === 'Subnet' || result.type === 'LoadBalancer') && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                        {result.type === 'GKE' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>}
                        {result.type === 'Workload' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>}
                        {result.type === 'Service' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                        {(result.type === 'Storage' || result.type === 'Config') && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                        {result.type === 'Tool' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10M4 7h.01M4 12h.01M4 17h.01" /></svg>}
                    </div>
                    <div>
                        <div className="font-medium text-sm">{result.title}</div>
                        <div className={`text-xs ${index === selectedIndex ? 'text-blue-200' : 'text-slate-500'}`}>{result.subtitle}</div>
                    </div>
                 </div>
                 <div className={`text-xs ${index === selectedIndex ? 'text-blue-200' : 'text-slate-600'} flex items-center`}>
                    <span className="opacity-50 mr-2">Go to</span>
                    <span className="font-mono uppercase">{result.type}</span>
                 </div>
              </div>
            ))}
          </div>
        )}
        
        {query && results.length === 0 && (
          <div className="p-8 text-center text-slate-500">
             No results found for "{query}"
          </div>
        )}
        
        <div className="bg-slate-900 px-4 py-2 border-t border-slate-700 flex justify-between items-center text-[10px] text-slate-500">
            <div className="flex space-x-3">
                <span className="flex items-center"><span className="bg-slate-700 px-1 rounded mr-1">↵</span> to select</span>
                <span className="flex items-center"><span className="bg-slate-700 px-1 rounded mr-1">↑↓</span> to navigate</span>
            </div>
            <div>GCP Network Planner</div>
        </div>
      </div>
    </div>
  );
};

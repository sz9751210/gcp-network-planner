import React, { useState, useEffect } from 'react';
import { GcpProject } from '../types';

export type ViewType =
  | 'dashboard'
  | 'service_accounts'
  | 'topology'
  | 'peering'
  | 'gce'
  | 'gke_clusters'
  | 'gke_workloads'
  | 'gke_services'
  | 'gke_storage'
  | 'gke_config'
  | 'cidr'
  | 'allocations'
  | 'firewall'
  | 'loadbalancer'
  | 'cloudarmor'
  | 'routes'
  | 'connectivity'
  | 'iam';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  projects: GcpProject[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
}

interface NavGroup {
  title: string;
  items: { id: ViewType; label: string; icon: React.ReactNode }[];
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  onViewChange,
  projects,
  selectedProjectId,
  onProjectChange
}) => {
  
  // Define Groups
  const navGroups: NavGroup[] = [
    {
      title: 'Core Platform',
      items: [
        {
          id: 'dashboard',
          label: 'Overview',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        },
        {
          id: 'topology',
          label: 'Network Hierarchy',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        },
        {
          id: 'gce',
          label: 'Compute Engine',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
        }
      ]
    },
    {
      title: 'Kubernetes Engine',
      items: [
        {
          id: 'gke_clusters',
          label: 'Clusters',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        },
        {
          id: 'gke_workloads',
          label: 'Workloads',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
        },
        {
          id: 'gke_services',
          label: 'Services & Ingress',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
        },
        {
          id: 'gke_config',
          label: 'Configuration',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        },
        {
          id: 'gke_storage',
          label: 'Storage',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
        }
      ]
    },
    {
      title: 'Connectivity & Routing',
      items: [
        {
          id: 'peering',
          label: 'Peering Map',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        },
        {
          id: 'routes',
          label: 'Route Explorer',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        },
        {
          id: 'connectivity',
          label: 'Connectivity Tests',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        }
      ]
    },
    {
      title: 'Security & Compliance',
      items: [
        {
          id: 'firewall',
          label: 'Firewall Rules',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        },
        {
          id: 'cloudarmor',
          label: 'Cloud Armor',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        },
        {
          id: 'iam',
          label: 'IAM & Admin',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
        }
      ]
    },
    {
      title: 'Traffic & Resources',
      items: [
        {
          id: 'loadbalancer',
          label: 'Load Balancers',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        }
      ]
    },
    {
      title: 'IP Management',
      items: [
        {
          id: 'allocations',
          label: 'IP Allocations',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        },
        {
          id: 'cidr',
          label: 'CIDR Planner',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      ]
    },
    {
      title: 'Settings',
      items: [
        {
          id: 'service_accounts',
          label: 'Service Accounts',
          icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
        }
      ]
    }
  ];

  // State to manage expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(navGroups.map(g => g.title)));

  const toggleGroup = (title: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(title)) newSet.delete(title);
    else newSet.add(title);
    setExpandedGroups(newSet);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex-shrink-0 flex flex-col transition-all duration-300">
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/50 backdrop-blur">
           <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-1.5 rounded-lg shadow-lg shadow-blue-900/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
           </div>
           <div>
             <span className="font-bold text-lg tracking-tight block text-white">NetPlanner</span>
           </div>
        </div>

        <nav className="flex-grow p-4 space-y-6 overflow-y-auto custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title}>
               <button 
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 hover:text-slate-300 transition-colors"
               >
                  {group.title}
                  <svg className={`w-3 h-3 transform transition-transform duration-200 ${expandedGroups.has(group.title) ? 'rotate-0' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
               </button>
               
               <div className={`space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${expandedGroups.has(group.title) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                 {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                      currentView === item.id 
                        ? 'bg-blue-600/10 text-blue-400' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {currentView === item.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-500 rounded-r-md"></div>}
                    <div className={`${currentView === item.id ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`}>
                        {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </button>
                 ))}
               </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="text-xs text-slate-500 font-medium">System Operational</div>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-600 mt-2">
             <span>v2.4.0 (Enterprise)</span>
             <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-[10px] text-slate-500">⌘K</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
        
        {/* Header with Project Selector */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 flex-shrink-0 z-20 bg-slate-900/80 backdrop-blur-md sticky top-0">
          <h1 className="text-xl font-semibold text-white tracking-tight flex items-center">
            {navGroups.flatMap(g => g.items).find(n => n.id === currentView)?.icon}
            <span className="ml-3">{navGroups.flatMap(g => g.items).find(n => n.id === currentView)?.label}</span>
          </h1>

          <div className="flex items-center space-x-4">
             <div className="relative group">
               <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-md px-3 py-1.5 transition-colors shadow-sm">
                 <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Project Scope</span>
                 <select
                   value={selectedProjectId}
                   onChange={(e) => onProjectChange(e.target.value)}
                   className="appearance-none bg-transparent text-white text-sm focus:outline-none min-w-[180px] cursor-pointer"
                 >
                   <option value="all">Entire Organization</option>
                   <optgroup label="Active Projects">
                      {projects.map(p => (
                        <option key={p.projectId} value={p.projectId}>
                          {p.projectId}
                        </option>
                      ))}
                   </optgroup>
                 </select>
                 <svg className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
               </div>
             </div>
             
             <div className="w-px h-6 bg-slate-800"></div>

             <div className="flex items-center space-x-2 cursor-pointer hover:bg-slate-800 p-1.5 rounded-md transition-colors">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center border border-slate-600 text-xs font-bold text-white shadow-inner">
                  AD
                </div>
             </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-grow p-6 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
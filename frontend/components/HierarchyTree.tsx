import React, { useState } from 'react';
import { GcpProject, GcpVpc } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const HierarchyTree: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  // Track expanded states (simple toggle for now, defaults to all open implicitly by rendering method, 
  // but could be enhanced to collapse IDs)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (id: string) => {
    const newSet = new Set(collapsedProjects);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCollapsedProjects(newSet);
  };

  const filteredProjects = projects.filter(p => {
    if (selectedProjectId !== 'all' && p.projectId !== selectedProjectId) return false;
    if (filter && !p.projectId.toLowerCase().includes(filter.toLowerCase()) && 
        !p.vpcs.some(v => v.name.toLowerCase().includes(filter.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 backdrop-blur-sm sticky top-0 z-20">
        <div>
          <h2 className="text-lg font-semibold text-white">Network Topology</h2>
          <p className="text-xs text-slate-400">Hierarchical view of Projects, VPCs, and Subnets</p>
        </div>
        <input 
          type="text" 
          placeholder="Filter resources..." 
          className="bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-200 w-64 transition-all"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto flex-grow p-6">
        {filteredProjects.map((project) => (
          <div key={project.projectId} className="mb-6 last:mb-0">
            {/* Level 1: Project Node */}
            <div className="flex items-center group mb-2">
              <button 
                onClick={() => toggleProject(project.projectId)}
                className="mr-3 p-1 rounded hover:bg-slate-700 text-slate-400 transition-colors"
              >
                 <svg className={`w-4 h-4 transform transition-transform ${collapsedProjects.has(project.projectId) ? '-rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="flex items-center px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg shadow-sm w-full max-w-4xl relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                <div className="bg-blue-900/20 p-2 rounded-md mr-3 text-blue-400">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <div>
                   <div className="font-bold text-white text-sm">{project.projectId}</div>
                   <div className="text-xs text-slate-400">{project.name} • {project.number}</div>
                </div>
                {project.error && (
                  <span className="ml-auto bg-red-900/30 text-red-300 text-xs px-2 py-1 rounded border border-red-800 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Sync Error
                  </span>
                )}
              </div>
            </div>

            {/* Children Container */}
            {!collapsedProjects.has(project.projectId) && (
              <div className="relative ml-6 pl-6 border-l-2 border-slate-700/50 space-y-4 pt-2 pb-2">
                {project.vpcs.map((vpc) => (
                  <div key={vpc.id} className="relative">
                    {/* Horizontal Connector for VPC */}
                    <div className="absolute -left-6 top-5 w-6 h-px bg-slate-700/50"></div>
                    
                    {/* Level 2: VPC Node */}
                    <div className="flex items-center px-4 py-2 bg-slate-800 border border-slate-600/50 rounded-lg max-w-3xl hover:border-purple-500/50 transition-colors">
                       <div className="bg-purple-900/20 p-1.5 rounded mr-3 text-purple-400">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       </div>
                       <div className="flex-1">
                          <span className="font-medium text-slate-200 text-sm">{vpc.name}</span>
                          <span className="text-xs text-slate-500 ml-2 font-mono">MTU: {vpc.mtu || 1460}</span>
                       </div>
                       {vpc.isSharedVpcHost && <StatusBadge status="info" text="Shared Host" />}
                    </div>

                    {/* Level 3: Subnets Container */}
                    <div className="ml-8 mt-2 space-y-2">
                      {vpc.subnets.map((subnet, idx) => (
                        <div key={subnet.selfLink} className="relative flex items-center group">
                           {/* Elbow Connector for Subnet */}
                           <div className="absolute -left-4 top-1/2 w-4 h-px bg-slate-700"></div>
                           <div className="absolute -left-4 -top-4 bottom-1/2 w-px bg-slate-700"></div>
                           
                           <div className="flex-1 flex items-center justify-between p-2 pl-3 rounded-md border border-transparent hover:bg-slate-700/40 hover:border-slate-600 transition-all text-sm">
                              <div className="flex items-center">
                                 <div className="w-2 h-2 rounded-full bg-slate-600 mr-3 group-hover:bg-emerald-400 transition-colors"></div>
                                 <span className="text-slate-300 font-medium mr-3">{subnet.name}</span>
                                 <span className="text-slate-500 text-xs font-mono bg-slate-900 px-1.5 py-0.5 rounded">{subnet.region}</span>
                              </div>
                              <div className="flex items-center space-x-4">
                                 <span className="text-emerald-400 font-mono font-medium bg-emerald-900/10 px-2 py-0.5 rounded border border-emerald-900/20">{subnet.ipCidrRange}</span>
                                 {subnet.privateGoogleAccess && (
                                   <span className="text-[10px] uppercase tracking-wider text-slate-400 border border-slate-600 px-1 rounded">PGA</span>
                                 )}
                              </div>
                           </div>
                        </div>
                      ))}
                      {vpc.subnets.length === 0 && (
                        <div className="relative flex items-center ml-4">
                           <div className="absolute -left-4 -top-4 bottom-1/2 w-px bg-slate-700"></div>
                           <div className="text-xs text-slate-600 italic py-1">No subnets configured</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {project.vpcs.length === 0 && !project.error && (
                   <div className="text-sm text-slate-500 italic px-4">No VPCs found in this project.</div>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredProjects.length === 0 && (
           <div className="h-64 flex flex-col items-center justify-center text-slate-500">
              <p>No resources match the current filter.</p>
           </div>
        )}
      </div>
    </div>
  );
};
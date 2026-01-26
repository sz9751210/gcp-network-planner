import React, { useState, useMemo } from 'react';
import { GcpProject } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const IamExplorer: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // 1. Project Selection
      if (selectedProjectId !== 'all' && p.projectId !== selectedProjectId) return false;
      
      // 2. Filter logic (search text)
      if (!filter) return true;
      const lowerFilter = filter.toLowerCase();

      // Check if project matches
      if (p.projectId.toLowerCase().includes(lowerFilter) || p.name.toLowerCase().includes(lowerFilter)) return true;

      // Check if any role matches
      if (p.iamPolicy?.some(b => 
          b.role.toLowerCase().includes(lowerFilter) || 
          b.members.some(m => m.toLowerCase().includes(lowerFilter))
      )) return true;

      return false;
    });
  }, [projects, selectedProjectId, filter]);

  const getMemberType = (member: string) => {
    if (member.startsWith('user:')) return 'USER';
    if (member.startsWith('serviceAccount:')) return 'SERVICE_ACCOUNT';
    if (member.startsWith('group:')) return 'GROUP';
    if (member.startsWith('domain:')) return 'DOMAIN';
    if (member === 'allUsers' || member === 'allAuthenticatedUsers') return 'PUBLIC';
    return 'UNKNOWN';
  };

  const renderMemberIcon = (type: string) => {
    switch(type) {
      case 'USER':
        return <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
      case 'SERVICE_ACCOUNT':
        return <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>;
      case 'GROUP':
        return <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
      case 'PUBLIC':
         return <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>;
      default:
        return <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
  };

  const getMemberLabel = (member: string) => {
    const parts = member.split(':');
    return parts.length > 1 ? parts[1] : member;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">IAM Policy Explorer</h2>
          <p className="text-slate-400 mt-1">
            Audit and visualize access control lists across your projects.
          </p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
           <div className="flex items-center space-x-2">
             <span className="text-xs text-slate-500">
               Showing {filteredProjects.length} projects
             </span>
           </div>

           <div className="relative">
             <input
               type="text"
               className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 pl-10 p-2 placeholder-slate-500 transition-all"
               placeholder="Filter by role or principal..."
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
             />
             <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
        </div>

        {/* Content */}
        <div className="overflow-x-auto flex-grow bg-slate-900/50 p-6 space-y-8">
            {filteredProjects.map(project => {
                const bindings = project.iamPolicy || [];
                // Filter bindings based on search text if applicable
                const displayBindings = filter 
                   ? bindings.filter(b => b.role.toLowerCase().includes(filter.toLowerCase()) || b.members.some(m => m.toLowerCase().includes(filter.toLowerCase())))
                   : bindings;

                if (displayBindings.length === 0 && filter) return null;

                return (
                    <div key={project.projectId} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/40 flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center">
                                    <span className="bg-blue-900/50 text-blue-300 p-1 rounded mr-2 border border-blue-800/50">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    </span>
                                    {project.projectId}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5 ml-8">{project.name}</p>
                            </div>
                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">{displayBindings.length} roles</span>
                        </div>
                        
                        {displayBindings.length > 0 ? (
                        <table className="w-full text-left">
                            <thead className="bg-slate-800/80 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium w-1/3">Role</th>
                                    <th className="px-6 py-3 font-medium">Principals</th>
                                    <th className="px-6 py-3 font-medium w-1/6">Conditions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50 text-sm">
                                {displayBindings.map((binding, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/20">
                                        <td className="px-6 py-4 align-top">
                                            <div className="font-mono text-xs text-blue-300 bg-blue-900/10 px-2 py-1 rounded border border-blue-800/30 w-fit">
                                                {binding.role}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {binding.members.map(member => {
                                                    const type = getMemberType(member);
                                                    return (
                                                        <span key={member} className="flex items-center px-2 py-1 rounded bg-slate-700/50 border border-slate-600 text-xs text-slate-300" title={member}>
                                                            <span className="mr-1.5">{renderMemberIcon(type)}</span>
                                                            {getMemberLabel(member)}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            {binding.condition ? (
                                                <div className="text-xs bg-amber-900/10 border border-amber-800/30 p-2 rounded text-amber-500">
                                                    <div className="font-bold">{binding.condition.title}</div>
                                                    <div className="font-mono mt-1 opacity-75">{binding.condition.expression}</div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600 text-xs">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        ) : (
                            <div className="p-6 text-center text-slate-500 italic text-sm">
                                No IAM policies found for this project.
                            </div>
                        )}
                    </div>
                );
            })}
            
            {filteredProjects.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    No projects match your filter.
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
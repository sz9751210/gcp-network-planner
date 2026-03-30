import React, { useMemo, useState } from 'react';
import { GcpCloudArmorPolicy, GcpLoadBalancer, GcpProject } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

type Tab = 'lb' | 'armor';

type LoadBalancerRow = GcpLoadBalancer & {
  projectId: string;
};

type ArmorPolicyRow = GcpCloudArmorPolicy & {
  projectId: string;
};

export const NetworkServices: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [activeTab, setActiveTab] = useState<Tab>('lb');
  const [filter, setFilter] = useState('');

  const getConsoleUrl = (type: Tab, projectId: string, resourceName: string): string => {
    if (type === 'lb') {
      return `https://console.cloud.google.com/net-services/loadbalancing/list/loadBalancers?project=${projectId}`;
    }
    return `https://console.cloud.google.com/net-security/securitypolicies/details/${resourceName}?project=${projectId}`;
  };

  const { loadBalancers, armorPolicies } = useMemo(() => {
    const projectsInScope = projects.filter(
      (project) => selectedProjectId === 'all' || project.projectId === selectedProjectId
    );

    const filterLower = filter.toLowerCase();

    const lbRows: LoadBalancerRow[] = projectsInScope
      .flatMap((project) =>
        project.loadBalancers.map((lb) => ({
          ...lb,
          projectId: project.projectId,
        }))
      )
      .filter(
        (lb) =>
          lb.name.toLowerCase().includes(filterLower) ||
          lb.ipAddress.toLowerCase().includes(filterLower)
      );

    const armorRows: ArmorPolicyRow[] = projectsInScope
      .flatMap((project) =>
        project.armorPolicies.map((policy) => ({
          ...policy,
          projectId: project.projectId,
        }))
      )
      .filter((policy) => policy.name.toLowerCase().includes(filterLower));

    return {
      loadBalancers: lbRows,
      armorPolicies: armorRows,
    };
  }, [projects, selectedProjectId, filter]);

  const visibleCount = activeTab === 'lb' ? loadBalancers.length : armorPolicies.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Network Services</h2>
          <p className="text-slate-400 mt-1">
            Manage Load Balancing and Cloud Armor Edge security policies.
          </p>
        </div>

        <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex">
          <button
            onClick={() => setActiveTab('lb')}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-all ${
              activeTab === 'lb' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Load Balancers
          </button>
          <button
            onClick={() => setActiveTab('armor')}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-all ${
              activeTab === 'armor' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Cloud Armor
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">
              Showing {visibleCount} {activeTab === 'lb' ? 'load balancers' : 'policies'}
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 pl-10 p-2 placeholder-slate-500 transition-all"
              placeholder={activeTab === 'lb' ? 'Filter by name or IP...' : 'Filter by policy name...'}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="overflow-x-auto flex-grow bg-slate-900/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700 font-semibold">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Type</th>
                {activeTab === 'lb' && <th className="px-6 py-4">Frontend Config</th>}
                {activeTab === 'lb' && <th className="px-6 py-4">Security Policy</th>}
                {activeTab === 'armor' && <th className="px-6 py-4">Rules</th>}
                {activeTab === 'armor' && <th className="px-6 py-4">Adaptive Protection</th>}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {activeTab === 'lb' &&
                loadBalancers.map((lb) => (
                  <tr key={`${lb.projectId}-${lb.id}`} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-200">{lb.name}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{lb.projectId}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-xs font-mono text-slate-300">
                        {lb.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs">
                        <span className="text-emerald-400 font-mono">
                          {lb.ipAddress}:{lb.portRange}
                        </span>
                        <span className="text-slate-500 mt-1">
                          {lb.protocol} • {lb.region || 'Global'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lb.securityPolicy ? (
                        <span className="flex items-center text-xs text-indigo-300 bg-indigo-900/20 px-2 py-1 rounded border border-indigo-800/50 w-fit">
                          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          {lb.securityPolicy}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={getConsoleUrl('lb', lb.projectId, lb.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 hover:text-blue-300 transition-colors"
                        title="Edit in Google Cloud Console"
                      >
                        <span>Edit</span>
                        <svg className="w-3 h-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))}

              {activeTab === 'armor' &&
                armorPolicies.map((policy) => (
                  <tr key={`${policy.projectId}-${policy.id}`} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {policy.name}
                      {policy.description && (
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">{policy.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{policy.projectId}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-xs font-mono text-slate-300">
                        {policy.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{policy.rulesCount} rules</td>
                    <td className="px-6 py-4">
                      {policy.adaptiveProtection ? (
                        <span className="text-xs text-green-400 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Enabled
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Disabled</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={getConsoleUrl('armor', policy.projectId, policy.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 hover:text-blue-300 transition-colors"
                        title="Edit in Google Cloud Console"
                      >
                        <span>Edit</span>
                        <svg className="w-3 h-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))}

              {visibleCount === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No {activeTab === 'lb' ? 'Load Balancers' : 'Cloud Armor Policies'} found.
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

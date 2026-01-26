import React, { useState, useMemo } from 'react';
import { GcpProject, GcpCloudArmorRule } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const CloudArmorInventory: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());

  // Helper to generate console URL
  const getConsoleUrl = (projectId: string, resourceName: string) => {
    return `https://console.cloud.google.com/net-security/securitypolicies/details/${resourceName}?project=${projectId}`;
  };

  const filteredData = useMemo(() => {
    return projects
      .filter(p => selectedProjectId === 'all' || p.projectId === selectedProjectId)
      .flatMap(p => (p.armorPolicies || []).map(ap => ({ ...ap, projectId: p.projectId })))
      .filter(ap => ap.name.toLowerCase().includes(filter.toLowerCase()));
  }, [projects, selectedProjectId, filter]);

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedPolicies);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedPolicies(newSet);
  };

  const renderRuleAction = (rule: GcpCloudArmorRule) => {
    if (rule.preview) {
      return <span className="text-amber-400 font-bold text-xs border border-amber-600/50 bg-amber-900/20 px-2 py-0.5 rounded">PREVIEW ({rule.action.toUpperCase()})</span>;
    }
    switch (rule.action) {
      case 'allow':
        return <span className="text-green-400 font-bold text-xs border border-green-600/50 bg-green-900/20 px-2 py-0.5 rounded">ALLOW</span>;
      case 'deny':
        return <span className="text-red-400 font-bold text-xs border border-red-600/50 bg-red-900/20 px-2 py-0.5 rounded">DENY</span>;
      case 'throttle':
        return <span className="text-purple-400 font-bold text-xs border border-purple-600/50 bg-purple-900/20 px-2 py-0.5 rounded">THROTTLE</span>;
      default:
        return <span className="text-slate-400 text-xs">{rule.action}</span>;
    }
  };

  // Helper to detect capabilities based on rules (mock logic based on string matching)
  const getCapabilities = (rules: GcpCloudArmorRule[]) => {
    const caps = {
      sqli: rules.some(r => r.expression?.includes('sqli') || r.description?.toLowerCase().includes('sql')),
      xss: rules.some(r => r.expression?.includes('xss') || r.description?.toLowerCase().includes('xss')),
      geo: rules.some(r => r.expression?.includes('origin.region_code') || r.description?.toLowerCase().includes('geo')),
      rate: rules.some(r => r.action === 'throttle' || r.action === 'rate_based_ban')
    };
    return caps;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Cloud Armor Policies</h2>
          <p className="text-slate-400 mt-1">
            Edge security policies, WAF rules, and adaptive protection.
          </p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">
              Showing {filteredData.length} policies
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 pl-10 p-2 placeholder-slate-500 transition-all"
              placeholder="Filter by policy name..."
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
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Protection Coverage</th>
                <th className="px-6 py-4">Rules</th>
                <th className="px-6 py-4">Adaptive</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {filteredData.map((item) => {
                const caps = getCapabilities(item.rules || []);
                return (
                  <React.Fragment key={`${item.projectId}-${item.id}`}>
                    <tr
                      onClick={() => toggleExpand(item.id)}
                      className={`hover:bg-slate-700/30 transition-colors cursor-pointer group ${expandedPolicies.has(item.id) ? 'bg-slate-800/80' : ''}`}
                    >
                      <td className="px-6 py-4 text-slate-500">
                        <svg className={`w-4 h-4 transform transition-transform ${expandedPolicies.has(item.id) ? 'rotate-90 text-blue-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-200">
                        {item.name}
                        <div className="flex mt-1 gap-1">
                          <span className="bg-slate-800 border border-slate-600 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400">
                            {item.type === 'CLOUD_ARMOR' ? 'BACKEND' : 'EDGE'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {item.projectId}
                      </td>

                      {/* Capabilities Column */}
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5">
                          {caps.sqli && <span className="px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-700 text-[10px] text-blue-300 font-bold" title="SQL Injection Rules Detected">SQLi</span>}
                          {caps.xss && <span className="px-1.5 py-0.5 rounded bg-purple-900/30 border border-purple-700 text-[10px] text-purple-300 font-bold" title="XSS Rules Detected">XSS</span>}
                          {caps.geo && <span className="px-1.5 py-0.5 rounded bg-orange-900/30 border border-orange-700 text-[10px] text-orange-300 font-bold" title="Geo-blocking Rules Detected">GEO</span>}
                          {caps.rate && <span className="px-1.5 py-0.5 rounded bg-pink-900/30 border border-pink-700 text-[10px] text-pink-300 font-bold" title="Rate Limiting Detected">RATE</span>}
                          {!caps.sqli && !caps.xss && !caps.geo && !caps.rate && <span className="text-slate-600 text-[10px] italic">Basic L3/L4</span>}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-300">
                        {item.rulesCount} rules
                      </td>
                      <td className="px-6 py-4">
                        {item.adaptiveProtection ? (
                          <span className="text-xs text-emerald-400 flex items-center bg-emerald-900/10 px-2 py-0.5 rounded border border-emerald-800/30 w-fit">
                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Enabled
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Disabled</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={getConsoleUrl(item.projectId, item.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 hover:text-blue-300 transition-colors"
                            title="Edit in Google Cloud Console"
                          >
                            <span>Edit</span>
                            <svg className="w-3 h-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Rules Row */}
                    {expandedPolicies.has(item.id) && (
                      <tr className="bg-slate-900/40">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="ml-8 border-l-2 border-slate-700 pl-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Security Rules</h4>
                            {(!item.rules || item.rules.length === 0) ? (
                              <div className="text-sm text-slate-500 italic">No detailed rules available for this policy.</div>
                            ) : (
                              <div className="overflow-hidden rounded-md border border-slate-700/50">
                                <table className="min-w-full divide-y divide-slate-700/50">
                                  <thead className="bg-slate-900">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-[10px] font-medium text-slate-500 uppercase">Priority</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-medium text-slate-500 uppercase">Action</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-medium text-slate-500 uppercase">Match Condition</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-medium text-slate-500 uppercase">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-700/50 bg-slate-800/40">
                                    {item.rules.sort((a, b) => a.priority - b.priority).map((rule, idx) => (
                                      <tr key={idx}>
                                        <td className="px-4 py-2 text-xs font-mono text-slate-300">{rule.priority}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{renderRuleAction(rule)}</td>
                                        <td className="px-4 py-2 text-xs text-slate-300">
                                          <div className="font-semibold text-slate-400 mb-0.5">{rule.match}</div>
                                          {rule.srcIpRanges && (
                                            <div className="font-mono text-[10px] text-slate-500 break-all">{rule.srcIpRanges.join(', ')}</div>
                                          )}
                                          {rule.expression && (
                                            <div className="font-mono text-[10px] text-amber-500/70 break-all">{rule.expression}</div>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-400">{rule.description || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No Cloud Armor Policies found.
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
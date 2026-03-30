import React, { useMemo, useState } from 'react';
import { GcpProject, GkeIngress, GkeService } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

type ServiceRow = GkeService & {
  clusterName: string;
  location: string;
  projectId: string;
};

type IngressRow = GkeIngress & {
  clusterName: string;
  location: string;
  projectId: string;
};

type SelectedItem =
  | { kind: 'Service'; item: ServiceRow }
  | { kind: 'Ingress'; item: IngressRow };

type ServiceDetailModalProps =
  | { item: ServiceRow; onClose: () => void; type: 'Service' }
  | { item: IngressRow; onClose: () => void; type: 'Ingress' };

const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({ item, onClose, type }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-600 max-w-2xl w-full transform transition-all p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-6 border-b border-slate-700 pb-4">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h3 className="text-xl font-bold text-white">{item.name}</h3>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700">
                {type}
              </span>
            </div>
            <div className="text-sm text-slate-400 font-mono">
              Namespace: <span className="text-slate-200">{item.namespace}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-700">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-500 uppercase font-semibold">Cluster</div>
              <div className="mt-1 font-medium text-slate-200">{item.clusterName}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{item.location}</div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-500 uppercase font-semibold">Project</div>
              <div className="mt-1 font-medium text-slate-200">{item.projectId}</div>
            </div>
          </div>

          {type === 'Service' && (
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Service Details</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                <div>
                  <span className="block text-slate-500 text-xs">Type</span>
                  <span className="text-slate-200">{item.type}</span>
                </div>
                <div>
                  <span className="block text-slate-500 text-xs">Cluster IP</span>
                  <span className="text-slate-200 font-mono">{item.clusterIp}</span>
                </div>
                {item.externalIp && (
                  <div>
                    <span className="block text-slate-500 text-xs">External IP</span>
                    <span className="text-blue-400 font-mono font-bold">{item.externalIp}</span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="block text-slate-500 text-xs mb-1">Ports</span>
                  <div className="flex flex-wrap gap-2">
                    {item.ports.split(',').map((port, index) => (
                      <span key={index} className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-xs font-mono text-slate-300">
                        {port.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {type === 'Ingress' && (
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Ingress Details</h4>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="block text-slate-500 text-xs">Load Balancer IP</span>
                  <span className="text-blue-400 font-mono font-bold">{item.loadBalancerIp || 'Pending'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 text-xs mb-2">Backends</span>
                  <div className="space-y-2">
                    {item.backends.map((backend, index) => (
                      <div key={index} className="flex items-center justify-between bg-slate-800 px-3 py-2 rounded border border-slate-600">
                        <span className="font-mono text-slate-300 text-xs">{backend}</span>
                        <span className="text-[10px] text-green-400 flex items-center">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                          Healthy
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors shadow-lg">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const GkeServices: React.FC<Props> = ({ projects, selectedProjectId }) => {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'Services' | 'Ingress'>('Services');
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const { allServices, allIngresses } = useMemo(() => {
    const services: ServiceRow[] = [];
    const ingresses: IngressRow[] = [];

    const filteredProjects = projects.filter(
      (project) => selectedProjectId === 'all' || project.projectId === selectedProjectId
    );

    for (const project of filteredProjects) {
      for (const cluster of project.gkeClusters) {
        if (cluster.services) {
          services.push(
            ...cluster.services.map((service) => ({
              ...service,
              clusterName: cluster.name,
              location: cluster.location,
              projectId: project.projectId,
            }))
          );
        }
        if (cluster.ingresses) {
          ingresses.push(
            ...cluster.ingresses.map((ingress) => ({
              ...ingress,
              clusterName: cluster.name,
              location: cluster.location,
              projectId: project.projectId,
            }))
          );
        }
      }
    }

    const filterLower = filter.toLowerCase();
    return {
      allServices: services.filter(
        (service) =>
          service.name.toLowerCase().includes(filterLower) ||
          service.clusterIp.toLowerCase().includes(filterLower)
      ),
      allIngresses: ingresses.filter((ingress) =>
        ingress.name.toLowerCase().includes(filterLower)
      ),
    };
  }, [projects, selectedProjectId, filter]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Services & Ingress</h2>
            <p className="text-slate-400 mt-1">Network exposure for your applications.</p>
          </div>
          <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex">
            <button
              onClick={() => setActiveTab('Services')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'Services' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setActiveTab('Ingress')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'Ingress' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ingress
            </button>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden min-h-[600px] flex flex-col">
          <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">
                Showing {activeTab === 'Services' ? allServices.length : allIngresses.length} items
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 pl-10 p-2 placeholder-slate-500 transition-all"
                placeholder="Filter..."
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
                  <th className="px-6 py-4">Namespace</th>
                  {activeTab === 'Services' && <th className="px-6 py-4">Type</th>}
                  <th className="px-6 py-4">Endpoints (IP)</th>
                  {activeTab === 'Services' && <th className="px-6 py-4">Ports</th>}
                  {activeTab === 'Ingress' && <th className="px-6 py-4">Backends</th>}
                  <th className="px-6 py-4">Cluster</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {activeTab === 'Services'
                  ? allServices.map((service, index) => (
                      <tr
                        key={`${service.projectId}-${service.name}-${index}`}
                        onClick={() => setSelectedItem({ kind: 'Service', item: service })}
                        className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 font-medium text-slate-200">{service.name}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">{service.namespace}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              service.type === 'LoadBalancer'
                                ? 'bg-indigo-900/30 text-indigo-300 border-indigo-700'
                                : 'bg-slate-700 text-slate-300 border-slate-600'
                            }`}
                          >
                            {service.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                          <div className="flex flex-col">
                            <span>Cluster: {service.clusterIp}</span>
                            {service.externalIp && <span className="text-blue-400">External: {service.externalIp}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">{service.ports}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          <div className="font-semibold text-slate-300">{service.clusterName}</div>
                          <div className="text-[10px]">{service.projectId}</div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500">
                          <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </td>
                      </tr>
                    ))
                  : allIngresses.map((ingress, index) => (
                      <tr
                        key={`${ingress.projectId}-${ingress.name}-${index}`}
                        onClick={() => setSelectedItem({ kind: 'Ingress', item: ingress })}
                        className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 font-medium text-slate-200">{ingress.name}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">{ingress.namespace}</td>
                        <td className="px-6 py-4 text-slate-300 font-mono text-xs">{ingress.loadBalancerIp || 'Pending'}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">{ingress.backends.join(', ')}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          <div className="font-semibold text-slate-300">{ingress.clusterName}</div>
                          <div className="text-[10px]">{ingress.projectId}</div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500">
                          <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </td>
                      </tr>
                    ))}

                {((activeTab === 'Services' && allServices.length === 0) ||
                  (activeTab === 'Ingress' && allIngresses.length === 0)) && (
                  <tr>
                    <td colSpan={activeTab === 'Services' ? 7 : 6} className="px-6 py-12 text-center text-slate-500">
                      No {activeTab.toLowerCase()} found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedItem?.kind === 'Service' && (
        <ServiceDetailModal item={selectedItem.item} type="Service" onClose={() => setSelectedItem(null)} />
      )}
      {selectedItem?.kind === 'Ingress' && (
        <ServiceDetailModal item={selectedItem.item} type="Ingress" onClose={() => setSelectedItem(null)} />
      )}
    </>
  );
};

import React from 'react';
import { GcpProject } from '../types';

interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
  onNavigateToManager: () => void;
}

export const CidrAllocations: React.FC<Props> = ({
  projects,
  selectedProjectId,
  onNavigateToManager,
}) => {
  const scopedProjects = selectedProjectId === 'all'
    ? projects
    : projects.filter((project) => project.projectId === selectedProjectId);
  const subnetCount = scopedProjects.reduce((total, project) => {
    return total + project.vpcs.reduce((vpcTotal, vpc) => vpcTotal + vpc.subnets.length, 0);
  }, 0);

  return (
    <div className="max-w-3xl mx-auto mt-10 bg-slate-800 border border-slate-700 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white">IP Allocations (Deprecated)</h2>
      <p className="text-slate-400 mt-2 text-sm">
        Allocation inventory and planning are now managed in <span className="text-slate-200 font-semibold">CIDR Manager</span>.
      </p>
      <p className="text-slate-500 mt-2 text-xs">
        Current scope: {selectedProjectId === 'all' ? 'all-projects' : selectedProjectId} / {subnetCount} subnets.
      </p>
      <button
        onClick={onNavigateToManager}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
      >
        Open CIDR Manager
      </button>
    </div>
  );
};

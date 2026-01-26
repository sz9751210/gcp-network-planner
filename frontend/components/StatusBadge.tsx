import React from 'react';

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info';
  text: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
  const colors = {
    success: 'bg-green-900 text-green-300 border-green-700',
    warning: 'bg-amber-900 text-amber-300 border-amber-700',
    error: 'bg-red-900 text-red-300 border-red-700',
    info: 'bg-blue-900 text-blue-300 border-blue-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[status]}`}>
      {text}
    </span>
  );
};
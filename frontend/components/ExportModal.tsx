import React, { useState } from 'react';

interface ExportFormat {
  id: string;
  name: string;
  extension: string;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: string) => void;
  data: any[];
}

export const exportFormats: ExportFormat[] = [
  { id: 'json', name: 'JSON', extension: '.json' },
  { id: 'csv', name: 'CSV', extension: '.csv' },
  { id: 'xlsx', name: 'Excel', extension: '.xlsx' },
  { id: 'pdf', name: 'PDF', extension: '.pdf' },
];

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport, data }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(exportFormats[0]);

  const handleExport = () => {
    onExport(selectedFormat.id);
    onClose();
  };

  return isOpen ? (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Export Data</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              {exportFormats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format)}
                  className={`px-4 py-3 rounded-lg border ${
                    selectedFormat.id === format.id
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-slate-700 hover:border-blue-500'
                  } transition-colors`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    checked={selectedFormat.id === format.id}
                    className="mr-2"
                    readOnly
                  />
                  <span className="ml-2 text-slate-300">{format.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <button
              onClick={handleExport}
              disabled={!selectedFormat || data.length === 0}
              className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Export as {selectedFormat?.name || 'JSON'}
            </button>
          </div>

          {data.length > 0 && (
            <div className="bg-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-2">
                Exporting <span className="font-medium text-slate-200">{data.length} records</span> in {selectedFormat?.name || 'JSON'} format
              </p>
              <p className="text-xs text-slate-500">
                {selectedFormat?.name === 'JSON' && 'Includes: projects, VPCs, subnets, instances, firewall rules'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;
};

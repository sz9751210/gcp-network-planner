import React, { useState, useEffect, useRef } from 'react';
import {
  fetchServiceAccounts,
  createServiceAccount,
  deleteServiceAccount,
  testServiceAccount,
  type ServiceAccount,
  type ServiceAccountKey,
} from '../services/api';

interface TestResult {
  success: boolean;
  message: string;
}

interface ServiceAccountsProps {
  onSelectAccount: (accountId: string) => void;
}

interface UnknownRecord {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toRequiredString(record: UnknownRecord, field: string): string {
  const value = record[field];
  return typeof value === 'string' ? value : '';
}

export const ServiceAccounts: React.FC<ServiceAccountsProps> = ({ onSelectAccount }) => {
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadServiceAccounts();
  }, []);

  const loadServiceAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServiceAccounts();
      setServiceAccounts(data);
    } catch (err) {
      setError('Failed to load service accounts');
      console.error('Error loading service accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateServiceAccountKey = (
    value: unknown
  ): { valid: boolean; error?: string; key?: ServiceAccountKey } => {
    if (!isRecord(value)) {
      return { valid: false, error: 'Service account key must be a JSON object.' };
    }

    const required = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
    const missing = required.filter((field) => !toRequiredString(value, field));

    if (missing.length > 0) {
      return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
    }

    if (toRequiredString(value, 'type') !== 'service_account') {
      return { valid: false, error: 'Invalid service account key type. Expected "service_account".' };
    }

    const key: ServiceAccountKey = {
      type: 'service_account',
      project_id: toRequiredString(value, 'project_id'),
      private_key_id: toRequiredString(value, 'private_key_id'),
      private_key: toRequiredString(value, 'private_key'),
      client_email: toRequiredString(value, 'client_email'),
      client_id: toRequiredString(value, 'client_id'),
      auth_uri: toRequiredString(value, 'auth_uri'),
      token_uri: toRequiredString(value, 'token_uri'),
      auth_provider_x509_cert_url: toRequiredString(value, 'auth_provider_x509_cert_url'),
      client_x509_cert_url: toRequiredString(value, 'client_x509_cert_url'),
    };

    return { valid: true, key };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processFile(file);
    event.target.value = '';
  };

  const processFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);

    try {
      const content = await file.text();
      const json = JSON.parse(content);

      const validation = validateServiceAccountKey(json);
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid service account key');
        return;
      }
      if (!validation.key) {
        setUploadError('Invalid service account key');
        return;
      }

      const name = validation.key.client_email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '-') + '-service-account';

      await createServiceAccount(name, validation.key);

      await loadServiceAccounts();
    } catch (err) {
      console.error('Error processing service account file:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload service account');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setUploadError('Please upload a JSON file');
      return;
    }

    await processFile(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await deleteServiceAccount(id);
      await loadServiceAccounts();
    } catch (err) {
      console.error('Error deleting service account:', err);
    }
  };

  const handleTest = async (id: string, name: string) => {
    try {
      const result = await testServiceAccount(id);
      setTestResults(new Map(testResults).set(id, {
        success: result.success,
        message: result.success ? 'Connection successful' : 'Connection failed',
      }));

      setTimeout(() => {
        setTestResults(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      }, 3000);
    } catch (err) {
      setTestResults(new Map(testResults).set(id, {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Service Accounts</h1>
        <p className="text-slate-400">Manage your GCP service account credentials for accessing network data.</p>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Add Service Account</h2>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-600 hover:border-slate-500'
            }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <svg
            className="w-12 h-12 text-slate-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-slate-400 mb-4">
            Drag and drop your service account JSON file here, or click to browse
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => {
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Select JSON File'}
          </button>
          <p className="text-xs text-slate-500 mt-3">
            Service account JSON files can be downloaded from{' '}
            <a
              href="https://console.cloud.google.com/iam-admin/serviceaccounts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              GCP Console
            </a>
          </p>
        </div>

        {uploadError && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">{uploadError}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Existing Service Accounts</h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : serviceAccounts.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <svg
              className="w-12 h-12 text-slate-600 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
            <p>No service accounts configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {serviceAccounts.map((account) => (
              <div
                key={account.id}
                className="bg-slate-900 rounded-lg border border-slate-700 p-4 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{account.name}</h3>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-slate-400">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      {account.projectId}
                    </span>
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      {account.accountEmail}
                    </span>
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {formatDate(account.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => onSelectAccount(account.id)}
                    className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg text-sm font-medium transition-colors"
                  >
                    Use Account
                  </button>
                  {testResults.has(account.id) && (
                    <div
                      className={`text-sm px-3 py-1 rounded-md ${testResults.get(account.id)?.success
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                        }`}
                    >
                      {testResults.get(account.id)?.message}
                    </div>
                  )}
                  <button
                    onClick={() => handleTest(account.id, account.name)}
                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Test Connection"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(account.id, account.name)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

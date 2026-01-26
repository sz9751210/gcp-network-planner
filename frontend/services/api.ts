const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ServiceAccount {
  id: string;
  name: string;
  projectId: string;
  accountEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface GcpProjectResponse {
  projectId: string;
  name: string;
  number: string;
}

export async function fetchServiceAccounts(): Promise<ServiceAccount[]> {
  const response = await fetch(`${API_BASE_URL}/api/credentials`);

  if (!response.ok) {
    throw new Error('Failed to fetch service accounts');
  }

  return response.json();
}

export async function createServiceAccount(
  name: string,
  serviceAccountKey: any
): Promise<ServiceAccount> {
  const response = await fetch(`${API_BASE_URL}/api/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, serviceAccountKey }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create service account');
  }

  return response.json();
}

export async function deleteServiceAccount(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/credentials/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete service account');
  }
}

export async function testServiceAccount(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/credentials/${id}/test`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to test service account');
  }

  return response.json();
}

export async function fetchGcpProjects(
  serviceAccountId: string
): Promise<GcpProjectResponse[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/gcp?serviceAccountId=${serviceAccountId}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch GCP projects');
  }

  return response.json();
}

export async function fetchAllGcpData(
  serviceAccountId: string
): Promise<any[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/gcp/all-data?serviceAccountId=${serviceAccountId}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch GCP data');
  }

  return response.json();
}

export async function exportData(
  serviceAccountId: string,
  format: 'json' | 'csv' = 'json'
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/gcp/export?serviceAccountId=${serviceAccountId}&format=${format}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to export data');
  }

  return response.blob();
}

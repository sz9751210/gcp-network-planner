import prisma from '../utils/database';
import { encrypt, decrypt, isValidEncryptionKey } from '../utils/encryption';
import { CreateServiceAccountInput, ServiceAccountKey } from '../types/credentials';
import { GoogleAuth } from 'google-auth-library';

export class CredentialService {
  private encryptionKey: string;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || !isValidEncryptionKey(key)) {
      throw new Error(
        'Invalid ENCRYPTION_KEY environment variable. Must be 64-character hex string.'
      );
    }
    this.encryptionKey = key;
  }

  async createServiceAccount(input: CreateServiceAccountInput) {
    const { name, serviceAccountKey } = input;

    const encryptedKey = encrypt(JSON.stringify(serviceAccountKey), this.encryptionKey);

    const serviceAccount = await prisma.serviceAccount.create({
      data: {
        name,
        projectId: serviceAccountKey.project_id,
        accountEmail: serviceAccountKey.client_email,
        encryptedKey,
      },
    });

    return {
      id: serviceAccount.id,
      name: serviceAccount.name,
      projectId: serviceAccount.projectId,
      accountEmail: serviceAccount.accountEmail,
      createdAt: serviceAccount.createdAt,
    };
  }

  async getAllServiceAccounts() {
    const serviceAccounts = await prisma.serviceAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        projectId: true,
        accountEmail: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return serviceAccounts;
  }

  async getServiceAccountById(id: string) {
    const serviceAccount = await prisma.serviceAccount.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        projectId: true,
        accountEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!serviceAccount) {
      throw new Error('Service account not found');
    }

    return serviceAccount;
  }

  async getDecryptedCredentials(id: string): Promise<ServiceAccountKey> {
    const serviceAccount = await prisma.serviceAccount.findUnique({
      where: { id, isActive: true },
    });

    if (!serviceAccount) {
      throw new Error('Service account not found');
    }

    try {
      const decrypted = decrypt(serviceAccount.encryptedKey, this.encryptionKey);
      return JSON.parse(decrypted) as ServiceAccountKey;
    } catch (error) {
      throw new Error('Failed to decrypt credentials');
    }
  }

  async getAuthClient(id: string) {
    const credentials = await this.getDecryptedCredentials(id);

    const auth = new GoogleAuth({
      credentials,
      projectId: credentials.project_id,
    });

    return auth;
  }

  async deleteServiceAccount(id: string) {
    const serviceAccount = await prisma.serviceAccount.findUnique({
      where: { id },
    });

    if (!serviceAccount) {
      throw new Error('Service account not found');
    }

    await prisma.serviceAccount.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Service account deleted successfully' };
  }

  async testConnection(id: string): Promise<boolean> {
    try {
      const auth = await this.getAuthClient(id);
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      return !!accessToken.token;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

export default new CredentialService();

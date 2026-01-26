import express from 'express';
import { createServiceAccountSchema } from '../types/credentials';
import credentialService from '../services/credentialService';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const input = createServiceAccountSchema.parse(req.body);
    const serviceAccount = await credentialService.createServiceAccount(input);
    res.status(201).json(serviceAccount);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error creating service account:', error);
      res.status(500).json({ error: 'Failed to create service account' });
    }
  }
});

router.get('/', async (req, res) => {
  try {
    const serviceAccounts = await credentialService.getAllServiceAccounts();
    res.json(serviceAccounts);
  } catch (error: any) {
    console.error('Error fetching service accounts:', error);
    res.status(500).json({ error: 'Failed to fetch service accounts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const serviceAccount = await credentialService.getServiceAccountById(req.params.id);
    res.json(serviceAccount);
  } catch (error: any) {
    if (error.message === 'Service account not found') {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Error fetching service account:', error);
      res.status(500).json({ error: 'Failed to fetch service account' });
    }
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await credentialService.deleteServiceAccount(req.params.id);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'Service account not found') {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Error deleting service account:', error);
      res.status(500).json({ error: 'Failed to delete service account' });
    }
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const success = await credentialService.testConnection(req.params.id);
    res.json({ success, message: success ? 'Connection successful' : 'Connection failed' });
  } catch (error: any) {
    console.error('Error testing connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

export default router;

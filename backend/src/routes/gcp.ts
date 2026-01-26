import express from 'express';
import gcpDataService from '../services/gcpDataService';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { serviceAccountId } = req.query;

    if (!serviceAccountId || typeof serviceAccountId !== 'string') {
      return res.status(400).json({ error: 'serviceAccountId query parameter is required' });
    }

    const projects = await gcpDataService.fetchProjects(serviceAccountId);
    res.json(projects);
  } catch (error: any) {
    console.error('Error fetching GCP projects:', error);
    res.status(500).json({ error: 'Failed to fetch GCP projects', details: error.message });
  }
});

router.get('/all-data', async (req, res) => {
  try {
    const { serviceAccountId } = req.query;

    if (!serviceAccountId || typeof serviceAccountId !== 'string') {
      return res.status(400).json({ error: 'serviceAccountId query parameter is required' });
    }

    const data = await gcpDataService.fetchAllProjectData(serviceAccountId);
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching GCP project data:', error);
    res.status(500).json({ error: 'Failed to fetch GCP project data', details: error.message });
  }
});

router.get('/:projectId/vpcs', async (req, res) => {
  try {
    const { serviceAccountId } = req.query;

    if (!serviceAccountId || typeof serviceAccountId !== 'string') {
      return res.status(400).json({ error: 'serviceAccountId query parameter is required' });
    }

    const vpcs = await gcpDataService.fetchVpcs(serviceAccountId, req.params.projectId);
    res.json(vpcs);
  } catch (error: any) {
    console.error('Error fetching VPCs:', error);
    res.status(500).json({ error: 'Failed to fetch VPCs', details: error.message });
  }
});

router.get('/:projectId/firewalls', async (req, res) => {
  try {
    const { serviceAccountId } = req.query;

    if (!serviceAccountId || typeof serviceAccountId !== 'string') {
      return res.status(400).json({ error: 'serviceAccountId query parameter is required' });
    }

    const firewalls = await gcpDataService.fetchFirewallRules(serviceAccountId, req.params.projectId);
    res.json(firewalls);
  } catch (error: any) {
    console.error('Error fetching firewall rules:', error);
    res.status(500).json({ error: 'Failed to fetch firewall rules', details: error.message });
  }
});

router.get('/:projectId/instances', async (req, res) => {
  try {
    const { serviceAccountId } = req.query;

    if (!serviceAccountId || typeof serviceAccountId !== 'string') {
      return res.status(400).json({ error: 'serviceAccountId query parameter is required' });
    }

    const instances = await gcpDataService.fetchInstances(serviceAccountId, req.params.projectId);
    res.json(instances);
  } catch (error: any) {
    console.error('Error fetching instances:', error);
    res.status(500).json({ error: 'Failed to fetch instances', details: error.message });
  }
});

export default router;

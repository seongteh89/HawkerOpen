import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { config } from '../config.js';
import { syncFromNea } from '../services/syncService.js';

export const adminRouter = Router();

adminRouter.post('/sync', asyncHandler(async (req, res) => {
  const token = req.header('x-admin-token');
  if (token !== config.adminSyncToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await syncFromNea();
  res.json(result);
}));

import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { query } from '../db.js';
export const devicesRouter = Router();
devicesRouter.post('/register', asyncHandler(async (req, res) => {
    const deviceId = String(req.body?.deviceId ?? '').trim();
    const platform = String(req.body?.platform ?? '').trim() || null;
    if (!deviceId) {
        res.status(400).json({ error: 'deviceId is required' });
        return;
    }
    const result = await query(`
      INSERT INTO app_users (device_id, platform)
      VALUES ($1, $2)
      ON CONFLICT (device_id)
      DO UPDATE SET platform = EXCLUDED.platform
      RETURNING id, device_id, platform
    `, [deviceId, platform]);
    res.json({ user: result.rows[0] });
}));

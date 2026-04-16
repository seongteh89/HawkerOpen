import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { query } from '../db.js';
import { getUserFavourites } from '../services/hawkerService.js';
export const usersRouter = Router();
usersRouter.get('/:userId/favourites', asyncHandler(async (req, res) => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
    }
    const items = await getUserFavourites(userId, date);
    res.json({ items });
}));
usersRouter.put('/:userId/favourites/:hawkerId', asyncHandler(async (req, res) => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const hawkerId = Array.isArray(req.params.hawkerId) ? req.params.hawkerId[0] : req.params.hawkerId;
    if (!userId || !hawkerId) {
        res.status(400).json({ error: 'userId and hawkerId are required' });
        return;
    }
    await query(`
      INSERT INTO user_favourites (user_id, hawker_centre_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, hawker_centre_id) DO NOTHING
    `, [userId, hawkerId]);
    res.status(204).send();
}));
usersRouter.delete('/:userId/favourites/:hawkerId', asyncHandler(async (req, res) => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const hawkerId = Array.isArray(req.params.hawkerId) ? req.params.hawkerId[0] : req.params.hawkerId;
    if (!userId || !hawkerId) {
        res.status(400).json({ error: 'userId and hawkerId are required' });
        return;
    }
    await query(`DELETE FROM user_favourites WHERE user_id = $1 AND hawker_centre_id = $2`, [userId, hawkerId]);
    res.status(204).send();
}));

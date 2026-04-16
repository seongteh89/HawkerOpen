import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { query } from '../db.js';
import { getUserFavourites } from '../services/hawkerService.js';

export const usersRouter = Router();

usersRouter.get('/:userId/favourites', asyncHandler(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const items = await getUserFavourites(req.params.userId, date);
  res.json({ items });
}));

usersRouter.put('/:userId/favourites/:hawkerId', asyncHandler(async (req, res) => {
  await query(
    `
      INSERT INTO user_favourites (user_id, hawker_centre_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, hawker_centre_id) DO NOTHING
    `,
    [req.params.userId, req.params.hawkerId]
  );
  res.status(204).send();
}));

usersRouter.delete('/:userId/favourites/:hawkerId', asyncHandler(async (req, res) => {
  await query(
    `DELETE FROM user_favourites WHERE user_id = $1 AND hawker_centre_id = $2`,
    [req.params.userId, req.params.hawkerId]
  );
  res.status(204).send();
}));

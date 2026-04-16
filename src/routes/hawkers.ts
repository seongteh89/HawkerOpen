import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import {
  getAlternatives,
  getHawkerDetail,
  getHawkerMeta,
  getNearbyHawkers,
  searchHawkers,
} from '../services/hawkerService.js';

export const hawkersRouter = Router();

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

hawkersRouter.get('/nearby', asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat and lng are required numeric query parameters' });
    return;
  }

  const items = await getNearbyHawkers({ lat, lng, radiusKm, limit, date });
  res.json({ items });
}));

hawkersRouter.get('/search', asyncHandler(async (req, res) => {
  const queryText = String(req.query.q ?? '').trim();
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lng = req.query.lng ? Number(req.query.lng) : undefined;
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;

  if (!queryText) {
    res.status(400).json({ error: 'q is required' });
    return;
  }

  const items = await searchHawkers({
    queryText,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    limit,
    date,
  });

  res.json({ items });
}));

hawkersRouter.get('/meta', asyncHandler(async (_req, res) => {
  const meta = await getHawkerMeta();
  res.json(meta);
}));

hawkersRouter.get('/:id/alternatives', asyncHandler(async (req, res) => {
  const hawkerId = firstParam(req.params.id);
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;

  if (!hawkerId) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat and lng are required numeric query parameters' });
    return;
  }

  const items = await getAlternatives({
    hawkerId,
    lat,
    lng,
    radiusKm,
    limit,
    date,
  });

  res.json({ items });
}));

hawkersRouter.get('/:id', asyncHandler(async (req, res) => {
  const hawkerId = firstParam(req.params.id);
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;

  if (!hawkerId) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const item = await getHawkerDetail(hawkerId, date);

  if (!item) {
    res.status(404).json({ error: 'Hawker centre not found' });
    return;
  }

  res.json({ item });
}));
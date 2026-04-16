import { query } from '../db.js';
import { getSingaporeToday } from '../lib/date.js';
function distanceSql(latParamIndex, lngParamIndex) {
    return `
    (
      6371 * acos(
        LEAST(
          1,
          cos(radians($${latParamIndex})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($${lngParamIndex})) +
          sin(radians($${latParamIndex})) * sin(radians(latitude))
        )
      )
    )
  `;
}
function statusFromEventType(eventType) {
    if (eventType === 'cleaning')
        return 'closed_cleaning';
    if (eventType === 'rr')
        return 'closed_rr';
    return 'closed_other_works';
}
async function getActiveClosures(hawkerIds, date) {
    if (hawkerIds.length === 0)
        return new Map();
    const result = await query(`
      SELECT DISTINCT ON (hawker_centre_id)
        hawker_centre_id,
        event_type,
        title,
        start_date::text,
        end_date::text,
        remarks,
        source_quarter
      FROM closure_events
      WHERE hawker_centre_id = ANY($1::uuid[])
        AND $2::date BETWEEN start_date AND end_date
      ORDER BY
        hawker_centre_id,
        CASE event_type
          WHEN 'rr' THEN 1
          WHEN 'other_works' THEN 2
          WHEN 'cleaning' THEN 3
          ELSE 4
        END
    `, [hawkerIds, date]);
    return new Map(result.rows.map((row) => [row.hawker_centre_id, row]));
}
function mergeWithStatus(hawkers, closures) {
    return hawkers.map((hawker) => {
        const active = closures.get(hawker.id) ?? null;
        return {
            ...hawker,
            distance_km: hawker.distance_km ?? null,
            status: active ? statusFromEventType(active.event_type) : 'open',
            active_closure: active,
        };
    });
}
export async function getNearbyHawkers(input) {
    const radiusKm = input.radiusKm ?? 5;
    const limit = input.limit ?? 20;
    const date = input.date ?? getSingaporeToday();
    const distExpr = distanceSql(1, 2);
    const result = await query(`
      SELECT id, slug, name, address, latitude, longitude, photo_url, description, no_market_stalls, no_food_stalls, source_status,
        ${distExpr} AS distance_km
      FROM hawker_centres
      WHERE ${distExpr} <= $3
      ORDER BY distance_km ASC, name ASC
      LIMIT $4
    `, [input.lat, input.lng, radiusKm, limit]);
    const closures = await getActiveClosures(result.rows.map((row) => row.id), date);
    return mergeWithStatus(result.rows, closures);
}
function normalizeSearchText(input) {
    return input
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}
function compactSearchText(input) {
    return normalizeSearchText(input).replace(/\s+/g, '');
}
function combinedCompactExpr() {
    return `regexp_replace(lower(coalesce(name, '') || ' ' || coalesce(address, '')), '[^a-z0-9]+', '', 'g')`;
}
export async function searchHawkers(input) {
    const limit = input.limit ?? 20;
    const date = input.date ?? getSingaporeToday();
    const normalizedQuery = normalizeSearchText(input.queryText);
    const compactQuery = compactSearchText(input.queryText);
    const tokens = normalizedQuery.split(' ').filter((token) => token.length >= 2);
    const compactExpr = combinedCompactExpr();
    const params = [`%${normalizedQuery}%`, `%${compactQuery}%`];
    const tokenMatchClauses = [];
    for (const token of tokens) {
        const idx = params.length + 1;
        tokenMatchClauses.push(`
      (
        lower(coalesce(name, '')) LIKE $${idx}
        OR lower(coalesce(address, '')) LIKE $${idx}
        OR ${compactExpr} LIKE $${idx}
      )
    `);
        params.push(`%${token}%`);
    }
    const whereParts = [
        `lower(coalesce(name, '')) LIKE $1`,
        `lower(coalesce(address, '')) LIKE $1`,
        `${compactExpr} LIKE $2`,
    ];
    if (tokenMatchClauses.length > 0) {
        whereParts.push(`(${tokenMatchClauses.join(' AND ')})`);
    }
    const matchRankExpr = `
    CASE
      WHEN lower(coalesce(name, '')) LIKE $1 THEN 0
      WHEN ${compactExpr} LIKE $2 THEN 1
      WHEN lower(coalesce(address, '')) LIKE $1 THEN 2
      ELSE 3
    END
  `;
    let sql;
    if (typeof input.lat === 'number' && typeof input.lng === 'number') {
        const latIndex = params.length + 1;
        params.push(input.lat);
        const lngIndex = params.length + 1;
        params.push(input.lng);
        const limitIndex = params.length + 1;
        params.push(limit);
        const distExpr = distanceSql(latIndex, lngIndex);
        sql = `
      SELECT
        id,
        slug,
        name,
        address,
        latitude,
        longitude,
        photo_url,
        description,
        no_market_stalls,
        no_food_stalls,
        source_status,
        ${distExpr} AS distance_km,
        ${matchRankExpr} AS match_rank
      FROM hawker_centres
      WHERE ${whereParts.join('\n        OR ')}
      ORDER BY match_rank ASC, distance_km ASC NULLS LAST, name ASC
      LIMIT $${limitIndex}
    `;
    }
    else {
        const limitIndex = params.length + 1;
        params.push(limit);
        sql = `
      SELECT
        id,
        slug,
        name,
        address,
        latitude,
        longitude,
        photo_url,
        description,
        no_market_stalls,
        no_food_stalls,
        source_status,
        NULL::double precision AS distance_km,
        ${matchRankExpr} AS match_rank
      FROM hawker_centres
      WHERE ${whereParts.join('\n        OR ')}
      ORDER BY match_rank ASC, name ASC
      LIMIT $${limitIndex}
    `;
    }
    const result = await query(sql, params);
    const closures = await getActiveClosures(result.rows.map((row) => row.id), date);
    return mergeWithStatus(result.rows, closures);
}
export async function getHawkerDetail(id, date) {
    const targetDate = date ?? getSingaporeToday();
    const result = await query(`
      SELECT id, slug, name, address, latitude, longitude, photo_url, description, no_market_stalls, no_food_stalls, source_status
      FROM hawker_centres
      WHERE id = $1
      LIMIT 1
    `, [id]);
    const hawker = result.rows[0];
    if (!hawker)
        return null;
    const closures = await getActiveClosures([id], targetDate);
    return mergeWithStatus([hawker], closures)[0];
}
export async function getAlternatives(input) {
    const radiusKm = input.radiusKm ?? 3;
    const limit = input.limit ?? 5;
    const date = input.date ?? getSingaporeToday();
    const distExpr = distanceSql(2, 3);
    const result = await query(`
      SELECT id, slug, name, address, latitude, longitude, photo_url, description, no_market_stalls, no_food_stalls, source_status,
        ${distExpr} AS distance_km
      FROM hawker_centres
      WHERE id <> $1
        AND ${distExpr} <= $4
      ORDER BY distance_km ASC, name ASC
      LIMIT $5
    `, [input.hawkerId, input.lat, input.lng, radiusKm, limit * 3]);
    const closures = await getActiveClosures(result.rows.map((row) => row.id), date);
    return mergeWithStatus(result.rows, closures).filter((item) => item.status === 'open').slice(0, limit);
}
export async function getUserFavourites(userId, date) {
    const targetDate = date ?? getSingaporeToday();
    const result = await query(`
      SELECT h.id, h.slug, h.name, h.address, h.latitude, h.longitude, h.photo_url, h.description, h.no_market_stalls, h.no_food_stalls, h.source_status
      FROM user_favourites f
      INNER JOIN hawker_centres h ON h.id = f.hawker_centre_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `, [userId]);
    const closures = await getActiveClosures(result.rows.map((row) => row.id), targetDate);
    return mergeWithStatus(result.rows, closures);
}
export async function getHawkerMeta() {
    const result = await query(`
      SELECT completed_at::text
      FROM sync_runs
      WHERE source_name = 'nea_hawker_closures'
        AND status = 'success'
      ORDER BY completed_at DESC NULLS LAST, started_at DESC
      LIMIT 1
    `);
    const lastSuccessfulSyncAt = result.rows[0]?.completed_at ?? null;
    let freshness = 'unknown';
    if (lastSuccessfulSyncAt) {
        const ageMs = Date.now() - new Date(lastSuccessfulSyncAt).getTime();
        freshness = ageMs <= 24 * 60 * 60 * 1000 ? 'fresh' : 'stale';
    }
    return {
        data_source_label: 'Based on latest official NEA schedule',
        last_successful_sync_at: lastSuccessfulSyncAt,
        freshness,
    };
}

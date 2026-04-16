import { PoolClient } from 'pg';
import { config } from '../config.js';
import { withTransaction } from '../db.js';
import { parseSingaporeDate } from '../lib/date.js';
import { slugify, toNumber } from '../lib/text.js';
import { NeaClosureRecord } from '../types.js';

const DATASTORE_SEARCH_URL = 'https://data.gov.sg/api/action/datastore_search';

function getField(record: NeaClosureRecord, key: string): unknown {
  return record[key];
}

function classifyOtherWorks(remarks: string | null): 'rr' | 'other_works' {
  const text = (remarks ?? '').toLowerCase();
  if (/(repair|redecoration|renovation|upgrading|rebuilding|transformation|hup)/i.test(text)) {
    return 'rr';
  }
  return 'other_works';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchClosureDataset(): Promise<NeaClosureRecord[]> {
  const url = `${DATASTORE_SEARCH_URL}?resource_id=${config.neaClosureDatasetId}&limit=500`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url);

    if (response.ok) {
      const payload = await response.json();
      return payload?.result?.records ?? [];
    }

    if (response.status === 429 && attempt < 3) {
      await sleep(attempt * 5000);
      continue;
    }

    throw new Error(`Failed to fetch NEA closure dataset: ${response.status} ${response.statusText}`);
  }

  throw new Error('Failed to fetch NEA closure dataset after retries');
}

async function upsertHawker(client: PoolClient, record: NeaClosureRecord): Promise<string> {
  const name = String(getField(record, 'name') ?? '').trim();
  if (!name) {
    throw new Error('Encountered hawker record without name');
  }

  const slug = slugify(name);
  const latitude = toNumber(getField(record, 'latitude_hc'), Number.NaN);
  const longitude = toNumber(getField(record, 'longitude_hc'), Number.NaN);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`Invalid coordinates for hawker centre: ${name}`);
  }

  const result = await client.query<{ id: string }>(
    `
      INSERT INTO hawker_centres (
        slug, name, address, latitude, longitude, photo_url, description,
        no_market_stalls, no_food_stalls, source_status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        photo_url = EXCLUDED.photo_url,
        description = EXCLUDED.description,
        no_market_stalls = EXCLUDED.no_market_stalls,
        no_food_stalls = EXCLUDED.no_food_stalls,
        source_status = EXCLUDED.source_status
      RETURNING id
    `,
    [
      slug,
      name,
      String(getField(record, 'address_myenv') ?? '').trim() || null,
      latitude,
      longitude,
      String(getField(record, 'photourl') ?? '').trim() || null,
      String(getField(record, 'description_myenv') ?? '').trim() || null,
      toNumber(getField(record, 'no_of_market_stalls'), 0),
      toNumber(getField(record, 'no_of_food_stalls'), 0),
      String(getField(record, 'status') ?? '').trim() || null,
    ]
  );

  return result.rows[0].id;
}

async function insertEvent(
  client: PoolClient,
  hawkerCentreId: string,
  eventType: 'cleaning' | 'rr' | 'other_works',
  title: string,
  startDate: string | null,
  endDate: string | null,
  remarks: string | null,
  sourceQuarter: string
): Promise<boolean> {
  if (!startDate || !endDate) return false;

  await client.query(
    `
      INSERT INTO closure_events (
        hawker_centre_id, event_type, title, start_date, end_date, remarks, source_quarter
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [hawkerCentreId, eventType, title, startDate, endDate, remarks, sourceQuarter]
  );

  return true;
}

export async function syncFromNea(): Promise<{ rowsProcessed: number; eventsInserted: number }> {
  const records = await fetchClosureDataset();

  return withTransaction(async (client) => {
    const syncRun = await client.query<{ id: string }>(
      `
        INSERT INTO sync_runs (source_name, status, rows_processed, notes)
        VALUES ('nea_hawker_closures', 'running', 0, NULL)
        RETURNING id
      `
    );

    const syncRunId = syncRun.rows[0].id;
    let eventsInserted = 0;

    try {
      await client.query('DELETE FROM closure_events');

      for (const record of records) {
        const hawkerCentreId = await upsertHawker(client, record);

        const quarters = [
          { title: 'Quarter 1 cleaning', start: parseSingaporeDate(getField(record, 'q1_cleaningstartdate')), end: parseSingaporeDate(getField(record, 'q1_cleaningenddate')), remarks: String(getField(record, 'remarks_q1') ?? '').trim() || null, sourceQuarter: 'Q1' },
          { title: 'Quarter 2 cleaning', start: parseSingaporeDate(getField(record, 'q2_cleaningstartdate')), end: parseSingaporeDate(getField(record, 'q2_cleaningenddate')), remarks: String(getField(record, 'remarks_q2') ?? '').trim() || null, sourceQuarter: 'Q2' },
          { title: 'Quarter 3 cleaning', start: parseSingaporeDate(getField(record, 'q3_cleaningstartdate')), end: parseSingaporeDate(getField(record, 'q3_cleaningenddate')), remarks: String(getField(record, 'remarks_q3') ?? '').trim() || null, sourceQuarter: 'Q3' },
          { title: 'Quarter 4 cleaning', start: parseSingaporeDate(getField(record, 'q4_cleaningstartdate')), end: parseSingaporeDate(getField(record, 'q4_cleaningenddate')), remarks: String(getField(record, 'remarks_q4') ?? '').trim() || null, sourceQuarter: 'Q4' },
        ];

        for (const quarter of quarters) {
          const inserted = await insertEvent(client, hawkerCentreId, 'cleaning', quarter.title, quarter.start, quarter.end, quarter.remarks, quarter.sourceQuarter);
          if (inserted) eventsInserted += 1;
        }

        const otherWorksRemarks = String(getField(record, 'remarks_other_works') ?? '').trim() || null;
        const otherWorksInserted = await insertEvent(
          client,
          hawkerCentreId,
          classifyOtherWorks(otherWorksRemarks),
          'Other works',
          parseSingaporeDate(getField(record, 'other_works_startdate')),
          parseSingaporeDate(getField(record, 'other_works_enddate')),
          otherWorksRemarks,
          'OTHER_WORKS'
        );
        if (otherWorksInserted) eventsInserted += 1;
      }

      await client.query(
        `UPDATE sync_runs SET status = 'success', rows_processed = $2, notes = $3, completed_at = NOW() WHERE id = $1`,
        [syncRunId, records.length, `Inserted ${eventsInserted} closure events`]
      );

      return { rowsProcessed: records.length, eventsInserted };
    } catch (error) {
      await client.query(
        `UPDATE sync_runs SET status = 'failed', rows_processed = $2, notes = $3, completed_at = NOW() WHERE id = $1`,
        [syncRunId, records.length, error instanceof Error ? error.message : 'Unknown error']
      );
      throw error;
    }
  });
}

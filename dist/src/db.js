import 'dotenv/config';
import { Pool } from 'pg';
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL in api/.env');
}
export const pool = new Pool({
    connectionString: databaseUrl,
});
export async function query(text, params = []) {
    return pool.query(text, params);
}
export async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function closePool() {
    await pool.end();
}

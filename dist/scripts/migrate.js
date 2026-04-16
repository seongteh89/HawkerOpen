import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function main() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
        throw new Error('Missing DATABASE_URL in api/.env');
    }
    const sqlPath = path.resolve(__dirname, '../sql/init.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    const client = new Client({
        connectionString: databaseUrl,
    });
    await client.connect();
    try {
        await client.query(sql);
        console.log('Migration completed successfully');
    }
    finally {
        await client.end();
    }
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});

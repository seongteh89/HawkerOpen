import dotenv from 'dotenv';
dotenv.config();
function required(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
export const config = {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    adminSyncToken: required('ADMIN_SYNC_TOKEN', 'change-me'),
    neaClosureDatasetId: required('NEA_CLOSURE_DATASET_ID', 'd_bda4baa634dd1cc7a6c7cad5f19e2d68'),
};

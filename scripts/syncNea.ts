import { closePool } from '../src/db.js';
import { syncFromNea } from '../src/services/syncService.js';

async function main(): Promise<void> {
  const result = await syncFromNea();
  console.log('NEA sync completed:', result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

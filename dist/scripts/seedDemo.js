import { withTransaction, closePool } from '../src/db.js';
import { slugify } from '../src/lib/text.js';
async function main() {
    await withTransaction(async (client) => {
        await client.query('DELETE FROM user_favourites');
        await client.query('DELETE FROM closure_events');
        await client.query('DELETE FROM hawker_centres');
        const demoHawkers = [
            { name: 'Redhill Food Centre', address: '85 Redhill Lane, Singapore', latitude: 1.2879, longitude: 103.8187, photo_url: null, description: 'Demo data for local testing' },
            { name: 'ABC Brickworks Market & Food Centre', address: '6 Jalan Bukit Merah, Singapore', latitude: 1.2868, longitude: 103.8082, photo_url: null, description: 'Demo data for local testing' },
            { name: 'Tiong Bahru Market', address: '30 Seng Poh Road, Singapore 168898', latitude: 1.2848, longitude: 103.8322, photo_url: null, description: 'Demo data for local testing' },
        ];
        const ids = [];
        for (const item of demoHawkers) {
            const result = await client.query(`
          INSERT INTO hawker_centres (slug, name, address, latitude, longitude, photo_url, description)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING id
        `, [slugify(item.name), item.name, item.address, item.latitude, item.longitude, item.photo_url, item.description]);
            ids.push(result.rows[0].id);
        }
        await client.query(`
        INSERT INTO closure_events (hawker_centre_id, event_type, title, start_date, end_date, remarks, source_quarter)
        VALUES
          ($1, 'cleaning', 'Quarter 2 cleaning', CURRENT_DATE, CURRENT_DATE + 1, 'Demo cleaning closure', 'Q2'),
          ($2, 'rr', 'Other works', CURRENT_DATE, CURRENT_DATE + 14, 'Demo repairs and redecoration', 'OTHER_WORKS')
      `, [ids[0], ids[1]]);
    });
    console.log('Demo seed completed');
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await closePool();
});

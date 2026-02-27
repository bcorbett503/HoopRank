const { BASE } = require('./lib.js');

async function runVerification() {
    console.log(`\n🏀 Verification Suite: NYC Seeded Runs`);
    console.log(`========================================`);

    // The newly created court IDs from the background job output
    const checkCourts = [
        { name: 'McBurney YMCA', id: 'f6822ad5-4951-4087-a937-1741f5e940fa' },
        { name: 'Chelsea Piers Fitness', id: 'e7b3540b-2c53-41a1-b3b5-b12eb30c3561' },
        { name: 'Major R. Owens', id: '883aa1cd-545f-4f53-a670-90dd0c17b7fd' },
        { name: 'Artistic Sports Complex', id: 'ad1a2c4d-88ff-4dd0-859b-053d39e6e596' }
    ];

    let totalVerified = 0;

    for (const c of checkCourts) {
        try {
            const res = await fetch(`${BASE}/courts/${c.id}/runs`, {
                headers: {
                    'x-user-id': 'Nb6UhM5ExOeUMWIRMeaxswVnLQl2',
                    'x-admin-secret': process.env.ADMIN_SECRET
                }
            });
            if (!res.ok) {
                console.error(`✗ Failed to fetch runs for ${c.name} (${res.status})`);
                continue;
            }
            const runs = await res.json();

            console.log(`✓ ${c.name}: Found ${runs.length} upcoming scheduled runs`);
            if (runs.length > 0) {
                console.log(`   - Sample next run: ${runs[0].title} at ${new Date(runs[0].scheduledAt).toLocaleString()}`);
            }
            totalVerified += runs.length;
        } catch (e) {
            console.error(`✗ Error on ${c.name}: ${e.message}`);
        }
    }

    console.log(`========================================`);
    console.log(`Totals: Verified ${totalVerified} future run instances across sample NYC courts.`);
}

runVerification();

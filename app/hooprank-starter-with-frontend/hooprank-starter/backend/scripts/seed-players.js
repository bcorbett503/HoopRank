// Seed test players to production via HTTP API
const https = require('https');

const PROD_URL = 'heartfelt-appreciation-production-65f1.up.railway.app';

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: PROD_URL,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

const mockPlayers = [
    {
        id: 'mock-player-lebron',
        email: 'lebron@example.com',
        name: 'LeBron James',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/LeBron_James_crop_2020.jpg',
        position: 'F',
        height: "6'9\"",
        weight: '250 lbs',
        age: 39,
    },
    {
        id: 'mock-player-curry',
        email: 'curry@example.com',
        name: 'Stephen Curry',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Stephen_Curry_2016_June_16.jpg',
        position: 'G',
        height: "6'2\"",
        weight: '185 lbs',
        age: 36,
    },
    {
        id: 'mock-player-durant',
        email: 'durant@example.com',
        name: 'Kevin Durant',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Kevin_Durant_2018_June_08.jpg',
        position: 'F',
        height: "6'10\"",
        weight: '240 lbs',
        age: 35,
    },
    {
        id: 'mock-player-jokic',
        email: 'jokic@example.com',
        name: 'Nikola Jokic',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Nikola_Joki%C4%87_2019.jpg',
        position: 'C',
        height: "6'11\"",
        weight: '284 lbs',
        age: 29,
    },
    {
        id: 'mock-player-luka',
        email: 'luka@example.com',
        name: 'Luka Doncic',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Luka_Doncic_2021.jpg',
        position: 'G',
        height: "6'7\"",
        weight: '230 lbs',
        age: 25,
    },
];

async function seedPlayers() {
    console.log('🌱 Seeding test players to production...\n');

    for (const player of mockPlayers) {
        try {
            // Use the auth endpoint to create/find the user
            const authRes = await request('POST', '/users/auth', {
                id: player.id,
                email: player.email
            });
            console.log(`Created/found ${player.name}: ${authRes.status}`);

            if (authRes.status === 200 || authRes.status === 201) {
                // Update profile with details
                const userId = authRes.data.id || player.id;
                const updateRes = await request('PUT', `/users/${userId}`, {
                    name: player.name,
                    photoUrl: player.photoUrl,
                    position: player.position,
                    height: player.height,
                    weight: player.weight,
                    age: player.age,
                });
                console.log(`   Updated profile: ${updateRes.status}`);
            }
        } catch (error) {
            console.error(`❌ Error seeding ${player.name}:`, error.message);
        }
    }

    // Verify players exist
    console.log('\n📋 Verifying seeded players...');
    const usersRes = await request('GET', '/users');
    console.log(`Total users: ${Array.isArray(usersRes.data) ? usersRes.data.length : 'unknown'}`);
    if (Array.isArray(usersRes.data)) {
        usersRes.data.forEach(u => {
            console.log(`   - ${u.name || u.display_name || u.email} (${u.id.substring(0, 8)}...)`);
        });
    }

    console.log('\n✅ Done!');
}

seedPlayers();

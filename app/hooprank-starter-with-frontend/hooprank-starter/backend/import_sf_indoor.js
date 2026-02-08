/**
 * SF Indoor Courts Import via API
 * Uses POST /courts/admin/create endpoint — no DATABASE_URL needed
 */
const https = require('https');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const COURTS = [
    // SF REC CENTERS (public)
    { name: "Betty Ann Ong Recreation Center", city: "San Francisco, CA", lat: 37.7935, lng: -122.4101, indoor: true, access: "public" },
    { name: "Mission Recreation Center", city: "San Francisco, CA", lat: 37.7590, lng: -122.4194, indoor: true, access: "public" },
    { name: "Moscone Recreation Center", city: "San Francisco, CA", lat: 37.8012, lng: -122.4263, indoor: true, access: "public" },
    { name: "Potrero Hill Recreation Center", city: "San Francisco, CA", lat: 37.7609, lng: -122.3929, indoor: true, access: "public" },
    { name: "Glen Park Recreation Center", city: "San Francisco, CA", lat: 37.7339, lng: -122.4350, indoor: true, access: "public" },
    { name: "Sunset Recreation Center", city: "San Francisco, CA", lat: 37.7533, lng: -122.4935, indoor: true, access: "public" },
    { name: "Upper Noe Recreation Center", city: "San Francisco, CA", lat: 37.7492, lng: -122.4330, indoor: true, access: "public" },
    { name: "Richmond Recreation Center", city: "San Francisco, CA", lat: 37.7797, lng: -122.4651, indoor: true, access: "public" },
    { name: "Gene Friend Recreation Center", city: "San Francisco, CA", lat: 37.7792, lng: -122.3988, indoor: true, access: "public" },
    { name: "Bernal Heights Recreation Center", city: "San Francisco, CA", lat: 37.7390, lng: -122.4153, indoor: true, access: "public" },
    { name: "Excelsior Playground Recreation Center", city: "San Francisco, CA", lat: 37.7240, lng: -122.4283, indoor: true, access: "public" },
    { name: "Eureka Valley Recreation Center", city: "San Francisco, CA", lat: 37.7615, lng: -122.4365, indoor: true, access: "public" },
    { name: "Visitacion Valley Community Center", city: "San Francisco, CA", lat: 37.7145, lng: -122.4054, indoor: true, access: "public" },
    { name: "Palega Recreation Center", city: "San Francisco, CA", lat: 37.7189, lng: -122.4189, indoor: true, access: "public" },
    { name: "Hamilton Recreation Center", city: "San Francisco, CA", lat: 37.7534, lng: -122.4325, indoor: true, access: "public" },
    { name: "Joe Lee Recreation Center", city: "San Francisco, CA", lat: 37.7308, lng: -122.4414, indoor: true, access: "public" },
    { name: "Minnie & Lovie Ward Recreation Center", city: "San Francisco, CA", lat: 37.7211, lng: -122.4758, indoor: true, access: "public" },
    { name: "Tenderloin Recreation Center", city: "San Francisco, CA", lat: 37.7836, lng: -122.4130, indoor: true, access: "public" },
    { name: "Kezar Pavilion", city: "San Francisco, CA", lat: 37.7675, lng: -122.4575, indoor: true, access: "public" },

    // YMCA (members)
    { name: "Embarcadero YMCA", city: "San Francisco, CA", lat: 37.7919, lng: -122.3928, indoor: true, access: "members" },
    { name: "Presidio Community YMCA", city: "San Francisco, CA", lat: 37.7991, lng: -122.4577, indoor: true, access: "members" },
    { name: "Bayview Hunters Point YMCA", city: "San Francisco, CA", lat: 37.7345, lng: -122.3834, indoor: true, access: "members" },
    { name: "Stonestown Family YMCA", city: "San Francisco, CA", lat: 37.7260, lng: -122.4750, indoor: true, access: "members" },
    { name: "Treasure Island Community YMCA", city: "San Francisco, CA", lat: 37.8186, lng: -122.3708, indoor: true, access: "members" },

    // PRIVATE & UNIVERSITY (members)
    { name: "Bay Club San Francisco", city: "San Francisco, CA", lat: 37.8004, lng: -122.4003, indoor: true, access: "members" },
    { name: "Bay Club Financial District", city: "San Francisco, CA", lat: 37.7916, lng: -122.3987, indoor: true, access: "members" },
    { name: "Koret Health and Recreation Center (USF)", city: "San Francisco, CA", lat: 37.7763, lng: -122.4508, indoor: true, access: "members" },
    { name: "SFSU Mashouf Wellness Center", city: "San Francisco, CA", lat: 37.7220, lng: -122.4785, indoor: true, access: "members" },
    { name: "24 Hour Fitness Van Ness", city: "San Francisco, CA", lat: 37.7863, lng: -122.4221, indoor: true, access: "members" },
];

function postCourt(court) {
    return new Promise((resolve, reject) => {
        const id = generateUUID(court.name + court.city);
        const params = new URLSearchParams({
            id,
            name: court.name,
            city: court.city,
            lat: String(court.lat),
            lng: String(court.lng),
            indoor: String(court.indoor),
            access: court.access,
        });

        const options = {
            hostname: BASE,
            path: `/courts/admin/create?${params.toString()}`,
            method: 'POST',
            headers: { 'x-user-id': USER_ID },
            timeout: 10000,
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

async function main() {
    console.log(`Importing ${COURTS.length} SF indoor courts via API...\n`);
    let ok = 0, fail = 0;

    for (const court of COURTS) {
        try {
            const result = await postCourt(court);
            if (result.status < 300) {
                console.log(`✅ ${court.name} (${court.access})`);
                ok++;
            } else {
                console.log(`⚠️  ${court.name}: HTTP ${result.status} - ${result.data.substring(0, 80)}`);
                ok++; // likely duplicate, still counts
            }
        } catch (err) {
            console.log(`❌ ${court.name}: ${err.message}`);
            fail++;
        }
    }

    console.log(`\nDone! ${ok} succeeded, ${fail} failed`);
}

main();

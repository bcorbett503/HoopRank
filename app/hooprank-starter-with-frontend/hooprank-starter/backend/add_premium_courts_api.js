/**
 * Add premium courts directly to the production database via API
 */

const crypto = require('crypto');

// Generate deterministic UUID from name
function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const newCourts = [
    // Bay Club San Francisco locations
    {
        name: "Bay Club SF @ 150 Greenwich",
        city: "San Francisco, CA",
        lat: 37.7985,
        lng: -122.4005,
        indoor: true
    },
    {
        name: "Bay Club Gateway",
        city: "San Francisco, CA",
        lat: 37.7941,
        lng: -122.3959,
        indoor: true
    },
    {
        name: "Bay Club Financial District",
        city: "San Francisco, CA",
        lat: 37.7926,
        lng: -122.4036,
        indoor: true
    },
    // Additional SF venues
    {
        name: "YMCA Embarcadero SF",
        city: "San Francisco, CA",
        lat: 37.7922,
        lng: -122.3917,
        indoor: true
    },
    {
        name: "Koret Health & Recreation Center (UCSF)",
        city: "San Francisco, CA",
        lat: 37.7638,
        lng: -122.4574,
        indoor: true
    },
    // San Diego premium
    {
        name: "Bay Club Carmel Valley",
        city: "San Diego, CA",
        lat: 32.9295,
        lng: -117.2222,
        indoor: true
    },
    // Los Angeles premium
    {
        name: "Equinox Century City",
        city: "Los Angeles, CA",
        lat: 34.0553,
        lng: -118.4175,
        indoor: true
    },
    {
        name: "Life Time Calabasas",
        city: "Calabasas, CA",
        lat: 34.1475,
        lng: -118.6362,
        indoor: true
    }
];

const API_BASE = "https://heartfelt-appreciation-production-65f1.up.railway.app";

async function addCourts() {
    console.log(`Adding ${newCourts.length} courts to production...`);

    for (const court of newCourts) {
        try {
            const id = generateUUID(court.name);

            const params = new URLSearchParams({
                id: id,
                name: court.name,
                city: court.city,
                lat: court.lat.toString(),
                lng: court.lng.toString(),
                indoor: court.indoor.toString()
            });

            const response = await fetch(`${API_BASE}/courts/admin/create?${params}`, {
                method: 'POST',
                headers: { 'x-user-id': 'system-admin' }
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ Added: ${court.name} (ID: ${id})`);
            } else {
                console.log(`⚠️  ${court.name}: ${result.error || JSON.stringify(result)}`);
            }
        } catch (error) {
            console.error(`❌ ${court.name}: ${error.message}`);
        }
    }

    console.log('\nDone!');
}

addCourts();

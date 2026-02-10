/**
 * CA Audit Part 7: Recreation Centers, YMCAs, Gyms statewide
 */
const { runImport } = require('../wa_audit/boilerplate');

const LA_REC_GYMS = [
    // LA City Rec Centers
    { name: "Pan Pacific Park Gym", city: "Los Angeles, CA", lat: 34.0751, lng: -118.3537, access: "public" },
    { name: "Westwood Recreation Center", city: "Los Angeles, CA", lat: 34.0556, lng: -118.4358, access: "public" },
    { name: "Mar Vista Recreation Center", city: "Los Angeles, CA", lat: 34.0012, lng: -118.4312, access: "public" },
    { name: "Poinsettia Recreation Center", city: "Los Angeles, CA", lat: 34.0783, lng: -118.3396, access: "public" },
    { name: "Jim Gilliam Recreation Center", city: "Los Angeles, CA", lat: 34.0098, lng: -118.3430, access: "public" },
    { name: "Rancho Cienega Recreation Center", city: "Los Angeles, CA", lat: 34.0207, lng: -118.3545, access: "public" },
    { name: "Van Ness Recreation Center", city: "Los Angeles, CA", lat: 33.9976, lng: -118.3220, access: "public" },
    { name: "Ross Snyder Recreation Center", city: "Los Angeles, CA", lat: 33.9882, lng: -118.2598, access: "public" },
    { name: "Algin Sutton Recreation Center", city: "Los Angeles, CA", lat: 34.0013, lng: -118.2765, access: "public" },
    { name: "Sun Valley Recreation Center", city: "Sun Valley, CA", lat: 34.2176, lng: -118.3724, access: "public" },
    { name: "North Hollywood Recreation Center", city: "North Hollywood, CA", lat: 34.1715, lng: -118.3846, access: "public" },
    { name: "Sylmar Recreation Center", city: "Sylmar, CA", lat: 34.3065, lng: -118.4401, access: "public" },
    { name: "Encino Recreation Center", city: "Encino, CA", lat: 34.1540, lng: -118.5037, access: "public" },
    { name: "Echo Park Recreation Center", city: "Los Angeles, CA", lat: 34.0777, lng: -118.2617, access: "public" },
    { name: "Lincoln Heights Recreation Center", city: "Los Angeles, CA", lat: 34.0729, lng: -118.2211, access: "public" },
    { name: "South Park Recreation Center", city: "Los Angeles, CA", lat: 33.9874, lng: -118.2670, access: "public" },
    { name: "Watts Senior Citizen Center Gym", city: "Los Angeles, CA", lat: 33.9430, lng: -118.2406, access: "public" },
    { name: "Venice Beach Recreation Center Gym", city: "Venice, CA", lat: 33.9933, lng: -118.4660, access: "public" },
    // LA Suburbs Rec
    { name: "Joslyn Community Center", city: "Manhattan Beach, CA", lat: 33.8885, lng: -118.4044, access: "public" },
    { name: "Torrance Cultural Arts Center", city: "Torrance, CA", lat: 33.8397, lng: -118.3362, access: "public" },
    { name: "Ken Nakaoka Community Center", city: "Gardena, CA", lat: 33.8932, lng: -118.3083, access: "public" },
    { name: "Compton Community Center", city: "Compton, CA", lat: 33.8954, lng: -118.2222, access: "public" },
    { name: "Inglewood Community Center", city: "Inglewood, CA", lat: 33.9616, lng: -118.3534, access: "public" },
    // YMCAs
    { name: "YMCA of Metropolitan Los Angeles", city: "Los Angeles, CA", lat: 34.0490, lng: -118.2510, access: "members" },
    { name: "Ketchum-Downtown YMCA", city: "Los Angeles, CA", lat: 34.0518, lng: -118.2573, access: "members" },
    { name: "Hollywood-Wilshire YMCA", city: "Los Angeles, CA", lat: 34.0676, lng: -118.3128, access: "members" },
    { name: "Crenshaw Family YMCA", city: "Los Angeles, CA", lat: 33.9862, lng: -118.3276, access: "members" },
    { name: "Anderson Munger Family YMCA", city: "Los Angeles, CA", lat: 34.0622, lng: -118.2998, access: "members" },
    { name: "Torrance-South Bay YMCA", city: "Torrance, CA", lat: 33.8267, lng: -118.3491, access: "members" },
    { name: "Pasadena YMCA", city: "Pasadena, CA", lat: 34.1449, lng: -118.1468, access: "members" },
    { name: "Long Beach YMCA", city: "Long Beach, CA", lat: 33.7903, lng: -118.1750, access: "members" },
    // 24 Hour Fitness / LA Fitness
    { name: "24 Hour Fitness Hollywood", city: "Los Angeles, CA", lat: 34.0917, lng: -118.3371, access: "members" },
    { name: "24 Hour Fitness Torrance", city: "Torrance, CA", lat: 33.8453, lng: -118.3280, access: "members" },
    { name: "LA Fitness Santa Monica", city: "Santa Monica, CA", lat: 34.0192, lng: -118.4804, access: "members" },
    { name: "LA Fitness Glendale", city: "Glendale, CA", lat: 34.1489, lng: -118.2482, access: "members" },
    { name: "LA Fitness Long Beach", city: "Long Beach, CA", lat: 33.8048, lng: -118.1516, access: "members" },
    { name: "Equinox West Hollywood", city: "Los Angeles, CA", lat: 34.0905, lng: -118.3814, access: "members" },
];

const BAY_AREA_REC_GYMS = [
    // SF Rec
    { name: "Kezar Pavilion", city: "San Francisco, CA", lat: 37.7672, lng: -122.4553, access: "public" },
    { name: "Potrero Hill Recreation Center", city: "San Francisco, CA", lat: 37.7611, lng: -122.4017, access: "public" },
    { name: "Chinatown Recreation Center", city: "San Francisco, CA", lat: 37.7937, lng: -122.4057, access: "public" },
    { name: "Hamilton Recreation Center", city: "San Francisco, CA", lat: 37.7575, lng: -122.4274, access: "public" },
    { name: "Sunset Recreation Center", city: "San Francisco, CA", lat: 37.7540, lng: -122.4984, access: "public" },
    { name: "Moscone Recreation Center", city: "San Francisco, CA", lat: 37.7994, lng: -122.4333, access: "public" },
    { name: "Bayview Recreation Center", city: "San Francisco, CA", lat: 37.7318, lng: -122.3903, access: "public" },
    { name: "Glen Park Recreation Center", city: "San Francisco, CA", lat: 37.7346, lng: -122.4363, access: "public" },
    // East Bay Rec
    { name: "North Oakland Community Center", city: "Oakland, CA", lat: 37.8338, lng: -122.2711, access: "public" },
    { name: "East Oakland Sports Center", city: "Oakland, CA", lat: 37.7654, lng: -122.1895, access: "public" },
    { name: "Mosswood Recreation Center", city: "Oakland, CA", lat: 37.8211, lng: -122.2628, access: "public" },
    { name: "DeFremery Recreation Center", city: "Oakland, CA", lat: 37.8079, lng: -122.2843, access: "public" },
    { name: "Berkeley South YMCA", city: "Berkeley, CA", lat: 37.8535, lng: -122.2704, access: "members" },
    { name: "Downtown Oakland YMCA", city: "Oakland, CA", lat: 37.8044, lng: -122.2683, access: "members" },
    // South Bay Rec
    { name: "Berryessa Community Center", city: "San Jose, CA", lat: 37.3863, lng: -121.8628, access: "public" },
    { name: "Mayfair Community Center", city: "San Jose, CA", lat: 37.3490, lng: -121.8518, access: "public" },
    { name: "Almaden Community Center", city: "San Jose, CA", lat: 37.2217, lng: -121.8585, access: "public" },
    { name: "Camden Community Center", city: "San Jose, CA", lat: 37.2491, lng: -121.9303, access: "public" },
    { name: "Southside Community Center", city: "San Jose, CA", lat: 37.3233, lng: -121.8610, access: "public" },
    { name: "Central YMCA San Jose", city: "San Jose, CA", lat: 37.3355, lng: -121.8920, access: "members" },
    { name: "Northwest YMCA San Jose", city: "San Jose, CA", lat: 37.3858, lng: -121.9476, access: "members" },
    { name: "Palo Alto Family YMCA", city: "Palo Alto, CA", lat: 37.4439, lng: -122.1587, access: "members" },
];

const SD_OC_IE_REC_GYMS = [
    // San Diego
    { name: "Copley-Price Family YMCA", city: "San Diego, CA", lat: 32.7452, lng: -117.1007, access: "members" },
    { name: "Mission Valley YMCA", city: "San Diego, CA", lat: 32.7696, lng: -117.1528, access: "members" },
    { name: "Toby Wells YMCA", city: "San Diego, CA", lat: 32.8235, lng: -117.1274, access: "members" },
    { name: "Peninsula Family YMCA", city: "San Diego, CA", lat: 32.7541, lng: -117.2319, access: "members" },
    { name: "City Heights Recreation Center", city: "San Diego, CA", lat: 32.7548, lng: -117.0957, access: "public" },
    { name: "Colina del Sol Recreation Center", city: "San Diego, CA", lat: 32.7478, lng: -117.0769, access: "public" },
    { name: "Martin Luther King Jr. Community Center", city: "San Diego, CA", lat: 32.6912, lng: -117.1011, access: "public" },
    { name: "North Clairemont Recreation Center", city: "San Diego, CA", lat: 32.8425, lng: -117.2077, access: "public" },
    // OC
    { name: "Irvine YMCA", city: "Irvine, CA", lat: 33.6752, lng: -117.7923, access: "members" },
    { name: "Fullerton Community Center Gym", city: "Fullerton, CA", lat: 33.8700, lng: -117.9242, access: "public" },
    { name: "Santa Ana Community Center", city: "Santa Ana, CA", lat: 33.7478, lng: -117.8658, access: "public" },
    { name: "Anaheim Community Center Gym", city: "Anaheim, CA", lat: 33.8395, lng: -117.9141, access: "public" },
    // Sacramento
    { name: "Sacramento Central YMCA", city: "Sacramento, CA", lat: 38.5758, lng: -121.4916, access: "members" },
    { name: "Pannell/Meadowview Community Center", city: "Sacramento, CA", lat: 38.5013, lng: -121.4523, access: "public" },
    { name: "Hagginwood Community Center", city: "Sacramento, CA", lat: 38.6086, lng: -121.4543, access: "public" },
    { name: "Sam Pannell Community Center", city: "Sacramento, CA", lat: 38.5781, lng: -121.4661, access: "public" },
    // Fresno/Bakersfield
    { name: "Fresno Central YMCA", city: "Fresno, CA", lat: 36.7456, lng: -119.7710, access: "members" },
    { name: "Southeast Fresno Community Center", city: "Fresno, CA", lat: 36.7128, lng: -119.7473, access: "public" },
    { name: "Bakersfield Rabobank Community Center", city: "Bakersfield, CA", lat: 35.3702, lng: -119.0208, access: "public" },
];

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  CA AUDIT P7: REC CENTERS, YMCAs, GYMS           ║');
    console.log('╚══════════════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['LA Rec Centers & Gyms', LA_REC_GYMS],
        ['Bay Area Rec Centers & Gyms', BAY_AREA_REC_GYMS],
        ['SD/OC/Sac/CV Rec & Gyms', SD_OC_IE_REC_GYMS],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`CA P7 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

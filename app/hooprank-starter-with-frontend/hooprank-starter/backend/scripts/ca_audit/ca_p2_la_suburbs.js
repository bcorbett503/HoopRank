/**
 * CA Audit Part 2: LA Suburbs School Districts
 * Long Beach, Pasadena, Inglewood, Compton, Torrance, Santa Monica,
 * Beverly Hills, Culver City, Burbank, Glendale, Pomona, Whittier, etc.
 */
const { runImport } = require('../wa_audit/boilerplate');

const LONG_BEACH_USD = [
    { name: "Long Beach Poly High School Gym", city: "Long Beach, CA", lat: 33.7837, lng: -118.1835, access: "members" },
    { name: "Wilson High School Gym (Long Beach)", city: "Long Beach, CA", lat: 33.7960, lng: -118.1320, access: "members" },
    { name: "Millikan High School Gym", city: "Long Beach, CA", lat: 33.8136, lng: -118.1212, access: "members" },
    { name: "Lakewood High School Gym", city: "Lakewood, CA", lat: 33.8463, lng: -118.1252, access: "members" },
    { name: "Jordan High School Gym (Long Beach)", city: "Long Beach, CA", lat: 33.8620, lng: -118.1970, access: "members" },
    { name: "Cabrillo High School Gym", city: "Long Beach, CA", lat: 33.7517, lng: -118.1948, access: "members" },
    { name: "Renaissance High School Gym", city: "Long Beach, CA", lat: 33.7738, lng: -118.2024, access: "members" },
    { name: "Hughes Middle School Gym", city: "Long Beach, CA", lat: 33.7993, lng: -118.1578, access: "members" },
    { name: "Stanford Middle School Gym (LB)", city: "Long Beach, CA", lat: 33.7834, lng: -118.1636, access: "members" },
    { name: "Nelson Middle School Gym", city: "Long Beach, CA", lat: 33.8211, lng: -118.1507, access: "members" },
];

const PASADENA_USD = [
    { name: "Pasadena High School Gym", city: "Pasadena, CA", lat: 34.1500, lng: -118.1543, access: "members" },
    { name: "John Muir High School Gym", city: "Pasadena, CA", lat: 34.1647, lng: -118.1318, access: "members" },
    { name: "La Cañada High School Gym", city: "La Cañada Flintridge, CA", lat: 34.2090, lng: -118.2007, access: "members" },
    { name: "Arcadia High School Gym", city: "Arcadia, CA", lat: 34.1350, lng: -118.0411, access: "members" },
    { name: "Alhambra High School Gym", city: "Alhambra, CA", lat: 34.0831, lng: -118.1361, access: "members" },
    { name: "San Gabriel High School Gym", city: "San Gabriel, CA", lat: 34.0879, lng: -118.0977, access: "members" },
    { name: "Temple City High School Gym", city: "Temple City, CA", lat: 34.1015, lng: -118.0600, access: "members" },
    { name: "Monrovia High School Gym", city: "Monrovia, CA", lat: 34.1544, lng: -117.9993, access: "members" },
];

const SOUTH_LA_DISTRICTS = [
    { name: "Inglewood High School Gym", city: "Inglewood, CA", lat: 33.9551, lng: -118.3535, access: "members" },
    { name: "Morningside High School Gym", city: "Inglewood, CA", lat: 33.9378, lng: -118.3676, access: "members" },
    { name: "Centennial High School Gym (Compton)", city: "Compton, CA", lat: 33.8779, lng: -118.2149, access: "members" },
    { name: "Compton High School Gym", city: "Compton, CA", lat: 33.8914, lng: -118.2237, access: "members" },
    { name: "Dominguez High School Gym", city: "Compton, CA", lat: 33.8681, lng: -118.2396, access: "members" },
    { name: "Lynwood High School Gym", city: "Lynwood, CA", lat: 33.9365, lng: -118.2108, access: "members" },
    { name: "Paramount High School Gym", city: "Paramount, CA", lat: 33.9009, lng: -118.1684, access: "members" },
    { name: "Hawthorne High School Gym", city: "Hawthorne, CA", lat: 33.9219, lng: -118.3504, access: "members" },
    { name: "Leuzinger High School Gym", city: "Lawndale, CA", lat: 33.8883, lng: -118.3566, access: "members" },
    { name: "Centinela Valley Center for the Arts Gym", city: "Lawndale, CA", lat: 33.8883, lng: -118.3534, access: "members" },
];

const SOUTH_BAY_DISTRICTS = [
    { name: "Torrance High School Gym", city: "Torrance, CA", lat: 33.8397, lng: -118.3101, access: "members" },
    { name: "South Torrance High School Gym", city: "Torrance, CA", lat: 33.8130, lng: -118.3405, access: "members" },
    { name: "West Torrance High School Gym", city: "Torrance, CA", lat: 33.8327, lng: -118.3613, access: "members" },
    { name: "North Torrance High School Gym", city: "Torrance, CA", lat: 33.8632, lng: -118.3229, access: "members" },
    { name: "Mira Costa High School Gym", city: "Manhattan Beach, CA", lat: 33.8858, lng: -118.3973, access: "members" },
    { name: "Redondo Union High School Gym", city: "Redondo Beach, CA", lat: 33.8465, lng: -118.3863, access: "members" },
    { name: "Palos Verdes High School Gym", city: "Palos Verdes Estates, CA", lat: 33.7783, lng: -118.3925, access: "members" },
    { name: "Peninsula High School Gym", city: "Rolling Hills Estates, CA", lat: 33.7614, lng: -118.3618, access: "members" },
    { name: "El Segundo High School Gym", city: "El Segundo, CA", lat: 33.9203, lng: -118.4099, access: "members" },
];

const WESTSIDE_DISTRICTS = [
    { name: "Santa Monica High School Gym", city: "Santa Monica, CA", lat: 34.0172, lng: -118.4772, access: "members" },
    { name: "Beverly Hills High School Gym", city: "Beverly Hills, CA", lat: 34.0608, lng: -118.3952, access: "members" },
    { name: "Culver City High School Gym", city: "Culver City, CA", lat: 33.9982, lng: -118.3887, access: "members" },
    { name: "Malibu High School Gym", city: "Malibu, CA", lat: 34.0318, lng: -118.6761, access: "members" },
];

const SAN_GABRIEL_VALLEY = [
    { name: "Pomona High School Gym", city: "Pomona, CA", lat: 34.0564, lng: -117.7462, access: "members" },
    { name: "Diamond Bar High School Gym", city: "Diamond Bar, CA", lat: 34.0064, lng: -117.8215, access: "members" },
    { name: "Walnut High School Gym", city: "Walnut, CA", lat: 34.0187, lng: -117.8658, access: "members" },
    { name: "West Covina High School Gym", city: "West Covina, CA", lat: 34.0653, lng: -117.9217, access: "members" },
    { name: "Covina High School Gym", city: "Covina, CA", lat: 34.0836, lng: -117.8727, access: "members" },
    { name: "Glendora High School Gym", city: "Glendora, CA", lat: 34.1261, lng: -117.8649, access: "members" },
    { name: "Azusa High School Gym", city: "Azusa, CA", lat: 34.1280, lng: -117.9043, access: "members" },
    { name: "La Puente High School Gym", city: "La Puente, CA", lat: 34.0217, lng: -117.9540, access: "members" },
    { name: "Hacienda Heights High School Gym", city: "Hacienda Heights, CA", lat: 33.9947, lng: -117.9586, access: "members" },
    { name: "San Dimas High School Gym", city: "San Dimas, CA", lat: 34.1100, lng: -117.8103, access: "members" },
    { name: "Claremont High School Gym", city: "Claremont, CA", lat: 34.1068, lng: -117.7163, access: "members" },
    { name: "Whittier High School Gym", city: "Whittier, CA", lat: 33.9767, lng: -118.0309, access: "members" },
    { name: "La Mirada High School Gym", city: "La Mirada, CA", lat: 33.9023, lng: -118.0110, access: "members" },
    { name: "Norwalk High School Gym", city: "Norwalk, CA", lat: 33.9125, lng: -118.0808, access: "members" },
];

const GLENDALE_BURBANK = [
    { name: "Glendale High School Gym", city: "Glendale, CA", lat: 34.1490, lng: -118.2546, access: "members" },
    { name: "Hoover High School Gym", city: "Glendale, CA", lat: 34.1580, lng: -118.2275, access: "members" },
    { name: "Crescenta Valley High School Gym", city: "La Crescenta, CA", lat: 34.2208, lng: -118.2440, access: "members" },
    { name: "Burbank High School Gym", city: "Burbank, CA", lat: 34.1799, lng: -118.3052, access: "members" },
    { name: "John Burroughs High School Gym", city: "Burbank, CA", lat: 34.1858, lng: -118.3420, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  CA AUDIT P2: LA SUBURBS SCHOOL DISTS    ║');
    console.log('╚══════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['Long Beach USD', LONG_BEACH_USD],
        ['Pasadena Area', PASADENA_USD],
        ['South LA Districts', SOUTH_LA_DISTRICTS],
        ['South Bay Districts', SOUTH_BAY_DISTRICTS],
        ['Westside Districts', WESTSIDE_DISTRICTS],
        ['San Gabriel Valley', SAN_GABRIEL_VALLEY],
        ['Glendale/Burbank', GLENDALE_BURBANK],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`CA P2 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

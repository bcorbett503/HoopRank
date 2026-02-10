/**
 * CA Audit Part 5: Sacramento, Central Valley, Central Coast, NorCal, rest of CA
 */
const { runImport } = require('../wa_audit/boilerplate');

const SACRAMENTO_SCHOOLS = [
    { name: "Sacramento High School Gym", city: "Sacramento, CA", lat: 38.5579, lng: -121.4685, access: "members" },
    { name: "C.K. McClatchy High School Gym", city: "Sacramento, CA", lat: 38.5434, lng: -121.4936, access: "members" },
    { name: "Hiram Johnson High School Gym", city: "Sacramento, CA", lat: 38.5318, lng: -121.4327, access: "members" },
    { name: "John F. Kennedy High School Gym", city: "Sacramento, CA", lat: 38.6177, lng: -121.4330, access: "members" },
    { name: "Luther Burbank High School Gym (Sac)", city: "Sacramento, CA", lat: 38.5082, lng: -121.4614, access: "members" },
    { name: "Rosemont High School Gym", city: "Sacramento, CA", lat: 38.5407, lng: -121.3679, access: "members" },
    { name: "Rio Americano High School Gym", city: "Sacramento, CA", lat: 38.5965, lng: -121.3936, access: "members" },
    { name: "Del Campo High School Gym", city: "Fair Oaks, CA", lat: 38.6369, lng: -121.2683, access: "members" },
    { name: "Elk Grove High School Gym", city: "Elk Grove, CA", lat: 38.4073, lng: -121.3814, access: "members" },
    { name: "Franklin High School Gym (Elk Grove)", city: "Elk Grove, CA", lat: 38.3713, lng: -121.4381, access: "members" },
    { name: "Sheldon High School Gym (EG)", city: "Elk Grove, CA", lat: 38.4395, lng: -121.3685, access: "members" },
    { name: "Pleasant Grove High School Gym", city: "Elk Grove, CA", lat: 38.3945, lng: -121.4108, access: "members" },
    { name: "Folsom High School Gym", city: "Folsom, CA", lat: 38.6595, lng: -121.1466, access: "members" },
    { name: "Vista del Lago High School Gym", city: "Folsom, CA", lat: 38.6803, lng: -121.1083, access: "members" },
    { name: "Rocklin High School Gym", city: "Rocklin, CA", lat: 38.7898, lng: -121.2361, access: "members" },
    { name: "Whitney High School Gym", city: "Rocklin, CA", lat: 38.7690, lng: -121.2252, access: "members" },
    { name: "Roseville High School Gym", city: "Roseville, CA", lat: 38.7553, lng: -121.2902, access: "members" },
    { name: "Granite Bay High School Gym", city: "Granite Bay, CA", lat: 38.7537, lng: -121.1716, access: "members" },
    { name: "Davis High School Gym (CA)", city: "Davis, CA", lat: 38.5430, lng: -121.7397, access: "members" },
    { name: "Woodland High School Gym", city: "Woodland, CA", lat: 38.6796, lng: -121.7708, access: "members" },
    { name: "Vacaville High School Gym", city: "Vacaville, CA", lat: 38.3543, lng: -121.9736, access: "members" },
];

const CENTRAL_VALLEY_SCHOOLS = [
    // Fresno
    { name: "Bullard High School Gym", city: "Fresno, CA", lat: 36.8116, lng: -119.8258, access: "members" },
    { name: "Edison High School Gym (Fresno)", city: "Fresno, CA", lat: 36.7355, lng: -119.7513, access: "members" },
    { name: "Hoover High School Gym (Fresno)", city: "Fresno, CA", lat: 36.7661, lng: -119.7996, access: "members" },
    { name: "Roosevelt High School Gym (Fresno)", city: "Fresno, CA", lat: 36.7404, lng: -119.7899, access: "members" },
    { name: "Sunnyside High School Gym", city: "Fresno, CA", lat: 36.6907, lng: -119.7128, access: "members" },
    { name: "Fresno High School Gym", city: "Fresno, CA", lat: 36.7454, lng: -119.8022, access: "members" },
    { name: "McLane High School Gym", city: "Fresno, CA", lat: 36.7174, lng: -119.7706, access: "members" },
    { name: "San Joaquin Memorial High School Gym", city: "Fresno, CA", lat: 36.7859, lng: -119.8021, access: "members" },
    { name: "Buchanan High School Gym", city: "Clovis, CA", lat: 36.8403, lng: -119.7191, access: "members" },
    { name: "Clovis West High School Gym", city: "Fresno, CA", lat: 36.8207, lng: -119.8558, access: "members" },
    { name: "Clovis North High School Gym", city: "Fresno, CA", lat: 36.8644, lng: -119.7671, access: "members" },
    { name: "Clovis High School Gym", city: "Clovis, CA", lat: 36.8239, lng: -119.7028, access: "members" },
    // Bakersfield
    { name: "Bakersfield High School Gym", city: "Bakersfield, CA", lat: 35.3744, lng: -119.0187, access: "members" },
    { name: "Highland High School Gym (Bak)", city: "Bakersfield, CA", lat: 35.3869, lng: -118.9541, access: "members" },
    { name: "Centennial High School Gym (Bak)", city: "Bakersfield, CA", lat: 35.4001, lng: -119.1099, access: "members" },
    { name: "Liberty High School Gym (Bak)", city: "Bakersfield, CA", lat: 35.3358, lng: -119.1071, access: "members" },
    { name: "Stockdale High School Gym", city: "Bakersfield, CA", lat: 35.3300, lng: -119.0816, access: "members" },
    { name: "Garces Memorial High School Gym", city: "Bakersfield, CA", lat: 35.3729, lng: -119.0070, access: "members" },
    // Stockton
    { name: "Lincoln High School Gym (Stockton)", city: "Stockton, CA", lat: 37.9710, lng: -121.2905, access: "members" },
    { name: "Stagg High School Gym", city: "Stockton, CA", lat: 37.9312, lng: -121.3282, access: "members" },
    { name: "Edison High School Gym (Stockton)", city: "Stockton, CA", lat: 37.9611, lng: -121.2566, access: "members" },
    { name: "Franklin High School Gym (Stockton)", city: "Stockton, CA", lat: 37.9520, lng: -121.3068, access: "members" },
    { name: "St. Mary's High School Gym (Stockton)", city: "Stockton, CA", lat: 37.9622, lng: -121.2910, access: "members" },
    // Modesto
    { name: "Modesto High School Gym", city: "Modesto, CA", lat: 37.6364, lng: -120.9889, access: "members" },
    { name: "Downey High School Gym (Modesto)", city: "Modesto, CA", lat: 37.6517, lng: -121.0192, access: "members" },
    { name: "Davis High School Gym (Modesto)", city: "Modesto, CA", lat: 37.6147, lng: -120.9925, access: "members" },
    { name: "Beyer High School Gym", city: "Modesto, CA", lat: 37.6133, lng: -121.0325, access: "members" },
    // Visalia/Tulare
    { name: "Redwood High School Gym", city: "Visalia, CA", lat: 36.3345, lng: -119.3009, access: "members" },
    { name: "Mt. Whitney High School Gym", city: "Visalia, CA", lat: 36.3193, lng: -119.2814, access: "members" },
    { name: "Golden West High School Gym", city: "Visalia, CA", lat: 36.2994, lng: -119.3285, access: "members" },
    // Merced
    { name: "Merced High School Gym", city: "Merced, CA", lat: 37.2988, lng: -120.4719, access: "members" },
    { name: "Golden Valley High School Gym (Merced)", city: "Merced, CA", lat: 37.3156, lng: -120.4405, access: "members" },
];

const OTHER_CA_SCHOOLS = [
    // Santa Barbara/Ventura
    { name: "Santa Barbara High School Gym", city: "Santa Barbara, CA", lat: 34.4237, lng: -119.7021, access: "members" },
    { name: "San Marcos High School Gym (SB)", city: "Santa Barbara, CA", lat: 34.4439, lng: -119.7828, access: "members" },
    { name: "Dos Pueblos High School Gym", city: "Goleta, CA", lat: 34.4377, lng: -119.8459, access: "members" },
    { name: "Ventura High School Gym", city: "Ventura, CA", lat: 34.2769, lng: -119.2919, access: "members" },
    { name: "Buena High School Gym", city: "Ventura, CA", lat: 34.2498, lng: -119.2557, access: "members" },
    { name: "Oxnard High School Gym", city: "Oxnard, CA", lat: 34.1966, lng: -119.1823, access: "members" },
    { name: "Pacifica High School Gym", city: "Oxnard, CA", lat: 34.1708, lng: -119.1469, access: "members" },
    { name: "Thousand Oaks High School Gym", city: "Thousand Oaks, CA", lat: 34.1903, lng: -118.8699, access: "members" },
    { name: "Westlake High School Gym", city: "Westlake Village, CA", lat: 34.1572, lng: -118.8205, access: "members" },
    { name: "Newbury Park High School Gym", city: "Newbury Park, CA", lat: 34.1760, lng: -118.9104, access: "members" },
    { name: "Moorpark High School Gym", city: "Moorpark, CA", lat: 34.2868, lng: -118.8764, access: "members" },
    { name: "Simi Valley High School Gym", city: "Simi Valley, CA", lat: 34.2618, lng: -118.7776, access: "members" },
    { name: "Royal High School Gym", city: "Simi Valley, CA", lat: 34.2773, lng: -118.7338, access: "members" },
    // Santa Cruz/Monterey
    { name: "Santa Cruz High School Gym", city: "Santa Cruz, CA", lat: 36.9789, lng: -122.0217, access: "members" },
    { name: "Seaside High School Gym", city: "Seaside, CA", lat: 36.6092, lng: -121.8472, access: "members" },
    { name: "Salinas High School Gym", city: "Salinas, CA", lat: 36.6790, lng: -121.6568, access: "members" },
    // NorCal
    { name: "Santa Rosa High School Gym", city: "Santa Rosa, CA", lat: 38.4380, lng: -122.7098, access: "members" },
    { name: "Montgomery High School Gym", city: "Santa Rosa, CA", lat: 38.4226, lng: -122.7329, access: "members" },
    { name: "Maria Carrillo High School Gym", city: "Santa Rosa, CA", lat: 38.4643, lng: -122.6977, access: "members" },
    { name: "Petaluma High School Gym", city: "Petaluma, CA", lat: 38.2326, lng: -122.6402, access: "members" },
    { name: "Napa High School Gym", city: "Napa, CA", lat: 38.2991, lng: -122.2965, access: "members" },
    { name: "Vintage High School Gym", city: "Napa, CA", lat: 38.3169, lng: -122.2761, access: "members" },
    { name: "Vallejo High School Gym", city: "Vallejo, CA", lat: 38.1135, lng: -122.2471, access: "members" },
    { name: "Jesse Bethel High School Gym", city: "Vallejo, CA", lat: 38.0842, lng: -122.2207, access: "members" },
    { name: "Fairfield High School Gym", city: "Fairfield, CA", lat: 38.2574, lng: -122.0565, access: "members" },
    { name: "Vanden High School Gym", city: "Fairfield, CA", lat: 38.2814, lng: -121.9963, access: "members" },
    // Chico/Redding
    { name: "Chico High School Gym", city: "Chico, CA", lat: 39.7266, lng: -121.8443, access: "members" },
    { name: "Pleasant Valley High School Gym", city: "Chico, CA", lat: 39.7101, lng: -121.7979, access: "members" },
    { name: "Enterprise High School Gym", city: "Redding, CA", lat: 40.5601, lng: -122.3305, access: "members" },
    { name: "Shasta High School Gym", city: "Redding, CA", lat: 40.5916, lng: -122.4016, access: "members" },
    // San Luis Obispo
    { name: "San Luis Obispo High School Gym", city: "San Luis Obispo, CA", lat: 35.2666, lng: -120.6643, access: "members" },
    { name: "Paso Robles High School Gym", city: "Paso Robles, CA", lat: 35.6249, lng: -120.6889, access: "members" },
    { name: "Atascadero High School Gym", city: "Atascadero, CA", lat: 35.4807, lng: -120.6594, access: "members" },
];

async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  CA AUDIT P5: SACRAMENTO, CENTRAL VALLEY, REST OF CA  ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['Sacramento Area', SACRAMENTO_SCHOOLS],
        ['Central Valley', CENTRAL_VALLEY_SCHOOLS],
        ['Rest of California', OTHER_CA_SCHOOLS],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`CA P5 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

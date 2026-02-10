/**
 * CA Audit Part 6: Colleges & Universities statewide
 */
const { runImport } = require('../wa_audit/boilerplate');

const UC_SYSTEM = [
    { name: "UCLA Pauley Pavilion", city: "Los Angeles, CA", lat: 34.0703, lng: -118.4468, access: "members" },
    { name: "UCLA John Wooden Center", city: "Los Angeles, CA", lat: 34.0715, lng: -118.4440, access: "members" },
    { name: "USC Galen Center", city: "Los Angeles, CA", lat: 34.0242, lng: -118.2874, access: "members" },
    { name: "USC Lyon Center", city: "Los Angeles, CA", lat: 34.0255, lng: -118.2829, access: "members" },
    { name: "UC Berkeley Haas Pavilion", city: "Berkeley, CA", lat: 37.8704, lng: -122.2620, access: "members" },
    { name: "UC Berkeley RSF", city: "Berkeley, CA", lat: 37.8686, lng: -122.2623, access: "members" },
    { name: "Stanford Maples Pavilion", city: "Stanford, CA", lat: 37.4349, lng: -122.1613, access: "members" },
    { name: "Stanford Arrillaga Gym", city: "Stanford, CA", lat: 37.4356, lng: -122.1589, access: "members" },
    { name: "UC San Diego RIMAC Arena", city: "San Diego, CA", lat: 32.8877, lng: -117.2398, access: "members" },
    { name: "UC Davis ARC", city: "Davis, CA", lat: 38.5425, lng: -121.7587, access: "members" },
    { name: "UC Irvine Bren Events Center", city: "Irvine, CA", lat: 33.6479, lng: -117.8423, access: "members" },
    { name: "UC Irvine ARC", city: "Irvine, CA", lat: 33.6481, lng: -117.8367, access: "members" },
    { name: "UC Santa Barbara Thunderdome", city: "Santa Barbara, CA", lat: 34.4122, lng: -119.8574, access: "members" },
    { name: "UC Santa Cruz West Field House", city: "Santa Cruz, CA", lat: 36.9961, lng: -122.0526, access: "members" },
    { name: "UC Riverside SRC", city: "Riverside, CA", lat: 33.9727, lng: -117.3257, access: "members" },
    { name: "UC Merced Rec Center", city: "Merced, CA", lat: 37.3659, lng: -120.4212, access: "members" },
];

const CSU_SYSTEM = [
    { name: "Cal State LA University Gym", city: "Los Angeles, CA", lat: 34.0662, lng: -118.1683, access: "members" },
    { name: "Cal State Northridge Matadome", city: "Northridge, CA", lat: 34.2398, lng: -118.5282, access: "members" },
    { name: "Cal State Long Beach Walter Pyramid", city: "Long Beach, CA", lat: 33.7872, lng: -118.1131, access: "members" },
    { name: "Cal State Long Beach SRC", city: "Long Beach, CA", lat: 33.7838, lng: -118.1101, access: "members" },
    { name: "Cal State Fullerton Titan Gym", city: "Fullerton, CA", lat: 33.8821, lng: -117.8850, access: "members" },
    { name: "San Diego State Viejas Arena", city: "San Diego, CA", lat: 32.7756, lng: -117.0724, access: "members" },
    { name: "San Diego State ARC", city: "San Diego, CA", lat: 32.7741, lng: -117.0713, access: "members" },
    { name: "San Jose State Event Center", city: "San Jose, CA", lat: 37.3364, lng: -121.8827, access: "members" },
    { name: "San Jose State Sport Club", city: "San Jose, CA", lat: 37.3352, lng: -121.8811, access: "members" },
    { name: "Sacramento State The Nest", city: "Sacramento, CA", lat: 38.5594, lng: -121.4182, access: "members" },
    { name: "Sacramento State SRC", city: "Sacramento, CA", lat: 38.5581, lng: -121.4217, access: "members" },
    { name: "Fresno State Save Mart Center", city: "Fresno, CA", lat: 36.8128, lng: -119.7461, access: "members" },
    { name: "Fresno State SRC", city: "Fresno, CA", lat: 36.8151, lng: -119.7430, access: "members" },
    { name: "Cal Poly SLO Mott Athletics Center", city: "San Luis Obispo, CA", lat: 35.2986, lng: -120.6595, access: "members" },
    { name: "Cal State San Bernardino Coussoulis Arena", city: "San Bernardino, CA", lat: 34.1821, lng: -117.3241, access: "members" },
    { name: "Cal State Bakersfield Icardo Center", city: "Bakersfield, CA", lat: 35.3494, lng: -119.1006, access: "members" },
    { name: "Cal State Dominguez Hills Gymnasium", city: "Carson, CA", lat: 33.8614, lng: -118.2542, access: "members" },
    { name: "Cal Poly Pomona Kellogg Gym", city: "Pomona, CA", lat: 34.0622, lng: -117.8253, access: "members" },
    { name: "Sonoma State Wolves Den", city: "Rohnert Park, CA", lat: 38.3387, lng: -122.6743, access: "members" },
    { name: "Humboldt State Lumberjack Arena", city: "Arcata, CA", lat: 40.8773, lng: -124.0795, access: "members" },
    { name: "Cal State Stanislaus Gymnasium", city: "Turlock, CA", lat: 37.5248, lng: -120.8553, access: "members" },
    { name: "Cal State East Bay Pioneer Gymnasium", city: "Hayward, CA", lat: 37.6558, lng: -122.0569, access: "members" },
    { name: "Cal State Monterey Bay Otter Sports Center", city: "Seaside, CA", lat: 36.6505, lng: -121.7991, access: "members" },
    { name: "Cal State San Marcos Sports Center", city: "San Marcos, CA", lat: 33.1282, lng: -117.1590, access: "members" },
    { name: "Cal State Channel Islands Gym", city: "Camarillo, CA", lat: 34.1595, lng: -119.0479, access: "members" },
    { name: "Chico State Acker Gymnasium", city: "Chico, CA", lat: 39.7308, lng: -121.8447, access: "members" },
];

const PRIVATE_COLLEGES = [
    { name: "Loyola Marymount Gersten Pavilion", city: "Los Angeles, CA", lat: 33.9715, lng: -118.4181, access: "members" },
    { name: "Pepperdine Firestone Fieldhouse", city: "Malibu, CA", lat: 34.0340, lng: -118.7070, access: "members" },
    { name: "University of San Francisco War Memorial Gym", city: "San Francisco, CA", lat: 37.7768, lng: -122.4509, access: "members" },
    { name: "Santa Clara University Leavey Center", city: "Santa Clara, CA", lat: 37.3497, lng: -121.9394, access: "members" },
    { name: "University of San Diego Jenny Craig Pavilion", city: "San Diego, CA", lat: 32.7712, lng: -117.1850, access: "members" },
    { name: "Azusa Pacific University Felix Event Center", city: "Azusa, CA", lat: 34.1302, lng: -117.9039, access: "members" },
    { name: "Point Loma Nazarene University Golden Gymnasium", city: "San Diego, CA", lat: 32.7149, lng: -117.2428, access: "members" },
    { name: "Biola University Chase Gymnasium", city: "La Mirada, CA", lat: 33.9124, lng: -118.0074, access: "members" },
    { name: "University of the Pacific Spanos Center", city: "Stockton, CA", lat: 37.9777, lng: -121.3112, access: "members" },
    { name: "St. Mary's College McKeon Pavilion", city: "Moraga, CA", lat: 37.8408, lng: -122.1090, access: "members" },
    { name: "Chapman University Hutton Sports Center", city: "Orange, CA", lat: 33.7922, lng: -117.8520, access: "members" },
    { name: "Occidental College Rush Gymnasium", city: "Los Angeles, CA", lat: 34.1262, lng: -118.2106, access: "members" },
    { name: "Pomona-Pitzer Colleges Rains Center", city: "Claremont, CA", lat: 34.0965, lng: -117.7088, access: "members" },
    { name: "Redlands University Currier Gymnasium", city: "Redlands, CA", lat: 34.0618, lng: -117.1708, access: "members" },
    { name: "Menlo College Gym", city: "Atherton, CA", lat: 37.4547, lng: -122.1773, access: "members" },
    { name: "Dominican University Conlan Center", city: "San Rafael, CA", lat: 37.9785, lng: -122.5062, access: "members" },
];

const COMMUNITY_COLLEGES = [
    { name: "Santa Monica College Corsair Gym", city: "Santa Monica, CA", lat: 34.0128, lng: -118.4698, access: "members" },
    { name: "Pasadena City College Hutto-Patterson Gym", city: "Pasadena, CA", lat: 34.1423, lng: -118.1220, access: "members" },
    { name: "East Los Angeles College Gym", city: "Monterey Park, CA", lat: 34.0242, lng: -118.1170, access: "members" },
    { name: "El Camino College Gym", city: "Torrance, CA", lat: 33.8671, lng: -118.3465, access: "members" },
    { name: "Long Beach City College Gym", city: "Long Beach, CA", lat: 33.8138, lng: -118.1560, access: "members" },
    { name: "Orange Coast College Gym", city: "Costa Mesa, CA", lat: 33.6716, lng: -117.9081, access: "members" },
    { name: "City College of San Francisco Gym", city: "San Francisco, CA", lat: 37.7252, lng: -122.4515, access: "members" },
    { name: "De Anza College Gym", city: "Cupertino, CA", lat: 37.3194, lng: -122.0456, access: "members" },
    { name: "Foothill College Gym", city: "Los Altos Hills, CA", lat: 37.3612, lng: -122.1299, access: "members" },
    { name: "Diablo Valley College Gym", city: "Pleasant Hill, CA", lat: 37.9658, lng: -122.0610, access: "members" },
    { name: "Chabot College Gym", city: "Hayward, CA", lat: 37.6524, lng: -122.1109, access: "members" },
    { name: "Sacramento City College Gym", city: "Sacramento, CA", lat: 38.5470, lng: -121.4953, access: "members" },
    { name: "American River College Gym", city: "Sacramento, CA", lat: 38.6338, lng: -121.3484, access: "members" },
    { name: "Fresno City College Gym", city: "Fresno, CA", lat: 36.7583, lng: -119.7943, access: "members" },
    { name: "Grossmont College Gym", city: "El Cajon, CA", lat: 32.8123, lng: -116.9399, access: "members" },
    { name: "Palomar College Gym", city: "San Marcos, CA", lat: 33.0986, lng: -117.1700, access: "members" },
    { name: "College of the Canyons Gym", city: "Santa Clarita, CA", lat: 34.3900, lng: -118.5740, access: "members" },
    { name: "Mt. San Antonio College Gym", city: "Walnut, CA", lat: 34.0460, lng: -117.8444, access: "members" },
    { name: "Citrus College Gym", city: "Glendora, CA", lat: 34.1019, lng: -117.8570, access: "members" },
    { name: "Riverside City College Gym", city: "Riverside, CA", lat: 33.9771, lng: -117.3833, access: "members" },
    { name: "Bakersfield College Gym", city: "Bakersfield, CA", lat: 35.3832, lng: -119.0337, access: "members" },
    { name: "San Joaquin Delta College Gym", city: "Stockton, CA", lat: 37.9807, lng: -121.3321, access: "members" },
    { name: "Modesto Junior College Gym", city: "Modesto, CA", lat: 37.6332, lng: -121.0028, access: "members" },
    { name: "Santa Rosa Junior College Gym", city: "Santa Rosa, CA", lat: 38.4432, lng: -122.7195, access: "members" },
    { name: "Solano Community College Gym", city: "Fairfield, CA", lat: 38.2398, lng: -122.0359, access: "members" },
    { name: "College of San Mateo Gym", city: "San Mateo, CA", lat: 37.5365, lng: -122.3377, access: "members" },
    { name: "Cañada College Gym", city: "Redwood City, CA", lat: 37.4660, lng: -122.2516, access: "members" },
    { name: "Mission College Gym", city: "Santa Clara, CA", lat: 37.3890, lng: -121.9822, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  CA AUDIT P6: COLLEGES & UNIVERSITIES             ║');
    console.log('╚══════════════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['UC System', UC_SYSTEM],
        ['CSU System', CSU_SYSTEM],
        ['Private Universities', PRIVATE_COLLEGES],
        ['Community Colleges', COMMUNITY_COLLEGES],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`CA P6 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

/**
 * OR Audit Part 2: Portland Metro Suburban School Districts
 * Beaverton, Hillsboro, Tigard-Tualatin, Lake Oswego, West Linn, Oregon City,
 * David Douglas, Reynolds, Centennial, Parkrose, Gresham-Barlow, North Clackamas
 */
const { runImport } = require('../wa_audit/boilerplate');

const BEAVERTON_SD = [
    { name: "Beaverton High School Gym", city: "Beaverton, OR", lat: 45.4874, lng: -122.8109, access: "members" },
    { name: "Southridge High School Gym", city: "Beaverton, OR", lat: 45.4518, lng: -122.8247, access: "members" },
    { name: "Westview High School Gym", city: "Portland, OR", lat: 45.5384, lng: -122.8441, access: "members" },
    { name: "Sunset High School Gym", city: "Portland, OR", lat: 45.5236, lng: -122.7951, access: "members" },
    { name: "Aloha High School Gym", city: "Aloha, OR", lat: 45.4868, lng: -122.8714, access: "members" },
    { name: "Mountainside High School Gym", city: "Beaverton, OR", lat: 45.4405, lng: -122.8401, access: "members" },
    { name: "Conestoga Middle School Gym", city: "Beaverton, OR", lat: 45.4726, lng: -122.8339, access: "members" },
    { name: "Five Oaks Middle School Gym", city: "Beaverton, OR", lat: 45.5222, lng: -122.8490, access: "members" },
    { name: "Highland Park Middle School Gym", city: "Beaverton, OR", lat: 45.4674, lng: -122.8015, access: "members" },
    { name: "Meadow Park Middle School Gym", city: "Beaverton, OR", lat: 45.4785, lng: -122.7988, access: "members" },
    { name: "Mountain View Middle School Gym", city: "Aloha, OR", lat: 45.4912, lng: -122.8700, access: "members" },
    { name: "Stoller Middle School Gym", city: "Portland, OR", lat: 45.5384, lng: -122.8162, access: "members" },
    { name: "Whitford Middle School Gym", city: "Beaverton, OR", lat: 45.4543, lng: -122.7909, access: "members" },
    { name: "Cedar Park Middle School Gym", city: "Beaverton, OR", lat: 45.5140, lng: -122.8121, access: "members" },
];

const HILLSBORO_SD = [
    { name: "Hillsboro High School Gym", city: "Hillsboro, OR", lat: 45.5222, lng: -122.9883, access: "members" },
    { name: "Century High School Gym", city: "Hillsboro, OR", lat: 45.5068, lng: -122.9399, access: "members" },
    { name: "Glencoe High School Gym", city: "Hillsboro, OR", lat: 45.5417, lng: -122.9444, access: "members" },
    { name: "Liberty High School Gym", city: "Hillsboro, OR", lat: 45.5392, lng: -123.0110, access: "members" },
    { name: "South Meadows Middle School Gym", city: "Hillsboro, OR", lat: 45.5012, lng: -122.9555, access: "members" },
    { name: "Evergreen Middle School Gym", city: "Hillsboro, OR", lat: 45.5332, lng: -122.9786, access: "members" },
    { name: "Poynter Middle School Gym", city: "Hillsboro, OR", lat: 45.5168, lng: -123.0088, access: "members" },
    { name: "Brown Middle School Gym", city: "Hillsboro, OR", lat: 45.5405, lng: -122.9329, access: "members" },
];

const DAVID_DOUGLAS_SD = [
    { name: "David Douglas High School Gym", city: "Portland, OR", lat: 45.5100, lng: -122.5282, access: "members" },
    { name: "Ron Russell Middle School Gym", city: "Portland, OR", lat: 45.5189, lng: -122.5153, access: "members" },
    { name: "Floyd Light Middle School Gym", city: "Portland, OR", lat: 45.4989, lng: -122.5325, access: "members" },
    { name: "Alice Ott Middle School Gym", city: "Portland, OR", lat: 45.4888, lng: -122.5152, access: "members" },
];

const REYNOLDS_SD = [
    { name: "Reynolds High School Gym", city: "Troutdale, OR", lat: 45.5422, lng: -122.3927, access: "members" },
    { name: "Gresham-Barlow High School Gym", city: "Gresham, OR", lat: 45.5013, lng: -122.4401, access: "members" },
    { name: "Sam Barlow High School Gym", city: "Gresham, OR", lat: 45.4936, lng: -122.3924, access: "members" },
    { name: "Centennial High School Gym", city: "Gresham, OR", lat: 45.5190, lng: -122.4595, access: "members" },
    { name: "Springwater Trail High School Gym", city: "Gresham, OR", lat: 45.4985, lng: -122.4310, access: "members" },
    { name: "Dexter McCarty Middle School Gym", city: "Gresham, OR", lat: 45.4889, lng: -122.4333, access: "members" },
    { name: "Gordon Russell Middle School Gym", city: "Gresham, OR", lat: 45.5185, lng: -122.4437, access: "members" },
    { name: "Clear Creek Middle School Gym", city: "Gresham, OR", lat: 45.4901, lng: -122.3998, access: "members" },
];

const TIGARD_TUALATIN_SD = [
    { name: "Tigard High School Gym", city: "Tigard, OR", lat: 45.4256, lng: -122.7668, access: "members" },
    { name: "Tualatin High School Gym", city: "Tualatin, OR", lat: 45.3858, lng: -122.7718, access: "members" },
    { name: "Hazelbrook Middle School Gym", city: "Tualatin, OR", lat: 45.3952, lng: -122.7677, access: "members" },
    { name: "Fowler Middle School Gym", city: "Tigard, OR", lat: 45.4218, lng: -122.7490, access: "members" },
    { name: "Twality Middle School Gym", city: "Tigard, OR", lat: 45.4365, lng: -122.7831, access: "members" },
];

const LAKE_OSWEGO_SD = [
    { name: "Lake Oswego High School Gym", city: "Lake Oswego, OR", lat: 45.4215, lng: -122.6720, access: "members" },
    { name: "Lakeridge High School Gym", city: "Lake Oswego, OR", lat: 45.3978, lng: -122.6842, access: "members" },
    { name: "Lake Oswego Junior High Gym", city: "Lake Oswego, OR", lat: 45.4194, lng: -122.6689, access: "members" },
    { name: "Waluga Junior High Gym", city: "Lake Oswego, OR", lat: 45.4021, lng: -122.6973, access: "members" },
];

const WEST_LINN_WILSONVILLE_SD = [
    { name: "West Linn High School Gym", city: "West Linn, OR", lat: 45.3613, lng: -122.6474, access: "members" },
    { name: "Wilsonville High School Gym", city: "Wilsonville, OR", lat: 45.3052, lng: -122.7703, access: "members" },
    { name: "Rosemont Ridge Middle School Gym", city: "West Linn, OR", lat: 45.3522, lng: -122.6594, access: "members" },
    { name: "Athey Creek Middle School Gym", city: "West Linn, OR", lat: 45.3694, lng: -122.6170, access: "members" },
    { name: "Inza Wood Middle School Gym", city: "Wilsonville, OR", lat: 45.3023, lng: -122.7547, access: "members" },
];

const OREGON_CITY_SD = [
    { name: "Oregon City High School Gym", city: "Oregon City, OR", lat: 45.3457, lng: -122.5979, access: "members" },
    { name: "Ogden Middle School Gym", city: "Oregon City, OR", lat: 45.3554, lng: -122.5936, access: "members" },
    { name: "Gardiner Middle School Gym", city: "Oregon City, OR", lat: 45.3397, lng: -122.6097, access: "members" },
];

const NORTH_CLACKAMAS_SD = [
    { name: "Clackamas High School Gym", city: "Clackamas, OR", lat: 45.4379, lng: -122.5645, access: "members" },
    { name: "Rex Putnam High School Gym", city: "Milwaukie, OR", lat: 45.4424, lng: -122.6290, access: "members" },
    { name: "Alder Creek Middle School Gym", city: "Milwaukie, OR", lat: 45.4395, lng: -122.6073, access: "members" },
    { name: "Rock Creek Middle School Gym", city: "Happy Valley, OR", lat: 45.4277, lng: -122.5375, access: "members" },
    { name: "Rowe Middle School Gym", city: "Milwaukie, OR", lat: 45.4454, lng: -122.6457, access: "members" },
];

const PARKROSE_SD = [
    { name: "Parkrose High School Gym", city: "Portland, OR", lat: 45.5544, lng: -122.5596, access: "members" },
    { name: "Parkrose Middle School Gym", city: "Portland, OR", lat: 45.5543, lng: -122.5557, access: "members" },
];

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  OR AUDIT P2: PORTLAND METRO SCHOOL DISTS  ║');
    console.log('╚════════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['Beaverton SD', BEAVERTON_SD],
        ['Hillsboro SD', HILLSBORO_SD],
        ['David Douglas SD', DAVID_DOUGLAS_SD],
        ['Reynolds/Gresham SD', REYNOLDS_SD],
        ['Tigard-Tualatin SD', TIGARD_TUALATIN_SD],
        ['Lake Oswego SD', LAKE_OSWEGO_SD],
        ['West Linn-Wilsonville SD', WEST_LINN_WILSONVILLE_SD],
        ['Oregon City SD', OREGON_CITY_SD],
        ['North Clackamas SD', NORTH_CLACKAMAS_SD],
        ['Parkrose SD', PARKROSE_SD],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`OR P2 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

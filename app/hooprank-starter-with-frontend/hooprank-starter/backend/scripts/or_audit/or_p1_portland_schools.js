/**
 * OR Audit Part 1: Portland Public Schools + Portland Metro Schools
 * All Portland PS high, middle, and elementary schools
 */
const { runImport } = require('../wa_audit/boilerplate');

const PPS_HIGH_SCHOOLS = [
    { name: "Jefferson High School Gym", city: "Portland, OR", lat: 45.5614, lng: -122.6836, access: "members" },
    { name: "Grant High School Gym", city: "Portland, OR", lat: 45.5515, lng: -122.6353, access: "members" },
    { name: "Franklin High School Gym", city: "Portland, OR", lat: 45.4976, lng: -122.6141, access: "members" },
    { name: "Cleveland High School Gym", city: "Portland, OR", lat: 45.5004, lng: -122.6291, access: "members" },
    { name: "Roosevelt High School Gym", city: "Portland, OR", lat: 45.5817, lng: -122.7347, access: "members" },
    { name: "Madison High School Gym", city: "Portland, OR", lat: 45.5435, lng: -122.5610, access: "members" },
    { name: "Lincoln High School Gym", city: "Portland, OR", lat: 45.5170, lng: -122.7051, access: "members" },
    { name: "Wilson High School Gym", city: "Portland, OR", lat: 45.4697, lng: -122.7068, access: "members" },
    { name: "Benson Polytechnic High School Gym", city: "Portland, OR", lat: 45.5267, lng: -122.6507, access: "members" },
    { name: "McDaniel High School Gym", city: "Portland, OR", lat: 45.5103, lng: -122.5588, access: "members" },
    { name: "Ida B. Wells High School Gym", city: "Portland, OR", lat: 45.4810, lng: -122.6213, access: "members" },
    { name: "Alliance High School at Meek Gym", city: "Portland, OR", lat: 45.5460, lng: -122.6173, access: "members" },
];

const PPS_MIDDLE_SCHOOLS = [
    { name: "Beaumont Middle School Gym", city: "Portland, OR", lat: 45.5503, lng: -122.6282, access: "members" },
    { name: "George Middle School Gym", city: "Portland, OR", lat: 45.5779, lng: -122.6993, access: "members" },
    { name: "Harriet Tubman Middle School Gym", city: "Portland, OR", lat: 45.5465, lng: -122.6637, access: "members" },
    { name: "Hosford Middle School Gym", city: "Portland, OR", lat: 45.5049, lng: -122.6393, access: "members" },
    { name: "Lane Middle School Gym", city: "Portland, OR", lat: 45.4924, lng: -122.5615, access: "members" },
    { name: "Mt. Tabor Middle School Gym", city: "Portland, OR", lat: 45.5122, lng: -122.5937, access: "members" },
    { name: "Ockley Green Middle School Gym", city: "Portland, OR", lat: 45.5709, lng: -122.6796, access: "members" },
    { name: "Robert Gray Middle School Gym", city: "Portland, OR", lat: 45.4778, lng: -122.6993, access: "members" },
    { name: "Sellwood Middle School Gym", city: "Portland, OR", lat: 45.4684, lng: -122.6516, access: "members" },
    { name: "West Sylvan Middle School Gym", city: "Portland, OR", lat: 45.4988, lng: -122.7379, access: "members" },
    { name: "Kellogg Middle School Gym", city: "Portland, OR", lat: 45.4753, lng: -122.6339, access: "members" },
    { name: "Roseway Heights Middle School Gym", city: "Portland, OR", lat: 45.5505, lng: -122.5857, access: "members" },
];

const PPS_ELEMENTARY = [
    { name: "Alameda Elementary Gym", city: "Portland, OR", lat: 45.5451, lng: -122.6361, access: "members" },
    { name: "Arleta Elementary Gym", city: "Portland, OR", lat: 45.4872, lng: -122.6038, access: "members" },
    { name: "Atkinson Elementary Gym", city: "Portland, OR", lat: 45.4703, lng: -122.6118, access: "members" },
    { name: "Beach Elementary Gym", city: "Portland, OR", lat: 45.5610, lng: -122.6975, access: "members" },
    { name: "Beverly Cleary School (Fernwood) Gym", city: "Portland, OR", lat: 45.5441, lng: -122.6183, access: "members" },
    { name: "Boise-Eliot/Humboldt Elementary Gym", city: "Portland, OR", lat: 45.5541, lng: -122.6746, access: "members" },
    { name: "Bridger Elementary Gym", city: "Portland, OR", lat: 45.5173, lng: -122.5539, access: "members" },
    { name: "Buckman Elementary Gym", city: "Portland, OR", lat: 45.5149, lng: -122.6509, access: "members" },
    { name: "Capitol Hill Elementary Gym", city: "Portland, OR", lat: 45.4946, lng: -122.6411, access: "members" },
    { name: "Chapman Elementary Gym", city: "Portland, OR", lat: 45.5284, lng: -122.7008, access: "members" },
    { name: "Chief Joseph Elementary Gym", city: "Portland, OR", lat: 45.5586, lng: -122.6465, access: "members" },
    { name: "Creston Elementary Gym", city: "Portland, OR", lat: 45.4928, lng: -122.6175, access: "members" },
    { name: "César Chávez Elementary Gym", city: "Portland, OR", lat: 45.5387, lng: -122.5685, access: "members" },
    { name: "Duniway Elementary Gym", city: "Portland, OR", lat: 45.4876, lng: -122.6305, access: "members" },
    { name: "Faubion Elementary Gym", city: "Portland, OR", lat: 45.5697, lng: -122.6394, access: "members" },
    { name: "Forest Park Elementary Gym", city: "Portland, OR", lat: 45.5559, lng: -122.7305, access: "members" },
    { name: "Glencoe Elementary Gym", city: "Portland, OR", lat: 45.5079, lng: -122.6993, access: "members" },
    { name: "Grout Elementary Gym", city: "Portland, OR", lat: 45.4789, lng: -122.6187, access: "members" },
    { name: "Hayhurst Elementary Gym", city: "Portland, OR", lat: 45.4695, lng: -122.7267, access: "members" },
    { name: "Irvington Elementary Gym", city: "Portland, OR", lat: 45.5400, lng: -122.6555, access: "members" },
    { name: "James John Elementary Gym", city: "Portland, OR", lat: 45.5896, lng: -122.7509, access: "members" },
    { name: "Kelly Elementary Gym", city: "Portland, OR", lat: 45.5009, lng: -122.5482, access: "members" },
    { name: "King Elementary Gym", city: "Portland, OR", lat: 45.5614, lng: -122.6563, access: "members" },
    { name: "Laurelhurst Elementary Gym", city: "Portland, OR", lat: 45.5313, lng: -122.6233, access: "members" },
    { name: "Lee Elementary Gym", city: "Portland, OR", lat: 45.5143, lng: -122.5269, access: "members" },
    { name: "Lent Elementary Gym", city: "Portland, OR", lat: 45.4758, lng: -122.5681, access: "members" },
    { name: "Lewis Elementary Gym", city: "Portland, OR", lat: 45.4886, lng: -122.6710, access: "members" },
    { name: "Maplewood Elementary Gym", city: "Portland, OR", lat: 45.4644, lng: -122.7100, access: "members" },
    { name: "Markham Elementary Gym", city: "Portland, OR", lat: 45.4571, lng: -122.6829, access: "members" },
    { name: "Marysville Elementary Gym", city: "Portland, OR", lat: 45.5413, lng: -122.5366, access: "members" },
    { name: "Peninsula Elementary Gym", city: "Portland, OR", lat: 45.5712, lng: -122.6826, access: "members" },
    { name: "Richmond Elementary Gym", city: "Portland, OR", lat: 45.4996, lng: -122.6375, access: "members" },
    { name: "Rigler Elementary Gym", city: "Portland, OR", lat: 45.5502, lng: -122.6166, access: "members" },
    { name: "Rosa Parks Elementary Gym", city: "Portland, OR", lat: 45.5727, lng: -122.6607, access: "members" },
    { name: "Sabin Elementary Gym", city: "Portland, OR", lat: 45.5556, lng: -122.6401, access: "members" },
    { name: "Scott Elementary Gym", city: "Portland, OR", lat: 45.5238, lng: -122.5468, access: "members" },
    { name: "Sitton Elementary Gym", city: "Portland, OR", lat: 45.5877, lng: -122.7175, access: "members" },
    { name: "Stephenson Elementary Gym", city: "Portland, OR", lat: 45.4485, lng: -122.7111, access: "members" },
    { name: "Sunnyside Environmental School Gym", city: "Portland, OR", lat: 45.5122, lng: -122.6363, access: "members" },
    { name: "Vernon Elementary Gym", city: "Portland, OR", lat: 45.5618, lng: -122.6322, access: "members" },
    { name: "Vestal Elementary Gym", city: "Portland, OR", lat: 45.5313, lng: -122.5665, access: "members" },
    { name: "Whitman Elementary Gym", city: "Portland, OR", lat: 45.4563, lng: -122.6553, access: "members" },
    { name: "Woodlawn Elementary Gym", city: "Portland, OR", lat: 45.5739, lng: -122.6609, access: "members" },
    { name: "Woodmere Elementary Gym", city: "Portland, OR", lat: 45.4781, lng: -122.5735, access: "members" },
    { name: "Woodstock Elementary Gym", city: "Portland, OR", lat: 45.4794, lng: -122.6139, access: "members" },
];

async function main() {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  OR AUDIT P1: PORTLAND PUBLIC SCHOOLS  ║');
    console.log('╚═══════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    for (const [label, courts] of [
        ['PPS High Schools', PPS_HIGH_SCHOOLS],
        ['PPS Middle Schools', PPS_MIDDLE_SCHOOLS],
        ['PPS Elementary Schools', PPS_ELEMENTARY],
    ]) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`OR P1 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

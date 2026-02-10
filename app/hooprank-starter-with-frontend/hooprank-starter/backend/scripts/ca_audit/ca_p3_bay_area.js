/**
 * CA Audit Part 3: San Francisco Bay Area Schools
 * SF, Oakland, San Jose, Peninsula, East Bay, South Bay
 */
const { runImport } = require('../wa_audit/boilerplate');

const SF_SCHOOLS = [
    { name: "Balboa High School Gym", city: "San Francisco, CA", lat: 37.7238, lng: -122.4414, access: "members" },
    { name: "Burton High School Gym", city: "San Francisco, CA", lat: 37.7265, lng: -122.4523, access: "members" },
    { name: "Galileo High School Gym", city: "San Francisco, CA", lat: 37.8034, lng: -122.4152, access: "members" },
    { name: "Lincoln High School Gym (SF)", city: "San Francisco, CA", lat: 37.7432, lng: -122.4881, access: "members" },
    { name: "Lowell High School Gym", city: "San Francisco, CA", lat: 37.7466, lng: -122.4831, access: "members" },
    { name: "Mission High School Gym", city: "San Francisco, CA", lat: 37.7582, lng: -122.4273, access: "members" },
    { name: "Washington High School Gym (SF)", city: "San Francisco, CA", lat: 37.7349, lng: -122.3947, access: "members" },
    { name: "Wallenberg Traditional High School Gym", city: "San Francisco, CA", lat: 37.7505, lng: -122.4989, access: "members" },
    { name: "Thurgood Marshall Academic High School Gym", city: "San Francisco, CA", lat: 37.7204, lng: -122.4567, access: "members" },
    { name: "O'Connell High School Gym", city: "San Francisco, CA", lat: 37.7117, lng: -122.3908, access: "members" },
    // Middle Schools
    { name: "Presidio Middle School Gym (SF)", city: "San Francisco, CA", lat: 37.7483, lng: -122.4550, access: "members" },
    { name: "Aptos Middle School Gym", city: "San Francisco, CA", lat: 37.7269, lng: -122.4660, access: "members" },
    { name: "Giannini Middle School Gym", city: "San Francisco, CA", lat: 37.7425, lng: -122.4958, access: "members" },
    { name: "Hoover Middle School Gym (SF)", city: "San Francisco, CA", lat: 37.7387, lng: -122.4225, access: "members" },
    { name: "Everett Middle School Gym", city: "San Francisco, CA", lat: 37.7624, lng: -122.4174, access: "members" },
    { name: "Marina Middle School Gym", city: "San Francisco, CA", lat: 37.7989, lng: -122.4387, access: "members" },
    { name: "James Denman Middle School Gym", city: "San Francisco, CA", lat: 37.7187, lng: -122.4545, access: "members" },
    { name: "Martin Luther King Jr. Middle School Gym (SF)", city: "San Francisco, CA", lat: 37.7330, lng: -122.4023, access: "members" },
    { name: "Roosevelt Middle School Gym (SF)", city: "San Francisco, CA", lat: 37.7581, lng: -122.4462, access: "members" },
    { name: "Visitacion Valley Middle School Gym", city: "San Francisco, CA", lat: 37.7138, lng: -122.4069, access: "members" },
];

const OAKLAND_USD = [
    { name: "Oakland High School Gym", city: "Oakland, CA", lat: 37.7939, lng: -122.2339, access: "members" },
    { name: "Oakland Technical High School Gym", city: "Oakland, CA", lat: 37.8342, lng: -122.2597, access: "members" },
    { name: "Skyline High School Gym", city: "Oakland, CA", lat: 37.7934, lng: -122.1671, access: "members" },
    { name: "Castlemont High School Gym", city: "Oakland, CA", lat: 37.7765, lng: -122.1756, access: "members" },
    { name: "Fremont High School Gym (Oakland)", city: "Oakland, CA", lat: 37.7694, lng: -122.2166, access: "members" },
    { name: "McClymonds High School Gym", city: "Oakland, CA", lat: 37.8117, lng: -122.2822, access: "members" },
    { name: "Bishop O'Dowd High School Gym", city: "Oakland, CA", lat: 37.7889, lng: -122.1882, access: "members" },
    // Middle Schools
    { name: "Bret Harte Middle School Gym (Oakland)", city: "Oakland, CA", lat: 37.8129, lng: -122.2363, access: "members" },
    { name: "Edna Brewer Middle School Gym", city: "Oakland, CA", lat: 37.8102, lng: -122.2233, access: "members" },
    { name: "Claremont Middle School Gym (Oakland)", city: "Oakland, CA", lat: 37.8407, lng: -122.2508, access: "members" },
    { name: "Roosevelt Middle School Gym (Oakland)", city: "Oakland, CA", lat: 37.7983, lng: -122.2546, access: "members" },
    { name: "Montera Middle School Gym", city: "Oakland, CA", lat: 37.8153, lng: -122.1920, access: "members" },
    { name: "Westlake Middle School Gym", city: "Oakland, CA", lat: 37.7831, lng: -122.2419, access: "members" },
];

const SAN_JOSE_SCHOOLS = [
    { name: "San Jose High School Gym", city: "San Jose, CA", lat: 37.3268, lng: -121.8663, access: "members" },
    { name: "Lincoln High School Gym (SJ)", city: "San Jose, CA", lat: 37.3017, lng: -121.8547, access: "members" },
    { name: "Willow Glen High School Gym", city: "San Jose, CA", lat: 37.2976, lng: -121.8973, access: "members" },
    { name: "Pioneer High School Gym", city: "San Jose, CA", lat: 37.2730, lng: -121.8480, access: "members" },
    { name: "Gunderson High School Gym", city: "San Jose, CA", lat: 37.2715, lng: -121.8677, access: "members" },
    { name: "Del Mar High School Gym", city: "San Jose, CA", lat: 37.2476, lng: -121.9190, access: "members" },
    { name: "Branham High School Gym", city: "San Jose, CA", lat: 37.2649, lng: -121.8240, access: "members" },
    { name: "Leland High School Gym", city: "San Jose, CA", lat: 37.2472, lng: -121.8170, access: "members" },
    { name: "Silver Creek High School Gym", city: "San Jose, CA", lat: 37.2837, lng: -121.8065, access: "members" },
    { name: "Independence High School Gym", city: "San Jose, CA", lat: 37.3264, lng: -121.8109, access: "members" },
    { name: "Yerba Buena High School Gym", city: "San Jose, CA", lat: 37.3369, lng: -121.8219, access: "members" },
    { name: "James Lick High School Gym", city: "San Jose, CA", lat: 37.3424, lng: -121.8370, access: "members" },
    { name: "Mt. Pleasant High School Gym", city: "San Jose, CA", lat: 37.3529, lng: -121.8149, access: "members" },
    { name: "Andrew Hill High School Gym", city: "San Jose, CA", lat: 37.2802, lng: -121.8289, access: "members" },
    { name: "Overfelt High School Gym", city: "San Jose, CA", lat: 37.3546, lng: -121.8293, access: "members" },
    { name: "Milpitas High School Gym", city: "Milpitas, CA", lat: 37.4346, lng: -121.8949, access: "members" },
];

const EAST_BAY_SCHOOLS = [
    { name: "Berkeley High School Gym", city: "Berkeley, CA", lat: 37.8692, lng: -122.2709, access: "members" },
    { name: "Albany High School Gym", city: "Albany, CA", lat: 37.8920, lng: -122.3024, access: "members" },
    { name: "El Cerrito High School Gym", city: "El Cerrito, CA", lat: 37.9126, lng: -122.3065, access: "members" },
    { name: "Richmond High School Gym", city: "Richmond, CA", lat: 37.9369, lng: -122.3465, access: "members" },
    { name: "De Anza High School Gym", city: "Richmond, CA", lat: 37.9497, lng: -122.3248, access: "members" },
    { name: "Pinole Valley High School Gym", city: "Pinole, CA", lat: 37.9891, lng: -122.2971, access: "members" },
    { name: "Hayward High School Gym", city: "Hayward, CA", lat: 37.6680, lng: -122.0835, access: "members" },
    { name: "Tennyson High School Gym", city: "Hayward, CA", lat: 37.6384, lng: -122.0684, access: "members" },
    { name: "Mt. Eden High School Gym", city: "Hayward, CA", lat: 37.6383, lng: -122.1037, access: "members" },
    { name: "Castro Valley High School Gym", city: "Castro Valley, CA", lat: 37.6996, lng: -122.0727, access: "members" },
    { name: "San Leandro High School Gym", city: "San Leandro, CA", lat: 37.7270, lng: -122.1510, access: "members" },
    { name: "Fremont High School Gym (Fremont)", city: "Fremont, CA", lat: 37.5404, lng: -121.9891, access: "members" },
    { name: "Mission San Jose High School Gym", city: "Fremont, CA", lat: 37.5239, lng: -121.9231, access: "members" },
    { name: "American High School Gym", city: "Fremont, CA", lat: 37.5199, lng: -121.9615, access: "members" },
    { name: "Irvington High School Gym", city: "Fremont, CA", lat: 37.5235, lng: -121.9638, access: "members" },
    { name: "Newark Memorial High School Gym", city: "Newark, CA", lat: 37.5234, lng: -122.0395, access: "members" },
    { name: "Union City High School Gym", city: "Union City, CA", lat: 37.5916, lng: -122.0183, access: "members" },
    { name: "Concord High School Gym", city: "Concord, CA", lat: 37.9741, lng: -122.0262, access: "members" },
    { name: "Mt. Diablo High School Gym", city: "Concord, CA", lat: 37.9584, lng: -122.0040, access: "members" },
    { name: "Ygnacio Valley High School Gym", city: "Concord, CA", lat: 37.9510, lng: -122.0166, access: "members" },
    { name: "Clayton Valley Charter High School Gym", city: "Concord, CA", lat: 37.9446, lng: -121.9700, access: "members" },
    { name: "Pittsburg High School Gym", city: "Pittsburg, CA", lat: 38.0248, lng: -121.8875, access: "members" },
    { name: "Antioch High School Gym", city: "Antioch, CA", lat: 37.9968, lng: -121.8107, access: "members" },
    { name: "Deer Valley High School Gym", city: "Antioch, CA", lat: 38.0003, lng: -121.7868, access: "members" },
    { name: "Liberty High School Gym (Brentwood)", city: "Brentwood, CA", lat: 37.9216, lng: -121.7206, access: "members" },
    { name: "Heritage High School Gym (Brentwood)", city: "Brentwood, CA", lat: 37.9098, lng: -121.7379, access: "members" },
    { name: "Dublin High School Gym", city: "Dublin, CA", lat: 37.7103, lng: -121.9337, access: "members" },
    { name: "Pleasanton High School Gym", city: "Pleasanton, CA", lat: 37.6533, lng: -121.8754, access: "members" },
    { name: "Amador Valley High School Gym", city: "Pleasanton, CA", lat: 37.6637, lng: -121.8853, access: "members" },
    { name: "Livermore High School Gym", city: "Livermore, CA", lat: 37.6830, lng: -121.7662, access: "members" },
    { name: "Granada High School Gym", city: "Livermore, CA", lat: 37.6732, lng: -121.7369, access: "members" },
    { name: "San Ramon Valley High School Gym", city: "Danville, CA", lat: 37.8127, lng: -121.9624, access: "members" },
    { name: "Dougherty Valley High School Gym", city: "San Ramon, CA", lat: 37.7582, lng: -121.9069, access: "members" },
    { name: "Acalanes High School Gym", city: "Lafayette, CA", lat: 37.8925, lng: -122.1120, access: "members" },
    { name: "Campolindo High School Gym", city: "Moraga, CA", lat: 37.8473, lng: -122.1243, access: "members" },
    { name: "Miramonte High School Gym", city: "Orinda, CA", lat: 37.8770, lng: -122.1696, access: "members" },
];

const PENINSULA_SCHOOLS = [
    { name: "South San Francisco High School Gym", city: "South San Francisco, CA", lat: 37.6481, lng: -122.4254, access: "members" },
    { name: "Westmoor High School Gym", city: "Daly City, CA", lat: 37.6645, lng: -122.4706, access: "members" },
    { name: "Jefferson High School Gym (DC)", city: "Daly City, CA", lat: 37.6869, lng: -122.4701, access: "members" },
    { name: "Serramonte High School Gym", city: "Daly City, CA", lat: 37.6707, lng: -122.4815, access: "members" },
    { name: "San Mateo High School Gym", city: "San Mateo, CA", lat: 37.5524, lng: -122.3197, access: "members" },
    { name: "Aragon High School Gym", city: "San Mateo, CA", lat: 37.5319, lng: -122.2961, access: "members" },
    { name: "Hillsdale High School Gym", city: "San Mateo, CA", lat: 37.5374, lng: -122.3468, access: "members" },
    { name: "Burlingame High School Gym", city: "Burlingame, CA", lat: 37.5767, lng: -122.3534, access: "members" },
    { name: "Carlmont High School Gym", city: "Belmont, CA", lat: 37.5109, lng: -122.2752, access: "members" },
    { name: "Sequoia High School Gym", city: "Redwood City, CA", lat: 37.4864, lng: -122.2320, access: "members" },
    { name: "Woodside High School Gym", city: "Woodside, CA", lat: 37.4508, lng: -122.2423, access: "members" },
    { name: "Menlo-Atherton High School Gym", city: "Atherton, CA", lat: 37.4456, lng: -122.1967, access: "members" },
    { name: "Palo Alto High School Gym", city: "Palo Alto, CA", lat: 37.4371, lng: -122.1556, access: "members" },
    { name: "Henry M. Gunn High School Gym", city: "Palo Alto, CA", lat: 37.4005, lng: -122.1338, access: "members" },
    { name: "Mountain View High School Gym (CA)", city: "Mountain View, CA", lat: 37.3842, lng: -122.0656, access: "members" },
    { name: "Los Altos High School Gym", city: "Los Altos, CA", lat: 37.3704, lng: -122.0928, access: "members" },
    { name: "Homestead High School Gym", city: "Cupertino, CA", lat: 37.3388, lng: -122.0543, access: "members" },
    { name: "Monta Vista High School Gym", city: "Cupertino, CA", lat: 37.3203, lng: -122.0513, access: "members" },
    { name: "Lynbrook High School Gym", city: "San Jose, CA", lat: 37.3104, lng: -122.0232, access: "members" },
    { name: "Saratoga High School Gym", city: "Saratoga, CA", lat: 37.2741, lng: -122.0300, access: "members" },
    { name: "Los Gatos High School Gym", city: "Los Gatos, CA", lat: 37.2332, lng: -121.9601, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  CA AUDIT P3: BAY AREA SCHOOLS            ║');
    console.log('╚══════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['San Francisco Schools', SF_SCHOOLS],
        ['Oakland USD', OAKLAND_USD],
        ['San Jose Schools', SAN_JOSE_SCHOOLS],
        ['East Bay Schools', EAST_BAY_SCHOOLS],
        ['Peninsula/South Bay Schools', PENINSULA_SCHOOLS],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`CA P3 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

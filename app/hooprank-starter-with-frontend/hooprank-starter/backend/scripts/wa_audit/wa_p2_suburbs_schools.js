/**
 * WA Audit Part 2: Seattle Suburbs — School Districts
 * Bellevue, Kent, Federal Way, Renton, Highline, Tukwila, Auburn, Issaquah, Lake Washington
 */
const { runImport } = require('./boilerplate');

const BELLEVUE_SCHOOLS = [
    // High Schools
    { name: "Bellevue High School Gym", city: "Bellevue, WA", lat: 47.6078, lng: -122.1977, access: "members" },
    { name: "Newport High School Gym", city: "Bellevue, WA", lat: 47.5710, lng: -122.1369, access: "members" },
    { name: "Interlake High School Gym", city: "Bellevue, WA", lat: 47.6207, lng: -122.1616, access: "members" },
    { name: "Sammamish High School Gym", city: "Bellevue, WA", lat: 47.5886, lng: -122.1595, access: "members" },
    // Middle Schools
    { name: "Chinook Middle School Gym", city: "Bellevue, WA", lat: 47.5789, lng: -122.1504, access: "members" },
    { name: "Tillicum Middle School Gym", city: "Bellevue, WA", lat: 47.6266, lng: -122.1700, access: "members" },
    { name: "Odle Middle School Gym", city: "Bellevue, WA", lat: 47.6104, lng: -122.1824, access: "members" },
    { name: "Highland Middle School Gym", city: "Bellevue, WA", lat: 47.5925, lng: -122.1270, access: "members" },
    { name: "Tyee Middle School Gym", city: "Bellevue, WA", lat: 47.5646, lng: -122.1777, access: "members" },
];

const KENT_SCHOOLS = [
    { name: "Kent-Meridian High School Gym", city: "Kent, WA", lat: 47.3670, lng: -122.2173, access: "members" },
    { name: "Kentwood High School Gym", city: "Covington, WA", lat: 47.3567, lng: -122.1164, access: "members" },
    { name: "Kentlake High School Gym", city: "Kent, WA", lat: 47.3271, lng: -122.1037, access: "members" },
    { name: "Kentridge High School Gym", city: "Kent, WA", lat: 47.3834, lng: -122.1893, access: "members" },
    { name: "Meeker Middle School Gym", city: "Kent, WA", lat: 47.3817, lng: -122.2344, access: "members" },
    { name: "Mattson Middle School Gym", city: "Kent, WA", lat: 47.3491, lng: -122.1992, access: "members" },
    { name: "Meridian Middle School Gym", city: "Kent, WA", lat: 47.3745, lng: -122.2042, access: "members" },
    { name: "Cedar Heights Middle School Gym", city: "Covington, WA", lat: 47.3523, lng: -122.1230, access: "members" },
    { name: "Mill Creek Middle School Gym", city: "Kent, WA", lat: 47.3938, lng: -122.2477, access: "members" },
];

const FEDERAL_WAY_SCHOOLS = [
    { name: "Federal Way High School Gym", city: "Federal Way, WA", lat: 47.3221, lng: -122.3112, access: "members" },
    { name: "Todd Beamer High School Gym", city: "Federal Way, WA", lat: 47.2960, lng: -122.3555, access: "members" },
    { name: "Thomas Jefferson High School Gym", city: "Federal Way, WA", lat: 47.2818, lng: -122.3069, access: "members" },
    { name: "Decatur High School Gym", city: "Federal Way, WA", lat: 47.3102, lng: -122.3401, access: "members" },
    { name: "Illahee Middle School Gym", city: "Federal Way, WA", lat: 47.3047, lng: -122.3685, access: "members" },
    { name: "Lakota Middle School Gym", city: "Federal Way, WA", lat: 47.2892, lng: -122.3438, access: "members" },
    { name: "Sacajawea Middle School Gym (FW)", city: "Federal Way, WA", lat: 47.3150, lng: -122.2962, access: "members" },
    { name: "Kilo Middle School Gym", city: "Federal Way, WA", lat: 47.3375, lng: -122.3222, access: "members" },
];

const RENTON_SCHOOLS = [
    { name: "Renton High School Gym", city: "Renton, WA", lat: 47.4811, lng: -122.2127, access: "members" },
    { name: "Hazen High School Gym", city: "Renton, WA", lat: 47.4585, lng: -122.1455, access: "members" },
    { name: "Lindbergh High School Gym", city: "Renton, WA", lat: 47.4455, lng: -122.2620, access: "members" },
    { name: "Nelsen Middle School Gym", city: "Renton, WA", lat: 47.4744, lng: -122.1958, access: "members" },
    { name: "McKnight Middle School Gym", city: "Renton, WA", lat: 47.4467, lng: -122.1664, access: "members" },
    { name: "Dimmitt Middle School Gym", city: "Renton, WA", lat: 47.4378, lng: -122.2200, access: "members" },
];

const HIGHLINE_SCHOOLS = [
    { name: "Mount Rainier High School Gym", city: "Des Moines, WA", lat: 47.3877, lng: -122.3086, access: "members" },
    { name: "Highline High School Gym", city: "Burien, WA", lat: 47.4651, lng: -122.3317, access: "members" },
    { name: "Evergreen High School Gym", city: "Seattle, WA", lat: 47.4863, lng: -122.3405, access: "members" },
    { name: "Tyee High School Gym", city: "SeaTac, WA", lat: 47.4440, lng: -122.2962, access: "members" },
    { name: "Pacific Middle School Gym", city: "Des Moines, WA", lat: 47.3966, lng: -122.3181, access: "members" },
    { name: "Sylvester Middle School Gym", city: "Burien, WA", lat: 47.4730, lng: -122.3326, access: "members" },
    { name: "Chinook Middle School Gym (Highline)", city: "SeaTac, WA", lat: 47.4520, lng: -122.3010, access: "members" },
];

const AUBURN_SCHOOLS = [
    { name: "Auburn High School Gym", city: "Auburn, WA", lat: 47.3074, lng: -122.2253, access: "members" },
    { name: "Auburn Mountainview High School Gym", city: "Auburn, WA", lat: 47.2856, lng: -122.2137, access: "members" },
    { name: "Auburn Riverside High School Gym", city: "Auburn, WA", lat: 47.3160, lng: -122.1803, access: "members" },
    { name: "Rainier Middle School Gym", city: "Auburn, WA", lat: 47.3150, lng: -122.2360, access: "members" },
    { name: "Mt. Baker Middle School Gym", city: "Auburn, WA", lat: 47.2936, lng: -122.2086, access: "members" },
    { name: "Olympic Middle School Gym", city: "Auburn, WA", lat: 47.2994, lng: -122.1795, access: "members" },
    { name: "Cascade Middle School Gym", city: "Auburn, WA", lat: 47.3340, lng: -122.2228, access: "members" },
];

const LAKE_WASHINGTON_SCHOOLS = [
    { name: "Juanita High School Gym", city: "Kirkland, WA", lat: 47.7098, lng: -122.2138, access: "members" },
    { name: "Lake Washington High School Gym", city: "Kirkland, WA", lat: 47.6827, lng: -122.2073, access: "members" },
    { name: "Redmond High School Gym", city: "Redmond, WA", lat: 47.6757, lng: -122.1238, access: "members" },
    { name: "Eastlake High School Gym", city: "Sammamish, WA", lat: 47.5986, lng: -122.0441, access: "members" },
    { name: "Tesla STEM High School Gym", city: "Redmond, WA", lat: 47.6549, lng: -122.0766, access: "members" },
    { name: "Finn Hill Middle School Gym", city: "Kirkland, WA", lat: 47.7175, lng: -122.2280, access: "members" },
    { name: "Kirkland Middle School Gym", city: "Kirkland, WA", lat: 47.6819, lng: -122.1929, access: "members" },
    { name: "Rose Hill Middle School Gym", city: "Kirkland, WA", lat: 47.6673, lng: -122.1808, access: "members" },
    { name: "Redmond Middle School Gym", city: "Redmond, WA", lat: 47.6643, lng: -122.1210, access: "members" },
    { name: "Evergreen Middle School Gym", city: "Redmond, WA", lat: 47.6936, lng: -122.1042, access: "members" },
    { name: "Inglewood Middle School Gym", city: "Sammamish, WA", lat: 47.5927, lng: -122.0640, access: "members" },
];

const ISSAQUAH_SCHOOLS = [
    { name: "Issaquah High School Gym", city: "Issaquah, WA", lat: 47.5380, lng: -122.0458, access: "members" },
    { name: "Skyline High School Gym", city: "Sammamish, WA", lat: 47.6019, lng: -122.0168, access: "members" },
    { name: "Liberty High School Gym", city: "Renton, WA", lat: 47.5117, lng: -122.0313, access: "members" },
    { name: "Maywood Middle School Gym", city: "Issaquah, WA", lat: 47.5281, lng: -122.0374, access: "members" },
    { name: "Pacific Cascade Middle School Gym", city: "Issaquah, WA", lat: 47.5453, lng: -122.0122, access: "members" },
    { name: "Pine Lake Middle School Gym", city: "Sammamish, WA", lat: 47.5910, lng: -122.0367, access: "members" },
];

const TUKWILA_SCHOOLS = [
    { name: "Foster High School Gym", city: "Tukwila, WA", lat: 47.4744, lng: -122.2571, access: "members" },
    { name: "Showalter Middle School Gym", city: "Tukwila, WA", lat: 47.4851, lng: -122.2704, access: "members" },
    { name: "Tukwila Elementary Gym", city: "Tukwila, WA", lat: 47.4722, lng: -122.2640, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  WA AUDIT P2: SEATTLE SUBURBS SCHOOL DISTS  ║');
    console.log('╚══════════════════════════════════════════════╝');

    let totalOk = 0, totalFail = 0;
    const regions = [
        ['Bellevue School District', BELLEVUE_SCHOOLS],
        ['Kent School District', KENT_SCHOOLS],
        ['Federal Way SD', FEDERAL_WAY_SCHOOLS],
        ['Renton SD', RENTON_SCHOOLS],
        ['Highline SD', HIGHLINE_SCHOOLS],
        ['Auburn SD', AUBURN_SCHOOLS],
        ['Lake Washington SD', LAKE_WASHINGTON_SCHOOLS],
        ['Issaquah SD', ISSAQUAH_SCHOOLS],
        ['Tukwila SD', TUKWILA_SCHOOLS],
    ];

    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`WA P2 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}

main();

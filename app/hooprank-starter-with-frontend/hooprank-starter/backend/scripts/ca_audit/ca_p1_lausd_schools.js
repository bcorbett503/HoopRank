/**
 * CA Audit Part 1: LAUSD Schools — High Schools and Middle Schools
 */
const { runImport } = require('../wa_audit/boilerplate');

const LAUSD_HIGH_SCHOOLS = [
    { name: "Crenshaw High School Gym", city: "Los Angeles, CA", lat: 33.9913, lng: -118.3318, access: "members" },
    { name: "Dorsey High School Gym", city: "Los Angeles, CA", lat: 34.0094, lng: -118.3473, access: "members" },
    { name: "Manual Arts High School Gym", city: "Los Angeles, CA", lat: 34.0008, lng: -118.2987, access: "members" },
    { name: "Fremont High School Gym", city: "Los Angeles, CA", lat: 33.9764, lng: -118.2690, access: "members" },
    { name: "John C. Fremont High School Gym", city: "Los Angeles, CA", lat: 33.9764, lng: -118.2690, access: "members" },
    { name: "Washington Prep High School Gym", city: "Los Angeles, CA", lat: 33.9616, lng: -118.3073, access: "members" },
    { name: "Jordan High School Gym", city: "Los Angeles, CA", lat: 33.9267, lng: -118.2375, access: "members" },
    { name: "Locke High School Gym", city: "Los Angeles, CA", lat: 33.9331, lng: -118.2543, access: "members" },
    { name: "South Gate High School Gym", city: "South Gate, CA", lat: 33.9508, lng: -118.1910, access: "members" },
    { name: "Westchester Enriched Sciences Magnets Gym", city: "Los Angeles, CA", lat: 33.9586, lng: -118.3989, access: "members" },
    { name: "Venice High School Gym", city: "Los Angeles, CA", lat: 33.9962, lng: -118.4510, access: "members" },
    { name: "Hamilton High School Gym", city: "Los Angeles, CA", lat: 34.0306, lng: -118.3946, access: "members" },
    { name: "Fairfax High School Gym", city: "Los Angeles, CA", lat: 34.0781, lng: -118.3660, access: "members" },
    { name: "Hollywood High School Gym", city: "Los Angeles, CA", lat: 34.0978, lng: -118.3387, access: "members" },
    { name: "Marshall High School Gym", city: "Los Angeles, CA", lat: 34.1024, lng: -118.2677, access: "members" },
    { name: "Franklin High School Gym (LA)", city: "Los Angeles, CA", lat: 34.1170, lng: -118.2429, access: "members" },
    { name: "Eagle Rock High School Gym", city: "Los Angeles, CA", lat: 34.1316, lng: -118.2122, access: "members" },
    { name: "Lincoln High School Gym (LA)", city: "Los Angeles, CA", lat: 34.0639, lng: -118.2030, access: "members" },
    { name: "Roosevelt High School Gym (LA)", city: "Los Angeles, CA", lat: 34.0402, lng: -118.2044, access: "members" },
    { name: "Garfield High School Gym (LA)", city: "East Los Angeles, CA", lat: 34.0198, lng: -118.1654, access: "members" },
    { name: "Belmont High School Gym", city: "Los Angeles, CA", lat: 34.0672, lng: -118.2737, access: "members" },
    { name: "Los Angeles High School Gym", city: "Los Angeles, CA", lat: 34.0534, lng: -118.3175, access: "members" },
    { name: "University High School Gym (LA)", city: "Los Angeles, CA", lat: 34.0373, lng: -118.4401, access: "members" },
    { name: "Palisades Charter High School Gym", city: "Los Angeles, CA", lat: 34.0510, lng: -118.5261, access: "members" },
    { name: "Taft High School Gym", city: "Woodland Hills, CA", lat: 34.1694, lng: -118.5958, access: "members" },
    { name: "Chatsworth High School Gym", city: "Chatsworth, CA", lat: 34.2516, lng: -118.5904, access: "members" },
    { name: "Granada Hills Charter High School Gym", city: "Granada Hills, CA", lat: 34.2780, lng: -118.5055, access: "members" },
    { name: "Kennedy High School Gym", city: "Granada Hills, CA", lat: 34.2630, lng: -118.4851, access: "members" },
    { name: "Cleveland High School Gym (Reseda)", city: "Reseda, CA", lat: 34.2092, lng: -118.5360, access: "members" },
    { name: "Reseda High School Gym", city: "Reseda, CA", lat: 34.1982, lng: -118.5374, access: "members" },
    { name: "Canoga Park High School Gym", city: "Canoga Park, CA", lat: 34.2034, lng: -118.5907, access: "members" },
    { name: "El Camino Real Charter High School Gym", city: "Woodland Hills, CA", lat: 34.1813, lng: -118.5699, access: "members" },
    { name: "Birmingham Community Charter High School Gym", city: "Lake Balboa, CA", lat: 34.1791, lng: -118.4980, access: "members" },
    { name: "Van Nuys High School Gym", city: "Van Nuys, CA", lat: 34.1867, lng: -118.4488, access: "members" },
    { name: "North Hollywood High School Gym", city: "North Hollywood, CA", lat: 34.1688, lng: -118.3879, access: "members" },
    { name: "Grant High School Gym (Valley Glen)", city: "Valley Glen, CA", lat: 34.1929, lng: -118.4242, access: "members" },
    { name: "Monroe High School Gym", city: "North Hills, CA", lat: 34.2324, lng: -118.4687, access: "members" },
    { name: "Sylmar High School Gym", city: "Sylmar, CA", lat: 34.3077, lng: -118.4445, access: "members" },
    { name: "San Fernando High School Gym", city: "San Fernando, CA", lat: 34.2820, lng: -118.4358, access: "members" },
    { name: "Verdugo Hills High School Gym", city: "Tujunga, CA", lat: 34.2486, lng: -118.2861, access: "members" },
    { name: "Sun Valley Magnet High School Gym", city: "Sun Valley, CA", lat: 34.2202, lng: -118.3725, access: "members" },
    { name: "Carson High School Gym", city: "Carson, CA", lat: 33.8436, lng: -118.2555, access: "members" },
    { name: "Narbonne High School Gym", city: "Harbor City, CA", lat: 33.7893, lng: -118.2934, access: "members" },
    { name: "San Pedro High School Gym", city: "San Pedro, CA", lat: 33.7329, lng: -118.2943, access: "members" },
    { name: "Banning High School Gym", city: "Wilmington, CA", lat: 33.7819, lng: -118.2592, access: "members" },
    { name: "Gardena High School Gym", city: "Gardena, CA", lat: 33.8846, lng: -118.3008, access: "members" },
];

const LAUSD_MIDDLE_SCHOOLS = [
    { name: "Audubon Middle School Gym", city: "Los Angeles, CA", lat: 34.0054, lng: -118.3307, access: "members" },
    { name: "Foshay Learning Center Gym", city: "Los Angeles, CA", lat: 34.0146, lng: -118.2953, access: "members" },
    { name: "Mark Twain Middle School Gym", city: "Los Angeles, CA", lat: 33.9862, lng: -118.3460, access: "members" },
    { name: "Bret Harte Middle School Gym", city: "Los Angeles, CA", lat: 33.9700, lng: -118.2888, access: "members" },
    { name: "John Muir Middle School Gym (LA)", city: "Los Angeles, CA", lat: 33.9576, lng: -118.2513, access: "members" },
    { name: "Orville Wright Middle School Gym", city: "Los Angeles, CA", lat: 33.9518, lng: -118.3870, access: "members" },
    { name: "Palms Middle School Gym", city: "Los Angeles, CA", lat: 34.0192, lng: -118.3982, access: "members" },
    { name: "Emerson Middle School Gym", city: "Los Angeles, CA", lat: 34.0481, lng: -118.4044, access: "members" },
    { name: "Harte Prep Middle School Gym", city: "Los Angeles, CA", lat: 33.9730, lng: -118.2852, access: "members" },
    { name: "Bancroft Middle School Gym", city: "Los Angeles, CA", lat: 34.0892, lng: -118.3399, access: "members" },
    { name: "LeConte Middle School Gym", city: "Los Angeles, CA", lat: 34.0885, lng: -118.3590, access: "members" },
    { name: "King/Drew Medical Magnet High School Gym", city: "Los Angeles, CA", lat: 33.9287, lng: -118.2267, access: "members" },
    { name: "Virgil Middle School Gym", city: "Los Angeles, CA", lat: 34.0771, lng: -118.2903, access: "members" },
    { name: "Stevenson Middle School Gym", city: "East Los Angeles, CA", lat: 34.0327, lng: -118.1726, access: "members" },
    { name: "Hollenbeck Middle School Gym", city: "Los Angeles, CA", lat: 34.0415, lng: -118.2123, access: "members" },
    { name: "Irving Middle School Gym", city: "Los Angeles, CA", lat: 34.1049, lng: -118.2476, access: "members" },
    { name: "Luther Burbank Middle School Gym", city: "Los Angeles, CA", lat: 34.1297, lng: -118.2595, access: "members" },
    { name: "Henry T. Gage Middle School Gym", city: "Huntington Park, CA", lat: 33.9794, lng: -118.2219, access: "members" },
    { name: "Gaspar De Portola Middle School Gym", city: "Tarzana, CA", lat: 34.1756, lng: -118.5541, access: "members" },
    { name: "James Madison Middle School Gym (LA)", city: "North Hollywood, CA", lat: 34.1878, lng: -118.3906, access: "members" },
    { name: "Robert Fulton College Prep Gym", city: "Van Nuys, CA", lat: 34.1854, lng: -118.4643, access: "members" },
    { name: "Sepulveda Middle School Gym", city: "Mission Hills, CA", lat: 34.2726, lng: -118.4615, access: "members" },
    { name: "Olive Vista Middle School Gym", city: "Sylmar, CA", lat: 34.3038, lng: -118.4197, access: "members" },
    { name: "Dodson Middle School Gym", city: "San Pedro, CA", lat: 33.7442, lng: -118.3146, access: "members" },
    { name: "Dana Middle School Gym", city: "San Pedro, CA", lat: 33.7275, lng: -118.2790, access: "members" },
    { name: "Carnegie Middle School Gym", city: "Carson, CA", lat: 33.8502, lng: -118.2666, access: "members" },
    { name: "Peary Middle School Gym", city: "Gardena, CA", lat: 33.8785, lng: -118.3134, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║  CA AUDIT P1: LAUSD SCHOOLS           ║');
    console.log('╚══════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    for (const [label, courts] of [
        ['LAUSD High Schools', LAUSD_HIGH_SCHOOLS],
        ['LAUSD Middle Schools', LAUSD_MIDDLE_SCHOOLS],
    ]) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`CA P1 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

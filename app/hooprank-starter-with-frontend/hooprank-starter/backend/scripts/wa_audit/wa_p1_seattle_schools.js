/**
 * WA Audit Part 1: Seattle Public Schools
 * High Schools, Middle Schools, Elementary Schools
 */
const { runImport } = require('./boilerplate');

const SEATTLE_HIGH_SCHOOLS = [
    { name: "Garfield High School Gym", city: "Seattle, WA", lat: 47.6130, lng: -122.3094, access: "members" },
    { name: "Rainier Beach High School Gym", city: "Seattle, WA", lat: 47.5166, lng: -122.2677, access: "members" },
    { name: "Franklin High School Gym", city: "Seattle, WA", lat: 47.5519, lng: -122.3084, access: "members" },
    { name: "Cleveland High School STEM Gym", city: "Seattle, WA", lat: 47.5670, lng: -122.3138, access: "members" },
    { name: "Chief Sealth International High School Gym", city: "Seattle, WA", lat: 47.5242, lng: -122.3647, access: "members" },
    { name: "West Seattle High School Gym", city: "Seattle, WA", lat: 47.5612, lng: -122.3873, access: "members" },
    { name: "Ballard High School Gym", city: "Seattle, WA", lat: 47.6700, lng: -122.3800, access: "members" },
    { name: "Roosevelt High School Gym", city: "Seattle, WA", lat: 47.6795, lng: -122.3175, access: "members" },
    { name: "Nathan Hale High School Gym", city: "Seattle, WA", lat: 47.7099, lng: -122.3087, access: "members" },
    { name: "Ingraham High School Gym", city: "Seattle, WA", lat: 47.7219, lng: -122.3522, access: "members" },
    { name: "Lincoln High School Gym", city: "Seattle, WA", lat: 47.6546, lng: -122.3510, access: "members" },
    { name: "The Center School Gym", city: "Seattle, WA", lat: 47.6235, lng: -122.3492, access: "members" },
    { name: "Nova High School Gym", city: "Seattle, WA", lat: 47.6078, lng: -122.3192, access: "members" },
    { name: "Interagency Academy Gym", city: "Seattle, WA", lat: 47.6164, lng: -122.3351, access: "members" },
];

const SEATTLE_MIDDLE_SCHOOLS = [
    { name: "Washington Middle School Gym", city: "Seattle, WA", lat: 47.6042, lng: -122.3018, access: "members" },
    { name: "Mercer International Middle School Gym", city: "Seattle, WA", lat: 47.5805, lng: -122.3115, access: "members" },
    { name: "Aki Kurose Middle School Gym", city: "Seattle, WA", lat: 47.5350, lng: -122.2839, access: "members" },
    { name: "Denny International Middle School Gym", city: "Seattle, WA", lat: 47.5480, lng: -122.3663, access: "members" },
    { name: "Madison Middle School Gym", city: "Seattle, WA", lat: 47.5519, lng: -122.3911, access: "members" },
    { name: "Whitman Middle School Gym", city: "Seattle, WA", lat: 47.6812, lng: -122.3612, access: "members" },
    { name: "Hamilton International Middle School Gym", city: "Seattle, WA", lat: 47.6498, lng: -122.3723, access: "members" },
    { name: "Eckstein Middle School Gym", city: "Seattle, WA", lat: 47.6934, lng: -122.2946, access: "members" },
    { name: "Jane Addams Middle School Gym", city: "Seattle, WA", lat: 47.7169, lng: -122.3256, access: "members" },
    { name: "Robert Eagle Staff Middle School Gym", city: "Seattle, WA", lat: 47.6844, lng: -122.3424, access: "members" },
    { name: "Meany Middle School Gym", city: "Seattle, WA", lat: 47.6095, lng: -122.3073, access: "members" },
    { name: "Broadview-Thomson K-8 Gym", city: "Seattle, WA", lat: 47.7247, lng: -122.3581, access: "members" },
];

const SEATTLE_ELEMENTARY = [
    { name: "Rainier View Elementary Gym", city: "Seattle, WA", lat: 47.5108, lng: -122.2645, access: "members" },
    { name: "Emerson Elementary Gym", city: "Seattle, WA", lat: 47.5201, lng: -122.2873, access: "members" },
    { name: "Dunlap Elementary Gym", city: "Seattle, WA", lat: 47.5238, lng: -122.2683, access: "members" },
    { name: "Wing Luke Elementary Gym", city: "Seattle, WA", lat: 47.5326, lng: -122.2652, access: "members" },
    { name: "Hawthorne Elementary Gym", city: "Seattle, WA", lat: 47.5498, lng: -122.2762, access: "members" },
    { name: "Beacon Hill International School Gym", city: "Seattle, WA", lat: 47.5679, lng: -122.3085, access: "members" },
    { name: "Maple Elementary Gym", city: "Seattle, WA", lat: 47.5411, lng: -122.3015, access: "members" },
    { name: "Columbia Elementary Gym", city: "Seattle, WA", lat: 47.5576, lng: -122.2888, access: "members" },
    { name: "Leschi Elementary Gym", city: "Seattle, WA", lat: 47.5983, lng: -122.2897, access: "members" },
    { name: "Madrona Elementary Gym", city: "Seattle, WA", lat: 47.6124, lng: -122.2918, access: "members" },
    { name: "Stevens Elementary Gym", city: "Seattle, WA", lat: 47.6227, lng: -122.2993, access: "members" },
    { name: "Montlake Elementary Gym", city: "Seattle, WA", lat: 47.6371, lng: -122.3035, access: "members" },
    { name: "Lowell Elementary Gym", city: "Seattle, WA", lat: 47.6050, lng: -122.3248, access: "members" },
    { name: "Bailey Gatzert Elementary Gym", city: "Seattle, WA", lat: 47.5985, lng: -122.3213, access: "members" },
    { name: "John Muir Elementary Gym", city: "Seattle, WA", lat: 47.5840, lng: -122.3052, access: "members" },
    { name: "Thurgood Marshall Elementary Gym", city: "Seattle, WA", lat: 47.5867, lng: -122.3168, access: "members" },
    { name: "Kimball Elementary Gym", city: "Seattle, WA", lat: 47.6041, lng: -122.3370, access: "members" },
    { name: "Sanislo Elementary Gym", city: "Seattle, WA", lat: 47.5165, lng: -122.3649, access: "members" },
    { name: "Highland Park Elementary Gym", city: "Seattle, WA", lat: 47.5283, lng: -122.3494, access: "members" },
    { name: "Roxhill Elementary Gym", city: "Seattle, WA", lat: 47.5178, lng: -122.3717, access: "members" },
    { name: "Concord International Elementary Gym", city: "Seattle, WA", lat: 47.5218, lng: -122.3373, access: "members" },
    { name: "Arbor Heights Elementary Gym", city: "Seattle, WA", lat: 47.5090, lng: -122.3921, access: "members" },
    { name: "Gatewood Elementary Gym", city: "Seattle, WA", lat: 47.5415, lng: -122.3860, access: "members" },
    { name: "Lafayette Elementary Gym", city: "Seattle, WA", lat: 47.5594, lng: -122.3896, access: "members" },
    { name: "Fairmount Park Elementary Gym", city: "Seattle, WA", lat: 47.5488, lng: -122.3725, access: "members" },
    { name: "Genesee Hill Elementary Gym", city: "Seattle, WA", lat: 47.5639, lng: -122.3749, access: "members" },
    { name: "Alki Elementary Gym", city: "Seattle, WA", lat: 47.5806, lng: -122.4074, access: "members" },
    { name: "Pathfinder K-8 Gym", city: "Seattle, WA", lat: 47.5387, lng: -122.3695, access: "members" },
    { name: "Loyal Heights Elementary Gym", city: "Seattle, WA", lat: 47.6829, lng: -122.3856, access: "members" },
    { name: "Whittier Elementary Gym", city: "Seattle, WA", lat: 47.6762, lng: -122.3958, access: "members" },
    { name: "Adams Elementary Gym", city: "Seattle, WA", lat: 47.6645, lng: -122.3907, access: "members" },
    { name: "Salmon Bay K-8 Gym", city: "Seattle, WA", lat: 47.6661, lng: -122.3778, access: "members" },
    { name: "Greenwood Elementary Gym", city: "Seattle, WA", lat: 47.6920, lng: -122.3559, access: "members" },
    { name: "Northgate Elementary Gym", city: "Seattle, WA", lat: 47.7076, lng: -122.3296, access: "members" },
    { name: "Olympic Hills Elementary Gym", city: "Seattle, WA", lat: 47.7138, lng: -122.3051, access: "members" },
    { name: "John Rogers Elementary Gym", city: "Seattle, WA", lat: 47.7163, lng: -122.2900, access: "members" },
    { name: "Sacajawea Elementary Gym", city: "Seattle, WA", lat: 47.6936, lng: -122.2834, access: "members" },
    { name: "View Ridge Elementary Gym", city: "Seattle, WA", lat: 47.6867, lng: -122.2743, access: "members" },
    { name: "Bryant Elementary Gym", city: "Seattle, WA", lat: 47.6722, lng: -122.2826, access: "members" },
    { name: "Laurelhurst Elementary Gym", city: "Seattle, WA", lat: 47.6604, lng: -122.2841, access: "members" },
    { name: "McGilvra Elementary Gym", city: "Seattle, WA", lat: 47.6344, lng: -122.2886, access: "members" },
    { name: "Catharine Blaine K-8 Gym", city: "Seattle, WA", lat: 47.6493, lng: -122.4003, access: "members" },
    { name: "Lawton Elementary Gym", city: "Seattle, WA", lat: 47.6575, lng: -122.4087, access: "members" },
    { name: "Coe Elementary Gym", city: "Seattle, WA", lat: 47.6403, lng: -122.3770, access: "members" },
    { name: "Frantz Coe Elementary Gym", city: "Seattle, WA", lat: 47.6332, lng: -122.3564, access: "members" },
    { name: "McDonald International Elementary Gym", city: "Seattle, WA", lat: 47.6486, lng: -122.3521, access: "members" },
    { name: "B.F. Day Elementary Gym", city: "Seattle, WA", lat: 47.6617, lng: -122.3503, access: "members" },
    { name: "Green Lake Elementary Gym", city: "Seattle, WA", lat: 47.6804, lng: -122.3313, access: "members" },
    { name: "Bagley Elementary Gym", city: "Seattle, WA", lat: 47.6761, lng: -122.3461, access: "members" },
    { name: "Sand Point Elementary Gym", city: "Seattle, WA", lat: 47.6851, lng: -122.2594, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║  WA AUDIT P1: SEATTLE PUBLIC SCHOOLS ║');
    console.log('╚══════════════════════════════════════╝');

    let totalOk = 0, totalFail = 0;

    let r = await runImport('Seattle High Schools', SEATTLE_HIGH_SCHOOLS);
    totalOk += r.ok; totalFail += r.fail;

    r = await runImport('Seattle Middle Schools', SEATTLE_MIDDLE_SCHOOLS);
    totalOk += r.ok; totalFail += r.fail;

    r = await runImport('Seattle Elementary Schools', SEATTLE_ELEMENTARY);
    totalOk += r.ok; totalFail += r.fail;

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`WA P1 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}

main();

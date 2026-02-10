/**
 * WA Audit Part 4: Colleges, Universities, Rec Centers, YMCAs, Gyms
 */
const { runImport } = require('./boilerplate');

// ==========================================
// UNIVERSITIES & COLLEGES
// ==========================================
const WA_COLLEGES = [
    // Major Universities
    { name: "University of Washington IMA Building", city: "Seattle, WA", lat: 47.6534, lng: -122.3013, access: "members" },
    { name: "Seattle University Connolly Center", city: "Seattle, WA", lat: 47.6100, lng: -122.3171, access: "members" },
    { name: "Seattle Pacific University Royal Brougham Pavilion", city: "Seattle, WA", lat: 47.6501, lng: -122.3625, access: "members" },
    { name: "University of Puget Sound Memorial Fieldhouse", city: "Tacoma, WA", lat: 47.2618, lng: -122.4516, access: "members" },
    { name: "Pacific Lutheran University Olson Auditorium", city: "Tacoma, WA", lat: 47.1466, lng: -122.4447, access: "members" },
    { name: "Gonzaga University McCarthey Athletic Center", city: "Spokane, WA", lat: 47.6671, lng: -117.4027, access: "members" },
    { name: "Gonzaga University Martin Centre", city: "Spokane, WA", lat: 47.6666, lng: -117.3991, access: "members" },
    { name: "Eastern Washington University Reese Court", city: "Cheney, WA", lat: 47.4872, lng: -117.5825, access: "members" },
    { name: "Washington State University Beasley Coliseum", city: "Pullman, WA", lat: 46.7327, lng: -117.1648, access: "members" },
    { name: "Washington State University Student Rec Center", city: "Pullman, WA", lat: 46.7313, lng: -117.1577, access: "members" },
    { name: "Western Washington University Carver Gymnasium", city: "Bellingham, WA", lat: 48.7350, lng: -122.4867, access: "members" },
    { name: "Western Washington University Sam Carver Gym 2", city: "Bellingham, WA", lat: 48.7371, lng: -122.4889, access: "members" },
    { name: "Central Washington University Nicholson Pavilion", city: "Ellensburg, WA", lat: 46.9964, lng: -120.5371, access: "members" },
    { name: "Central Washington University Student Recreation Center", city: "Ellensburg, WA", lat: 46.9941, lng: -120.5409, access: "members" },
    { name: "Saint Martin's University Marcus Pavilion", city: "Lacey, WA", lat: 47.0040, lng: -122.7803, access: "members" },
    { name: "Whitworth University Fieldhouse", city: "Spokane, WA", lat: 47.7567, lng: -117.4160, access: "members" },
    // Community Colleges
    { name: "Bellevue College Gym", city: "Bellevue, WA", lat: 47.5850, lng: -122.1473, access: "members" },
    { name: "Green River College Gymnasium", city: "Auburn, WA", lat: 47.3204, lng: -122.2646, access: "members" },
    { name: "Highline College Pavilion", city: "Des Moines, WA", lat: 47.4046, lng: -122.3093, access: "members" },
    { name: "Tacoma Community College Gym", city: "Tacoma, WA", lat: 47.2182, lng: -122.4887, access: "members" },
    { name: "Pierce College Gym", city: "Lakewood, WA", lat: 47.1578, lng: -122.4958, access: "members" },
    { name: "Spokane Community College Gym", city: "Spokane, WA", lat: 47.6847, lng: -117.3658, access: "members" },
    { name: "Spokane Falls Community College Gym", city: "Spokane, WA", lat: 47.6903, lng: -117.4554, access: "members" },
    { name: "Everett Community College Gym", city: "Everett, WA", lat: 47.9691, lng: -122.2274, access: "members" },
    { name: "Shoreline Community College Gym", city: "Shoreline, WA", lat: 47.7553, lng: -122.3423, access: "members" },
    { name: "Columbia Basin College Gym", city: "Pasco, WA", lat: 46.2543, lng: -119.1447, access: "members" },
    { name: "Edmonds College Gym", city: "Lynnwood, WA", lat: 47.8122, lng: -122.2933, access: "members" },
    { name: "Clark College Gym", city: "Vancouver, WA", lat: 45.6349, lng: -122.6538, access: "members" },
    { name: "Yakima Valley College Gym", city: "Yakima, WA", lat: 46.5939, lng: -120.5094, access: "members" },
    { name: "Skagit Valley College Gym", city: "Mount Vernon, WA", lat: 48.4266, lng: -122.3307, access: "members" },
    { name: "Olympic College Gym", city: "Bremerton, WA", lat: 47.5773, lng: -122.6305, access: "members" },
    { name: "Whatcom Community College Gym", city: "Bellingham, WA", lat: 48.7810, lng: -122.4641, access: "members" },
    { name: "Wenatchee Valley College Gym", city: "Wenatchee, WA", lat: 47.4248, lng: -120.3315, access: "members" },
];

// ==========================================
// REC CENTERS & COMMUNITY CENTERS
// ==========================================
const WA_REC_CENTERS = [
    // Seattle
    { name: "Bitter Lake Community Center", city: "Seattle, WA", lat: 47.7206, lng: -122.3468, access: "public" },
    { name: "Delridge Community Center", city: "Seattle, WA", lat: 47.5392, lng: -122.3592, access: "public" },
    { name: "Rainier Community Center", city: "Seattle, WA", lat: 47.5228, lng: -122.2797, access: "public" },
    { name: "Rainier Beach Community Center", city: "Seattle, WA", lat: 47.5099, lng: -122.2672, access: "public" },
    { name: "Southwest Community Center", city: "Seattle, WA", lat: 47.5349, lng: -122.3632, access: "public" },
    { name: "Miller Community Center", city: "Seattle, WA", lat: 47.5810, lng: -122.3177, access: "public" },
    { name: "Garfield Community Center", city: "Seattle, WA", lat: 47.6130, lng: -122.2990, access: "public" },
    { name: "Yesler Community Center", city: "Seattle, WA", lat: 47.6020, lng: -122.3153, access: "public" },
    { name: "International District Community Center", city: "Seattle, WA", lat: 47.5965, lng: -122.3270, access: "public" },
    { name: "Magnolia Community Center", city: "Seattle, WA", lat: 47.6490, lng: -122.3994, access: "public" },
    { name: "Queen Anne Community Center", city: "Seattle, WA", lat: 47.6343, lng: -122.3579, access: "public" },
    { name: "Ballard Community Center", city: "Seattle, WA", lat: 47.6729, lng: -122.3847, access: "public" },
    { name: "Green Lake Community Center", city: "Seattle, WA", lat: 47.6807, lng: -122.3291, access: "public" },
    { name: "Ravenna-Eckstein Community Center", city: "Seattle, WA", lat: 47.6924, lng: -122.2952, access: "public" },
    { name: "Meadowbrook Community Center", city: "Seattle, WA", lat: 47.7122, lng: -122.2988, access: "public" },
    { name: "Northgate Community Center", city: "Seattle, WA", lat: 47.7085, lng: -122.3274, access: "public" },
    { name: "Van Asselt Community Center", city: "Seattle, WA", lat: 47.5177, lng: -122.2824, access: "public" },
    { name: "Highland Park Community Center", city: "Seattle, WA", lat: 47.5261, lng: -122.3478, access: "public" },
    { name: "Loyal Heights Community Center", city: "Seattle, WA", lat: 47.6844, lng: -122.3874, access: "public" },
    { name: "Montlake Community Center", city: "Seattle, WA", lat: 47.6382, lng: -122.3030, access: "public" },
    // Suburbs
    { name: "Crossroads Community Center", city: "Bellevue, WA", lat: 47.6165, lng: -122.1260, access: "public" },
    { name: "Highland Community Center", city: "Bellevue, WA", lat: 47.5935, lng: -122.1282, access: "public" },
    { name: "North Bellevue Community Center", city: "Bellevue, WA", lat: 47.6466, lng: -122.1726, access: "public" },
    { name: "Eastside Community Center", city: "Tacoma, WA", lat: 47.2504, lng: -122.4208, access: "public" },
    { name: "STAR Center", city: "Tacoma, WA", lat: 47.2428, lng: -122.4455, access: "public" },
    { name: "People's Community Center", city: "Tacoma, WA", lat: 47.2527, lng: -122.4706, access: "public" },
    { name: "Norpoint Activities Center", city: "Tacoma, WA", lat: 47.2780, lng: -122.3823, access: "public" },
    { name: "Kent Commons Recreation Center", city: "Kent, WA", lat: 47.3841, lng: -122.2342, access: "public" },
    { name: "Federal Way Community Center", city: "Federal Way, WA", lat: 47.3088, lng: -122.3358, access: "public" },
    { name: "Rainier Beach Community Center", city: "Renton, WA", lat: 47.4873, lng: -122.2014, access: "public" },
    { name: "Renton Community Center", city: "Renton, WA", lat: 47.4727, lng: -122.2168, access: "public" },
    { name: "Lynnwood Recreation Center", city: "Lynnwood, WA", lat: 47.8255, lng: -122.3151, access: "public" },
    { name: "Mountlake Terrace Recreation Pavilion", city: "Mountlake Terrace, WA", lat: 47.7882, lng: -122.3049, access: "public" },
    { name: "Mercer Island Community Center", city: "Mercer Island, WA", lat: 47.5719, lng: -122.2324, access: "public" },
    { name: "East Central Community Center", city: "Spokane, WA", lat: 47.6487, lng: -117.3864, access: "public" },
    { name: "Corbin Senior Activity Center", city: "Spokane, WA", lat: 47.6684, lng: -117.4419, access: "public" },
    { name: "Hillyard Community Center", city: "Spokane, WA", lat: 47.6934, lng: -117.3487, access: "public" },
    { name: "West Central Community Center", city: "Spokane, WA", lat: 47.6660, lng: -117.4490, access: "public" },
    { name: "Northeast Community Center", city: "Spokane, WA", lat: 47.7023, lng: -117.3846, access: "public" },
    { name: "Marshall Community Center", city: "Vancouver, WA", lat: 45.6471, lng: -122.6602, access: "public" },
    { name: "Firstenburg Community Center", city: "Vancouver, WA", lat: 45.6201, lng: -122.5502, access: "public" },
    { name: "Olympia Center", city: "Olympia, WA", lat: 47.0424, lng: -122.8990, access: "public" },
    { name: "Bremerton Community Center", city: "Bremerton, WA", lat: 47.5712, lng: -122.6367, access: "public" },
];

// ==========================================
// YMCAs
// ==========================================
const WA_YMCAS = [
    { name: "Downtown Seattle YMCA", city: "Seattle, WA", lat: 47.6101, lng: -122.3383, access: "members" },
    { name: "Auburn Valley YMCA", city: "Auburn, WA", lat: 47.3073, lng: -122.2285, access: "members" },
    { name: "Bellevue Family YMCA", city: "Bellevue, WA", lat: 47.6132, lng: -122.1892, access: "members" },
    { name: "Dale Turner Family YMCA", city: "Shoreline, WA", lat: 47.7631, lng: -122.3401, access: "members" },
    { name: "Haselwood Family YMCA", city: "Silverdale, WA", lat: 47.6529, lng: -122.6919, access: "members" },
    { name: "Morgan Family YMCA", city: "Tacoma, WA", lat: 47.2255, lng: -122.4559, access: "members" },
    { name: "Tacoma Center YMCA", city: "Tacoma, WA", lat: 47.2498, lng: -122.4396, access: "members" },
    { name: "Spokane Valley YMCA", city: "Spokane Valley, WA", lat: 47.6668, lng: -117.2752, access: "members" },
    { name: "North Spokane YMCA", city: "Spokane, WA", lat: 47.7195, lng: -117.4110, access: "members" },
    { name: "South Sound YMCA", city: "Olympia, WA", lat: 47.0395, lng: -122.8816, access: "members" },
    { name: "Clark County Family YMCA", city: "Vancouver, WA", lat: 45.6507, lng: -122.6190, access: "members" },
    { name: "Marysville Family YMCA", city: "Marysville, WA", lat: 48.0591, lng: -122.1710, access: "members" },
];

// ==========================================
// PRIVATE GYMS WITH COURTS
// ==========================================
const WA_GYMS = [
    { name: "24 Hour Fitness Lynnwood", city: "Lynnwood, WA", lat: 47.8209, lng: -122.3151, access: "members" },
    { name: "24 Hour Fitness Federal Way", city: "Federal Way, WA", lat: 47.3108, lng: -122.3124, access: "members" },
    { name: "24 Hour Fitness Bellevue", city: "Bellevue, WA", lat: 47.6138, lng: -122.1866, access: "members" },
    { name: "LA Fitness Kent", city: "Kent, WA", lat: 47.3907, lng: -122.2358, access: "members" },
    { name: "LA Fitness Tacoma", city: "Tacoma, WA", lat: 47.2587, lng: -122.4677, access: "members" },
    { name: "Eastside Catholic School Gym", city: "Sammamish, WA", lat: 47.5823, lng: -122.0636, access: "members" },
    { name: "O'Dea High School Gym", city: "Seattle, WA", lat: 47.6118, lng: -122.3232, access: "members" },
    { name: "Seattle Prep Gym", city: "Seattle, WA", lat: 47.6488, lng: -122.3123, access: "members" },
    { name: "Bishop Blanchet High School Gym", city: "Seattle, WA", lat: 47.6983, lng: -122.3382, access: "members" },
    { name: "Kennedy Catholic High School Gym", city: "Burien, WA", lat: 47.4710, lng: -122.3420, access: "members" },
    { name: "Eastside Preparatory School Gym", city: "Kirkland, WA", lat: 47.6924, lng: -122.1768, access: "members" },
    { name: "Forest Ridge School of the Sacred Heart Gym", city: "Bellevue, WA", lat: 47.5809, lng: -122.1685, access: "members" },
    { name: "Charles Wright Academy Gym", city: "Tacoma, WA", lat: 47.1964, lng: -122.5053, access: "members" },
    { name: "Annie Wright Schools Gym", city: "Tacoma, WA", lat: 47.2613, lng: -122.4628, access: "members" },
    { name: "Northwest University Gym", city: "Kirkland, WA", lat: 47.7031, lng: -122.1940, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  WA AUDIT P4: COLLEGES, REC CENTERS, YMCAs      ║');
    console.log('╚══════════════════════════════════════════════════╝');

    let totalOk = 0, totalFail = 0;
    const regions = [
        ['WA Colleges & Universities', WA_COLLEGES],
        ['WA Recreation Centers', WA_REC_CENTERS],
        ['WA YMCAs', WA_YMCAS],
        ['WA Private Gyms & Schools', WA_GYMS],
    ];

    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`WA P4 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}

main();

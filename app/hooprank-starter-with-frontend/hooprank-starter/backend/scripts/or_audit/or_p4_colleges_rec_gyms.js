/**
 * OR Audit Part 4: Colleges, Rec Centers, YMCAs, Gyms
 */
const { runImport } = require('../wa_audit/boilerplate');

const OR_COLLEGES = [
    // Major Universities
    { name: "University of Oregon Student Recreation Center", city: "Eugene, OR", lat: 44.0445, lng: -123.0727, access: "members" },
    { name: "University of Oregon Matthew Knight Arena", city: "Eugene, OR", lat: 44.0424, lng: -123.0097, access: "members" },
    { name: "Oregon State University Dixon Recreation Center", city: "Corvallis, OR", lat: 44.5631, lng: -123.2783, access: "members" },
    { name: "Oregon State University Gill Coliseum", city: "Corvallis, OR", lat: 44.5601, lng: -123.2796, access: "members" },
    { name: "Portland State University Peter Stott Center", city: "Portland, OR", lat: 44.5118, lng: -122.6868, access: "members" },
    { name: "Portland State University Viking Pavilion", city: "Portland, OR", lat: 45.5101, lng: -122.6842, access: "members" },
    { name: "University of Portland Chiles Center", city: "Portland, OR", lat: 45.5724, lng: -122.7269, access: "members" },
    { name: "Lewis & Clark College Pamplin Sports Center", city: "Portland, OR", lat: 45.4504, lng: -122.6731, access: "members" },
    { name: "Reed College Sports Center", city: "Portland, OR", lat: 45.4814, lng: -122.6305, access: "members" },
    { name: "Concordia University Gym", city: "Portland, OR", lat: 45.5623, lng: -122.6247, access: "members" },
    { name: "Warner Pacific University McGuire Gym", city: "Portland, OR", lat: 45.5114, lng: -122.5743, access: "members" },
    { name: "Multnomah University Gym", city: "Portland, OR", lat: 45.5135, lng: -122.5268, access: "members" },
    { name: "Willamette University Lestle J. Sparks Center", city: "Salem, OR", lat: 44.9370, lng: -123.0283, access: "members" },
    { name: "George Fox University Wheeler Sports Center", city: "Newberg, OR", lat: 45.2999, lng: -122.9735, access: "members" },
    { name: "Linfield University Ted Wilson Gymnasium", city: "McMinnville, OR", lat: 45.2038, lng: -123.1935, access: "members" },
    { name: "Pacific University Pacific Athletic Center", city: "Forest Grove, OR", lat: 45.5232, lng: -123.1140, access: "members" },
    { name: "Western Oregon University New PE Building", city: "Monmouth, OR", lat: 44.8503, lng: -123.2298, access: "members" },
    { name: "Southern Oregon University McNeal Pavilion", city: "Ashland, OR", lat: 42.1935, lng: -122.7180, access: "members" },
    { name: "Eastern Oregon University Quinn Coliseum", city: "La Grande, OR", lat: 45.3340, lng: -118.0889, access: "members" },
    { name: "Oregon Institute of Technology Gymnasium", city: "Klamath Falls, OR", lat: 42.1952, lng: -121.7884, access: "members" },
    // Community Colleges
    { name: "Portland Community College Sylvania Gym", city: "Portland, OR", lat: 45.4626, lng: -122.7532, access: "members" },
    { name: "Portland Community College Cascade Gym", city: "Portland, OR", lat: 45.5658, lng: -122.6787, access: "members" },
    { name: "Portland Community College Southeast Gym", city: "Portland, OR", lat: 45.5029, lng: -122.5785, access: "members" },
    { name: "Mt. Hood Community College Gym", city: "Gresham, OR", lat: 45.4796, lng: -122.4186, access: "members" },
    { name: "Clackamas Community College Gym", city: "Oregon City, OR", lat: 45.3411, lng: -122.5725, access: "members" },
    { name: "Lane Community College Gym", city: "Eugene, OR", lat: 44.0012, lng: -123.0461, access: "members" },
    { name: "Chemeketa Community College Gym", city: "Salem, OR", lat: 44.9600, lng: -123.0025, access: "members" },
    { name: "Linn-Benton Community College Gym", city: "Albany, OR", lat: 44.6262, lng: -123.1056, access: "members" },
    { name: "Central Oregon Community College Gym", city: "Bend, OR", lat: 44.0590, lng: -121.3242, access: "members" },
    { name: "Rogue Community College Gym", city: "Grants Pass, OR", lat: 42.4302, lng: -123.3568, access: "members" },
    { name: "Umpqua Community College Gym", city: "Roseburg, OR", lat: 43.2587, lng: -123.3611, access: "members" },
    { name: "Southwestern Oregon Community College Gym", city: "Coos Bay, OR", lat: 43.3521, lng: -124.2296, access: "members" },
    { name: "Blue Mountain Community College Gym", city: "Pendleton, OR", lat: 45.6862, lng: -118.8142, access: "members" },
    { name: "Treasure Valley Community College Gym", city: "Ontario, OR", lat: 44.0281, lng: -116.9544, access: "members" },
];

const OR_REC_CENTERS = [
    // Portland Parks & Recreation
    { name: "Matt Dishman Community Center", city: "Portland, OR", lat: 45.5365, lng: -122.6537, access: "public" },
    { name: "East Portland Community Center", city: "Portland, OR", lat: 45.5117, lng: -122.5127, access: "public" },
    { name: "Charles Jordan Community Center", city: "Portland, OR", lat: 45.5823, lng: -122.7448, access: "public" },
    { name: "Mt. Scott Community Center", city: "Portland, OR", lat: 45.4799, lng: -122.5594, access: "public" },
    { name: "Southwest Community Center", city: "Portland, OR", lat: 45.4672, lng: -122.7156, access: "public" },
    { name: "North Portland Community Center", city: "Portland, OR", lat: 45.5806, lng: -122.6775, access: "public" },
    { name: "Montavilla Community Center", city: "Portland, OR", lat: 45.5210, lng: -122.5640, access: "public" },
    { name: "Woodstock Community Center", city: "Portland, OR", lat: 45.4794, lng: -122.6139, access: "public" },
    { name: "St. Johns Community Center", city: "Portland, OR", lat: 45.5914, lng: -122.7515, access: "public" },
    { name: "Peninsula Park Community Center", city: "Portland, OR", lat: 45.5698, lng: -122.6725, access: "public" },
    { name: "Sellwood Community Center", city: "Portland, OR", lat: 45.4674, lng: -122.6545, access: "public" },
    // Portland Suburbs
    { name: "Conestoga Recreation Center", city: "Beaverton, OR", lat: 45.4727, lng: -122.8345, access: "public" },
    { name: "Tualatin Hills Athletic Center", city: "Beaverton, OR", lat: 45.5005, lng: -122.8214, access: "public" },
    { name: "Elsie Stuhr Center", city: "Beaverton, OR", lat: 45.4799, lng: -122.8079, access: "public" },
    { name: "Cedar Hills Recreation Center", city: "Beaverton, OR", lat: 45.5048, lng: -122.7984, access: "public" },
    { name: "Oregon City Recreation Center", city: "Oregon City, OR", lat: 45.3577, lng: -122.6067, access: "public" },
    { name: "Lake Oswego Recreation Center", city: "Lake Oswego, OR", lat: 45.4208, lng: -122.6675, access: "public" },
    { name: "Tigard Community Recreation Center", city: "Tigard, OR", lat: 45.4308, lng: -122.7694, access: "public" },
    { name: "Tualatin Community Park Rec Center", city: "Tualatin, OR", lat: 45.3831, lng: -122.7607, access: "public" },
    { name: "Milwaukie Center", city: "Milwaukie, OR", lat: 45.4433, lng: -122.6411, access: "public" },
    { name: "North Clackamas Aquatic Park", city: "Milwaukie, OR", lat: 45.4386, lng: -122.5823, access: "public" },
    { name: "Pat Dooley Community Center", city: "Gresham, OR", lat: 45.5058, lng: -122.4415, access: "public" },
    // Salem
    { name: "Kroc Community Center Salem", city: "Salem, OR", lat: 44.9356, lng: -123.0272, access: "public" },
    { name: "Courthouse Square Athletic Club", city: "Salem, OR", lat: 44.9428, lng: -123.0372, access: "members" },
    // Eugene
    { name: "Echo Hollow Pool & Fitness Center", city: "Eugene, OR", lat: 44.0666, lng: -123.1337, access: "public" },
    { name: "Sheldon Community Center", city: "Eugene, OR", lat: 44.0870, lng: -123.0319, access: "public" },
    { name: "Amazon Community Center", city: "Eugene, OR", lat: 44.0338, lng: -123.0910, access: "public" },
    { name: "Peterson Barn Community Center", city: "Eugene, OR", lat: 44.0570, lng: -123.0830, access: "public" },
    { name: "Willamalane Park Swim Center", city: "Springfield, OR", lat: 44.0517, lng: -122.9624, access: "public" },
    // Bend
    { name: "Bend Senior Center Gym", city: "Bend, OR", lat: 44.0597, lng: -121.3132, access: "public" },
    { name: "Juniper Swim & Fitness Center", city: "Bend, OR", lat: 44.0495, lng: -121.3063, access: "public" },
    // Medford
    { name: "Rogue Valley YMCA", city: "Medford, OR", lat: 42.3290, lng: -122.8700, access: "members" },
    { name: "Medford Parks & Recreation Center", city: "Medford, OR", lat: 42.3234, lng: -122.8758, access: "public" },
    // Other
    { name: "Corvallis Community Center", city: "Corvallis, OR", lat: 44.5625, lng: -123.2599, access: "public" },
    { name: "Gladstone Community Center", city: "Gladstone, OR", lat: 45.3848, lng: -122.5932, access: "public" },
    { name: "Sherwood Community Center", city: "Sherwood, OR", lat: 45.3577, lng: -122.8434, access: "public" },
];

const OR_YMCAS = [
    { name: "Downtown Portland YMCA", city: "Portland, OR", lat: 45.5233, lng: -122.6778, access: "members" },
    { name: "YMCA Southwest Portland", city: "Portland, OR", lat: 45.4766, lng: -122.7150, access: "members" },
    { name: "YMCA of Columbia-Willamette Clark County", city: "Vancouver, WA", lat: 45.6365, lng: -122.5781, access: "members" },
    { name: "Sherwood Regional Family YMCA", city: "Sherwood, OR", lat: 45.3521, lng: -122.8390, access: "members" },
    { name: "YMCA Salem", city: "Salem, OR", lat: 44.9440, lng: -123.0388, access: "members" },
    { name: "Eugene Family YMCA", city: "Eugene, OR", lat: 44.0491, lng: -123.0907, access: "members" },
    { name: "Klamath Basin Family YMCA", city: "Klamath Falls, OR", lat: 42.2090, lng: -121.7603, access: "members" },
    { name: "Pendleton Family YMCA", city: "Pendleton, OR", lat: 45.6716, lng: -118.7896, access: "members" },
];

const OR_GYMS = [
    { name: "24 Hour Fitness Beaverton", city: "Beaverton, OR", lat: 45.4864, lng: -122.8066, access: "members" },
    { name: "24 Hour Fitness Clackamas", city: "Clackamas, OR", lat: 45.4348, lng: -122.5676, access: "members" },
    { name: "24 Hour Fitness Lloyd District", city: "Portland, OR", lat: 45.5317, lng: -122.6576, access: "members" },
    { name: "24 Hour Fitness Tigard", city: "Tigard, OR", lat: 45.4183, lng: -122.7634, access: "members" },
    { name: "LA Fitness Beaverton", city: "Beaverton, OR", lat: 45.4728, lng: -122.7892, access: "members" },
    { name: "LA Fitness Clackamas", city: "Clackamas, OR", lat: 45.4456, lng: -122.5824, access: "members" },
    { name: "Life Time Portland", city: "Beaverton, OR", lat: 45.4949, lng: -122.7890, access: "members" },
    { name: "Multnomah Athletic Club", city: "Portland, OR", lat: 45.5087, lng: -122.6891, access: "members" },
    { name: "Downtown Athletic Club Eugene", city: "Eugene, OR", lat: 44.0521, lng: -123.0868, access: "members" },
    { name: "Lake Oswego Indoor Tennis & Athletic Club", city: "Lake Oswego, OR", lat: 45.4206, lng: -122.6706, access: "members" },
    // Private Schools
    { name: "Central Catholic High School Gym", city: "Portland, OR", lat: 45.5291, lng: -122.6349, access: "members" },
    { name: "De La Salle North Catholic High School Gym", city: "Portland, OR", lat: 45.5739, lng: -122.6823, access: "members" },
    { name: "Jesuit High School Gym", city: "Beaverton, OR", lat: 45.5234, lng: -122.8115, access: "members" },
    { name: "La Salle Catholic College Prep Gym", city: "Milwaukie, OR", lat: 45.4448, lng: -122.6361, access: "members" },
    { name: "Catlin Gabel School Gym", city: "Portland, OR", lat: 45.4904, lng: -122.7479, access: "members" },
    { name: "Oregon Episcopal School Gym", city: "Portland, OR", lat: 45.4880, lng: -122.7503, access: "members" },
    { name: "Portland Adventist Academy Gym", city: "Portland, OR", lat: 45.4856, lng: -122.5558, access: "members" },
    { name: "Valley Catholic High School Gym", city: "Beaverton, OR", lat: 45.4506, lng: -122.8289, access: "members" },
    { name: "Regis High School Gym", city: "Stayton, OR", lat: 44.7995, lng: -122.7963, access: "members" },
    { name: "Salem Academy Gym", city: "Salem, OR", lat: 44.9376, lng: -123.0185, access: "members" },
    { name: "Corban University C.E. Jeffers Sports Center", city: "Salem, OR", lat: 44.9085, lng: -122.9861, access: "members" },
];

// Fix: Bethany YMCA had wrong coordinates (Oklahoma instead of Oregon)
const FIXES = [
    { name: "Bethany Family YMCA", city: "Bethany, OR", lat: 45.5577, lng: -122.8371, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  OR AUDIT P4: COLLEGES, REC CENTERS, YMCAs       ║');
    console.log('╚══════════════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['OR Colleges & Universities', OR_COLLEGES],
        ['OR Recreation Centers', OR_REC_CENTERS],
        ['OR YMCAs', OR_YMCAS],
        ['OR Gyms & Private Schools', OR_GYMS],
        ['Data Fixes', FIXES],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`OR P4 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

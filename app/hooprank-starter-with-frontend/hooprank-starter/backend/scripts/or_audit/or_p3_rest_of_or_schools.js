/**
 * OR Audit Part 3: Rest of Oregon Schools
 * Salem, Eugene, Bend, Medford, Corvallis, Albany, Springfield, Roseburg, Grants Pass, etc.
 */
const { runImport } = require('../wa_audit/boilerplate');

const SALEM_SCHOOLS = [
    { name: "North Salem High School Gym", city: "Salem, OR", lat: 44.9611, lng: -123.0425, access: "members" },
    { name: "South Salem High School Gym", city: "Salem, OR", lat: 44.9079, lng: -123.0155, access: "members" },
    { name: "Sprague High School Gym", city: "Salem, OR", lat: 44.9233, lng: -123.0659, access: "members" },
    { name: "McKay High School Gym", city: "Salem, OR", lat: 44.9613, lng: -123.0120, access: "members" },
    { name: "West Salem High School Gym", city: "Salem, OR", lat: 44.9437, lng: -123.0796, access: "members" },
    { name: "Blanchet Catholic School Gym", city: "Salem, OR", lat: 44.9541, lng: -123.0249, access: "members" },
    { name: "Whiteaker Middle School Gym", city: "Salem, OR", lat: 44.9393, lng: -123.0429, access: "members" },
    { name: "Waldo Middle School Gym", city: "Salem, OR", lat: 44.9289, lng: -123.0147, access: "members" },
    { name: "Judson Middle School Gym", city: "Salem, OR", lat: 44.9098, lng: -123.0510, access: "members" },
    { name: "Claggett Creek Middle School Gym", city: "Salem, OR", lat: 44.9750, lng: -123.0055, access: "members" },
    { name: "Leslie Middle School Gym", city: "Salem, OR", lat: 44.9306, lng: -123.0613, access: "members" },
    { name: "Crossler Middle School Gym", city: "Salem, OR", lat: 44.9019, lng: -123.0747, access: "members" },
    // Elementary
    { name: "Bush Elementary Gym", city: "Salem, OR", lat: 44.9312, lng: -123.0336, access: "members" },
    { name: "Grant Elementary Gym (Salem)", city: "Salem, OR", lat: 44.9431, lng: -123.0353, access: "members" },
    { name: "Hallman Elementary Gym", city: "Salem, OR", lat: 44.9628, lng: -123.0180, access: "members" },
    { name: "Highland Elementary Gym (Salem)", city: "Salem, OR", lat: 44.9501, lng: -123.0122, access: "members" },
    { name: "Lee Elementary Gym (Salem)", city: "Salem, OR", lat: 44.9195, lng: -123.0291, access: "members" },
    { name: "Richmond Elementary Gym (Salem)", city: "Salem, OR", lat: 44.9405, lng: -123.0595, access: "members" },
    { name: "Chavez Elementary Gym", city: "Salem, OR", lat: 44.9557, lng: -123.0011, access: "members" },
    { name: "Morningside Elementary Gym", city: "Salem, OR", lat: 44.9088, lng: -123.0025, access: "members" },
];

const EUGENE_SCHOOLS = [
    { name: "Sheldon High School Gym", city: "Eugene, OR", lat: 44.0876, lng: -123.0325, access: "members" },
    { name: "South Eugene High School Gym", city: "Eugene, OR", lat: 44.0290, lng: -123.1006, access: "members" },
    { name: "North Eugene High School Gym", city: "Eugene, OR", lat: 44.0820, lng: -123.1124, access: "members" },
    { name: "Churchill High School Gym", city: "Eugene, OR", lat: 44.0233, lng: -123.0542, access: "members" },
    { name: "Marist Catholic High School Gym", city: "Eugene, OR", lat: 44.0349, lng: -123.0497, access: "members" },
    { name: "Springfield High School Gym", city: "Springfield, OR", lat: 44.0485, lng: -122.9756, access: "members" },
    { name: "Thurston High School Gym", city: "Springfield, OR", lat: 44.0450, lng: -122.9179, access: "members" },
    { name: "Monroe Middle School Gym", city: "Eugene, OR", lat: 44.0553, lng: -123.0921, access: "members" },
    { name: "Spencer Butte Middle School Gym", city: "Eugene, OR", lat: 44.0174, lng: -123.0717, access: "members" },
    { name: "Cal Young Middle School Gym", city: "Eugene, OR", lat: 44.0783, lng: -123.0750, access: "members" },
    { name: "Kennedy Middle School Gym", city: "Eugene, OR", lat: 44.0538, lng: -123.0435, access: "members" },
    { name: "Arts & Technology Academy Gym", city: "Eugene, OR", lat: 44.0494, lng: -123.0867, access: "members" },
    { name: "Hamlin Middle School Gym", city: "Springfield, OR", lat: 44.0566, lng: -122.9612, access: "members" },
    { name: "Briggs Middle School Gym", city: "Springfield, OR", lat: 44.0399, lng: -122.9458, access: "members" },
    // Elementary
    { name: "Camas Ridge Community School Gym", city: "Eugene, OR", lat: 44.0325, lng: -123.0980, access: "members" },
    { name: "Edgewood Community Elementary Gym", city: "Eugene, OR", lat: 44.0556, lng: -123.1122, access: "members" },
    { name: "River Road Elementary Gym", city: "Eugene, OR", lat: 44.0847, lng: -123.1256, access: "members" },
    { name: "Spring Creek Elementary Gym", city: "Eugene, OR", lat: 44.0711, lng: -123.0419, access: "members" },
    { name: "Yolanda Elementary Gym", city: "Springfield, OR", lat: 44.0642, lng: -122.9488, access: "members" },
    { name: "Page Elementary Gym", city: "Springfield, OR", lat: 44.0373, lng: -122.9620, access: "members" },
];

const BEND_SCHOOLS = [
    { name: "Summit High School Gym", city: "Bend, OR", lat: 44.0178, lng: -121.3390, access: "members" },
    { name: "Bend High School Gym", city: "Bend, OR", lat: 44.0549, lng: -121.3121, access: "members" },
    { name: "Mountain View High School Gym", city: "Bend, OR", lat: 44.0850, lng: -121.2802, access: "members" },
    { name: "Caldera High School Gym", city: "Bend, OR", lat: 44.0310, lng: -121.2730, access: "members" },
    { name: "Pilot Butte Middle School Gym", city: "Bend, OR", lat: 44.0635, lng: -121.2856, access: "members" },
    { name: "Cascade Middle School Gym", city: "Bend, OR", lat: 44.0457, lng: -121.3147, access: "members" },
    { name: "Pacific Crest Middle School Gym", city: "Bend, OR", lat: 44.0138, lng: -121.3180, access: "members" },
    { name: "High Desert Middle School Gym", city: "Bend, OR", lat: 44.0898, lng: -121.2710, access: "members" },
    { name: "La Pine High School Gym", city: "La Pine, OR", lat: 43.6771, lng: -121.5039, access: "members" },
    { name: "Redmond High School Gym", city: "Redmond, OR", lat: 44.2707, lng: -121.1781, access: "members" },
    { name: "Ridgeview High School Gym", city: "Redmond, OR", lat: 44.2536, lng: -121.1593, access: "members" },
];

const MEDFORD_SCHOOLS = [
    { name: "North Medford High School Gym", city: "Medford, OR", lat: 42.3469, lng: -122.8712, access: "members" },
    { name: "South Medford High School Gym", city: "Medford, OR", lat: 42.3065, lng: -122.8724, access: "members" },
    { name: "Crater High School Gym", city: "Central Point, OR", lat: 42.3786, lng: -122.8943, access: "members" },
    { name: "Hedrick Middle School Gym", city: "Medford, OR", lat: 42.3371, lng: -122.8826, access: "members" },
    { name: "McLoughlin Middle School Gym", city: "Medford, OR", lat: 42.3258, lng: -122.8583, access: "members" },
    { name: "Ashland High School Gym", city: "Ashland, OR", lat: 42.1926, lng: -122.7117, access: "members" },
    { name: "Grants Pass High School Gym", city: "Grants Pass, OR", lat: 42.4354, lng: -123.3252, access: "members" },
    { name: "North Valley High School Gym", city: "Grants Pass, OR", lat: 42.4651, lng: -123.3092, access: "members" },
    { name: "Roseburg High School Gym", city: "Roseburg, OR", lat: 43.2260, lng: -123.3466, access: "members" },
    { name: "Klamath Union High School Gym", city: "Klamath Falls, OR", lat: 42.2061, lng: -121.7683, access: "members" },
];

const OTHER_OR_SCHOOLS = [
    // Corvallis
    { name: "Corvallis High School Gym", city: "Corvallis, OR", lat: 44.5558, lng: -123.2657, access: "members" },
    { name: "Crescent Valley High School Gym", city: "Corvallis, OR", lat: 44.5891, lng: -123.2576, access: "members" },
    { name: "Cheldelin Middle School Gym", city: "Corvallis, OR", lat: 44.5621, lng: -123.2433, access: "members" },
    { name: "Linus Pauling Middle School Gym", city: "Corvallis, OR", lat: 44.5835, lng: -123.2729, access: "members" },
    // Albany
    { name: "South Albany High School Gym", city: "Albany, OR", lat: 44.6190, lng: -123.0838, access: "members" },
    { name: "West Albany High School Gym", city: "Albany, OR", lat: 44.6383, lng: -123.1156, access: "members" },
    { name: "Memorial Middle School Gym", city: "Albany, OR", lat: 44.6353, lng: -123.0978, access: "members" },
    { name: "Timber Ridge Middle School Gym", city: "Albany, OR", lat: 44.6120, lng: -123.1063, access: "members" },
    // McMinnville/Yamhill
    { name: "McMinnville High School Gym", city: "McMinnville, OR", lat: 45.2106, lng: -123.1987, access: "members" },
    { name: "Duniway Middle School Gym (McMinnville)", city: "McMinnville, OR", lat: 45.2110, lng: -123.1918, access: "members" },
    // Hermiston/Pendleton
    { name: "Hermiston High School Gym", city: "Hermiston, OR", lat: 45.8402, lng: -119.2845, access: "members" },
    { name: "Pendleton High School Gym", city: "Pendleton, OR", lat: 45.6728, lng: -118.7886, access: "members" },
    // The Dalles
    { name: "The Dalles High School Gym", city: "The Dalles, OR", lat: 45.6009, lng: -121.1844, access: "members" },
    // Canby/Molalla/Silverton
    { name: "Canby High School Gym", city: "Canby, OR", lat: 45.2601, lng: -122.6913, access: "members" },
    { name: "Silverton High School Gym", city: "Silverton, OR", lat: 44.9976, lng: -122.7794, access: "members" },
    { name: "Molalla High School Gym", city: "Molalla, OR", lat: 45.1498, lng: -122.5762, access: "members" },
    // Woodburn/Newberg
    { name: "Woodburn High School Gym", city: "Woodburn, OR", lat: 45.1465, lng: -122.8537, access: "members" },
    { name: "Newberg High School Gym", city: "Newberg, OR", lat: 45.3038, lng: -122.9670, access: "members" },
    // Forest Grove/Sherwood
    { name: "Forest Grove High School Gym", city: "Forest Grove, OR", lat: 45.5232, lng: -123.1125, access: "members" },
    { name: "Sherwood High School Gym", city: "Sherwood, OR", lat: 45.3554, lng: -122.8389, access: "members" },
    // Coos Bay/North Bend
    { name: "Marshfield High School Gym", city: "Coos Bay, OR", lat: 43.3629, lng: -124.2124, access: "members" },
    { name: "North Bend High School Gym", city: "North Bend, OR", lat: 43.4106, lng: -124.2267, access: "members" },
    // Hood River
    { name: "Hood River Valley High School Gym", city: "Hood River, OR", lat: 45.7067, lng: -121.5285, access: "members" },
    // Ontario
    { name: "Ontario High School Gym", city: "Ontario, OR", lat: 44.0226, lng: -116.9613, access: "members" },
    // Lebanon/Sweet Home
    { name: "Lebanon High School Gym", city: "Lebanon, OR", lat: 44.5272, lng: -122.8997, access: "members" },
    { name: "Sweet Home High School Gym", city: "Sweet Home, OR", lat: 44.3959, lng: -122.7322, access: "members" },
    // Newport/Lincoln City
    { name: "Newport High School Gym", city: "Newport, OR", lat: 44.6292, lng: -124.0492, access: "members" },
    // Cottage Grove
    { name: "Cottage Grove High School Gym", city: "Cottage Grove, OR", lat: 43.7926, lng: -123.0580, access: "members" },
];

async function main() {
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║  OR AUDIT P3: REST OF OREGON SCHOOLS       ║');
    console.log('╚═══════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['Salem Schools', SALEM_SCHOOLS],
        ['Eugene/Springfield Schools', EUGENE_SCHOOLS],
        ['Bend/Central Oregon Schools', BEND_SCHOOLS],
        ['Medford/Southern Oregon Schools', MEDFORD_SCHOOLS],
        ['Other Oregon Schools', OTHER_OR_SCHOOLS],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`OR P3 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

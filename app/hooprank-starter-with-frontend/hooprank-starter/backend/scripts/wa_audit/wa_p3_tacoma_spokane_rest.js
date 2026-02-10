/**
 * WA Audit Part 3: Tacoma, Spokane, Everett, and Rest of WA Schools
 */
const { runImport } = require('./boilerplate');

const TACOMA_SCHOOLS = [
    // High Schools
    { name: "Stadium High School Gym", city: "Tacoma, WA", lat: 47.2720, lng: -122.4583, access: "members" },
    { name: "Lincoln High School Gym (Tacoma)", city: "Tacoma, WA", lat: 47.2578, lng: -122.4766, access: "members" },
    { name: "Wilson High School Gym (Tacoma)", city: "Tacoma, WA", lat: 47.2202, lng: -122.4797, access: "members" },
    { name: "Mount Tahoma High School Gym", city: "Tacoma, WA", lat: 47.2173, lng: -122.4427, access: "members" },
    { name: "Foss High School Gym", city: "Tacoma, WA", lat: 47.2439, lng: -122.4193, access: "members" },
    { name: "Bellarmine Preparatory School Gym", city: "Tacoma, WA", lat: 47.2378, lng: -122.4620, access: "members" },
    // Middle Schools
    { name: "Jason Lee Middle School Gym", city: "Tacoma, WA", lat: 47.2643, lng: -122.4946, access: "members" },
    { name: "Mason Middle School Gym", city: "Tacoma, WA", lat: 47.2388, lng: -122.4910, access: "members" },
    { name: "Truman Middle School Gym", city: "Tacoma, WA", lat: 47.2175, lng: -122.4661, access: "members" },
    { name: "Stewart Middle School Gym", city: "Tacoma, WA", lat: 47.2478, lng: -122.4370, access: "members" },
    { name: "Giaudrone Middle School Gym", city: "Tacoma, WA", lat: 47.2310, lng: -122.4103, access: "members" },
    { name: "Baker Middle School Gym", city: "Tacoma, WA", lat: 47.2716, lng: -122.4407, access: "members" },
    { name: "Gray Middle School Gym", city: "Tacoma, WA", lat: 47.2581, lng: -122.4238, access: "members" },
    // Elementary
    { name: "McCarver Elementary Gym", city: "Tacoma, WA", lat: 47.2602, lng: -122.4437, access: "members" },
    { name: "Lister Elementary Gym", city: "Tacoma, WA", lat: 47.2439, lng: -122.4337, access: "members" },
    { name: "Roosevelt Elementary Gym (Tacoma)", city: "Tacoma, WA", lat: 47.2699, lng: -122.4725, access: "members" },
    { name: "Stanley Elementary Gym", city: "Tacoma, WA", lat: 47.2537, lng: -122.4529, access: "members" },
    { name: "Whitman Elementary Gym (Tacoma)", city: "Tacoma, WA", lat: 47.2372, lng: -122.4768, access: "members" },
    { name: "McKinley Elementary Gym (Tacoma)", city: "Tacoma, WA", lat: 47.2498, lng: -122.4503, access: "members" },
    { name: "Sheridan Elementary Gym", city: "Tacoma, WA", lat: 47.2318, lng: -122.4495, access: "members" },
    { name: "Birney Elementary Gym", city: "Tacoma, WA", lat: 47.2283, lng: -122.4259, access: "members" },
];

const PUYALLUP_SCHOOLS = [
    { name: "Puyallup High School Gym", city: "Puyallup, WA", lat: 47.1916, lng: -122.2915, access: "members" },
    { name: "Rogers High School Gym (Puyallup)", city: "Puyallup, WA", lat: 47.1743, lng: -122.3103, access: "members" },
    { name: "Emerald Ridge High School Gym", city: "Puyallup, WA", lat: 47.1464, lng: -122.2801, access: "members" },
    { name: "Aylen Junior High Gym", city: "Puyallup, WA", lat: 47.1925, lng: -122.2617, access: "members" },
    { name: "Edgemont Junior High Gym", city: "Puyallup, WA", lat: 47.1770, lng: -122.3270, access: "members" },
    { name: "Kalles Junior High Gym", city: "Puyallup, WA", lat: 47.1591, lng: -122.2978, access: "members" },
    { name: "Stahl Junior High Gym", city: "Puyallup, WA", lat: 47.1432, lng: -122.2516, access: "members" },
    { name: "Ballou Junior High Gym", city: "Puyallup, WA", lat: 47.2004, lng: -122.3115, access: "members" },
];

const LAKEWOOD_PIERCE = [
    { name: "Clover Park High School Gym", city: "Lakewood, WA", lat: 47.1561, lng: -122.5111, access: "members" },
    { name: "Lakes High School Gym", city: "Lakewood, WA", lat: 47.1744, lng: -122.5353, access: "members" },
    { name: "Harrison Preparatory School Gym", city: "Lakewood, WA", lat: 47.1616, lng: -122.5000, access: "members" },
    { name: "Lochburn Middle School Gym", city: "Lakewood, WA", lat: 47.1707, lng: -122.5203, access: "members" },
    { name: "Hudtloff Middle School Gym", city: "Lakewood, WA", lat: 47.1528, lng: -122.5286, access: "members" },
];

const SPOKANE_SCHOOLS = [
    // High Schools
    { name: "Lewis and Clark High School Gym", city: "Spokane, WA", lat: 47.6410, lng: -117.4073, access: "members" },
    { name: "Rogers High School Gym (Spokane)", city: "Spokane, WA", lat: 47.6806, lng: -117.3728, access: "members" },
    { name: "Ferris High School Gym", city: "Spokane, WA", lat: 47.6156, lng: -117.3659, access: "members" },
    { name: "Shadle Park High School Gym", city: "Spokane, WA", lat: 47.6959, lng: -117.4493, access: "members" },
    { name: "North Central High School Gym", city: "Spokane, WA", lat: 47.6806, lng: -117.4285, access: "members" },
    { name: "Mead High School Gym", city: "Mead, WA", lat: 47.7524, lng: -117.3563, access: "members" },
    { name: "Mt. Spokane High School Gym", city: "Mead, WA", lat: 47.7588, lng: -117.3099, access: "members" },
    { name: "University High School Gym", city: "Spokane Valley, WA", lat: 47.6633, lng: -117.2839, access: "members" },
    { name: "Central Valley High School Gym", city: "Spokane Valley, WA", lat: 47.6368, lng: -117.2535, access: "members" },
    // Middle Schools
    { name: "Chase Middle School Gym", city: "Spokane, WA", lat: 47.6722, lng: -117.4195, access: "members" },
    { name: "Glover Middle School Gym", city: "Spokane, WA", lat: 47.6563, lng: -117.4465, access: "members" },
    { name: "Sacajawea Middle School Gym (Spokane)", city: "Spokane, WA", lat: 47.6446, lng: -117.3783, access: "members" },
    { name: "Shaw Middle School Gym", city: "Spokane, WA", lat: 47.6295, lng: -117.4111, access: "members" },
    { name: "Garry Middle School Gym", city: "Spokane, WA", lat: 47.6531, lng: -117.3693, access: "members" },
    { name: "Salk Middle School Gym", city: "Spokane, WA", lat: 47.6124, lng: -117.3425, access: "members" },
    // Elementary
    { name: "Garfield Elementary Gym (Spokane)", city: "Spokane, WA", lat: 47.6580, lng: -117.3928, access: "members" },
    { name: "Longfellow Elementary Gym", city: "Spokane, WA", lat: 47.6643, lng: -117.4333, access: "members" },
    { name: "Adams Elementary Gym (Spokane)", city: "Spokane, WA", lat: 47.6410, lng: -117.4265, access: "members" },
    { name: "Sheridan Elementary Gym (Spokane)", city: "Spokane, WA", lat: 47.6728, lng: -117.3614, access: "members" },
    { name: "Regal Elementary Gym", city: "Spokane, WA", lat: 47.6192, lng: -117.3371, access: "members" },
    { name: "Hutton Elementary Gym", city: "Spokane, WA", lat: 47.6403, lng: -117.4504, access: "members" },
];

const EVERETT_SCHOOLS = [
    { name: "Everett High School Gym", city: "Everett, WA", lat: 47.9770, lng: -122.2043, access: "members" },
    { name: "Cascade High School Gym", city: "Everett, WA", lat: 47.9337, lng: -122.2393, access: "members" },
    { name: "Jackson High School Gym", city: "Mill Creek, WA", lat: 47.8667, lng: -122.1886, access: "members" },
    { name: "Mariner High School Gym", city: "Everett, WA", lat: 47.9012, lng: -122.2515, access: "members" },
    { name: "Everett Middle School Gym", city: "Everett, WA", lat: 47.9669, lng: -122.2150, access: "members" },
    { name: "Gateway Middle School Gym", city: "Everett, WA", lat: 47.9414, lng: -122.2120, access: "members" },
    { name: "Heatherwood Middle School Gym", city: "Mill Creek, WA", lat: 47.8537, lng: -122.2195, access: "members" },
    { name: "North Middle School Gym (Everett)", city: "Everett, WA", lat: 47.9855, lng: -122.2209, access: "members" },
];

const OTHER_WA_SCHOOLS = [
    // Bellingham
    { name: "Bellingham High School Gym", city: "Bellingham, WA", lat: 48.7492, lng: -122.4743, access: "members" },
    { name: "Sehome High School Gym", city: "Bellingham, WA", lat: 48.7438, lng: -122.4457, access: "members" },
    { name: "Squalicum High School Gym", city: "Bellingham, WA", lat: 48.7851, lng: -122.4538, access: "members" },
    // Olympia
    { name: "Olympia High School Gym", city: "Olympia, WA", lat: 47.0264, lng: -122.8607, access: "members" },
    { name: "Capital High School Gym", city: "Olympia, WA", lat: 46.9977, lng: -122.9140, access: "members" },
    { name: "Timberline High School Gym", city: "Lacey, WA", lat: 46.9883, lng: -122.7906, access: "members" },
    { name: "North Thurston High School Gym", city: "Lacey, WA", lat: 47.0395, lng: -122.8005, access: "members" },
    // Vancouver/Clark County
    { name: "Fort Vancouver High School Gym", city: "Vancouver, WA", lat: 45.6293, lng: -122.6617, access: "members" },
    { name: "Hudson's Bay High School Gym", city: "Vancouver, WA", lat: 45.6507, lng: -122.6494, access: "members" },
    { name: "Mountain View High School Gym", city: "Vancouver, WA", lat: 45.6624, lng: -122.5785, access: "members" },
    { name: "Evergreen High School Gym (Vancouver)", city: "Vancouver, WA", lat: 45.6365, lng: -122.5781, access: "members" },
    { name: "Heritage High School Gym", city: "Vancouver, WA", lat: 45.6067, lng: -122.5523, access: "members" },
    { name: "Union High School Gym (Camas)", city: "Camas, WA", lat: 45.5917, lng: -122.4205, access: "members" },
    { name: "Camas High School Gym", city: "Camas, WA", lat: 45.5831, lng: -122.3971, access: "members" },
    { name: "Battle Ground High School Gym", city: "Battle Ground, WA", lat: 45.7710, lng: -122.5338, access: "members" },
    // Tri-Cities
    { name: "Richland High School Gym", city: "Richland, WA", lat: 46.2832, lng: -119.2786, access: "members" },
    { name: "Hanford High School Gym", city: "Richland, WA", lat: 46.2658, lng: -119.3117, access: "members" },
    { name: "Pasco High School Gym", city: "Pasco, WA", lat: 46.2383, lng: -119.0998, access: "members" },
    { name: "Chiawana High School Gym", city: "Pasco, WA", lat: 46.2526, lng: -119.1677, access: "members" },
    { name: "Kennewick High School Gym", city: "Kennewick, WA", lat: 46.2115, lng: -119.1553, access: "members" },
    { name: "Kamiakin High School Gym", city: "Kennewick, WA", lat: 46.1829, lng: -119.2072, access: "members" },
    { name: "Southridge High School Gym", city: "Kennewick, WA", lat: 46.1730, lng: -119.2487, access: "members" },
    // Yakima
    { name: "Eisenhower High School Gym", city: "Yakima, WA", lat: 46.5663, lng: -120.5316, access: "members" },
    { name: "Davis High School Gym", city: "Yakima, WA", lat: 46.6049, lng: -120.5168, access: "members" },
    { name: "West Valley High School Gym", city: "Yakima, WA", lat: 46.5988, lng: -120.5888, access: "members" },
    // Wenatchee
    { name: "Wenatchee High School Gym", city: "Wenatchee, WA", lat: 47.4181, lng: -120.3260, access: "members" },
    { name: "Eastmont High School Gym", city: "East Wenatchee, WA", lat: 47.4132, lng: -120.2823, access: "members" },
    // Marysville
    { name: "Marysville-Pilchuck High School Gym", city: "Marysville, WA", lat: 48.0504, lng: -122.1670, access: "members" },
    { name: "Marysville-Getchell High School Gym", city: "Marysville, WA", lat: 48.0616, lng: -122.1855, access: "members" },
    // Northshore SD
    { name: "Bothell High School Gym", city: "Bothell, WA", lat: 47.7704, lng: -122.2050, access: "members" },
    { name: "Inglemoor High School Gym", city: "Kenmore, WA", lat: 47.7533, lng: -122.2414, access: "members" },
    { name: "Woodinville High School Gym", city: "Woodinville, WA", lat: 47.7530, lng: -122.1651, access: "members" },
    // Shoreline SD
    { name: "Shorewood High School Gym", city: "Shoreline, WA", lat: 47.7559, lng: -122.3488, access: "members" },
    { name: "Shorecrest High School Gym", city: "Shoreline, WA", lat: 47.7662, lng: -122.3161, access: "members" },
    // Edmonds SD
    { name: "Edmonds-Woodway High School Gym", city: "Edmonds, WA", lat: 47.7939, lng: -122.3614, access: "members" },
    { name: "Lynnwood High School Gym", city: "Lynnwood, WA", lat: 47.8390, lng: -122.3059, access: "members" },
    { name: "Mountlake Terrace High School Gym", city: "Mountlake Terrace, WA", lat: 47.7937, lng: -122.3044, access: "members" },
    { name: "Meadowdale High School Gym", city: "Lynnwood, WA", lat: 47.8505, lng: -122.3354, access: "members" },
    // Mukilteo SD
    { name: "Kamiak High School Gym", city: "Mukilteo, WA", lat: 47.8900, lng: -122.2799, access: "members" },
    { name: "ACES High School Gym", city: "Mukilteo, WA", lat: 47.9044, lng: -122.2870, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  WA AUDIT P3: TACOMA, SPOKANE, REST OF WA       ║');
    console.log('╚══════════════════════════════════════════════════╝');

    let totalOk = 0, totalFail = 0;
    const regions = [
        ['Tacoma SD', TACOMA_SCHOOLS],
        ['Puyallup SD', PUYALLUP_SCHOOLS],
        ['Lakewood/Pierce', LAKEWOOD_PIERCE],
        ['Spokane Area', SPOKANE_SCHOOLS],
        ['Everett/Snohomish', EVERETT_SCHOOLS],
        ['Rest of WA', OTHER_WA_SCHOOLS],
    ];

    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`WA P3 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}

main();

/**
 * CA Audit Supplement: All SFUSD Elementary Schools + North Bay Complete
 * Philosophy: every school has an indoor gym unless known not to
 */
const { runImport } = require('../wa_audit/boilerplate');

// ─── SFUSD ELEMENTARY SCHOOLS (all assumed to have indoor gyms) ───
const SFUSD_ELEMENTARY = [
    // Already have: HS (Balboa, Burton, Galileo, Lincoln, Lowell, Mission, Washington, Wallenberg, Marshall, O'Connell)
    // Already have: MS (Presidio, Aptos, Giannini, Hoover, Everett, Marina, Denman, MLK, Roosevelt, Visitacion Valley)
    // Missing: All elementary schools
    { name: "Alamo Elementary Gym", city: "San Francisco, CA", lat: 37.7706, lng: -122.4384, access: "members" },
    { name: "Alvarado Elementary Gym", city: "San Francisco, CA", lat: 37.7461, lng: -122.4215, access: "members" },
    { name: "Argonne Elementary Gym", city: "San Francisco, CA", lat: 37.7814, lng: -122.4731, access: "members" },
    { name: "Bryant Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7584, lng: -122.4082, access: "members" },
    { name: "Buena Vista/Horace Mann Gym", city: "San Francisco, CA", lat: 37.7686, lng: -122.4259, access: "members" },
    { name: "Cesar Chavez Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7614, lng: -122.4140, access: "members" },
    { name: "Chinese Immersion at DeAvila Gym", city: "San Francisco, CA", lat: 37.7812, lng: -122.4429, access: "members" },
    { name: "Clarendon Elementary Gym", city: "San Francisco, CA", lat: 37.7571, lng: -122.4575, access: "members" },
    { name: "Cleveland Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7399, lng: -122.4355, access: "members" },
    { name: "Commodore Sloat Elementary Gym", city: "San Francisco, CA", lat: 37.7300, lng: -122.4690, access: "members" },
    { name: "Daniel Webster Elementary Gym", city: "San Francisco, CA", lat: 37.7553, lng: -122.3987, access: "members" },
    { name: "Dianne Feinstein Elementary Gym", city: "San Francisco, CA", lat: 37.7445, lng: -122.4870, access: "members" },
    { name: "Dr. Charles Drew Elementary Gym", city: "San Francisco, CA", lat: 37.7324, lng: -122.3877, access: "members" },
    { name: "Dr. George Washington Carver Elementary Gym", city: "San Francisco, CA", lat: 37.7362, lng: -122.3926, access: "members" },
    { name: "Dr. Martin Luther King Jr. Elementary Gym", city: "San Francisco, CA", lat: 37.7529, lng: -122.3995, access: "members" },
    { name: "Dr. William Cobb Elementary Gym", city: "San Francisco, CA", lat: 37.7228, lng: -122.4506, access: "members" },
    { name: "El Dorado Elementary Gym", city: "San Francisco, CA", lat: 37.7148, lng: -122.4085, access: "members" },
    { name: "Fairmount Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7434, lng: -122.4193, access: "members" },
    { name: "Francis Scott Key Elementary Gym", city: "San Francisco, CA", lat: 37.7520, lng: -122.4982, access: "members" },
    { name: "Frank McCoppin Elementary Gym", city: "San Francisco, CA", lat: 37.7616, lng: -122.4677, access: "members" },
    { name: "George Moscone Elementary Gym", city: "San Francisco, CA", lat: 37.7416, lng: -122.4023, access: "members" },
    { name: "George Peabody Elementary Gym", city: "San Francisco, CA", lat: 37.7843, lng: -122.4268, access: "members" },
    { name: "Glen Park Elementary Gym", city: "San Francisco, CA", lat: 37.7350, lng: -122.4329, access: "members" },
    { name: "Golden Gate Elementary Gym", city: "San Francisco, CA", lat: 37.7849, lng: -122.4511, access: "members" },
    { name: "Gordon J. Lau Elementary Gym", city: "San Francisco, CA", lat: 37.7947, lng: -122.4060, access: "members" },
    { name: "Grattan Elementary Gym", city: "San Francisco, CA", lat: 37.7633, lng: -122.4498, access: "members" },
    { name: "Guadalupe Elementary Gym", city: "San Francisco, CA", lat: 37.7147, lng: -122.4207, access: "members" },
    { name: "Harvey Milk Elementary Gym", city: "San Francisco, CA", lat: 37.7607, lng: -122.4379, access: "members" },
    { name: "Hillcrest Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7404, lng: -122.3971, access: "members" },
    { name: "Jean Parker Elementary Gym", city: "San Francisco, CA", lat: 37.7985, lng: -122.4090, access: "members" },
    { name: "Jefferson Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7654, lng: -122.4178, access: "members" },
    { name: "John Yehall Chin Elementary Gym", city: "San Francisco, CA", lat: 37.7970, lng: -122.3994, access: "members" },
    { name: "Jose Ortega Elementary Gym", city: "San Francisco, CA", lat: 37.7321, lng: -122.4469, access: "members" },
    { name: "Junipero Serra Elementary Gym", city: "San Francisco, CA", lat: 37.7152, lng: -122.4487, access: "members" },
    { name: "Lakeshore Elementary Gym", city: "San Francisco, CA", lat: 37.7266, lng: -122.4825, access: "members" },
    { name: "Lawton Elementary Gym", city: "San Francisco, CA", lat: 37.7564, lng: -122.4745, access: "members" },
    { name: "Leonard R. Flynn Elementary Gym", city: "San Francisco, CA", lat: 37.7538, lng: -122.4130, access: "members" },
    { name: "Longfellow Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7385, lng: -122.4439, access: "members" },
    { name: "Malcolm X Elementary Gym", city: "San Francisco, CA", lat: 37.7330, lng: -122.3961, access: "members" },
    { name: "Marshall Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7820, lng: -122.4095, access: "members" },
    { name: "McKinley Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7604, lng: -122.4241, access: "members" },
    { name: "Miraloma Elementary Gym", city: "San Francisco, CA", lat: 37.7381, lng: -122.4496, access: "members" },
    { name: "Monroe Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7277, lng: -122.4373, access: "members" },
    { name: "Muir Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7470, lng: -122.4306, access: "members" },
    { name: "New Traditions Elementary Gym", city: "San Francisco, CA", lat: 37.7503, lng: -122.4080, access: "members" },
    { name: "Noriega Early Education Gym", city: "San Francisco, CA", lat: 37.7530, lng: -122.4843, access: "members" },
    { name: "Paul Revere Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7409, lng: -122.4582, access: "members" },
    { name: "Redding Elementary Gym", city: "San Francisco, CA", lat: 37.7880, lng: -122.4358, access: "members" },
    { name: "Robert Louis Stevenson Elementary Gym", city: "San Francisco, CA", lat: 37.7909, lng: -122.4141, access: "members" },
    { name: "Rooftop Elementary Gym", city: "San Francisco, CA", lat: 37.7452, lng: -122.4440, access: "members" },
    { name: "Rosa Parks Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7888, lng: -122.4269, access: "members" },
    { name: "Sanchez Elementary Gym", city: "San Francisco, CA", lat: 37.7510, lng: -122.4290, access: "members" },
    { name: "Sheridan Elementary Gym", city: "San Francisco, CA", lat: 37.7266, lng: -122.4125, access: "members" },
    { name: "Sherman Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7996, lng: -122.4460, access: "members" },
    { name: "Spring Valley Elementary Gym", city: "San Francisco, CA", lat: 37.7866, lng: -122.4204, access: "members" },
    { name: "Starr King Elementary Gym", city: "San Francisco, CA", lat: 37.7574, lng: -122.4024, access: "members" },
    { name: "Sunnyside Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7280, lng: -122.4458, access: "members" },
    { name: "Sunset Elementary Gym", city: "San Francisco, CA", lat: 37.7532, lng: -122.4954, access: "members" },
    { name: "Sutro Elementary Gym", city: "San Francisco, CA", lat: 37.7590, lng: -122.4917, access: "members" },
    { name: "Taylor Elementary Gym (SF)", city: "San Francisco, CA", lat: 37.7846, lng: -122.4135, access: "members" },
    { name: "Tenderloin Elementary Gym", city: "San Francisco, CA", lat: 37.7823, lng: -122.4160, access: "members" },
    { name: "Ulloa Elementary Gym", city: "San Francisco, CA", lat: 37.7291, lng: -122.4734, access: "members" },
    { name: "West Portal Elementary Gym", city: "San Francisco, CA", lat: 37.7383, lng: -122.4667, access: "members" },
    { name: "Yick Wo Elementary Gym", city: "San Francisco, CA", lat: 37.7968, lng: -122.4108, access: "members" },
];

// ─── MARIN COUNTY (all schools + rec + private) ───
const MARIN_SCHOOLS = [
    // High Schools
    { name: "Redwood High School Gym (Larkspur)", city: "Larkspur, CA", lat: 37.9424, lng: -122.5328, access: "members" },
    { name: "Tamalpais High School Gym", city: "Mill Valley, CA", lat: 37.8963, lng: -122.5210, access: "members" },
    { name: "Drake High School Gym", city: "San Anselmo, CA", lat: 37.9799, lng: -122.5602, access: "members" },
    { name: "San Rafael High School Gym", city: "San Rafael, CA", lat: 37.9703, lng: -122.5259, access: "members" },
    { name: "Terra Linda High School Gym", city: "San Rafael, CA", lat: 38.0031, lng: -122.5333, access: "members" },
    { name: "Novato High School Gym", city: "Novato, CA", lat: 38.0901, lng: -122.5683, access: "members" },
    { name: "San Marin High School Gym", city: "Novato, CA", lat: 38.0729, lng: -122.5878, access: "members" },
    { name: "Marin Catholic High School Gym", city: "Kentfield, CA", lat: 37.9526, lng: -122.5449, access: "members" },
    { name: "Branson School Gym", city: "Ross, CA", lat: 37.9637, lng: -122.5535, access: "members" },
    { name: "Marin Academy Gym", city: "San Rafael, CA", lat: 37.9664, lng: -122.5199, access: "members" },
    // Middle Schools
    { name: "Hall Middle School Gym", city: "Larkspur, CA", lat: 37.9407, lng: -122.5358, access: "members" },
    { name: "Mill Valley Middle School Gym", city: "Mill Valley, CA", lat: 37.9038, lng: -122.5383, access: "members" },
    { name: "White Hill Middle School Gym", city: "Fairfax, CA", lat: 37.9866, lng: -122.5860, access: "members" },
    { name: "Davidson Middle School Gym", city: "San Rafael, CA", lat: 37.9815, lng: -122.5134, access: "members" },
    { name: "San Jose Middle School Gym (Marin)", city: "Novato, CA", lat: 38.0929, lng: -122.5601, access: "members" },
    { name: "Sinaloa Middle School Gym", city: "Novato, CA", lat: 38.0725, lng: -122.5552, access: "members" },
    // Elementary
    { name: "Bacich Elementary Gym", city: "Kentfield, CA", lat: 37.9505, lng: -122.5506, access: "members" },
    { name: "Bel Aire Elementary Gym", city: "Tiburon, CA", lat: 37.8836, lng: -122.4767, access: "members" },
    { name: "Del Mar Elementary Gym", city: "Tiburon, CA", lat: 37.8912, lng: -122.4738, access: "members" },
    { name: "Edna Maguire Elementary Gym", city: "Mill Valley, CA", lat: 37.9048, lng: -122.5233, access: "members" },
    { name: "Tamalpais Valley Elementary Gym", city: "Mill Valley, CA", lat: 37.8813, lng: -122.5363, access: "members" },
    { name: "Strawberry Point Elementary Gym", city: "Mill Valley, CA", lat: 37.8907, lng: -122.5038, access: "members" },
    { name: "Park Elementary Gym (Mill Valley)", city: "Mill Valley, CA", lat: 37.9081, lng: -122.5368, access: "members" },
    { name: "Cascade Canyon School Gym", city: "Fairfax, CA", lat: 37.9858, lng: -122.5937, access: "members" },
    { name: "Manor Elementary Gym (Fairfax)", city: "Fairfax, CA", lat: 37.9929, lng: -122.5899, access: "members" },
    { name: "Brookside Elementary Gym (San Anselmo)", city: "San Anselmo, CA", lat: 37.9792, lng: -122.5670, access: "members" },
    { name: "Wade Thomas Elementary Gym", city: "San Anselmo, CA", lat: 37.9747, lng: -122.5617, access: "members" },
    { name: "Ross Valley Elementary Gym", city: "San Anselmo, CA", lat: 37.9844, lng: -122.5582, access: "members" },
    { name: "Sun Valley Elementary Gym (San Rafael)", city: "San Rafael, CA", lat: 37.9899, lng: -122.5286, access: "members" },
    { name: "Venetia Valley Elementary Gym", city: "San Rafael, CA", lat: 37.9802, lng: -122.5116, access: "members" },
    { name: "Mary Silveira Elementary Gym", city: "San Rafael, CA", lat: 38.0061, lng: -122.5385, access: "members" },
    { name: "Dixie Elementary Gym", city: "San Rafael, CA", lat: 37.9698, lng: -122.5073, access: "members" },
    { name: "Vallecito Elementary Gym", city: "San Rafael, CA", lat: 37.9610, lng: -122.4992, access: "members" },
    { name: "Loma Verde Elementary Gym", city: "Novato, CA", lat: 38.0810, lng: -122.5690, access: "members" },
    { name: "Lu Sutton Elementary Gym", city: "Novato, CA", lat: 38.0915, lng: -122.5680, access: "members" },
    { name: "Olive Elementary Gym (Novato)", city: "Novato, CA", lat: 38.0996, lng: -122.5777, access: "members" },
    { name: "Pleasant Valley Elementary Gym (Novato)", city: "Novato, CA", lat: 38.0855, lng: -122.5505, access: "members" },
    { name: "Rancho Elementary Gym", city: "Novato, CA", lat: 38.0759, lng: -122.5695, access: "members" },
    // Marin Rec/Gyms
    { name: "Marin YMCA", city: "San Rafael, CA", lat: 37.9731, lng: -122.5213, access: "members" },
    { name: "Marin Jewish Community Center", city: "San Rafael, CA", lat: 37.9660, lng: -122.5033, access: "members" },
    { name: "Mill Valley Recreation Center", city: "Mill Valley, CA", lat: 37.9046, lng: -122.5422, access: "public" },
    { name: "Marinwood Community Center", city: "San Rafael, CA", lat: 38.0259, lng: -122.5288, access: "public" },
    { name: "Novato Community Center", city: "Novato, CA", lat: 38.1076, lng: -122.5702, access: "public" },
    { name: "Albert J. Boro Community Center", city: "San Rafael, CA", lat: 37.9585, lng: -122.5029, access: "public" },
    { name: "College of Marin Gym", city: "Kentfield, CA", lat: 37.9507, lng: -122.5507, access: "members" },
    { name: "Dominican University Conlan Center", city: "San Rafael, CA", lat: 37.9785, lng: -122.5062, access: "members" },
];

// ─── SONOMA COUNTY ───
const SONOMA_SCHOOLS = [
    // High Schools (some already exist from P5)
    { name: "Piner High School Gym", city: "Santa Rosa, CA", lat: 38.4510, lng: -122.7517, access: "members" },
    { name: "Elsie Allen High School Gym", city: "Santa Rosa, CA", lat: 38.4113, lng: -122.7348, access: "members" },
    { name: "Analy High School Gym", city: "Sebastopol, CA", lat: 38.4024, lng: -122.8212, access: "members" },
    { name: "El Molino High School Gym", city: "Forestville, CA", lat: 38.4679, lng: -122.8856, access: "members" },
    { name: "Windsor High School Gym", city: "Windsor, CA", lat: 38.5409, lng: -122.8062, access: "members" },
    { name: "Sonoma Valley High School Gym", city: "Sonoma, CA", lat: 38.2914, lng: -122.4629, access: "members" },
    { name: "Casa Grande High School Gym", city: "Petaluma, CA", lat: 38.2405, lng: -122.6337, access: "members" },
    { name: "Rancho Cotate High School Gym", city: "Rohnert Park, CA", lat: 38.3543, lng: -122.7067, access: "members" },
    { name: "Healdsburg High School Gym", city: "Healdsburg, CA", lat: 38.6116, lng: -122.8648, access: "members" },
    { name: "Cloverdale High School Gym", city: "Cloverdale, CA", lat: 38.8045, lng: -123.0138, access: "members" },
    { name: "Technology High School Gym (Rohnert Park)", city: "Rohnert Park, CA", lat: 38.3412, lng: -122.7004, access: "members" },
    // Middle Schools
    { name: "Rincon Valley Middle School Gym", city: "Santa Rosa, CA", lat: 38.4291, lng: -122.6808, access: "members" },
    { name: "Santa Rosa Middle School Gym", city: "Santa Rosa, CA", lat: 38.4309, lng: -122.7134, access: "members" },
    { name: "Cook Middle School Gym", city: "Santa Rosa, CA", lat: 38.4543, lng: -122.7268, access: "members" },
    { name: "Comstock Middle School Gym", city: "Santa Rosa, CA", lat: 38.4172, lng: -122.7453, access: "members" },
    { name: "Petaluma Junior High School Gym", city: "Petaluma, CA", lat: 38.2321, lng: -122.6364, access: "members" },
    { name: "Kenilworth Junior High School Gym", city: "Petaluma, CA", lat: 38.2425, lng: -122.6519, access: "members" },
    // Rec/College
    { name: "Finley Community Center", city: "Santa Rosa, CA", lat: 38.4169, lng: -122.7364, access: "public" },
    { name: "Santa Rosa Junior College Gym", city: "Santa Rosa, CA", lat: 38.4432, lng: -122.7195, access: "members" },
    { name: "Sonoma State University Wolves Den", city: "Rohnert Park, CA", lat: 38.3387, lng: -122.6743, access: "members" },
    { name: "Petaluma Community Center", city: "Petaluma, CA", lat: 38.2328, lng: -122.6397, access: "public" },
];

// ─── NAPA COUNTY ───
const NAPA_SCHOOLS = [
    // (Napa High + Vintage High already exist from P5)
    { name: "American Canyon High School Gym", city: "American Canyon, CA", lat: 38.1800, lng: -122.2369, access: "members" },
    { name: "Justin-Siena High School Gym", city: "Napa, CA", lat: 38.2749, lng: -122.2837, access: "members" },
    { name: "New Technology High School Gym", city: "Napa, CA", lat: 38.3027, lng: -122.2933, access: "members" },
    { name: "Harvest Middle School Gym", city: "Napa, CA", lat: 38.3114, lng: -122.3000, access: "members" },
    { name: "Silverado Middle School Gym", city: "Napa, CA", lat: 38.2779, lng: -122.2674, access: "members" },
    { name: "Redwood Middle School Gym (Napa)", city: "Napa, CA", lat: 38.2958, lng: -122.2828, access: "members" },
    { name: "River Middle School Gym", city: "Napa, CA", lat: 38.3100, lng: -122.3236, access: "members" },
    // Elementary
    { name: "Napa Valley Language Academy Gym", city: "Napa, CA", lat: 38.2864, lng: -122.2871, access: "members" },
    { name: "Bel Aire Park Elementary Gym (Napa)", city: "Napa, CA", lat: 38.3012, lng: -122.3024, access: "members" },
    { name: "Browns Valley Elementary Gym", city: "Napa, CA", lat: 38.2877, lng: -122.3145, access: "members" },
    { name: "Shearer Elementary Gym", city: "Napa, CA", lat: 38.2991, lng: -122.2731, access: "members" },
    { name: "Phillips Elementary Gym", city: "Napa, CA", lat: 38.3222, lng: -122.2960, access: "members" },
    { name: "Vichy Elementary Gym", city: "Napa, CA", lat: 38.2733, lng: -122.2596, access: "members" },
    // Rec/College
    { name: "Napa Valley College Gym", city: "Napa, CA", lat: 38.2726, lng: -122.2744, access: "members" },
    { name: "Napa Community Center", city: "Napa, CA", lat: 38.2964, lng: -122.2868, access: "public" },
];

// ─── SOLANO COUNTY ───
const SOLANO_SCHOOLS = [
    // (Fairfield, Vallejo, Vacaville already have HS from P5)
    { name: "Benicia High School Gym", city: "Benicia, CA", lat: 38.0673, lng: -122.1473, access: "members" },
    { name: "Armijo High School Gym", city: "Fairfield, CA", lat: 38.2455, lng: -122.0303, access: "members" },
    { name: "Rodriguez High School Gym", city: "Fairfield, CA", lat: 38.2612, lng: -122.0027, access: "members" },
    { name: "Will C. Wood High School Gym", city: "Vacaville, CA", lat: 38.3543, lng: -121.9503, access: "members" },
    { name: "Hogan High School Gym", city: "Vallejo, CA", lat: 38.1050, lng: -122.2524, access: "members" },
    { name: "Dixon High School Gym", city: "Dixon, CA", lat: 38.4445, lng: -121.8284, access: "members" },
    { name: "Suisun Valley High School Gym", city: "Suisun City, CA", lat: 38.2391, lng: -122.0309, access: "members" },
    { name: "Rio Vista High School Gym", city: "Rio Vista, CA", lat: 38.1596, lng: -121.6949, access: "members" },
    // Middle Schools
    { name: "Grange Middle School Gym", city: "Fairfield, CA", lat: 38.2652, lng: -122.0322, access: "members" },
    { name: "Crystal Middle School Gym", city: "Suisun City, CA", lat: 38.2414, lng: -122.0405, access: "members" },
    { name: "Vallejo Middle School Gym", city: "Vallejo, CA", lat: 38.1028, lng: -122.2543, access: "members" },
    { name: "Loma Vista Middle School Gym", city: "Vallejo, CA", lat: 38.0944, lng: -122.2344, access: "members" },
    // Rec/College
    { name: "Solano Community College Gym", city: "Fairfield, CA", lat: 38.2398, lng: -122.0359, access: "members" },
    { name: "Benicia Community Center", city: "Benicia, CA", lat: 38.0614, lng: -122.1491, access: "public" },
    { name: "Vallejo Community Center", city: "Vallejo, CA", lat: 38.1075, lng: -122.2590, access: "public" },
];

async function main() {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  CA SUPPLEMENT: SF SCHOOLS + NORTH BAY COMPLETE   ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['SFUSD Elementary Schools', SFUSD_ELEMENTARY],
        ['Marin County Schools & Rec', MARIN_SCHOOLS],
        ['Sonoma County Schools & Rec', SONOMA_SCHOOLS],
        ['Napa County Schools & Rec', NAPA_SCHOOLS],
        ['Solano County Schools & Rec', SOLANO_SCHOOLS],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`SUPPLEMENT TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

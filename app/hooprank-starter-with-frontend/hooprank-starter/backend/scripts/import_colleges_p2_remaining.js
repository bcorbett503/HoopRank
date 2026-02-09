/**
 * College & University Courts — Phase 1 Part 2: Mid-Tier Cities & Remaining Metros
 * Covers NCAA D1/D2/D3 + NAIA schools in our remaining covered cities
 */
const https = require('https');
const crypto = require('crypto');

const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

function postCourt(court) {
    return new Promise((resolve, reject) => {
        const id = generateUUID(court.name + court.city);
        const params = new URLSearchParams({
            id,
            name: court.name,
            city: court.city,
            lat: String(court.lat),
            lng: String(court.lng),
            indoor: String(court.indoor),
            access: court.access || 'members',
        });
        const options = {
            hostname: BASE,
            path: `/courts/admin/create?${params.toString()}`,
            method: 'POST',
            headers: { 'x-user-id': USER_ID },
            timeout: 10000,
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

// ==========================================
// NASHVILLE / TENNESSEE
// ==========================================
const NASHVILLE_COLLEGES = [
    { name: "Vanderbilt University Recreation Center", city: "Nashville, TN", lat: 36.1439, lng: -86.8053, indoor: true, access: "members" },
    { name: "Belmont University Curb Event Center", city: "Nashville, TN", lat: 36.1333, lng: -86.7932, indoor: true, access: "members" },
    { name: "Lipscomb University Allen Arena", city: "Nashville, TN", lat: 36.1085, lng: -86.8091, indoor: true, access: "members" },
    { name: "Tennessee State University Gentry Center", city: "Nashville, TN", lat: 36.1667, lng: -86.8336, indoor: true, access: "members" },
    { name: "Fisk University Memorial Gymnasium", city: "Nashville, TN", lat: 36.1674, lng: -86.8013, indoor: true, access: "members" },
    { name: "University of Memphis Elma Roane Fieldhouse", city: "Memphis, TN", lat: 35.1193, lng: -89.9370, indoor: true, access: "members" },
    { name: "University of Tennessee Student Recreation Center", city: "Knoxville, TN", lat: 35.9524, lng: -83.9307, indoor: true, access: "members" },
    { name: "Middle Tennessee State University Recreation Center", city: "Murfreesboro, TN", lat: 35.8490, lng: -86.3628, indoor: true, access: "members" },
];

// ==========================================
// CHARLOTTE / CAROLINAS
// ==========================================
const CHARLOTTE_COLLEGES = [
    { name: "UNC Charlotte Student Activity Center", city: "Charlotte, NC", lat: 35.3075, lng: -80.7313, indoor: true, access: "members" },
    { name: "Davidson College Baker Sports Complex", city: "Davidson, NC", lat: 35.4996, lng: -80.8467, indoor: true, access: "members" },
    { name: "Johnson C. Smith University Brayboy Gymnasium", city: "Charlotte, NC", lat: 35.2287, lng: -80.8636, indoor: true, access: "members" },
    { name: "Queens University Levine Center", city: "Charlotte, NC", lat: 35.1928, lng: -80.8277, indoor: true, access: "members" },
    { name: "Duke University Wilson Recreation Center", city: "Durham, NC", lat: 36.0016, lng: -78.9408, indoor: true, access: "members" },
    { name: "UNC Chapel Hill Student Recreation Center", city: "Chapel Hill, NC", lat: 35.9076, lng: -79.0422, indoor: true, access: "members" },
    { name: "NC State University Carmichael Complex", city: "Raleigh, NC", lat: 35.7875, lng: -78.6707, indoor: true, access: "members" },
    { name: "Wake Forest University Reynolds Gymnasium", city: "Winston-Salem, NC", lat: 36.1318, lng: -80.2792, indoor: true, access: "members" },
    { name: "UNC Greensboro Coleman Gymnasium", city: "Greensboro, NC", lat: 36.0694, lng: -79.8115, indoor: true, access: "members" },
    { name: "Clemson University Fike Recreation Center", city: "Clemson, SC", lat: 34.6782, lng: -82.8375, indoor: true, access: "members" },
    { name: "University of South Carolina Strom Thurmond Wellness Center", city: "Columbia, SC", lat: 33.9934, lng: -81.0256, indoor: true, access: "members" },
    { name: "College of Charleston TD Arena", city: "Charleston, SC", lat: 32.7856, lng: -79.9353, indoor: true, access: "members" },
];

// ==========================================
// INDIANAPOLIS / MIDWEST
// ==========================================
const INDY_COLLEGES = [
    { name: "Butler University Hinkle Fieldhouse", city: "Indianapolis, IN", lat: 39.8317, lng: -86.1727, indoor: true, access: "members" },
    { name: "IUPUI Student Fitness Center", city: "Indianapolis, IN", lat: 39.7746, lng: -86.1759, indoor: true, access: "members" },
    { name: "University of Indianapolis Nicoson Hall", city: "Indianapolis, IN", lat: 39.7203, lng: -86.1370, indoor: true, access: "members" },
    { name: "Marian University Physical Education Center", city: "Indianapolis, IN", lat: 39.8311, lng: -86.2021, indoor: true, access: "members" },
    { name: "Purdue University France A. Córdova Recreation Center", city: "West Lafayette, IN", lat: 40.4268, lng: -86.9241, indoor: true, access: "members" },
    { name: "Indiana University Student Recreational Sports Center", city: "Bloomington, IN", lat: 39.1680, lng: -86.5176, indoor: true, access: "members" },
    { name: "Ball State University Student Recreation Center", city: "Muncie, IN", lat: 40.2069, lng: -85.4086, indoor: true, access: "members" },
    { name: "Notre Dame University Rolfs Athletics Hall", city: "Notre Dame, IN", lat: 41.7010, lng: -86.2367, indoor: true, access: "members" },
];

// ==========================================
// COLUMBUS / OHIO
// ==========================================
const OHIO_COLLEGES = [
    { name: "Ohio State University Recreation Physical Activity Center", city: "Columbus, OH", lat: 40.0060, lng: -83.0189, indoor: true, access: "members" },
    { name: "Capital University Capital Center", city: "Columbus, OH", lat: 39.9556, lng: -82.9454, indoor: true, access: "members" },
    { name: "Ohio Dominican University Alumni Hall", city: "Columbus, OH", lat: 39.9916, lng: -82.9384, indoor: true, access: "members" },
    { name: "Cleveland State University Recreation Center", city: "Cleveland, OH", lat: 41.5029, lng: -81.6754, indoor: true, access: "members" },
    { name: "Case Western Reserve University Veale Recreation Center", city: "Cleveland, OH", lat: 41.5010, lng: -81.6084, indoor: true, access: "members" },
    { name: "University of Cincinnati Campus Recreation Center", city: "Cincinnati, OH", lat: 39.1322, lng: -84.5179, indoor: true, access: "members" },
    { name: "Xavier University Cintas Center", city: "Cincinnati, OH", lat: 39.1486, lng: -84.4734, indoor: true, access: "members" },
    { name: "University of Dayton RecPlex", city: "Dayton, OH", lat: 39.7392, lng: -84.1793, indoor: true, access: "members" },
    { name: "University of Akron Student Recreation Center", city: "Akron, OH", lat: 41.0749, lng: -81.5061, indoor: true, access: "members" },
    { name: "Kent State University Student Recreation Center", city: "Kent, OH", lat: 41.1472, lng: -81.3472, indoor: true, access: "members" },
];

// ==========================================
// DETROIT / MICHIGAN
// ==========================================
const MICHIGAN_COLLEGES = [
    { name: "Wayne State University Matthaei Building", city: "Detroit, MI", lat: 42.3599, lng: -83.0733, indoor: true, access: "members" },
    { name: "University of Detroit Mercy Calihan Hall", city: "Detroit, MI", lat: 42.3963, lng: -83.1363, indoor: true, access: "members" },
    { name: "University of Michigan Intramural Sports Building", city: "Ann Arbor, MI", lat: 42.2711, lng: -83.7393, indoor: true, access: "members" },
    { name: "Michigan State University IM Sports West", city: "East Lansing, MI", lat: 42.7269, lng: -84.4784, indoor: true, access: "members" },
    { name: "Eastern Michigan University Rec/IM Building", city: "Ypsilanti, MI", lat: 42.2500, lng: -83.6244, indoor: true, access: "members" },
    { name: "Oakland University Recreation Center", city: "Rochester, MI", lat: 42.6723, lng: -83.2185, indoor: true, access: "members" },
    { name: "Western Michigan University Student Recreation Center", city: "Kalamazoo, MI", lat: 42.2815, lng: -85.6115, indoor: true, access: "members" },
    { name: "Grand Valley State University Recreation Center", city: "Allendale, MI", lat: 42.9648, lng: -85.8872, indoor: true, access: "members" },
];

// ==========================================
// PORTLAND / OREGON
// ==========================================
const PORTLAND_COLLEGES = [
    { name: "Lewis & Clark College Pamplin Sports Center", city: "Portland, OR", lat: 45.4504, lng: -122.6731, indoor: true, access: "members" },
    { name: "Reed College Sports Center", city: "Portland, OR", lat: 45.4814, lng: -122.6305, indoor: true, access: "members" },
    { name: "George Fox University Wheeler Sports Center", city: "Newberg, OR", lat: 45.2999, lng: -122.9735, indoor: true, access: "members" },
    { name: "Willamette University Lestle J. Sparks Center", city: "Salem, OR", lat: 44.9370, lng: -123.0283, indoor: true, access: "members" },
];

// ==========================================
// LAS VEGAS / NEVADA
// ==========================================
const VEGAS_COLLEGES = [
    { name: "UNLV Student Recreation Center", city: "Las Vegas, NV", lat: 36.1077, lng: -115.1445, indoor: true, access: "members" },
    { name: "College of Southern Nevada Henderson Campus Gym", city: "Henderson, NV", lat: 36.0320, lng: -115.0545, indoor: true, access: "members" },
    { name: "University of Nevada Reno Lombardi Recreation Center", city: "Reno, NV", lat: 39.5455, lng: -119.8168, indoor: true, access: "members" },
];

// ==========================================
// SALT LAKE CITY / UTAH
// ==========================================
const SLC_COLLEGES = [
    { name: "University of Utah Student Life Center", city: "Salt Lake City, UT", lat: 40.7672, lng: -111.8469, indoor: true, access: "members" },
    { name: "BYU Richards Building", city: "Provo, UT", lat: 40.2502, lng: -111.6524, indoor: true, access: "members" },
    { name: "Utah State University HPER Building", city: "Logan, UT", lat: 41.7453, lng: -111.8114, indoor: true, access: "members" },
    { name: "Weber State University Stromberg Complex", city: "Ogden, UT", lat: 41.1928, lng: -111.9449, indoor: true, access: "members" },
    { name: "Utah Valley University NUVI Basketball Center", city: "Orem, UT", lat: 40.2783, lng: -111.7127, indoor: true, access: "members" },
    { name: "Westminster University Eccles Gymnasium", city: "Salt Lake City, UT", lat: 40.7275, lng: -111.8555, indoor: true, access: "members" },
];

// ==========================================
// PITTSBURGH / WESTERN PA
// ==========================================
const PITT_COLLEGES = [
    { name: "University of Pittsburgh Trees Hall", city: "Pittsburgh, PA", lat: 40.4431, lng: -79.9576, indoor: true, access: "members" },
    { name: "Duquesne University UPMC Cooper Fieldhouse", city: "Pittsburgh, PA", lat: 40.4355, lng: -79.9894, indoor: true, access: "members" },
    { name: "Carnegie Mellon University Cohon University Center Gym", city: "Pittsburgh, PA", lat: 40.4432, lng: -79.9424, indoor: true, access: "members" },
    { name: "Robert Morris University Student Recreation Center", city: "Moon Township, PA", lat: 40.5124, lng: -80.1722, indoor: true, access: "members" },
    { name: "West Virginia University Student Recreation Center", city: "Morgantown, WV", lat: 39.6505, lng: -79.9533, indoor: true, access: "members" },
];

// ==========================================
// KANSAS CITY / MISSOURI
// ==========================================
const KC_COLLEGES = [
    { name: "University of Missouri-Kansas City Swinney Recreation Center", city: "Kansas City, MO", lat: 39.0337, lng: -94.5763, indoor: true, access: "members" },
    { name: "Rockhurst University Mabee Fieldhouse", city: "Kansas City, MO", lat: 39.0368, lng: -94.5688, indoor: true, access: "members" },
    { name: "University of Kansas Ambler Student Recreation Center", city: "Lawrence, KS", lat: 38.9570, lng: -95.2517, indoor: true, access: "members" },
    { name: "Kansas State University Recreation Complex", city: "Manhattan, KS", lat: 39.1919, lng: -96.5840, indoor: true, access: "members" },
    { name: "Missouri State University Foster Recreation Center", city: "Springfield, MO", lat: 37.2060, lng: -93.2832, indoor: true, access: "members" },
    { name: "Saint Louis University Chaifetz Arena", city: "St. Louis, MO", lat: 38.6357, lng: -90.2278, indoor: true, access: "members" },
    { name: "Washington University Athletic Complex", city: "St. Louis, MO", lat: 38.6499, lng: -90.3130, indoor: true, access: "members" },
    { name: "University of Missouri Student Recreation Complex", city: "Columbia, MO", lat: 38.9433, lng: -92.3276, indoor: true, access: "members" },
];

// ==========================================
// OKLAHOMA
// ==========================================
const OK_COLLEGES = [
    { name: "University of Oklahoma Huston Huffman Fitness Center", city: "Norman, OK", lat: 35.2063, lng: -97.4404, indoor: true, access: "members" },
    { name: "Oklahoma State University Colvin Recreation Center", city: "Stillwater, OK", lat: 36.1204, lng: -97.0692, indoor: true, access: "members" },
    { name: "University of Tulsa Collins Fitness Center", city: "Tulsa, OK", lat: 36.1522, lng: -95.9452, indoor: true, access: "members" },
    { name: "Oklahoma City University Abe Lemons Arena", city: "Oklahoma City, OK", lat: 35.4692, lng: -97.5260, indoor: true, access: "members" },
    { name: "Oral Roberts University Aerobics Center", city: "Tulsa, OK", lat: 36.0566, lng: -95.9374, indoor: true, access: "members" },
];

// ==========================================
// NEW ORLEANS / LOUISIANA
// ==========================================
const NOLA_COLLEGES = [
    { name: "Tulane University Reily Student Recreation Center", city: "New Orleans, LA", lat: 29.9414, lng: -90.1264, indoor: true, access: "members" },
    { name: "Loyola University New Orleans Sports Complex", city: "New Orleans, LA", lat: 29.9344, lng: -90.1225, indoor: true, access: "members" },
    { name: "Xavier University of Louisiana Recreation Center", city: "New Orleans, LA", lat: 29.9663, lng: -90.1120, indoor: true, access: "members" },
    { name: "Dillard University Dent Hall Gym", city: "New Orleans, LA", lat: 29.9854, lng: -90.0732, indoor: true, access: "members" },
    { name: "LSU University Recreation Center", city: "Baton Rouge, LA", lat: 30.4105, lng: -91.1855, indoor: true, access: "members" },
    { name: "University of Louisiana at Lafayette Rec Center", city: "Lafayette, LA", lat: 30.2135, lng: -92.0190, indoor: true, access: "members" },
];

// ==========================================
// LOUISVILLE / KENTUCKY
// ==========================================
const KY_COLLEGES = [
    { name: "University of Louisville Student Recreation Center", city: "Louisville, KY", lat: 38.2135, lng: -85.7556, indoor: true, access: "members" },
    { name: "Bellarmine University Knights Hall", city: "Louisville, KY", lat: 38.2190, lng: -85.6836, indoor: true, access: "members" },
    { name: "University of Kentucky Johnson Center", city: "Lexington, KY", lat: 38.0375, lng: -84.5041, indoor: true, access: "members" },
    { name: "Western Kentucky University Preston Center", city: "Bowling Green, KY", lat: 36.9872, lng: -86.4548, indoor: true, access: "members" },
    { name: "Northern Kentucky University Campus Recreation Center", city: "Highland Heights, KY", lat: 39.0313, lng: -84.4648, indoor: true, access: "members" },
];

// ==========================================
// RICHMOND / VIRGINIA
// ==========================================
const VA_COLLEGES = [
    { name: "VCU Stuart C. Siegel Center", city: "Richmond, VA", lat: 37.5517, lng: -77.4543, indoor: true, access: "members" },
    { name: "University of Richmond Weinstein Center", city: "Richmond, VA", lat: 37.5763, lng: -77.5408, indoor: true, access: "members" },
    { name: "Virginia Tech War Memorial Hall", city: "Blacksburg, VA", lat: 37.2280, lng: -80.4264, indoor: true, access: "members" },
    { name: "University of Virginia Slaughter Recreation Center", city: "Charlottesville, VA", lat: 38.0333, lng: -78.5109, indoor: true, access: "members" },
    { name: "Old Dominion University Student Recreation Center", city: "Norfolk, VA", lat: 36.8862, lng: -76.3056, indoor: true, access: "members" },
    { name: "James Madison University UREC", city: "Harrisonburg, VA", lat: 38.4387, lng: -78.8717, indoor: true, access: "members" },
    { name: "Liberty University LaHaye Recreation Center", city: "Lynchburg, VA", lat: 37.3547, lng: -79.1755, indoor: true, access: "members" },
];

// ==========================================
// BUFFALO / UPSTATE NY
// ==========================================
const BUFFALO_COLLEGES = [
    { name: "University at Buffalo Alumni Arena", city: "Buffalo, NY", lat: 43.0002, lng: -78.7854, indoor: true, access: "members" },
    { name: "Canisius University Koessler Athletic Center", city: "Buffalo, NY", lat: 42.9419, lng: -78.8510, indoor: true, access: "members" },
    { name: "Syracuse University Archbold Gymnasium", city: "Syracuse, NY", lat: 43.0357, lng: -76.1371, indoor: true, access: "members" },
    { name: "University of Rochester Goergen Athletic Center", city: "Rochester, NY", lat: 43.1282, lng: -77.6301, indoor: true, access: "members" },
    { name: "RIT Gordon Field House", city: "Rochester, NY", lat: 43.0861, lng: -77.6677, indoor: true, access: "members" },
    { name: "Colgate University Cotterell Court", city: "Hamilton, NY", lat: 42.8183, lng: -75.5440, indoor: true, access: "members" },
];

// ==========================================
// HAWAII
// ==========================================
const HAWAII_COLLEGES = [
    { name: "University of Hawaii Warrior Recreation Center", city: "Honolulu, HI", lat: 21.2979, lng: -157.8168, indoor: true, access: "members" },
    { name: "Chaminade University McCabe Gym", city: "Honolulu, HI", lat: 21.2909, lng: -157.7937, indoor: true, access: "members" },
    { name: "Hawaii Pacific University Gym", city: "Honolulu, HI", lat: 21.3051, lng: -157.8478, indoor: true, access: "members" },
];

// ==========================================
// SACRAMENTO / CENTRAL CA
// ==========================================
const SACRAMENTO_COLLEGES = [
    { name: "Sacramento State University The Well", city: "Sacramento, CA", lat: 38.5606, lng: -121.4234, indoor: true, access: "members" },
    { name: "UC Davis Activities and Recreation Center", city: "Davis, CA", lat: 38.5413, lng: -121.7530, indoor: true, access: "members" },
    { name: "University of the Pacific Baun Student Fitness Center", city: "Stockton, CA", lat: 37.9792, lng: -121.3109, indoor: true, access: "members" },
    { name: "Fresno State Student Recreation Center", city: "Fresno, CA", lat: 36.8113, lng: -119.7494, indoor: true, access: "members" },
];

// ==========================================
// TUCSON / NEW MEXICO
// ==========================================
const DESERT_COLLEGES = [
    { name: "University of Arizona Student Recreation Center", city: "Tucson, AZ", lat: 32.2284, lng: -110.9570, indoor: true, access: "members" },
    { name: "University of New Mexico Johnson Center", city: "Albuquerque, NM", lat: 35.0837, lng: -106.6215, indoor: true, access: "members" },
    { name: "New Mexico State University Activity Center", city: "Las Cruces, NM", lat: 32.2808, lng: -106.7472, indoor: true, access: "members" },
];

// ==========================================
// NEBRASKA / IOWA / DAKOTAS
// ==========================================
const PLAINS_COLLEGES = [
    { name: "University of Nebraska Campus Recreation Center", city: "Lincoln, NE", lat: 40.8175, lng: -96.6986, indoor: true, access: "members" },
    { name: "Creighton University Rasmussen Fitness Center", city: "Omaha, NE", lat: 41.2620, lng: -95.9469, indoor: true, access: "members" },
    { name: "University of Iowa Campus Recreation Center", city: "Iowa City, IA", lat: 41.6614, lng: -91.5469, indoor: true, access: "members" },
    { name: "Drake University Knapp Center", city: "Des Moines, IA", lat: 41.5984, lng: -93.6570, indoor: true, access: "members" },
    { name: "University of South Dakota Sanford Coyote Sports Center", city: "Vermillion, SD", lat: 42.7840, lng: -96.9265, indoor: true, access: "members" },
    { name: "South Dakota State University Wellness Center", city: "Brookings, SD", lat: 44.3173, lng: -96.7885, indoor: true, access: "members" },
    { name: "North Dakota State University Wallman Wellness Center", city: "Fargo, ND", lat: 46.8948, lng: -96.8005, indoor: true, access: "members" },
];

// ==========================================
// CONNECTICUT / HARTFORD
// ==========================================
const CT_COLLEGES = [
    { name: "University of Connecticut Student Recreation Center", city: "Storrs, CT", lat: 41.8077, lng: -72.2540, indoor: true, access: "members" },
    { name: "Yale University Payne Whitney Gymnasium", city: "New Haven, CT", lat: 41.3143, lng: -72.9300, indoor: true, access: "members" },
    { name: "Sacred Heart University William H. Pitt Health Center", city: "Fairfield, CT", lat: 41.1720, lng: -73.2392, indoor: true, access: "members" },
    { name: "Quinnipiac University Recreation Center", city: "Hamden, CT", lat: 41.4189, lng: -72.8930, indoor: true, access: "members" },
    { name: "University of Hartford Sports Center", city: "West Hartford, CT", lat: 41.8004, lng: -72.7147, indoor: true, access: "members" },
    { name: "Central Connecticut State University Kaiser Gymnasium", city: "New Britain, CT", lat: 41.6807, lng: -72.7794, indoor: true, access: "members" },
];

// ==========================================
// WISCONSIN / MILWAUKEE
// ==========================================
const WI_COLLEGES = [
    { name: "Marquette University Recreation Center", city: "Milwaukee, WI", lat: 43.0368, lng: -87.9300, indoor: true, access: "members" },
    { name: "University of Wisconsin-Milwaukee Klotsche Center", city: "Milwaukee, WI", lat: 43.0771, lng: -87.8827, indoor: true, access: "members" },
    { name: "University of Wisconsin-Madison Nicholas Recreation Center", city: "Madison, WI", lat: 43.0690, lng: -89.4125, indoor: true, access: "members" },
    { name: "Milwaukee School of Engineering Kern Center", city: "Milwaukee, WI", lat: 43.0447, lng: -87.9084, indoor: true, access: "members" },
];

// ==========================================
// ALABAMA / MISSISSIPPI
// ==========================================
const AL_MS_COLLEGES = [
    { name: "University of Alabama Student Recreation Center", city: "Tuscaloosa, AL", lat: 33.2126, lng: -87.5431, indoor: true, access: "members" },
    { name: "Auburn University Recreation & Wellness Center", city: "Auburn, AL", lat: 32.6011, lng: -85.4887, indoor: true, access: "members" },
    { name: "University of Alabama at Birmingham Recreation Center", city: "Birmingham, AL", lat: 33.5053, lng: -86.8048, indoor: true, access: "members" },
    { name: "Samford University Seibert Hall Gymnasium", city: "Birmingham, AL", lat: 33.4629, lng: -86.7937, indoor: true, access: "members" },
    { name: "University of Mississippi Turner Center", city: "Oxford, MS", lat: 34.3637, lng: -89.5342, indoor: true, access: "members" },
    { name: "Mississippi State University Sanderson Center", city: "Starkville, MS", lat: 33.4553, lng: -88.7913, indoor: true, access: "members" },
    { name: "Jackson State University Lee E. Williams Athletics Center", city: "Jackson, MS", lat: 32.2956, lng: -90.2058, indoor: true, access: "members" },
];

// ==========================================
// ARKANSAS / GEORGIA secondary
// ==========================================
const AR_GA_COLLEGES = [
    { name: "University of Arkansas HPER Building", city: "Fayetteville, AR", lat: 36.0675, lng: -94.1749, indoor: true, access: "members" },
    { name: "University of Central Arkansas Farris Center", city: "Conway, AR", lat: 35.0782, lng: -92.4599, indoor: true, access: "members" },
    { name: "Augusta University Christenberry Fieldhouse", city: "Augusta, GA", lat: 33.4745, lng: -82.0258, indoor: true, access: "members" },
    { name: "University of Georgia Ramsey Student Center", city: "Athens, GA", lat: 33.9481, lng: -83.3723, indoor: true, access: "members" },
    { name: "Georgia Southern University Recreation Activity Center", city: "Statesboro, GA", lat: 32.4208, lng: -81.7811, indoor: true, access: "members" },
    { name: "Savannah State University Tiger Arena", city: "Savannah, GA", lat: 32.0548, lng: -81.0571, indoor: true, access: "members" },
];

// ==========================================
// IMPORT RUNNER
// ==========================================
const ALL_REGIONS = [
    { name: 'Nashville/Tennessee', courts: NASHVILLE_COLLEGES },
    { name: 'Charlotte/Carolinas', courts: CHARLOTTE_COLLEGES },
    { name: 'Indianapolis/Midwest', courts: INDY_COLLEGES },
    { name: 'Columbus/Ohio', courts: OHIO_COLLEGES },
    { name: 'Detroit/Michigan', courts: MICHIGAN_COLLEGES },
    { name: 'Portland/Oregon', courts: PORTLAND_COLLEGES },
    { name: 'Las Vegas/Nevada', courts: VEGAS_COLLEGES },
    { name: 'Salt Lake City/Utah', courts: SLC_COLLEGES },
    { name: 'Pittsburgh/Western PA', courts: PITT_COLLEGES },
    { name: 'Kansas City/Missouri', courts: KC_COLLEGES },
    { name: 'Oklahoma', courts: OK_COLLEGES },
    { name: 'New Orleans/Louisiana', courts: NOLA_COLLEGES },
    { name: 'Louisville/Kentucky', courts: KY_COLLEGES },
    { name: 'Richmond/Virginia', courts: VA_COLLEGES },
    { name: 'Buffalo/Upstate NY', courts: BUFFALO_COLLEGES },
    { name: 'Hawaii', courts: HAWAII_COLLEGES },
    { name: 'Sacramento/Central CA', courts: SACRAMENTO_COLLEGES },
    { name: 'Tucson/New Mexico', courts: DESERT_COLLEGES },
    { name: 'Nebraska/Iowa/Dakotas', courts: PLAINS_COLLEGES },
    { name: 'Connecticut/Hartford', courts: CT_COLLEGES },
    { name: 'Wisconsin/Milwaukee', courts: WI_COLLEGES },
    { name: 'Alabama/Mississippi', courts: AL_MS_COLLEGES },
    { name: 'Arkansas/Georgia', courts: AR_GA_COLLEGES },
];

async function main() {
    const totalCourts = ALL_REGIONS.reduce((sum, r) => sum + r.courts.length, 0);
    console.log(`\n=== COLLEGE COURTS IMPORT P2: ${ALL_REGIONS.length} REGIONS, ${totalCourts} COURTS ===\n`);

    let grandOk = 0, grandFail = 0;

    for (const region of ALL_REGIONS) {
        console.log(`\n🎓 ${region.name} (${region.courts.length} colleges)`);
        console.log('─'.repeat(50));

        let ok = 0, fail = 0;
        for (const court of region.courts) {
            try {
                const result = await postCourt(court);
                if (result.status < 400) {
                    console.log(`  ✅ ${court.name}`);
                    ok++;
                } else {
                    console.log(`  ⚠️  ${court.name}: HTTP ${result.status}`);
                    ok++;
                }
            } catch (err) {
                console.log(`  ❌ ${court.name}: ${err.message}`);
                fail++;
            }
        }

        console.log(`  → ${ok} ok, ${fail} failed`);
        grandOk += ok;
        grandFail += fail;
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`TOTAL: ${grandOk} succeeded, ${grandFail} failed out of ${totalCourts}`);
    console.log(`${'═'.repeat(50)}\n`);
}

main();

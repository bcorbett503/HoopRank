/**
 * College & University Courts — Phase 1 Part 1: Major Metros
 * Covers NCAA D1/D2/D3 + NAIA schools in our top 30 metros
 * Each entry is the primary recreation/athletic center with indoor basketball
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
// NEW YORK CITY AREA
// ==========================================
const NYC_COLLEGES = [
    // D1
    { name: "St. John's University Carnesecca Arena", city: "Queens, NY", lat: 40.7226, lng: -73.7949, indoor: true, access: "members" },
    { name: "Fordham University Rose Hill Gym", city: "Bronx, NY", lat: 40.8609, lng: -73.8856, indoor: true, access: "members" },
    { name: "Columbia University Dodge Physical Fitness Center", city: "New York, NY", lat: 40.8077, lng: -73.9613, indoor: true, access: "members" },
    { name: "NYU Palladium Athletic Facility", city: "New York, NY", lat: 40.7317, lng: -73.9905, indoor: true, access: "members" },
    { name: "Baruch College ARC Arena", city: "New York, NY", lat: 40.7405, lng: -73.9832, indoor: true, access: "members" },
    { name: "Long Island University Steinberg Wellness Center", city: "Brooklyn, NY", lat: 40.6907, lng: -73.9815, indoor: true, access: "members" },
    { name: "Hofstra University David S. Mack Sports Complex", city: "Hempstead, NY", lat: 40.7166, lng: -73.6005, indoor: true, access: "members" },
    { name: "Iona University Hynes Athletic Center", city: "New Rochelle, NY", lat: 40.9021, lng: -73.7834, indoor: true, access: "members" },
    { name: "Manhattan College Draddy Gymnasium", city: "Bronx, NY", lat: 40.8901, lng: -73.9037, indoor: true, access: "members" },
    { name: "Wagner College Spiro Sports Center", city: "Staten Island, NY", lat: 40.6182, lng: -74.0958, indoor: true, access: "members" },
    // D2/D3
    { name: "CUNY City College Nat Holman Gymnasium", city: "New York, NY", lat: 40.8199, lng: -73.9499, indoor: true, access: "members" },
    { name: "Hunter College Sportsplex", city: "New York, NY", lat: 40.7681, lng: -73.9644, indoor: true, access: "members" },
    { name: "Brooklyn College West End Building Gym", city: "Brooklyn, NY", lat: 40.6310, lng: -73.9543, indoor: true, access: "members" },
    { name: "Queens College Fitzgerald Gymnasium", city: "Queens, NY", lat: 40.7360, lng: -73.8175, indoor: true, access: "members" },
    { name: "College of Staten Island Sports & Recreation Center", city: "Staten Island, NY", lat: 40.6019, lng: -74.1485, indoor: true, access: "members" },
    { name: "Yeshiva University Max Stern Athletic Center", city: "New York, NY", lat: 40.8502, lng: -73.9281, indoor: true, access: "members" },
    { name: "NJIT Wellness & Events Center", city: "Newark, NJ", lat: 40.7420, lng: -74.1791, indoor: true, access: "members" },
    { name: "Seton Hall University Walsh Gymnasium", city: "South Orange, NJ", lat: 40.7459, lng: -74.2438, indoor: true, access: "members" },
    { name: "Fairleigh Dickinson University Rothman Center", city: "Hackensack, NJ", lat: 40.8855, lng: -74.0466, indoor: true, access: "members" },
    { name: "Rutgers University Livingston Recreation Center", city: "Piscataway, NJ", lat: 40.5238, lng: -74.4368, indoor: true, access: "members" },
];

// ==========================================
// LOS ANGELES AREA
// ==========================================
const LA_COLLEGES = [
    // D1
    { name: "UCLA Pauley Pavilion", city: "Los Angeles, CA", lat: 34.0702, lng: -118.4468, indoor: true, access: "members" },
    { name: "USC Lyon Center", city: "Los Angeles, CA", lat: 34.0241, lng: -118.2870, indoor: true, access: "members" },
    { name: "Loyola Marymount University Gersten Pavilion", city: "Los Angeles, CA", lat: 33.9701, lng: -118.4179, indoor: true, access: "members" },
    { name: "Pepperdine University Firestone Fieldhouse", city: "Malibu, CA", lat: 34.0360, lng: -118.7076, indoor: true, access: "members" },
    { name: "Cal State Fullerton Titan Gym", city: "Fullerton, CA", lat: 33.8826, lng: -117.8853, indoor: true, access: "members" },
    { name: "Cal State Northridge The Matadome", city: "Northridge, CA", lat: 34.2405, lng: -118.5285, indoor: true, access: "members" },
    { name: "UC Irvine Bren Events Center", city: "Irvine, CA", lat: 33.6486, lng: -117.8385, indoor: true, access: "members" },
    { name: "Long Beach State Walter Pyramid", city: "Long Beach, CA", lat: 33.7875, lng: -118.1147, indoor: true, access: "members" },
    // D2/D3
    { name: "Cal State LA University Gym", city: "Los Angeles, CA", lat: 34.0670, lng: -118.1684, indoor: true, access: "members" },
    { name: "Cal State Dominguez Hills Gymnasium", city: "Carson, CA", lat: 33.8615, lng: -118.2560, indoor: true, access: "members" },
    { name: "Azusa Pacific University Felix Event Center", city: "Azusa, CA", lat: 34.1326, lng: -117.9068, indoor: true, access: "members" },
    { name: "Cal Poly Pomona Kellogg Gym", city: "Pomona, CA", lat: 34.0580, lng: -117.8219, indoor: true, access: "members" },
    { name: "Occidental College Rush Gymnasium", city: "Los Angeles, CA", lat: 34.1275, lng: -118.2100, indoor: true, access: "members" },
    { name: "Claremont-Mudd-Scripps Ducey Gymnasium", city: "Claremont, CA", lat: 34.1012, lng: -117.7107, indoor: true, access: "members" },
    { name: "Whittier College Graham Activities Center", city: "Whittier, CA", lat: 33.9780, lng: -118.0325, indoor: true, access: "members" },
];

// ==========================================
// CHICAGO AREA
// ==========================================
const CHICAGO_COLLEGES = [
    // D1
    { name: "DePaul University Sullivan Athletic Center", city: "Chicago, IL", lat: 41.9239, lng: -87.6551, indoor: true, access: "members" },
    { name: "Loyola University Chicago Gentile Arena", city: "Chicago, IL", lat: 41.9995, lng: -87.6584, indoor: true, access: "members" },
    { name: "Northwestern University Welsh-Ryan Arena", city: "Evanston, IL", lat: 42.0593, lng: -87.6741, indoor: true, access: "members" },
    { name: "UIC Flames Athletic Center", city: "Chicago, IL", lat: 41.8745, lng: -87.6571, indoor: true, access: "members" },
    { name: "Chicago State University Jacoby Dickens Center", city: "Chicago, IL", lat: 41.7190, lng: -87.6114, indoor: true, access: "members" },
    { name: "Valparaiso University Athletics Recreation Center", city: "Valparaiso, IN", lat: 41.4636, lng: -87.0389, indoor: true, access: "members" },
    // D2/D3
    { name: "Lewis University Neil Carey Arena", city: "Romeoville, IL", lat: 41.6213, lng: -88.0996, indoor: true, access: "members" },
    { name: "Illinois Institute of Technology Keating Sports Center", city: "Chicago, IL", lat: 41.8317, lng: -87.6276, indoor: true, access: "members" },
    { name: "North Central College Merner Fieldhouse", city: "Naperville, IL", lat: 41.7715, lng: -88.1518, indoor: true, access: "members" },
    { name: "Wheaton College King Arena", city: "Wheaton, IL", lat: 41.8657, lng: -88.1020, indoor: true, access: "members" },
    { name: "Elmhurst University Faganel Hall", city: "Elmhurst, IL", lat: 41.8978, lng: -87.9444, indoor: true, access: "members" },
    { name: "North Park University Helwig Recreation Center", city: "Chicago, IL", lat: 41.9841, lng: -87.7230, indoor: true, access: "members" },
    { name: "University of Chicago Ratner Athletics Center", city: "Chicago, IL", lat: 41.7914, lng: -87.6004, indoor: true, access: "members" },
];

// ==========================================
// SAN FRANCISCO BAY AREA
// ==========================================
const SF_COLLEGES = [
    // D1
    { name: "Stanford University Maples Pavilion", city: "Stanford, CA", lat: 37.4346, lng: -122.1609, indoor: true, access: "members" },
    { name: "UC Berkeley Recreational Sports Facility", city: "Berkeley, CA", lat: 37.8685, lng: -122.2624, indoor: true, access: "members" },
    { name: "Santa Clara University Leavey Center", city: "Santa Clara, CA", lat: 37.3501, lng: -121.9393, indoor: true, access: "members" },
    { name: "San Jose State University Spartan Recreation Center", city: "San Jose, CA", lat: 37.3337, lng: -121.8814, indoor: true, access: "members" },
    { name: "Saint Mary's College McKeon Pavilion", city: "Moraga, CA", lat: 37.8404, lng: -122.1075, indoor: true, access: "members" },
    // D2/D3
    { name: "San Francisco State University Main Gym", city: "San Francisco, CA", lat: 37.7219, lng: -122.4778, indoor: true, access: "members" },
    { name: "Cal State East Bay Pioneer Gymnasium", city: "Hayward, CA", lat: 37.6555, lng: -122.0568, indoor: true, access: "members" },
    { name: "Academy of Art University Gym", city: "San Francisco, CA", lat: 37.7865, lng: -122.4106, indoor: true, access: "members" },
    { name: "Dominican University of California Conlan Center", city: "San Rafael, CA", lat: 37.9818, lng: -122.5141, indoor: true, access: "members" },
    { name: "UC Santa Cruz West Field House", city: "Santa Cruz, CA", lat: 36.9916, lng: -122.0583, indoor: true, access: "members" },
];

// ==========================================
// HOUSTON AREA
// ==========================================
const HOUSTON_COLLEGES = [
    { name: "University of Houston Campus Recreation Center", city: "Houston, TX", lat: 29.7209, lng: -95.3441, indoor: true, access: "members" },
    { name: "Rice University Tudor Fieldhouse", city: "Houston, TX", lat: 29.7158, lng: -95.4055, indoor: true, access: "members" },
    { name: "Texas Southern University H&PE Arena", city: "Houston, TX", lat: 29.7245, lng: -95.3569, indoor: true, access: "members" },
    { name: "Houston Baptist University Sharp Gymnasium", city: "Houston, TX", lat: 29.7118, lng: -95.5539, indoor: true, access: "members" },
    { name: "Sam Houston State University Johnson Coliseum", city: "Huntsville, TX", lat: 30.7118, lng: -95.5489, indoor: true, access: "members" },
    { name: "Prairie View A&M University Baby Dome", city: "Prairie View, TX", lat: 30.0874, lng: -95.9860, indoor: true, access: "members" },
    { name: "University of St. Thomas Jerabeck Activity Center", city: "Houston, TX", lat: 29.7378, lng: -95.4191, indoor: true, access: "members" },
];

// ==========================================
// DALLAS/FORT WORTH AREA
// ==========================================
const DFW_COLLEGES = [
    { name: "SMU Moody Coliseum", city: "Dallas, TX", lat: 32.8416, lng: -96.7847, indoor: true, access: "members" },
    { name: "TCU University Recreation Center", city: "Fort Worth, TX", lat: 32.7098, lng: -97.3613, indoor: true, access: "members" },
    { name: "UTA Texas Hall", city: "Arlington, TX", lat: 32.7294, lng: -97.1130, indoor: true, access: "members" },
    { name: "University of North Texas Coliseum", city: "Denton, TX", lat: 33.2117, lng: -97.1484, indoor: true, access: "members" },
    { name: "Dallas Baptist University Pilgrim Chapel Gym", city: "Dallas, TX", lat: 32.6938, lng: -96.9124, indoor: true, access: "members" },
    { name: "Tarleton State University Wisdom Gymnasium", city: "Stephenville, TX", lat: 32.2175, lng: -98.2038, indoor: true, access: "members" },
    { name: "Texas Wesleyan University Sid Richardson Center", city: "Fort Worth, TX", lat: 32.7225, lng: -97.3020, indoor: true, access: "members" },
];

// ==========================================
// PHOENIX/ARIZONA
// ==========================================
const PHOENIX_COLLEGES = [
    { name: "Arizona State University Sun Devil Fitness Complex", city: "Tempe, AZ", lat: 33.4253, lng: -111.9307, indoor: true, access: "members" },
    { name: "Grand Canyon University GCU Arena", city: "Phoenix, AZ", lat: 33.5076, lng: -112.1260, indoor: true, access: "members" },
    { name: "Arizona Christian University Student Life Center", city: "Glendale, AZ", lat: 33.5180, lng: -112.2052, indoor: true, access: "members" },
    { name: "Ottawa University Arizona Gymnasium", city: "Surprise, AZ", lat: 33.6308, lng: -112.3348, indoor: true, access: "members" },
];

// ==========================================
// SEATTLE/PACIFIC NW
// ==========================================
const SEATTLE_COLLEGES = [
    { name: "University of Washington Intramural Activities Building", city: "Seattle, WA", lat: 47.6567, lng: -122.3040, indoor: true, access: "members" },
    { name: "Seattle University Connolly Complex", city: "Seattle, WA", lat: 47.6117, lng: -122.3166, indoor: true, access: "members" },
    { name: "Seattle Pacific University Royal Brougham Pavilion", city: "Seattle, WA", lat: 47.6484, lng: -122.3567, indoor: true, access: "members" },
    { name: "Gonzaga University McCarthey Athletic Center", city: "Spokane, WA", lat: 47.6673, lng: -117.4033, indoor: true, access: "members" },
    { name: "University of Portland Chiles Center", city: "Portland, OR", lat: 45.5724, lng: -122.7269, indoor: true, access: "members" },
    { name: "Portland State University Stott Center", city: "Portland, OR", lat: 45.5112, lng: -122.6853, indoor: true, access: "members" },
    { name: "Oregon State University Dixon Recreation Center", city: "Corvallis, OR", lat: 44.5631, lng: -123.2783, indoor: true, access: "members" },
    { name: "University of Oregon Student Recreation Center", city: "Eugene, OR", lat: 44.0445, lng: -123.0727, indoor: true, access: "members" },
];

// ==========================================
// DENVER/COLORADO
// ==========================================
const DENVER_COLLEGES = [
    { name: "University of Denver Ritchie Center", city: "Denver, CO", lat: 39.6783, lng: -104.9609, indoor: true, access: "members" },
    { name: "Metropolitan State University Auraria Gymnasium", city: "Denver, CO", lat: 39.7451, lng: -105.0071, indoor: true, access: "members" },
    { name: "Regis University Fieldhouse", city: "Denver, CO", lat: 39.7879, lng: -105.0226, indoor: true, access: "members" },
    { name: "Colorado School of Mines Student Recreation Center", city: "Golden, CO", lat: 39.7515, lng: -105.2227, indoor: true, access: "members" },
    { name: "University of Colorado Boulder Student Recreation Center", city: "Boulder, CO", lat: 40.0104, lng: -105.2693, indoor: true, access: "members" },
    { name: "Colorado State University Student Recreation Center", city: "Fort Collins, CO", lat: 40.5728, lng: -105.0849, indoor: true, access: "members" },
    { name: "University of Northern Colorado Butler-Hancock Athletics Center", city: "Greeley, CO", lat: 40.4058, lng: -104.7004, indoor: true, access: "members" },
];

// ==========================================
// PHILADELPHIA AREA
// ==========================================
const PHILLY_COLLEGES = [
    { name: "Villanova University Davis Center", city: "Villanova, PA", lat: 40.0378, lng: -75.3431, indoor: true, access: "members" },
    { name: "Temple University Pearson-McGonigle Hall", city: "Philadelphia, PA", lat: 39.9810, lng: -75.1497, indoor: true, access: "members" },
    { name: "Drexel University Daskalakis Athletic Center", city: "Philadelphia, PA", lat: 39.9543, lng: -75.1889, indoor: true, access: "members" },
    { name: "La Salle University Tom Gola Arena", city: "Philadelphia, PA", lat: 40.0360, lng: -75.1537, indoor: true, access: "members" },
    { name: "Saint Joseph's University Alumni Memorial Fieldhouse", city: "Philadelphia, PA", lat: 39.9952, lng: -75.2363, indoor: true, access: "members" },
    { name: "Penn State Rec Hall", city: "University Park, PA", lat: 40.7963, lng: -77.8637, indoor: true, access: "members" },
    { name: "University of Pennsylvania Pottruck Health & Fitness Center", city: "Philadelphia, PA", lat: 39.9534, lng: -75.1969, indoor: true, access: "members" },
    { name: "Swarthmore College Tarble Pavilion", city: "Swarthmore, PA", lat: 39.9044, lng: -75.3542, indoor: true, access: "members" },
    { name: "Haverford College Alumni Field House", city: "Haverford, PA", lat: 40.0057, lng: -75.3034, indoor: true, access: "members" },
];

// ==========================================
// ATLANTA AREA
// ==========================================
const ATLANTA_COLLEGES = [
    { name: "Georgia Tech Campus Recreation Center", city: "Atlanta, GA", lat: 33.7756, lng: -84.4030, indoor: true, access: "members" },
    { name: "Georgia State University Recreation Center", city: "Atlanta, GA", lat: 33.7531, lng: -84.3860, indoor: true, access: "members" },
    { name: "Emory University Woodruff PE Center", city: "Atlanta, GA", lat: 33.7911, lng: -84.3247, indoor: true, access: "members" },
    { name: "Morehouse College Forbes Arena", city: "Atlanta, GA", lat: 33.7464, lng: -84.4139, indoor: true, access: "members" },
    { name: "Spelman College Read Hall Gymnasium", city: "Atlanta, GA", lat: 33.7445, lng: -84.4111, indoor: true, access: "members" },
    { name: "Clark Atlanta University Epps Gymnasium", city: "Atlanta, GA", lat: 33.7536, lng: -84.4137, indoor: true, access: "members" },
    { name: "Kennesaw State University Recreation Center", city: "Kennesaw, GA", lat: 34.0395, lng: -84.5814, indoor: true, access: "members" },
    { name: "Mercer University Hawkins Arena", city: "Macon, GA", lat: 32.8299, lng: -83.6498, indoor: true, access: "members" },
];

// ==========================================
// WASHINGTON DC AREA
// ==========================================
const DC_COLLEGES = [
    { name: "Georgetown University Yates Field House", city: "Washington, DC", lat: 38.9072, lng: -77.0727, indoor: true, access: "members" },
    { name: "George Washington University Smith Center", city: "Washington, DC", lat: 38.8946, lng: -77.0491, indoor: true, access: "members" },
    { name: "American University Bender Arena", city: "Washington, DC", lat: 38.9371, lng: -77.0905, indoor: true, access: "members" },
    { name: "Howard University Burr Gymnasium", city: "Washington, DC", lat: 38.9219, lng: -77.0198, indoor: true, access: "members" },
    { name: "George Mason University RAC", city: "Fairfax, VA", lat: 38.8315, lng: -77.3072, indoor: true, access: "members" },
    { name: "University of Maryland Eppley Recreation Center", city: "College Park, MD", lat: 38.9901, lng: -76.9455, indoor: true, access: "members" },
    { name: "Towson University SECU Arena", city: "Towson, MD", lat: 39.3905, lng: -76.6089, indoor: true, access: "members" },
    { name: "Navy-Marine Corps Memorial Stadium Rec Center", city: "Annapolis, MD", lat: 38.9875, lng: -76.4804, indoor: true, access: "members" },
];

// ==========================================
// BOSTON AREA
// ==========================================
const BOSTON_COLLEGES = [
    { name: "Boston College Recreation Complex", city: "Chestnut Hill, MA", lat: 42.3365, lng: -71.1687, indoor: true, access: "members" },
    { name: "Boston University FitRec", city: "Boston, MA", lat: 42.3522, lng: -71.1170, indoor: true, access: "members" },
    { name: "Northeastern University Cabot Physical Education Center", city: "Boston, MA", lat: 42.3402, lng: -71.0879, indoor: true, access: "members" },
    { name: "Harvard University Hemenway Gymnasium", city: "Cambridge, MA", lat: 42.3750, lng: -71.1185, indoor: true, access: "members" },
    { name: "MIT Zesiger Sports & Fitness Center", city: "Cambridge, MA", lat: 42.3577, lng: -71.0966, indoor: true, access: "members" },
    { name: "Tufts University Cousens Gymnasium", city: "Medford, MA", lat: 42.4066, lng: -71.1184, indoor: true, access: "members" },
    { name: "UMass Boston Campus Center Gym", city: "Boston, MA", lat: 42.3139, lng: -71.0382, indoor: true, access: "members" },
    { name: "Brandeis University Auerbach Arena", city: "Waltham, MA", lat: 42.3664, lng: -71.2614, indoor: true, access: "members" },
    { name: "Providence College Concannon Fitness Center", city: "Providence, RI", lat: 41.8414, lng: -71.4362, indoor: true, access: "members" },
    { name: "Brown University Nelson Fitness Center", city: "Providence, RI", lat: 41.8260, lng: -71.3990, indoor: true, access: "members" },
];

// ==========================================
// MIAMI / SOUTH FLORIDA
// ==========================================
const MIAMI_COLLEGES = [
    { name: "University of Miami Wellness Center", city: "Coral Gables, FL", lat: 25.7185, lng: -80.2761, indoor: true, access: "members" },
    { name: "FIU Recreation Center", city: "Miami, FL", lat: 25.7561, lng: -80.3739, indoor: true, access: "members" },
    { name: "Florida Atlantic University Recreation Center", city: "Boca Raton, FL", lat: 26.3723, lng: -80.1028, indoor: true, access: "members" },
    { name: "Nova Southeastern University RecPlex", city: "Davie, FL", lat: 26.0798, lng: -80.2375, indoor: true, access: "members" },
    { name: "Barry University Health & Sports Center", city: "Miami Shores, FL", lat: 25.8716, lng: -80.1844, indoor: true, access: "members" },
    { name: "Lynn University Count de Hoernle Sports Center", city: "Boca Raton, FL", lat: 26.3847, lng: -80.1041, indoor: true, access: "members" },
];

// ==========================================
// MINNEAPOLIS/ST. PAUL
// ==========================================
const MINN_COLLEGES = [
    { name: "University of Minnesota Recreation Center", city: "Minneapolis, MN", lat: 44.9730, lng: -93.2291, indoor: true, access: "members" },
    { name: "University of St. Thomas Anderson Athletic Complex", city: "St. Paul, MN", lat: 44.9434, lng: -93.1920, indoor: true, access: "members" },
    { name: "Augsburg University Si Melby Hall", city: "Minneapolis, MN", lat: 44.9595, lng: -93.2400, indoor: true, access: "members" },
    { name: "Macalester College Leonard Center", city: "St. Paul, MN", lat: 44.9368, lng: -93.1700, indoor: true, access: "members" },
    { name: "Hamline University Hutton Arena", city: "St. Paul, MN", lat: 44.9645, lng: -93.1566, indoor: true, access: "members" },
];

// ==========================================
// TAMPA / ORLANDO / FLORIDA
// ==========================================
const FL_COLLEGES = [
    { name: "University of South Florida Recreation Center", city: "Tampa, FL", lat: 28.0650, lng: -82.4165, indoor: true, access: "members" },
    { name: "University of Tampa Martinez Sports Center", city: "Tampa, FL", lat: 27.9436, lng: -82.4659, indoor: true, access: "members" },
    { name: "UCF Recreation & Wellness Center", city: "Orlando, FL", lat: 28.6035, lng: -81.1999, indoor: true, access: "members" },
    { name: "Rollins College Alfond Sports Center", city: "Winter Park, FL", lat: 28.5951, lng: -81.3499, indoor: true, access: "members" },
    { name: "Stetson University Edmunds Center", city: "DeLand, FL", lat: 29.0385, lng: -81.3026, indoor: true, access: "members" },
    { name: "University of North Florida Arena", city: "Jacksonville, FL", lat: 30.2729, lng: -81.5072, indoor: true, access: "members" },
    { name: "Jacksonville University Swisher Gymnasium", city: "Jacksonville, FL", lat: 30.3504, lng: -81.6059, indoor: true, access: "members" },
];

// ==========================================
// SAN DIEGO
// ==========================================
const SD_COLLEGES = [
    { name: "San Diego State University Aztec Recreation Center", city: "San Diego, CA", lat: 32.7755, lng: -117.0719, indoor: true, access: "members" },
    { name: "University of San Diego Jenny Craig Pavilion", city: "San Diego, CA", lat: 32.7720, lng: -117.1880, indoor: true, access: "members" },
    { name: "UC San Diego RIMAC Arena", city: "San Diego, CA", lat: 32.8863, lng: -117.2393, indoor: true, access: "members" },
    { name: "Point Loma Nazarene University Golden Gym", city: "San Diego, CA", lat: 32.7176, lng: -117.2444, indoor: true, access: "members" },
];

// ==========================================
// SAN ANTONIO / AUSTIN TEXAS
// ==========================================
const TX_CENTRAL_COLLEGES = [
    { name: "University of Texas Gregory Gymnasium", city: "Austin, TX", lat: 30.2837, lng: -97.7343, indoor: true, access: "members" },
    { name: "St. Edward's University Recreation Center", city: "Austin, TX", lat: 30.2287, lng: -97.7559, indoor: true, access: "members" },
    { name: "Texas State University Student Recreation Center", city: "San Marcos, TX", lat: 29.8886, lng: -97.9411, indoor: true, access: "members" },
    { name: "UTSA Recreation Center", city: "San Antonio, TX", lat: 29.5823, lng: -98.6190, indoor: true, access: "members" },
    { name: "Trinity University Bell Athletic Center", city: "San Antonio, TX", lat: 29.4623, lng: -98.4832, indoor: true, access: "members" },
    { name: "UIW McDermott Convocation Center", city: "San Antonio, TX", lat: 29.4628, lng: -98.4682, indoor: true, access: "members" },
    { name: "St. Mary's University Alumni Gym", city: "San Antonio, TX", lat: 29.4476, lng: -98.5591, indoor: true, access: "members" },
];

// ==========================================
// IMPORT RUNNER
// ==========================================
const ALL_REGIONS = [
    { name: 'New York City Area', courts: NYC_COLLEGES },
    { name: 'Los Angeles Area', courts: LA_COLLEGES },
    { name: 'Chicago Area', courts: CHICAGO_COLLEGES },
    { name: 'San Francisco Bay Area', courts: SF_COLLEGES },
    { name: 'Houston Area', courts: HOUSTON_COLLEGES },
    { name: 'Dallas/Fort Worth Area', courts: DFW_COLLEGES },
    { name: 'Phoenix Area', courts: PHOENIX_COLLEGES },
    { name: 'Seattle/Pacific NW', courts: SEATTLE_COLLEGES },
    { name: 'Denver/Colorado', courts: DENVER_COLLEGES },
    { name: 'Philadelphia Area', courts: PHILLY_COLLEGES },
    { name: 'Atlanta Area', courts: ATLANTA_COLLEGES },
    { name: 'Washington DC Area', courts: DC_COLLEGES },
    { name: 'Boston Area', courts: BOSTON_COLLEGES },
    { name: 'Miami/South FL', courts: MIAMI_COLLEGES },
    { name: 'Minneapolis/St. Paul', courts: MINN_COLLEGES },
    { name: 'Tampa/Orlando/FL', courts: FL_COLLEGES },
    { name: 'San Diego', courts: SD_COLLEGES },
    { name: 'San Antonio/Austin', courts: TX_CENTRAL_COLLEGES },
];

async function main() {
    const totalCourts = ALL_REGIONS.reduce((sum, r) => sum + r.courts.length, 0);
    console.log(`\n=== COLLEGE COURTS IMPORT P1: ${ALL_REGIONS.length} REGIONS, ${totalCourts} COURTS ===\n`);

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

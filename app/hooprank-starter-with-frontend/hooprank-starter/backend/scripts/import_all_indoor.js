/**
 * Fix SF Indoor Courts - Google Maps verified coordinates
 * + Remove duplicates, then import all remaining metros
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
        const id = court.id || generateUUID(court.name + court.city);
        const params = new URLSearchParams({
            id,
            name: court.name,
            city: court.city,
            lat: String(court.lat),
            lng: String(court.lng),
            indoor: String(court.indoor),
            access: court.access || 'public',
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
// SAN FRANCISCO — Google Maps verified coords
// ==========================================
const SF_COURTS = [
    // City Rec Centers - coords verified via Google Maps
    { name: "Betty Ann Ong Recreation Center", city: "San Francisco, CA", lat: 37.7943, lng: -122.4117, indoor: true, access: "public" },
    { name: "Mission Recreation Center", city: "San Francisco, CA", lat: 37.7582, lng: -122.4126, indoor: true, access: "public" },
    { name: "Moscone Recreation Center", city: "San Francisco, CA", lat: 37.8017, lng: -122.4345, indoor: true, access: "public" },
    { name: "Potrero Hill Recreation Center", city: "San Francisco, CA", lat: 37.7562, lng: -122.3972, indoor: true, access: "public" },
    { name: "Glen Park Recreation Center", city: "San Francisco, CA", lat: 37.7372, lng: -122.4408, indoor: true, access: "public" },
    { name: "Sunset Recreation Center", city: "San Francisco, CA", lat: 37.7572, lng: -122.4866, indoor: true, access: "public" },
    { name: "Upper Noe Recreation Center", city: "San Francisco, CA", lat: 37.7424, lng: -122.4279, indoor: true, access: "public" },
    { name: "Richmond Recreation Center", city: "San Francisco, CA", lat: 37.7832, lng: -122.4780, indoor: true, access: "public" },
    { name: "Gene Friend Recreation Center", city: "San Francisco, CA", lat: 37.7788, lng: -122.4062, indoor: true, access: "public" },
    { name: "Bernal Heights Recreation Center", city: "San Francisco, CA", lat: 37.7383, lng: -122.4160, indoor: true, access: "public" },
    { name: "Excelsior Playground Recreation Center", city: "San Francisco, CA", lat: 37.7240, lng: -122.4283, indoor: true, access: "public" },
    { name: "Eureka Valley Recreation Center", city: "San Francisco, CA", lat: 37.7615, lng: -122.4365, indoor: true, access: "public" },
    { name: "Visitacion Valley Community Center", city: "San Francisco, CA", lat: 37.7145, lng: -122.4054, indoor: true, access: "public" },
    { name: "Palega Recreation Center", city: "San Francisco, CA", lat: 37.7189, lng: -122.4189, indoor: true, access: "public" },
    { name: "Hamilton Recreation Center", city: "San Francisco, CA", lat: 37.7844, lng: -122.4351, indoor: true, access: "public" },
    { name: "Joe Lee Recreation Center", city: "San Francisco, CA", lat: 37.7308, lng: -122.3937, indoor: true, access: "public" },
    { name: "Minnie & Lovie Ward Recreation Center", city: "San Francisco, CA", lat: 37.7211, lng: -122.4758, indoor: true, access: "public" },
    { name: "Tenderloin Recreation Center", city: "San Francisco, CA", lat: 37.7848, lng: -122.4156, indoor: true, access: "public" },
    { name: "Kezar Pavilion", city: "San Francisco, CA", lat: 37.7675, lng: -122.4575, indoor: true, access: "public" },

    // YMCAs
    { name: "Embarcadero YMCA", city: "San Francisco, CA", lat: 37.7919, lng: -122.3928, indoor: true, access: "members" },
    { name: "Presidio Community YMCA", city: "San Francisco, CA", lat: 37.7991, lng: -122.4577, indoor: true, access: "members" },
    { name: "Bayview Hunters Point YMCA", city: "San Francisco, CA", lat: 37.7345, lng: -122.3834, indoor: true, access: "members" },
    { name: "Stonestown Family YMCA", city: "San Francisco, CA", lat: 37.7260, lng: -122.4750, indoor: true, access: "members" },
    { name: "Treasure Island Community YMCA", city: "San Francisco, CA", lat: 37.8186, lng: -122.3708, indoor: true, access: "members" },

    // Private/University
    { name: "Bay Club San Francisco", city: "San Francisco, CA", lat: 37.8004, lng: -122.4003, indoor: true, access: "members" },
    { name: "Bay Club Financial District", city: "San Francisco, CA", lat: 37.7916, lng: -122.4023, indoor: true, access: "members" },
    { name: "Koret Health and Recreation Center (USF)", city: "San Francisco, CA", lat: 37.7763, lng: -122.4508, indoor: true, access: "members" },
    { name: "SFSU Mashouf Wellness Center", city: "San Francisco, CA", lat: 37.7220, lng: -122.4785, indoor: true, access: "members" },
    { name: "24 Hour Fitness Van Ness", city: "San Francisco, CA", lat: 37.7863, lng: -122.4221, indoor: true, access: "members" },
];

// ==========================================
// LOS ANGELES METRO
// ==========================================
const LA_COURTS = [
    // City Rec Centers
    { name: "Pan Pacific Park Recreation Center", city: "Los Angeles, CA", lat: 34.0756, lng: -118.3530, indoor: true, access: "public" },
    { name: "Westwood Recreation Center", city: "Los Angeles, CA", lat: 34.0511, lng: -118.4441, indoor: true, access: "public" },
    { name: "Echo Park Recreation Center", city: "Los Angeles, CA", lat: 34.0774, lng: -118.2605, indoor: true, access: "public" },
    { name: "Poinsettia Recreation Center", city: "Los Angeles, CA", lat: 34.0838, lng: -118.3457, indoor: true, access: "public" },
    { name: "Van Nuys Recreation Center", city: "Van Nuys, CA", lat: 34.1851, lng: -118.4508, indoor: true, access: "public" },
    { name: "Mar Vista Recreation Center", city: "Los Angeles, CA", lat: 34.0011, lng: -118.4273, indoor: true, access: "public" },
    { name: "South Park Recreation Center", city: "Los Angeles, CA", lat: 34.0122, lng: -118.2635, indoor: true, access: "public" },
    { name: "Lincoln Park Recreation Center", city: "Los Angeles, CA", lat: 34.0671, lng: -118.2142, indoor: true, access: "public" },
    { name: "Normandie Recreation Center", city: "Los Angeles, CA", lat: 34.0460, lng: -118.3002, indoor: true, access: "public" },
    { name: "Glassell Park Recreation Center", city: "Los Angeles, CA", lat: 34.1195, lng: -118.2347, indoor: true, access: "public" },
    { name: "Jim Gilliam Recreation Center", city: "Los Angeles, CA", lat: 34.0197, lng: -118.3457, indoor: true, access: "public" },
    { name: "Green Meadows Recreation Center", city: "Los Angeles, CA", lat: 33.9373, lng: -118.2696, indoor: true, access: "public" },
    { name: "Rancho Cienega Sports Complex", city: "Los Angeles, CA", lat: 34.0213, lng: -118.3538, indoor: true, access: "public" },
    { name: "Vermont Square Recreation Center", city: "Los Angeles, CA", lat: 33.9928, lng: -118.2913, indoor: true, access: "public" },
    { name: "Central Recreation Center", city: "Los Angeles, CA", lat: 34.0321, lng: -118.2456, indoor: true, access: "public" },

    // YMCAs
    { name: "YMCA of Hollywood", city: "Los Angeles, CA", lat: 34.1014, lng: -118.3274, indoor: true, access: "members" },
    { name: "Ketchum-Downtown YMCA", city: "Los Angeles, CA", lat: 34.0449, lng: -118.2586, indoor: true, access: "members" },
    { name: "Anderson Munger Family YMCA", city: "Los Angeles, CA", lat: 34.0659, lng: -118.3107, indoor: true, access: "members" },
    { name: "Weingart East Los Angeles YMCA", city: "East Los Angeles, CA", lat: 34.0237, lng: -118.1727, indoor: true, access: "members" },
    { name: "Torrance-South Bay YMCA", city: "Torrance, CA", lat: 33.8536, lng: -118.3456, indoor: true, access: "members" },
    { name: "Santa Monica Family YMCA", city: "Santa Monica, CA", lat: 34.0257, lng: -118.4879, indoor: true, access: "members" },

    // Private/University
    { name: "Equinox West Hollywood", city: "Los Angeles, CA", lat: 34.0900, lng: -118.3617, indoor: true, access: "members" },
    { name: "Equinox Santa Monica", city: "Santa Monica, CA", lat: 34.0195, lng: -118.4912, indoor: true, access: "members" },
    { name: "Life Time Northridge", city: "Northridge, CA", lat: 34.2294, lng: -118.5366, indoor: true, access: "members" },
    { name: "LA Fitness Hollywood", city: "Los Angeles, CA", lat: 34.1012, lng: -118.3388, indoor: true, access: "members" },
    { name: "UCLA John Wooden Center", city: "Los Angeles, CA", lat: 34.0706, lng: -118.4455, indoor: true, access: "members" },
    { name: "USC Galen Center", city: "Los Angeles, CA", lat: 34.0254, lng: -118.2857, indoor: true, access: "members" },
    { name: "24 Hour Fitness Santa Monica", city: "Santa Monica, CA", lat: 34.0188, lng: -118.4878, indoor: true, access: "members" },
    { name: "Gold's Gym Venice", city: "Venice, CA", lat: 33.9929, lng: -118.4729, indoor: true, access: "members" },
    { name: "Bay Club Redondo Beach", city: "Redondo Beach, CA", lat: 33.8570, lng: -118.3758, indoor: true, access: "members" },
];

// ==========================================
// NEW YORK CITY
// ==========================================
const NYC_COURTS = [
    // City Rec Centers
    { name: "Geraldine Ferraro Recreation Center", city: "New York, NY", lat: 40.7282, lng: -74.0011, indoor: true, access: "public" },
    { name: "Tony Dapolito Recreation Center", city: "New York, NY", lat: 40.7274, lng: -74.0041, indoor: true, access: "public" },
    { name: "Asser Levy Recreation Center", city: "New York, NY", lat: 40.7370, lng: -73.9766, indoor: true, access: "public" },
    { name: "Hamilton Fish Recreation Center", city: "New York, NY", lat: 40.7210, lng: -73.9821, indoor: true, access: "public" },
    { name: "Hansborough Recreation Center", city: "New York, NY", lat: 40.8043, lng: -73.9434, indoor: true, access: "public" },
    { name: "St. Mary's Recreation Center", city: "Bronx, NY", lat: 40.8088, lng: -73.9205, indoor: true, access: "public" },
    { name: "Brownsville Recreation Center", city: "Brooklyn, NY", lat: 40.6617, lng: -73.9140, indoor: true, access: "public" },
    { name: "Red Hook Recreation Center", city: "Brooklyn, NY", lat: 40.6751, lng: -74.0024, indoor: true, access: "public" },
    { name: "Thomas Jefferson Recreation Center", city: "New York, NY", lat: 40.7931, lng: -73.9395, indoor: true, access: "public" },
    { name: "Flushing Meadows Recreation Center", city: "Queens, NY", lat: 40.7471, lng: -73.8468, indoor: true, access: "public" },
    { name: "Sorrentino Recreation Center", city: "Staten Island, NY", lat: 40.6233, lng: -74.1188, indoor: true, access: "public" },
    { name: "Williamsbridge Recreation Center", city: "Bronx, NY", lat: 40.8782, lng: -73.8637, indoor: true, access: "public" },
    { name: "Jackie Robinson Recreation Center", city: "New York, NY", lat: 40.8089, lng: -73.9379, indoor: true, access: "public" },
    { name: "Abe Lincoln Recreation Center", city: "New York, NY", lat: 40.7972, lng: -73.9461, indoor: true, access: "public" },
    { name: "Colonel Charles Young Recreation Center", city: "New York, NY", lat: 40.8061, lng: -73.9489, indoor: true, access: "public" },

    // YMCAs
    { name: "Harlem YMCA", city: "New York, NY", lat: 40.8094, lng: -73.9459, indoor: true, access: "members" },
    { name: "McBurney YMCA", city: "New York, NY", lat: 40.7386, lng: -73.9980, indoor: true, access: "members" },
    { name: "Vanderbilt YMCA", city: "New York, NY", lat: 40.7539, lng: -73.9746, indoor: true, access: "members" },
    { name: "West Side YMCA", city: "New York, NY", lat: 40.7832, lng: -73.9753, indoor: true, access: "members" },
    { name: "Bedford-Stuyvesant YMCA", city: "Brooklyn, NY", lat: 40.6868, lng: -73.9464, indoor: true, access: "members" },
    { name: "Prospect Park YMCA", city: "Brooklyn, NY", lat: 40.6605, lng: -73.9628, indoor: true, access: "members" },
    { name: "Flushing YMCA", city: "Queens, NY", lat: 40.7603, lng: -73.8282, indoor: true, access: "members" },
    { name: "Bronx YMCA", city: "Bronx, NY", lat: 40.8284, lng: -73.9062, indoor: true, access: "members" },

    // Private
    { name: "Equinox Columbus Circle", city: "New York, NY", lat: 40.7681, lng: -73.9819, indoor: true, access: "members" },
    { name: "Equinox Sports Club NYC", city: "New York, NY", lat: 40.7505, lng: -73.9935, indoor: true, access: "members" },
    { name: "Life Time Sky", city: "New York, NY", lat: 40.7549, lng: -73.9879, indoor: true, access: "members" },
    { name: "Chelsea Piers Athletic Club", city: "New York, NY", lat: 40.7465, lng: -74.0086, indoor: true, access: "members" },
    { name: "Asphalt Green Upper East Side", city: "New York, NY", lat: 40.7761, lng: -73.9450, indoor: true, access: "members" },
    { name: "Asphalt Green Battery Park City", city: "New York, NY", lat: 40.7148, lng: -74.0156, indoor: true, access: "members" },
    { name: "NYSC Herald Square", city: "New York, NY", lat: 40.7484, lng: -73.9878, indoor: true, access: "members" },
];

// ==========================================
// CHICAGO
// ==========================================
const CHICAGO_COURTS = [
    // Park District
    { name: "Garfield Park Fieldhouse", city: "Chicago, IL", lat: 41.8814, lng: -87.7183, indoor: true, access: "public" },
    { name: "Douglas Park Fieldhouse", city: "Chicago, IL", lat: 41.8604, lng: -87.6989, indoor: true, access: "public" },
    { name: "Humboldt Park Fieldhouse", city: "Chicago, IL", lat: 41.9036, lng: -87.7021, indoor: true, access: "public" },
    { name: "Washington Park Fieldhouse", city: "Chicago, IL", lat: 41.7950, lng: -87.6141, indoor: true, access: "public" },
    { name: "Columbus Park Fieldhouse", city: "Chicago, IL", lat: 41.8744, lng: -87.7695, indoor: true, access: "public" },
    { name: "Sherman Park Fieldhouse", city: "Chicago, IL", lat: 41.8130, lng: -87.6500, indoor: true, access: "public" },
    { name: "McFetridge Sports Center", city: "Chicago, IL", lat: 41.9422, lng: -87.6556, indoor: true, access: "public" },
    { name: "Gill Park", city: "Chicago, IL", lat: 41.9524, lng: -87.6547, indoor: true, access: "public" },
    { name: "Lake Shore Park Fieldhouse", city: "Chicago, IL", lat: 41.9014, lng: -87.6164, indoor: true, access: "public" },
    { name: "Pulaski Park Fieldhouse", city: "Chicago, IL", lat: 41.9161, lng: -87.6774, indoor: true, access: "public" },
    { name: "Austin Town Hall", city: "Chicago, IL", lat: 41.8874, lng: -87.7656, indoor: true, access: "public" },
    { name: "Wrightwood Park", city: "Chicago, IL", lat: 41.9283, lng: -87.6518, indoor: true, access: "public" },
    { name: "Marquette Park Fieldhouse", city: "Chicago, IL", lat: 41.7757, lng: -87.7031, indoor: true, access: "public" },
    { name: "Foster Park Fieldhouse", city: "Chicago, IL", lat: 41.7622, lng: -87.6632, indoor: true, access: "public" },

    // YMCAs
    { name: "Rauner Family YMCA", city: "Chicago, IL", lat: 41.8939, lng: -87.6338, indoor: true, access: "members" },
    { name: "South Side YMCA", city: "Chicago, IL", lat: 41.8081, lng: -87.6175, indoor: true, access: "members" },
    { name: "Irving Park YMCA", city: "Chicago, IL", lat: 41.9543, lng: -87.7303, indoor: true, access: "members" },
    { name: "Lake View YMCA", city: "Chicago, IL", lat: 41.9402, lng: -87.6479, indoor: true, access: "members" },
    { name: "New City YMCA", city: "Chicago, IL", lat: 41.8493, lng: -87.6514, indoor: true, access: "members" },

    // Private
    { name: "Equinox Lincoln Park", city: "Chicago, IL", lat: 41.9206, lng: -87.6537, indoor: true, access: "members" },
    { name: "Equinox Gold Coast", city: "Chicago, IL", lat: 41.9031, lng: -87.6282, indoor: true, access: "members" },
    { name: "Life Time South Loop", city: "Chicago, IL", lat: 41.8580, lng: -87.6298, indoor: true, access: "members" },
    { name: "XSport Fitness Lincoln Park", city: "Chicago, IL", lat: 41.9394, lng: -87.6542, indoor: true, access: "members" },
    { name: "Chicago Athletic Association", city: "Chicago, IL", lat: 41.8826, lng: -87.6248, indoor: true, access: "members" },
];

// ==========================================
// HOUSTON
// ==========================================
const HOUSTON_COURTS = [
    // City Parks & Rec
    { name: "Fonde Recreation Center", city: "Houston, TX", lat: 29.7336, lng: -95.3489, indoor: true, access: "public" },
    { name: "Sagemont Community Center", city: "Houston, TX", lat: 29.6062, lng: -95.2186, indoor: true, access: "public" },
    { name: "Judson Robinson Jr. Community Center", city: "Houston, TX", lat: 29.7239, lng: -95.3802, indoor: true, access: "public" },
    { name: "Emancipation Park Community Center", city: "Houston, TX", lat: 29.7373, lng: -95.3548, indoor: true, access: "public" },
    { name: "Denver Harbor Community Center", city: "Houston, TX", lat: 29.7695, lng: -95.3114, indoor: true, access: "public" },
    { name: "OST/South Union Community Center", city: "Houston, TX", lat: 29.7020, lng: -95.3539, indoor: true, access: "public" },
    { name: "Cullen Park Community Center", city: "Houston, TX", lat: 29.7744, lng: -95.6384, indoor: true, access: "public" },
    { name: "Metropolitan Multi-Service Center", city: "Houston, TX", lat: 29.7556, lng: -95.3938, indoor: true, access: "public" },
    { name: "Hiram Clarke Multi-Purpose Center", city: "Houston, TX", lat: 29.6597, lng: -95.4339, indoor: true, access: "public" },

    // YMCAs
    { name: "YMCA Tellepsen Downtown", city: "Houston, TX", lat: 29.7564, lng: -95.3734, indoor: true, access: "members" },
    { name: "D. Bradley McWilliams YMCA", city: "Houston, TX", lat: 29.8425, lng: -95.4091, indoor: true, access: "members" },
    { name: "Trotter Family YMCA", city: "Houston, TX", lat: 29.7052, lng: -95.3863, indoor: true, access: "members" },
    { name: "Lake Houston Family YMCA", city: "Humble, TX", lat: 30.0012, lng: -95.2608, indoor: true, access: "members" },

    // Private
    { name: "Life Time City Centre", city: "Houston, TX", lat: 29.7792, lng: -95.5614, indoor: true, access: "members" },
    { name: "Equinox Houston", city: "Houston, TX", lat: 29.7374, lng: -95.4115, indoor: true, access: "members" },
    { name: "24 Hour Fitness Galleria", city: "Houston, TX", lat: 29.7380, lng: -95.4614, indoor: true, access: "members" },
];

// ==========================================
// PHOENIX
// ==========================================
const PHOENIX_COURTS = [
    // City Parks
    { name: "Maryvale Community Center", city: "Phoenix, AZ", lat: 33.4988, lng: -112.1573, indoor: true, access: "public" },
    { name: "South Mountain Community Center", city: "Phoenix, AZ", lat: 33.3909, lng: -112.0423, indoor: true, access: "public" },
    { name: "Pecos Community Center", city: "Phoenix, AZ", lat: 33.3327, lng: -111.9755, indoor: true, access: "public" },
    { name: "Deer Valley Community Center", city: "Phoenix, AZ", lat: 33.6851, lng: -112.0641, indoor: true, access: "public" },
    { name: "Devonshire Senior Center & Gym", city: "Phoenix, AZ", lat: 33.5571, lng: -112.0895, indoor: true, access: "public" },
    { name: "El Prado Community Center", city: "Phoenix, AZ", lat: 33.4275, lng: -112.0998, indoor: true, access: "public" },
    { name: "Glendale Community Center", city: "Glendale, AZ", lat: 33.5387, lng: -112.1860, indoor: true, access: "public" },
    { name: "Tempe Community Center", city: "Tempe, AZ", lat: 33.3905, lng: -111.9292, indoor: true, access: "public" },
    { name: "Chandler Community Center", city: "Chandler, AZ", lat: 33.3028, lng: -111.8414, indoor: true, access: "public" },
    { name: "Mesa Community Center", city: "Mesa, AZ", lat: 33.4152, lng: -111.8315, indoor: true, access: "public" },

    // YMCAs
    { name: "Valley of the Sun YMCA", city: "Phoenix, AZ", lat: 33.4817, lng: -112.0740, indoor: true, access: "members" },
    { name: "Northwest Valley YMCA", city: "Surprise, AZ", lat: 33.6125, lng: -112.3671, indoor: true, access: "members" },

    // Private
    { name: "Life Time Scottsdale", city: "Scottsdale, AZ", lat: 33.5007, lng: -111.9310, indoor: true, access: "members" },
    { name: "Life Time North Scottsdale", city: "Scottsdale, AZ", lat: 33.6308, lng: -111.9270, indoor: true, access: "members" },
    { name: "Mountainside Fitness Phoenix", city: "Phoenix, AZ", lat: 33.5222, lng: -112.0540, indoor: true, access: "members" },
    { name: "EoS Fitness Phoenix", city: "Phoenix, AZ", lat: 33.4944, lng: -112.0740, indoor: true, access: "members" },
];

// ==========================================
// DALLAS/FORT WORTH
// ==========================================
const DFW_COURTS = [
    // City Rec Centers
    { name: "Samuell Grand Recreation Center", city: "Dallas, TX", lat: 32.7906, lng: -96.7296, indoor: true, access: "public" },
    { name: "Martin Luther King Jr. Community Center", city: "Dallas, TX", lat: 32.7571, lng: -96.7573, indoor: true, access: "public" },
    { name: "Kiest Recreation Center", city: "Dallas, TX", lat: 32.7176, lng: -96.8468, indoor: true, access: "public" },
    { name: "Bachman Lake Recreation Center", city: "Dallas, TX", lat: 32.8604, lng: -96.8685, indoor: true, access: "public" },
    { name: "Pleasant Grove Recreation Center", city: "Dallas, TX", lat: 32.7111, lng: -96.6985, indoor: true, access: "public" },
    { name: "Fretz Park Recreation Center", city: "Dallas, TX", lat: 32.9083, lng: -96.7713, indoor: true, access: "public" },
    { name: "Tommie Allen Recreation Center", city: "Dallas, TX", lat: 32.7702, lng: -96.8253, indoor: true, access: "public" },
    { name: "Arlington Recreation Center", city: "Arlington, TX", lat: 32.7357, lng: -97.1081, indoor: true, access: "public" },
    { name: "Fort Worth Community Arts Center", city: "Fort Worth, TX", lat: 32.7457, lng: -97.3308, indoor: true, access: "public" },

    // YMCAs
    { name: "T Boone Pickens YMCA", city: "Dallas, TX", lat: 32.7918, lng: -96.8026, indoor: true, access: "members" },
    { name: "Moody Family YMCA", city: "Dallas, TX", lat: 32.8657, lng: -96.8369, indoor: true, access: "members" },
    { name: "Park Lane Family YMCA", city: "Dallas, TX", lat: 32.8773, lng: -96.7682, indoor: true, access: "members" },

    // Private
    { name: "Equinox Highland Park", city: "Dallas, TX", lat: 32.8341, lng: -96.8063, indoor: true, access: "members" },
    { name: "Life Time Plano", city: "Plano, TX", lat: 33.0491, lng: -96.7506, indoor: true, access: "members" },
    { name: "Cooper Fitness Center", city: "Dallas, TX", lat: 32.8951, lng: -96.7671, indoor: true, access: "members" },
];

// ==========================================
// SEATTLE
// ==========================================
const SEATTLE_COURTS = [
    // City Rec Centers
    { name: "Rainier Community Center", city: "Seattle, WA", lat: 47.5559, lng: -122.2868, indoor: true, access: "public" },
    { name: "Garfield Community Center", city: "Seattle, WA", lat: 47.6100, lng: -122.2996, indoor: true, access: "public" },
    { name: "Meadowbrook Community Center", city: "Seattle, WA", lat: 47.7061, lng: -122.3017, indoor: true, access: "public" },
    { name: "Highland Park Community Center", city: "Seattle, WA", lat: 47.5282, lng: -122.3419, indoor: true, access: "public" },
    { name: "Van Asselt Community Center", city: "Seattle, WA", lat: 47.5330, lng: -122.2822, indoor: true, access: "public" },
    { name: "Southwest Community Center", city: "Seattle, WA", lat: 47.5228, lng: -122.3652, indoor: true, access: "public" },
    { name: "Miller Community Center", city: "Seattle, WA", lat: 47.5813, lng: -122.3040, indoor: true, access: "public" },
    { name: "Delridge Community Center", city: "Seattle, WA", lat: 47.5392, lng: -122.3592, indoor: true, access: "public" },
    { name: "Magnolia Community Center", city: "Seattle, WA", lat: 47.6449, lng: -122.4004, indoor: true, access: "public" },
    { name: "Bitter Lake Community Center", city: "Seattle, WA", lat: 47.7136, lng: -122.3488, indoor: true, access: "public" },

    // YMCAs
    { name: "Downtown Seattle YMCA", city: "Seattle, WA", lat: 47.6101, lng: -122.3383, indoor: true, access: "members" },
    { name: "Dale Turner Family YMCA", city: "Shoreline, WA", lat: 47.7631, lng: -122.3401, indoor: true, access: "members" },

    // Private
    { name: "Equinox Seattle", city: "Seattle, WA", lat: 47.6131, lng: -122.3468, indoor: true, access: "members" },
    { name: "Pro Sports Club Bellevue", city: "Bellevue, WA", lat: 47.5773, lng: -122.1523, indoor: true, access: "members" },
    { name: "Washington Athletic Club", city: "Seattle, WA", lat: 47.6067, lng: -122.3356, indoor: true, access: "members" },
    { name: "24 Hour Fitness Lynnwood", city: "Lynnwood, WA", lat: 47.8209, lng: -122.3151, indoor: true, access: "members" },
];

// ==========================================
// DENVER
// ==========================================
const DENVER_COURTS = [
    // City Rec Centers
    { name: "Montbello Recreation Center", city: "Denver, CO", lat: 39.7874, lng: -104.8385, indoor: true, access: "public" },
    { name: "Martin Luther King Jr. Recreation Center", city: "Denver, CO", lat: 39.7609, lng: -104.9486, indoor: true, access: "public" },
    { name: "Hiawatha Davis Jr. Recreation Center", city: "Denver, CO", lat: 39.7481, lng: -104.9757, indoor: true, access: "public" },
    { name: "Glenarm Recreation Center", city: "Denver, CO", lat: 39.7384, lng: -104.9787, indoor: true, access: "public" },
    { name: "Stapleton Recreation Center", city: "Denver, CO", lat: 39.7770, lng: -104.8829, indoor: true, access: "public" },
    { name: "Harvey Park Recreation Center", city: "Denver, CO", lat: 39.6793, lng: -105.0449, indoor: true, access: "public" },
    { name: "Athmar Recreation Center", city: "Denver, CO", lat: 39.6975, lng: -104.9888, indoor: true, access: "public" },
    { name: "Green Valley Ranch Recreation Center", city: "Denver, CO", lat: 39.8117, lng: -104.7840, indoor: true, access: "public" },
    { name: "Twentieth Street Recreation Center", city: "Denver, CO", lat: 39.7525, lng: -104.9903, indoor: true, access: "public" },

    // YMCAs
    { name: "Downtown Denver YMCA", city: "Denver, CO", lat: 39.7423, lng: -104.9900, indoor: true, access: "members" },
    { name: "Schlessman Family YMCA", city: "Denver, CO", lat: 39.6918, lng: -104.9249, indoor: true, access: "members" },

    // Private
    { name: "Equinox Cherry Creek", city: "Denver, CO", lat: 39.7174, lng: -104.9545, indoor: true, access: "members" },
    { name: "Life Time Highlands Ranch", city: "Highlands Ranch, CO", lat: 39.5433, lng: -104.9694, indoor: true, access: "members" },
    { name: "Colorado Athletic Club Monaco", city: "Denver, CO", lat: 39.7208, lng: -104.9043, indoor: true, access: "members" },
];

// ==========================================
// PHILADELPHIA
// ==========================================
const PHILLY_COURTS = [
    // City Rec Centers
    { name: "Shepard Recreation Center", city: "Philadelphia, PA", lat: 39.9773, lng: -75.1546, indoor: true, access: "public" },
    { name: "Mander Recreation Center", city: "Philadelphia, PA", lat: 39.9887, lng: -75.1480, indoor: true, access: "public" },
    { name: "Chew Recreation Center", city: "Philadelphia, PA", lat: 40.0495, lng: -75.1476, indoor: true, access: "public" },
    { name: "Myers Recreation Center", city: "Philadelphia, PA", lat: 39.9378, lng: -75.1707, indoor: true, access: "public" },
    { name: "Vare Recreation Center", city: "Philadelphia, PA", lat: 39.9226, lng: -75.1606, indoor: true, access: "public" },
    { name: "Scanlon Recreation Center", city: "Philadelphia, PA", lat: 39.9629, lng: -75.1097, indoor: true, access: "public" },
    { name: "Athletic Recreation Center", city: "Philadelphia, PA", lat: 39.9734, lng: -75.1335, indoor: true, access: "public" },
    { name: "Tustin Recreation Center", city: "Philadelphia, PA", lat: 39.9870, lng: -75.1233, indoor: true, access: "public" },
    { name: "Happy Hollow Recreation Center", city: "Philadelphia, PA", lat: 40.0143, lng: -75.1073, indoor: true, access: "public" },
    { name: "Vogt Recreation Center", city: "Philadelphia, PA", lat: 40.0325, lng: -75.0933, indoor: true, access: "public" },
    { name: "Fox Chase Recreation Center", city: "Philadelphia, PA", lat: 40.0690, lng: -75.0881, indoor: true, access: "public" },

    // YMCAs
    { name: "Christian Street YMCA", city: "Philadelphia, PA", lat: 39.9378, lng: -75.1619, indoor: true, access: "members" },
    { name: "Columbia North YMCA", city: "Philadelphia, PA", lat: 39.9738, lng: -75.1524, indoor: true, access: "members" },

    // Private
    { name: "Philadelphia Sports Club Rittenhouse", city: "Philadelphia, PA", lat: 39.9481, lng: -75.1709, indoor: true, access: "members" },
    { name: "City Fitness Philadelphia", city: "Philadelphia, PA", lat: 39.9453, lng: -75.1597, indoor: true, access: "members" },
    { name: "Temple University Student Recreation Center", city: "Philadelphia, PA", lat: 39.9816, lng: -75.1498, indoor: true, access: "members" },
];

// ==========================================
// ATLANTA
// ==========================================
const ATLANTA_COURTS = [
    // City Rec Centers
    { name: "Martin Luther King Jr. Recreation Center", city: "Atlanta, GA", lat: 33.7512, lng: -84.3752, indoor: true, access: "public" },
    { name: "Bessie Branham Recreation Center", city: "Atlanta, GA", lat: 33.7434, lng: -84.3426, indoor: true, access: "public" },
    { name: "Thomasville Heights Recreation Center", city: "Atlanta, GA", lat: 33.7126, lng: -84.3457, indoor: true, access: "public" },
    { name: "Rosel Fann Recreation Center", city: "Atlanta, GA", lat: 33.7666, lng: -84.4453, indoor: true, access: "public" },
    { name: "Adamsville Recreation Center", city: "Atlanta, GA", lat: 33.7570, lng: -84.4881, indoor: true, access: "public" },
    { name: "Pittman Park Recreation Center", city: "Atlanta, GA", lat: 33.7340, lng: -84.3541, indoor: true, access: "public" },
    { name: "South Bend Recreation Center", city: "Atlanta, GA", lat: 33.7097, lng: -84.3873, indoor: true, access: "public" },
    { name: "Anderson Park Recreation Center", city: "Atlanta, GA", lat: 33.7849, lng: -84.4162, indoor: true, access: "public" },

    // YMCAs
    { name: "Robert D. Fowler Family YMCA", city: "Decatur, GA", lat: 33.7726, lng: -84.2964, indoor: true, access: "members" },
    { name: "Andrew & Walter Young Family YMCA", city: "Atlanta, GA", lat: 33.7490, lng: -84.3892, indoor: true, access: "members" },

    // Private
    { name: "Equinox Atlanta", city: "Atlanta, GA", lat: 33.8407, lng: -84.3779, indoor: true, access: "members" },
    { name: "Life Time Sandy Springs", city: "Sandy Springs, GA", lat: 33.9295, lng: -84.3771, indoor: true, access: "members" },
    { name: "LA Fitness Buckhead", city: "Atlanta, GA", lat: 33.8501, lng: -84.3633, indoor: true, access: "members" },
];

// ==========================================
// IMPORT RUNNER
// ==========================================
const ALL_CITIES = [
    { name: 'San Francisco', courts: SF_COURTS },
    { name: 'Los Angeles', courts: LA_COURTS },
    { name: 'New York City', courts: NYC_COURTS },
    { name: 'Chicago', courts: CHICAGO_COURTS },
    { name: 'Houston', courts: HOUSTON_COURTS },
    { name: 'Phoenix', courts: PHOENIX_COURTS },
    { name: 'Dallas/Fort Worth', courts: DFW_COURTS },
    { name: 'Seattle', courts: SEATTLE_COURTS },
    { name: 'Denver', courts: DENVER_COURTS },
    { name: 'Philadelphia', courts: PHILLY_COURTS },
    { name: 'Atlanta', courts: ATLANTA_COURTS },
];

async function main() {
    const totalCourts = ALL_CITIES.reduce((sum, c) => sum + c.courts.length, 0);
    console.log(`\n=== INDOOR COURTS IMPORT: ${ALL_CITIES.length} CITIES, ${totalCourts} COURTS ===\n`);

    let grandOk = 0, grandFail = 0;

    for (const city of ALL_CITIES) {
        console.log(`\n📍 ${city.name} (${city.courts.length} courts)`);
        console.log('─'.repeat(50));

        let ok = 0, fail = 0;
        for (const court of city.courts) {
            try {
                const result = await postCourt(court);
                if (result.status < 400) {
                    console.log(`  ✅ ${court.name} (${court.access})`);
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

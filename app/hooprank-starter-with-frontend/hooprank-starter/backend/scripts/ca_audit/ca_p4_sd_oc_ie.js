/**
 * CA Audit Part 4: San Diego, Orange County, Inland Empire Schools
 */
const { runImport } = require('../wa_audit/boilerplate');

const SAN_DIEGO_SCHOOLS = [
    { name: "Hoover High School Gym (SD)", city: "San Diego, CA", lat: 32.7380, lng: -117.1138, access: "members" },
    { name: "San Diego High School Gym", city: "San Diego, CA", lat: 32.7165, lng: -117.1446, access: "members" },
    { name: "Lincoln High School Gym (SD)", city: "San Diego, CA", lat: 32.6972, lng: -117.1012, access: "members" },
    { name: "Morse High School Gym", city: "San Diego, CA", lat: 32.7052, lng: -117.0543, access: "members" },
    { name: "Crawford High School Gym", city: "San Diego, CA", lat: 32.7551, lng: -117.0874, access: "members" },
    { name: "Clairemont High School Gym", city: "San Diego, CA", lat: 32.8296, lng: -117.1886, access: "members" },
    { name: "Kearny High School Gym", city: "San Diego, CA", lat: 32.7920, lng: -117.1387, access: "members" },
    { name: "Madison High School Gym (SD)", city: "San Diego, CA", lat: 32.8123, lng: -117.1068, access: "members" },
    { name: "Mira Mesa High School Gym", city: "San Diego, CA", lat: 32.9090, lng: -117.1381, access: "members" },
    { name: "Scripps Ranch High School Gym", city: "San Diego, CA", lat: 32.9074, lng: -117.0881, access: "members" },
    { name: "University City High School Gym", city: "San Diego, CA", lat: 32.8576, lng: -117.2081, access: "members" },
    { name: "Point Loma High School Gym", city: "San Diego, CA", lat: 32.7424, lng: -117.2277, access: "members" },
    { name: "Mission Bay High School Gym", city: "San Diego, CA", lat: 32.7940, lng: -117.2332, access: "members" },
    { name: "La Jolla High School Gym", city: "La Jolla, CA", lat: 32.8393, lng: -117.2638, access: "members" },
    { name: "Patrick Henry High School Gym", city: "San Diego, CA", lat: 32.8397, lng: -117.0668, access: "members" },
    { name: "Rancho Bernardo High School Gym", city: "San Diego, CA", lat: 33.0114, lng: -117.0670, access: "members" },
    { name: "Mt. Carmel High School Gym", city: "San Diego, CA", lat: 33.0030, lng: -117.0844, access: "members" },
    { name: "Poway High School Gym", city: "Poway, CA", lat: 32.9661, lng: -117.0379, access: "members" },
    { name: "Chula Vista High School Gym", city: "Chula Vista, CA", lat: 32.6355, lng: -117.0778, access: "members" },
    { name: "Eastlake High School Gym (CV)", city: "Chula Vista, CA", lat: 32.6329, lng: -116.9715, access: "members" },
    { name: "Olympian High School Gym", city: "Chula Vista, CA", lat: 32.6251, lng: -116.9512, access: "members" },
    { name: "Otay Ranch High School Gym", city: "Chula Vista, CA", lat: 32.6057, lng: -117.0050, access: "members" },
    { name: "Bonita Vista High School Gym", city: "Chula Vista, CA", lat: 32.6439, lng: -117.0399, access: "members" },
    { name: "Hilltop High School Gym", city: "Chula Vista, CA", lat: 32.6579, lng: -117.0499, access: "members" },
    { name: "El Cajon Valley High School Gym", city: "El Cajon, CA", lat: 32.7866, lng: -116.9497, access: "members" },
    { name: "Valhalla High School Gym", city: "El Cajon, CA", lat: 32.7910, lng: -116.9202, access: "members" },
    { name: "Grossmont High School Gym", city: "La Mesa, CA", lat: 32.7556, lng: -117.0005, access: "members" },
    { name: "Helix High School Gym", city: "La Mesa, CA", lat: 32.7834, lng: -116.9887, access: "members" },
    { name: "Santana High School Gym", city: "Santee, CA", lat: 32.8404, lng: -116.9731, access: "members" },
    { name: "Escondido High School Gym", city: "Escondido, CA", lat: 33.1195, lng: -117.0836, access: "members" },
    { name: "San Pasqual High School Gym", city: "Escondido, CA", lat: 33.1116, lng: -117.0401, access: "members" },
    { name: "Oceanside High School Gym", city: "Oceanside, CA", lat: 33.1863, lng: -117.3610, access: "members" },
    { name: "El Camino High School Gym (Oceanside)", city: "Oceanside, CA", lat: 33.2085, lng: -117.3269, access: "members" },
    { name: "Vista High School Gym", city: "Vista, CA", lat: 33.2037, lng: -117.2393, access: "members" },
    { name: "San Marcos High School Gym", city: "San Marcos, CA", lat: 33.1364, lng: -117.1650, access: "members" },
    { name: "Carlsbad High School Gym", city: "Carlsbad, CA", lat: 33.1535, lng: -117.3324, access: "members" },
    { name: "Torrey Pines High School Gym", city: "San Diego, CA", lat: 32.9287, lng: -117.2291, access: "members" },
];

const ORANGE_COUNTY_SCHOOLS = [
    { name: "Anaheim High School Gym", city: "Anaheim, CA", lat: 33.8365, lng: -117.9156, access: "members" },
    { name: "Canyon High School Gym", city: "Anaheim, CA", lat: 33.8561, lng: -117.7842, access: "members" },
    { name: "Katella High School Gym", city: "Anaheim, CA", lat: 33.8212, lng: -117.8754, access: "members" },
    { name: "Servite High School Gym", city: "Anaheim, CA", lat: 33.8467, lng: -117.8886, access: "members" },
    { name: "Santa Ana High School Gym", city: "Santa Ana, CA", lat: 33.7366, lng: -117.8624, access: "members" },
    { name: "Century High School Gym (SA)", city: "Santa Ana, CA", lat: 33.7515, lng: -117.8909, access: "members" },
    { name: "Segerstrom High School Gym", city: "Santa Ana, CA", lat: 33.7110, lng: -117.8857, access: "members" },
    { name: "Mater Dei High School Gym", city: "Santa Ana, CA", lat: 33.7505, lng: -117.8579, access: "members" },
    { name: "Garden Grove High School Gym", city: "Garden Grove, CA", lat: 33.7729, lng: -117.9435, access: "members" },
    { name: "La Quinta High School Gym", city: "Garden Grove, CA", lat: 33.7786, lng: -117.9682, access: "members" },
    { name: "Westminster High School Gym", city: "Westminster, CA", lat: 33.7520, lng: -117.9835, access: "members" },
    { name: "Huntington Beach High School Gym", city: "Huntington Beach, CA", lat: 33.6713, lng: -117.9885, access: "members" },
    { name: "Edison High School Gym", city: "Huntington Beach, CA", lat: 33.6843, lng: -117.9581, access: "members" },
    { name: "Irvine High School Gym", city: "Irvine, CA", lat: 33.6906, lng: -117.8172, access: "members" },
    { name: "University High School Gym (Irvine)", city: "Irvine, CA", lat: 33.6652, lng: -117.8090, access: "members" },
    { name: "Northwood High School Gym", city: "Irvine, CA", lat: 33.7186, lng: -117.7815, access: "members" },
    { name: "Woodbridge High School Gym", city: "Irvine, CA", lat: 33.6952, lng: -117.7768, access: "members" },
    { name: "Portola High School Gym", city: "Irvine, CA", lat: 33.6652, lng: -117.7510, access: "members" },
    { name: "Fullerton Union High School Gym", city: "Fullerton, CA", lat: 33.8762, lng: -117.9210, access: "members" },
    { name: "Sunny Hills High School Gym", city: "Fullerton, CA", lat: 33.8846, lng: -117.8818, access: "members" },
    { name: "Troy High School Gym", city: "Fullerton, CA", lat: 33.8730, lng: -117.8654, access: "members" },
    { name: "Orange High School Gym", city: "Orange, CA", lat: 33.7830, lng: -117.8460, access: "members" },
    { name: "Villa Park High School Gym", city: "Villa Park, CA", lat: 33.8137, lng: -117.8076, access: "members" },
    { name: "El Modena High School Gym", city: "Orange, CA", lat: 33.8061, lng: -117.8057, access: "members" },
    { name: "Tustin High School Gym", city: "Tustin, CA", lat: 33.7432, lng: -117.8165, access: "members" },
    { name: "Foothill High School Gym (Tustin)", city: "Tustin, CA", lat: 33.7268, lng: -117.8015, access: "members" },
    { name: "Mission Viejo High School Gym", city: "Mission Viejo, CA", lat: 33.5845, lng: -117.6701, access: "members" },
    { name: "Capistrano Valley High School Gym", city: "Mission Viejo, CA", lat: 33.5984, lng: -117.6518, access: "members" },
    { name: "San Clemente High School Gym", city: "San Clemente, CA", lat: 33.4396, lng: -117.6199, access: "members" },
    { name: "Dana Hills High School Gym", city: "Dana Point, CA", lat: 33.4733, lng: -117.6819, access: "members" },
    { name: "Laguna Beach High School Gym", city: "Laguna Beach, CA", lat: 33.5467, lng: -117.7805, access: "members" },
    { name: "Aliso Niguel High School Gym", city: "Aliso Viejo, CA", lat: 33.5734, lng: -117.7126, access: "members" },
    { name: "Brea Olinda High School Gym", city: "Brea, CA", lat: 33.9143, lng: -117.8924, access: "members" },
    { name: "Cypress High School Gym", city: "Cypress, CA", lat: 33.8188, lng: -118.0307, access: "members" },
    { name: "Los Alamitos High School Gym", city: "Los Alamitos, CA", lat: 33.7994, lng: -118.0641, access: "members" },
    { name: "Tesoro High School Gym", city: "Rancho Santa Margarita, CA", lat: 33.6343, lng: -117.5923, access: "members" },
];

const INLAND_EMPIRE_SCHOOLS = [
    { name: "Riverside Poly High School Gym", city: "Riverside, CA", lat: 33.9710, lng: -117.3856, access: "members" },
    { name: "North High School Gym (Riverside)", city: "Riverside, CA", lat: 34.0044, lng: -117.3910, access: "members" },
    { name: "Arlington High School Gym", city: "Riverside, CA", lat: 33.9398, lng: -117.4304, access: "members" },
    { name: "Martin Luther King High School Gym (Riverside)", city: "Riverside, CA", lat: 33.8881, lng: -117.3247, access: "members" },
    { name: "Ramona High School Gym", city: "Riverside, CA", lat: 33.9414, lng: -117.3476, access: "members" },
    { name: "Corona High School Gym", city: "Corona, CA", lat: 33.8769, lng: -117.5712, access: "members" },
    { name: "Centennial High School Gym (Corona)", city: "Corona, CA", lat: 33.8500, lng: -117.5233, access: "members" },
    { name: "Norco High School Gym", city: "Norco, CA", lat: 33.9371, lng: -117.5350, access: "members" },
    { name: "San Bernardino High School Gym", city: "San Bernardino, CA", lat: 34.1223, lng: -117.2890, access: "members" },
    { name: "Cajon High School Gym", city: "San Bernardino, CA", lat: 34.1577, lng: -117.2698, access: "members" },
    { name: "San Gorgonio High School Gym", city: "San Bernardino, CA", lat: 34.0887, lng: -117.2571, access: "members" },
    { name: "Rancho Cucamonga High School Gym", city: "Rancho Cucamonga, CA", lat: 34.0933, lng: -117.5608, access: "members" },
    { name: "Alta Loma High School Gym", city: "Rancho Cucamonga, CA", lat: 34.1293, lng: -117.5783, access: "members" },
    { name: "Etiwanda High School Gym", city: "Rancho Cucamonga, CA", lat: 34.1394, lng: -117.5197, access: "members" },
    { name: "Fontana High School Gym", city: "Fontana, CA", lat: 34.0997, lng: -117.4421, access: "members" },
    { name: "A.B. Miller High School Gym", city: "Fontana, CA", lat: 34.0685, lng: -117.4689, access: "members" },
    { name: "Summit High School Gym", city: "Fontana, CA", lat: 34.0535, lng: -117.4221, access: "members" },
    { name: "Ontario High School Gym (CA)", city: "Ontario, CA", lat: 34.0589, lng: -117.6536, access: "members" },
    { name: "Chaffey High School Gym", city: "Ontario, CA", lat: 34.0785, lng: -117.6386, access: "members" },
    { name: "Upland High School Gym", city: "Upland, CA", lat: 34.1072, lng: -117.6484, access: "members" },
    { name: "Murrieta Valley High School Gym", city: "Murrieta, CA", lat: 33.5688, lng: -117.2044, access: "members" },
    { name: "Temecula Valley High School Gym", city: "Temecula, CA", lat: 33.4935, lng: -117.1465, access: "members" },
    { name: "Great Oak High School Gym", city: "Temecula, CA", lat: 33.4765, lng: -117.1736, access: "members" },
    { name: "Moreno Valley High School Gym", city: "Moreno Valley, CA", lat: 33.9363, lng: -117.2233, access: "members" },
    { name: "Palm Desert High School Gym", city: "Palm Desert, CA", lat: 33.7425, lng: -116.3830, access: "members" },
    { name: "Palm Springs High School Gym", city: "Palm Springs, CA", lat: 33.8064, lng: -116.5409, access: "members" },
    { name: "Redlands High School Gym", city: "Redlands, CA", lat: 34.0612, lng: -117.1824, access: "members" },
];

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  CA AUDIT P4: SD, OC, INLAND EMPIRE SCHOOLS      ║');
    console.log('╚══════════════════════════════════════════════════╝');
    let totalOk = 0, totalFail = 0;
    const regions = [
        ['San Diego Area', SAN_DIEGO_SCHOOLS],
        ['Orange County', ORANGE_COUNTY_SCHOOLS],
        ['Inland Empire', INLAND_EMPIRE_SCHOOLS],
    ];
    for (const [label, courts] of regions) {
        const r = await runImport(label, courts);
        totalOk += r.ok; totalFail += r.fail;
    }
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`CA P4 TOTAL: ${totalOk} ok, ${totalFail} failed`);
    console.log(`${'═'.repeat(50)}\n`);
}
main();

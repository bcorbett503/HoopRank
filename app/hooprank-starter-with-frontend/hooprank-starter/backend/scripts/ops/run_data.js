#!/usr/bin/env node
/**
 * ops/run_data.js — Single source of truth for all venues & run schedules
 *
 * Edit THIS FILE to add/modify venues and runs.
 * Then run: TOKEN=xxx node scripts/ops/seed_runs.js
 *
 * Venue types: 'existing' (already in DB with courtId) or 'create' (will be created)
 */

const D = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Helper to build a run entry compactly
const r = (venueKey, title, opts) => ({ venueKey, title, ...opts });

// ═══════════════════════════════════════════════════════════════════
//  VENUES — All courts referenced by runs
// ═══════════════════════════════════════════════════════════════════

const venues = [
    // ── SAN FRANCISCO ────────────────────────────────────────────
    { key: 'embarcaderoYmca', courtId: '989c4383-9088-d6d9-940b-c2761ccd1425', name: 'Embarcadero YMCA', city: 'San Francisco, CA' },
    { key: 'potreroHillRec', courtId: '33677a80-28f7-f0c8-6f1b-9024f0955ada', name: 'Potrero Hill Rec Center', city: 'San Francisco, CA' },
    { key: 'koretCenter', courtId: 'b638a8a8-1df2-ec14-a864-6d4d3986e84b', name: 'USF Koret Center', city: 'San Francisco, CA' },
    { key: 'richmondRec', courtId: '10777896-f063-8886-a68a-4c6f66347099', name: 'Richmond Recreation Center', city: 'San Francisco, CA' },
    { key: 'equinoxSF', courtId: 'fc74ef72-1ad1-0c4d-b7cc-019c010f1e68', name: 'Equinox Sports Club SF', city: 'San Francisco, CA' },
    { key: 'ucsfBakar', courtId: 'd351b10a-4fc9-bb7b-ed2d-82480bee2084', name: 'UCSF Bakar Fitness', city: 'San Francisco, CA' },
    { key: 'bettyAnnOng', courtId: '87429d94-621c-0c81-6da8-abe7aa1ab541', name: 'Betty Ann Ong Rec Center', city: 'San Francisco, CA' },
    { key: 'missionRec', courtId: '274ec68b-4c85-dc90-559d-2b7ffa47938a', name: 'Mission Rec Center', city: 'San Francisco, CA' },
    { key: 'panhandle', create: true, name: 'The Panhandle Basketball Courts', city: 'San Francisco, CA', lat: 37.7729, lng: -122.4410, indoor: false, venue_type: 'park', address: 'Panhandle Park, San Francisco, CA 94117' },

    // ── OAKLAND / EAST BAY ───────────────────────────────────────
    { key: 'ogp', courtId: '856c5817-ebab-2d31-ea32-893458e071bf', name: 'OGP Oakland', city: 'Oakland, CA' },
    { key: 'bushrod', courtId: '79721de7-ddfb-363e-5673-67ca1ae1c381', name: 'Bushrod Recreation Center', city: 'Oakland, CA' },
    { key: 'oakYmca', courtId: '13779997-e280-bae8-fa49-e3b96b0a75c5', name: 'Oakland YMCA', city: 'Oakland, CA' },
    { key: 'alamedaPt', courtId: 'f331b63d-93e1-25a4-c5c3-484cdba84dd8', name: 'Alameda Point Gymnasium', city: 'Alameda, CA' },
    { key: 'rainbow', courtId: '142eb068-791f-69c3-473b-007d8acd550c', name: 'Rainbow Recreation Center', city: 'Oakland, CA' },
    { key: 'bladium', courtId: '5dade5ce-0947-eaf7-75d1-675230892407', name: 'Bladium Sports & Fitness Club', city: 'Alameda, CA' },
    { key: 'headRoyce', courtId: 'd33fe47d-bbf8-b753-3e04-6efb68d2535b', name: 'Head-Royce School Gym', city: 'Oakland, CA' },
    { key: 'fmSmith', courtId: 'af9f116e-03de-fc7b-7906-7550bc503d13', name: 'FM Smith Recreation Center', city: 'Oakland, CA' },
    { key: 'iraJinkins', courtId: '3bebc23c-6710-5c36-d75b-920381cf81c2', name: 'Ira Jinkins Community Center', city: 'Oakland, CA' },
    { key: 'mosswood', create: true, name: 'Mosswood Park Basketball Courts', city: 'Oakland, CA', lat: 37.8274, lng: -122.2608, indoor: false, venue_type: 'park', address: '3612 Webster St, Oakland, CA 94609' },

    // ── MARIN COUNTY ─────────────────────────────────────────────
    { key: 'strawberryRec', create: true, name: 'Strawberry Recreation District Gym', city: 'Mill Valley, CA', lat: 37.8965, lng: -122.5095, indoor: true, access: 'public', venue_type: 'rec_center', address: '118 E Strawberry Dr, Mill Valley, CA 94941' },
    { key: 'boroCC', create: true, name: 'Albert J. Boro Community Center', city: 'San Rafael, CA', lat: 37.9566, lng: -122.5098, indoor: true, access: 'public', venue_type: 'rec_center', address: '50 Canal St, San Rafael, CA 94901' },
    { key: 'hillGym', create: true, name: 'Hill Gymnasium & Recreation Area', city: 'Novato, CA', lat: 38.1045, lng: -122.5715, indoor: true, access: 'public', venue_type: 'rec_center', address: 'Novato, CA 94947' },

    // ── CHICAGO ───────────────────────────────────────────────────
    { key: 'eastBank', create: true, name: 'East Bank Club', city: 'Chicago, IL', lat: 41.8898, lng: -87.6390, indoor: true, access: 'private', venue_type: 'gym', address: '500 N Kingsbury St, Chicago, IL 60654' },
    { key: 'rayMeyer', create: true, name: 'Ray Meyer Fitness & Recreation Center', city: 'Chicago, IL', lat: 41.9257, lng: -87.6553, indoor: true, access: 'private', venue_type: 'university', address: '2235 N Sheffield Ave, Chicago, IL 60614' },
    { key: 'britishSchool', create: true, name: 'British International School of Chicago', city: 'Chicago, IL', lat: 41.9076, lng: -87.6635, indoor: true, access: 'private', venue_type: 'school', address: '814 W Eastman St, Chicago, IL 60642' },
    { key: 'bennettDay', create: true, name: 'Bennett Day School', city: 'Chicago, IL', lat: 41.8912, lng: -87.6531, indoor: true, access: 'private', venue_type: 'school', address: '955 W Grand Ave, Chicago, IL 60642' },
    { key: 'pulaskiPark', create: true, name: 'Pulaski (Casimir) Park', city: 'Chicago, IL', lat: 41.9105, lng: -87.6667, indoor: true, access: 'public', venue_type: 'rec_center', address: '1419 W Blackhawk St, Chicago, IL 60642' },
    { key: 'irvingParkYMCA', create: true, name: 'Irving Park YMCA', city: 'Chicago, IL', lat: 41.9536, lng: -87.7234, indoor: true, access: 'private', venue_type: 'gym', address: '4251 W Irving Park Rd, Chicago, IL 60641' },
    { key: 'broadwayArmory', create: true, name: 'Broadway Armory Park', city: 'Chicago, IL', lat: 41.9726, lng: -87.6596, indoor: true, access: 'public', venue_type: 'rec_center', address: '5917 N Broadway, Chicago, IL 60660' },
    { key: 'cfCourtCafe', create: true, name: 'CF Court Cafe', city: 'Chicago, IL', lat: 41.8385, lng: -87.6914, indoor: true, access: 'private', venue_type: 'gym', address: '3044 S Gratten Ave, Chicago, IL 60608' },
    { key: 'comedRec', create: true, name: 'ComEd Rec Center', city: 'Chicago, IL', lat: 41.8932, lng: -87.6476, indoor: true, access: 'public', venue_type: 'rec_center', address: 'Chicago, IL' },
    { key: 'fosterPark', create: true, name: 'Foster Park', city: 'Chicago, IL', lat: 41.7390, lng: -87.6394, indoor: false, venue_type: 'park', address: '1440 W 84th St, Chicago, IL 60620' },
    { key: 'humboldtPark', create: true, name: 'Humboldt Park Basketball Courts', city: 'Chicago, IL', lat: 41.9020, lng: -87.7034, indoor: false, venue_type: 'park', address: '1400 N Sacramento Ave, Chicago, IL 60622' },

    // ── SEATTLE ───────────────────────────────────────────────────
    { key: 'psbl', courtId: '4ffd2379-d701-30d7-a273-14240800eaa0', name: 'Puget Sound Basketball (PSBL Sodo)', city: 'Seattle, WA' },
    { key: 'millerCC', courtId: '2d76d343-763d-64d8-fc19-5ff9c7b851e7', name: 'Miller Community Center', city: 'Seattle, WA' },
    { key: 'rainierBeach', courtId: 'b8094dae-fcf9-bbae-197f-8874aacde6b9', name: 'Rainier Beach Community Center', city: 'Seattle, WA' },
    { key: 'wac', courtId: '2bf664e9-96ff-8b6e-9260-d3ba308ce490', name: 'Washington Athletic Club', city: 'Seattle, WA' },
    { key: 'sac', courtId: 'b0739174-e298-9b40-30f0-fc940190bd85', name: 'Seattle Athletic Club', city: 'Seattle, WA' },
    { key: 'greenLake', courtId: 'addbd447-ef2c-2765-b00f-447fe5fa7801', name: 'Green Lake Community Center', city: 'Seattle, WA' },
    { key: 'loyalHeights', courtId: '8017f233-1437-47c5-9858-a0a719ef1daa', name: 'Loyal Heights Community Center', city: 'Seattle, WA' },
    { key: 'delridge', courtId: '318cd545-f602-0284-ea25-606e360927cd', name: 'Delridge Community Center', city: 'Seattle, WA' },
    { key: 'greenLakePark', create: true, name: 'Green Lake Park Basketball Courts', city: 'Seattle, WA', lat: 47.6802, lng: -122.3395, indoor: false, venue_type: 'park', address: '7201 E Green Lake Dr N, Seattle, WA 98115' },

    // ── PORTLAND ──────────────────────────────────────────────────
    { key: 'columbiaChristian', courtId: 'd3e69144-b8f9-67cc-67b8-09a87159435e', name: 'Columbia Christian School', city: 'Portland, OR' },
    { key: 'neCC', courtId: 'eabe0c76-1f16-1c49-0838-6eae0ee495ed', name: 'Northeast Community Center', city: 'Portland, OR' },
    { key: 'mittlemanJCC', courtId: 'da60ff3a-76d1-10b4-55fa-5519002369d5', name: 'Mittleman JCC', city: 'Portland, OR' },
    { key: 'mattDishman', courtId: '89c99e1d-52c7-f37c-b14b-af47d5d8e989', name: 'Matt Dishman CC', city: 'Portland, OR' },
    { key: 'warnerPacific', courtId: '840600be-d828-2b03-2e51-63b3e9ab133e', name: 'Warner Pacific University', city: 'Portland, OR' },
    { key: 'cascadeAthletic', courtId: 'c8d33af1-251c-e914-83cc-a6d7ac4cb9bb', name: 'Cascade Athletic Club', city: 'Gresham, OR' },
    { key: 'psu', courtId: '55d3660b-c26e-1042-f7b3-e8d424d212aa', name: 'Portland State University', city: 'Portland, OR' },
    { key: 'southwestCC', courtId: 'b6e19cb6-4b0f-cb0b-f2ef-05063b4f7700', name: 'Southwest Community Center', city: 'Portland, OR' },
    { key: 'irvingPark', create: true, name: 'Irving Park Basketball Courts', city: 'Portland, OR', lat: 45.5387, lng: -122.6421, indoor: false, venue_type: 'park', address: '707 NE Fremont St, Portland, OR 97212' },

    // ── LOS ANGELES ──────────────────────────────────────────────
    { key: 'crosscourt', courtId: '38df369a-8560-cade-e52e-2c3fdedfa07f', name: 'Crosscourt DTLA', city: 'Los Angeles, CA' },
    { key: 'mccambridge', courtId: '74b53b01-4d93-b48c-a9e6-e97895744fe4', name: 'McCambridge Park Rec', city: 'Burbank, CA' },
    { key: 'equinoxLA', courtId: 'e0589d19-63a9-413d-4429-de715665e0ea', name: 'Equinox Sports Club LA', city: 'Los Angeles, CA' },
    { key: 'westwoodRec', courtId: '2ab9f899-c109-8f6c-e1af-09544d857bbc', name: 'Westwood Recreation Center', city: 'Los Angeles, CA' },
    { key: 'laac', courtId: '14e3a905-eea4-caf3-8e3f-2577be34b325', name: 'Los Angeles Athletic Club', city: 'Los Angeles, CA' },
    { key: 'vnso', courtId: '26677532-b664-7d35-cbdf-ca4ee8dbe24a', name: 'Van Nuys Sherman Oaks Rec', city: 'Los Angeles, CA' },
    { key: 'uclaWooden', courtId: '8eca4ade-2971-1154-0ee7-94bf453f4e92', name: 'UCLA John Wooden Center', city: 'Los Angeles, CA' },
    { key: 'panPacific', courtId: '343ed749-7fe2-884e-313b-3c59f27aa212', name: 'Pan Pacific Park Gym', city: 'Los Angeles, CA' },
    { key: 'veniceBeach', courtId: '937c073c-367e-de83-5913-382441cededb', name: 'Venice Beach Basketball Courts', city: 'Los Angeles, CA' },

    // ── NEW YORK CITY ────────────────────────────────────────────
    { key: 'chelseaRec', courtId: '86bf4577-6e22-c57c-6a78-506d9043bb8d', name: 'Chelsea Recreation Center', city: 'New York, NY' },
    { key: 'thePost', courtId: '3e01c0f4-443c-9342-bcb1-6db7ff35278e', name: 'The Post BK', city: 'Brooklyn, NY' },
    { key: 'bballCity', courtId: '52c3e9b1-c9e5-c197-3694-f0f5c0194e1b', name: 'Basketball City', city: 'New York, NY' },
    { key: 'crossIslandY', courtId: '632e099b-2775-11ae-11c8-3ab41bc576f6', name: 'Cross Island YMCA', city: 'Queens, NY' },
    { key: 'ny92', courtId: 'e1820845-4297-c5d8-ece5-7585f102f273', name: '92NY Gym', city: 'New York, NY' },
    { key: 'west4th', courtId: '65d8e17b-95a8-ddd1-9521-b872a59bdbd4', name: 'West 4th Street Courts (The Cage)', city: 'New York, NY' },
    { key: 'rucker', courtId: '235a779d-5c5d-cfe3-0a94-a166a78b1de6', name: 'Rucker Park', city: 'New York, NY' },

    // ── TEXAS ─────────────────────────────────────────────────────
    { key: 'austinRec', courtId: '0210cfa6-d094-10fc-d2fe-5a1b85819444', name: 'Austin Recreation Center', city: 'Austin, TX' },
    { key: 'southAustinRec', courtId: 'e5e1b9e3-88b8-0756-a59b-ef0e4c3562e7', name: 'South Austin Recreation Center', city: 'Austin, TX' },
    { key: 'northwestRec', courtId: 'e6f5e9b9-1667-2efe-ccfd-62b90b8f1b58', name: 'Northwest Recreation Center', city: 'Austin, TX' },
    { key: 'fondeRec', courtId: '6c3e9fcf-db0d-7183-9839-9729d83b0962', name: 'Fonde Recreation Center', city: 'Houston, TX' },
    { key: 'reverchonPark', create: true, name: 'Reverchon Park Basketball Courts', city: 'Dallas, TX', lat: 32.7990, lng: -96.8080, indoor: false, venue_type: 'park', address: '3505 Maple Ave, Dallas, TX 75219' },
];

// Continued in run_data_venues2.js... NO — all in one file.
// Virginia + Iconic venues + Philly + DC + other create-only venues

const venues2 = [
    // ── VIRGINIA (NOVA) ──────────────────────────────────────────
    { key: 'tjCC', create: true, name: 'Thomas Jefferson Community Center', city: 'Arlington, VA', lat: 38.8830, lng: -77.0947, indoor: true, access: 'public', venue_type: 'rec_center', address: '3501 2nd St S, Arlington, VA 22204' },
    { key: 'lubberRun', create: true, name: 'Lubber Run Community Center', city: 'Arlington, VA', lat: 38.8726, lng: -77.1142, indoor: true, access: 'public', venue_type: 'rec_center', address: '300 N Park Dr, Arlington, VA 22203' },
    { key: 'charlesDrew', create: true, name: 'Charles Drew Community Center', city: 'Arlington, VA', lat: 38.8610, lng: -77.0690, indoor: true, access: 'public', venue_type: 'rec_center', address: '3500 23rd St S, Arlington, VA 22206' },
    { key: 'langstonBrown', create: true, name: 'Langston-Brown Community Center', city: 'Arlington, VA', lat: 38.8855, lng: -77.0828, indoor: true, access: 'public', venue_type: 'rec_center', address: '2121 N Culpeper St, Arlington, VA 22207' },
    { key: 'walterReed', create: true, name: 'Walter Reed Community Center', city: 'Arlington, VA', lat: 38.8576, lng: -77.1014, indoor: true, access: 'public', venue_type: 'rec_center', address: '2909 16th St S, Arlington, VA 22204' },
    { key: 'gmuActivities', create: true, name: 'George Mason University Activities Building', city: 'Fairfax, VA', lat: 38.8316, lng: -77.3087, indoor: true, access: 'private', venue_type: 'university', address: '4400 University Dr, Fairfax, VA 22030' },
    { key: 'stJames', create: true, name: 'The St. James', city: 'Springfield, VA', lat: 38.7758, lng: -77.1713, indoor: true, access: 'private', venue_type: 'gym', address: '6805 Industrial Rd, Springfield, VA 22151' },
    // ── VIRGINIA (Richmond) ──────────────────────────────────────
    { key: 'bellemeade', create: true, name: 'Bellemeade Community Center', city: 'Richmond, VA', lat: 37.4980, lng: -77.4555, indoor: true, access: 'public', venue_type: 'rec_center', address: '1800 Lynhaven Ave, Richmond, VA 23224' },
    { key: 'easternHenrico', create: true, name: 'Eastern Henrico Recreation Center', city: 'Henrico, VA', lat: 37.5500, lng: -77.3600, indoor: true, access: 'public', venue_type: 'rec_center', address: '1440 N Laburnum Ave, Richmond, VA 23223' },
    { key: 'deepRun', create: true, name: 'Deep Run Recreation Center', city: 'Henrico, VA', lat: 37.6300, lng: -77.5800, indoor: true, access: 'public', venue_type: 'rec_center', address: '9910 Ridgefield Pkwy, Henrico, VA 23233' },
    { key: 'powhatanHill', create: true, name: 'Powhatan Hill Community Center', city: 'Richmond, VA', lat: 37.5190, lng: -77.4020, indoor: true, access: 'public', venue_type: 'rec_center', address: '5765 Louisa Ave, Richmond, VA 23231' },
    { key: 'tbSmith', create: true, name: 'T.B. Smith Community Center', city: 'Richmond, VA', lat: 37.4930, lng: -77.4480, indoor: true, access: 'public', venue_type: 'rec_center', address: '2019 Ruffin Rd, Richmond, VA 23234' },
    { key: 'vcuCarySt', create: true, name: 'VCU Cary Street Gym', city: 'Richmond, VA', lat: 37.5407, lng: -77.4500, indoor: true, access: 'private', venue_type: 'university', address: '911 W Cary St, Richmond, VA 23284' },
    { key: 'swiftCreekY', create: true, name: 'Swift Creek YMCA', city: 'Midlothian, VA', lat: 37.4800, lng: -77.5700, indoor: true, access: 'private', venue_type: 'gym', address: 'Midlothian, VA' },
    // ── VIRGINIA (Virginia Beach) ────────────────────────────────
    { key: 'kempsvilleRec', create: true, name: 'Kempsville Recreation Center', city: 'Virginia Beach, VA', lat: 36.8200, lng: -76.1180, indoor: true, access: 'public', venue_type: 'rec_center', address: '800 Monmouth Ln, Virginia Beach, VA 23464' },
    { key: 'princessAnne', create: true, name: 'Princess Anne Recreation Center', city: 'Virginia Beach, VA', lat: 36.7800, lng: -76.0350, indoor: true, access: 'public', venue_type: 'rec_center', address: '1400 Nimmo Pkwy, Virginia Beach, VA 23456' },
    { key: 'williamsFarm', create: true, name: 'Williams Farm Recreation Center', city: 'Virginia Beach, VA', lat: 36.8150, lng: -76.0780, indoor: true, access: 'public', venue_type: 'rec_center', address: '5252 Learning Ln, Virginia Beach, VA 23462' },
    { key: 'bowCreek', create: true, name: 'Bow Creek Recreation Center', city: 'Virginia Beach, VA', lat: 36.8300, lng: -76.1000, indoor: true, access: 'public', venue_type: 'rec_center', address: '3427 Club House Rd, Virginia Beach, VA 23452' },
    { key: 'vbFieldHouse', create: true, name: 'Virginia Beach Field House', city: 'Virginia Beach, VA', lat: 36.7960, lng: -76.0920, indoor: true, access: 'public', venue_type: 'rec_center', address: '2020 Landstown Rd, Virginia Beach, VA 23456' },

    // ── ICONIC (create-only) ─────────────────────────────────────
    { key: 'barryFarm', create: true, name: 'Barry Farm Recreation Center', city: 'Washington, DC', lat: 38.8487, lng: -76.9901, indoor: true, venue_type: 'rec_center', address: '1230 Sumner Rd SE, Washington, DC 20020' },
    { key: 'hankGathers', create: true, name: 'Hank Gathers Recreation Center', city: 'Philadelphia, PA', lat: 39.9731, lng: -75.1583, indoor: true, venue_type: 'rec_center', address: '2501 W Diamond St, Philadelphia, PA 19121' },
    { key: 'joeDumars', create: true, name: 'Joe Dumars Fieldhouse', city: 'Shelby Township, MI', lat: 42.6614, lng: -83.0340, indoor: true, venue_type: 'gym', address: '45300 Mound Rd, Shelby Township, MI 48317' },
    { key: 'mandelJCC', create: true, name: 'Mandel Jewish Community Center', city: 'Beachwood, OH', lat: 41.4683, lng: -81.5080, indoor: true, venue_type: 'rec_center', address: '26001 S Woodland Rd, Beachwood, OH 44122' },
    { key: 'atlasLV', create: true, name: 'Atlas Basketball (The Loop)', city: 'Las Vegas, NV', lat: 36.1150, lng: -115.1720, indoor: true, venue_type: 'gym', address: '6485 S Rainbow Blvd #100, Las Vegas, NV 89118' },
    { key: 'flamingoPark', create: true, name: 'Flamingo Park Basketball Courts', city: 'Miami Beach, FL', lat: 25.7770, lng: -80.1350, indoor: false, venue_type: 'park', address: '1200 Meridian Ave, Miami Beach, FL 33139' },
    { key: 'ltCoralGables', create: true, name: 'Life Time - Coral Gables', city: 'Coral Gables, FL', lat: 25.7500, lng: -80.2600, indoor: true, venue_type: 'gym', address: '4000 SW 57th Ave, Coral Gables, FL 33155' },
    { key: 'ltBuckhead', create: true, name: 'Life Time - Buckhead', city: 'Atlanta, GA', lat: 33.8480, lng: -84.3560, indoor: true, venue_type: 'gym', address: '3445 Peachtree Rd NE, Atlanta, GA 30326' },

    // ── BOSTON / CAMBRIDGE (MA) ───────────────────────────────────
    { key: 'cambridgeAC', courtId: '88d10e48-e8f1-be9b-a172-3c39add2eddc', name: 'Cambridge Athletic Club', city: 'Cambridge, MA' },
    { key: 'wangYmca', courtId: 'e159bd8f-dcd3-752f-d77d-cd32f28671ae', name: 'Wang YMCA of Chinatown', city: 'Boston, MA' },
    { key: 'trackNB', courtId: 'f7513df1-c4d0-1a8d-334b-c88015290088', name: 'The TRACK at New Balance', city: 'Boston, MA' },
    { key: 'oakSquareY', courtId: '2a2d7110-86dc-8575-3c87-2128062f674c', name: 'Oak Square YMCA', city: 'Brighton, MA' },
    { key: 'nazzaroCC', courtId: '7fa07283-9deb-fa98-42b9-e0027ad837e0', name: 'BCYF Nazzaro Community Center', city: 'Boston, MA' },
    { key: 'pinoCC', courtId: '029efc5f-a812-9099-a035-6e4d948539cc', name: 'BCYF Pino Community Center', city: 'Boston, MA' },
    { key: 'tobinCC', create: true, name: 'BCYF Tobin Community Center', city: 'Boston, MA', lat: 42.3243, lng: -71.0572, indoor: true, access: 'public', venue_type: 'rec_center', address: '1481 Tremont St, Boston, MA 02120' },
    { key: 'curtisHall', create: true, name: 'BCYF Curtis Hall Community Center', city: 'Boston, MA', lat: 42.3115, lng: -71.1141, indoor: true, access: 'public', venue_type: 'rec_center', address: '1663 Centre St, Boston, MA 02132' },
    { key: 'robertoClementeField', create: true, name: 'Roberto Clemente Field', city: 'Boston, MA', lat: 42.3448, lng: -71.0800, indoor: false, access: 'public', venue_type: 'park', address: '155 Tremont St, Boston, MA 02111' },
    { key: 'smithPlayground', create: true, name: 'Smith Playground', city: 'Boston, MA', lat: 42.3325, lng: -71.0915, indoor: false, access: 'public', venue_type: 'park', address: '235 Western Ave, Boston, MA 02134' },
    { key: 'ringerPark', create: true, name: 'Ringer Park', city: 'Boston, MA', lat: 42.3526, lng: -71.1350, indoor: false, access: 'public', venue_type: 'park', address: 'Allston St & Gordon St, Boston, MA 02134' },
    { key: 'hoytField', create: true, name: 'Hoyt Field', city: 'Cambridge, MA', lat: 42.3806, lng: -71.1334, indoor: false, access: 'public', venue_type: 'park', address: '1 Western Ave, Cambridge, MA 02139' },
    { key: 'buckleyPlayground', create: true, name: 'Buckley Playground', city: 'Boston, MA', lat: 42.3460, lng: -71.0530, indoor: false, access: 'public', venue_type: 'park', address: 'M St & E 5th St, Boston, MA 02127' },

    // ── PENINSULA (San Mateo County / South Bay) ─────────────────
    { key: 'sanMateoHS', courtId: '64288e25-f7be-078b-4f1a-1a98d1f7cf39', name: 'San Mateo High School Gym', city: 'San Mateo, CA' },
    { key: 'kingCC', courtId: '01e37b12-7c8a-8262-c508-d06dfd325942', name: 'King Community Center Gym', city: 'San Mateo, CA' },
    { key: 'redMorton', courtId: '895e0ee4-3975-fc03-1433-e17189eb257d', name: 'Red Morton Community Center', city: 'Redwood City, CA' },
    { key: 'sanCarlosYouth', create: true, name: 'San Carlos Youth Center Gym', city: 'San Carlos, CA', lat: 37.5073, lng: -122.2611, indoor: true, access: 'public', venue_type: 'rec_center', address: '1000 Bransten Rd, San Carlos, CA 94070' },
    { key: 'burtonPark', create: true, name: 'Burton Park', city: 'San Carlos, CA', lat: 37.5068, lng: -122.2620, indoor: false, access: 'public', venue_type: 'park', address: '1000 Bransten Rd, San Carlos, CA 94070' },
    { key: 'arrillagaGym', courtId: '948f37e5-8de1-2921-3d4f-214ee7127c9a', name: 'Arrillaga Family Gymnasium', city: 'Menlo Park, CA' },
    { key: 'onettaHarris', create: true, name: 'Onetta Harris Community Center', city: 'Menlo Park, CA', lat: 37.4524, lng: -122.1605, indoor: true, access: 'public', venue_type: 'rec_center', address: '100 Terminal Ave, Menlo Park, CA 94025' },
    { key: 'oshmanJCC', courtId: 'f83ccc3a-42b1-7c2b-6589-8903b6b48b69', name: 'Oshman Family JCC', city: 'Palo Alto, CA' },
    { key: 'mitchellPark', create: true, name: 'Mitchell Park', city: 'Palo Alto, CA', lat: 37.4254, lng: -122.1107, indoor: false, access: 'public', venue_type: 'park', address: '600 E Meadow Dr, Palo Alto, CA 94306' },
    { key: 'terrabayGym', courtId: 'f898b6e3-503d-4b5e-d4d1-7dac92bc1429', name: 'Terrabay Gymnasium', city: 'South San Francisco, CA' },
    { key: 'sanBrunoRec', create: true, name: 'San Bruno Recreation Center', city: 'San Bruno, CA', lat: 37.6305, lng: -122.4112, indoor: true, access: 'public', venue_type: 'rec_center', address: '251 City Park Way, San Bruno, CA 94066' },
    { key: 'brewerIsland', courtId: '562f104b-85e4-876e-3aa2-015bf1641ae2', name: 'Brewer Island Gym', city: 'Foster City, CA' },
    { key: 'whismanSC', courtId: '8a4d3001-83d7-9793-b884-42442e4ed913', name: 'Whisman Sports Center', city: 'Mountain View, CA' },

    // ── MERRITT ISLAND / SPACE COAST (FL) ────────────────────────
    { key: 'woodySimpson', create: true, name: 'Woody Simpson Park', city: 'Merritt Island, FL', lat: 28.3238, lng: -80.6762, indoor: false, access: 'public', venue_type: 'park', address: '100 E Merritt Island Cswy, Merritt Island, FL 32952' },
    { key: 'kiwanisIsland', create: true, name: 'Kiwanis Island Park Gym', city: 'Merritt Island, FL', lat: 28.3547, lng: -80.6641, indoor: true, access: 'public', venue_type: 'rec_center', address: '951 Kiwanis Island Park Rd, Merritt Island, FL 32952' },
    { key: 'healthFirstMI', create: true, name: 'Health First Pro-Health & Fitness Center', city: 'Merritt Island, FL', lat: 28.3498, lng: -80.6917, indoor: true, access: 'members', venue_type: 'gym', address: '340 N Banana River Dr, Merritt Island, FL 32952' },
    { key: 'miRecCenter', create: true, name: 'Merritt Island Recreation Center', city: 'Merritt Island, FL', lat: 28.3374, lng: -80.6825, indoor: true, access: 'public', venue_type: 'rec_center', address: '100 E Merritt Island Cswy, Merritt Island, FL 32952' },
    { key: 'mitchellEllington', create: true, name: 'Mitchell Ellington Park', city: 'Merritt Island, FL', lat: 28.4070, lng: -80.6683, indoor: false, access: 'public', venue_type: 'park', address: 'N Merritt Island, FL 32953' },
    { key: 'wattsPark', create: true, name: 'Watts Park', city: 'Merritt Island, FL', lat: 28.3207, lng: -80.6593, indoor: false, access: 'public', venue_type: 'park', address: 'Merritt Island, FL 32952' },
    { key: 'rotaryParkMI', create: true, name: 'Rotary Park at Merritt Island', city: 'Merritt Island, FL', lat: 28.3625, lng: -80.6865, indoor: false, access: 'public', venue_type: 'park', address: 'Merritt Island, FL 32953' },
    { key: 'travisPark', create: true, name: 'Travis Park', city: 'Cocoa, FL', lat: 28.3861, lng: -80.7413, indoor: false, access: 'public', venue_type: 'park', address: 'Cocoa, FL 32922' },
    { key: 'wickhamParkCC', create: true, name: 'Wickham Park Community Center', city: 'Melbourne, FL', lat: 28.1217, lng: -80.6430, indoor: true, access: 'public', venue_type: 'rec_center', address: '2815 Leisure Way, Melbourne, FL 32935' },
    { key: 'firstBaptistMI', create: true, name: 'First Baptist Church of Merritt Island', city: 'Merritt Island, FL', lat: 28.3530, lng: -80.6830, indoor: false, access: 'public', venue_type: 'church', address: 'Merritt Island, FL 32952' },
    { key: 'miChristianSchool', create: true, name: 'Merritt Island Christian School', city: 'Merritt Island, FL', lat: 28.3560, lng: -80.6760, indoor: true, access: 'private', venue_type: 'school', address: 'Merritt Island, FL 32952' },
];

// Merge all venues
const allVenues = [...venues, ...venues2];


// ═══════════════════════════════════════════════════════════════════
//  RUNS — All scheduled run definitions
//  Reference: venueKey must match a venue key above
// ═══════════════════════════════════════════════════════════════════

const allRuns = [
    // ── SAN FRANCISCO ────────────────────────────────────────────
    r('embarcaderoYmca', 'Morning Run — "The Chalkboard"', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Serious, corporate, efficient. High intensity. M-F before 8:30a.', durationMinutes: 90, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 7, minute: 0 }] }),
    r('embarcaderoYmca', 'Lunch Run — Embarcadero YMCA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Midday corporate crowd. High intensity.', durationMinutes: 90, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 11, minute: 30 }] }),
    r('potreroHillRec', 'Midday Open Run — Potrero Hill', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Midday work-break crowd. Scenic views. T-Th 10a-2p.', durationMinutes: 240, maxPlayers: 20, schedule: [{ days: [D.Tue, D.Thu], hour: 10, minute: 0 }] }),
    r('potreroHillRec', 'Saturday Open Run — Potrero Hill', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Long Saturday window. 10a-4p. Scenic views.', durationMinutes: 360, maxPlayers: 20, schedule: [{ days: [D.Sat], hour: 10, minute: 0 }] }),
    r('koretCenter', 'Weekend Morning Run — USF Koret', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Younger/Stronger." High skill ceiling. Collegiate atmosphere. 8:30a.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Sat, D.Sun], hour: 8, minute: 30 }] }),
    r('koretCenter', 'Weekday Afternoon — USF Koret', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Collegiate atmosphere. Afternoon drop-in M-F.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 15, minute: 0 }] }),
    r('richmondRec', 'Evening Drop-in — Richmond Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Neighborhood regulars. Rare evening public run. Wed/Fri 8:45p.', durationMinutes: 90, maxPlayers: 12, schedule: [{ days: [D.Wed, D.Fri], hour: 20, minute: 45 }] }),
    r('equinoxSF', 'Noon Pickup — Equinox SF', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Tech Executive" run. High cost, high quality. M/W/F noon.', durationMinutes: 90, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Wed, D.Fri], hour: 12, minute: 0 }] }),
    r('equinoxSF', 'Sunday Morning — Equinox SF', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Tech Executive" run. Sunday morning session.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Sun], hour: 9, minute: 0 }] }),
    r('ucsfBakar', 'Evening Drop-in — UCSF Bakar', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Biotech/Medical crowd. NBA court. Modern facility. Tue/Thu evenings.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Tue, D.Thu], hour: 18, minute: 0 }] }),
    r('bettyAnnOng', "Women's Run — Betty Ann Ong", { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Tailored programming. Historic basketball hub. Tuesday 10a-3p.', durationMinutes: 300, maxPlayers: 16, schedule: [{ days: [D.Tue], hour: 10, minute: 0 }] }),
    r('missionRec', 'Drop-in — Mission Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Urban core. Thu/Fri 9a-5p. Inconsistent weekends due to youth leagues.', durationMinutes: 480, maxPlayers: 20, schedule: [{ days: [D.Thu, D.Fri], hour: 9, minute: 0 }] }),
    r('panhandle', 'Afternoon Run — The Panhandle', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Reliable, competitive but friendly. Outdoor courts. Free.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Thu, D.Fri, D.Sat, D.Sun], hour: 14, minute: 0 }] }),

    // ── OAKLAND / EAST BAY ───────────────────────────────────────
    r('ogp', 'Evening Leagues & Runs — OGP', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"The Pro Run." High-level leagues & organized runs. 4 pristine courts. M-F 6-10p.', durationMinutes: 240, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 18, minute: 0 }] }),
    r('bushrod', 'Sunday Service — Bushrod Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Sunday Service." The "Curry Court." Elite pickup. ~$10.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 16, minute: 0 }] }),
    r('oakYmca', 'The Lunch Run — Oakland YMCA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"The Lunch Run." Lincoln Square diaspora. High IQ, older demographic. M-F 11:30a-1:30p.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 11, minute: 30 }] }),
    r('oakYmca', 'After Work Run — Oakland YMCA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"The After Work Run." Younger, faster, chaotic. M-Th 5-8p.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu], hour: 17, minute: 0 }] }),
    r('alamedaPt', 'Sunday Evening — Alameda Point', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '"The Overflow." 18+ Only. 4-hour window. $8-$10.', durationMinutes: 240, maxPlayers: 20, schedule: [{ days: [D.Sun], hour: 18, minute: 0 }] }),
    r('rainbow', 'Midday Grind — Rainbow Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Eastside Grinder." Physical. "Jason Richardson Gym." M-F 11a-2p. Free.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 11, minute: 0 }] }),
    r('bladium', 'Barbz Open Gym — Bladium', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Barbz Open Gym." "Queen Court" format (Winner Stays). Fri 8-11p. ~$15.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 20, minute: 0 }] }),
    r('headRoyce', "Women's Run — Pick Her Up", { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Premier recurring women\'s run in the East Bay. Sun 9-11a. $10.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 9, minute: 0 }] }),
    r('fmSmith', 'Neighborhood Run — FM Smith Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Neighborhood Run." Territorial. Sun late AM. Free.', durationMinutes: 180, maxPlayers: 12, schedule: [{ days: [D.Sun], hour: 11, minute: 0 }] }),
    r('iraJinkins', 'Evening Speed Run — Ira Jinkins', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"The Speed Run." Collegiate-sized floor. M/T/Th evenings. Free.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Thu], hour: 18, minute: 30 }] }),
    r('mosswood', 'Weekend Afternoon — Mosswood Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Historic East Bay run. Games start ~2–3pm. Can be hit-or-miss.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Fri, D.Sat], hour: 14, minute: 0 }] }),

    // ── MARIN COUNTY ─────────────────────────────────────────────
    r('strawberryRec', 'Veterans Run — Strawberry Rec', { gameMode: '5v5', courtType: 'full', ageRange: '30+', notes: '30+ only. Games to 15 or 10-min cap. $10 drop-in or $50 (10-pass).', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon], hour: 19, minute: 0 }] }),
    r('strawberryRec', 'Open Run — Strawberry Rec', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '18+. Games to 15 or 10-min cap. $10 drop-in or $50 (10-pass). Year-round.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Thu], hour: 19, minute: 0 }] }),
    r('boroCC', 'Evening Drop-In — Boro CC (Pickleweed)', { gameMode: '5v5', courtType: 'full', ageRange: '16+', notes: '16+ drop-in. $4/session. High-volume, mixed skill.', durationMinutes: 120, maxPlayers: 16, schedule: [{ days: [D.Mon, D.Wed, D.Fri], hour: 18, minute: 30 }] }),
    r('hillGym', 'Summer Open Gym — Hill Gymnasium', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '18+. Seasonal: Jun 22–Aug 3, 2026 only. ~$64 season pass.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon], hour: 18, minute: 0 }] }),

    // ── CHICAGO ───────────────────────────────────────────────────
    r('eastBank', 'Morning Run — East Bank Club', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Membership facility. 2 full gyms in River North. High reliability.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 7, minute: 0 }] }),
    r('eastBank', 'Lunch Run — East Bank Club', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Membership facility. Midday games, 2 full gyms.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed, D.Fri], hour: 12, minute: 0 }] }),
    r('rayMeyer', 'Evening Run — Ray Meyer (DePaul)', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'DePaul university facility. Membership required.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu], hour: 18, minute: 0 }] }),
    r('britishSchool', 'Weekend Morning — All Ball @ British School', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'All Ball organized run. $15. Select skill level. Sat & Sun 8-9:30am.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Sat, D.Sun], hour: 8, minute: 0 }] }),
    r('britishSchool', 'Friday Night — Grab A Game @ British School', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Grab A Game organized. Weekly reservation. Fri 7:30-9pm.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 19, minute: 30 }] }),
    r('bennettDay', 'Thursday Night — All Ball @ Bennett Day', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'All Ball organized. $13. Co-ed / Select skill level.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Thu], hour: 20, minute: 30 }] }),
    r('bennettDay', 'Sunday Afternoon — All Ball @ Bennett Day', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'All Ball organized. $13. Co-ed / Select skill level.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 13, minute: 0 }] }),
    r('pulaskiPark', 'Monday Night — Pulaski Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '$12 reserved. Casual skill level. Mon 6:30-8:30pm.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon], hour: 18, minute: 30 }] }),
    r('irvingParkYMCA', 'Open Gym — Irving Park YMCA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Membership or $10 day pass. Daily open gym. Small & large gyms.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat], hour: 11, minute: 0 }] }),
    r('broadwayArmory', 'Midday Run — Broadway Armory', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '$10 drop-in. Mon & Wed 12-2pm. 18+ open run. Park District.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed], hour: 12, minute: 0 }] }),
    r('cfCourtCafe', 'Weeknight Run — CF Court Cafe', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '$10 reserved. Casual skill level. Tue & Wed 7:15pm.', durationMinutes: 105, maxPlayers: 14, schedule: [{ days: [D.Tue, D.Wed], hour: 19, minute: 15 }] }),
    r('cfCourtCafe', 'Saturday Morning — CF Court Cafe', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '$10 reserved. Casual skill level. Sat 10am.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Sat], hour: 10, minute: 0 }] }),
    r('comedRec', 'Early Morning — ComEd Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '$6 drop-in. M-F 7-9am. Open gym / open turf.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 7, minute: 0 }] }),
    r('comedRec', 'Monday Night — ComEd Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '$6 drop-in. Mon 8:30pm. Open gym.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Mon], hour: 20, minute: 30 }] }),
    r('fosterPark', 'Saturday Morning — Foster Park (FPBL)', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Foster Park Basketball League cadence. 11am–1:45pm Saturday.', durationMinutes: 165, maxPlayers: 20, schedule: [{ days: [D.Sat], hour: 11, minute: 0 }] }),
    r('fosterPark', 'Weeknight Run — Foster Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'League nights. Mon/Wed/Thu/Fri evenings.', durationMinutes: 150, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Wed, D.Thu, D.Fri], hour: 18, minute: 0 }] }),
    r('humboldtPark', 'Sunday Morning — Humboldt Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Church" pickup run. Sunday mornings. Outdoor.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Sun], hour: 10, minute: 0 }] }),

    // ── SEATTLE ───────────────────────────────────────────────────
    r('psbl', 'Dawn Patrol 7:45 AM — PSBL Sodo', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Dawn Patrol." Most consistent competitive run. Pre-registration. $15.', durationMinutes: 75, maxPlayers: 12, schedule: [{ days: [D.Sat], hour: 7, minute: 45 }] }),
    r('psbl', 'Saturday 9:00 AM — PSBL Sodo', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Dawn Patrol." Second session. Pre-registration. $15.', durationMinutes: 75, maxPlayers: 12, schedule: [{ days: [D.Sat], hour: 9, minute: 0 }] }),
    r('psbl', 'Lunch Pail — PSBL Sodo', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Lunch Pail." Strict 1-hour run for downtown workers. $15.', durationMinutes: 60, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 0 }] }),
    r('millerCC', 'Friday Evening — Miller CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Prime Time Public." Rare evening public run. Capitol Hill. Free.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 18, minute: 0 }] }),
    r('rainierBeach', 'Sunday Afternoon — Rainier Beach CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"South End Sunday." Destination run. Free.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Sun], hour: 13, minute: 0 }] }),
    r('wac', 'Golden Masters — WAC', { gameMode: '5v5', courtType: 'full', ageRange: '50+', notes: '"Golden Masters." 50+ only. Members/guests. Tue/Thu 7:30-8:30am.', durationMinutes: 60, maxPlayers: 12, schedule: [{ days: [D.Tue, D.Thu], hour: 7, minute: 30 }] }),
    r('wac', 'Executive Lunch — WAC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Executive Lunch." Members only. Fri noon-1p.', durationMinutes: 60, maxPlayers: 12, schedule: [{ days: [D.Fri], hour: 12, minute: 0 }] }),
    r('sac', 'Saturday Morning — Seattle Athletic Club', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Member Run." Best private run outside WAC. Saturday mornings.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Sat], hour: 9, minute: 0 }] }),
    r('greenLake', 'Mid-Day Run — Green Lake CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Old Guard." Historic gym. M/W/F ~10am-2pm. Free.', durationMinutes: 240, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed, D.Fri], hour: 10, minute: 0 }] }),
    r('loyalHeights', 'Afternoon Open — Loyal Heights CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Volume Play." 1:30-4:45p. Hit-or-miss. M-F. Free.', durationMinutes: 195, maxPlayers: 16, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 13, minute: 30 }] }),
    r('delridge', 'Afternoon Drop-in — Delridge CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Westside Options." Tu/Th/F 12:30-5p. Free.', durationMinutes: 270, maxPlayers: 14, schedule: [{ days: [D.Tue, D.Thu, D.Fri], hour: 12, minute: 30 }] }),
    r('greenLakePark', 'Weekend Evening — Green Lake Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Outdoor summer staple. Best in warmer months. Free.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Sat, D.Sun], hour: 17, minute: 0 }] }),

    // ── PORTLAND ──────────────────────────────────────────────────
    r('columbiaChristian', 'Saturday Noon Run — Columbia Christian', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Pick to Play". $13-$16. Refs/Scoreboard. Jerseys required.', durationMinutes: 180, maxPlayers: 12, schedule: [{ days: [D.Sat], hour: 12, minute: 0 }] }),
    r('columbiaChristian', 'Saturday 4:20 PM — Columbia Christian', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Pick to Play". $13-$16. Refs/Scoreboard. Jerseys required.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Sat], hour: 16, minute: 20 }] }),
    r('columbiaChristian', 'Sunday Morning — Columbia Christian', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Pick to Play". $13-$16. 9:20a-1p.', durationMinutes: 220, maxPlayers: 12, schedule: [{ days: [D.Sun], hour: 9, minute: 20 }] }),
    r('neCC', 'Monday Lunch Run — NE Community Center', { gameMode: '4v4', courtType: 'full', ageRange: 'open', notes: '"Lunch Run". Games to 9. Sit after 2 wins. 10a-12p.', durationMinutes: 120, maxPlayers: 10, schedule: [{ days: [D.Mon], hour: 10, minute: 0 }] }),
    r('neCC', 'Tue/Thu Lunch Run — NE Community Center', { gameMode: '4v4', courtType: 'full', ageRange: 'open', notes: '"Lunch Run". Games to 9. Sit after 2 wins. 12:30-2:30p.', durationMinutes: 120, maxPlayers: 10, schedule: [{ days: [D.Tue, D.Thu], hour: 12, minute: 30 }] }),
    r('mittlemanJCC', 'Noon Ball — Mittleman JCC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Noon Ball". High IQ. Guest pass available. M/W/F 12-2p.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Wed, D.Fri], hour: 12, minute: 0 }] }),
    r('mattDishman', 'Monday Evening — Matt Dishman CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"The Hub". Historic. High intensity. $6 drop-in.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon], hour: 18, minute: 0 }] }),
    r('mattDishman', 'Friday Evening — Matt Dishman CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"The Hub". Historic. High intensity. $6 drop-in.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 18, minute: 0 }] }),
    r('warnerPacific', 'Sunday 10:45 AM — Warner Pacific', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"League Style". PortlandBasketball. Join a "mercenary" team.', durationMinutes: 140, maxPlayers: 12, schedule: [{ days: [D.Sun], hour: 10, minute: 45 }] }),
    r('warnerPacific', 'Sunday 1:20 PM — Warner Pacific', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"League Style". PortlandBasketball. Join a "mercenary" team.', durationMinutes: 140, maxPlayers: 12, schedule: [{ days: [D.Sun], hour: 13, minute: 20 }] }),
    r('cascadeAthletic', 'Tuesday 40+ Run — Cascade Athletic Club', { gameMode: '4v4', courtType: 'full', ageRange: '40+', notes: '"Suburban/Masters". 40+ night. Member sponsor required.', durationMinutes: 120, maxPlayers: 10, schedule: [{ days: [D.Tue], hour: 17, minute: 0 }] }),
    r('cascadeAthletic', 'Thursday League — Cascade Athletic Club', { gameMode: '4v4', courtType: 'full', ageRange: 'open', notes: '"Suburban/Masters". Thursday league play. Member sponsor required.', durationMinutes: 120, maxPlayers: 10, schedule: [{ days: [D.Thu], hour: 18, minute: 0 }] }),
    r('psu', 'Campus Run — PSU', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Campus Run". Student-heavy. Community access $9. Mon/Wed 6-10p.', durationMinutes: 240, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Wed], hour: 18, minute: 0 }] }),
    r('southwestCC', 'Sunday 30+ Team Play — Southwest CC', { gameMode: '5v5', courtType: 'full', ageRange: '30+', notes: '"Family/30+". Dedicated 30+ slot. Sunday morning.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 9, minute: 0 }] }),
    r('irvingPark', 'Weekend Afternoon — Irving Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'High-skill outdoor run. Covered court. Free.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Sat, D.Sun], hour: 13, minute: 0 }] }),

    // ── LOS ANGELES ──────────────────────────────────────────────
    r('crosscourt', '5:30 PM Session — CrossCourt DTLA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Corporate Cardio". 1-hour sessions. 5-minute games. Tue-Fri.', durationMinutes: 60, maxPlayers: 12, schedule: [{ days: [D.Tue, D.Wed, D.Thu, D.Fri], hour: 17, minute: 30 }] }),
    r('crosscourt', '6:30 PM Session — CrossCourt DTLA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Corporate Cardio". 1-hour sessions. 5-minute games. Tue-Fri.', durationMinutes: 60, maxPlayers: 12, schedule: [{ days: [D.Tue, D.Wed, D.Thu, D.Fri], hour: 18, minute: 30 }] }),
    r('mccambridge', 'Sunday Afternoon — McCambridge Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"The Civilized Run". Sign-in sheet. Good culture. Sun 1-4p.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Sun], hour: 13, minute: 0 }] }),
    r('equinoxLA', 'Executive Lunch — Equinox LA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Executive Lunch". High-level. M-F noon-2p.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 0 }] }),
    r('equinoxLA', 'Friday Evening — Equinox LA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Friday nights prime for members.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Fri], hour: 18, minute: 0 }] }),
    r('westwoodRec', 'Adult Open — Westwood Rec', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '"The Lunch Break". Protected adult time. Tue/Thu 10a-12:30p.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Tue, D.Thu], hour: 10, minute: 0 }] }),
    r('laac', 'Noon Pickup — LA Athletic Club', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Historic". John R. Wooden court. "Old Man Game." M-F noon.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 0 }] }),
    r('laac', 'Evening Run — LA Athletic Club', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Historic". Tue/Thu evenings.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Tue, D.Thu], hour: 18, minute: 0 }] }),
    r('vnso', 'Evening Outdoor Run — VNSO', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"The Cages". Lighted outdoor courts every night. Daily evenings.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat, D.Sun], hour: 18, minute: 30 }] }),
    r('uclaWooden', 'Friday Evening — UCLA Wooden Center', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Campus Run". High skill. Community membership required. Fri 5p-close.', durationMinutes: 240, maxPlayers: 20, schedule: [{ days: [D.Fri], hour: 17, minute: 0 }] }),
    r('uclaWooden', 'Weekend Morning — UCLA Wooden Center', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Campus Run". High skill. Community membership required. Sat/Sun.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Sat, D.Sun], hour: 9, minute: 0 }] }),
    r('panPacific', 'Open Run — Pan Pacific Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"High Risk". Vulnerable to youth league blackouts. Check schedule.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Sat], hour: 10, minute: 0 }] }),
    r('veniceBeach', 'Morning Run — Venice Beach', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Court 1 elite "winner stays" to 11 straight. Arrive early.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat], hour: 10, minute: 0 }] }),
    r('veniceBeach', 'Afternoon Run — Venice Beach', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Second wave. Still competitive. Court 1 elite. Free.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 16, minute: 0 }] }),
    r('veniceBeach', 'Sunday League/Pickup — Venice Beach', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'VBL dominates many Sundays in summer. Off-season: open pickup.', durationMinutes: 240, maxPlayers: 20, schedule: [{ days: [D.Sun], hour: 12, minute: 0 }] }),

    // ── NEW YORK CITY ────────────────────────────────────────────
    r('chelseaRec', 'Sunday Morning — Chelsea Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Consistent Sunday morning run. Medium-high reliability. Low cost.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 8, minute: 0 }] }),
    r('thePost', 'Friday Night — The Post BK', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Dedicated/Hardcore." Friday night elite run in Brooklyn. ~$15-20.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 21, minute: 0 }] }),
    r('bballCity', 'Evening League — Basketball City', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Data Calibration." Mon-Thu league play. Stats tracked.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu], hour: 18, minute: 30 }] }),
    r('crossIslandY', 'Dawn Run — Cross Island YMCA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Dedicated Regulars." M-Th 5:30 AM. Membership required.', durationMinutes: 90, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu], hour: 5, minute: 30 }] }),
    r('ny92', 'Midday Run — 92NY', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Corporate/Stable." M-Th 11:45 AM. Membership required.', durationMinutes: 75, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu], hour: 11, minute: 45 }] }),
    r('west4th', 'Weekend Afternoon — The Cage (West 4th)', { gameMode: '3v3', courtType: 'half', ageRange: 'open', notes: 'Undersized cage court; very physical/fast. Winner stays. Peak noon to dusk.', durationMinutes: 300, maxPlayers: 20, schedule: [{ days: [D.Sat, D.Sun], hour: 12, minute: 0 }] }),
    r('west4th', 'Weekday Evening — The Cage (West 4th)', { gameMode: '3v3', courtType: 'half', ageRange: 'open', notes: 'After-work runs. Physical, fast pace. Season/league dependent.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 17, minute: 0 }] }),
    r('rucker', 'Morning Pickup — Rucker Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Historic Harlem court. Best pickup mornings/early afternoons.', durationMinutes: 240, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat, D.Sun], hour: 10, minute: 0 }] }),

    // ── TEXAS ─────────────────────────────────────────────────────
    r('austinRec', 'Thursday Open Gym (Prime) — Austin Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Prime open gym. Thu 9a-11:30p. Free / low cost.', durationMinutes: 150, maxPlayers: 16, schedule: [{ days: [D.Thu], hour: 9, minute: 0 }] }),
    r('austinRec', 'Tuesday Open Gym — Austin Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Tuesday open gym session. Tue 9a-5p. Free / low cost.', durationMinutes: 480, maxPlayers: 16, schedule: [{ days: [D.Tue], hour: 9, minute: 0 }] }),
    r('southAustinRec', 'Thursday Evening — South Austin Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Thu 6-9pm open gym. Free / low cost.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Thu], hour: 18, minute: 0 }] }),
    r('southAustinRec', 'Saturday Midday — South Austin Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Sat 12-3pm open gym. Free / low cost.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Sat], hour: 12, minute: 0 }] }),
    r('northwestRec', '"Nooners" — Northwest Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Nooners." Standing game. Tue/Thu 11:30a-1:15p. Free / low cost.', durationMinutes: 105, maxPlayers: 12, schedule: [{ days: [D.Tue, D.Thu], hour: 11, minute: 30 }] }),
    r('fondeRec', 'Elite Lunch Run — Fonde Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Legend." The premier Houston run. Elite pickup. M-F 11a-1p. Free.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 11, minute: 0 }] }),
    r('fondeRec', 'Saturday Morning — Fonde Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Legend." Saturday morning session. Free.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Sat], hour: 9, minute: 0 }] }),
    r('fondeRec', 'Evening Run — Fonde Rec ("No Excuses")', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"No Excuses" culture. Elite intensity. Mon–Thu evenings.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu], hour: 18, minute: 0 }] }),
    r('reverchonPark', 'After-Work Run — Reverchon Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Legendary after-work outdoor run. Lit courts. Peak 6–7pm. Free.', durationMinutes: 90, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 18, minute: 0 }] }),

    // ── VIRGINIA ──────────────────────────────────────────────────
    r('tjCC', 'Competitive Run — Thomas Jefferson CC', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adults Only. 3 courts. Premier competitive run in NOVA.', durationMinutes: 135, maxPlayers: 20, schedule: [{ days: [D.Tue, D.Thu], hour: 18, minute: 30 }] }),
    r('tjCC', 'Drop-in Run — Thomas Jefferson CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'General drop-in. 2 courts. Mixed competition.', durationMinutes: 255, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Wed, D.Fri], hour: 16, minute: 30 }] }),
    r('lubberRun', 'Lunch Run — Lubber Run CC', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adult full court. High-efficiency lunch run.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 0 }] }),
    r('charlesDrew', 'Evening Run — Charles Drew CC', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adults Only. Alternative to TJ.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Tue, D.Thu], hour: 18, minute: 0 }] }),
    r('langstonBrown', 'Monday Night — Langston-Brown CC', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adult drop-in. Best Monday nights in Arlington.', durationMinutes: 165, maxPlayers: 14, schedule: [{ days: [D.Mon], hour: 18, minute: 0 }] }),
    r('walterReed', 'Friday Night — Walter Reed CC', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adult drop-in. End-of-week run.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 18, minute: 0 }] }),
    r('walterReed', 'Senior Run — Walter Reed CC', { gameMode: '5v5', courtType: 'full', ageRange: '55+', notes: '55+ Only. Senior seeding run.', durationMinutes: 135, maxPlayers: 12, schedule: [{ days: [D.Wed], hour: 12, minute: 0 }] }),
    r('gmuActivities', 'Evening Run — GMU Activities Bldg', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Gym A. 18+ only. Protected time. Community membership req.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Tue, D.Fri], hour: 18, minute: 0 }] }),
    r('stJames', 'League Play — The St. James', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Premium facility. Organized leagues. Rental fees apply.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Sat], hour: 10, minute: 0 }] }),
    r('bellemeade', 'Saturday Morning — Bellemeade CC', { gameMode: '5v5', courtType: 'full', ageRange: '30+', notes: '30+ Only. Mature run, organized play. Free.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Sat], hour: 8, minute: 0 }] }),
    r('easternHenrico', 'Evening Run — Eastern Henrico Rec', { gameMode: '5v5', courtType: 'full', ageRange: '30+', notes: '30+ Only. Suburban mature run. Free.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed], hour: 17, minute: 30 }] }),
    r('deepRun', 'Sunday Afternoon — Deep Run Rec', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '18+ Only. Weekend afternoon. Free.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 15, minute: 0 }] }),
    r('powhatanHill', 'Lunch Run — Powhatan Hill CC', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '18+ lunch run. Free.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 12, minute: 0 }] }),
    r('tbSmith', 'Lunch Run — T.B. Smith CC', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '18+ lunch run. Strict 1-hr window. Free.', durationMinutes: 60, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 0 }] }),
    r('vcuCarySt', 'Open Gym — VCU Cary St Gym', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Student/Community mix. High volume. Membership required.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat, D.Sun], hour: 10, minute: 0 }] }),
    r('swiftCreekY', 'Sunrise Ball — Swift Creek YMCA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Sunrise ball. Informal group. YMCA membership required.', durationMinutes: 60, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 5, minute: 0 }] }),
    r('kempsvilleRec', 'Sunrise Ball — Kempsville Rec', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Sunrise ball. 18+. Committed crowd.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed, D.Fri], hour: 5, minute: 0 }] }),
    r('kempsvilleRec', 'Evening Run — Kempsville Rec', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adult evening run. Pass required. High demand.', durationMinutes: 165, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed], hour: 18, minute: 0 }] }),
    r('princessAnne', 'Breakfast Ball — Princess Anne Rec', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Breakfast ball. 18+.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed], hour: 5, minute: 0 }] }),
    r('princessAnne', 'Lunch Run — Princess Anne Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Lunch run. Sign-up at 11:45a.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed], hour: 12, minute: 0 }] }),
    r('williamsFarm', 'Evening Run — Williams Farm Rec', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adult evening run. 18+.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Tue, D.Thu], hour: 18, minute: 0 }] }),
    r('bowCreek', 'Sunday Run — Bow Creek Rec', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adult day. 18+. Weekend run.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 11, minute: 0 }] }),
    r('vbFieldHouse', 'Drop-In — VB Field House', { gameMode: '5v5', courtType: 'full', ageRange: '16+', notes: 'Pay-to-play drop-in. 16+. $5.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat, D.Sun], hour: 17, minute: 0 }] }),

    // ── ICONIC — Philly, DC, Detroit, Cleveland, LV, Miami, Atlanta ──
    r('hankGathers', 'Weekend Afternoon — Hank Gathers Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Intense community-rooted run. 12–4pm weekends.', durationMinutes: 240, maxPlayers: 20, schedule: [{ days: [D.Sat, D.Sun], hour: 12, minute: 0 }] }),
    r('hankGathers', 'Weekday Evening — Hank Gathers Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'After-work evening run 5–8pm. North Philly staple.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 17, minute: 0 }] }),
    r('joeDumars', 'Evening Run — Joe Dumars Fieldhouse', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Open late until ~2am. Volume gym. Run quality varies.', durationMinutes: 360, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat, D.Sun], hour: 20, minute: 0 }] }),
    r('mandelJCC', 'Sunday Morning — Mandel JCC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Consistent indoor pickup. 7:30–11am Sundays. Membership/day pass.', durationMinutes: 210, maxPlayers: 16, schedule: [{ days: [D.Sun], hour: 7, minute: 30 }] }),
    r('mandelJCC', 'Tuesday Early Bird — Mandel JCC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Early-morning run 5:30–7:30am. Before-work crowd.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Tue], hour: 5, minute: 30 }] }),
    r('atlasLV', 'Weekend Organized Run — Atlas Basketball', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Paid organized run (~$12). Officiated. Noon–2pm weekends.', durationMinutes: 120, maxPlayers: 20, schedule: [{ days: [D.Sat, D.Sun], hour: 12, minute: 0 }] }),
    r('flamingoPark', 'Morning Run — Flamingo Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Daylight-heavy outdoor run. 7am–2pm. Free.', durationMinutes: 420, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat, D.Sun], hour: 7, minute: 0 }] }),
    r('ltCoralGables', 'Early Morning Pickup — Life Time Coral Gables', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Premium "executive" pickup. 5–7am. Membership required ($150+/mo).', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 5, minute: 0 }] }),
    r('ltBuckhead', 'Morning Pickup — Life Time Buckhead', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Country club" hoops. Morning. Membership required.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 6, minute: 0 }] }),
    r('ltBuckhead', 'Evening Pickup — Life Time Buckhead', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'After-work run. Formation-based. Membership required.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 18, minute: 0 }] }),

    // ── BOSTON / CAMBRIDGE ────────────────────────────────────────
    r('cambridgeAC', 'Lunch Run — Cambridge Athletic Club', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '"Lunch Run"; high consistency; $20 day pass filter.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 0 }] }),
    r('cambridgeAC', 'Evening Run — Cambridge Athletic Club', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Evening run; competitive; $20 day pass.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Wed, D.Fri], hour: 18, minute: 0 }] }),
    r('cambridgeAC', 'Weekend Midday Run — Cambridge Athletic Club', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Weekend midday run; reliable.', durationMinutes: 120, maxPlayers: 12, schedule: [{ days: [D.Sat, D.Sun], hour: 12, minute: 0 }] }),
    r('wangYmca', 'Early-Bird Run — Wang YMCA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Early-bird run during Shared Gym; membership; schedule can shift with other programs.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu], hour: 6, minute: 0 }] }),
    r('tobinCC', "Women's Open Gym — BCYF Tobin", { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: "Women's Open Gym; free (PerfectMind registration).", durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Thu], hour: 19, minute: 0 }] }),
    r('trackNB', 'Thursday Pickup — The TRACK at New Balance', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Hosted pickup event (e.g., Hub Sports); ~$15; pristine court.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Thu], hour: 19, minute: 30 }] }),
    r('curtisHall', 'Morning Open Gym 30+ — BCYF Curtis Hall', { gameMode: '5v5', courtType: 'full', ageRange: '30+', notes: 'Adults 30+; registration required; free.', durationMinutes: 90, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 8, minute: 0 }] }),
    r('oakSquareY', 'Friday Open Gym — Oak Square YMCA', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Short open gym window; leagues dominate other weeknights; membership.', durationMinutes: 70, maxPlayers: 12, schedule: [{ days: [D.Fri], hour: 17, minute: 30 }] }),
    r('pinoCC', 'Saturday Teen Open Gym — BCYF Pino', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Teen Open Gym (youth only).', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Sat], hour: 9, minute: 0 }] }),
    r('robertoClementeField', 'After-Work Run — Roberto Clemente Field', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Outdoor "mecca"; high volume; wind can affect play; seasonal.', durationMinutes: 180, maxPlayers: 20, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 17, minute: 0 }] }),
    r('smithPlayground', 'Night Owl Run — Smith Playground', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Lighted "night owl" run; strong evening reliability (weather permitting).', durationMinutes: 120, maxPlayers: 16, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri, D.Sat, D.Sun], hour: 20, minute: 0 }] }),
    r('ringerPark', 'Weekend Afternoon — Ringer Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Consistent outdoor runs; student/young-pro mix; seasonal.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Sat, D.Sun], hour: 14, minute: 0 }] }),
    r('hoytField', 'Weekend Morning — Hoyt Field', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Outdoor overflow; "decent activity"; seasonal.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Sat, D.Sun], hour: 10, minute: 0 }] }),

    // ── PENINSULA (San Mateo County / South Bay) ─────────────────
    r('sanMateoHS', 'Monday Night Run — San Mateo HS', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '$4 drop-in fee for adults, $3 for youth (with HS ID). Ages 18+ for adult play.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Mon], hour: 19, minute: 0 }] }),
    r('kingCC', 'Evening Drop-in — King Community Center', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Free. Ages 18+. All skill levels welcome, teams formed on a drop-in basis.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Tue, D.Thu], hour: 18, minute: 30 }] }),
    r('redMorton', 'Lunch Run — Red Morton CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Multi-visit card or drop-in fee required. Weekday lunch window.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 11, minute: 30 }] }),
    r('redMorton', 'Wednesday Night — Red Morton CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Evening session. Drop-in fee. Wed 7:00–10:00 PM.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Wed], hour: 19, minute: 0 }] }),
    r('sanCarlosYouth', 'Sunday Drop-In — San Carlos Youth Center', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Adult Drop-In Basketball. $5 drop-in fee per person.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 15, minute: 0 }] }),
    r('arrillagaGym', 'Morning Drop-In — Arrillaga Gym', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '$2 drop-in fee. Tue/Fri: 8 AM–1 PM; Thu/Sat: 8 AM–1 PM & 5–8 PM.', durationMinutes: 300, maxPlayers: 16, schedule: [{ days: [D.Tue, D.Fri], hour: 8, minute: 0 }] }),
    r('arrillagaGym', 'Thursday/Saturday Extended — Arrillaga Gym', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '$2 drop-in fee. Morning 8 AM–1 PM + evening 5–8 PM. Tue 6–8 PM is ladies only.', durationMinutes: 300, maxPlayers: 16, schedule: [{ days: [D.Thu, D.Sat], hour: 8, minute: 0 }] }),
    r('onettaHarris', 'Afternoon Pickup — Onetta Harris CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: '$1 drop-in fee for afternoon pickup basketball.', durationMinutes: 210, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 0 }] }),
    r('terrabayGym', 'Midday Open Gym — Terrabay Gym', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: '$4 for adults (18+), $3 for juniors/seniors. Saturdays 12–3 PM juniors only; Sundays 12:30–3 PM adults only.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 30 }] }),
    r('terrabayGym', 'Sunday Adults Only — Terrabay Gym', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Adults only. $4 drop-in. Sun 12:30–3 PM.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 12, minute: 30 }] }),
    r('sanBrunoRec', 'Evening Open Gym — San Bruno Rec', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Adults (17+). $2 fee for children 16 and under. Must bring ID.', durationMinutes: 105, maxPlayers: 14, schedule: [{ days: [D.Mon, D.Wed], hour: 19, minute: 30 }] }),
    r('brewerIsland', 'Saturday Night Open Gym — Brewer Island', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Ages 16+. $5 per night drop-in or $15/month. Non-competitive pickup and free play.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Sat], hour: 19, minute: 0 }] }),
    r('whismanSC', 'Sunday Evening — Whisman Sports Center', { gameMode: '5v5', courtType: 'full', ageRange: '18+', notes: 'Ages 18+. $3 drop-in fee. Restricted to Mountain View residents or employees of MV businesses.', durationMinutes: 150, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 17, minute: 0 }] }),

    // ── MERRITT ISLAND / SPACE COAST ─────────────────────────────
    r('woodySimpson', 'Friday Evening Run — Woody Simpson Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Tier-1 outdoor hub; lighted courts enable night runs; best documented competitive run is Friday evening.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Fri], hour: 18, minute: 0 }] }),
    r('kiwanisIsland', 'Friday Open Gym — Kiwanis Island Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Tier-2 indoor sanctuary. Schedule fragmented by rentals—verify monthly calendar/call ahead.', durationMinutes: 180, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 17, minute: 30 }] }),
    r('kiwanisIsland', 'Saturday Open Gym — Kiwanis Island Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Tier-2 indoor sanctuary. Sat 12–5:30 PM. Verify calendar.', durationMinutes: 330, maxPlayers: 14, schedule: [{ days: [D.Sat], hour: 12, minute: 0 }] }),
    r('healthFirstMI', 'Noon Ball — Health First Pro-Health', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Tier-1 private indoor court; consistent access; demographics skew 30–60+; guest passes available.', durationMinutes: 60, maxPlayers: 12, schedule: [{ days: [D.Mon, D.Tue, D.Wed, D.Thu, D.Fri], hour: 12, minute: 0 }] }),
    r('miRecCenter', 'Monday Evening — MI Rec Center', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Public indoor slot; can be displaced by volleyball/programming. Variable by calendar.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon], hour: 18, minute: 0 }] }),
    r('travisPark', 'Sunday Morning — Travis Park', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Off-island but in the rotation; higher-competition "Tiger Den" vibe; good alternative when MI options are quiet.', durationMinutes: 180, maxPlayers: 16, schedule: [{ days: [D.Sun], hour: 10, minute: 0 }] }),
    r('wickhamParkCC', 'Monday Morning — Wickham Park CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Mainland indoor fallback; tight 2-hour windows—punctuality matters.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Mon], hour: 9, minute: 0 }] }),
    r('wickhamParkCC', 'Friday Afternoon — Wickham Park CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Mainland indoor fallback; tight 2-hour windows—punctuality matters.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Fri], hour: 13, minute: 0 }] }),
    r('wickhamParkCC', 'Sunday Midday — Wickham Park CC', { gameMode: '5v5', courtType: 'full', ageRange: 'open', notes: 'Mainland indoor fallback; tight 2-hour windows—punctuality matters.', durationMinutes: 120, maxPlayers: 14, schedule: [{ days: [D.Sun], hour: 12, minute: 0 }] }),
];

// Export everything
module.exports = { venues: allVenues, runs: allRuns, D };

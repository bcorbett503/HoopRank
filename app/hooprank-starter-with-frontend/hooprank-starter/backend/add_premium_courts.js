/**
 * Add premium athletic club courts to the database
 * Bay Club SF and other high-end venues
 */

const fs = require('fs');
const path = require('path');

const newCourts = [
    // Bay Club San Francisco locations
    {
        id: "curated/bay-club-sf-greenwich-san-francisco-ca",
        name: "Bay Club SF @ 150 Greenwich",
        city: "San Francisco, CA",
        lat: 37.7985,
        lng: -122.4005,
        source: "curated",
        iconic: true,
        indoor: true,
        access: "members",
        signatureScore: 280
    },
    {
        id: "curated/bay-club-gateway-san-francisco-ca",
        name: "Bay Club Gateway",
        city: "San Francisco, CA",
        lat: 37.7941,
        lng: -122.3959,
        source: "curated",
        iconic: true,
        indoor: true,
        access: "members",
        signatureScore: 275
    },
    {
        id: "curated/bay-club-financial-district-san-francisco-ca",
        name: "Bay Club Financial District",
        city: "San Francisco, CA",
        lat: 37.7926,
        lng: -122.4036,
        source: "curated",
        iconic: true,
        indoor: true,
        access: "members",
        signatureScore: 275
    },
    // Additional SF venues
    {
        id: "curated/ymca-embarcadero-san-francisco-ca",
        name: "YMCA Embarcadero",
        city: "San Francisco, CA",
        lat: 37.7922,
        lng: -122.3917,
        source: "curated",
        iconic: true,
        indoor: true,
        access: "members",
        signatureScore: 250
    },
    {
        id: "curated/koret-ucsf-san-francisco-ca",
        name: "Koret Health & Recreation Center (UCSF)",
        city: "San Francisco, CA",
        lat: 37.7638,
        lng: -122.4574,
        source: "curated",
        iconic: true,
        indoor: true,
        access: "members",
        signatureScore: 245
    },
    // San Diego premium
    {
        id: "curated/bay-club-carmel-valley-san-diego-ca",
        name: "Bay Club Carmel Valley",
        city: "San Diego, CA",
        lat: 32.9295,
        lng: -117.2222,
        source: "curated",
        iconic: true,
        indoor: true,
        access: "members",
        signatureScore: 270
    },
    // Los Angeles premium
    {
        id: "curated/equinox-century-city-los-angeles-ca",
        name: "Equinox Century City",
        city: "Los Angeles, CA",
        lat: 34.0553,
        lng: -118.4175,
        source: "curated",
        iconic: true,
        indoor: true,
        access: "members",
        signatureScore: 265
    },
    {
        id: "curated/lifetime-calabasas-los-angeles-ca",
        name: "Life Time Calabasas",
        city: "Calabasas, CA",
        lat: 34.1475,
        lng: -118.6362,
        source: "curated",
        iconic: true,
        indoor: true,
        access: "members",
        signatureScore: 260
    }
];

// Read existing courts
const filePath = path.join(__dirname, 'src/courts-us-popular-expanded.json');
const existingCourts = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Check for duplicates by ID
const existingIds = new Set(existingCourts.map(c => c.id));
const courtsToAdd = newCourts.filter(c => !existingIds.has(c.id));

console.log(`Existing courts: ${existingCourts.length}`);
console.log(`New courts to add: ${courtsToAdd.length}`);

if (courtsToAdd.length > 0) {
    // Add new courts at the beginning (after signature cities)
    const signatureCourts = existingCourts.filter(c => c.signatureCity);
    const otherCourts = existingCourts.filter(c => !c.signatureCity);

    const updatedCourts = [...signatureCourts, ...courtsToAdd, ...otherCourts];

    // Write back
    fs.writeFileSync(filePath, JSON.stringify(updatedCourts));

    console.log(`\nAdded courts:`);
    courtsToAdd.forEach(c => console.log(`  - ${c.name} (${c.city})`));
    console.log(`\nTotal courts now: ${updatedCourts.length}`);
} else {
    console.log('No new courts to add (all already exist)');
}

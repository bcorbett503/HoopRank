#!/usr/bin/env node
/**
 * classify_venue_types.js
 * Auto-classifies all courts by venue_type based on name patterns.
 * 
 * Categories:
 *   school     - K-12 schools (Elementary, Middle, High School)
 *   college    - Universities, colleges, community colleges
 *   rec_center - YMCA, JCC, community/recreation centers
 *   gym        - Private gyms, fitness clubs, Bay Club, 24 Hour, etc.
 *   outdoor    - Outdoor courts (indoor = false)
 *   other      - Everything else (basketball academies, training facilities)
 */

const https = require('https');

const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function httpGet(path) {
    return new Promise((resolve, reject) => {
        https.get({ hostname: BASE, path, timeout: 30000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

function httpPost(path) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: BASE, path, method: 'POST',
            headers: { 'x-user-id': USER_ID }, timeout: 15000,
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve({ raw: data }); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// Classification rules - order matters (first match wins)
const SCHOOL_PATTERNS = [
    /\belementary\b/i,
    /\bmiddle school\b/i,
    /\bhigh school\b/i,
    /\bprep school\b/i,
    /\bpreparatory\b/i,
    /\bacademy\s+(gym|school|campus)\b/i,
    /\bschool\s+(gym|gymnasium)\b/i,
    /\bschool\b.*\bgym\b/i,
    /\bgym\b.*\bschool\b/i,
    /\bsecondary\b/i,
    /\bjunior high\b/i,
    /\bmontessori\b.*\b(school|gym)\b/i,
    /\bwaldorf school\b/i,
    /\bday school\b/i,
    /\bnursery school\b/i,
    /\bcity schools\b/i,
    /\b(catholic|christian|lutheran|baptist|episcopal)\b.*\bschool\b/i,
    /\bschool district\b/i,
];

const COLLEGE_PATTERNS = [
    /\bcollege\b/i,
    /\buniversity\b/i,
    /\bcommunity college\b/i,
    /\bstate university\b/i,
    /\bphysical education center\b/i,
    /\bPE center\b/i,
    /\brec center.*\b(college|university)\b/i,
];

const REC_CENTER_PATTERNS = [
    /\bYMCA\b/i,
    /\bJCC\b/i,
    /\bcommunity center\b/i,
    /\bcommunity gym\b/i,
    /\bcommunity gymnasium\b/i,
    /\brecreation\s*(center|department|district|club)\b/i,
    /\brec\s*center\b/i,
    /\brec\s*department\b/i,
    /\brecreation\b/i,
    /\bparks?\s*(&|and)\s*rec\b/i,
    /\bcivic center\b/i,
    /\bboys\s*(&|and)\s*girls\s*club\b/i,
    /\bMLK\b/i,
    /\bMartin Luther King\b/i,
    /\bPickleweed\b/i,
];

const GYM_PATTERNS = [
    /\bBay Club\b/i,
    /\b24 Hour Fitness\b/i,
    /\bAnytime Fitness\b/i,
    /\bPlanet Fitness\b/i,
    /\bpFit\b/i,
    /\bFitness\b/i,
    /\bhealth club\b/i,
    /\bathletic club\b/i,
    /\bgold'?s gym\b/i,
    /\bLA Fitness\b/i,
    /\bEquinox\b/i,
    /\bCrunch\b/i,
    /\bLifetime\b/i,
    /\bCrossfit\b/i,
    /\bcross fit\b/i,
    /\bgym\b$/i,   // ends with "Gym" only (avoid matching "School Gym")
];

function classify(name, indoor) {
    if (!indoor) return 'outdoor';

    // Check school patterns first (most specific)
    for (const pattern of SCHOOL_PATTERNS) {
        if (pattern.test(name)) return 'school';
    }
    for (const pattern of COLLEGE_PATTERNS) {
        if (pattern.test(name)) return 'college';
    }
    for (const pattern of REC_CENTER_PATTERNS) {
        if (pattern.test(name)) return 'rec_center';
    }
    for (const pattern of GYM_PATTERNS) {
        if (pattern.test(name)) return 'gym';
    }
    return 'other';
}

async function main() {
    console.log('Fetching all courts...\n');
    const courts = await httpGet('/courts');
    console.log(`Total courts: ${courts.length}\n`);

    // Classify each court
    const classified = {};
    const counts = {};
    for (const court of courts) {
        const type = classify(court.name, court.indoor);
        if (!classified[type]) classified[type] = [];
        classified[type].push(court);
        counts[type] = (counts[type] || 0) + 1;
    }

    console.log('=== CLASSIFICATION COUNTS ===');
    for (const [type, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
    }

    // Show samples for each type
    console.log('\n=== SAMPLES ===');
    for (const [type, cts] of Object.entries(classified)) {
        console.log(`\n${type.toUpperCase()} (${cts.length}):`);
        const samples = cts.slice(0, 5);
        for (const c of samples) {
            console.log(`  ${c.name} (${c.city})`);
        }
        if (cts.length > 5) console.log(`  ... and ${cts.length - 5} more`);
    }

    // Now apply classifications using the bulk API
    console.log('\n\n=== APPLYING CLASSIFICATIONS ===\n');

    // Strategy: use the update-venue-type endpoint with name patterns,
    // but also do individual updates for courts that don't match simple patterns

    // First, set all outdoor courts
    let result = await httpPost('/courts/admin/update-venue-type?venue_type=outdoor&indoor=false');
    console.log(`outdoor (all non-indoor): ${result.updated} courts`);

    // Schools - use multiple patterns
    const schoolPatterns = [
        '%Elementary%', '%Middle School%', '%High School%',
        '%Prep School%', '%Preparatory%', '%School Gym%',
        '%School Gymnasium%', '%Day School%', '%City Schools%',
        '%Junior High%', '%Montessori%', '%Waldorf School%',
    ];
    let schoolTotal = 0;
    for (const pat of schoolPatterns) {
        result = await httpPost(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
        schoolTotal += result.updated || 0;
    }
    console.log(`school: ${schoolTotal} courts`);

    // Colleges
    const collegePatterns = ['%College%', '%University%', '%Physical Education Center%'];
    let collegeTotal = 0;
    for (const pat of collegePatterns) {
        result = await httpPost(`/courts/admin/update-venue-type?venue_type=college&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
        collegeTotal += result.updated || 0;
    }
    console.log(`college: ${collegeTotal} courts`);

    // Rec centers
    const recPatterns = [
        '%YMCA%', '%JCC%', '%Community Center%', '%Community Gym%',
        '%Recreation%', '%Rec Center%', '%Civic Center%',
        '%Boys % Girls Club%', '%MLK%', '%Martin Luther King%',
    ];
    let recTotal = 0;
    for (const pat of recPatterns) {
        result = await httpPost(`/courts/admin/update-venue-type?venue_type=rec_center&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
        recTotal += result.updated || 0;
    }
    console.log(`rec_center: ${recTotal} courts`);

    // Gyms (private/membership)
    const gymPatterns = [
        '%Bay Club%', '%24 Hour%', '%Anytime Fitness%', '%Planet Fitness%',
        '%Health Club%', '%Athletic Club%', '%Fitness%',
        '%LA Fitness%', '%Equinox%', '%Crunch%', '%CrossFit%',
        '%Cross Fit%',
    ];
    let gymTotal = 0;
    for (const pat of gymPatterns) {
        result = await httpPost(`/courts/admin/update-venue-type?venue_type=gym&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
        gymTotal += result.updated || 0;
    }
    console.log(`gym: ${gymTotal} courts`);

    // Final verification
    console.log('\n\n=== FINAL VERIFICATION ===\n');
    const allCourts = await httpGet('/courts');
    const typeCounts = {};
    for (const c of allCourts) {
        const t = c.venue_type || 'unclassified';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    console.log('Venue type distribution:');
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
    }
    console.log(`\nTotal: ${allCourts.length}`);

    // Show unclassified courts
    const unclassified = allCourts.filter(c => !c.venue_type);
    if (unclassified.length > 0) {
        console.log(`\n⚠️  ${unclassified.length} unclassified courts:`);
        for (const c of unclassified.slice(0, 20)) {
            console.log(`  ${c.name} (${c.city}) [indoor=${c.indoor}]`);
        }
        if (unclassified.length > 20) console.log(`  ... and ${unclassified.length - 20} more`);
    }
}

main().catch(console.error);

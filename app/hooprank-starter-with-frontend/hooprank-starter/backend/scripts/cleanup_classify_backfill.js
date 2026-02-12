/**
 * Cleanup, Classify & Address Backfill — all-in-one
 * Proper .js file to avoid shell escaping issues with inline node -e
 */
const https = require('https');
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';
const GOOGLE_API_KEY = 'AIzaSyCX1GnVAAcK1zrgbYXO6s85UrHKZeRd4Ns';

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 120000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse: ' + data.substring(0, 200))); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('GET timeout')); });
    });
}

function httpPost(path) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: BASE, path, method: 'POST',
            headers: { 'x-user-id': USER_ID }, timeout: 15000,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('POST timeout')); });
        req.end();
    });
}

function reverseGeocode(lat, lng) {
    return new Promise((resolve, reject) => {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
        const req = https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    if (j.results && j.results[0]) resolve(j.results[0].formatted_address);
                    else resolve(null);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── FALSE POSITIVE PATTERNS ───
function isFalsePositive(name) {
    const n = name;
    return (
        /preschool|pre-school|daycare|child care|childcare|head start|headstart/i.test(n) ||
        /jiu.?jitsu|\bmma\b|martial art|taekwondo|karate|kung fu|wrestling school/i.test(n) ||
        /dance studio|ballet studio|gymnastics center|climbing gym|swim school/i.test(n) ||
        /volleyball club/i.test(n) || /pickleball center/i.test(n) || /badminton club/i.test(n) ||
        /\bsalon\b|\bbeauty\b|\bbarber\b/i.test(n) || /dental office|medical center|pharmacy/i.test(n) ||
        /school district(?! gym)/i.test(n) || /district office/i.test(n) || /administration building/i.test(n) ||
        /fusion academy/i.test(n) || /online academy/i.test(n) || /virtual academy/i.test(n)
    );
}

// ─── CLASSIFICATION PATTERNS ───
function classifyVenue(name) {
    const patterns = [
        [/catholic|christian|lutheran|baptist|episcopal|adventist|methodist|presbyterian|covenant|trinity|bethel|calvary|sacred heart|divine|providence|assumption|nativity|redeemer|notre dame|bishop|immaculate|our lady/i, 'school'],
        [/^st\.\s|^saint\s|^holy\s|^blessed\s/i, 'school'],
        [/\bschool\b|\belementary\b|\bmiddle\b|\bhigh\b|\bjunior\b|\bacademy\b|\bprep\b|\bmontessori\b/i, 'school'],
        [/college|university|institute of tech/i, 'college'],
        [/\bpark\b|community|recreation|civic|boys.*girls|ymca|ywca|jcc|\bchurch\b|\btemple\b|center|hall\b|pavilion/i, 'rec_center'],
        [/gym|fitness|athletic|\bsport\b|training|workout|club|active|basketball|\bcourt\b|24 hour|equinox|planet|la fitness|life time|gold/i, 'gym'],
    ];
    for (const [pat, type] of patterns) {
        if (pat.test(name)) return type;
    }
    return 'other';
}

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  CLEANUP + CLASSIFY + BACKFILL           ║');
    console.log('╚══════════════════════════════════════════╝\n');

    // Phase 1: Fetch all courts
    console.log('Fetching courts (timeout: 120s)...');
    let courts;
    try {
        courts = await httpGet('https://' + BASE + '/courts');
    } catch (e) {
        console.log('ERROR fetching courts: ' + e.message);
        process.exit(1);
    }
    console.log('Fetched: ' + courts.length + ' courts\n');

    // Phase 2: Delete false positives
    console.log('═══ PHASE 1: FALSE POSITIVE CLEANUP ═══');
    let deleted = 0;
    for (const c of courts) {
        if (!c.indoor) continue;
        if (isFalsePositive(c.name)) {
            try {
                await httpPost('/courts/admin/delete?id=' + encodeURIComponent(c.id));
                deleted++;
                if (deleted <= 10) console.log('  ✗ ' + c.name + ' (' + c.city + ')');
            } catch (e) {
                console.log('  ⚠ Delete failed: ' + c.name + ' — ' + e.message);
            }
        }
    }
    if (deleted > 10) console.log('  ... and ' + (deleted - 10) + ' more');
    console.log('  Deleted: ' + deleted + '\n');

    // Phase 3: Classify unclassified
    console.log('═══ PHASE 2: CLASSIFICATION ═══');
    let classified = 0;
    const uncl = courts.filter(c => c.indoor && !c.venue_type && !isFalsePositive(c.name));
    console.log('  Unclassified: ' + uncl.length);
    for (const c of uncl) {
        const type = classifyVenue(c.name);
        try {
            await httpPost('/courts/admin/update-venue-type?venue_type=' + type + '&name_pattern=' + encodeURIComponent(c.name));
            classified++;
        } catch (e) {
            console.log('  ⚠ Classify failed: ' + c.name + ' — ' + e.message);
        }
        if (classified % 50 === 0 && classified > 0) console.log('  Progress: ' + classified + '/' + uncl.length);
    }
    console.log('  Classified: ' + classified + '\n');

    // Phase 4: Backfill addresses
    console.log('═══ PHASE 3: ADDRESS BACKFILL ═══');
    const noAddr = courts.filter(c => c.indoor && !c.address && c.lat && c.lng && !isFalsePositive(c.name));
    console.log('  Need address: ' + noAddr.length);
    let addrOk = 0, addrFail = 0;
    for (const c of noAddr) {
        try {
            const addr = await reverseGeocode(c.lat, c.lng);
            if (addr) {
                const params = new URLSearchParams({ id: c.id, address: addr });
                await httpPost('/courts/admin/update-address?' + params.toString());
                addrOk++;
            } else { addrFail++; }
        } catch (e) { addrFail++; }
        if ((addrOk + addrFail) % 50 === 0 && (addrOk + addrFail) > 0) {
            console.log('  Progress: ' + (addrOk + addrFail) + '/' + noAddr.length);
        }
        await sleep(100); // rate limit
    }
    console.log('  Backfilled: ' + addrOk + ' | Failed: ' + addrFail + '\n');

    // Phase 5: Final stats
    console.log('═══ FINAL STATS ═══');
    let finalCourts;
    try {
        finalCourts = await httpGet('https://' + BASE + '/courts');
    } catch (e) {
        console.log('Could not fetch final stats: ' + e.message);
        console.log('Done (stats skipped).');
        return;
    }
    const indoor = finalCourts.filter(c => c.indoor);
    const states = {};
    const vtDist = {};
    for (const c of indoor) {
        const m = c.city && c.city.match(/, ([A-Z]{2})$/);
        if (m) states[m[1]] = (states[m[1]] || 0) + 1;
        vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1;
    }
    const missingAddr = indoor.filter(c => !c.address).length;

    console.log('  Total: ' + finalCourts.length + ' (' + indoor.length + ' indoor)');
    console.log('\n  By state:');
    for (const [s, cnt] of Object.entries(states).sort((a, b) => b[1] - a[1])) {
        console.log('    ' + s + ': ' + cnt);
    }
    console.log('\n  Venue types:');
    for (const [t, cnt] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) {
        console.log('    ' + t + ': ' + cnt);
    }
    console.log('\n  Missing address: ' + missingAddr);
    console.log('\n  DONE ✓');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

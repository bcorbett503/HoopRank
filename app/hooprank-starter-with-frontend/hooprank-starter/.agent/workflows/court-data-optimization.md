---
description: How to add, audit, and optimize court data for HoopRank
---

# Court Data Optimization Workflow

## Overview

This workflow covers the complete pipeline for discovering, importing, classifying, and verifying indoor basketball court data for any metro area or state. It has been battle-tested across California (996 courts), Washington (367), Oregon (339), and the full Bay Area (492 indoor).

---

## 1. Architecture

### Database Schema

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Deterministic from `md5(name + city)` |
| `name` | text | Official Google Maps name |
| `city` | text | Format: `"City, ST"` |
| `indoor` | boolean | `true` for gym courts |
| `rims` | int | Default `2` |
| `access` | text | `public`, `members`, or `paid` |
| `venue_type` | text | `school`, `college`, `rec_center`, `gym`, `outdoor`, `other` |
| `source` | text | `google`, `osm`, `curated` |
| `geog` | geography | PostGIS point (SRID 4326) |

### Admin API Endpoints

All require header `x-user-id: 4ODZUrySRUhFDC5wVW6dCySBprD2`

```
POST /courts/admin/create         — Upsert a court
  Query: id, name, city, lat, lng, indoor, rims, access, venue_type

POST /courts/admin/delete         — Delete by name + city
  Query: name, city

POST /courts/admin/update-source  — Bulk update source field
  Query: source, indoor, state

POST /courts/admin/update-venue-type  — Bulk classify venue_type
  Query: venue_type, name_pattern (ILIKE), indoor, current_venue_type

POST /courts/admin/migrate        — Run schema migrations
GET  /courts                      — List all courts
```

### ID Generation

```javascript
const crypto = require('crypto');
function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}
// Usage: generateUUID(court.name + court.city)
```

Re-importing same name+city upserts (no duplicates).

---

## 2. Discovery Pipeline (Google Places API)

This is the primary method for discovering courts at scale. Uses the **Places API (New)** `searchText` endpoint.

### Setup

- Google Cloud project must have **Places API (New)** enabled
- API key: set in script or env var `GOOGLE_API_KEY`
- Cost: ~$0 for first 10K calls/month (free tier)

### Query Strategy

Run **multiple targeted queries per sub-region** to maximize coverage. Each query returns up to 20 results.

**Query template per city/county:**
```
school gymnasium [City] [State]
elementary school gym basketball [City] [State]
middle school gymnasium [City] [State]
high school gymnasium [City] [State]
basketball gym [City] [State]
recreation center basketball [City/County] [State]
community center gym [City/County] [State]
YMCA basketball [City/County] [State]
fitness gym basketball court [City] [State]
24 Hour Fitness basketball [City] [State]
Bay Club [City] basketball
```

**API call pattern:**
```javascript
async function discoverPlaces(query) {
    const body = { textQuery: query, maxResultCount: 20 };
    const result = await httpPost(
        'places.googleapis.com',
        '/v1/places:searchText',
        body,
        {
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types',
        }
    );
    return result.places || [];
}
```

### Filtering

**Skip patterns** (not basketball):
```
gymnastics, yoga, pilates, boxing, martial arts, karate, swim, aquatic,
pool, dance, spin, climbing, boulder, trampoline, cheer, golf, tennis,
racquet, pickleball, supply, store, shop, equipment, camp
```

**Keep patterns** (likely basketball):
```
school, elementary, middle school, high school, gymnasium, gym, recreation,
community center, YMCA, JCC, Bay Club, 24 Hour, basketball, fitness,
athletic, sports, university, college, academy
```

### Deduplication

Use haversine distance — venues within **100m** of each other are considered duplicates. Keep the first one found:

```javascript
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

### Naming Conventions

- Schools: append "Gym" if not already present → `"Lincoln High School Gym"`
- Rec centers: use full name → `"Pickleweed Community Center"`
- Private gyms: use Google Maps name → `"Bay Club Marin"`

### Access Classification

| Venue Type | Default Access |
|------------|---------------|
| Schools (K-12) | `public` |
| Colleges | `members` |
| Community/rec centers | `public` |
| YMCAs, JCCs | `members` |
| Private gyms (24 Hour, Bay Club, etc.) | `members` |
| Outdoor courts | `public` |

### Reference Script

See [bayarea_discover.js](file:///Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/backend/scripts/bayarea_discover.js) — complete 4-phase pipeline (delete → discover → import → verify).

---

## 3. Venue Type Classification

After import, run classification to tag every court's `venue_type`.

### Classification Order (most specific → broadest)

1. **outdoor** — `indoor = false`
2. **school** — Elementary, Middle School, High School, Academy, Montessori, Waldorf, Prep, School Gym
3. **college** — College, University, Cal State, Cal Poly, UC, State SRC/ARC
4. **rec_center** — YMCA, YWCA, JCC, Community Center/Gym, Recreation, Park, Civic Center, Boys & Girls Club, MLK
5. **gym** — Bay Club, 24 Hour, Life Time, CrossFit, Fitness, Wellness, Athletic Club, Training, Sport
6. **other** — everything remaining

> [!IMPORTANT]
> Apply patterns **most-specific first**. Broad patterns like `%Gym%` or `%Center%` will overwrite specific ones if run in the wrong order. Use the `current_venue_type` filter to target only unclassified courts.

### Bulk API Pattern

```javascript
// Set outdoor courts first
await httpPost('/courts/admin/update-venue-type?venue_type=outdoor&indoor=false');

// Schools (specific patterns, indoor only)
for (const pat of ['%Elementary%', '%Middle School%', '%High School%', '%Academy%']) {
    await httpPost(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
}

// Fix remaining unclassified with broader patterns
await httpPost('/courts/admin/update-venue-type?venue_type=gym&name_pattern=%25Gym%25&current_venue_type=_unset_&indoor=true');
```

### Reference Script

See [classify_venue_types.js](file:///Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/backend/scripts/classify_venue_types.js).

---

## 4. Step-by-Step: Adding a New Metro Area

// turbo-all

### Phase 1: Discovery

1. **Create script** at `backend/scripts/<metro>_discover.js` based on `bayarea_discover.js`
2. **Define queries** — ~5-10 queries per major city, 2-3 per suburb. Target school gyms, rec centers, YMCAs, and private gyms separately
3. **Define city list** — all cities/towns in the metro area
4. **Run script**: `node backend/scripts/<metro>_discover.js`

### Phase 2: Cleanup

5. **Review results** — spot-check 10-20 courts on Google Maps for accuracy
6. **Remove non-basketball** venues (yoga studios, martial arts, etc.)
7. **Fix names** — ensure schools have "Gym" suffix, rec centers use full name

### Phase 3: Classification

8. **Run classifier**: `node backend/scripts/classify_venue_types.js`
9. **Review "other"** bucket — manually reclassify or delete

### Phase 4: Verification

10. **Pull data and audit**:
```bash
curl -s "https://heartfelt-appreciation-production-65f1.up.railway.app/courts" | python3 -c "
import json, sys
courts = json.load(sys.stdin)
metro = [c for c in courts if 'TargetCity' in c.get('city','')]
for c in sorted(metro, key=lambda x: x['name']):
    print(f\"{c['venue_type']:12} {c['name']} ({c['city']})\")
print(f'Total: {len(metro)')
"
```

11. **Cross-reference with Google Maps** for pin accuracy
12. **Check for gaps** — search Google Maps for schools/gyms not in the data

---

## 5. Lessons Learned

| Issue | Solution |
|-------|----------|
| TypeORM `synchronize: false` in production | Use `OnModuleInit` to `ALTER TABLE ADD COLUMN IF NOT EXISTS` |
| ILIKE patterns overwrite specific classifications | Run specific patterns first, use `current_venue_type` filter for broad patterns |
| Generic "Basketball Court" entries from Places API | Often outdoor courts incorrectly marked indoor — tag as `other` |
| Schools found via Places API missing "Gym" suffix | Check Google `types` array for `school`/`primary_school`/`secondary_school` |
| Duplicate venue entries (same place, different names) | Haversine dedup at 100m threshold |
| State audit scripts > 200 courts | Split by region (e.g., `ca_p1_lausd_schools.js`, `ca_p2_la_suburbs.js`) |

---

## 6. Current Stats (as of Feb 2026)

| State | Indoor | Outdoor | Total |
|-------|--------|---------|-------|
| California | 1,114 | 55 | 1,169 |
| Washington | 367 | 0 | 367 |
| Oregon | 339 | 0 | 339 |

**Venue type distribution (all states):**
- school: 426 | rec_center: 379 | gym: 194 | college: 107 | outdoor: 55 | other: 8

---

## 7. Reference Scripts

| Script | Purpose |
|--------|---------|
| [bayarea_discover.js](file:///Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/backend/scripts/bayarea_discover.js) | Google Places discovery pipeline template |
| [classify_venue_types.js](file:///Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/backend/scripts/classify_venue_types.js) | Auto-classify all courts by name patterns |
| [ca_p1_lausd_schools.js](file:///Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/backend/scripts/ca_audit/ca_p1_lausd_schools.js) | Example state audit script (schools) |
| [wa_p1_seattle_schools.js](file:///Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/backend/scripts/wa_audit/wa_p1_seattle_schools.js) | Example state audit script (WA) |

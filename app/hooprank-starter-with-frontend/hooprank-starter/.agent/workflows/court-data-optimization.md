---
description: How to add, audit, and optimize court data for HoopRank
---

# Court Data Optimization Workflow

## 1. Data Categories

Courts should be sourced in priority order:

| Priority | Category | Access | Source Method |
|----------|----------|--------|---------------|
| 1 | City/County rec centers | `public` | City parks & rec websites |
| 2 | YMCAs | `members` | ymca.org location finder |
| 3 | Private gyms w/ courts | `members` | Google Maps search |
| 4 | University rec centers | `members` | School athletics pages |
| 5 | High school gyms | `public` or `members` | School district websites |
| 6 | Middle/elementary gyms | `public` | School district websites |

## 2. Data Format

Each court requires these fields:

```json
{
  "name": "Facility Full Name",
  "city": "City, ST",
  "lat": 37.7749,
  "lng": -122.4194,
  "indoor": true,
  "access": "public"
}
```

**Rules:**
- `name`: Official facility name from Google Maps (not abbreviated)
- `city`: Format is `"City, ST"` (2-letter state code)
- `lat`/`lng`: 4 decimal places minimum — verify via Google Maps
- `indoor`: Always `true` for gym courts; `false` for outdoor
- `access`: `public` = open to all, `members` = membership/enrollment required, `paid` = per-visit fee

## 3. ID Generation

IDs are deterministic UUIDs from `md5(name + city)`:

```javascript
const crypto = require('crypto');
function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}
// Usage: generateUUID(court.name + court.city)
```

This means re-importing the same court (same name + city) will upsert, not duplicate.

## 4. Import Process

### API Endpoint
```
POST https://heartfelt-appreciation-production-65f1.up.railway.app/courts/admin/create
Headers: x-user-id: 4ODZUrySRUhFDC5wVW6dCySBprD2
Query params: id, name, city, lat, lng, indoor, access
```

### Import Script Template
// turbo-all

1. Create a new file `backend/scripts/import_<category>_<region>.js`
2. Use the shared `postCourt()` function pattern from `import_all_indoor.js`
3. Define courts as a const array, grouped by city
4. Run sequentially with progress logging
5. Execute: `node backend/scripts/import_<category>_<region>.js`

### Batch Sizing
- Keep each script under 200 courts for manageable review
- Group by region (West, South, Midwest, Northeast) or by state

## 5. Quality Audit Process

### For each metro area:

1. **Pull current data:**
   ```bash
   curl -s "https://heartfelt-appreciation-production-65f1.up.railway.app/courts" | python3 -c "
   import json, sys
   courts = json.load(sys.stdin)
   city_courts = [c for c in courts if 'CityName' in c.get('city','')]
   for c in sorted(city_courts, key=lambda x: x['name']):
       print(f\"{c['name']} | {c['city']} | indoor={c.get('indoor')} | access={c.get('access')}\")
   print(f'Total: {len(city_courts)}')
   "
   ```

2. **Google Maps cross-reference** — For each court:
   - Search the facility name + city on Google Maps
   - Verify: correct name, correct location pin, still operational
   - Flag: closed/demolished, name changed, coordinates off by >0.001°

3. **Common errors to check:**
   - Facility has no indoor basketball court (e.g., pool-only rec centers)
   - Coordinates point to parking lot instead of building
   - Name doesn't match Google Maps listing
   - Duplicate entries with slightly different names
   - Wrong city assignment (suburb vs. main city)

4. **Fix process:**
   - Coordinate fix → re-import with corrected lat/lng (upsert handles it)
   - Name fix → delete old entry via `admin/delete`, then reimport
   - Remove bad entry → `admin/delete`

## 6. School Court Data — Sourcing Guide

### Colleges & Universities
- **NCES database** (nces.ed.gov) — official US education data
- **Google Maps**: search `"[school name] recreation center"` or `"[school name] gymnasium"`
- **School athletics pages** for venue names and addresses
- Use recreation center name, not just school name (e.g., "Koret Health and Recreation Center (USF)" not "USF Gym")

### High Schools
- **School district websites** — most list all schools with addresses
- **Google Maps**: search `"[school name] high school gymnasium"`
- **MaxPreps / state athletics associations** for facility names
- Default name format: `"[School Name] High School Gym"`

### Middle / Elementary
- **School district websites** for addresses
- **⚠️ Verify** the school actually has an indoor gym (many elementary schools do not)
- Default name format: `"[School Name] [Middle/Elementary] School Gym"`

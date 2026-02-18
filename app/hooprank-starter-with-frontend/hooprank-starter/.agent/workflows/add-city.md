---
description: Add court data for a new city — discover, import, and optionally seed runs
---

# Add City Workflow

The user provides a city name (e.g. "Merritt Island, FL" or "Austin, TX"). This is a one-shot, fully automated flow.

## 1. Identify the state code
Extract the 2-letter state code from the city name. If the user didn't include a state, infer it or ask.

## 2. Run the full discovery + import pipeline
This is the only step. It discovers courts, deduplicates against the existing DB, imports new ones, classifies venue types, and verifies — all automatically.

// turbo
```bash
cd /Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/backend
TOKEN=$TOKEN node scripts/ops/discover_courts.js --state {STATE} --cities "{CITY}"
```

Report the results to the user: how many courts were discovered, imported, and the final count.

## Notes
- `GOOGLE_API_KEY` and `TOKEN` env vars must both be set
- The tool auto-deduplicates against the existing database (0.1km haversine)
- Queries cover elementary/middle/high schools, gyms, rec centers, YMCAs, colleges, and fitness chains
- Venue types are auto-classified (school, college, rec_center, gym)
- If the user also wants to seed runs, help them add entries to `scripts/ops/run_data.js` and run `seed_runs.js`

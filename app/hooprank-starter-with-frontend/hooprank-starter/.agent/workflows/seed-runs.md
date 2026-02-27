---
description: Import court/run data from a user-provided table of venues with schedules
---

# Seed Runs Workflow

The user provides a table of venues and run schedules to be seeded for a specific market.

## 1. Add Data to run_data.js
Ask the user for the raw data or table. Update `backend/scripts/ops/run_data.js` with the new venues and corresponding runs.

## 2. Add Market Key
If the city/region does not exist in the `MARKET_MAP` in `backend/scripts/ops/seed_runs.js`, add it so the script knows how to filter the runs.

## 3. Execute the Seed Runs Script
Run the `seed_runs.js` script using the new `ADMIN_SECRET` bypass (no local HTTP server or manual token generation needed). 

// turbo
```bash
cd /Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/backend
ADMIN_SECRET="wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9" TOKEN=dry node scripts/ops/seed_runs.js --market {MARKET} --weeks 8
```

Report the results to the user (how many run instances were created, courts added, etc).

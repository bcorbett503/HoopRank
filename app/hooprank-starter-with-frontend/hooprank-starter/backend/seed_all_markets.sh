#!/bin/bash
export ADMIN_SECRET="wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9"
export TOKEN="bypass"
MARKETS=(nyc chi philly texas dmv pnw atl miami denver phoenix boston detroit peninsula minneapolis sandiego la)

for market in "${MARKETS[@]}"; do
    echo "============================================"
    echo "SEEDING MARKET: $market"
    echo "============================================"
    node scripts/ops/seed_runs.js --market "$market" --weeks 4
done
echo "✅ All markets completely re-seeded!"

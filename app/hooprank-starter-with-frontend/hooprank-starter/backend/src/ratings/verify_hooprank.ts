import { HoopRankService } from './hooprank.service';

async function runTests() {
    const service = new HoopRankService();

    console.log('--- HoopRank Algorithm Verification ---');

    // Scenario 1: The Upset (Rookie vs Vet)
    console.log('\nSCENARIO 1: The Upset');
    const rookie = { rating: 2.40, matchesPlayed: 5 };
    const vet = { rating: 4.80, matchesPlayed: 100 };

    console.log(`Rookie (${rookie.rating}) vs Vet (${vet.rating})`);
    const probRookie = service.calculateExpectedScore(rookie.rating, vet.rating);
    console.log(`Rookie Win Probability: ${(probRookie * 100).toFixed(1)}%`);

    const newRookieRating = service.updateRating(rookie.rating, vet.rating, rookie.matchesPlayed, 1);
    const newVetRating = service.updateRating(vet.rating, rookie.rating, vet.matchesPlayed, 0);

    console.log(`Rookie New Rating: ${newRookieRating} (Diff: ${(newRookieRating - rookie.rating).toFixed(2)})`);
    console.log(`Vet New Rating: ${newVetRating} (Diff: ${(newVetRating - vet.rating).toFixed(2)})`);

    if (newRookieRating > rookie.rating + 0.15) console.log('PASS: Rookie gained significant rating.');
    else console.error('FAIL: Rookie rating gain too small.');

    // Scenario 2: Even Match
    console.log('\nSCENARIO 2: Even Match');
    const p1 = { rating: 3.40, matchesPlayed: 20 };
    const p2 = { rating: 3.50, matchesPlayed: 20 };

    const newP1 = service.updateRating(p1.rating, p2.rating, p1.matchesPlayed, 1);
    console.log(`P1 (${p1.rating}) beats P2 (${p2.rating}) -> New P1: ${newP1}`);

    // Scenario 3: The Grind
    console.log('\nSCENARIO 3: The Grind');
    let grinder = { rating: 2.50, matchesPlayed: 0 };
    const opponents = [2.50, 2.60, 2.40, 2.70, 2.50];
    const results = [1, 0, 1, 0, 1]; // W, L, W, L, W

    for (let i = 0; i < opponents.length; i++) {
        const oppRating = opponents[i];
        const result = results[i];
        const newRating = service.updateRating(grinder.rating, oppRating, grinder.matchesPlayed, result);
        console.log(`Match ${i + 1}: ${grinder.rating} vs ${oppRating} (${result ? 'Win' : 'Loss'}) -> ${newRating}`);
        grinder.rating = newRating;
        grinder.matchesPlayed++;
    }
    console.log(`Final Grinder Rating: ${grinder.rating}`);
}

runTests();

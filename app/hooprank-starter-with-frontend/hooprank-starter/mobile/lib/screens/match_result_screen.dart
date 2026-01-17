import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';

class MatchResultScreen extends StatelessWidget {
  const MatchResultScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final match = context.watch<MatchState>();
    final auth = context.read<AuthState>();
    final me = auth.currentUser;
    final opp = match.opponent;
    final r = match;
    
    // Determine win/loss based on scores
    final userWon = (r.userScore ?? 0) > (r.oppScore ?? 0);
    final currentRating = me?.rating ?? 3.0;
    
    // Estimate rating change using simplified Elo calculation
    // HoopRank uses a 1.0-5.0 scale, similar to K-factor adjusted Elo
    final opponentRating = opp?.rating ?? 3.0;
    double estimatedDelta = 0.0;
    if (userWon) {
      // Winner gains more if opponent was higher rated
      estimatedDelta = 0.1 + (opponentRating - currentRating) * 0.05;
      estimatedDelta = estimatedDelta.clamp(0.05, 0.3);
    } else {
      // Loser loses more if lower rated than opponent
      estimatedDelta = -0.1 + (opponentRating - currentRating) * 0.05;
      estimatedDelta = estimatedDelta.clamp(-0.3, -0.05);
    }
    final estimatedNewRating = (currentRating + estimatedDelta).clamp(1.0, 5.0);
    
    // Check if we have rating change data (only after opponent confirms)
    final hasRatingChange = r.delta != null && r.ratingAfter != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Result')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Win/Loss Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              decoration: BoxDecoration(
                color: userWon ? Colors.green : Colors.red,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Text(
                userWon ? 'VICTORY!' : 'DEFEAT',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  children: [
                    const Text('Final Score', style: TextStyle(color: Colors.grey)),
                    Text(
                      '${r.userScore} — ${r.oppScore}',
                      style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold),
                    ),
                    Text('${me?.name ?? 'You'} vs ${opp?.name ?? 'Opponent'}', style: const TextStyle(color: Colors.grey)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Rating section - show estimated or actual
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Text('Your HoopRank', style: TextStyle(color: Colors.grey)),
                    const SizedBox(height: 8),
                    if (hasRatingChange) ...[
                      // Show actual rating change after confirmation
                      Text(
                        r.ratingAfter!.toStringAsFixed(2),
                        style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${r.delta! >= 0 ? '+' : ''}${r.delta!.toStringAsFixed(2)}',
                        style: TextStyle(
                          color: r.delta! >= 0 ? Colors.green : Colors.red,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ] else ...[
                      // Show estimated rating change
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            currentRating.toStringAsFixed(1),
                            style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.grey),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.arrow_forward, color: Colors.grey),
                          const SizedBox(width: 8),
                          Text(
                            estimatedNewRating.toStringAsFixed(2),
                            style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${estimatedDelta >= 0 ? '+' : ''}${estimatedDelta.toStringAsFixed(2)} (estimated)',
                        style: TextStyle(
                          color: estimatedDelta >= 0 ? Colors.green : Colors.red,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.hourglass_empty, size: 16, color: Colors.orange),
                            SizedBox(width: 4),
                            Text(
                              'Pending opponent confirmation',
                              style: TextStyle(color: Colors.orange, fontSize: 12, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => context.go('/rankings'),
                    child: const Text('View Rankings'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      match.reset();
                      context.go('/play');
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.deepOrange,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Done'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

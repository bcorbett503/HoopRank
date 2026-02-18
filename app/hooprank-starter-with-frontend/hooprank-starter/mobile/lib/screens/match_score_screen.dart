import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../services/api_service.dart';
import '../services/analytics_service.dart';

class MatchScoreScreen extends StatefulWidget {
  const MatchScoreScreen({super.key});

  @override
  State<MatchScoreScreen> createState() => _MatchScoreScreenState();
}

class _MatchScoreScreenState extends State<MatchScoreScreen> {
  final TextEditingController _userScoreCtrl = TextEditingController();
  final TextEditingController _oppScoreCtrl = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  bool _isTeamMatch(MatchState match) {
    return match.mode == '3v3' || match.mode == '5v5';
  }

  Future<void> _submit() async {
    final userScore = int.tryParse(_userScoreCtrl.text);
    final oppScore = int.tryParse(_oppScoreCtrl.text);

    if (userScore == null || oppScore == null) {
      setState(() => _error = 'Please enter valid scores');
      return;
    }

    final match = context.read<MatchState>();
    final matchId = match.matchId;
    final isTeamMatch = _isTeamMatch(match);

    if (matchId == null) {
      setState(() => _error = 'No active match found. Please start a new match.');
      debugPrint('SCORE_SUBMIT: No matchId — cannot submit score without an active match');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      if (isTeamMatch) {
        // Submit team match score - uses team endpoint that updates team ratings
        final teamId = match.myTeamId;
        if (teamId == null) {
          setState(() => _error = 'Team ID not found');
          return;
        }

        final response = await ApiService.submitTeamScore(
          teamId: teamId,
          matchId: matchId,
          myTeamScore: userScore,
          opponentTeamScore: oppScore,
        );

        if (!mounted) return;
        match.setScores(userScore, oppScore);

        // Check if score needs opponent confirmation
        if (response != null && response['status'] == 'pending_confirmation') {
          // Score submitted, awaiting opponent confirmation
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content:
                  Text('Score submitted! Waiting for opponent to confirm.'),
              duration: Duration(seconds: 3),
            ),
          );
          context.go('/teams');
          return;
        }

        // Match finalized immediately (unregistered opponent) — use rating changes
        final won = userScore > oppScore;
        double delta = won ? 0.1 : -0.1; // Default fallback
        double ratingBefore = 3.0;
        double ratingAfter = 3.0;

        if (response != null) {
          final ratingChanges =
              response['ratingChanges'] as Map<String, dynamic>?;
          if (ratingChanges != null && teamId != null) {
            final teamRatingChange = ratingChanges[teamId];
            if (teamRatingChange != null) {
              ratingBefore =
                  (teamRatingChange['old'] as num?)?.toDouble() ?? 3.0;
              ratingAfter =
                  (teamRatingChange['new'] as num?)?.toDouble() ?? 3.0;
              delta = ratingAfter - ratingBefore;
            }
          }
        }

        match.setOutcome(
          deltaVal: delta,
          rBefore: ratingBefore,
          rAfter: ratingAfter,
          rkBefore: 0,
          rkAfter: 0,
        );
      } else {
        // Submit 1v1 score with court if available
        debugPrint(
            'SCORE_SUBMIT: matchId=$matchId, court=${match.court?.name}, courtId=${match.court?.id}');
        await ApiService.submitScore(
          matchId: matchId,
          myScore: userScore,
          opponentScore: oppScore,
          courtId: match.court?.id,
        );

        if (!mounted) return;
        match.setScores(userScore, oppScore);
        // 1v1 is a two-phase flow: submitter posts score, opponent confirms/adjusts.
        // Do not treat submit as finalized rating update yet.
      }

      AnalyticsService.logMatchCompleted(mode: isTeamMatch ? match.mode ?? '5v5' : '1v1');
      context.go('/match/result');
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _error = e.toString();
        });
      }
    }
  }



  @override
  Widget build(BuildContext context) {
    final match = context.read<MatchState>();
    final auth = context.read<AuthState>();
    final me = auth.currentUser;
    final opp = match.opponent;
    final isTeamMatch = _isTeamMatch(match);

    // For team matches, show team names instead of player names
    final myDisplayName =
        isTeamMatch ? (match.myTeamName ?? 'Your Team') : (me?.name ?? 'You');
    final oppDisplayName = isTeamMatch
        ? (match.opponentTeamName ?? 'Opponent Team')
        : (opp?.name ?? 'Opponent');

    return Scaffold(
      appBar: AppBar(title: const Text('Enter final score')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Show match type indicator for team matches
            if (isTeamMatch)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: match.mode == '3v3'
                      ? Colors.blue.shade700
                      : Colors.purple.shade700,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  '${match.mode} Team Match',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child:
                    Text(_error!, style: TextStyle(color: Colors.red.shade800)),
              ),
            Row(
              children: [
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        children: [
                          Text(isTeamMatch ? 'Your Team' : 'You',
                              style: const TextStyle(color: Colors.grey)),
                          Text(myDisplayName,
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold),
                              textAlign: TextAlign.center),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _userScoreCtrl,
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            decoration: const InputDecoration(
                                hintText: '0', border: OutlineInputBorder()),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        children: [
                          Text(isTeamMatch ? 'Opponent Team' : 'Opponent',
                              style: const TextStyle(color: Colors.grey)),
                          Text(oppDisplayName,
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold),
                              textAlign: TextAlign.center),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _oppScoreCtrl,
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            decoration: const InputDecoration(
                                hintText: '0', border: OutlineInputBorder()),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Submit Score'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

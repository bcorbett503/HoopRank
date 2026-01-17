import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../services/api_service.dart';

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

  Future<void> _submit() async {
    final userScore = int.tryParse(_userScoreCtrl.text);
    final oppScore = int.tryParse(_oppScoreCtrl.text);

    if (userScore == null || oppScore == null) {
      setState(() => _error = 'Please enter valid scores');
      return;
    }

    final match = context.read<MatchState>();
    final auth = context.read<AuthState>();
    final matchId = match.matchId;
    
    if (matchId == null) {
      // Fallback to mock flow if no match ID
      _submitMock(userScore, oppScore);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      // Submit score to backend
      final result = await ApiService.submitScore(
        matchId: matchId,
        myScore: userScore,
        opponentScore: oppScore,
      );

      if (!mounted) return;

      match.setScores(userScore, oppScore);

      // Get updated rating from backend
      final userId = auth.currentUser?.id;
      if (userId != null) {
        final ratingInfo = await ApiService.getUserRating(userId);
        if (ratingInfo != null && mounted) {
          final newRating = (ratingInfo['hoopRank'] as num?)?.toDouble() ?? 3.0;
          final oldRating = auth.currentUser?.rating ?? 3.0;
          final delta = newRating - oldRating;
          
          match.setOutcome(
            deltaVal: delta,
            rBefore: oldRating,
            rAfter: newRating,
            rkBefore: 0, // Will be calculated on backend
            rkAfter: 0,
          );
        }
      }

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

  void _submitMock(int userScore, int oppScore) {
    // Fallback mock flow for development
    final match = context.read<MatchState>();
    final auth = context.read<AuthState>();
    final me = auth.currentUser;
    final opp = match.opponent;

    if (me == null || opp == null) return;

    match.setScores(userScore, oppScore);

    // Simple mock delta calculation
    final won = userScore > oppScore;
    final delta = won ? 0.15 : -0.1;
    
    match.setOutcome(
      deltaVal: delta,
      rBefore: me.rating,
      rAfter: me.rating + delta,
      rkBefore: 1,
      rkAfter: 1,
    );

    context.go('/match/result');
  }

  @override
  Widget build(BuildContext context) {
    final match = context.read<MatchState>();
    final auth = context.read<AuthState>();
    final me = auth.currentUser;
    final opp = match.opponent;

    return Scaffold(
      appBar: AppBar(title: const Text('Enter final score')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_error!, style: TextStyle(color: Colors.red.shade800)),
              ),
            Row(
              children: [
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        children: [
                          const Text('You', style: TextStyle(color: Colors.grey)),
                          Text(me?.name ?? 'You', style: const TextStyle(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _userScoreCtrl,
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            decoration: const InputDecoration(hintText: '0', border: OutlineInputBorder()),
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
                          const Text('Opponent', style: TextStyle(color: Colors.grey)),
                          Text(opp?.name ?? 'Opponent', style: const TextStyle(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _oppScoreCtrl,
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            decoration: const InputDecoration(hintText: '0', border: OutlineInputBorder()),
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
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Submit Score'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

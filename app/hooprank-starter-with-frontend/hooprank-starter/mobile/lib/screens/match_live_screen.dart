import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';

class MatchLiveScreen extends StatefulWidget {
  const MatchLiveScreen({super.key});

  @override
  State<MatchLiveScreen> createState() => _MatchLiveScreenState();
}

class _MatchLiveScreenState extends State<MatchLiveScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      context.read<MatchState>().tick();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final match = context.watch<MatchState>();
    final minutes = (match.seconds / 60).floor().toString().padLeft(2, '0');
    final seconds = (match.seconds % 60).toString().padLeft(2, '0');

    return Scaffold(
      appBar: AppBar(title: const Text('Live Match')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Timer', style: TextStyle(color: Colors.grey)),
            Text(
              '$minutes:$seconds',
              style: const TextStyle(fontSize: 80, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 48),
            ElevatedButton(
              onPressed: () {
                match.endMatch();
                context.go('/match/score');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepOrange,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 24),
                textStyle: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              child: const Text('End Game'),
            ),
          ],
        ),
      ),
    );
  }
}

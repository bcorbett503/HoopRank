import 'package:flutter/material.dart';
import '../services/api.dart';

class PlayScreen extends StatelessWidget {
  const PlayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = Api();
    return Scaffold(
      appBar: AppBar(title: const Text('Play')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ElevatedButton(
              onPressed: () async {
                final m = await api.createMatch('u1', 'u2');
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Match created: ${m['id']}')));
                }
              },
              child: const Text('Quick Match (u1 vs u2)'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () async {
                final m = await api.completeFirst('u1');
                if (context.mounted) {
                  final diff = m['ratingDiff'] ?? {};
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Provisional delta: $diff')));
                }
              },
              child: const Text('Submit Demo Result (u1 wins)'),
            ),
            const SizedBox(height: 12),
            const Text('Note: Demo flow aligned with MVP QR/direct invite.'),
          ],
        ),
      ),
    );
  }
}

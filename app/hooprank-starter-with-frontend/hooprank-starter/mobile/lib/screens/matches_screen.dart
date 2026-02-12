import 'package:flutter/material.dart';
import '../models.dart';
import '../services/mock_data.dart';

class MatchesScreen extends StatefulWidget {
  const MatchesScreen({super.key});

  @override
  State<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends State<MatchesScreen> {
  // In a real app, this would be fetched from a service/provider
  // TODO(status-compat): This mock screen is still hard-wired to legacy
  // statuses (pending/accepted/completed). If wired to live API data, map
  // waiting/live/ended (and optionally backendStatus) before rendering.
  List<Match> _matches = List.from(mockMatches);

  void _accept(String id) {
    setState(() {
      final index = _matches.indexWhere((m) => m.id == id);
      if (index != -1) {
        final m = _matches[index];
        _matches[index] = Match(
          id: m.id,
          challengerId: m.challengerId,
          opponentId: m.opponentId,
          status: 'accepted',
          scheduledAt: m.scheduledAt,
          courtId: m.courtId,
          winnerId: m.winnerId,
          ratingDelta: m.ratingDelta,
        );
      }
    });
  }

  void _complete(String id) {
    setState(() {
      final index = _matches.indexWhere((m) => m.id == id);
      if (index != -1) {
        final m = _matches[index];
        // Mock completion logic: random winner, random delta
        _matches[index] = Match(
          id: m.id,
          challengerId: m.challengerId,
          opponentId: m.opponentId,
          status: 'completed',
          scheduledAt: m.scheduledAt,
          courtId: m.courtId,
          winnerId: m.challengerId, // Mock winner
          ratingDelta: 0.15, // Mock delta
        );
      }
    });
  }

  Player? _getPlayer(String id) {
    try {
      return mockPlayers.firstWhere((p) => p.id == id);
    } catch (e) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Matches'),
      ),
      body: ListView.builder(
        itemCount: _matches.length,
        itemBuilder: (context, index) {
          final m = _matches[index];
          final challenger = _getPlayer(m.challengerId);
          final opponent = _getPlayer(m.opponentId);

          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Match #${m.id}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getStatusColor(m.status).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: _getStatusColor(m.status)),
                        ),
                        child: Text(
                          m.status.toUpperCase(),
                          style: TextStyle(
                            color: _getStatusColor(m.status),
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          children: [
                            CircleAvatar(child: Text(challenger?.name.substring(0, 1) ?? '?')),
                            const SizedBox(height: 4),
                            Text(challenger?.name ?? 'Unknown', textAlign: TextAlign.center),
                          ],
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8.0),
                        child: Text('VS', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            CircleAvatar(child: Text(opponent?.name.substring(0, 1) ?? '?')),
                            const SizedBox(height: 4),
                            Text(opponent?.name ?? 'Unknown', textAlign: TextAlign.center),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today, size: 16, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text(m.scheduledAt?.toString().split('.')[0] ?? '—', style: const TextStyle(fontSize: 12)),
                      const SizedBox(width: 16),
                      const Icon(Icons.location_on, size: 16, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text(m.courtId ?? 'Unknown Court', style: const TextStyle(fontSize: 12)),
                    ],
                  ),
                  if (m.status == 'completed') ...[
                    const Divider(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Winner: ${_getPlayer(m.winnerId!)?.name ?? '—'}'),
                        Text('Δ HoopRank: ${m.ratingDelta?.toStringAsFixed(2) ?? '—'}',
                            style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                  if (m.status != 'completed') ...[
                    const Divider(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (m.status == 'pending')
                          ElevatedButton(
                            onPressed: () => _accept(m.id),
                            child: const Text('Accept'),
                          ),
                        if (m.status == 'accepted')
                          ElevatedButton(
                            onPressed: () => _complete(m.id),
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange, foregroundColor: Colors.white),
                            child: const Text('Complete'),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Color _getStatusColor(String status) {
    // TODO(status-compat): Extend this switch for waiting/live/ended when this
    // screen moves from mock data to API-backed data.
    switch (status) {
      case 'pending':
        return Colors.orange;
      case 'accepted':
        return Colors.blue;
      case 'completed':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }
}

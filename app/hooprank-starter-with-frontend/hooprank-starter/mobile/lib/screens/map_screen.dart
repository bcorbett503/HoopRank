import 'package:flutter/material.dart';
import '../models.dart';
import '../widgets/court_map_widget.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  void _showCourtDetails(Court court) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Court name with basketball icon
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.deepOrange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.sports_basketball, color: Colors.deepOrange, size: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        court.name,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      if (court.address != null)
                        Text(
                          court.address!,
                          style: TextStyle(fontSize: 14, color: Colors.grey[400]),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Kings section
            if (court.hasKings) ...[
              const Text(
                '👑 Kings of the Court',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.amber,
                ),
              ),
              const SizedBox(height: 12),
              // Mode Kings row
              Row(
                children: [
                  if (court.king1v1 != null)
                    Expanded(child: _buildKingCard('1v1', court.king1v1!, court.king1v1Rating, Colors.deepOrange)),
                  if (court.king1v1 != null && (court.king3v3 != null || court.king5v5 != null))
                    const SizedBox(width: 8),
                  if (court.king3v3 != null)
                    Expanded(child: _buildKingCard('3v3', court.king3v3!, court.king3v3Rating, Colors.blue)),
                  if (court.king3v3 != null && court.king5v5 != null)
                    const SizedBox(width: 8),
                  if (court.king5v5 != null)
                    Expanded(child: _buildKingCard('5v5', court.king5v5!, court.king5v5Rating, Colors.purple)),
                ],
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey[800]?.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[700]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.emoji_events_outlined, color: Colors.grey[500], size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'No Kings yet! Play here to claim the throne.',
                        style: TextStyle(color: Colors.grey[400], fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            // Play here button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  if (court.hasKings) {
                    // Show action sheet to challenge a King
                    _showChallengeKingSheet(court);
                  } else {
                    // No Kings - show message about claiming the throne
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Be the first to play at ${court.name} and claim the throne!'),
                        action: SnackBarAction(
                          label: 'Find Players',
                          onPressed: () {
                            // Navigate to Rankings to find players
                            // DefaultTabController.of(context).animateTo(0);
                          },
                        ),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.play_arrow),
                label: const Text('Play Here'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showChallengeKingSheet(Court court) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Text(
              '👑 Challenge a King',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Choose which King you want to challenge at ${court.name}',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            const SizedBox(height: 16),
            if (court.king1v1 != null)
              _buildChallengeOption(
                mode: '1v1',
                kingName: court.king1v1!,
                rating: court.king1v1Rating,
                color: Colors.deepOrange,
                onTap: () {
                  Navigator.pop(context);
                  _initiateKingChallenge(court.king1v1!, '1v1', court);
                },
              ),
            if (court.king3v3 != null) ...[
              const SizedBox(height: 10),
              _buildChallengeOption(
                mode: '3v3',
                kingName: court.king3v3!,
                rating: court.king3v3Rating,
                color: Colors.blue,
                onTap: () {
                  Navigator.pop(context);
                  _initiateKingChallenge(court.king3v3!, '3v3', court);
                },
              ),
            ],
            if (court.king5v5 != null) ...[
              const SizedBox(height: 10),
              _buildChallengeOption(
                mode: '5v5',
                kingName: court.king5v5!,
                rating: court.king5v5Rating,
                color: Colors.purple,
                onTap: () {
                  Navigator.pop(context);
                  _initiateKingChallenge(court.king5v5!, '5v5', court);
                },
              ),
            ],
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildChallengeOption({
    required String mode,
    required String kingName,
    required double? rating,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: color.withOpacity(0.15),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  mode,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              const SizedBox(width: 14),
              const Text('👑', style: TextStyle(fontSize: 22)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      kingName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    if (rating != null)
                      Text(
                        '⭐ ${rating.toStringAsFixed(2)}',
                        style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                      ),
                  ],
                ),
              ),
              Icon(Icons.sports_basketball, color: color, size: 28),
              const SizedBox(width: 4),
              Icon(Icons.arrow_forward_ios, color: Colors.grey[500], size: 16),
            ],
          ),
        ),
      ),
    );
  }

  void _initiateKingChallenge(String kingName, String mode, Court court) {
    // For now, show a message since Kings don't have user IDs yet
    // In the future, this would search for the player and send a challenge
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Sending $mode challenge to $kingName at ${court.name}...'),
        duration: const Duration(seconds: 3),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Widget _buildKingCard(String mode, String name, double? rating, Color color) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withOpacity(0.3), color.withOpacity(0.1)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              mode,
              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 6),
          const Text('👑', style: TextStyle(fontSize: 20)),
          const SizedBox(height: 4),
          Text(
            name,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (rating != null) ...[
            const SizedBox(height: 2),
            Text(
              '⭐ ${rating.toStringAsFixed(2)}',
              style: TextStyle(fontSize: 11, color: Colors.grey[400]),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Courts'),
        centerTitle: true,
      ),
      body: CourtMapWidget(
        onCourtSelected: _showCourtDetails,
      ),
    );
  }
}

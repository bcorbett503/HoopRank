import 'package:flutter/material.dart';
import '../services/mock_data.dart';

class PlayerDetailScreen extends StatelessWidget {
  final String slug;

  const PlayerDetailScreen({super.key, required this.slug});

  @override
  Widget build(BuildContext context) {
    final player = mockPlayers.firstWhere(
      (p) => p.slug == slug,
      orElse: () => throw Exception('Player not found'),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(player.name),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  child: Text(player.name.substring(0, 1), style: const TextStyle(fontSize: 24)),
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(player.name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                    Text('${player.team} • ${player.position} • Age ${player.age} • ZIP ${player.zip ?? '-'}',
                        style: const TextStyle(color: Colors.grey)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Overview Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Overview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(
                            children: [
                              const Text('HoopRank ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                              Text(player.rating.toStringAsFixed(2),
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Divider(),
                    _buildStatRow('Offense', player.offense),
                    _buildStatRow('Defense', player.defense),
                    _buildStatRow('Shooting', player.shooting),
                    _buildStatRow('Passing', player.passing),
                    _buildStatRow('Rebounding', player.rebounding),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Vitals Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Vitals', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    const Divider(),
                    _buildVitalRow('Height', player.height),
                    _buildVitalRow('Weight', player.weight),
                    _buildVitalRow('Position', player.position),
                    _buildVitalRow('ZIP', player.zip ?? '-'),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {},
                        child: const Text('Follow'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, double value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(color: Colors.grey)),
              Text(value.toStringAsFixed(1), style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          LinearProgressIndicator(
            value: value / 5.0,
            backgroundColor: Colors.grey.shade200,
            color: Colors.deepOrange,
          ),
        ],
      ),
    );
  }

  Widget _buildVitalRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value),
        ],
      ),
    );
  }
}

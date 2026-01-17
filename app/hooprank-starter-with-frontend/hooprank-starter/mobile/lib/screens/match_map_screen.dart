import 'package:flutter/material.dart';
import '../models.dart';
import '../widgets/court_map_widget.dart';

class MatchMapScreen extends StatefulWidget {
  const MatchMapScreen({super.key});

  @override
  State<MatchMapScreen> createState() => _MatchMapScreenState();
}

class _MatchMapScreenState extends State<MatchMapScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Court'),
      ),
      body: CourtMapWidget(
        limitDistanceKm: 0.1, // 100 meters
        onCourtSelected: (court) {
          Navigator.pop(context, court);
        },
      ),
    );
  }
}

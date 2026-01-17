import 'package:flutter/material.dart';

class DiscoverPlayersScreen extends StatelessWidget {
  const DiscoverPlayersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Discover Players')),
      body: const Center(child: Text('Visibility filters go here (Friends/Radius/City/Rank Range).')),
    );
  }
}

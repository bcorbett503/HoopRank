import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/store.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<HoopRankStore>();
    final me = store.me;

    if (me == null) return const SizedBox.shrink();

    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundImage: me.avatarUrl != null ? NetworkImage(me.avatarUrl!) : null,
                    child: me.avatarUrl == null ? Text(me.name[0]) : null,
                  ),
                  const SizedBox(height: 16),
                  Text(me.name, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text('HoopRank: ${me.hoopRank}', style: Theme.of(context).textTheme.titleMedium),
                  if (me.shootingRank != null)
                    Text('Shooting: ${me.shootingRank}', style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text('Recent Matches', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ...store.matches.take(5).map((m) => ListTile(
            title: Text('${m.format} Match'),
            subtitle: Text(m.status),
            trailing: Text(m.createdAt.split('T')[0]),
          )),
        ],
      ),
    );
  }
}

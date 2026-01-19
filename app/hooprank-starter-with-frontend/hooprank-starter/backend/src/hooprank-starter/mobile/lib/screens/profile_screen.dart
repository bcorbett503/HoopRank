import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/store.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<HoopRankStore>();
    final me = store.me;

    if (me == null) return const SizedBox.shrink();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => store.logout(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: CircleAvatar(
                radius: 50,
                backgroundImage: me.avatarUrl != null ? NetworkImage(me.avatarUrl!) : null,
                child: me.avatarUrl == null ? Text(me.name[0], style: const TextStyle(fontSize: 32)) : null,
              ),
            ),
            const SizedBox(height: 24),
            ListTile(
              title: const Text('Name'),
              subtitle: Text(me.name),
              leading: const Icon(Icons.person),
            ),
            ListTile(
              title: const Text('Location'),
              subtitle: Text([me.city, me.region, me.country].whereType<String>().join(', ')),
              leading: const Icon(Icons.location_on),
            ),
            const Divider(),
            const Text('Stats', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            ListTile(
              title: const Text('HoopRank'),
              trailing: Text(me.hoopRank.toString(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
            ListTile(
              title: const Text('Shooting Rank'),
              trailing: Text(me.shootingRank?.toString() ?? '-', style: const TextStyle(fontSize: 18)),
            ),
          ],
        ),
      ),
    );
  }
}

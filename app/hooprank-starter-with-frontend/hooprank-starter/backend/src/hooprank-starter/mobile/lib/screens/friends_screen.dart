import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/store.dart';
import '../models/user.dart';

class FriendsScreen extends StatelessWidget {
  const FriendsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<HoopRankStore>();
    final friends = store.friends.map((id) => store.getUser(id)).whereType<User>().toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Friends')),
      body: ListView.builder(
        itemCount: friends.length,
        itemBuilder: (context, index) {
          final friend = friends[index];
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: friend.avatarUrl != null ? NetworkImage(friend.avatarUrl!) : null,
              child: friend.avatarUrl == null ? Text(friend.name[0]) : null,
            ),
            title: Text(friend.name),
            subtitle: Text('HoopRank: ${friend.hoopRank}'),
            trailing: IconButton(
              icon: const Icon(Icons.remove_circle_outline),
              onPressed: () => store.removeFriendById(friend.id),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.add),
        onPressed: () {
          // Demo: Add a random user not already a friend
          final allUsers = store.users.values.toList();
          final nonFriends = allUsers.where((u) => !store.friends.contains(u.id) && u.id != store.me?.id).toList();
          if (nonFriends.isNotEmpty) {
            store.addFriendById(nonFriends.first.id);
          }
        },
      ),
    );
  }
}

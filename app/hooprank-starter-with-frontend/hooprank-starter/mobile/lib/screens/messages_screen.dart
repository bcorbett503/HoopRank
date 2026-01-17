import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../services/messages_service.dart';
import '../widgets/player_profile_sheet.dart';
import 'chat_screen.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> with RouteAware {
  final MessagesService _messagesService = MessagesService();
  List<Conversation> _conversations = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadConversations();
  }
  
  Future<void> _loadConversations() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) {
      setState(() {
        _conversations = [];
        _isLoading = false;
      });
      return;
    }
    
    try {
      final conversations = await _messagesService.getConversations(userId);
      if (mounted) {
        setState(() {
          _conversations = conversations;
          _isLoading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() => _isLoading = true);
              _loadConversations();
            },
          ),
        ],
      ),
      body: _buildBody(),
    );
  }
  
  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text('Error: $_error'));
    }
    if (_conversations.isEmpty) {
      return const Center(child: Text('No messages yet'));
    }
    
    return RefreshIndicator(
      onRefresh: _loadConversations,
      child: ListView.builder(
        itemCount: _conversations.length,
        itemBuilder: (context, index) {
          final conversation = _conversations[index];
          return Dismissible(
            key: Key(conversation.threadId ?? conversation.user.id),
            direction: DismissDirection.endToStart, // Swipe left only
            background: Container(
              color: Colors.red,
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: 20),
              child: const Icon(Icons.delete, color: Colors.white),
            ),
            confirmDismiss: (direction) async {
              // Show confirmation dialog
              return await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Delete Conversation?'),
                  content: Text('Delete your conversation with ${conversation.user.name}? This cannot be undone.'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      style: TextButton.styleFrom(foregroundColor: Colors.red),
                      child: const Text('Delete'),
                    ),
                  ],
                ),
              ) ?? false;
            },
            onDismissed: (direction) async {
              final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
              if (userId != null && conversation.threadId != null) {
                try {
                  await _messagesService.deleteThread(userId, conversation.threadId!);
                  setState(() {
                    _conversations.removeAt(index);
                  });
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Conversation with ${conversation.user.name} deleted')),
                    );
                  }
                } catch (e) {
                  // Re-add to list if delete failed
                  _loadConversations();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: $e')),
                    );
                  }
                }
              }
            },
            child: ListTile(
              leading: GestureDetector(
                onTap: () => PlayerProfileSheet.showById(context, conversation.user.id),
                child: CircleAvatar(
                  backgroundImage: conversation.user.photoUrl != null
                      ? NetworkImage(conversation.user.photoUrl!)
                      : null,
                  child: conversation.user.photoUrl == null
                      ? Text(conversation.user.name[0])
                      : null,
                ),
              ),
              title: GestureDetector(
                onTap: () => PlayerProfileSheet.showById(context, conversation.user.id),
                child: Text(
                  conversation.user.name,
                  style: const TextStyle(
                    color: Colors.blue,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
              subtitle: Text(
                conversation.lastMessage?.isChallenge == true
                    ? '⚔️ Challenge: ${conversation.lastMessage?.content}'
                    : (conversation.lastMessage?.content ?? 'No messages'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: conversation.lastMessage?.isChallenge == true
                    ? const TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)
                    : null,
              ),
              trailing: conversation.lastMessage != null
                  ? Text(
                      _formatDate(conversation.lastMessage!.createdAt),
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    )
                  : null,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => ChatScreen(otherUser: conversation.user),
                  ),
                ).then((_) {
                  // Refresh conversations when returning
                  _loadConversations();
                });
              },
            ),
          );
        },
      ),
    );
  }


  String _formatDate(DateTime date) {
    final now = DateTime.now();
    if (date.year == now.year && date.month == now.month && date.day == now.day) {
      return '${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } else {
      return '${date.month}/${date.day}';
    }
  }
}

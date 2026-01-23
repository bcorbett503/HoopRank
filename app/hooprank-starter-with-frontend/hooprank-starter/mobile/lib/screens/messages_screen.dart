import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../services/messages_service.dart';
import '../widgets/player_profile_sheet.dart';
import '../widgets/scaffold_with_nav_bar.dart';
import 'chat_screen.dart';
import 'team_chat_screen.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> with RouteAware {
  final MessagesService _messagesService = MessagesService();
  List<TeamConversation> _teamChats = [];
  List<Conversation> _conversations = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAllConversations();
  }
  
  Future<void> _loadAllConversations() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) {
      setState(() {
        _teamChats = [];
        _conversations = [];
        _isLoading = false;
      });
      return;
    }
    
    try {
      // Load both team and individual conversations in parallel
      final results = await Future.wait([
        _messagesService.getTeamChats(userId),
        _messagesService.getConversations(userId),
      ]);
      
      if (mounted) {
        setState(() {
          _teamChats = results[0] as List<TeamConversation>;
          _conversations = results[1] as List<Conversation>;
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
              _loadAllConversations();
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
    if (_teamChats.isEmpty && _conversations.isEmpty) {
      return const Center(child: Text('No messages yet'));
    }
    
    return RefreshIndicator(
      onRefresh: _loadAllConversations,
      child: ListView(
        children: [
          // Team chats section (pinned at top)
          if (_teamChats.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  const Icon(Icons.groups, size: 18, color: Colors.deepOrange),
                  const SizedBox(width: 6),
                  Text(
                    'Team Chats',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            ..._teamChats.map((teamChat) => _buildTeamChatTile(teamChat)),
            const Divider(),
          ],
          
          // Individual conversations section
          if (_teamChats.isNotEmpty && _conversations.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Text(
                'Direct Messages',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[600],
                ),
              ),
            ),
          ..._conversations.asMap().entries.map((entry) => 
            _buildConversationTile(entry.value, entry.key)
          ),
        ],
      ),
    );
  }

  Widget _buildTeamChatTile(TeamConversation teamChat) {
    return ListTile(
      leading: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: teamChat.teamType == '3v3' ? Colors.blue : Colors.purple,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.groups, color: Colors.white, size: 20),
            Text(
              teamChat.teamType,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
      title: Text(
        teamChat.teamName,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        teamChat.lastMessage != null
            ? '${teamChat.lastSenderName ?? 'Team'}: ${teamChat.lastMessage}'
            : 'Start chatting with your team!',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: teamChat.lastMessage == null
            ? TextStyle(color: Colors.grey[500], fontStyle: FontStyle.italic)
            : null,
      ),
      trailing: teamChat.lastMessageAt != null
          ? Text(
              _formatDate(teamChat.lastMessageAt!),
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            )
          : const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => TeamChatScreen(
              teamId: teamChat.teamId,
              teamName: teamChat.teamName,
              teamType: teamChat.teamType,
            ),
          ),
        ).then((_) => _loadAllConversations());
      },
    );
  }

  Widget _buildConversationTile(Conversation conversation, int index) {
    return Dismissible(
      key: Key(conversation.threadId ?? conversation.user.id),
      direction: DismissDirection.endToStart,
      background: Container(
        color: Colors.red,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      confirmDismiss: (direction) async {
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
            _loadAllConversations();
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
            style: TextStyle(
              color: Colors.blue,
              decoration: TextDecoration.underline,
              fontWeight: conversation.hasUnread ? FontWeight.bold : FontWeight.normal,
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
              : TextStyle(
                  fontWeight: conversation.hasUnread ? FontWeight.w600 : FontWeight.normal,
                  color: conversation.hasUnread ? Colors.white : Colors.grey,
                ),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (conversation.hasUnread) ...[
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  color: Colors.blue,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
            ],
            if (conversation.lastMessage != null)
              Text(
                _formatDate(conversation.lastMessage!.createdAt),
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
          ],
        ),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ChatScreen(otherUser: conversation.user),
            ),
          ).then((_) {
            _loadAllConversations();
            // Refresh the unread badge after reading messages
            ScaffoldWithNavBar.refreshBadge?.call();
          });
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

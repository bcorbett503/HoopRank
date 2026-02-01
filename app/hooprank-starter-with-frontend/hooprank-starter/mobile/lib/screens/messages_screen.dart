import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
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
      // Load team and individual conversations in parallel, but handle team chat errors gracefully
      List<TeamConversation> teamChats = [];
      List<Conversation> conversations = [];
      
      // Try to load team chats, but don't fail if the endpoint doesn't exist
      try {
        teamChats = await _messagesService.getTeamChats(userId);
      } catch (e) {
        // Team chats endpoint may not exist or user has no teams - this is OK
        debugPrint('Team chats not available: $e');
        teamChats = [];
      }
      
      // Load individual conversations
      try {
        conversations = await _messagesService.getConversations(userId);
      } catch (e) {
        debugPrint('Conversations error: $e');
        conversations = [];
      }
      
      if (mounted) {
        setState(() {
          _teamChats = teamChats;
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
      body: _buildBody(),
      floatingActionButton: FloatingActionButton.small(
        heroTag: 'refreshMessages',
        onPressed: () {
          setState(() => _isLoading = true);
          _loadAllConversations();
        },
        backgroundColor: Colors.grey[800],
        child: const Icon(Icons.refresh, size: 20),
      ),
    );
  }
  
  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text('Error: $_error', style: const TextStyle(color: Colors.red)));
    }
    if (_teamChats.isEmpty && _conversations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline, size: 64, color: Colors.white.withOpacity(0.1)),
            const SizedBox(height: 16),
            const Text(
              'No messages yet',
              style: TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Start a conversation from the Rankings page',
              style: TextStyle(color: Colors.white30, fontSize: 13),
            ),
          ],
        ),
      );
    }
    
    return RefreshIndicator(
      onRefresh: _loadAllConversations,
      child: ListView(
        children: [
          // Team chats section (pinned at top) - show even if empty with "Join a Team" suggestion
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.deepOrange.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.groups, size: 14, color: Colors.deepOrange),
                ),
                const SizedBox(width: 8),
                const Text(
                  'TEAM CHATS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
          ),
          if (_teamChats.isEmpty)
            // "Join a Team" suggestion card
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.grey[900],
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.deepOrange.withOpacity(0.2)),
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    // Navigate to Rankings -> Teams -> Local
                    Navigator.of(context).popUntil((route) => route.isFirst);
                    // Wait a frame then navigate to rankings
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) {
                        // Use GoRouter to navigate to rankings with teams tab
                        context.go('/rankings?tab=teams&region=local');
                      }
                    });
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Colors.deepOrange.withOpacity(0.3), Colors.orange.withOpacity(0.2)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.group_add, color: Colors.deepOrange, size: 24),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Join a Team',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Create or join a 3v3 or 5v5 team to unlock team chat',
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.5),
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.deepOrange),
                      ],
                    ),
                  ),
                ),
              ),
            )
          else
            ..._teamChats.map((teamChat) => _buildTeamChatTile(teamChat)),
          const SizedBox(height: 12),
          
          // Individual conversations section
          if (_conversations.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Row(
                children: [
                   Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.blue.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.person, size: 14, color: Colors.blue),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'DIRECT MESSAGES',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
          ..._conversations.asMap().entries.map((entry) => 
            _buildConversationTile(entry.value, entry.key)
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildTeamChatTile(TeamConversation teamChat) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
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
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: teamChat.teamType == '3v3' ? Colors.blue.withOpacity(0.2) : Colors.purple.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: teamChat.teamType == '3v3' ? Colors.blue.withOpacity(0.3) : Colors.purple.withOpacity(0.3),
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.groups, color: teamChat.teamType == '3v3' ? Colors.blue : Colors.purple, size: 20),
                      Text(
                        teamChat.teamType,
                        style: TextStyle(
                          color: teamChat.teamType == '3v3' ? Colors.blue : Colors.purple,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        teamChat.teamName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        teamChat.lastMessage != null
                            ? '${teamChat.lastSenderName ?? 'Team'}: ${teamChat.lastMessage}'
                            : 'Start chatting with your team!',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: teamChat.lastMessage == null ? Colors.white30 : Colors.white70,
                          fontStyle: teamChat.lastMessage == null ? FontStyle.italic : null,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                if (teamChat.lastMessageAt != null)
                  Text(
                    _formatDate(teamChat.lastMessageAt!),
                    style: const TextStyle(fontSize: 12, color: Colors.white30),
                  )
                else
                  const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.white30),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildConversationTile(Conversation conversation, int index) {
    return Dismissible(
      key: Key(conversation.threadId ?? conversation.user.id),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.red.shade900.withOpacity(0.8),
          borderRadius: BorderRadius.circular(16),
        ),
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
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.grey[900],
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
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
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => PlayerProfileSheet.showById(context, conversation.user.id),
                    child: CircleAvatar(
                      radius: 24,
                      backgroundImage: conversation.user.photoUrl != null
                          ? NetworkImage(conversation.user.photoUrl!)
                          : null,
                      backgroundColor: Colors.blue.withOpacity(0.2),
                      child: conversation.user.photoUrl == null
                          ? Text(
                              conversation.user.name.isNotEmpty ? conversation.user.name[0] : '?',
                              style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold),
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        GestureDetector(
                          onTap: () => PlayerProfileSheet.showById(context, conversation.user.id),
                          child: Text(
                            conversation.user.name,
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: conversation.hasUnread ? FontWeight.bold : FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          conversation.lastMessage?.isChallenge == true
                              ? '⚔️ Challenge: ${conversation.lastMessage?.content}'
                              : (conversation.lastMessage?.content ?? 'No messages'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: conversation.lastMessage?.isChallenge == true
                              ? const TextStyle(fontWeight: FontWeight.bold, color: Colors.orange, fontSize: 13)
                              : TextStyle(
                                  fontWeight: conversation.hasUnread ? FontWeight.w600 : FontWeight.normal,
                                  color: conversation.hasUnread ? Colors.white : Colors.white54,
                                  fontSize: 13,
                                ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (conversation.lastMessage != null)
                        Text(
                          _formatDate(conversation.lastMessage!.createdAt),
                          style: TextStyle(
                            fontSize: 12, 
                            color: conversation.hasUnread ? Colors.blueAccent : Colors.white30,
                            fontWeight: conversation.hasUnread ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      if (conversation.hasUnread) ...[
                        const SizedBox(height: 8),
                        Container(
                          width: 10,
                          height: 10,
                          decoration: const BoxDecoration(
                            color: Colors.blueAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
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

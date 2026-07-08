import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/analytics_service.dart';
import '../services/messages_service.dart';
import '../services/notification_service.dart';
import '../state/app_state.dart';
import '../state/onboarding_checklist_state.dart';
import '../utils/image_utils.dart';
import '../widgets/player_profile_sheet.dart';
import '../widgets/scaffold_with_nav_bar.dart';
import 'chat_screen.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> with RouteAware {
  final MessagesService _messagesService = MessagesService();
  List<Conversation> _conversations = [];
  List<ChallengeRequest> _challenges = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAllConversations();
    // Auto-refresh when a push notification arrives
    NotificationService.addOnNotificationListener(_onPushReceived);
    // Register so tapping the Messages tab triggers a refresh
    ScaffoldWithNavBar.refreshMessagesTab = _loadAllConversations;
  }

  @override
  void dispose() {
    NotificationService.removeOnNotificationListener(_onPushReceived);
    if (ScaffoldWithNavBar.refreshMessagesTab == _loadAllConversations) {
      ScaffoldWithNavBar.refreshMessagesTab = null;
    }
    super.dispose();
  }

  void _onPushReceived() {
    _loadAllConversations();
  }

  Future<void> _loadAllConversations() async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) {
      setState(() {
        _conversations = [];
        _isLoading = false;
      });
      return;
    }

    try {
      List<Conversation> conversations = [];
      List<ChallengeRequest> challenges = [];

      try {
        final results = await Future.wait([
          _messagesService.getConversations(userId),
          _messagesService.getPendingChallenges(userId),
        ]);
        conversations = results[0] as List<Conversation>;
        // Track challenges here in Messages: live matches persist at the
        // top, then pending ones (received first, then sent).
        int rank(ChallengeRequest c) => _isLiveChallenge(c)
            ? 0
            : c.isReceived
                ? 1
                : 2;
        challenges = (results[1] as List<ChallengeRequest>)
            .where((c) =>
                _isLiveChallenge(c) ||
                (c.message.challengeStatus ?? 'pending').toLowerCase() ==
                    'pending')
            .toList()
          ..sort((a, b) => rank(a) - rank(b));
      } catch (e) {
        debugPrint('Conversations error: $e');
        conversations = [];
        challenges = [];
      }

      if (mounted) {
        setState(() {
          _conversations = conversations;
          _challenges = challenges;
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
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
          child: Text('Error: $_error',
              style: const TextStyle(color: Colors.red)));
    }
    if (_conversations.isEmpty && _challenges.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline,
                size: 64, color: Colors.white.withOpacity(0.1)),
            const SizedBox(height: 16),
            const Text(
              'No messages yet',
              style: TextStyle(
                  color: Colors.white54,
                  fontSize: 16,
                  fontWeight: FontWeight.w600),
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
          if (_challenges.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF6B35).withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.flash_on_rounded,
                        size: 14, color: Color(0xFFFF6B35)),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'CHALLENGES',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                      color: Colors.white70,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF6B35),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${_challenges.length}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ..._challenges.map(_buildChallengeTile),
          ],
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
                    child:
                        const Icon(Icons.person, size: 14, color: Colors.blue),
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
          ..._conversations
              .asMap()
              .entries
              .map((entry) => _buildConversationTile(entry.value, entry.key)),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  /// A challenge is "live" once accepted and its match hasn't finished —
  /// it persists here so players can always get back to the game.
  static bool _isLiveChallenge(ChallengeRequest c) {
    if ((c.message.challengeStatus ?? '').toLowerCase() != 'accepted') {
      return false;
    }
    const finished = {
      'completed',
      'ended',
      'cancelled',
      'canceled',
      'declined',
      'expired',
      'contested',
    };
    return !finished.contains((c.matchStatus ?? '').toLowerCase());
  }

  /// Jump back into an accepted challenge's match.
  void _resumeMatch(ChallengeRequest challenge) {
    final matchState = context.read<MatchState>();
    matchState.setOpponent(Player(
      id: challenge.otherUser.id,
      slug: challenge.otherUser.id,
      name: challenge.otherUser.name,
      team: challenge.otherUser.team ?? 'Free Agent',
      position: challenge.otherUser.position ?? 'G',
      age: 25,
      height: '6\'0"',
      weight: '180 lbs',
      rating: challenge.otherUser.rating,
      offense: 80,
      defense: 80,
      shooting: 80,
      passing: 80,
      rebounding: 80,
    ));
    final matchId = challenge.message.matchId;
    if (matchId != null && matchId.isNotEmpty) {
      matchState.setMatchId(matchId);
    }
    context.push('/match/setup');
  }

  /// A pending challenge card: challenger, message, court/time, and
  /// Accept / Decline for received ones (sent ones show "awaiting reply").
  /// Live (accepted) challenges show a green Resume card instead.
  Widget _buildChallengeTile(ChallengeRequest challenge) {
    const orange = Color(0xFFFF6B35);
    const liveGreen = Color(0xFF22C55E);
    final isLive = _isLiveChallenge(challenge);
    final accent = isLive ? liveGreen : orange;
    final other = challenge.otherUser;
    final detail = [
      if (challenge.courtName != null) challenge.courtName!,
      if (challenge.scheduledAt != null)
        '${challenge.scheduledAt!.month}/${challenge.scheduledAt!.day}',
    ].join(' · ');

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withOpacity(0.45)),
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
                builder: (context) => ChatScreen(otherUser: other),
              ),
            ).then((_) {
              _loadAllConversations();
              ScaffoldWithNavBar.refreshBadge?.call();
            });
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    GestureDetector(
                      onTap: () =>
                          PlayerProfileSheet.showById(context, other.id),
                      child: CircleAvatar(
                        radius: 20,
                        backgroundImage: other.photoUrl != null
                            ? safeImageProvider(other.photoUrl!)
                            : null,
                        backgroundColor: accent.withOpacity(0.18),
                        child: other.photoUrl == null
                            ? Text(
                                other.name.isNotEmpty ? other.name[0] : '?',
                                style: TextStyle(
                                    color: accent, fontWeight: FontWeight.bold),
                              )
                            : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isLive
                                ? 'Live match with ${other.name}'
                                : challenge.isReceived
                                    ? '${other.name} challenged you'
                                    : 'You challenged ${other.name}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            detail.isNotEmpty
                                ? '${challenge.message.content} · $detail'
                                : challenge.message.content,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white54, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (isLive)
                  SizedBox(
                    width: double.infinity,
                    height: 38,
                    child: ElevatedButton.icon(
                      onPressed: () => _resumeMatch(challenge),
                      icon: const Icon(Icons.play_arrow_rounded, size: 20),
                      label: const Text('Resume match'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: liveGreen,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                        textStyle: const TextStyle(
                            fontWeight: FontWeight.w900, fontSize: 14),
                      ),
                    ),
                  )
                else if (challenge.isReceived)
                  Row(
                    children: [
                      Expanded(
                        child: SizedBox(
                          height: 38,
                          child: ElevatedButton(
                            onPressed: () => _acceptChallenge(challenge),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: orange,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                              textStyle: const TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 14),
                            ),
                            child: const Text('Accept'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: SizedBox(
                          height: 38,
                          child: OutlinedButton(
                            onPressed: () => _declineChallenge(challenge),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white70,
                              side: BorderSide(
                                  color: Colors.white.withOpacity(0.25)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                              textStyle: const TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 14),
                            ),
                            child: const Text('Decline'),
                          ),
                        ),
                      ),
                    ],
                  )
                else
                  Row(
                    children: [
                      Icon(Icons.hourglass_top_rounded,
                          size: 14, color: Colors.white38),
                      const SizedBox(width: 6),
                      const Text(
                        'Awaiting reply',
                        style: TextStyle(
                            color: Colors.white38,
                            fontSize: 12,
                            fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _acceptChallenge(ChallengeRequest challenge) async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      // Accept and pick up the created match, mirroring the home-feed flow.
      final result =
          await _messagesService.acceptChallenge(userId, challenge.message.id);
      final matchId = result['matchId'] as String?;

      if (!mounted) return;

      final matchState = context.read<MatchState>();
      matchState.setOpponent(Player(
        id: challenge.otherUser.id,
        slug: challenge.otherUser.id,
        name: challenge.otherUser.name,
        team: challenge.otherUser.team ?? 'Free Agent',
        position: challenge.otherUser.position ?? 'G',
        age: 25,
        height: '6\'0"',
        weight: '180 lbs',
        rating: challenge.otherUser.rating,
        offense: 80,
        defense: 80,
        shooting: 80,
        passing: 80,
        rebounding: 80,
      ));
      if (matchId != null) {
        matchState.setMatchId(matchId);
      }
      context
          .read<OnboardingChecklistState>()
          .completeItem(OnboardingItems.acceptChallenge);

      _loadAllConversations();
      ScaffoldWithNavBar.refreshBadge?.call();

      AnalyticsService.logChallengeAccepted(mode: '1v1');
      context.push('/match/setup');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _declineChallenge(ChallengeRequest challenge) async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Decline Challenge?'),
        content:
            Text('Decline the challenge from ${challenge.otherUser.name}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Yes, Decline'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _messagesService.declineChallenge(userId, challenge.message.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(
                    'Declined challenge from ${challenge.otherUser.name}')),
          );
          _loadAllConversations();
          ScaffoldWithNavBar.refreshBadge?.call();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
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
                content: Text(
                    'Delete your conversation with ${conversation.user.name}? This cannot be undone.'),
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
            ) ??
            false;
      },
      onDismissed: (direction) async {
        final userId =
            Provider.of<AuthState>(context, listen: false).currentUser?.id;
        // ALWAYS remove the dismissed row from the list (by identity, not the
        // captured index which can be stale after a concurrent reload) — a
        // Dismissible whose model isn't removed re-inserts with the same key
        // and crashes the screen. This also covers rows with no threadId.
        setState(() {
          _conversations.removeWhere((c) =>
              c.threadId == conversation.threadId &&
              c.user.id == conversation.user.id);
        });
        if (userId != null && conversation.threadId != null) {
          try {
            await _messagesService.deleteThread(userId, conversation.threadId!);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                    content: Text(
                        'Conversation with ${conversation.user.name} deleted')),
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
                  builder: (context) =>
                      ChatScreen(otherUser: conversation.user),
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
                    onTap: () => PlayerProfileSheet.showById(
                        context, conversation.user.id),
                    child: CircleAvatar(
                      radius: 24,
                      backgroundImage: conversation.user.photoUrl != null
                          ? safeImageProvider(conversation.user.photoUrl!)
                          : null,
                      backgroundColor: Colors.blue.withOpacity(0.2),
                      child: conversation.user.photoUrl == null
                          ? Text(
                              conversation.user.name.isNotEmpty
                                  ? conversation.user.name[0]
                                  : '?',
                              style: const TextStyle(
                                  color: Colors.blue,
                                  fontWeight: FontWeight.bold),
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
                          onTap: () => PlayerProfileSheet.showById(
                              context, conversation.user.id),
                          child: Text(
                            conversation.user.name,
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: conversation.hasUnread
                                  ? FontWeight.bold
                                  : FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          conversation.lastMessage?.isChallenge == true
                              ? '⚔️ Challenge: ${conversation.lastMessage?.content}'
                              : (conversation.lastMessage?.content ??
                                  'No messages'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: conversation.lastMessage?.isChallenge == true
                              ? const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.orange,
                                  fontSize: 13)
                              : TextStyle(
                                  fontWeight: conversation.hasUnread
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: conversation.hasUnread
                                      ? Colors.white
                                      : Colors.white54,
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
                            color: conversation.hasUnread
                                ? Colors.blueAccent
                                : Colors.white30,
                            fontWeight: conversation.hasUnread
                                ? FontWeight.bold
                                : FontWeight.normal,
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
    if (date.year == now.year &&
        date.month == now.month &&
        date.day == now.day) {
      return '${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } else {
      return '${date.month}/${date.day}';
    }
  }
}

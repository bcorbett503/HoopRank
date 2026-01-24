import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../services/mock_data.dart';
import '../services/location_service.dart';
import '../services/api_service.dart';
import '../services/messages_service.dart';
import '../services/notification_service.dart';
import '../widgets/player_profile_sheet.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
import '../models.dart';
import '../services/court_service.dart';
import 'map_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final MessagesService _messagesService = MessagesService();
  List<ChallengeRequest> _challenges = [];
  List<Map<String, dynamic>> _pendingConfirmations = [];
  List<Map<String, dynamic>> _localActivity = [];
  bool _isLoadingChallenges = true;
  bool _isLoadingActivity = true;
  double? _currentRating; // Fresh rating from API
  List<Map<String, dynamic>> _myTeams = []; // User's teams with ratings
  List<Map<String, dynamic>> _teamInvites = []; // Pending team invites
  List<Map<String, dynamic>> _teamChallenges = []; // Pending team challenges (3v3/5v5)

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Register for push notification refresh
    NotificationService.addOnNotificationListener(_refreshAll);
    _loadCurrentRating(); // Fetch fresh rating from API
    _loadChallenges();
    _loadPendingConfirmations();
    _loadLocalActivity();
    _loadMyTeams(); // Load user's teams for ratings
    _loadTeamInvites(); // Load pending team invites
    _loadTeamChallenges(); // Load pending team challenges
    _updateLocation();
  }

  /// Safely parse rating that could be String or num
  double _parseRating(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  Future<void> _loadCurrentRating() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;
    
    try {
      final userData = await ApiService.getProfile(userId);
      if (userData != null && mounted) {
        setState(() {
          _currentRating = (userData['rating'] is num) 
              ? (userData['rating'] as num).toDouble()
              : double.tryParse(userData['rating']?.toString() ?? '') ?? 3.0;
        });
      }
    } catch (e) {
      debugPrint('Error loading current rating: $e');
    }
  }

  Future<void> _loadMyTeams() async {
    try {
      final teams = await ApiService.getMyTeams();
      if (mounted) {
        setState(() => _myTeams = teams);
      }
    } catch (e) {
      debugPrint('Error loading teams: $e');
    }
  }

  Future<void> _loadTeamInvites() async {
    try {
      final invites = await ApiService.getTeamInvites();
      if (mounted) {
        setState(() => _teamInvites = invites);
      }
    } catch (e) {
      debugPrint('Error loading team invites: $e');
    }
  }

  Future<void> _loadTeamChallenges() async {
    try {
      debugPrint('Loading team challenges for user: ${ApiService.userId}');
      final challenges = await ApiService.getTeamChallenges();
      debugPrint('Team challenges received: ${challenges.length}');
      debugPrint('Team challenges data: $challenges');
      if (mounted) {
        setState(() => _teamChallenges = challenges);
      }
    } catch (e) {
      debugPrint('Error loading team challenges: $e');
    }
  }

  @override
  void dispose() {
    NotificationService.removeOnNotificationListener(_refreshAll);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh when app comes to foreground
    if (state == AppLifecycleState.resumed) {
      _loadCurrentRating(); // Refresh rating from API
      _loadChallenges();
      _loadPendingConfirmations();
      _loadLocalActivity();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Refresh all data when page is revisited (eg: navigating back to this tab)
    _refreshAll();
  }

  /// Refresh all data on the home screen
  Future<void> _refreshAll() async {
    _loadChallenges();
    _loadPendingConfirmations();
    _loadLocalActivity();
    _loadMyTeams();
    _loadTeamInvites();
    _loadTeamChallenges();
    _loadCurrentRating();
  }

  Future<void> _loadChallenges() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) {
      setState(() => _isLoadingChallenges = false);
      return;
    }

    try {
      final challenges = await _messagesService.getPendingChallenges(userId);
      if (mounted) {
        setState(() {
          _challenges = challenges;
          _isLoadingChallenges = false;
        });
      }
    } catch (e) {
      print('Error loading challenges: $e');
      if (mounted) {
        setState(() => _isLoadingChallenges = false);
      }
    }
  }

  Future<void> _loadPendingConfirmations() async {
    try {
      final confirmations = await ApiService.getPendingConfirmations();
      if (mounted) {
        setState(() => _pendingConfirmations = confirmations);
      }
    } catch (e) {
      print('Error loading pending confirmations: $e');
    }
  }

  Future<void> _loadLocalActivity() async {
    try {
      // Use global activity feed (3 most recent matches app-wide)
      final activity = await ApiService.getGlobalActivity(limit: 3);
      print('>>> Activity feed returned ${activity.length} items: $activity');
      if (mounted) {
        setState(() {
          _localActivity = activity;
          _isLoadingActivity = false;
        });
      }
    } catch (e) {
      print('Error loading activity: $e');
      if (mounted) {
        setState(() => _isLoadingActivity = false);
      }
    }
  }

  Future<void> _updateLocation() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      final position = await LocationService.getCurrentLocation();
      if (position != null) {
        await ApiService.updateProfile(userId, {
          'lat': position.latitude,
          'lng': position.longitude,
          'locEnabled': true,
        });
        print('Location updated: ${position.latitude}, ${position.longitude}');
      }
    } catch (e) {
      print('Error updating location: $e');
    }
  }

  String _getRankLabel(double rating) {
    if (rating >= 5.0) return 'Legend';
    if (rating >= 4.5) return 'Elite';
    if (rating >= 4.0) return 'Pro';
    if (rating >= 3.5) return 'All-Star';
    if (rating >= 3.0) return 'Starter';
    if (rating >= 2.5) return 'Bench';
    if (rating >= 2.0) return 'Rookie';
    return 'Newcomer';
  }

  Widget _buildRatingChip({
    required String label,
    required double rating,
    required Color color,
    String? teamName,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.5), width: 1),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              label,
              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            rating.toStringAsFixed(2),
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
          ),
          if (teamName != null)
            Text(
              teamName,
              style: const TextStyle(color: Colors.white70, fontSize: 9),
              overflow: TextOverflow.ellipsis,
            ),
        ],
      ),
    );
  }

  /// Build a team slot for 3v3 or 5v5 - shows rating if user has team, or "Find a Team" if not
  Widget _buildTeamSlot(String teamType, Color color) {
    // Find user's team of this type
    final team = _myTeams.firstWhere(
      (t) => t['teamType'] == teamType,
      orElse: () => <String, dynamic>{},
    );
    
    final hasTeam = team.isNotEmpty;
    final rating = hasTeam ? ((team['rating'] as num?)?.toDouble() ?? 3.0) : 0.0;
    final teamName = hasTeam ? (team['name'] ?? teamType) : null;
    
    return GestureDetector(
      onTap: () {
        if (!hasTeam) {
          // Navigate to Teams tab to find/create a team
          context.go('/teams');
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.15),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.5), width: 1),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                teamType,
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 4),
            if (hasTeam) ...[
              Text(
                rating.toStringAsFixed(2),
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Text(
                teamName!,
                style: const TextStyle(color: Colors.white70, fontSize: 8),
                overflow: TextOverflow.ellipsis,
              ),
            ] else ...[
              const Icon(Icons.add, color: Colors.white70, size: 18),
              const Text(
                'Find Team',
                style: TextStyle(color: Colors.white70, fontSize: 8),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showStartGameModeDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Select Game Mode',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),
              // 1v1 - individual matches
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.deepOrange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.person, color: Colors.deepOrange),
                ),
                title: const Text('1v1', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Find local players to challenge'),
                onTap: () {
                  Navigator.pop(ctx);
                  // Navigate to Rankings page with local filter - user picks player to challenge there
                  context.go('/rankings');
                },
              ),
              const Divider(),
              // 3v3 - team matches
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.groups, color: Colors.blue),
                ),
                title: const Text('3v3', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(_has3v3Team() ? 'Challenge another 3v3 team' : 'Join a team first'),
                enabled: _has3v3Team(),
                onTap: _has3v3Team()
                    ? () {
                        Navigator.pop(ctx);
                        _showTeamChallengeFlow('3v3');
                      }
                    : null,
              ),
              const Divider(),
              // 5v5 - team matches
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.groups, color: Colors.purple),
                ),
                title: const Text('5v5', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(_has5v5Team() ? 'Challenge another 5v5 team' : 'Join a team first'),
                enabled: _has5v5Team(),
                onTap: _has5v5Team()
                    ? () {
                        Navigator.pop(ctx);
                        _showTeamChallengeFlow('5v5');
                      }
                    : null,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  bool _has3v3Team() => _myTeams.any((t) => t['teamType'] == '3v3');
  bool _has5v5Team() => _myTeams.any((t) => t['teamType'] == '5v5');

  void _showStatusUpdateDialog(BuildContext context, CheckInState checkInState) {
    final user = Provider.of<AuthState>(context, listen: false).currentUser;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _StatusComposerSheet(
        checkInState: checkInState,
        userName: user?.name ?? 'Unknown',
        userPhotoUrl: user?.photoUrl,
        initialStatus: checkInState.getMyStatus(),
      ),
    );
  }

  void _showQuickChallengeSheet(BuildContext context, String playerId, String playerName) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Challenge $playerName',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Send a 1v1 challenge request',
              style: TextStyle(color: Colors.grey[400], fontSize: 13),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  // Navigate to match flow
                  context.go('/play');
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Challenge sent to $playerName!')),
                  );
                },
                icon: const Icon(Icons.sports_basketball),
                label: const Text('Send 1v1 Challenge'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.grey[400],
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _showTeamChallengeFlow(String teamType) {
    final myTeam = _myTeams.firstWhere(
      (t) => t['teamType'] == teamType,
      orElse: () => <String, dynamic>{},
    );
    
    if (myTeam.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('You need to join a $teamType team first')),
      );
      return;
    }

    // Navigate to team rankings to select opponent team
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) => _TeamSelectionSheet(
          teamType: teamType,
          myTeamId: myTeam['id'],
          myTeamName: myTeam['name'] ?? 'My Team',
          onTeamSelected: (opponentTeam) async {
            Navigator.pop(context);
            try {
              await ApiService.challengeTeam(
                teamId: myTeam['id'],
                opponentTeamId: opponentTeam['id'],
              );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Challenge sent to ${opponentTeam['name']}!')),
                );
              }
            } catch (e) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to send challenge: $e')),
                );
              }
            }
          },
        ),
      ),
    );
  }

  void _showChallengeDialog(Map<String, dynamic> player) {
    final playerId = player['id'] as String?;
    final playerName = player['name'] ?? 'Player';
    final playerRating = (player['rating'] ?? 0).toDouble();
    
    if (playerId == null) return;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.grey[900],
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Challenge $playerName?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 40,
              backgroundImage: player['avatarUrl'] != null
                  ? NetworkImage(player['avatarUrl'])
                  : null,
              child: player['avatarUrl'] == null
                  ? Text(playerName[0].toUpperCase(), style: const TextStyle(fontSize: 24))
                  : null,
            ),
            const SizedBox(height: 12),
            Text('⭐ ${playerRating.toStringAsFixed(1)}', style: const TextStyle(color: Colors.grey)),
            if (player['city'] != null)
              Text('📍 ${player['city']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              // Send challenge to this player
              try {
                await ApiService.createChallenge(toUserId: playerId, message: 'Want to play?');
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Challenge sent to $playerName!')),
                  );
                  _loadChallenges();
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
            ),
            child: const Text('Challenge'),
          ),
        ],
      ),
    );
  }

  Widget _buildChallengeBadge(ChallengeRequest challenge) {
    final isSent = challenge.isSent;
    final status = challenge.message.challengeStatus ?? 'pending';
    
    // Determine colors based on direction and status
    Color bgColor;
    Color borderColor;
    Color iconColor;
    IconData? icon;
    String? label;
    
    if (isSent) {
      // Sent challenges show status
      switch (status) {
        case 'accepted':
          bgColor = Colors.green.shade100;
          borderColor = Colors.green;
          iconColor = Colors.green.shade800;
          icon = Icons.check_circle;
          break;
        case 'declined':
          bgColor = Colors.red.shade100;
          borderColor = Colors.red;
          iconColor = Colors.red.shade800;
          icon = Icons.cancel;
          break;
        case 'expired':
          bgColor = Colors.grey.shade200;
          borderColor = Colors.grey;
          iconColor = Colors.grey.shade700;
          icon = Icons.timer_off;
          break;
        default: // pending
          bgColor = Colors.blue.shade100;
          borderColor = Colors.blue;
          iconColor = Colors.blue.shade800;
          icon = Icons.hourglass_empty;
      }
    } else {
      // Received challenges (action needed)
      bgColor = Colors.orange.shade100;
      borderColor = Colors.orange;
      iconColor = Colors.deepOrange;
      label = 'CHALLENGE';
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: label != null 
          ? Text(label, style: TextStyle(fontSize: 10, color: iconColor, fontWeight: FontWeight.bold))
          : Icon(icon, size: 16, color: iconColor),
    );
  }

  Widget _buildStatusIndicator(bool isSent, String status) {
    if (!isSent) {
      // Received challenge - show action needed indicator
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.deepOrange.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.deepOrange.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.sports_basketball, size: 14, color: Colors.deepOrange),
            const SizedBox(width: 4),
            const Text('NEW', style: TextStyle(fontSize: 11, color: Colors.deepOrange, fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }
    
    // Sent challenge status
    IconData icon;
    Color color;
    
    switch (status) {
      case 'accepted':
        icon = Icons.check_circle_outline;
        color = Colors.green;
        break;
      case 'declined':
        icon = Icons.cancel_outlined;
        color = Colors.red;
        break;
      case 'expired':
        icon = Icons.timer_off_outlined;
        color = Colors.grey;
        break;
      default: // pending
        icon = Icons.schedule;
        color = Colors.blue;
    }
    
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 20, color: color),
    );
  }

  Future<void> _cancelChallenge(ChallengeRequest challenge) async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;
    
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Challenge?'),
        content: Text('Cancel your challenge to ${challenge.sender.name}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );
    
    if (confirm == true) {
      try {
        await _messagesService.cancelChallenge(userId, challenge.message.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Challenge cancelled')),
          );
          _loadChallenges();
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

  Future<void> _declineChallenge(ChallengeRequest challenge) async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;
    
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Decline Challenge?'),
        content: Text('Decline the challenge from ${challenge.sender.name}?'),
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
            SnackBar(content: Text('Declined challenge from ${challenge.sender.name}')),
          );
          _loadChallenges();
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

  Future<void> _acceptChallenge(ChallengeRequest challenge) async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      // Accept the challenge and get the matchId from backend
      final result = await _messagesService.acceptChallenge(userId, challenge.message.id);
      final matchId = result['matchId'] as String?;

      if (!mounted) return;

      // Set up the opponent in MatchState
      final p = Player(
        id: challenge.sender.id,
        slug: challenge.sender.id,
        name: challenge.sender.name,
        team: challenge.sender.team ?? 'Free Agent',
        position: challenge.sender.position ?? 'G',
        age: 25,
        height: '6\'0"',
        weight: '180 lbs',
        rating: challenge.sender.rating,
        offense: 80,
        defense: 80,
        shooting: 80,
        passing: 80,
        rebounding: 80,
      );

      final matchState = context.read<MatchState>();
      matchState.setOpponent(p);
      if (matchId != null) {
        matchState.setMatchId(matchId);
      }

      // Navigate to match setup
      context.push('/match/setup');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error accepting challenge: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final topPlayers = mockPlayers.take(5).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('HoopRank'),
        actions: [
          // Profile avatar button (replaced refresh)
          Consumer<AuthState>(
            builder: (context, auth, _) {
              final photoUrl = auth.currentUser?.photoUrl;
              return GestureDetector(
                onTap: () => context.push('/profile'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: CircleAvatar(
                    radius: 16,
                    backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
                    child: photoUrl == null
                        ? const Icon(Icons.person, size: 18)
                        : null,
                  ),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.help_outline),
            tooltip: 'View Tutorial',
            onPressed: () async {
              final auth = Provider.of<AuthState>(context, listen: false);
              await auth.resetOnboarding();
              if (context.mounted) {
                context.go('/onboarding');
              }
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final auth = Provider.of<AuthState>(context, listen: false);
              await auth.logout();
              if (context.mounted) {
                context.go('/login');
              }
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // HoopRank Section - Compact with Individual + Team Ratings
              Consumer<AuthState>(
                builder: (context, auth, _) {
                  final rating = _currentRating ?? auth.currentUser?.rating ?? 0.0;
                  // Take up to 2 teams to show alongside individual rating
                  final teamsToShow = _myTeams.take(2).toList();
                  
                  return Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.deepOrange.shade800, Colors.orange.shade600],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        const Text(
                          'Your HoopRanks',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                        const SizedBox(height: 12),
                        // Always show 3 rating slots: 1v1, 3v3, 5v5
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            // 1v1 individual rating
                            _buildRatingChip(
                              label: '1v1',
                              rating: rating,
                              color: Colors.deepOrange,
                            ),
                            // 3v3 team - find team with type 3v3
                            _buildTeamSlot('3v3', Colors.blue),
                            // 5v5 team - find team with type 5v5
                            _buildTeamSlot('5v5', Colors.purple),
                          ],
                        ),
                        const SizedBox(height: 12),
                        // Status update button
                        Consumer<CheckInState>(
                          builder: (context, checkInState, _) {
                            final currentStatus = checkInState.getMyStatus();
                            return GestureDetector(
                              onTap: () => _showStatusUpdateDialog(context, checkInState),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: Colors.white.withOpacity(0.3)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      currentStatus != null ? Icons.edit_note : Icons.add_comment,
                                      color: Colors.white,
                                      size: 18,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      currentStatus ?? "What are you up to?",
                                      style: TextStyle(
                                        color: Colors.white.withOpacity(currentStatus != null ? 1.0 : 0.8),
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 24),


              // Pending Score Confirmations Section
              if (_pendingConfirmations.isNotEmpty) ...[
                const Text(
                  '📊 Confirm Scores',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                ...(_pendingConfirmations.map((conf) {
                  final score = conf['score'] as Map<String, dynamic>?;
                  final opponentName = conf['opponentName'] ?? 'Opponent';
                  final matchId = conf['matchId'] as String;
                  
                  return Card(
                    color: Colors.blue.shade900.withOpacity(0.3),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.blue.shade700, width: 1),
                    ),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.scoreboard, color: Colors.blue),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '$opponentName submitted a score',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (score != null)
                            Text(
                              'Score: ${score.values.join(' - ')}',
                              style: const TextStyle(color: Colors.grey),
                            ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: () async {
                                    try {
                                      await ApiService.confirmScore(matchId);
                                      // Refresh user data to get updated rating
                                      if (context.mounted) {
                                        await Provider.of<AuthState>(context, listen: false).refreshUser();
                                      }
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Score confirmed!')),
                                      );
                                      _loadPendingConfirmations();
                                    } catch (e) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Error: $e')),
                                      );
                                    }
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.green,
                                    foregroundColor: Colors.white,
                                  ),
                                  child: const Text('Confirm'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () async {
                                    // Show confirmation dialog
                                    final confirmed = await showDialog<bool>(
                                      context: context,
                                      builder: (ctx) => AlertDialog(
                                        backgroundColor: Colors.grey[900],
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(16),
                                        ),
                                        title: Row(
                                          children: [
                                            Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
                                            const SizedBox(width: 8),
                                            const Text('Contest Score?'),
                                          ],
                                        ),
                                        content: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Text(
                                              'Are you sure you want to contest this score?',
                                              style: TextStyle(fontWeight: FontWeight.bold),
                                            ),
                                            const SizedBox(height: 16),
                                            Row(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Icon(Icons.notifications, color: Colors.grey[400], size: 18),
                                                const SizedBox(width: 8),
                                                Expanded(
                                                  child: Text(
                                                    '$opponentName will be notified of this contest.',
                                                    style: TextStyle(color: Colors.grey[400], fontSize: 13),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 12),
                                            Row(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Icon(Icons.history, color: Colors.grey[400], size: 18),
                                                const SizedBox(width: 8),
                                                Expanded(
                                                  child: Text(
                                                    'This will be logged on your profile.',
                                                    style: TextStyle(color: Colors.grey[400], fontSize: 13),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                        actions: [
                                          TextButton(
                                            onPressed: () => Navigator.pop(ctx, false),
                                            child: const Text('Cancel'),
                                          ),
                                          ElevatedButton(
                                            onPressed: () => Navigator.pop(ctx, true),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.red,
                                              foregroundColor: Colors.white,
                                            ),
                                            child: const Text('Contest'),
                                          ),
                                        ],
                                      ),
                                    );
                                    
                                    if (confirmed != true) return;
                                    
                                    try {
                                      await ApiService.contestScore(matchId);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Score contested')),
                                      );
                                      _loadPendingConfirmations();
                                    } catch (e) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Error: $e')),
                                      );
                                    }
                                  },
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.red,
                                  ),
                                  child: const Text('Contest'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                })),
                const SizedBox(height: 16),
              ],

              // Challenges Section
              const Text(
                '⚔️ Challenges',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              if (_challenges.isEmpty && _teamChallenges.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey[800],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'No active challenges. Start a match!',
                    style: TextStyle(color: Colors.grey),
                    textAlign: TextAlign.center,
                  ),
                )
              else
                Card(
                  color: Colors.orange.shade900.withOpacity(0.2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.orange.shade800, width: 1),
                  ),
                  child: Column(
                    children: _challenges.map((challenge) {
                      final isSent = challenge.isSent;
                      final status = challenge.message.challengeStatus ?? 'pending';
                      
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.08),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            // Header row with avatar, info, and status
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Row(
                                children: [
                                  // Avatar - clickable for profile
                                  GestureDetector(
                                    onTap: () => PlayerProfileSheet.showById(context, challenge.sender.id),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: isSent ? Colors.blue.shade200 : Colors.deepOrange.shade200,
                                          width: 2,
                                        ),
                                      ),
                                      child: CircleAvatar(
                                        radius: 24,
                                        backgroundColor: isSent ? Colors.blue.shade50 : Colors.deepOrange.shade50,
                                        backgroundImage: challenge.sender.photoUrl != null
                                            ? NetworkImage(challenge.sender.photoUrl!)
                                            : null,
                                        child: challenge.sender.photoUrl == null
                                            ? Text(
                                                challenge.sender.name[0],
                                                style: TextStyle(
                                                  color: isSent ? Colors.blue.shade700 : Colors.deepOrange,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 18,
                                                ),
                                              )
                                            : null,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  // Name and message
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        GestureDetector(
                                          onTap: () => PlayerProfileSheet.showById(context, challenge.sender.id),
                                          child: Text(
                                            challenge.sender.name,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 16,
                                              color: Colors.blue,
                                              decoration: TextDecoration.underline,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          isSent ? 'Challenge sent' : challenge.message.content,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: Colors.grey[600],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Status indicator
                                  _buildStatusIndicator(isSent, status),
                                ],
                              ),
                            ),
                            // Action buttons row
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.grey[50],
                                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                              ),
                              child: Row(
                                children: [
                                  // Message button (50% for received, 80% for sent)
                                  Expanded(
                                    flex: isSent ? 4 : 1,
                                    child: InkWell(
                                      onTap: () => context.go('/messages/chat/${challenge.sender.id}'),
                                      borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(16)),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.chat_bubble_outline, size: 18, color: Colors.grey[700]),
                                            const SizedBox(width: 6),
                                            Text('Message', style: TextStyle(color: Colors.grey[700], fontWeight: FontWeight.w500)),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  // Divider
                                  Container(width: 1, height: 24, color: Colors.grey[200]),
                                  // Cancel or Accept button (20% for sent, 50% for received)
                                  if (isSent)
                                    Expanded(
                                      flex: 1,
                                      child: InkWell(
                                        onTap: () => _cancelChallenge(challenge),
                                        borderRadius: const BorderRadius.only(bottomRight: Radius.circular(16)),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.close, size: 18, color: Colors.red[400]),
                                            ],
                                          ),
                                        ),
                                      ),
                                    )
                                  else ...[
                                    // Accept button
                                    Expanded(
                                      flex: 1,
                                      child: Material(
                                        color: Colors.deepOrange.withOpacity(0.1),
                                        borderRadius: BorderRadius.zero,
                                        child: InkWell(
                                          onTap: () => _acceptChallenge(challenge),
                                          borderRadius: BorderRadius.zero,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(vertical: 12),
                                            child: Row(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                const Icon(Icons.sports_basketball, size: 18, color: Colors.deepOrange),
                                                const SizedBox(width: 6),
                                                const Text('Accept', style: TextStyle(color: Colors.deepOrange, fontWeight: FontWeight.bold)),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    // Divider between accept and decline
                                    Container(width: 1, height: 24, color: Colors.grey[200]),
                                    // Decline button (red X) on the right
                                    SizedBox(
                                      width: 44,
                                      child: InkWell(
                                        onTap: () => _declineChallenge(challenge),
                                        borderRadius: const BorderRadius.only(bottomRight: Radius.circular(16)),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          child: Icon(Icons.close, size: 18, color: Colors.red[400]),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),

              // Team Challenges Section (3v3/5v5)
              if (_teamChallenges.isNotEmpty) ...[
                const SizedBox(height: 16),
                ...(_teamChallenges.map((challenge) {
                  final challengerTeam = challenge['challengerTeam'] as Map<String, dynamic>?;
                  final opponentTeam = challenge['opponentTeam'] as Map<String, dynamic>?;
                  final matchId = challenge['matchId'] as String?;
                  final matchType = challenge['matchType'] as String? ?? '3v3';
                  final isSent = challenge['isSent'] == true;
                  
                  // Determine which team is "the other team" based on perspective
                  final otherTeam = isSent ? opponentTeam : challengerTeam;
                  final otherTeamName = otherTeam?['name'] ?? 'Unknown Team';
                  
                  return Card(
                    color: matchType == '3v3' 
                        ? Colors.blue.shade900.withOpacity(0.3)
                        : Colors.purple.shade900.withOpacity(0.3),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(
                        color: matchType == '3v3' ? Colors.blue.shade700 : Colors.purple.shade700, 
                        width: 1
                      ),
                    ),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: matchType == '3v3' ? Colors.blue : Colors.purple,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  matchType.toUpperCase(),
                                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      isSent 
                                          ? 'Challenge sent to $otherTeamName'
                                          : '$otherTeamName challenged you!',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                    ),
                                    if (otherTeam?['rating'] != null)
                                      Text(
                                        '⭐ ${_parseRating(otherTeam!['rating']).toStringAsFixed(2)}',
                                        style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                                      ),
                                  ],
                                ),
                              ),
                              if (isSent && matchId != null)
                                IconButton(
                                  onPressed: () async {
                                    final confirm = await showDialog<bool>(
                                      context: context,
                                      builder: (ctx) => AlertDialog(
                                        title: const Text('Cancel Challenge?'),
                                        content: Text('Cancel your team challenge to $otherTeamName?'),
                                        actions: [
                                          TextButton(
                                            onPressed: () => Navigator.pop(ctx, false),
                                            child: const Text('No'),
                                          ),
                                          TextButton(
                                            onPressed: () => Navigator.pop(ctx, true),
                                            style: TextButton.styleFrom(foregroundColor: Colors.red),
                                            child: const Text('Yes, Cancel'),
                                          ),
                                        ],
                                      ),
                                    );
                                    if (confirm == true) {
                                      try {
                                        await ApiService.declineTeamChallenge(matchId);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Challenge to $otherTeamName cancelled')),
                                        );
                                        _loadTeamChallenges();
                                      } catch (e) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Error: $e')),
                                        );
                                      }
                                    }
                                  },
                                  icon: const Icon(Icons.close, size: 20, color: Colors.grey),
                                  tooltip: 'Cancel Challenge',
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                )
                              else if (isSent)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.blue.shade100,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text('Sent', style: TextStyle(color: Colors.blue, fontSize: 12)),
                                ),
                            ],
                          ),
                          if (!isSent && matchId != null) ...[
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: () async {
                                      try {
                                        final result = await ApiService.acceptTeamChallenge(matchId);
                                        _loadTeamChallenges();
                                        
                                        // Set up MatchState for team match
                                        if (mounted && result) {
                                          final matchState = Provider.of<MatchState>(context, listen: false);
                                          matchState.reset();
                                          matchState.matchId = matchId;
                                          matchState.mode = matchType;
                                          // For received challenges: user is opponent team, other is challenger
                                          final myTeam = opponentTeam; // User received the challenge
                                          matchState.myTeamName = myTeam?['name'] ?? 'Your Team';
                                          matchState.opponentTeamName = otherTeamName;
                                          matchState.startMatch(); // Mark as active
                                          
                                          // Navigate to score entry for team match (skip setup since teams are already set)
                                          context.push('/match/score');
                                        }
                                      } catch (e) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Error: $e')),
                                        );
                                      }
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.green,
                                      foregroundColor: Colors.white,
                                    ),
                                    child: const Text('Accept'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () async {
                                      try {
                                        await ApiService.declineTeamChallenge(matchId);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Declined challenge from $otherTeamName')),
                                        );
                                        _loadTeamChallenges();
                                      } catch (e) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Error: $e')),
                                        );
                                      }
                                    },
                                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                                    child: const Text('Decline'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                })),
              ],
              const SizedBox(height: 24),

              // Team Invites Section
              if (_teamInvites.isNotEmpty) ...[
                Row(
                  children: [
                    Icon(Icons.group_add, color: Colors.blue, size: 24),
                    const SizedBox(width: 8),
                    const Text(
                      'Team Invites',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.blue,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${_teamInvites.length}',
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...(_teamInvites.map((invite) {
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    color: Colors.blue.withOpacity(0.1),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.blue.withOpacity(0.3)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: invite['teamType'] == '3v3' ? Colors.blue : Colors.purple,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              invite['teamType'] ?? '3v3',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  invite['name'] ?? 'Team',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                                ),
                                Text(
                                  'Invited by ${invite['ownerName'] ?? 'Unknown'}',
                                  style: TextStyle(color: Colors.grey[400], fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: Colors.red),
                            tooltip: 'Decline',
                            onPressed: () async {
                              try {
                                await ApiService.declineTeamInvite(invite['id']);
                                _loadTeamInvites();
                              } catch (e) {
                                debugPrint('Error declining invite: $e');
                              }
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.check, color: Colors.green),
                            tooltip: 'Accept',
                            onPressed: () async {
                              try {
                                await ApiService.acceptTeamInvite(invite['id']);
                                _loadTeamInvites();
                                _loadMyTeams();
                              } catch (e) {
                                debugPrint('Error accepting invite: $e');
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList()),
                const SizedBox(height: 24),
              ],

              // Followed Courts Section
              Row(
                children: [
                  Icon(Icons.favorite, color: Colors.red, size: 24),
                  const SizedBox(width: 8),
                  const Text(
                    'Followed Courts',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Activity at courts you follow',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 12),
              Consumer<CheckInState>(
                builder: (context, checkInState, _) {
                  // Check if there are any followed courts first
                  if (checkInState.followedCourts.isEmpty) {
                    // Empty state - no courts followed
                    return Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.grey[850],
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey[700]!, width: 1),
                      ),
                      child: Column(
                        children: [
                          Icon(Icons.location_on_outlined, size: 48, color: Colors.grey[600]),
                          const SizedBox(height: 12),
                          const Text(
                            'No courts followed yet',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Follow courts to see activity here',
                            style: TextStyle(color: Colors.grey[500], fontSize: 13),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () => context.go('/courts'),
                            icon: const Icon(Icons.map, size: 18),
                            label: const Text('Find Courts to Follow'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            ),
                          ),
                        ],
                      ),
                    );
                  }
                  
                  // Use FutureBuilder to load court data with names
                  return FutureBuilder<List<FollowedCourtInfo>>(
                    future: checkInState.getFollowedCourtsWithActivity(),
                    builder: (context, snapshot) {
                      if (!snapshot.hasData) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.all(20),
                            child: CircularProgressIndicator(),
                          ),
                        );
                      }
                      
                      final followedCourts = snapshot.data!;
                      // Filter out unknown courts (ones that couldn't be resolved)
                      final validCourts = followedCourts.where((c) => c.courtName != 'Unknown Court').toList();
                      if (validCourts.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      
                      // Show individual court cards
                      return Column(
                        children: validCourts.map((courtInfo) {


                      return Card(
                        color: Colors.grey[850],
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: InkWell(
                          onTap: () {
                            // Look up court and show details sheet directly
                            final court = CourtService().getCourtById(courtInfo.courtId);
                            if (court != null) {
                              CourtDetailsSheet.show(context, court);
                            }
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Court header
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            courtInfo.courtName,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 15,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          if (courtInfo.checkInCount > 0)
                                            Text(
                                              '${courtInfo.checkInCount} player${courtInfo.checkInCount == 1 ? '' : 's'} checked in',
                                              style: TextStyle(
                                                color: Colors.green[400],
                                                fontSize: 12,
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                    // Alert bell indicator
                                    Consumer<CheckInState>(
                                      builder: (context, checkInState, _) {
                                        final hasAlert = checkInState.isAlertEnabled(courtInfo.courtId);
                                        return GestureDetector(
                                          onTap: () => checkInState.toggleAlert(courtInfo.courtId),
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(horizontal: 8),
                                            child: Icon(
                                              hasAlert ? Icons.notifications_active : Icons.notifications_none,
                                              color: hasAlert ? Colors.orange : Colors.grey[500],
                                              size: 20,
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                    Icon(Icons.chevron_right, color: Colors.grey[600]),
                                  ],
                                ),
                                // Recent activity
                                if (courtInfo.recentActivity.isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  const Divider(height: 1),
                                  const SizedBox(height: 10),
                                  ...courtInfo.recentActivity.take(2).map((activity) {
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: 6),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.check_circle,
                                            color: Colors.green[400],
                                            size: 16,
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: activity.playerId != null
                                                ? GestureDetector(
                                                    onTap: () => PlayerProfileSheet.showById(context, activity.playerId!),
                                                    child: Text.rich(
                                                      TextSpan(
                                                        children: [
                                                          TextSpan(
                                                            text: activity.playerName ?? 'Someone',
                                                            style: TextStyle(
                                                              color: Colors.blue[300],
                                                              fontSize: 13,
                                                              decoration: TextDecoration.underline,
                                                            ),
                                                          ),
                                                          TextSpan(
                                                            text: ' checked in',
                                                            style: TextStyle(
                                                              color: Colors.grey[400],
                                                              fontSize: 13,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  )
                                                : Text(
                                                    activity.description,
                                                    style: TextStyle(
                                                      color: Colors.grey[400],
                                                      fontSize: 13,
                                                    ),
                                                  ),
                                          ),
                                          Text(
                                            activity.timeAgo,
                                            style: TextStyle(
                                              color: Colors.grey[600],
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),

                                ] else ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    'No recent check-ins',
                                    style: TextStyle(
                                      color: Colors.grey[600],
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                      );
                    },
                  );
                },
              ),

              const SizedBox(height: 24),
              
              // Followed Players Section
              const Row(
                children: [
                  Icon(Icons.people, color: Colors.blue, size: 24),
                  SizedBox(width: 8),
                  Text(
                    'Followed Players',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Players you follow',
                style: TextStyle(color: Colors.grey[500], fontSize: 13),
              ),
              const SizedBox(height: 12),
              Consumer<CheckInState>(
                builder: (context, checkInState, _) {
                  final followedPlayerIds = checkInState.followedPlayers.toList();
                  
                  if (followedPlayerIds.isEmpty) {
                    // Empty state - no players followed
                    return Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.grey[850],
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey[700]!, width: 1),
                      ),
                      child: Column(
                        children: [
                          Icon(Icons.person_add_alt_1, size: 48, color: Colors.grey[600]),
                          const SizedBox(height: 12),
                          const Text(
                            'No players followed yet',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Tap the ❤️ on any player profile to follow them',
                            style: TextStyle(color: Colors.grey[500], fontSize: 13),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () => context.go('/rankings'),
                            icon: const Icon(Icons.leaderboard, size: 18),
                            label: const Text('Browse Players'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blue,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            ),
                          ),
                        ],
                      ),
                    );
                  }
                  
                  // Use FutureBuilder to load player info with activities
                  return FutureBuilder<List<FollowedPlayerInfo>>(
                    future: checkInState.getFollowedPlayersInfo(),
                    builder: (context, snapshot) {
                      if (!snapshot.hasData) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.all(20),
                            child: CircularProgressIndicator(),
                          ),
                        );
                      }
                      
                      final players = snapshot.data!;
                      if (players.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      
                      return Column(
                        children: players.take(5).map((player) {
                          return Card(
                            color: Colors.grey[850],
                            margin: const EdgeInsets.only(bottom: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: InkWell(
                              onTap: () => PlayerProfileSheet.showById(context, player.playerId),
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Player header row
                                    Row(
                                      children: [
                                        // Avatar
                                        CircleAvatar(
                                          radius: 22,
                                          backgroundImage: player.photoUrl != null 
                                              ? NetworkImage(player.photoUrl!) 
                                              : null,
                                          backgroundColor: Colors.blue.withOpacity(0.2),
                                          child: player.photoUrl == null
                                              ? Text(
                                                  player.name.isNotEmpty ? player.name[0].toUpperCase() : '?',
                                                  style: const TextStyle(color: Colors.blue),
                                                )
                                              : null,
                                        ),
                                        const SizedBox(width: 10),
                                        // Name and rating
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                player.name,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 15,
                                                ),
                                              ),
                                              Text(
                                                '⭐ ${player.rating.toStringAsFixed(2)}',
                                                style: TextStyle(
                                                  color: Colors.grey[400],
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        // Action icons (like Rankings page)
                                        // Message button
                                        IconButton(
                                          onPressed: () {
                                            context.go('/messages');
                                          },
                                          icon: Icon(Icons.chat_bubble_outline, 
                                            color: Colors.grey[400], 
                                            size: 20,
                                          ),
                                          visualDensity: VisualDensity.compact,
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                        ),
                                        // Challenge button
                                        IconButton(
                                          onPressed: () {
                                            // Start a 1v1 challenge flow
                                            _showQuickChallengeSheet(context, player.playerId, player.name);
                                          },
                                          icon: Icon(Icons.sports_basketball, 
                                            color: Colors.deepOrange, 
                                            size: 20,
                                          ),
                                          visualDensity: VisualDensity.compact,
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                        ),
                                        // Follow heart (to unfollow)
                                        IconButton(
                                          onPressed: () => checkInState.unfollowPlayer(player.playerId),
                                          icon: const Icon(Icons.favorite, color: Colors.red, size: 20),
                                          visualDensity: VisualDensity.compact,
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                        ),
                                      ],
                                    ),
                                    
                                    // Activity feed (if any activities)
                                    if (player.recentActivity.isNotEmpty) ...[
                                      const SizedBox(height: 10),
                                      Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: Colors.grey[800],
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: player.recentActivity.take(3).map((activity) {
                                            return Padding(
                                              padding: const EdgeInsets.symmetric(vertical: 4),
                                              child: Row(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    activity.icon ?? '•',
                                                    style: const TextStyle(fontSize: 14),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Expanded(
                                                    child: Column(
                                                      crossAxisAlignment: CrossAxisAlignment.start,
                                                      children: [
                                                        Text(
                                                          activity.description,
                                                          style: const TextStyle(
                                                            fontSize: 13,
                                                            height: 1.3,
                                                          ),
                                                          maxLines: 2,
                                                          overflow: TextOverflow.ellipsis,
                                                        ),
                                                        Text(
                                                          activity.timeAgo,
                                                          style: TextStyle(
                                                            color: Colors.grey[500],
                                                            fontSize: 11,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }).toList(),
                                        ),
                                      ),
                                    ] else ...[
                                      // No recent activity message
                                      const SizedBox(height: 6),
                                      Text(
                                        'No recent activity',
                                        style: TextStyle(
                                          color: Colors.grey[500],
                                          fontSize: 12,
                                          fontStyle: FontStyle.italic,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      );
                    },
                  );
                },
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

/// Team selection sheet for choosing opponent team in team matches
class _TeamSelectionSheet extends StatefulWidget {
  final String teamType;
  final String myTeamId;
  final String myTeamName;
  final Function(Map<String, dynamic>) onTeamSelected;

  const _TeamSelectionSheet({
    required this.teamType,
    required this.myTeamId,
    required this.myTeamName,
    required this.onTeamSelected,
  });

  @override
  State<_TeamSelectionSheet> createState() => _TeamSelectionSheetState();
}

class _TeamSelectionSheetState extends State<_TeamSelectionSheet> {
  List<Map<String, dynamic>> _teams = [];
  bool _isLoading = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadTeams();
  }

  Future<void> _loadTeams() async {
    try {
      final response = await ApiService.getRankings(mode: widget.teamType);
      if (mounted) {
        setState(() {
          // Filter out user's own team
          _teams = response.where((t) => t['id'] != widget.myTeamId).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredTeams = _teams.where((t) {
      final name = (t['name'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery.toLowerCase());
    }).toList();

    final color = widget.teamType == '3v3' ? Colors.blue : Colors.purple;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withOpacity(0.2),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Challenge ${widget.teamType} Team',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              Text(
                'as ${widget.myTeamName}',
                style: TextStyle(color: Colors.grey[400]),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search teams...',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Colors.grey[800],
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
        ),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : filteredTeams.isEmpty
                  ? Center(
                      child: Text(
                        'No ${widget.teamType} teams found',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    )
                  : ListView.builder(
                      itemCount: filteredTeams.length,
                      itemBuilder: (context, index) {
                        final team = filteredTeams[index];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: color.withOpacity(0.3),
                            child: Text(
                              (team['name'] ?? '?')[0].toUpperCase(),
                              style: TextStyle(color: color, fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(team['name'] ?? 'Team'),
                          subtitle: Text(
                            'Rating: ${(team['rating'] as num?)?.toStringAsFixed(1) ?? '3.0'} • ${team['wins'] ?? 0}W-${team['losses'] ?? 0}L',
                          ),
                          trailing: ElevatedButton(
                            onPressed: () => widget.onTeamSelected(team),
                            style: ElevatedButton.styleFrom(backgroundColor: color),
                            child: const Text('Challenge'),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}

/// Enhanced status composer with @-mention support for tagging players and courts
class _StatusComposerSheet extends StatefulWidget {
  final CheckInState checkInState;
  final String userName;
  final String? userPhotoUrl;
  final String? initialStatus;

  const _StatusComposerSheet({
    required this.checkInState,
    required this.userName,
    this.userPhotoUrl,
    this.initialStatus,
  });

  @override
  State<_StatusComposerSheet> createState() => _StatusComposerSheetState();
}

class _StatusComposerSheetState extends State<_StatusComposerSheet> {
  late TextEditingController _controller;
  final FocusNode _focusNode = FocusNode();
  
  // Tagged entities
  final List<Map<String, String>> _taggedPlayers = [];
  final List<Map<String, String>> _taggedCourts = [];
  
  // Autocomplete state
  bool _showAutocomplete = false;
  String _searchQuery = '';
  String _searchType = 'player'; // 'player' or 'court'
  int _mentionStartIndex = -1;
  
  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialStatus ?? '');
    _controller.addListener(_onTextChanged);
  }
  
  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }
  
  void _onTextChanged() {
    final text = _controller.text;
    final cursorPos = _controller.selection.baseOffset;
    
    if (cursorPos < 0 || cursorPos > text.length) {
      _hideAutocomplete();
      return;
    }
    
    // Look backwards for @ symbol
    int atIndex = -1;
    for (int i = cursorPos - 1; i >= 0; i--) {
      if (text[i] == '@') {
        atIndex = i;
        break;
      } else if (text[i] == ' ' || text[i] == '\n') {
        break;
      }
    }
    
    if (atIndex >= 0) {
      final query = text.substring(atIndex + 1, cursorPos).toLowerCase();
      setState(() {
        _showAutocomplete = true;
        _searchQuery = query;
        _mentionStartIndex = atIndex;
      });
    } else {
      _hideAutocomplete();
    }
  }
  
  void _hideAutocomplete() {
    if (_showAutocomplete) {
      setState(() {
        _showAutocomplete = false;
        _searchQuery = '';
        _mentionStartIndex = -1;
      });
    }
  }
  
  List<Map<String, dynamic>> _getPlayerSuggestions() {
    final players = <Map<String, dynamic>>[];
    
    // Add followed players
    for (final playerId in widget.checkInState.followedPlayers) {
      final name = widget.checkInState.getPlayerName(playerId);
      if (name.toLowerCase().contains(_searchQuery)) {
        players.add({'id': playerId, 'name': name, 'type': 'player'});
      }
    }
    
    // Add mock suggestions if empty
    if (players.isEmpty && _searchQuery.isEmpty) {
      players.addAll([
        {'id': 'demo_player_1', 'name': 'Marcus Johnson', 'type': 'player'},
        {'id': 'demo_player_2', 'name': 'Sarah Chen', 'type': 'player'},
        {'id': 'demo_player_3', 'name': 'Mike Williams', 'type': 'player'},
      ]);
    }
    
    return players.take(5).toList();
  }
  
  List<Map<String, dynamic>> _getCourtSuggestions() {
    final courts = <Map<String, dynamic>>[];
    final courtService = CourtService();
    
    // Add followed courts
    for (final courtId in widget.checkInState.followedCourts) {
      final court = courtService.getCourtById(courtId);
      if (court != null && court.name.toLowerCase().contains(_searchQuery)) {
        courts.add({'id': courtId, 'name': court.name, 'type': 'court'});
      }
    }
    
    // If no matches from followed, search all courts
    if (courts.isEmpty && _searchQuery.length >= 2) {
      for (final court in courtService.courts.take(50)) {
        if (court.name.toLowerCase().contains(_searchQuery)) {
          courts.add({'id': court.id, 'name': court.name, 'type': 'court'});
          if (courts.length >= 5) break;
        }
      }
    }
    
    return courts.take(5).toList();
  }
  
  void _insertMention(Map<String, dynamic> item) {
    final text = _controller.text;
    final cursorPos = _controller.selection.baseOffset;
    
    // Replace @query with @name
    final beforeMention = text.substring(0, _mentionStartIndex);
    final afterMention = cursorPos < text.length ? text.substring(cursorPos) : '';
    final mentionText = '@${item['name']} ';
    
    final newText = beforeMention + mentionText + afterMention;
    _controller.text = newText;
    _controller.selection = TextSelection.collapsed(
      offset: beforeMention.length + mentionText.length,
    );
    
    // Add to tagged list
    setState(() {
      if (item['type'] == 'player') {
        if (!_taggedPlayers.any((p) => p['id'] == item['id'])) {
          _taggedPlayers.add({'id': item['id'] as String, 'name': item['name'] as String});
        }
      } else {
        if (!_taggedCourts.any((c) => c['id'] == item['id'])) {
          _taggedCourts.add({'id': item['id'] as String, 'name': item['name'] as String});
        }
      }
    });
    
    _hideAutocomplete();
  }
  
  void _removeTag(String type, String id) {
    setState(() {
      if (type == 'player') {
        _taggedPlayers.removeWhere((p) => p['id'] == id);
      } else {
        _taggedCourts.removeWhere((c) => c['id'] == id);
      }
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              const Expanded(
                child: Text(
                  "What's your status?",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
                iconSize: 20,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Use @ to tag players and courts',
            style: TextStyle(color: Colors.grey[400], fontSize: 13),
          ),
          const SizedBox(height: 16),
          
          // Text input - larger
          TextField(
            controller: _controller,
            focusNode: _focusNode,
            autofocus: true,
            maxLength: 100,
            maxLines: 3,
            minLines: 2,
            decoration: InputDecoration(
              hintText: 'Looking for games at @Olympic Club... 🏀',
              hintStyle: TextStyle(color: Colors.grey[500]),
              filled: true,
              fillColor: Colors.grey[800],
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.all(16),
            ),
          ),
          
          // Autocomplete dropdown
          if (_showAutocomplete) ...[
            const SizedBox(height: 4),
            Container(
              constraints: const BoxConstraints(maxHeight: 180),
              decoration: BoxDecoration(
                color: Colors.grey[850],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[700]!),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Type toggle
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _searchType = 'player'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: _searchType == 'player' ? Colors.deepOrange.withOpacity(0.3) : null,
                              borderRadius: const BorderRadius.only(topLeft: Radius.circular(11)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person, size: 16, color: _searchType == 'player' ? Colors.deepOrange : Colors.grey),
                                const SizedBox(width: 4),
                                Text('Players', style: TextStyle(
                                  fontWeight: FontWeight.w500,
                                  color: _searchType == 'player' ? Colors.deepOrange : Colors.grey,
                                )),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _searchType = 'court'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: _searchType == 'court' ? Colors.blue.withOpacity(0.3) : null,
                              borderRadius: const BorderRadius.only(topRight: Radius.circular(11)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.location_on, size: 16, color: _searchType == 'court' ? Colors.blue : Colors.grey),
                                const SizedBox(width: 4),
                                Text('Courts', style: TextStyle(
                                  fontWeight: FontWeight.w500,
                                  color: _searchType == 'court' ? Colors.blue : Colors.grey,
                                )),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Divider(height: 1, color: Colors.grey[700]),
                  // Suggestions
                  Flexible(
                    child: ListView(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      children: (_searchType == 'player' ? _getPlayerSuggestions() : _getCourtSuggestions())
                          .map((item) => ListTile(
                                dense: true,
                                leading: CircleAvatar(
                                  radius: 14,
                                  backgroundColor: item['type'] == 'player' 
                                      ? Colors.deepOrange.withOpacity(0.3) 
                                      : Colors.blue.withOpacity(0.3),
                                  child: Icon(
                                    item['type'] == 'player' ? Icons.person : Icons.location_on,
                                    size: 14,
                                    color: item['type'] == 'player' ? Colors.deepOrange : Colors.blue,
                                  ),
                                ),
                                title: Text(item['name'] as String, style: const TextStyle(fontSize: 14)),
                                onTap: () => _insertMention(item),
                              ))
                          .toList(),
                    ),
                  ),
                ],
              ),
            ),
          ],
          
          // Tagged chips
          if (_taggedPlayers.isNotEmpty || _taggedCourts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                ..._taggedPlayers.map((p) => Chip(
                  avatar: const Icon(Icons.person, size: 16, color: Colors.deepOrange),
                  label: Text(p['name']!, style: const TextStyle(fontSize: 12)),
                  backgroundColor: Colors.deepOrange.withOpacity(0.2),
                  deleteIcon: const Icon(Icons.close, size: 14),
                  onDeleted: () => _removeTag('player', p['id']!),
                )),
                ..._taggedCourts.map((c) => Chip(
                  avatar: const Icon(Icons.location_on, size: 16, color: Colors.blue),
                  label: Text(c['name']!, style: const TextStyle(fontSize: 12)),
                  backgroundColor: Colors.blue.withOpacity(0.2),
                  deleteIcon: const Icon(Icons.close, size: 14),
                  onDeleted: () => _removeTag('court', c['id']!),
                )),
              ],
            ),
          ],
          
          const SizedBox(height: 16),
          
          // Action buttons
          Row(
            children: [
              if (widget.initialStatus != null)
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      widget.checkInState.clearMyStatus();
                      Navigator.pop(context);
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Clear Status'),
                  ),
                ),
              if (widget.initialStatus != null) const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    if (_controller.text.isNotEmpty) {
                      widget.checkInState.setMyStatus(
                        _controller.text,
                        userName: widget.userName,
                        photoUrl: widget.userPhotoUrl,
                      );
                    }
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.deepOrange,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Post Status'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

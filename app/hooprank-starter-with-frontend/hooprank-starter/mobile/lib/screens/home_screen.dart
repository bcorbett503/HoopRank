import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../services/mock_data.dart';
import '../services/location_service.dart';
import '../services/api_service.dart';
import '../services/messages_service.dart';
import '../widgets/player_profile_sheet.dart';
import '../state/app_state.dart';
import '../models.dart';

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadCurrentRating(); // Fetch fresh rating from API
    _loadChallenges();
    _loadPendingConfirmations();
    _loadLocalActivity();
    _loadMyTeams(); // Load user's teams for ratings
    _loadTeamInvites(); // Load pending team invites
    _updateLocation();
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

  @override
  void dispose() {
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
      final activity = await ApiService.getLocalActivity();
      if (mounted) {
        setState(() {
          _localActivity = activity;
          _isLoadingActivity = false;
        });
      }
    } catch (e) {
      print('Error loading local activity: $e');
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
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() => _isLoadingChallenges = true);
              _loadChallenges();
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
                        ElevatedButton.icon(
                          onPressed: _showStartGameModeDialog,
                          icon: const Icon(Icons.play_arrow, size: 18),
                          label: const Text('Start a Game'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: Colors.deepOrange,
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          ),
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
              if (_challenges.isEmpty)
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
                                  else
                                    Expanded(
                                      flex: 1,
                                      child: Material(
                                        color: Colors.deepOrange.withOpacity(0.1),
                                        borderRadius: const BorderRadius.only(bottomRight: Radius.circular(16)),
                                        child: InkWell(
                                          onTap: () => _acceptChallenge(challenge),
                                          borderRadius: const BorderRadius.only(bottomRight: Radius.circular(16)),
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
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
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

              // Local Activity Feed Section
              Row(
                children: [
                  Icon(Icons.stadium, color: Colors.deepOrange, size: 24),
                  const SizedBox(width: 8),
                  const Text(
                    'Feed',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Recent activity from players in your area',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 12),
              if (_isLoadingActivity)
                const Center(child: CircularProgressIndicator())
              else if (_localActivity.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.grey[850],
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey[700]!, width: 1),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.sports_basketball, size: 48, color: Colors.grey[600]),
                      const SizedBox(height: 12),
                      const Text(
                        'No games in your area yet',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Be the first to play and show up here!',
                        style: TextStyle(color: Colors.grey[500], fontSize: 13),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: () => context.go('/rankings'),
                        icon: const Icon(Icons.search, size: 18),
                        label: const Text('Find Players'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.deepOrange,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        ),
                      ),
                    ],
                  ),
                )
              else
                ...(_localActivity.map((game) {
                  final p1 = game['player1'] as Map<String, dynamic>;
                  final p2 = game['player2'] as Map<String, dynamic>;
                  final score = game['score'] as Map<String, dynamic>;
                  final winnerId = game['winnerId'];
                  
                  return Card(
                    color: Colors.grey[850],
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Match header with players
                          Row(
                            children: [
                              // Player 1
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => _showChallengeDialog(p1),
                                  child: Row(
                                    children: [
                                      CircleAvatar(
                                        radius: 20,
                                        backgroundImage: p1['avatarUrl'] != null
                                            ? NetworkImage(p1['avatarUrl'])
                                            : null,
                                        child: p1['avatarUrl'] == null
                                            ? Text((p1['name'] ?? '?')[0].toUpperCase())
                                            : null,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              p1['name'] ?? 'Player 1',
                                              style: TextStyle(
                                                fontWeight: winnerId == p1['id'] ? FontWeight.bold : FontWeight.normal,
                                                color: winnerId == p1['id'] ? Colors.green : Colors.white,
                                              ),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            Text(
                                              '⭐ ${(p1['rating'] ?? 0).toStringAsFixed(1)}',
                                              style: const TextStyle(color: Colors.grey, fontSize: 11),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              // Score
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.deepOrange.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${score['player1'] ?? 0} - ${score['player2'] ?? 0}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.deepOrange,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                              // Player 2
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => _showChallengeDialog(p2),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              p2['name'] ?? 'Player 2',
                                              style: TextStyle(
                                                fontWeight: winnerId == p2['id'] ? FontWeight.bold : FontWeight.normal,
                                                color: winnerId == p2['id'] ? Colors.green : Colors.white,
                                              ),
                                              overflow: TextOverflow.ellipsis,
                                              textAlign: TextAlign.end,
                                            ),
                                            Text(
                                              '⭐ ${(p2['rating'] ?? 0).toStringAsFixed(1)}',
                                              style: const TextStyle(color: Colors.grey, fontSize: 11),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      CircleAvatar(
                                        radius: 20,
                                        backgroundImage: p2['avatarUrl'] != null
                                            ? NetworkImage(p2['avatarUrl'])
                                            : null,
                                        child: p2['avatarUrl'] == null
                                            ? Text((p2['name'] ?? '?')[0].toUpperCase())
                                            : null,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          // Location info
                          if (p1['city'] != null || p2['city'] != null)
                            Text(
                              '📍 ${p1['city'] ?? p2['city'] ?? ''}',
                              style: const TextStyle(color: Colors.grey, fontSize: 11),
                            ),
                        ],
                      ),
                    ),
                  );
                })),
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

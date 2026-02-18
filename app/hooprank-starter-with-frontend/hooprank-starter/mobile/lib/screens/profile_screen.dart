import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:url_launcher/url_launcher.dart';
import '../widgets/hooprank_graph.dart';
import '../widgets/player_profile_sheet.dart';
import '../services/api_service.dart';
import '../state/app_state.dart';
import '../utils/image_utils.dart';
import 'package:intl/intl.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _stats;
  List<Map<String, dynamic>> _history = [];
  List<Map<String, dynamic>> _recentMatches = [];
  List<Map<String, dynamic>> _userPosts = []; // User's status posts
  bool _isLoading = true;
  double? _currentRating; // Fresh rating from API
  int _matchesPlayed = 0;
  int _wins = 0;
  int _losses = 0;
  String? _profileName; // Fresh name from API
  String? _profilePosition; // Fresh position from API
  String? _profileCity; // Fresh city from API
  String? _profileHeight; // Fresh height from API
  String? _profileTeam; // Fresh team from API

  int _parseIntValue(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    debugPrint('Loading profile for userId: $userId');
    if (userId == null) return;

    setState(() => _isLoading = true);

    try {
      final results = await Future.wait([
        ApiService.getUserStats(userId),
        ApiService.getUserRankHistory(userId),
        ApiService.getUserMatchHistory(userId),
        ApiService.getProfile(userId), // Fetch fresh rating and stats
        ApiService.getUserPosts(userId), // Fetch user's posts
      ]);

      if (mounted) {
        final statsData = results[0] as Map<String, dynamic>?;
        final profileData = results[3] as Map<String, dynamic>?;
        debugPrint('Profile data loaded: $profileData');
        debugPrint('Profile name from API: ${profileData?['name']}');
        setState(() {
          _stats = statsData;
          _history = (results[1] as List<Map<String, dynamic>>?) ?? [];
          _recentMatches = (results[2] as List<Map<String, dynamic>>?) ?? [];
          _userPosts = (results[4] as List<Map<String, dynamic>>?) ?? [];

          final hasStatsMatches =
              statsData?.containsKey('matchesPlayed') == true ||
                  statsData?.containsKey('totalMatches') == true ||
                  statsData?.containsKey('matches_played') == true;
          final hasStatsWins = statsData?.containsKey('wins') == true;
          final hasStatsLosses = statsData?.containsKey('losses') == true;

          final statsMatches = _parseIntValue(
            statsData?['matchesPlayed'] ??
                statsData?['totalMatches'] ??
                statsData?['matches_played'],
          );
          final statsWins = _parseIntValue(statsData?['wins']);
          final statsLosses = _parseIntValue(statsData?['losses']);

          // Parse rating and stats from profile data
          if (profileData != null) {
            _currentRating = (profileData['rating'] is num)
                ? (profileData['rating'] as num).toDouble()
                : double.tryParse(profileData['rating']?.toString() ?? '') ??
                    3.0;
            _matchesPlayed = _parseIntValue(
                profileData['matchesPlayed'] ?? profileData['matches_played']);
            _wins = _parseIntValue(profileData['wins']);
            _losses = _parseIntValue(profileData['losses']);
            // Parse profile info
            _profileName = profileData['name']?.toString();
            _profilePosition = profileData['position']?.toString();
            _profileCity = profileData['city']?.toString();
            _profileHeight = profileData['height']?.toString();
            _profileTeam = profileData['team']?.toString();
            debugPrint(
                'Parsed _profileName: $_profileName, _profileTeam: $_profileTeam');
          }

          if (hasStatsMatches) _matchesPlayed = statsMatches;
          if (hasStatsWins) _wins = statsWins;
          if (hasStatsLosses) _losses = statsLosses;

          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final player = auth.currentUser;

    if (player == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final resolvedMatchesPlayed =
        _matchesPlayed > 0 ? _matchesPlayed : player.matchesPlayed;
    final resolvedWins = _wins > 0 ? _wins : player.wins;
    final resolvedLosses = _losses > 0 ? _losses : player.losses;

    final wins = resolvedWins.toString();
    final losses = resolvedLosses.toString();
    final matchesPlayed = resolvedMatchesPlayed.toString();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () => context.push('/profile/setup'),
            tooltip: 'Edit Profile',
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              auth.logout();
              context.go('/login');
            },
            tooltip: 'Logout',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Player Info Card
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            CircleAvatar(
                              radius: 40,
                              backgroundColor: const Color(0xFFFF6B35),
                              backgroundImage: player.photoUrl != null
                                  ? safeImageProvider(player.photoUrl!)
                                  : null,
                              child: player.photoUrl == null
                                  ? Text(
                                      (_profileName ?? player.name).isNotEmpty
                                          ? (_profileName ?? player.name)[0]
                                          : '?',
                                      style: const TextStyle(
                                          fontSize: 32,
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold),
                                    )
                                  : null,
                            ),
                            const SizedBox(height: 12),
                            Text(_profileName ?? player.name,
                                style: const TextStyle(
                                    fontSize: 24, fontWeight: FontWeight.bold)),
                            Text(
                                '${_profileTeam ?? player.team ?? 'No Team'} • ${_profilePosition ?? player.position ?? 'Unknown'}',
                                style: const TextStyle(color: Colors.grey)),
                            const SizedBox(height: 12),
                            // Current HoopRank
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.deepOrange.shade600,
                                    Colors.orange.shade500
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                'HoopRank: ${(_currentRating ?? player.rating).toStringAsFixed(2)}',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                _StatColumn('Matches', matchesPlayed),
                                _StatColumn('Wins', wins),
                                _StatColumn('Losses', losses),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // All Posts Section
                    const Text('All Posts',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    if (_userPosts.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(
                            child: Text('No posts yet. Share an update!',
                                style: TextStyle(color: Colors.grey)),
                          ),
                        ),
                      )
                    else
                      ...(_userPosts.map((post) => _buildPostCard(post))),
                    const SizedBox(height: 24),

                    // Recent Matches
                    const Text('Recent Matches',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    if (_recentMatches.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(
                            child: Text('No matches yet. Challenge someone!',
                                style: TextStyle(color: Colors.grey)),
                          ),
                        ),
                      )
                    else
                      ...(_recentMatches
                          .take(5)
                          .map((match) => _buildMatchCard(match, player.id))),

                    const SizedBox(height: 32),

                    // ========== Settings & Account ==========
                    const Divider(color: Colors.white12),
                    const SizedBox(height: 16),

                    // Privacy Policy Link (Guideline 5.1.1(i))
                    ListTile(
                      leading: const Icon(Icons.privacy_tip_outlined,
                          color: Colors.blue),
                      title: const Text('Privacy Policy',
                          style: TextStyle(color: Colors.white)),
                      trailing: const Icon(Icons.open_in_new,
                          color: Colors.white38, size: 18),
                      onTap: () async {
                        final uri = Uri.parse(
                            'https://hooprank.app/privacy-policy');
                        try {
                          await launchUrl(uri,
                              mode: LaunchMode.externalApplication);
                        } catch (_) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content:
                                    Text('Could not open privacy policy'),
                              ),
                            );
                          }
                        }
                      },
                    ),

                    // Sign Out
                    ListTile(
                      leading: const Icon(Icons.logout, color: Colors.orange),
                      title: const Text('Sign Out',
                          style: TextStyle(color: Colors.white)),
                      onTap: () async {
                        final auth =
                            context.read<AuthState>();
                        await auth.logout();
                        if (mounted) context.go('/');
                      },
                    ),

                    // Delete Account (Guideline 5.1.1(v))
                    ListTile(
                      leading: const Icon(Icons.delete_forever,
                          color: Colors.red),
                      title: const Text('Delete Account',
                          style: TextStyle(color: Colors.red)),
                      onTap: () => _showDeleteAccountDialog(),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
    );
  }

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Delete Account',
            style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
        content: const Text(
          'This action is permanent and cannot be undone.\n\n'
          'All your data including matches, stats, posts, and rankings will be permanently deleted.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child:
                const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              // Show second confirmation
              _confirmDeleteAccount();
            },
            child: const Text('Delete My Account',
                style: TextStyle(
                    color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteAccount() {
    final deleteController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          title: const Text('Are you absolutely sure?',
              style: TextStyle(color: Colors.red)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Type DELETE to confirm account deletion.',
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: deleteController,
                autofocus: true,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Type DELETE here',
                  hintStyle: TextStyle(color: Colors.grey[600]),
                  enabledBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: Colors.grey[700]!),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderSide: const BorderSide(color: Colors.red),
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onChanged: (_) => setDialogState(() {}),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child:
                  const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
            TextButton(
              onPressed: deleteController.text.trim() == 'DELETE'
                  ? () async {
                      Navigator.pop(ctx);
                      try {
                        final success = await ApiService.deleteMyAccount();
                        if (success && mounted) {
                          final auth = context.read<AuthState>();
                          await auth.logout();
                          if (mounted) context.go('/');
                          if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                  'Your account has been deleted. We\'re sorry to see you go.'),
                              backgroundColor: Colors.green,
                            ),
                          );
                        }
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Failed to delete account: $e'),
                              backgroundColor: Colors.red,
                            ),
                          );
                        }
                      }
                    }
                  : null,
              child: Text('Yes, Delete Everything',
                  style: TextStyle(
                      color: deleteController.text.trim() == 'DELETE'
                          ? Colors.red
                          : Colors.grey,
                      fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMatchCard(Map<String, dynamic> match, String myId) {
    final creatorId = match['creator_id']?.toString();
    final opponentId = match['opponent_id']?.toString();
    final creatorName = match['creator_name']?.toString();
    final opponentName = match['opponent_name']?.toString();
    final winnerId = match['winner_id']?.toString();
    final status = match['status']?.toString();
    final updatedAt = match['updated_at']?.toString();

    // Determine if I'm the creator or opponent
    final isCreator = creatorId == myId;
    final otherId = isCreator ? opponentId : creatorId;
    final otherName = isCreator ? opponentName : creatorName;

    // Get scores from flat fields
    final scoreCreator = match['score_creator'];
    final scoreOpponent = match['score_opponent'];

    int? myScore;
    int? oppScore;
    if (scoreCreator != null && scoreOpponent != null) {
      myScore = isCreator
          ? (scoreCreator is num
              ? scoreCreator.toInt()
              : int.tryParse(scoreCreator.toString()) ?? 0)
          : (scoreOpponent is num
              ? scoreOpponent.toInt()
              : int.tryParse(scoreOpponent.toString()) ?? 0);
      oppScore = isCreator
          ? (scoreOpponent is num
              ? scoreOpponent.toInt()
              : int.tryParse(scoreOpponent.toString()) ?? 0)
          : (scoreCreator is num
              ? scoreCreator.toInt()
              : int.tryParse(scoreCreator.toString()) ?? 0);
    }

    // Determine win/loss
    bool? didWin;
    if (winnerId != null) {
      didWin = winnerId == myId;
    } else if (myScore != null && oppScore != null && myScore != oppScore) {
      didWin = myScore > oppScore;
    }

    // Format date
    String dateStr = '';
    if (updatedAt != null) {
      try {
        final date = DateTime.parse(updatedAt);
        dateStr = DateFormat('MMM d').format(date);
      } catch (_) {}
    }

    final normalizedStatus = (status ?? '').toLowerCase();
    final isFinalized =
        normalizedStatus == 'completed' || normalizedStatus == 'ended';
    final statusLabel = isFinalized ? 'Completed' : (status ?? 'Pending');

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Win/Loss indicator
            Container(
              width: 4,
              height: 40,
              decoration: BoxDecoration(
                color: didWin == null
                    ? Colors.grey
                    : (didWin ? Colors.green : Colors.red),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 12),
            // Match info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GestureDetector(
                    onTap: otherId != null
                        ? () => PlayerProfileSheet.showById(context, otherId)
                        : null,
                    child: Text(
                      'vs ${otherName ?? (otherId != null ? '${otherId.substring(0, 8)}...' : 'Unknown')}',
                      style: TextStyle(
                        fontWeight: FontWeight.w500,
                        color: otherId != null ? Colors.blue : null,
                        decoration:
                            otherId != null ? TextDecoration.underline : null,
                      ),
                    ),
                  ),
                  Text(
                    statusLabel,
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
            ),
            // Score
            if (myScore != null && oppScore != null)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: didWin == true
                      ? Colors.green.shade50
                      : Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$myScore - $oppScore',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: didWin == true
                        ? Colors.green.shade700
                        : Colors.red.shade700,
                  ),
                ),
              )
            else
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status ?? 'Pending',
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ),
            const SizedBox(width: 8),
            // Date
            Text(dateStr,
                style: TextStyle(fontSize: 12, color: Colors.grey[500])),
          ],
        ),
      ),
    );
  }

  Widget _buildPostCard(Map<String, dynamic> post) {
    final content = post['content']?.toString() ?? '';
    final createdAt = post['createdAt'];
    final likeCount = post['likeCount'] ?? 0;
    final commentCount = post['commentCount'] ?? 0;

    // Format date
    String timeAgo = '';
    if (createdAt != null) {
      try {
        final date = DateTime.parse(createdAt.toString());
        final diff = DateTime.now().difference(date);
        if (diff.inDays > 0) {
          timeAgo = '${diff.inDays}d ago';
        } else if (diff.inHours > 0) {
          timeAgo = '${diff.inHours}h ago';
        } else if (diff.inMinutes > 0) {
          timeAgo = '${diff.inMinutes}m ago';
        } else {
          timeAgo = 'just now';
        }
      } catch (_) {}
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(content, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.favorite, size: 16, color: Colors.grey[500]),
                const SizedBox(width: 4),
                Text('$likeCount',
                    style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                const SizedBox(width: 16),
                Icon(Icons.chat_bubble_outline,
                    size: 16, color: Colors.grey[500]),
                const SizedBox(width: 4),
                Text('$commentCount',
                    style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                const Spacer(),
                Text(timeAgo,
                    style: TextStyle(color: Colors.grey[500], fontSize: 12)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  final String label;
  final String value;

  const _StatColumn(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
      ],
    );
  }
}

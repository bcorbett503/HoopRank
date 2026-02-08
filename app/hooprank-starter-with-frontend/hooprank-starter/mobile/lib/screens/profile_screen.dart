import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import '../widgets/hooprank_graph.dart';
import '../widgets/player_profile_sheet.dart';
import '../services/api_service.dart';
import '../state/app_state.dart';
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

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
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
        final profileData = results[3] as Map<String, dynamic>?;
        debugPrint('Profile data loaded: $profileData');
        debugPrint('Profile name from API: ${profileData?['name']}');
        setState(() {
          _stats = results[0] as Map<String, dynamic>?;
          _history = (results[1] as List<Map<String, dynamic>>?) ?? [];
          _recentMatches = (results[2] as List<Map<String, dynamic>>?) ?? [];
          _userPosts = (results[4] as List<Map<String, dynamic>>?) ?? [];
          // Parse rating and stats from profile data
          if (profileData != null) {
            _currentRating = (profileData['rating'] is num)
                ? (profileData['rating'] as num).toDouble()
                : double.tryParse(profileData['rating']?.toString() ?? '') ?? 3.0;
            _matchesPlayed = (profileData['matchesPlayed'] is num) 
                ? (profileData['matchesPlayed'] as num).toInt() 
                : int.tryParse(profileData['matchesPlayed']?.toString() ?? '') ?? 0;
            _wins = (profileData['wins'] is num) 
                ? (profileData['wins'] as num).toInt() 
                : int.tryParse(profileData['wins']?.toString() ?? '') ?? 0;
            _losses = (profileData['losses'] is num) 
                ? (profileData['losses'] as num).toInt() 
                : int.tryParse(profileData['losses']?.toString() ?? '') ?? 0;
            // Parse profile info
            _profileName = profileData['name']?.toString();
            _profilePosition = profileData['position']?.toString();
            _profileCity = profileData['city']?.toString();
            _profileHeight = profileData['height']?.toString();
            _profileTeam = profileData['team']?.toString();
            debugPrint('Parsed _profileName: $_profileName, _profileTeam: $_profileTeam');
          }
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

    final wins = _wins.toString();
    final losses = _losses.toString();
    final matchesPlayed = _matchesPlayed.toString();

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
                                  ? (player.photoUrl!.startsWith('data:')
                                      ? MemoryImage(Uri.parse(player.photoUrl!).data!.contentAsBytes())
                                      : NetworkImage(player.photoUrl!) as ImageProvider)
                                  : null,
                              child: player.photoUrl == null
                                  ? Text(
                                      (_profileName ?? player.name).isNotEmpty ? (_profileName ?? player.name)[0] : '?',
                                      style: const TextStyle(fontSize: 32, color: Colors.white, fontWeight: FontWeight.bold),
                                    )
                                  : null,
                            ),
                            const SizedBox(height: 12),
                            Text(_profileName ?? player.name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                            Text('${_profileTeam ?? player.team ?? 'No Team'} • ${_profilePosition ?? player.position ?? 'Unknown'}', style: const TextStyle(color: Colors.grey)),
                            const SizedBox(height: 12),
                            // Current HoopRank
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Colors.deepOrange.shade600, Colors.orange.shade500],
                                ),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                'HoopRank: ${(_currentRating ?? player.rating).toStringAsFixed(2)}',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
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
                    const Text('All Posts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    if (_userPosts.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(
                            child: Text('No posts yet. Share an update!', style: TextStyle(color: Colors.grey)),
                          ),
                        ),
                      )
                    else
                      ...(_userPosts.map((post) => _buildPostCard(post))),
                    const SizedBox(height: 24),

                    // Recent Matches
                    const Text('Recent Matches', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    if (_recentMatches.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(
                            child: Text('No matches yet. Challenge someone!', style: TextStyle(color: Colors.grey)),
                          ),
                        ),
                      )
                    else
                      ...(_recentMatches.take(5).map((match) => _buildMatchCard(match, player.id))),
                  ],
                ),
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
          ? (scoreCreator is num ? scoreCreator.toInt() : int.tryParse(scoreCreator.toString()) ?? 0)
          : (scoreOpponent is num ? scoreOpponent.toInt() : int.tryParse(scoreOpponent.toString()) ?? 0);
      oppScore = isCreator
          ? (scoreOpponent is num ? scoreOpponent.toInt() : int.tryParse(scoreOpponent.toString()) ?? 0)
          : (scoreCreator is num ? scoreCreator.toInt() : int.tryParse(scoreCreator.toString()) ?? 0);
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

    final result = match['result'] as Map<String, dynamic>?;
    final isFinalized = result?['finalized'] == true;

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
                        decoration: otherId != null ? TextDecoration.underline : null,
                      ),
                    ),
                  ),
                  Text(
                    status == 'ended' ? (isFinalized ? 'Completed' : 'Pending confirmation') : status ?? '',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
            ),
            // Score
            if (myScore != null && oppScore != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: didWin == true ? Colors.green.shade50 : Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$myScore - $oppScore',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: didWin == true ? Colors.green.shade700 : Colors.red.shade700,
                  ),
                ),
              )
            else
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
            Text(dateStr, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
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
                Text('$likeCount', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                const SizedBox(width: 16),
                Icon(Icons.chat_bubble_outline, size: 16, color: Colors.grey[500]),
                const SizedBox(width: 4),
                Text('$commentCount', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                const Spacer(),
                Text(timeAgo, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
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
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
      ],
    );
  }
}

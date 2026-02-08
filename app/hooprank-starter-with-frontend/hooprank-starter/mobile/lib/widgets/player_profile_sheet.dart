import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../state/check_in_state.dart';

/// A clickable player name that shows their profile when tapped
class ClickablePlayerName extends StatelessWidget {
  final String playerId;
  final String playerName;
  final String? photoUrl;
  final double? rating;
  final TextStyle? style;
  final bool showAvatar;

  const ClickablePlayerName({
    super.key,
    required this.playerId,
    required this.playerName,
    this.photoUrl,
    this.rating,
    this.style,
    this.showAvatar = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => PlayerProfileSheet.showById(context, playerId),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showAvatar) ...[
            CircleAvatar(
              radius: 14,
              backgroundImage: photoUrl != null ? NetworkImage(photoUrl!) : null,
              backgroundColor: Colors.deepOrange.withOpacity(0.2),
              child: photoUrl == null
                  ? Text(playerName.isNotEmpty ? playerName[0].toUpperCase() : '?',
                      style: const TextStyle(fontSize: 11, color: Colors.deepOrange))
                  : null,
            ),
            const SizedBox(width: 6),
          ],
          Text(
            playerName,
            style: style ?? const TextStyle(
              color: Colors.blue,
              fontWeight: FontWeight.w500,
              decoration: TextDecoration.underline,
            ),
          ),
        ],
      ),
    );
  }
}

class PlayerProfileSheet extends StatefulWidget {
  final User player;
  final VoidCallback? onChallenge;
  final VoidCallback? onMessage;
  final VoidCallback? onInviteToTeam;

  const PlayerProfileSheet({
    super.key,
    required this.player,
    this.onChallenge,
    this.onMessage,
    this.onInviteToTeam,
  });

  @override
  State<PlayerProfileSheet> createState() => _PlayerProfileSheetState();

  /// Shows the player profile as a modal bottom sheet
  static Future<void> show(BuildContext context, User player, {
    VoidCallback? onChallenge,
    VoidCallback? onMessage,
    VoidCallback? onInviteToTeam,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => PlayerProfileSheet(
        player: player,
        onChallenge: onChallenge,
        onMessage: onMessage,
        onInviteToTeam: onInviteToTeam,
      ),
    );
  }

  /// Shows the player profile by fetching user data from their ID
  static Future<void> showById(BuildContext context, String userId, {
    VoidCallback? onChallenge,
    VoidCallback? onMessage,
    VoidCallback? onInviteToTeam,
  }) async {
    // Show bottom sheet immediately with loading state, then fetch data
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _LoadingProfileSheet(
        userId: userId,
        onChallenge: onChallenge,
        onMessage: onMessage,
        onInviteToTeam: onInviteToTeam,
      ),
    );
  }
}

/// A wrapper that shows loading then the actual profile
class _LoadingProfileSheet extends StatefulWidget {
  final String userId;
  final VoidCallback? onChallenge;
  final VoidCallback? onMessage;
  final VoidCallback? onInviteToTeam;

  const _LoadingProfileSheet({
    required this.userId,
    this.onChallenge,
    this.onMessage,
    this.onInviteToTeam,
  });

  @override
  State<_LoadingProfileSheet> createState() => _LoadingProfileSheetState();
}

class _LoadingProfileSheetState extends State<_LoadingProfileSheet> {
  User? _user;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final profileData = await ApiService.getProfile(widget.userId);
      
      if (!mounted) return;

      if (profileData == null) {
        setState(() {
          _error = 'Could not load player profile';
          _isLoading = false;
        });
        return;
      }

      // Create User object from profile data
      double rating = 3.0;
      final ratingValue = profileData['rating'] ?? profileData['hoop_rank'] ?? profileData['hoopRank'];
      if (ratingValue is num) {
        rating = ratingValue.toDouble();
      } else if (ratingValue is String) {
        rating = double.tryParse(ratingValue) ?? 3.0;
      }

      final user = User(
        id: widget.userId,
        name: profileData['name']?.toString() ?? 'Unknown',
        photoUrl: profileData['photoUrl']?.toString() ?? profileData['avatar_url']?.toString(),
        position: profileData['position']?.toString(),
        rating: rating,
        city: profileData['city']?.toString(),
        matchesPlayed: (profileData['matchesPlayed'] as int?) ?? 0,
        wins: (profileData['wins'] as int?) ?? 0,
        height: profileData['height']?.toString(),
      );

      setState(() {
        _user = user;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Error loading profile: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        height: 300,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: Colors.deepOrange),
        ),
      );
    }

    if (_error != null || _user == null) {
      return Container(
        height: 200,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.grey[400]),
              const SizedBox(height: 16),
              Text(_error ?? 'Player not found', style: TextStyle(color: Colors.grey[600])),
            ],
          ),
        ),
      );
    }

    return PlayerProfileSheet(
      player: _user!,
      onChallenge: widget.onChallenge,
      onMessage: widget.onMessage,
      onInviteToTeam: widget.onInviteToTeam,
    );
  }
}

class _PlayerProfileSheetState extends State<PlayerProfileSheet> {
  List<Map<String, dynamic>> _recentMatches = [];
  bool _isLoading = true;
  
  // Fresh data from API
  Map<String, dynamic>? _profileData;
  int _matchesPlayed = 0;
  int _wins = 0;
  int _losses = 0;
  String? _height;
  String? _city;
  String? _zip;

  @override
  void initState() {
    super.initState();
    _loadPlayerData();
  }

  /// Load fresh profile, stats, and recent matches from API
  Future<void> _loadPlayerData() async {
    try {
      // Fetch fresh profile data and recent matches in parallel
      final results = await Future.wait([
        ApiService.getProfile(widget.player.id),
        ApiService.getUserMatchHistory(widget.player.id),
        ApiService.getUserStats(widget.player.id),
      ]);

      final profileData = results[0] as Map<String, dynamic>?;
      final matches = results[1] as List<Map<String, dynamic>>?;
      final stats = results[2] as Map<String, dynamic>?;

      if (mounted) {
        setState(() {
          _profileData = profileData;
          _recentMatches = matches ?? [];
          
          // Parse stats from API response
          if (profileData != null) {
            _matchesPlayed = _parseInt(profileData['matchesPlayed'] ?? profileData['matches_played']);
            _wins = _parseInt(profileData['wins']);
            _losses = _parseInt(profileData['losses']);
            _height = profileData['height']?.toString();
            _city = profileData['city']?.toString();
            _zip = profileData['zip']?.toString() ?? profileData['team']?.toString();
          }
          
          // Stats endpoint may have more accurate counts
          if (stats != null) {
            _matchesPlayed = _parseInt(stats['totalMatches'] ?? stats['total_matches']) > 0 
                ? _parseInt(stats['totalMatches'] ?? stats['total_matches']) 
                : _matchesPlayed;
            _wins = _parseInt(stats['wins']) > 0 ? _parseInt(stats['wins']) : _wins;
            _losses = _parseInt(stats['losses']) > 0 ? _parseInt(stats['losses']) : _losses;
          }
          
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading player data: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }
  
  int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    
    // Use fresh data if available, fallback to User object
    final matchesPlayed = _matchesPlayed > 0 ? _matchesPlayed : player.matchesPlayed;
    final wins = _wins > 0 ? _wins : player.wins;
    final height = _height ?? player.height;
    final city = _city;
    final zip = _zip ?? player.team;
    
    final winRate = matchesPlayed > 0 
        ? (wins / matchesPlayed * 100).toStringAsFixed(0)
        : '0';

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle bar
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  
                  // Player header
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 40,
                        backgroundImage: player.photoUrl != null 
                            ? NetworkImage(player.photoUrl!) 
                            : null,
                        backgroundColor: Colors.deepOrange[50],
                        child: player.photoUrl == null 
                            ? Text(player.name[0], style: TextStyle(fontSize: 32, color: Colors.deepOrange[800]))
                            : null,
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              player.name,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                _buildInfoChip(Icons.leaderboard, player.rating.toStringAsFixed(1)),
                                const SizedBox(width: 8),
                                if (player.position != null)
                                  _buildInfoChip(Icons.sports_basketball, player.position!),
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Follow heart icon
                      Consumer<CheckInState>(
                        builder: (context, checkInState, _) {
                          final isFollowing = checkInState.isFollowingPlayer(player.id);
                          return IconButton(
                            onPressed: () => checkInState.toggleFollowPlayer(player.id),
                            icon: Icon(
                              isFollowing ? Icons.favorite : Icons.favorite_border,
                              color: isFollowing ? Colors.red : Colors.grey,
                              size: 28,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Action buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            widget.onMessage?.call();
                          },
                          icon: const Icon(Icons.message),
                          label: const Text('Message'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.grey[100],
                            foregroundColor: Colors.deepOrange,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            side: BorderSide(color: Colors.deepOrange.withOpacity(0.3)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            widget.onChallenge?.call();
                          },
                          icon: const Icon(Icons.sports_basketball),
                          label: const Text('Challenge'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.deepOrange,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                  
                  // Invite to Team button
                  if (widget.onInviteToTeam != null) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          widget.onInviteToTeam?.call();
                        },
                        icon: const Icon(Icons.group_add),
                        label: const Text('Invite to Team'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.blue,
                          side: const BorderSide(color: Colors.blue),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                  ],
                  
                  const SizedBox(height: 24),
                  
                  // Stats grid - show loading indicator while fetching
                  const Text(
                    'Player Stats',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _isLoading
                      ? const Center(child: CircularProgressIndicator(color: Colors.deepOrange))
                      : Row(
                          children: [
                            Expanded(child: _buildStatCard('Matches', '$matchesPlayed', Icons.sports)),
                            const SizedBox(width: 12),
                            Expanded(child: _buildStatCard('Wins', '$wins', Icons.emoji_events)),
                            const SizedBox(width: 12),
                            Expanded(child: _buildStatCard('Win Rate', '$winRate%', Icons.trending_up)),
                          ],
                        ),
                  
                  const SizedBox(height: 16),
                  
                  // Player details
                  const Text(
                    'Details',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _buildDetailRow(Icons.location_city, 'City', 
                              city ?? _getCityName(zip)),
                          const Divider(),
                          _buildDetailRow(Icons.height, 'Height', height ?? 'Not set'),
                          const Divider(),
                          _buildDetailRow(Icons.star, 'Position', player.position ?? 'Not set'),
                          const Divider(),
                          _buildCommunityRatingRow(player),
                        ],
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Recent matches
                  const Text(
                    'Recent Matches',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_isLoading)
                    const Center(child: CircularProgressIndicator(color: Colors.deepOrange))
                  else if (_recentMatches.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Center(
                          child: Text(
                            'No recent matches',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        ),
                      ),
                    )
                  else
                    ..._recentMatches.take(5).map((match) => _buildMatchCard(match)),
                  
                  const SizedBox(height: 20),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  /// Simple zip code prefix to city lookup (using first 3 digits)
  String _getCityName(String? zipCode) {
    if (zipCode == null || zipCode.isEmpty) return 'Not set';
    
    // Map of common US zip code prefixes to city names
    final zipToCityMap = {
      '100': 'New York, NY',
      '101': 'New York, NY',
      '102': 'New York, NY',
      '103': 'Staten Island, NY',
      '104': 'Bronx, NY',
      '110': 'Queens, NY',
      '111': 'Long Island, NY',
      '112': 'Brooklyn, NY',
      '113': 'Brooklyn, NY',
      '900': 'Los Angeles, CA',
      '901': 'Los Angeles, CA',
      '902': 'Inglewood, CA',
      '903': 'Inglewood, CA',
      '904': 'Santa Monica, CA',
      '906': 'Long Beach, CA',
      '908': 'Long Beach, CA',
      '910': 'Pasadena, CA',
      '913': 'Van Nuys, CA',
      '917': 'Industry, CA',
      '919': 'San Diego, CA',
      '920': 'San Diego, CA',
      '921': 'San Diego, CA',
      '941': 'San Francisco, CA',
      '946': 'Oakland, CA',
      '947': 'Berkeley, CA',
      '950': 'San Jose, CA',
      '951': 'San Jose, CA',
      '606': 'Chicago, IL',
      '607': 'Chicago, IL',
      '608': 'Chicago, IL',
      '770': 'Houston, TX',
      '772': 'Houston, TX',
      '773': 'Houston, TX',
      '774': 'Houston, TX',
      '750': 'Dallas, TX',
      '751': 'Dallas, TX',
      '752': 'Dallas, TX',
      '753': 'Dallas, TX',
      '191': 'Philadelphia, PA',
      '192': 'Philadelphia, PA',
      '331': 'Miami, FL',
      '332': 'Miami, FL',
      '333': 'Fort Lauderdale, FL',
      '850': 'Phoenix, AZ',
      '852': 'Phoenix, AZ',
      '853': 'Phoenix, AZ',
      '021': 'Boston, MA',
      '022': 'Boston, MA',
      '981': 'Seattle, WA',
      '980': 'Seattle, WA',
      '802': 'Denver, CO',
      '803': 'Denver, CO',
      '303': 'Atlanta, GA',
      '304': 'Atlanta, GA',
    };

    // Get first 3 digits of zip code
    final prefix = zipCode.length >= 3 ? zipCode.substring(0, 3) : zipCode;
    
    // Return city name or the original zip if not found
    return zipToCityMap[prefix] ?? zipCode;
  }

  Widget _buildInfoChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.grey[700]),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(color: Colors.grey[700], fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, size: 24, color: Colors.orange),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 12),
          Text(
            label,
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 14,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w500,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  /// Build matches contested row showing contest count
  Widget _buildCommunityRatingRow(User player) {
    final contestedCount = player.gamesContested;
    
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(Icons.gavel, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 12),
          Text(
            'Matches Contested',
            style: TextStyle(color: Colors.grey[600], fontSize: 14),
          ),
          const Spacer(),
          Text(
            contestedCount.toString(),
            style: TextStyle(
              color: contestedCount > 0 ? Colors.orange : Colors.grey[500],
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMatchCard(Map<String, dynamic> match) {
    final playerId = widget.player.id;
    final creatorId = match['creator_id']?.toString();
    final opponentId = match['opponent_id']?.toString();
    final creatorName = match['creator_name']?.toString();
    final opponentName = match['opponent_name']?.toString();
    final winnerId = match['winner_id']?.toString();
    final status = match['status']?.toString() ?? '';
    
    // Determine who is the opponent relative to this player
    final isCreator = creatorId == playerId;
    final oppName = isCreator ? opponentName : creatorName;
    final oppId = isCreator ? opponentId : creatorId;
    final opponentDisplay = oppName ?? (oppId != null && oppId.length > 8 ? '${oppId.substring(0, 8)}...' : oppId ?? 'Unknown');
    
    // Parse scores from flat fields
    final scoreCreator = match['score_creator'];
    final scoreOpponent = match['score_opponent'];
    final hasScores = scoreCreator != null && scoreOpponent != null;
    
    String scoreStr;
    bool? isWin;
    
    if (hasScores) {
      final myScore = isCreator ? scoreCreator : scoreOpponent;
      final theirScore = isCreator ? scoreOpponent : scoreCreator;
      scoreStr = '$myScore - $theirScore';
      
      if (winnerId != null) {
        isWin = winnerId == playerId;
      } else {
        final ms = (myScore is num ? myScore : int.tryParse(myScore.toString()) ?? 0);
        final ts = (theirScore is num ? theirScore : int.tryParse(theirScore.toString()) ?? 0);
        if (ms != ts) isWin = ms > ts;
      }
    } else {
      scoreStr = status == 'completed' ? 'N/A' : '';
    }

    // Status display
    String statusDisplay = status;
    if (status == 'completed' && isWin != null) {
      statusDisplay = isWin ? 'Victory' : 'Defeat';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isWin == true ? Colors.green[100] : (isWin == false ? Colors.red[100] : Colors.grey[100]),
          child: Icon(
            isWin == true ? Icons.check : (isWin == false ? Icons.close : Icons.remove),
            color: isWin == true ? Colors.green : (isWin == false ? Colors.red : Colors.grey),
          ),
        ),
        title: Text('vs $opponentDisplay'),
        subtitle: Text(statusDisplay),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (hasScores)
              Text(
                scoreStr,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            if (isWin != null)
              Text(
                isWin ? 'WIN' : 'LOSS',
                style: TextStyle(
                  color: isWin ? Colors.green : Colors.red,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

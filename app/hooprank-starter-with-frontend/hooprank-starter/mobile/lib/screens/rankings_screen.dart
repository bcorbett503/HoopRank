import 'dart:convert';
import 'package:flutter/material.dart';
import '../utils/image_utils.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
import '../state/onboarding_checklist_state.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../widgets/shimmer_skeleton.dart';
import '../services/messages_service.dart';
import '../widgets/player_profile_sheet.dart';
import 'chat_screen.dart';

/// Rankings Screen for player 1v1 rankings.
class RankingsScreen extends StatefulWidget {
  final String? initialRegion;

  const RankingsScreen({
    super.key,
    this.initialRegion,
  });

  @override
  State<RankingsScreen> createState() => _RankingsScreenState();
}

class _RankingsScreenState extends State<RankingsScreen> {
  final MessagesService _messagesService = MessagesService();

  // Players tab state
  List<User> _players = [];
  Set<String> _pendingChallengeUserIds = {};
  Set<String> _activeChallengeUserIds = {};
  bool _isLoadingPlayers = true;
  bool _isLocal = false;
  String _searchQuery = '';
  String _ageFilter = 'All'; // 'All', '13-18', '18-25', '26-35', '35+'
  String _rankFilter = 'All'; // 'All', '1+', '2+', '3+', '4+'

  // Current user's own ranking info
  double _myRating = 3.0;
  int _myWins = 0;
  int _myLosses = 0;
  int _myKingCourtsCount = 0;
  int? _myRank;

  @override
  void initState() {
    super.initState();
    // Apply initial region if provided (for deep linking)
    if (widget.initialRegion == 'local') {
      _isLocal = true;
    }

    _fetchPlayers();
    _fetchMyRating();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Auto-refresh data when navigating to this screen
    _fetchPlayers();
  }

  Future<void> _fetchPlayers() async {
    final currentUser =
        Provider.of<AuthState>(context, listen: false).currentUser;
    setState(() => _isLoadingPlayers = true);

    try {
      final url = _isLocal
          ? '${ApiService.baseUrl}/users/nearby?radiusMiles=25'
          : '${ApiService.baseUrl}/rankings?mode=1v1';

      final response = await ApiService.authedGet(
        Uri.parse(url),
        headers: {'x-user-id': currentUser?.id ?? ''},
        userId: currentUser?.id,
      );

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        // Handle both formats: direct array (users/nearby) or wrapped in 'rankings' key
        final List<dynamic> jsonList =
            decoded is List ? decoded : (decoded['rankings'] as List?) ?? [];
        final List<User> players = [];
        int? currentUserRank;
        for (var item in jsonList) {
          final id = item['id']?.toString() ?? '';
          if (id.isNotEmpty) {
            double rating = 0.0;
            final ratingValue = item['rating'];
            if (ratingValue is num) {
              rating = ratingValue.toDouble();
            } else if (ratingValue is String) {
              rating = double.tryParse(ratingValue) ?? 0.0;
            }

            // Parse age from API response
            int? age;
            final ageValue = item['age'];
            if (ageValue is int) {
              age = ageValue;
            } else if (ageValue is num) {
              age = ageValue.toInt();
            }

            players.add(User(
              id: id,
              name: item['name']?.toString() ?? 'Unknown',
              photoUrl: item['photoUrl']?.toString(),
              position: item['position']?.toString(),
              rating: rating,
              city: item['city']?.toString(),
              age: age,
            ));

            if (id == currentUser?.id) {
              final rankValue = item['rank'];
              if (rankValue is int) {
                currentUserRank = rankValue;
              } else if (rankValue is num) {
                currentUserRank = rankValue.toInt();
              } else if (rankValue is String) {
                currentUserRank = int.tryParse(rankValue);
              }
              currentUserRank ??= players.length;
            }
          }
        }

        Set<String> pendingIds = {};
        Set<String> activeIds = {};
        if (currentUser != null) {
          try {
            final challenges =
                await _messagesService.getPendingChallenges(currentUser.id);
            for (final c in challenges) {
              final status =
                  (c.message.challengeStatus ?? 'pending').toLowerCase();
              if (status == 'pending') {
                pendingIds.add(c.otherUser.id);
                activeIds.add(c.otherUser.id);
              }
            }
          } catch (e) {
            debugPrint('Error loading challenges: $e');
          }
        }

        if (!mounted) return;
        setState(() {
          _players = players;
          _myRank = currentUserRank;
          _pendingChallengeUserIds = pendingIds;
          _activeChallengeUserIds = activeIds;
          _isLoadingPlayers = false;
        });
      } else {
        debugPrint(
          'Failed to fetch rankings: ${response.statusCode} '
          '${response.body.length > 180 ? response.body.substring(0, 180) : response.body}',
        );
        if (!mounted) return;
        setState(() => _isLoadingPlayers = false);
      }
    } catch (e) {
      debugPrint('Error: $e');
      if (!mounted) return;
      setState(() => _isLoadingPlayers = false);
    }
  }

  int _parseIntValue(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  double _parseDoubleValue(dynamic value, {double fallback = 3.0}) {
    if (value == null) return fallback;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? fallback;
  }

  Future<void> _fetchMyRating() async {
    final appState = Provider.of<AuthState>(context, listen: false);
    final currentUser = appState.currentUser;
    if (currentUser != null) {
      setState(() {
        _myRating = currentUser.rating;
        _myWins = currentUser.wins;
        _myLosses = currentUser.losses;
      });

      final profileData = await ApiService.getProfile(currentUser.id);
      if (!mounted || profileData == null) return;

      setState(() {
        _myRating = _parseDoubleValue(
          profileData['rating'] ?? profileData['hoop_rank'],
          fallback: _myRating,
        );
        _myWins = _parseIntValue(profileData['wins']);
        _myLosses = _parseIntValue(profileData['losses']);
        _myKingCourtsCount = _parseIntValue(
          profileData['kingCourtsCount'] ?? profileData['king_courts_count'],
        );
      });
    }
  }

  List<User> get _filteredPlayers {
    final currentUser =
        Provider.of<AuthState>(context, listen: false).currentUser;

    return _players.where((p) {
      if (p.id == currentUser?.id) return false;
      if (!p.name.toLowerCase().contains(_searchQuery.toLowerCase()))
        return false;

      // Rank filter - filter by minimum rating
      if (_rankFilter != 'All') {
        final minRating = double.parse(_rankFilter.replaceAll('+', ''));
        if (p.rating < minRating) return false;
      }

      // Age filter - exclude users without age data when filter is active
      if (_ageFilter != 'All') {
        if (p.age == null) return false; // No age data = exclude when filtering
        final age = p.age!;
        switch (_ageFilter) {
          case '13-18':
            if (age < 13 || age > 18) return false;
            break;
          case '18-25':
            if (age < 18 || age > 25) return false;
            break;
          case '26-35':
            if (age < 26 || age > 35) return false;
            break;
          case '35+':
            if (age < 35) return false;
            break;
        }
      }

      return true;
    }).toList()
      ..sort((a, b) => b.rating.compareTo(a.rating));
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

  Widget _buildYourRankStat({
    required IconData icon,
    required Color color,
    required String value,
    required String label,
  }) {
    return Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withOpacity(0.22),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 30,
            width: double.infinity,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
            ),
          ),
          const SizedBox(height: 2),
          SizedBox(
            height: 18,
            width: double.infinity,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                style: const TextStyle(
                  color: Colors.white54,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  height: 1,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showPlayerProfile(User player) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => PlayerProfileSheet(
        player: player,
        onMessage: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => ChatScreen(userId: player.id)),
          );
        },
        onChallenge: () {
          _showChallengeDialog(player);
        },
      ),
    );
  }

  void _showChallengeDialog(User player) {
    final messageController = TextEditingController(text: 'Want to play?');

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.sports_basketball, color: Colors.deepOrange),
            const SizedBox(width: 8),
            Expanded(child: Text('Challenge ${player.name}')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: messageController,
              decoration: InputDecoration(
                labelText: 'Your message',
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              maxLines: 2,
              autofocus: true,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              final message = messageController.text.trim();
              if (message.isEmpty) return;
              Navigator.pop(dialogContext);

              try {
                await ApiService.createChallenge(
                    toUserId: player.id, message: message);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Challenge sent to ${player.name}!')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  final errorText =
                      e.toString().replaceFirst('Exception: ', '');
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $errorText')),
                  );
                }
              }
            },
            icon: const Icon(Icons.sports_basketball),
            label: const Text('Send Challenge'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: _buildPlayersTab());
  }

  Widget _buildPlayersTab() {
    final filtered = _filteredPlayers;

    return Column(
      children: [
        // === Your Ranks Section ===
        Container(
          width: double.infinity,
          margin: const EdgeInsets.fromLTRB(12, 12, 12, 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.grey.shade900,
                Colors.blueGrey.shade900,
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.4),
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: Colors.amber.withOpacity(0.22),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.emoji_events,
                        size: 18,
                        color: Colors.amber,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Your Ranks',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  height: 126,
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: Colors.white.withOpacity(0.12)),
                  ),
                  child: Row(
                    children: [
                      _buildYourRankStat(
                        icon: Icons.bar_chart,
                        color: Colors.amber,
                        value: _myRank == null ? '--' : '#$_myRank',
                        label: _myRating.toStringAsFixed(2),
                      ),
                      Container(
                        width: 1,
                        margin: const EdgeInsets.symmetric(horizontal: 10),
                        color: Colors.white.withOpacity(0.12),
                      ),
                      _buildYourRankStat(
                        icon: Icons.emoji_events,
                        color: const Color(0xFF00D9A3),
                        value: '$_myWins-$_myLosses',
                        label: 'W/L',
                      ),
                      Container(
                        width: 1,
                        margin: const EdgeInsets.symmetric(horizontal: 10),
                        color: Colors.white.withOpacity(0.12),
                      ),
                      _buildYourRankStat(
                        icon: Icons.workspace_premium,
                        color: Colors.amber,
                        value: '$_myKingCourtsCount',
                        label: 'King Courts',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Search and filter
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search by name...',
              hintStyle: TextStyle(color: Colors.white30),
              prefixIcon: const Icon(Icons.search, color: Colors.white54),
              filled: true,
              fillColor: Colors.white.withOpacity(0.05),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
        ),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                // Location filter
                ChoiceChip(
                  label: const Text('Global'),
                  selected: !_isLocal,
                  onSelected: (_) {
                    setState(() => _isLocal = false);
                    _fetchPlayers();
                  },
                ),
                const SizedBox(width: 6),
                ChoiceChip(
                  label: const Text('Local'),
                  selected: _isLocal,
                  onSelected: (_) {
                    setState(() => _isLocal = true);
                    _fetchPlayers();
                  },
                ),
                const SizedBox(width: 12),
                Container(width: 1, height: 24, color: Colors.grey[600]),
                const SizedBox(width: 12),
                // Rank filter dropdown
                DropdownButton<String>(
                  value: _rankFilter,
                  underline: const SizedBox(),
                  isDense: true,
                  items: ['All', '1+', '2+', '3+', '4+']
                      .map((r) =>
                          DropdownMenuItem(value: r, child: Text('Rating: $r')))
                      .toList(),
                  onChanged: (v) => setState(() => _rankFilter = v ?? 'All'),
                ),
                const SizedBox(width: 12),
                Container(width: 1, height: 24, color: Colors.grey[600]),
                const SizedBox(width: 12),
                // Age filter dropdown
                DropdownButton<String>(
                  value: _ageFilter,
                  underline: const SizedBox(),
                  isDense: true,
                  items: ['All', '13-18', '18-25', '26-35', '35+']
                      .map((a) =>
                          DropdownMenuItem(value: a, child: Text('Age: $a')))
                      .toList(),
                  onChanged: (v) => setState(() => _ageFilter = v ?? 'All'),
                ),
              ],
            ),
          ),
        ),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(
            children: [
              Text('${filtered.length} players',
                  style: TextStyle(color: Colors.grey[500])),
              if (_isLocal)
                Text(' (25 mi)',
                    style: TextStyle(color: Colors.grey[600], fontSize: 12)),
            ],
          ),
        ),

        Expanded(
          child: _isLoadingPlayers
              ? const RankingSkeletonLoader()
              : filtered.isEmpty
                  ? const Center(child: Text('No players found'))
                  : RefreshIndicator(
                      onRefresh: _fetchPlayers,
                      child: ListView.builder(
                        itemCount: filtered.length,
                        itemBuilder: (context, index) =>
                            _buildPlayerCard(filtered[index], index),
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildPlayerCard(User player, int index) {
    final hasPending = _pendingChallengeUserIds.contains(player.id);
    final hasActiveChallenge = _activeChallengeUserIds.contains(player.id);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
          onTap: () => _showPlayerProfile(player),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: Colors.blue.withOpacity(0.2),
                  backgroundImage: player.photoUrl != null
                      ? safeImageProvider(player.photoUrl!)
                      : null,
                  child: player.photoUrl == null
                      ? Text(
                          player.name.isNotEmpty
                              ? player.name[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                              color: Colors.blue, fontWeight: FontWeight.bold))
                      : null,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        player.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: Colors.white),
                      ),
                      const SizedBox(height: 4),
                      if ((player.city ?? player.position) != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          [
                            if ((player.city ?? '').isNotEmpty) player.city!,
                            if ((player.position ?? '').isNotEmpty)
                              player.position!,
                          ].join(' • '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white30,
                            fontSize: 13,
                          ),
                        ),
                      ],
                      if (hasPending) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.orange.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: Colors.orange.withOpacity(0.3)),
                          ),
                          child: const Text(
                            'Pending',
                            style: TextStyle(
                                fontSize: 10,
                                color: Colors.orange,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                // Quick action buttons (tutorial target for first player)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chat_bubble_outline, size: 20),
                      color: Colors.white30,
                      tooltip: 'Message',
                      constraints:
                          const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => ChatScreen(userId: player.id)),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.sports_basketball, size: 20),
                      color: hasActiveChallenge
                          ? Colors.orange
                          : Colors.deepOrange,
                      tooltip: 'Challenge',
                      constraints:
                          const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                      onPressed: () {
                        if (hasActiveChallenge) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                  'Challenge already pending with this player.'),
                            ),
                          );
                          return;
                        }
                        // Complete onboarding item
                        context
                            .read<OnboardingChecklistState>()
                            .completeItem('challenge_player');
                        _showChallengeDialog(player);
                      },
                    ),
                    // Follow heart button
                    Consumer<CheckInState>(
                      builder: (context, checkInState, _) {
                        final isFollowing =
                            checkInState.isFollowingPlayer(player.id);
                        return IconButton(
                          icon: Icon(
                            isFollowing
                                ? Icons.favorite
                                : Icons.favorite_border,
                            size: 20,
                          ),
                          color:
                              isFollowing ? Colors.blueAccent : Colors.white30,
                          tooltip: isFollowing ? 'Unfollow' : 'Follow',
                          constraints:
                              const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          onPressed: () {
                            checkInState.toggleFollowPlayer(player.id);
                            // Complete onboarding item
                            context
                                .read<OnboardingChecklistState>()
                                .completeItem('follow_player');
                          },
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(player.rating.toStringAsFixed(1),
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: Colors.amber)),
                    ),
                    const SizedBox(height: 2),
                    Text(_getRankLabel(player.rating),
                        style: const TextStyle(
                            fontSize: 10, color: Colors.white30)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

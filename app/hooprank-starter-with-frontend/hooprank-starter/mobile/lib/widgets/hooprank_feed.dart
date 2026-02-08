import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:share_plus/share_plus.dart';
import '../state/check_in_state.dart';
import '../state/app_state.dart';
import '../services/api_service.dart';
import '../services/messages_service.dart';
import '../models.dart';
import 'feed_video_player.dart';
import 'player_profile_sheet.dart';
import 'dart:math' as math;

/// Unified HoopRank Feed with For You/Following tabs
class HoopRankFeed extends StatefulWidget {
  const HoopRankFeed({super.key});

  @override
  State<HoopRankFeed> createState() => _HoopRankFeedState();
}

class _HoopRankFeedState extends State<HoopRankFeed> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final MessagesService _messagesService = MessagesService();
  List<Map<String, dynamic>> _forYouPosts = [];
  List<Map<String, dynamic>> _followingPosts = [];
  List<ChallengeRequest> _pendingChallenges = []; // Pinned 1v1 challenges
  List<TeamChallengeRequest> _pendingTeamChallenges = []; // Pinned team challenges
  bool _isLoadingForYou = true;
  bool _isLoadingFollowing = true;
  Position? _userLocation;

  // Local state for optimistic UI updates
  final Map<int, bool> _likeStates = {}; // statusId -> isLiked
  final Map<int, int> _likeCounts = {}; // statusId -> count
  final Map<int, bool> _expandedComments = {}; // statusId -> isExpanded
  final Map<int, List<Map<String, dynamic>>> _comments = {}; // statusId -> comments
  final Map<int, bool> _attendingStates = {}; // statusId -> isAttending
  final Map<int, int> _attendeeCounts = {}; // statusId -> count
  final Map<int, bool> _expandedAttendees = {}; // statusId -> show attendee list
  final Map<int, List<Map<String, dynamic>>> _attendeeDetails = {}; // statusId -> attendee list

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _initLocation();
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    if (_tabController.index == 0 && _forYouPosts.isEmpty) {
      _loadForYouFeed();
    } else if (_tabController.index == 1 && _followingPosts.isEmpty) {
      _loadFollowingFeed();
    }
  }

  /// Initialize feeds immediately, then fetch location in background
  Future<void> _initLocation() async {
    // Load feeds and challenges immediately without waiting for location
    _loadForYouFeed();
    _loadFollowingFeed();
    _loadPendingChallenges();
    _loadPendingTeamChallenges();
    
    // Fetch location asynchronously in background
    _fetchLocationAndRefresh();
  }

  /// Load pending 1v1 challenges to pin at top of feed
  Future<void> _loadPendingChallenges() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    debugPrint('FEED: Loading challenges for userId=$userId');
    if (userId == null) {
      debugPrint('FEED: userId is null, skipping challenge load');
      return;
    }

    try {
      final challenges = await _messagesService.getPendingChallenges(userId);
      debugPrint('FEED: Got ${challenges.length} total challenges from API');
      for (var c in challenges) {
        debugPrint('FEED: Challenge from ${c.otherUser.name}, direction=${c.direction}');
      }
      // Only show incoming challenges
      final incoming = challenges.where((c) => c.direction == 'received').toList();
      debugPrint('FEED: ${incoming.length} incoming challenges after filter');
      if (mounted) {
        setState(() => _pendingChallenges = incoming);
        debugPrint('FEED: setState complete, _pendingChallenges.length=${_pendingChallenges.length}');
      }
    } catch (e, stack) {
      debugPrint('Error loading pending challenges: $e');
      debugPrint('Stack: $stack');
    }
  }

  /// Load pending team challenges to pin at top of feed
  Future<void> _loadPendingTeamChallenges() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      // Get user's teams first
      final teams = await ApiService.getMyTeams();
      final teamIds = teams.map((t) => t['id']?.toString() ?? '').where((id) => id.isNotEmpty).toList();
      debugPrint('FEED: Loading team challenges for ${teamIds.length} teams');

      if (teamIds.isEmpty) return;

      final teamChallenges = await _messagesService.getPendingTeamChallenges(userId, teamIds);
      debugPrint('FEED: Got ${teamChallenges.length} team challenges');

      if (mounted) {
        setState(() => _pendingTeamChallenges = teamChallenges);
      }
    } catch (e) {
      debugPrint('Error loading team challenges: $e');
    }
  }
  
  /// Fetch location in background and refresh For You feed when available
  Future<void> _fetchLocationAndRefresh() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
        final position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.low,
        );
        _userLocation = position;
        debugPrint('FEED: Got location: ${position.latitude}, ${position.longitude}');
        
        // Refresh For You feed with location for better results
        if (mounted) {
          _loadForYouFeed();
        }
      }
    } catch (e) {
      debugPrint('FEED: Location error: $e');
    }
  }

  Future<void> _loadForYouFeed() async {
    setState(() => _isLoadingForYou = true);
    try {
      final feed = await ApiService.getUnifiedFeed(
        filter: 'foryou',
        lat: _userLocation?.latitude,
        lng: _userLocation?.longitude,
      );
      debugPrint('FEED: For You received ${feed.length} items');
      
      final dedupedFeed = _deduplicateFeed(feed);
      if (mounted) {
        setState(() {
          _forYouPosts = dedupedFeed;
          _isLoadingForYou = false;
        });
      }
    } catch (e) {
      debugPrint('FEED: Error loading For You feed: $e');
      if (mounted) setState(() => _isLoadingForYou = false);
    }
  }

  Future<void> _loadFollowingFeed() async {
    setState(() => _isLoadingFollowing = true);
    try {
      final feed = await ApiService.getUnifiedFeed(filter: 'following');
      debugPrint('FEED: Following received ${feed.length} items');
      
      final dedupedFeed = _deduplicateFeed(feed);
      if (mounted) {
        setState(() {
          _followingPosts = dedupedFeed;
          _isLoadingFollowing = false;
        });
      }
    } catch (e) {
      debugPrint('FEED: Error loading Following feed: $e');
      if (mounted) setState(() => _isLoadingFollowing = false);
    }
  }

  List<Map<String, dynamic>> _deduplicateFeed(List<Map<String, dynamic>> feed) {
    final seenIds = <String>{};
    return feed.where((item) {
      final id = item['id']?.toString();
      if (id == null || seenIds.contains(id)) return false;
      seenIds.add(id);
      return true;
    }).toList();
  }

  // Legacy method for compatibility - uses For You posts
  Future<void> _loadFeed({String filter = 'all'}) async {
    if (filter == 'following') {
      await _loadFollowingFeed();
    } else {
      await _loadForYouFeed();
    }
  }

  // Legacy getter for _statusPosts - uses current tab's posts
  List<Map<String, dynamic>> get _statusPosts => 
    _tabController.index == 0 ? _forYouPosts : _followingPosts;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Tab bar
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(8),
          ),
          child: TabBar(
            controller: _tabController,
            indicator: BoxDecoration(
              color: Colors.deepOrange,
              borderRadius: BorderRadius.circular(8),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white54,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
            dividerColor: Colors.transparent,
            labelPadding: const EdgeInsets.symmetric(horizontal: 8),
            tabs: const [
              Tab(height: 32, text: 'For You'),
              Tab(height: 32, text: 'Following'),
            ],
          ),
        ),
        // Feed content
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildForYouFeed(),
              _buildFollowingFeed(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildForYouFeed() {
    debugPrint('FEED: _buildForYouFeed called - _isLoadingForYou=$_isLoadingForYou, _forYouPosts.length=${_forYouPosts.length}, _pendingChallenges.length=${_pendingChallenges.length}, _pendingTeamChallenges.length=${_pendingTeamChallenges.length}');
    if (_isLoadingForYou) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_forYouPosts.isEmpty && _pendingChallenges.isEmpty && _pendingTeamChallenges.isEmpty) {
      debugPrint('FEED: Showing empty state - no posts and no challenges');
      return _buildEmptyState(
        'No local activity yet',
        'Be the first to post at a court near you!',
        extraContent: _userLocation == null 
          ? Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(
                'Enable location to see activity within 50 miles',
                style: TextStyle(color: Colors.orange.shade300, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            )
          : null,
      );
    }

    // Pin scheduled runs to top
    final sortedPosts = _sortPostsWithScheduledFirst(_forYouPosts);
    // Total items = team challenges + 1v1 challenges + posts
    final totalChallenges = _pendingTeamChallenges.length + _pendingChallenges.length;
    final totalItems = totalChallenges + sortedPosts.length;

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([_loadForYouFeed(), _loadPendingChallenges(), _loadPendingTeamChallenges()]);
      },
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 100),
        itemCount: totalItems,
        itemBuilder: (context, index) {
          // First: team challenges
          if (index < _pendingTeamChallenges.length) {
            return _buildTeamChallengeCard(_pendingTeamChallenges[index]);
          }
          // Then: 1v1 challenges
          final challengeIndex = index - _pendingTeamChallenges.length;
          if (challengeIndex < _pendingChallenges.length) {
            return _buildChallengeCard(_pendingChallenges[challengeIndex]);
          }
          // Finally: regular posts
          final postIndex = index - totalChallenges;
          return _buildFeedItemCard(sortedPosts[postIndex]);
        },
      ),
    );
  }


  Widget _buildFollowingFeed() {
    if (_isLoadingFollowing) {
      return const Center(child: CircularProgressIndicator());
    }

    final checkInState = context.watch<CheckInState>();
    final courtCount = checkInState.followedCourtCount;
    final playerCount = checkInState.followedPlayerCount;
    final totalFollowing = courtCount + playerCount;

    // No following anyone yet - show challenges first, then empty state with follow buttons
    if (totalFollowing == 0) {
      return RefreshIndicator(
        onRefresh: _loadPendingChallenges,
        child: ListView(
          children: [
            // Show challenges at the top even if not following anyone
            ...(_pendingChallenges.map((c) => _buildChallengeCard(c)).toList()),
            // Then show empty state to encourage following
            Padding(
              padding: EdgeInsets.only(top: _pendingChallenges.isEmpty ? 40 : 16, left: 32, right: 32, bottom: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.start,
                children: [
                  Icon(Icons.feed_outlined, size: 48, color: Colors.white.withValues(alpha: 0.2)),
                  const SizedBox(height: 16),
                  const Text('Not following anyone yet', style: TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  const Text('Follow courts and players to see their updates here.', style: TextStyle(color: Colors.white38, fontSize: 13), textAlign: TextAlign.center),
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => context.go('/rankings'),
                            icon: const Icon(Icons.person, size: 18),
                            label: const Text('Follow Players'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => context.go('/courts'),
                            icon: const Icon(Icons.location_on, size: 18),
                            label: const Text('Follow Courts'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blue,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // Following header widget - always show both counts
    Widget followingHeader = Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          const Icon(Icons.rss_feed, color: Colors.white54, size: 16),
          const SizedBox(width: 8),
          const Text('Following ', style: TextStyle(color: Colors.white54, fontSize: 13)),
          // Players count - show modal if following, navigate if 0
          GestureDetector(
            onTap: () {
              if (playerCount > 0) {
                _showFollowedPlayersModal(context, checkInState);
              } else {
                context.go('/rankings');
              }
            },
            child: Text(
              '$playerCount player${playerCount == 1 ? '' : 's'}',
              style: TextStyle(
                color: playerCount > 0 ? Colors.green : Colors.white38,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.underline,
                decorationColor: playerCount > 0 ? Colors.green : Colors.white38,
              ),
            ),
          ),
          const Text(' • ', style: TextStyle(color: Colors.white38, fontSize: 13)),
          // Courts count - show modal if following, navigate if 0
          GestureDetector(
            onTap: () {
              if (courtCount > 0) {
                _showFollowedCourtsModal(context, checkInState);
              } else {
                context.go('/courts');
              }
            },
            child: Text(
              '$courtCount court${courtCount == 1 ? '' : 's'}',
              style: TextStyle(
                color: courtCount > 0 ? Colors.blue : Colors.white38,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.underline,
                decorationColor: courtCount > 0 ? Colors.blue : Colors.white38,
              ),
            ),
          ),
        ],
      ),
    );

    // Has following but no activity
    if (_followingPosts.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadFollowingFeed,
        child: ListView(
          children: [
            followingHeader,
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(Icons.hourglass_empty, size: 40, color: Colors.white.withValues(alpha: 0.15)),
                  const SizedBox(height: 12),
                  const Text(
                    'No activity yet',
                    style: TextStyle(color: Colors.white54, fontSize: 15, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Check back later for updates from the players and courts you follow.',
                    style: TextStyle(color: Colors.white38, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // Pin scheduled runs to top
    final sortedPosts = _sortPostsWithScheduledFirst(_followingPosts);
    // +1 for header, then challenges, then posts
    final totalItems = 1 + _pendingChallenges.length + sortedPosts.length;

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([_loadFollowingFeed(), _loadPendingChallenges()]);
      },
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 100),
        itemCount: totalItems,
        itemBuilder: (context, index) {
          if (index == 0) return followingHeader;
          // After header come challenges
          final challengeOffset = index - 1;
          if (challengeOffset < _pendingChallenges.length) {
            return _buildChallengeCard(_pendingChallenges[challengeOffset]);
          }
          // Then regular posts
          final postIndex = challengeOffset - _pendingChallenges.length;
          return _buildFeedItemCard(sortedPosts[postIndex]);
        },
      ),
    );
  }

  /// Sort posts with scheduled runs at the top (soonest first), then regular posts by createdAt
  List<Map<String, dynamic>> _sortPostsWithScheduledFirst(List<Map<String, dynamic>> posts) {
    final now = DateTime.now();
    
    // Filter out expired scheduled runs
    final activePosts = posts.where((post) {
      final scheduledAt = post['scheduledAt'];
      if (scheduledAt != null) {
        try {
          final schedDate = DateTime.parse(scheduledAt.toString()).toLocal();
          return schedDate.isAfter(now);
        } catch (_) {
          return true;
        }
      }
      return true;
    }).toList();

    // Separate scheduled runs from regular posts
    final scheduledRuns = activePosts.where((post) => post['scheduledAt'] != null).toList();
    final regularPosts = activePosts.where((post) => post['scheduledAt'] == null).toList();

    // Sort scheduled runs by time (soonest first)
    scheduledRuns.sort((a, b) {
      final aTime = DateTime.tryParse(a['scheduledAt']?.toString() ?? '');
      final bTime = DateTime.tryParse(b['scheduledAt']?.toString() ?? '');
      if (aTime != null && bTime != null) {
        return aTime.compareTo(bTime);
      }
      return 0;
    });

    // Sort regular posts by createdAt (most recent first)
    regularPosts.sort((a, b) {
      final aCreated = DateTime.tryParse(a['createdAt']?.toString() ?? '');
      final bCreated = DateTime.tryParse(b['createdAt']?.toString() ?? '');
      if (aCreated != null && bCreated != null) {
        return bCreated.compareTo(aCreated);
      }
      return 0;
    });

    // Combine: scheduled runs first, then regular posts
    return [...scheduledRuns, ...regularPosts];
  }

  /// Show modal with list of followed players
  void _showFollowedPlayersModal(BuildContext context, CheckInState checkInState) async {
    final players = await checkInState.getFollowedPlayersInfo();
    if (!context.mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.8,
        expand: false,
        builder: (context, scrollController) => Column(
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.person, color: Colors.green, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Following ${players.length} Player${players.length == 1 ? '' : 's'}',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white12, height: 1),
            // Player list
            Expanded(
              child: players.isEmpty
                  ? Center(
                      child: Text(
                        'No players followed yet',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
                      ),
                    )
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: players.length,
                      itemBuilder: (context, index) {
                        final player = players[index];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Colors.green.withValues(alpha: 0.2),
                            backgroundImage: player.photoUrl != null
                                ? NetworkImage(player.photoUrl!)
                                : null,
                            child: player.photoUrl == null
                                ? Text(
                                    player.name.isNotEmpty ? player.name[0].toUpperCase() : '?',
                                    style: const TextStyle(color: Colors.green),
                                  )
                                : null,
                          ),
                          title: Text(
                            player.name,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            'Rating: ${player.rating.toStringAsFixed(1)}',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.favorite, color: Colors.red),
                            onPressed: () async {
                              await checkInState.unfollowPlayer(player.playerId);
                              if (context.mounted) Navigator.pop(context);
                            },
                            tooltip: 'Unfollow',
                          ),
                          onTap: () {
                            Navigator.pop(context);
                            PlayerProfileSheet.showById(context, player.playerId);
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  /// Show modal with list of followed courts
  void _showFollowedCourtsModal(BuildContext context, CheckInState checkInState) async {
    final courts = await checkInState.getFollowedCourtsWithActivity();
    if (!context.mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.8,
        expand: false,
        builder: (context, scrollController) => Column(
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.location_on, color: Colors.blue, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Following ${courts.length} Court${courts.length == 1 ? '' : 's'}',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white12, height: 1),
            // Court list
            Expanded(
              child: courts.isEmpty
                  ? Center(
                      child: Text(
                        'No courts followed yet',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
                      ),
                    )
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: courts.length,
                      itemBuilder: (context, index) {
                        final court = courts[index];
                        return ListTile(
                          leading: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.blue.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.sports_basketball, color: Colors.blue, size: 24),
                          ),
                          title: Text(
                            court.courtName,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                          ),
                          subtitle: court.address != null
                              ? Text(
                                  court.address!,
                                  style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                )
                              : null,
                          trailing: IconButton(
                            icon: const Icon(Icons.favorite, color: Colors.red),
                            onPressed: () async {
                              await checkInState.unfollowCourt(court.courtId);
                              if (context.mounted) Navigator.pop(context);
                            },
                            tooltip: 'Unfollow',
                          ),
                          onTap: () {
                            Navigator.pop(context);
                            context.go('/courts?courtId=${court.courtId}');
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(String title, String subtitle, {Widget? extraContent}) {
    return Padding(
      padding: const EdgeInsets.only(top: 40, left: 32, right: 32, bottom: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Icon(Icons.feed_outlined, size: 48, color: Colors.white.withValues(alpha: 0.2)),
          const SizedBox(height: 16),
          Text(title, style: const TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Text(subtitle, style: const TextStyle(color: Colors.white38, fontSize: 13), textAlign: TextAlign.center),
          if (extraContent != null) extraContent,
        ],
      ),
    );
  }

  /// Dispatch to appropriate card renderer based on item type
  Widget _buildFeedItemCard(Map<String, dynamic> item) {
    final type = item['type']?.toString() ?? 'status';
    switch (type) {
      case 'checkin':
        return _buildCheckinCard(item);
      case 'match':
      case 'team_match':  // Team matches use the same card format as 1v1 matches
        return _buildMatchCard(item);
      case 'new_player':
        return _buildNewPlayerCard(item);
      case 'status':
      default:
        return _buildPostCard(item);
    }
  }

  /// Build a challenge card with accept/decline buttons
  /// Build a challenge card with accept/decline buttons
  Widget _buildChallengeCard(ChallengeRequest challenge) {
    debugPrint('FEED: Building challenge card for ${challenge.otherUser.name}');
    final opponent = challenge.otherUser;
    final message = challenge.message;

    return Container(
      margin: const EdgeInsets.only(bottom: 8), // Reduced from 12
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.orange.shade900.withOpacity(0.3), Colors.deepOrange.withOpacity(0.15)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12), // Reduced radius slightly
        border: Border.all(color: Colors.orange.withOpacity(0.4), width: 1.5), // Thinner border
        boxShadow: [
          BoxShadow(
            color: Colors.orange.withOpacity(0.1),
            blurRadius: 4, // Reduced blur
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), // Compact padding
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min, // Hug content
          children: [
            // Header: Challenge icon + "Challenge from X" + Avatar
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Compact Icon
                Container(
                  padding: const EdgeInsets.all(6), // Reduced from 8
                  decoration: BoxDecoration(
                    color: Colors.orange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.sports_basketball, color: Colors.orange, size: 18), // Reduced size
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.bolt, size: 12, color: Colors.orange), // Smaller bolt
                          const SizedBox(width: 4),
                          const Text(
                            'CHALLENGE',
                            style: TextStyle(
                              color: Colors.orange,
                              fontWeight: FontWeight.w900,
                              fontSize: 10, // Smaller font
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                         children: [
                           Text(
                            opponent.name,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14, // Slightly smaller
                            ),
                          ),
                          // Maybe add rating here if we had it easily available, but name is fine
                         ],
                      ),
                    ],
                  ),
                ),
                // Opponent avatar - smaller
                GestureDetector(
                  onTap: () => PlayerProfileSheet.showById(context, opponent.id),
                  child: CircleAvatar(
                    radius: 18, // Reduced from 22
                    backgroundColor: Colors.orange.withOpacity(0.3),
                    backgroundImage: opponent.photoUrl != null ? NetworkImage(opponent.photoUrl!) : null,
                    child: opponent.photoUrl == null
                        ? Text(
                            opponent.name.isNotEmpty ? opponent.name[0].toUpperCase() : '?',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                          )
                        : null,
                  ),
                ),
              ],
            ),
            
            // Challenge message - leaner container
            if (message.content.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 8), // Tighter spacing
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Text(
                    '"${message.content}"',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontStyle: FontStyle.italic,
                      fontSize: 13,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
            else 
               const SizedBox(height: 8),

            // Reply / Decline / Start Match buttons - Compact row
            Row(
              children: [
                // Decline button
                Expanded(
                  flex: 2, 
                  child: SizedBox(
                    height: 32, // Fixed smaller height
                    child: OutlinedButton(
                      onPressed: () => _declineChallenge(challenge),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white70,
                        side: const BorderSide(color: Colors.white24),
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      child: const Text('Decline', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Reply button
                Expanded(
                  flex: 2,
                  child: SizedBox(
                    height: 32,
                    child: OutlinedButton.icon(
                      onPressed: () => _replyToChallenge(challenge),
                      icon: const Icon(Icons.chat_bubble_outline, size: 14),
                      label: const Text('Reply', style: TextStyle(fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: BorderSide(color: Colors.orange.withOpacity(0.5)),
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Start Match button
                Expanded(
                  flex: 3, // Give more space
                  child: SizedBox(
                    height: 32,
                    child: ElevatedButton.icon(
                      onPressed: () => _acceptChallenge(challenge),
                      icon: const Icon(Icons.sports_basketball, size: 14),
                      label: const Text('Start Match', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.orange,
                        foregroundColor: Colors.white,
                        padding: EdgeInsets.zero,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Build team challenge card (similar to 1v1 but for team vs team)
  Widget _buildTeamChallengeCard(TeamChallengeRequest challenge) {
    debugPrint('FEED: Building team challenge card: ${challenge.fromTeamName} vs ${challenge.toTeamName}');

    final isIncoming = challenge.isIncoming;
    final opponentTeamName = challenge.opponentTeamName;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.purple.shade900.withOpacity(0.3), Colors.deepPurple.withOpacity(0.15)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.purple.withOpacity(0.4), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.purple.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header: Team challenge icon + team names
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Team icon
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.groups, color: Colors.purple, size: 18),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.bolt, size: 12, color: Colors.purple),
                          const SizedBox(width: 4),
                          Text(
                            isIncoming ? 'TEAM CHALLENGE' : 'CHALLENGE SENT',
                            style: TextStyle(
                              color: Colors.purple.shade200,
                              fontWeight: FontWeight.w900,
                              fontSize: 10,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.purple.withOpacity(0.3),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              challenge.teamType,
                              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        isIncoming ? 'From: $opponentTeamName' : 'To: $opponentTeamName',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                // Team type avatar
                CircleAvatar(
                  radius: 18,
                  backgroundColor: Colors.purple.withOpacity(0.3),
                  child: Text(
                    challenge.teamType,
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            
            // Challenge message
            if (challenge.message.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 8),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Text(
                    '"${challenge.message}"',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontStyle: FontStyle.italic,
                      fontSize: 13,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
            else 
               const SizedBox(height: 8),

            // Buttons: Decline / Accept (only for incoming)
            if (isIncoming)
              Row(
                children: [
                  // Decline button
                  Expanded(
                    flex: 2, 
                    child: SizedBox(
                      height: 32,
                      child: OutlinedButton(
                        onPressed: () => _declineTeamChallenge(challenge),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white70,
                          side: const BorderSide(color: Colors.white24),
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                        child: const Text('Decline', style: TextStyle(fontSize: 12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Accept button
                  Expanded(
                    flex: 3,
                    child: SizedBox(
                      height: 32,
                      child: ElevatedButton.icon(
                        onPressed: () => _acceptTeamChallenge(challenge),
                        icon: const Icon(Icons.groups, size: 14),
                        label: const Text('Accept', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.purple,
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.zero,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                      ),
                    ),
                  ),
                ],
              )
            else
              // Outgoing: show "Pending" indicator
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.purple.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.hourglass_empty, size: 14, color: Colors.purple.shade200),
                    const SizedBox(width: 6),
                    Text(
                      'Waiting for ${challenge.toTeamName} to respond',
                      style: TextStyle(color: Colors.purple.shade200, fontSize: 12),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Accept a team challenge and navigate to match setup (mirrors 1v1 flow)
  Future<void> _acceptTeamChallenge(TeamChallengeRequest challenge) async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      final result = await _messagesService.acceptTeamChallenge(userId, challenge.myTeamId, challenge.id);
      
      if (mounted) {
        _loadPendingTeamChallenges(); // Refresh
        
        // Set MatchState for team match (mirrors 1v1 _acceptChallenge flow)
        final matchState = Provider.of<MatchState>(context, listen: false);
        matchState.reset(); // Clear any previous match state
        
        // Set team match mode
        matchState.mode = challenge.teamType; // '3v3' or '5v5'
        matchState.myTeamId = challenge.myTeamId; // Store team ID for score submission
        
        // Set team names for display
        matchState.myTeamName = challenge.isIncoming ? challenge.toTeamName : challenge.fromTeamName;
        matchState.opponentTeamName = challenge.opponentTeamName;
        
        // Set matchId from backend response
        if (result['match'] != null && result['match']['id'] != null) {
          matchState.setMatchId(result['match']['id'].toString());
        }
        
        // Navigate to match setup (same as 1v1)
        context.go('/match/setup');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  /// Decline a team challenge
  Future<void> _declineTeamChallenge(TeamChallengeRequest challenge) async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      await _messagesService.declineTeamChallenge(userId, challenge.myTeamId, challenge.id);
      
      if (mounted) {
        _loadPendingTeamChallenges(); // Refresh
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Challenge declined')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }


  /// Accept a challenge and start a match
  Future<void> _acceptChallenge(ChallengeRequest challenge) async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      // Accept on backend (updates challenge status)
      final result = await _messagesService.acceptChallenge(userId, challenge.message.id);
      
      if (mounted) {
        _loadPendingChallenges(); // Refresh challenges
        
        // CRITICAL: Set opponent in MatchState from challenge data BEFORE navigating
        final matchState = Provider.of<MatchState>(context, listen: false);
        matchState.setOpponent(challenge.otherUser.toPlayer());
        
        // Set matchId if backend returned one
        if (result['matchId'] != null) {
          matchState.setMatchId(result['matchId'].toString());
        }
        
        // Set court if challenge had one
        if (challenge.court != null) {
          final court = Court(
            id: challenge.court!['id']?.toString() ?? '',
            name: challenge.court!['name']?.toString() ?? 'Unknown',
            lat: 0, lng: 0, // coords not needed for display
          );
          matchState.setCourt(court);
        }
        
        // Navigate to match setup (opponent will be pre-populated)
        context.go('/match/setup');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to accept: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  /// Reply to a challenge - navigate to chat
  void _replyToChallenge(ChallengeRequest challenge) {
    // Navigate to chat with the opponent
    context.go('/messages/chat/${challenge.otherUser.id}');
  }

  /// Decline a challenge
  Future<void> _declineChallenge(ChallengeRequest challenge) async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      await _messagesService.declineChallenge(userId, challenge.message.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Challenge declined'), backgroundColor: Colors.grey),
        );
        _loadPendingChallenges(); // Refresh challenges
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to decline: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Widget _buildCheckinCard(Map<String, dynamic> item) {
    final userName = item['userName']?.toString() ?? 'Unknown';
    final userPhotoUrl = item['userPhotoUrl']?.toString();
    final courtName = item['courtName']?.toString() ?? 'Unknown Court';
    final createdAt = item['createdAt'];

    String timeAgo = _formatTimeAgo(createdAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E), // Premium dark surface
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.blue.withOpacity(0.15), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 4,
            offset: const Offset(0, 2),
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
                  padding: const EdgeInsets.all(2), // Border effect
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: [Colors.blue, Colors.blue.withOpacity(0.5)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: CircleAvatar(
                    radius: 20,
                    backgroundColor: Colors.grey[900],
                    backgroundImage: userPhotoUrl != null 
                      ? (userPhotoUrl.startsWith('data:') 
                          ? MemoryImage(Uri.parse(userPhotoUrl).data!.contentAsBytes()) 
                          : NetworkImage(userPhotoUrl) as ImageProvider)
                      : null,
                    child: userPhotoUrl == null
                        ? Text(userName.isNotEmpty ? userName[0].toUpperCase() : '?',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
                        : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      RichText(
                        text: TextSpan(
                          style: const TextStyle(fontSize: 15, color: Colors.white, height: 1.3),
                          children: [
                            TextSpan(text: userName, style: const TextStyle(fontWeight: FontWeight.bold)),
                            const TextSpan(text: ' checked in', style: TextStyle(color: Colors.white70)),
                          ],
                        ),
                      ),
                      if (timeAgo.isNotEmpty)
                        Text(timeAgo, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.location_on, color: Colors.blue, size: 20),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.withOpacity(0.1)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.sports_basketball, size: 16, color: Colors.blue),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      courtName, 
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMatchCard(Map<String, dynamic> item) {
    final userName = item['userName']?.toString() ?? 'Unknown';
    final userPhotoUrl = item['userPhotoUrl']?.toString();
    final courtName = item['courtName']?.toString();
    final matchStatus = item['matchStatus']?.toString() ?? '';
    final createdAt = item['createdAt'];
    final matchScore = item['matchScore']?.toString(); // e.g. "21-18" or null
    final itemType = item['type']?.toString() ?? 'match';
    final isTeamMatch = itemType == 'team_match';
    
    // Get both winner and loser names for proper display
    final winnerName = item['winnerName']?.toString() ?? userName;
    final loserName = item['loserName']?.toString();
    
    // Get ratings for team matches
    final winnerRating = item['winnerRating'] != null 
        ? double.tryParse(item['winnerRating'].toString()) 
        : null;
    final loserRating = item['loserRating'] != null 
        ? double.tryParse(item['loserRating'].toString()) 
        : null;
    
    // Display text: "Winner vs Loser" if both available, else just winner
    final displayName = loserName != null && loserName.isNotEmpty 
        ? '$winnerName vs $loserName' 
        : winnerName;
    
    // Show "Pickup Game" instead of "Unknown Court" for better UX
    final displayCourtName = (courtName == null || courtName == 'Unknown Court' || courtName.isEmpty)
        ? 'Pickup Game'
        : courtName;

    String timeAgo = _formatTimeAgo(createdAt);

    // Use purple for team matches, green for 1v1
    final statusColor = isTeamMatch ? Colors.purple : (matchStatus == 'ended' ? Colors.green : Colors.orange);
    final statusText = matchStatus == 'ended' ? 'Final Score' : (matchStatus == 'live' ? 'Live Game' : 'Upcoming');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withOpacity(0.3), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Header
            Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: statusColor,
                  backgroundImage: userPhotoUrl != null 
                    ? (userPhotoUrl.startsWith('data:') 
                        ? MemoryImage(Uri.parse(userPhotoUrl).data!.contentAsBytes()) 
                        : NetworkImage(userPhotoUrl) as ImageProvider)
                    : null,
                  child: userPhotoUrl == null
                      ? Text(userName.isNotEmpty ? userName[0].toUpperCase() : '?',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12))
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (isTeamMatch) ...[
                            Icon(Icons.groups, size: 14, color: Colors.purple.shade300),
                            const SizedBox(width: 4),
                          ],
                          Flexible(child: Text(displayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14), overflow: TextOverflow.ellipsis)),
                        ],
                      ),
                      Text('played at $displayCourtName', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                    ],
                  ),
                ),
                Text(timeAgo, style: TextStyle(color: Colors.grey[600], fontSize: 11)),
              ],
            ),
            const SizedBox(height: 12),
            // Match Result Banner
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [statusColor.withOpacity(0.2), statusColor.withOpacity(0.05)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: statusColor.withOpacity(0.2)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(statusText.toUpperCase(), 
                          style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
                      const SizedBox(height: 4),
                      Text(matchScore ?? 'Game Score', 
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Icon(isTeamMatch ? Icons.groups : Icons.emoji_events_outlined, color: statusColor.withOpacity(0.8), size: 28),
                ],
              ),
            ),
            // Ratings row for ALL matches (1v1 and team) with ratings
            if (winnerRating != null && loserRating != null) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Winner rating
                  Row(
                    children: [
                      Icon(Icons.star, size: 14, color: statusColor),
                      const SizedBox(width: 4),
                      Text('${winnerName ?? 'Winner'}: ', style: TextStyle(color: Colors.grey[400], fontSize: 11)),
                      Text(winnerRating.toStringAsFixed(2), style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                  // Loser rating
                  Row(
                    children: [
                      Icon(Icons.star_border, size: 14, color: Colors.grey[500]),
                      const SizedBox(width: 4),
                      Text('${loserName ?? 'Loser'}: ', style: TextStyle(color: Colors.grey[400], fontSize: 11)),
                      Text(loserRating.toStringAsFixed(2), style: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Build a card for new player registration activity
  Widget _buildNewPlayerCard(Map<String, dynamic> item) {
    final player = item['player'] ?? {};
    final playerName = player['name'] ?? 'New Player';
    final photoUrl = player['photoUrl'];
    final rating = (player['rating'] is num ? player['rating'].toDouble() : double.tryParse(player['rating']?.toString() ?? '3.0')) ?? 3.0;
    final position = player['position'] ?? '';
    final city = player['city'] ?? '';
    final playerId = player['id'] ?? '';
    final timeAgo = _formatTimeAgo(item['createdAt']);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.green.withOpacity(0.15),
            Colors.teal.withOpacity(0.1),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.green.withOpacity(0.3)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (playerId.isNotEmpty) {
              context.push('/players/$playerId');
            }
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Player avatar with badge
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: Colors.green.withOpacity(0.3),
                      backgroundImage: photoUrl != null && photoUrl.toString().isNotEmpty
                          ? (photoUrl.toString().startsWith('data:')
                              ? MemoryImage(Uri.parse(photoUrl).data!.contentAsBytes())
                              : NetworkImage(photoUrl) as ImageProvider)
                          : null,
                      child: (photoUrl == null || photoUrl.toString().isEmpty)
                          ? Text(
                              playerName.isNotEmpty ? playerName[0].toUpperCase() : '?',
                              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                            )
                          : null,
                    ),
                    Positioned(
                      right: -4,
                      bottom: -4,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.green,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.grey[900]!, width: 2),
                        ),
                        child: const Icon(Icons.person_add, color: Colors.white, size: 12),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 16),
                // Player info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.celebration, color: Colors.green, size: 16),
                          const SizedBox(width: 6),
                          const Text(
                            'New Player Joined!',
                            style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          const Spacer(),
                          Text(timeAgo, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        playerName,
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          if (position.isNotEmpty) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.blue.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(position, style: const TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Text(
                            '⭐ ${rating.toStringAsFixed(2)}',
                            style: TextStyle(color: Colors.grey[400], fontSize: 12),
                          ),
                          if (city.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Icon(Icons.location_on, color: Colors.grey[500], size: 12),
                            const SizedBox(width: 2),
                            Flexible(
                              child: Text(
                                city,
                                style: TextStyle(color: Colors.grey[500], fontSize: 11),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatTimeAgo(dynamic createdAt) {
    if (createdAt == null) return '';
    try {
      final date = DateTime.parse(createdAt.toString());
      final diff = DateTime.now().difference(date);
      if (diff.inDays > 0) {
        return '${diff.inDays}d';
      } else if (diff.inHours > 0) {
        return '${diff.inHours}h';
      } else if (diff.inMinutes > 0) {
        return '${diff.inMinutes}m';
      } else {
        return 'now';
      }
    } catch (_) {
      return '';
    }
  }

  // ========== Interactive Handlers ==========

  void _toggleLike(int statusId, bool currentlyLiked, int currentCount) async {
    debugPrint('LIKE: Toggle like for statusId=$statusId, currentlyLiked=$currentlyLiked');
    // Optimistic update
    setState(() {
      _likeStates[statusId] = !currentlyLiked;
      _likeCounts[statusId] = currentlyLiked ? currentCount - 1 : currentCount + 1;
    });
    // API call
    final success = currentlyLiked 
        ? await ApiService.unlikeStatus(statusId)
        : await ApiService.likeStatus(statusId);
    debugPrint('LIKE: API response success=$success');
    if (!success && mounted) {
      debugPrint('LIKE: Reverting due to API failure');
      // Revert on failure
      setState(() {
        _likeStates[statusId] = currentlyLiked;
        _likeCounts[statusId] = currentCount;
      });
    }
  }

  void _confirmDeletePost(int statusId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E2128),
        title: const Text('Delete Post', style: TextStyle(color: Colors.white)),
        content: const Text('Are you sure you want to delete this post? This cannot be undone.', 
          style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      final success = await ApiService.deleteStatus(statusId);
      if (success && mounted) {
        // Remove from local state and refresh
        setState(() {
          _statusPosts.removeWhere((post) {
            final rawId = post['id'];
            final postId = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '') ?? 0;
            return postId == statusId;
          });
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post deleted'), backgroundColor: Colors.green),
        );
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete post'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _toggleComments(int statusId) async {
    final isExpanded = _expandedComments[statusId] ?? false;
    if (!isExpanded && !_comments.containsKey(statusId)) {
      // Load comments
      final comments = await ApiService.getStatusComments(statusId);
      if (mounted) {
        setState(() {
          _comments[statusId] = comments;
          _expandedComments[statusId] = true;
        });
      }
    } else {
      setState(() {
        _expandedComments[statusId] = !isExpanded;
      });
    }
  }

  void _addComment(int statusId, String content) async {
    if (content.trim().isEmpty) return;
    final result = await ApiService.addStatusComment(statusId, content);
    if (result != null && result['success'] == true && mounted) {
      final comments = await ApiService.getStatusComments(statusId);
      setState(() {
        _comments[statusId] = comments;
      });
    }
  }

  void _toggleAttending(int statusId, bool currentlyAttending, int currentCount) async {
    debugPrint('ATTEND: Toggle attending for statusId=$statusId, currentlyAttending=$currentlyAttending');
    // Optimistic update
    setState(() {
      _attendingStates[statusId] = !currentlyAttending;
      _attendeeCounts[statusId] = currentlyAttending ? currentCount - 1 : currentCount + 1;
    });
    // API call
    final success = currentlyAttending
        ? await ApiService.removeAttending(statusId)
        : await ApiService.markAttending(statusId);
    debugPrint('ATTEND: API response success=$success');
    if (!success && mounted) {
      debugPrint('ATTEND: Reverting due to API failure');
      // Revert on failure
      setState(() {
        _attendingStates[statusId] = currentlyAttending;
        _attendeeCounts[statusId] = currentCount;
      });
    } else if (success && !currentlyAttending && mounted) {
      // User just clicked IN — auto-expand and fetch attendee list
      _loadAttendees(statusId, autoExpand: true);
    }
  }

  void _loadAttendees(int statusId, {bool autoExpand = false}) async {
    try {
      final attendees = await ApiService.getAttendees(statusId);
      if (mounted) {
        setState(() {
          _attendeeDetails[statusId] = attendees;
          if (autoExpand) _expandedAttendees[statusId] = true;
        });
      }
    } catch (e) {
      debugPrint('Failed to load attendees: $e');
    }
  }

  void _sharePost(Map<String, dynamic> post) {
    final userName = post['userName']?.toString() ?? 'Someone';
    final content = post['content']?.toString() ?? '';
    final courtName = post['courtName']?.toString() ??
        (content.trim().startsWith('@') ? content.trim().substring(1).trim() : null);
    final scheduledAt = post['scheduledAt'];
    final isScheduledEvent = scheduledAt != null;

    final buffer = StringBuffer();

    if (isScheduledEvent) {
      // Scheduled Run share
      buffer.write('🏀 $userName is hosting a pickup run on HoopRank!');
      try {
        final dt = DateTime.parse(scheduledAt.toString()).toLocal();
        final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
        final amPm = dt.hour >= 12 ? 'PM' : 'AM';
        final timeStr = dt.minute == 0
            ? '$hour$amPm'
            : '$hour:${dt.minute.toString().padLeft(2, '0')}$amPm';
        const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        buffer.write('\n📅 ${weekdays[dt.weekday - 1]} ${dt.month}/${dt.day} at $timeStr');
      } catch (_) {}
      if (courtName != null && courtName.isNotEmpty) {
        buffer.write('\n📍 $courtName');
      }
      // Run attributes
      final gameMode = post['gameMode']?.toString();
      if (gameMode != null) buffer.write('\n🎮 $gameMode');
    } else {
      // Regular post share
      if (content.isNotEmpty) {
        buffer.write('$userName on HoopRank: "$content"');
      } else {
        buffer.write('Check out this post by $userName on HoopRank!');
      }
      if (courtName != null && courtName.isNotEmpty) {
        buffer.write('\n📍 $courtName');
      }
    }

    buffer.write('\n\nDownload HoopRank: https://apps.apple.com/app/hooprank/id6741466657');

    SharePlus.instance.share(ShareParams(text: buffer.toString()));
  }
  Widget _buildAttendeeRow(int statusId, int attendeeCount) {
    final isExpanded = _expandedAttendees[statusId] ?? false;
    final attendees = _attendeeDetails[statusId] ?? [];

    return GestureDetector(
      onTap: () {
        if (attendees.isEmpty) {
          _loadAttendees(statusId, autoExpand: true);
        } else {
          setState(() {
            _expandedAttendees[statusId] = !isExpanded;
          });
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF00C853).withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF00C853).withOpacity(0.15)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Stacked avatars
                if (attendees.isNotEmpty)
                  SizedBox(
                    width: (attendees.length.clamp(0, 5) * 22.0) + 8,
                    height: 28,
                    child: Stack(
                      children: [
                        for (var i = 0; i < attendees.length.clamp(0, 5); i++)
                          Positioned(
                            left: i * 22.0,
                            child: CircleAvatar(
                              radius: 14,
                              backgroundColor: Colors.grey[700],
                              backgroundImage: (attendees[i]['userPhotoUrl'] ?? attendees[i]['photoUrl']) != null
                                  ? ((attendees[i]['userPhotoUrl'] ?? attendees[i]['photoUrl']).toString().startsWith('data:')
                                      ? MemoryImage(Uri.parse((attendees[i]['userPhotoUrl'] ?? attendees[i]['photoUrl']).toString()).data!.contentAsBytes()) as ImageProvider
                                      : NetworkImage((attendees[i]['userPhotoUrl'] ?? attendees[i]['photoUrl']).toString()))
                                  : null,
                              child: (attendees[i]['userPhotoUrl'] ?? attendees[i]['photoUrl']) == null
                                  ? Text(
                                      ((attendees[i]['userName'] ?? attendees[i]['name'])?.toString() ?? '?')[0].toUpperCase(),
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white70),
                                    )
                                  : null,
                            ),
                          ),
                      ],
                    ),
                  )
                else
                  const Icon(Icons.people_outline, size: 18, color: Color(0xFF00C853)),
                const SizedBox(width: 8),
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: '$attendeeCount ',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF00C853), fontSize: 13),
                      ),
                      TextSpan(
                        text: attendeeCount == 1 ? 'player going' : 'players going',
                        style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Icon(
                  isExpanded ? Icons.expand_less : Icons.expand_more,
                  color: Colors.white.withOpacity(0.4),
                  size: 20,
                ),
              ],
            ),
            if (isExpanded && attendees.isNotEmpty) ...[
              const SizedBox(height: 10),
              Divider(height: 1, color: Colors.white.withOpacity(0.08)),
              const SizedBox(height: 8),
              ...attendees.map((a) {
                final name = a['userName']?.toString() ?? a['name']?.toString() ?? 'Unknown';
                final photo = a['userPhotoUrl']?.toString() ?? a['photoUrl']?.toString();
                final odId = a['userId']?.toString();
                return GestureDetector(
                  onTap: odId != null ? () => PlayerProfileSheet.showById(context, odId) : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 12,
                          backgroundColor: Colors.grey[700],
                          backgroundImage: photo != null
                              ? (photo.startsWith('data:')
                                  ? MemoryImage(Uri.parse(photo).data!.contentAsBytes()) as ImageProvider
                                  : NetworkImage(photo))
                              : null,
                          child: photo == null
                              ? Text(
                                  name[0].toUpperCase(),
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white70),
                                )
                              : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            name,
                            style: const TextStyle(color: Colors.white70, fontSize: 13),
                          ),
                        ),
                        if (odId != null)
                          Icon(Icons.chevron_right, size: 16, color: Colors.white.withOpacity(0.3)),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAttributeBadge(String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  // ========== Post Card with Interactive Engagement ==========

  Widget _buildPostCard(Map<String, dynamic> post) {
    // Ensure statusId is an int - it might come as a string or int from the API
    final rawId = post['id'];
    final statusId = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '') ?? 0;
    if (statusId == 0) {
      debugPrint('FEED: Warning - invalid statusId for post: ${post['content']?.toString().substring(0, 20)}...');
    }
    final postUserId = post['userId']?.toString() ?? '';
    final isOwnPost = postUserId == ApiService.userId;
    final userName = post['userName']?.toString() ?? 'Unknown';
    final userPhotoUrl = post['userPhotoUrl']?.toString();
    final content = post['content']?.toString() ?? '';
    final imageUrl = post['imageUrl']?.toString();
    final scheduledAt = post['scheduledAt'];
    // Improved extraction logic for court info
    final rawContent = content.trim();
    final courtName = post['courtName']?.toString() ?? 
                     (rawContent.startsWith('@') ? rawContent.substring(1).trim() : null);
    final courtId = post['courtId']?.toString(); // For deep linking to court
    
    // Use local state if available, otherwise use from API
    final serverLikeCount = post['likeCount'] is int ? post['likeCount'] : int.tryParse(post['likeCount']?.toString() ?? '0') ?? 0;
    final serverIsLiked = post['isLikedByMe'] == true;
    final likeCount = _likeCounts[statusId] ?? serverLikeCount;
    final isLiked = _likeStates[statusId] ?? serverIsLiked;
    
    final commentCount = post['commentCount'] is int ? post['commentCount'] : int.tryParse(post['commentCount']?.toString() ?? '0') ?? 0;
    final createdAt = post['createdAt'];
    
    // Attendance state for scheduled events
    final serverAttendeeCount = post['attendeeCount'] is int ? post['attendeeCount'] : int.tryParse(post['attendeeCount']?.toString() ?? '0') ?? 0;
    final serverIsAttending = post['isAttendingByMe'] == true;
    final attendeeCount = _attendeeCounts[statusId] ?? serverAttendeeCount;
    final isAttending = _attendingStates[statusId] ?? serverIsAttending;
    
    final isScheduledEvent = scheduledAt != null;
    
    // Hide expired scheduled runs (real-time check)
    if (isScheduledEvent) {
      try {
        final schedDate = DateTime.parse(scheduledAt.toString()).toLocal();
        if (schedDate.isBefore(DateTime.now())) {
          return const SizedBox.shrink(); // Hide expired scheduled runs
        }
      } catch (_) {}
    }
    
    final isExpanded = _expandedComments[statusId] ?? false;
    final comments = _comments[statusId] ?? [];

    String timeAgo = '';
    if (createdAt != null) {
      try {
        final date = DateTime.parse(createdAt.toString());
        final diff = DateTime.now().difference(date);
        if (diff.inDays > 0) {
          timeAgo = '${diff.inDays}d';
        } else if (diff.inHours > 0) {
          timeAgo = '${diff.inHours}h';
        } else if (diff.inMinutes > 0) {
          timeAgo = '${diff.inMinutes}m';
        } else {
          timeAgo = 'now';
        }
      } catch (_) {}
    }

    // Format scheduled time
    DateTime? scheduledDate;
    String scheduledDayStr = ''; 
    String scheduledTimeStr = '';
    
    if (isScheduledEvent) {
      try {
        // Parse UTC time and convert to local for display
        scheduledDate = DateTime.parse(scheduledAt.toString()).toLocal();
        final now = DateTime.now();
        final todayStart = DateTime(now.year, now.month, now.day);
        final tomorrowStart = todayStart.add(const Duration(days: 1));
        final dayAfterTomorrow = todayStart.add(const Duration(days: 2));
        
        final isToday = scheduledDate!.isAfter(todayStart) && scheduledDate!.isBefore(tomorrowStart);
        final isTomorrow = scheduledDate!.isAfter(tomorrowStart.subtract(const Duration(seconds: 1))) && scheduledDate!.isBefore(dayAfterTomorrow);
        
        // Time of day descriptor
        final hour = scheduledDate!.hour;
        String timeOfDay;
        if (hour < 12) {
          timeOfDay = 'morning';
        } else if (hour < 17) {
          timeOfDay = 'afternoon';
        } else {
          timeOfDay = 'evening';
        }
        
        // Day of week names
        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        final dayOfWeek = weekdays[scheduledDate!.weekday - 1];
        
        // Format hour for display
        final displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
        final amPm = hour >= 12 ? 'pm' : 'am';
        
        if (isToday) {
          scheduledDayStr = 'This $timeOfDay';
        } else if (isTomorrow) {
          scheduledDayStr = 'Tomorrow $timeOfDay';
        } else {
          // Show day of week + date (e.g., "Friday 1/31")
          scheduledDayStr = '$dayOfWeek ${scheduledDate!.month}/${scheduledDate!.day}';
        }
        
        if (scheduledDate!.minute == 0) {
          scheduledTimeStr = '$displayHour$amPm';
        } else {
          scheduledTimeStr = '$displayHour:${scheduledDate!.minute.toString().padLeft(2, '0')}$amPm';
        }
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12), // Slightly more spacing
      decoration: isScheduledEvent 
          ? BoxDecoration(
              // Distinct modern look for Scheduled Runs
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF25282B), // Slightly lighter/cooler dark grey
                  const Color(0xFF1A1D21),
                ],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFF00C853).withOpacity(0.3), // Subtle green border
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00C853).withOpacity(0.05), // Very faint green glow
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            )
          : BoxDecoration(
              color: const Color(0xFF1E1E1E), 
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 4,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
        children: [
          // Background accent graphic for scheduled runs (Abstract/Modern)
          if (isScheduledEvent)
            Positioned(
              right: -20,
              top: -20,
              child: Opacity(
                opacity: 0.05,
                child: Icon(Icons.sports_basketball, size: 150, color: const Color(0xFF00C853)),
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(16), // More breathing room
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with avatar and name
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(1.5), // Thinner border
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: isScheduledEvent 
                          ? [const Color(0xFF00C853), const Color(0xFF00C853).withOpacity(0.5)] // Green border for scheduled
                          : [Colors.deepOrange, Colors.deepOrange.withOpacity(0.5)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: CircleAvatar(
                    radius: 20, 
                    backgroundColor: Colors.grey[900],
                    backgroundImage: userPhotoUrl != null 
                      ? (userPhotoUrl.startsWith('data:') 
                          ? MemoryImage(Uri.parse(userPhotoUrl).data!.contentAsBytes()) 
                          : NetworkImage(userPhotoUrl) as ImageProvider)
                      : null,
                    child: userPhotoUrl == null
                        ? Text(userName.isNotEmpty ? userName[0].toUpperCase() : '?',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13))
                        : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              userName, 
                              style: const TextStyle(
                                fontWeight: FontWeight.bold, 
                                fontSize: 15, 
                                color: Colors.white,
                              ), 
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isScheduledEvent) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFF00C853).withOpacity(0.15), 
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFF00C853).withOpacity(0.3)),
                              ),
                              child: const Text(
                                'SCHEDULED RUN', 
                                style: TextStyle(
                                  fontSize: 9, 
                                  fontWeight: FontWeight.w700, 
                                  color: Color(0xFF00C853), // Green text
                                  letterSpacing: 0.5,
                                )
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        timeAgo, 
                        style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                // Compact "IN" Button for Scheduled Events (Top Right)
                if (isScheduledEvent)
                  GestureDetector(
                    onTap: () => _toggleAttending(statusId, isAttending, attendeeCount),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isAttending ? const Color(0xFF00C853).withOpacity(0.15) : const Color(0xFF00C853), 
                        borderRadius: BorderRadius.circular(20),
                        border: isAttending ? Border.all(color: const Color(0xFF00C853)) : null,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isAttending ? Icons.check : Icons.add_rounded, 
                            color: isAttending ? const Color(0xFF00C853) : Colors.black, 
                            size: 16, 
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isAttending ? "IN ($attendeeCount)" : "JOIN ($attendeeCount)",
                            style: TextStyle(
                              color: isAttending ? const Color(0xFF00C853) : Colors.black, 
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Icon(Icons.more_horiz, color: Colors.white.withOpacity(0.2), size: 20),
              ],
            ),
            
            // Scheduled Run Details - Modern Card
            if (isScheduledEvent)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 16, bottom: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.2), 
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.08)),
                ),
                child: Column(
                  children: [
                    // Time Section
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                      child: Row(
                        children: [
                           Container(
                             padding: const EdgeInsets.all(8),
                             decoration: BoxDecoration(
                               color: Colors.white.withOpacity(0.08),
                               borderRadius: BorderRadius.circular(8),
                             ),
                             child: const Icon(Icons.calendar_today_rounded, size: 18, color: Colors.white),
                           ),
                           const SizedBox(width: 12),
                           Column(
                             crossAxisAlignment: CrossAxisAlignment.start,
                             children: [
                               Text(
                                scheduledDayStr,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white70,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                scheduledTimeStr,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  letterSpacing: -0.5,
                                ),
                              ),
                             ],
                           ),
                        ],
                      ),
                    ),
                    
                    // Run Attribute Badges
                    if (post['gameMode'] != null || post['courtType'] != null || post['ageRange'] != null) ...[
                      Divider(height: 1, color: Colors.white.withOpacity(0.08)),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                        child: Wrap(
                          alignment: WrapAlignment.start,
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if (post['gameMode'] != null)
                              _buildAttributeBadge(
                                post['gameMode'].toString(),
                                post['gameMode'] == '3v3' ? Icons.people : Icons.groups,
                                post['gameMode'] == '3v3' ? Colors.blue : Colors.purple,
                              ),
                            if (post['courtType'] != null)
                              _buildAttributeBadge(
                                post['courtType'] == 'full' ? 'Full Court' : 'Half Court',
                                post['courtType'] == 'full' ? Icons.rectangle_outlined : Icons.crop_square,
                                Colors.teal,
                              ),
                            if (post['ageRange'] != null)
                              _buildAttributeBadge(
                                post['ageRange'].toString(),
                                Icons.people_outline,
                                Colors.amber,
                              ),
                          ],
                        ),
                      ),
                    ],

                    if (courtName != null) ...[
                      // Divider
                      Divider(height: 1, color: Colors.white.withOpacity(0.08)),
                      
                      // Court Location Button
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: (courtId != null || courtName != null) ? () {
                            final params = <String, String>{};
                            if (courtId != null) params['courtId'] = courtId;
                            if (courtName != null) params['courtName'] = Uri.encodeComponent(courtName);
                            final queryString = params.entries.map((e) => '${e.key}=${e.value}').join('&');
                            context.go('/courts?$queryString');
                          } : null,
                          borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                 Container(
                                   padding: const EdgeInsets.all(6),
                                   decoration: BoxDecoration(
                                     color: const Color(0xFF00C853).withOpacity(0.15),
                                     shape: BoxShape.circle,
                                   ),
                                   child: const Icon(Icons.location_on_rounded, size: 16, color: Color(0xFF00C853)),
                                 ),
                                 const SizedBox(width: 12),
                                 Expanded(
                                   child: Column(
                                     crossAxisAlignment: CrossAxisAlignment.start,
                                     children: [
                                       if (courtId != null) // Only show label if it's a real linked court
                                         Text(
                                          "LOCATION",
                                           style: TextStyle(
                                            fontSize: 9,
                                            color: const Color(0xFF00C853).withOpacity(0.8),
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 0.5,
                                           ),
                                         ),
                                       Text(
                                        courtName,
                                        style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white.withOpacity(0.95),
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                     ],
                                   ),
                                 ),
                                 Icon(Icons.chevron_right, size: 20, color: Colors.white.withOpacity(0.3)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ]
                  ],
                ),
              ),

            // Attendee Visibility Row (for scheduled runs)
            if (isScheduledEvent && isAttending) ...[
              const SizedBox(height: 8),
              _buildAttendeeRow(statusId, attendeeCount),
            ],
            
            // Regular Content (for non-scheduled events)
            if (content.isNotEmpty && !isScheduledEvent)
              Padding(
                padding: const EdgeInsets.only(top: 12, bottom: 4), 
                child: Text(
                  content, 
                  style: TextStyle(fontSize: 15, height: 1.4, color: Colors.white.withOpacity(0.9)), 
                ),
              ),

            // Location Chip for Regular Posts
            if (courtName != null && !isScheduledEvent)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: GestureDetector(
                  onTap: (courtId != null || courtName != null) ? () {
                    final params = <String, String>{};
                    if (courtId != null) params['courtId'] = courtId;
                    if (courtName != null) params['courtName'] = Uri.encodeComponent(courtName);
                    final queryString = params.entries.map((e) => '${e.key}=${e.value}').join('&');
                    context.go('/courts?$queryString');
                  } : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00C853).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF00C853).withOpacity(0.2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.location_on, size: 14, color: Color(0xFF00C853)),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            courtName,
                            style: const TextStyle(
                              color: Color(0xFF00C853),
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              
            // Video / Image Logic Same As Before
            if (post['videoUrl'] != null && post['videoUrl'].toString().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: FeedVideoPlayer(
                  videoUrl: post['videoUrl'].toString(),
                  thumbnailUrl: post['videoThumbnailUrl']?.toString(),
                  durationMs: post['videoDurationMs'] is int 
                    ? post['videoDurationMs'] 
                    : int.tryParse(post['videoDurationMs']?.toString() ?? ''),
                  autoPlay: true,
                  startMuted: true,
                ),
              )
            else if (imageUrl != null && imageUrl.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxHeight: 500, // Allow tall portrait images
                    ),
                    child: imageUrl.startsWith('data:')
                      ? Image.memory(
                          Uri.parse(imageUrl).data!.contentAsBytes(),
                          fit: BoxFit.contain, // Preserve original aspect ratio
                          width: double.infinity,
                          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                        )
                      : Image.network(
                          imageUrl,
                          fit: BoxFit.contain, // Preserve original aspect ratio
                          width: double.infinity,
                          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                        ),
                  ),
                ),
              ),
            
            // Interaction Bar
            const SizedBox(height: 14), 
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                children: [
                  // Like Button
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => _toggleLike(statusId, isLiked, likeCount),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        child: Row(
                          children: [
                            Icon(
                              isLiked ? Icons.favorite : Icons.favorite_border_rounded,
                              size: 20, 
                              color: isLiked ? Colors.redAccent : Colors.grey[500],
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '$likeCount',
                              style: TextStyle(
                                color: isLiked ? Colors.redAccent : Colors.grey[500],
                                fontSize: 13, 
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Comment Button
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => _toggleComments(statusId),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        child: Row(
                          children: [
                            Icon(
                              Icons.chat_bubble_outline_rounded,
                              size: 20,
                              color: isExpanded ? Colors.blue : Colors.grey[500],
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '$commentCount',
                              style: TextStyle(
                                color: isExpanded ? Colors.blue : Colors.grey[500],
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  
                  const Spacer(),
                  // Share Button
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => _sharePost(post),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        child: Icon(Icons.share_outlined, color: Colors.grey[600], size: 20),
                      ),
                    ),
                  ),
                  
                  // Delete Button
                  if (isOwnPost) ...[
                    const SizedBox(width: 16),
                    GestureDetector(
                      onTap: () => _confirmDeletePost(statusId),
                      child: Icon(
                        Icons.delete_outline, 
                        color: Colors.grey[600], 
                        size: 20,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            
            // Expanded comments section matches existing logic, just keeping it here
            if (isExpanded) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.2), // Darker inset background
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Existing comments
                    if (comments.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text('No comments yet. Be the first!', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                      )
                    else
                      ...comments.map((comment) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 14,
                              backgroundColor: Colors.deepOrange.withOpacity(0.3),
                              backgroundImage: comment['userPhotoUrl'] != null 
                                  ? (comment['userPhotoUrl'].toString().startsWith('data:') 
                                      ? MemoryImage(Uri.parse(comment['userPhotoUrl']).data!.contentAsBytes()) 
                                      : NetworkImage(comment['userPhotoUrl']) as ImageProvider)
                                  : null,
                              child: comment['userPhotoUrl'] == null
                                  ? Text(
                                      (comment['userName'] ?? '?')[0].toUpperCase(),
                                      style: const TextStyle(fontSize: 10, color: Colors.white),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        comment['userName'] ?? 'User',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        '· now', // Simplified for demo
                                        style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    comment['content'] ?? '',
                                    style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.8)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )).toList(),
                    const SizedBox(height: 8),
                    // Add comment input
                    _CommentInput(
                      onSubmit: (text) => _addComment(statusId, text),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        ),
        ],
      ),
      ),
    );
  }


  Widget _buildCourtActivityCard(CourtActivity activity) {
    final playerName = activity.playerName;
    final courtName = activity.courtName ?? 'Unknown Court';
    final timestamp = activity.timestamp;

    String timeAgo = '';
    final diff = DateTime.now().difference(timestamp);
    if (diff.inDays > 0) {
      timeAgo = '${diff.inDays}d ago';
    } else if (diff.inHours > 0) {
      timeAgo = '${diff.inHours}h ago';
    } else if (diff.inMinutes > 0) {
      timeAgo = '${diff.inMinutes}m ago';
    } else {
      timeAgo = 'just now';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: Colors.white.withOpacity(0.03),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.green.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.location_on, size: 16, color: Colors.green),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 13, color: Colors.white),
                      children: [
                        TextSpan(text: playerName, style: const TextStyle(fontWeight: FontWeight.w600)),
                        const TextSpan(text: ' checked in at '),
                        TextSpan(text: courtName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  Text(timeAgo, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Simple inline comment input widget
class _CommentInput extends StatefulWidget {
  final Function(String) onSubmit;

  const _CommentInput({required this.onSubmit});

  @override
  State<_CommentInput> createState() => _CommentInputState();
}

class _CommentInputState extends State<_CommentInput> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isNotEmpty) {
      widget.onSubmit(text);
      _controller.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _controller,
            style: const TextStyle(fontSize: 12, color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Add a comment...',
              hintStyle: TextStyle(color: Colors.grey[500], fontSize: 12),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              fillColor: Colors.white.withOpacity(0.05),
              filled: true,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide: BorderSide.none,
              ),
            ),
            onSubmitted: (_) => _submit(),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: _submit,
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.deepOrange,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.send, size: 16, color: Colors.white),
          ),
        ),
      ],
    );
  }
}


class BasketballCourtPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(16));
    
    // Clip to rounded rect prevents drawing outside corners
    canvas.save();
    canvas.clipRRect(rrect);
    
    // Parquet Wood Colors (Light Maple/Blonde)
    final woodColors = [
      const Color(0xFFEACC94), // Light Maple
      const Color(0xFFE0C082), // Honey
      const Color(0xFFD6B575), // Slightly darker
      const Color(0xFFF3DFA8), // Very light
      const Color(0xFFDEC58A), // Standard
    ];

    const plankWidth = 16.0; // Narrower planks similar to reference
    
    // Iterate columns (Planks)
    for (double x = 0; x < size.width; x += plankWidth) {
      final colIndex = (x / plankWidth).floor();
      // Stagger rows
      double y = (colIndex % 2 == 0) ? -20.0 : -60.0;
      
      // Deterministic random for this column to prevent flickering
      final random = math.Random(colIndex * 1337 + 42); 
      
      while (y < size.height) {
        final plankLen = 80.0 + random.nextInt(100); // Shorter planks
        final plankRect = Rect.fromLTWH(x, y, plankWidth, plankLen);
        
        // 1. Draw Plank with random wood shade
        final color = woodColors[random.nextInt(woodColors.length)];
        canvas.drawRect(plankRect, Paint()..color = color);
        
        // 2. Plank Joints/Grain (Very subtle)
        canvas.drawRect(plankRect, Paint()
          ..color = Colors.black.withOpacity(0.04)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5
        );

        y += plankLen;
      }
    }
    
    // 3. Gloss/Varnish Effect (Stronger gloss)
    final glossGradient = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
         Colors.white.withOpacity(0.35), // Strong glare
         Colors.white.withOpacity(0.1),
         Colors.transparent,
      ],
      stops: const [0.0, 0.25, 0.7],
    );
    canvas.drawRect(rect, Paint()..shader = glossGradient.createShader(rect));
    
    canvas.restore(); // End Clip
    
    // 4. Court Lines (White Border)
    final linePaint = Paint()
      ..color = Colors.white.withOpacity(0.95) // White lines
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0; 
      
    // Draw outer court line (inset)
    canvas.drawRRect(rrect.deflate(2.0), linePaint);
    
    // Optional: Draw a curved 3-point line hint?
    // Let's keep it simple with just the border for now, but black.
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../state/check_in_state.dart';
import '../services/api_service.dart';
import 'feed_video_player.dart';
import 'dart:math' as math;

/// Unified HoopRank Feed with All/Courts tabs
class HoopRankFeed extends StatefulWidget {
  const HoopRankFeed({super.key});

  @override
  State<HoopRankFeed> createState() => _HoopRankFeedState();
}

class _HoopRankFeedState extends State<HoopRankFeed> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Map<String, dynamic>> _statusPosts = [];
  bool _isLoading = true;

  // Local state for optimistic UI updates
  final Map<int, bool> _likeStates = {}; // statusId -> isLiked
  final Map<int, int> _likeCounts = {}; // statusId -> count
  final Map<int, bool> _expandedComments = {}; // statusId -> isExpanded
  final Map<int, List<Map<String, dynamic>>> _comments = {}; // statusId -> comments
  final Map<int, bool> _attendingStates = {}; // statusId -> isAttending
  final Map<int, int> _attendeeCounts = {}; // statusId -> count

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadFeedWithRetry();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// Load feed with retry if userId not available yet
  Future<void> _loadFeedWithRetry({int retries = 3}) async {
    for (int i = 0; i < retries; i++) {
      final userId = ApiService.userId;
      debugPrint('FEED_INIT: attempt ${i+1}/$retries, userId=$userId');
      if (userId != null && userId.isNotEmpty) {
        await _loadFeed();
        return;
      }
      // Wait a bit for auth to complete
      await Future.delayed(const Duration(milliseconds: 500));
    }
    // Still try even without userId
    debugPrint('FEED_INIT: proceeding without userId after $retries attempts');
    await _loadFeed();
  }

  Future<void> _loadFeed({String filter = 'all'}) async {
    setState(() => _isLoading = true);
    try {
      final userId = ApiService.userId;
      debugPrint('FEED: Loading unified feed with filter=$filter, userId=$userId');
      final feed = await ApiService.getUnifiedFeed(filter: filter);
      debugPrint('FEED: Received ${feed.length} items');
      
      // De-duplicate by id to prevent showing same item multiple times
      final seenIds = <String>{};
      final dedupedFeed = feed.where((item) {
        final id = item['id']?.toString();
        if (id == null || seenIds.contains(id)) {
          return false;
        }
        seenIds.add(id);
        return true;
      }).toList();
      debugPrint('FEED: After dedup: ${dedupedFeed.length} items (removed ${feed.length - dedupedFeed.length} duplicates)');
      
      if (dedupedFeed.isNotEmpty) {
        debugPrint('FEED: First item type=${dedupedFeed.first['type']}');
      }
      if (mounted) {
        setState(() {
          _statusPosts = dedupedFeed;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('FEED: Error loading feed: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

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
              Tab(height: 32, text: 'All'),
              Tab(height: 32, text: 'Courts'),
            ],
          ),
        ),
        // Feed content
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildAllFeed(),
              _buildCourtsFeed(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAllFeed() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_statusPosts.isEmpty) {
      return _buildEmptyState(
        'No activity yet', 
        'Follow courts and players to see their updates here.',
        extraContent: Padding(
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
      );
    }

    // Filter out expired scheduled runs and separate active scheduled runs
    final now = DateTime.now();
    final activePosts = _statusPosts.where((post) {
      final scheduledAt = post['scheduledAt'];
      if (scheduledAt != null) {
        try {
          final schedDate = DateTime.parse(scheduledAt.toString());
          return schedDate.isAfter(now); // Only include future scheduled runs
        } catch (_) {
          return true; // Include if parsing fails
        }
      }
      return true; // Include non-scheduled posts
    }).toList();

    // Separate scheduled runs (pinned) from regular posts
    final scheduledRuns = activePosts.where((post) => post['scheduledAt'] != null).toList();
    final regularPosts = activePosts.where((post) => post['scheduledAt'] == null).toList();

    // Combine: scheduled runs first, then regular posts
    final sortedPosts = [...scheduledRuns, ...regularPosts];

    return RefreshIndicator(
      onRefresh: () => _loadFeed(filter: 'all'),
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 100),
        itemCount: sortedPosts.length,
        itemBuilder: (context, index) => _buildFeedItemCard(sortedPosts[index]),
      ),
    );
  }

  Widget _buildCourtsFeed() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    // Get followed courts from CheckInState
    final checkInState = context.watch<CheckInState>();
    final followedCourts = checkInState.followedCourts;

    // Case 1: No courts followed at all
    if (followedCourts.isEmpty) {
      return _buildEmptyState(
        'No courts followed', 
        'Follow courts to see check-ins and activity here.',
        extraContent: Padding(
          padding: const EdgeInsets.only(top: 16),
          child: SizedBox(
            width: 160,
            child: ElevatedButton.icon(
              onPressed: () => context.go('/courts'),
              icon: const Icon(Icons.location_on, size: 18),
              label: const Text('Follow Courts'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ),
      );
    }
    
    // Filter items related to followed courts:
    // 1. Check-ins and matches at followed courts (by courtId)
    // 2. Status posts mentioning followed courts (by content containing court names)
    // 3. Scheduled events that mention followed courts
    final now = DateTime.now();
    final courtItems = _statusPosts.where((item) {
      // First, filter out expired scheduled runs
      final scheduledAt = item['scheduledAt'];
      if (scheduledAt != null) {
        try {
          final schedDate = DateTime.parse(scheduledAt.toString());
          if (schedDate.isBefore(now)) {
            return false; // Exclude expired scheduled runs
          }
        } catch (_) {}
      }
      
      // Include check-ins and matches by courtId
      if (item['type'] == 'checkin' || item['type'] == 'match') {
        final courtId = item['courtId']?.toString();
        if (courtId != null && followedCourts.contains(courtId)) {
          return true;
        }
      }
      
      // Include status posts that mention followed courts in content
      final content = item['content']?.toString().toLowerCase() ?? '';
      for (final courtId in followedCourts) {
        // Check if content mentions the court (with @, or partial match)
        if (content.contains('@') || content.contains('olympic') || content.contains('club')) {
          // For now, include posts that have @ mentions (court references)
          // This is a simple heuristic - posts with @ typically reference courts
          if (content.contains('@')) {
            return true;
          }
        }
      }
      
      return false;
    }).toList();
    
    // Sort by scheduled events first (soonest first), then by createdAt
    courtItems.sort((a, b) {
      final aScheduled = a['scheduledAt'] != null;
      final bScheduled = b['scheduledAt'] != null;
      
      // Scheduled events come first
      if (aScheduled && !bScheduled) return -1;
      if (!aScheduled && bScheduled) return 1;
      
      // If both scheduled, sort by scheduled time (soonest first)
      if (aScheduled && bScheduled) {
        final aTime = DateTime.tryParse(a['scheduledAt']?.toString() ?? '');
        final bTime = DateTime.tryParse(b['scheduledAt']?.toString() ?? '');
        if (aTime != null && bTime != null) {
          return aTime.compareTo(bTime);
        }
      }
      
      // Otherwise sort by createdAt (most recent first)
      final aCreated = DateTime.tryParse(a['createdAt']?.toString() ?? '');
      final bCreated = DateTime.tryParse(b['createdAt']?.toString() ?? '');
      if (aCreated != null && bCreated != null) {
        return bCreated.compareTo(aCreated);
      }
      return 0;
    });

    // Case 2: Courts followed but no related activity
    if (courtItems.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _loadFeed(filter: 'courts'),
        child: ListView(
          padding: const EdgeInsets.only(bottom: 100),
          children: [
            // Header showing followed courts count
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                            const Icon(Icons.location_on, color: Colors.blue, size: 18),
                            const SizedBox(width: 8),
                            const Text(
                              'Following ',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            GestureDetector(
                              onTap: () => _showFollowedCourtsModal(context, followedCourts),
                              child: Row(
                                children: [
                                  Text(
                                    '${followedCourts.length} court${followedCourts.length == 1 ? '' : 's'}',
                                    style: const TextStyle(
                                      color: Colors.blue,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      decoration: TextDecoration.underline,
                                      decorationColor: Colors.blue,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.chevron_right, color: Colors.blue, size: 16),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Empty state message
                      Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          children: [
                            Icon(Icons.sports_basketball, size: 48, color: Colors.white.withOpacity(0.15)),
                            const SizedBox(height: 16),
                            const Text(
                              'No activity yet',
                              style: TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'When players schedule games or check in at your followed courts, they\'ll appear here.',
                              style: TextStyle(color: Colors.white38, fontSize: 13),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }

              // Case 3: Has court-related activity - show using same card style as All feed
              return RefreshIndicator(
                onRefresh: () => _loadFeed(filter: 'courts'),
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 100),
                  itemCount: courtItems.length + 1, // +1 for header
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      // Header showing followed courts count - CLICKABLE
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                        child: Row(
                          children: [
                            const Icon(Icons.location_on, color: Colors.blue, size: 18),
                            const SizedBox(width: 8),
                            const Text(
                              'Following ',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            GestureDetector(
                              onTap: () => _showFollowedCourtsModal(context, followedCourts),
                              child: Row(
                                children: [
                                  Text(
                                    '${followedCourts.length} court${followedCourts.length == 1 ? '' : 's'}',
                                    style: const TextStyle(
                                      color: Colors.blue,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      decoration: TextDecoration.underline,
                                      decorationColor: Colors.blue,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.chevron_right, color: Colors.blue, size: 16),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '• ${courtItems.length} update${courtItems.length == 1 ? '' : 's'}',
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      );
                    }
                    return _buildFeedItemCard(courtItems[index - 1]);
                  },
                ),
              );
            }

            /// Show modal with list of followed courts
            void _showFollowedCourtsModal(BuildContext context, Set<String> followedCourts) async {
              final checkInState = context.read<CheckInState>();
              final courtsWithActivity = await checkInState.getFollowedCourtsWithActivity();
              
              if (!context.mounted) return;
              
              showModalBottomSheet(
                context: context,
                backgroundColor: const Color(0xFF1E1E1E),
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                isScrollControlled: true,
                builder: (context) {
                  return StatefulBuilder(
                    builder: (context, setModalState) {
                      return DraggableScrollableSheet(
                        initialChildSize: 0.5,
                        minChildSize: 0.3,
                        maxChildSize: 0.8,
                        expand: false,
                        builder: (context, scrollController) {
                          return Column(
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
                                      'Following ${courtsWithActivity.length} Court${courtsWithActivity.length == 1 ? '' : 's'}',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Divider(color: Colors.white12, height: 1),
                              // Court list
                              Expanded(
                                child: courtsWithActivity.isEmpty
                                    ? Center(
                                        child: Text(
                                          'No courts followed yet',
                                          style: TextStyle(color: Colors.white.withOpacity(0.5)),
                                        ),
                                      )
                                    : ListView.builder(
                                        controller: scrollController,
                                        itemCount: courtsWithActivity.length,
                                        itemBuilder: (context, index) {
                                          final court = courtsWithActivity[index];
                                          final isFollowing = checkInState.isFollowing(court.courtId);
                                          final hasAlert = checkInState.isAlertEnabled(court.courtId);
                                          
                                          return ListTile(
                                            leading: Container(
                                              width: 40,
                                              height: 40,
                                              decoration: BoxDecoration(
                                                color: Colors.blue.withOpacity(0.2),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: const Icon(Icons.sports_basketball, color: Colors.blue, size: 24),
                                            ),
                                            title: Text(
                                              court.courtName,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            subtitle: court.address != null
                                                ? Text(
                                                    court.address!,
                                                    style: TextStyle(
                                                      color: Colors.white.withOpacity(0.5),
                                                      fontSize: 12,
                                                    ),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  )
                                                : null,
                                            trailing: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                // Alert/Bell button
                                                IconButton(
                                                  icon: Icon(
                                                    hasAlert ? Icons.notifications_active : Icons.notifications_none,
                                                    color: hasAlert ? Colors.amber : Colors.white38,
                                                  ),
                                                  onPressed: () async {
                                                    await checkInState.toggleAlert(court.courtId);
                                                    setModalState(() {}); // Refresh modal
                                                  },
                                                  tooltip: hasAlert ? 'Disable alerts' : 'Enable alerts',
                                                ),
                                                // Heart/Follow button
                                                IconButton(
                                                  icon: Icon(
                                                    isFollowing ? Icons.favorite : Icons.favorite_border,
                                                    color: isFollowing ? Colors.red : Colors.white38,
                                                  ),
                                                  onPressed: () async {
                                                    await checkInState.toggleFollow(court.courtId);
                                                    // Refresh the list after unfollowing
                                                    final updatedCourts = await checkInState.getFollowedCourtsWithActivity();
                                                    setModalState(() {
                                                      courtsWithActivity.clear();
                                                      courtsWithActivity.addAll(updatedCourts);
                                                    });
                                                  },
                                                  tooltip: isFollowing ? 'Unfollow' : 'Follow',
                                                ),
                                              ],
                                            ),
                                          );
                                        },
                                      ),
                              ),
                            ],
                          );
                        },
                      );
                    },
                  );
                },
              );
            }



  Widget _buildEmptyState(String title, String subtitle, {Widget? extraContent}) {
    return Padding(
      padding: const EdgeInsets.only(top: 40, left: 32, right: 32, bottom: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Icon(Icons.feed_outlined, size: 48, color: Colors.white.withOpacity(0.2)),
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
        return _buildMatchCard(item);
      case 'status':
      default:
        return _buildPostCard(item);
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
    final courtName = item['courtName']?.toString() ?? 'Unknown Court';
    final matchStatus = item['matchStatus']?.toString() ?? '';
    final createdAt = item['createdAt'];
    // For match results, we often get a score
    final matchScore = item['matchScore']?.toString(); // e.g. "21-18" or null

    String timeAgo = _formatTimeAgo(createdAt);

    final statusColor = matchStatus == 'ended' ? Colors.green : Colors.orange;
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
                      Text(userName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      Text('played at $courtName', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
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
                  Icon(Icons.emoji_events_outlined, color: statusColor.withOpacity(0.8), size: 28),
                ],
              ),
            ),
          ],
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
    }
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
    // Improved extraction logic
    final rawContent = content.trim();
    final courtName = post['courtName']?.toString() ?? 
                     (rawContent.startsWith('@') ? rawContent.substring(1).trim() : null);
    
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
        final schedDate = DateTime.parse(scheduledAt.toString());
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
        scheduledDate = DateTime.parse(scheduledAt.toString());
        final now = DateTime.now();
        final isToday = scheduledDate!.year == now.year && scheduledDate!.month == now.month && scheduledDate!.day == now.day;
        final isTomorrow = scheduledDate!.year == now.year && scheduledDate!.month == now.month && scheduledDate!.day == now.day + 1;
        final hour = scheduledDate!.hour > 12 ? scheduledDate!.hour - 12 : scheduledDate!.hour;
        final amPm = scheduledDate!.hour >= 12 ? 'pm' : 'am';
        
        if (isToday) {
          scheduledDayStr = 'Today';
        } else if (isTomorrow) {
          scheduledDayStr = 'Tomorrow';
        } else {
          scheduledDayStr = '${scheduledDate!.month}/${scheduledDate!.day}';
        }
        
        if (scheduledDate!.minute == 0) {
            scheduledTimeStr = '$hour$amPm';
        } else {
            scheduledTimeStr = '$hour:${scheduledDate!.minute.toString().padLeft(2, '0')}$amPm';
        }
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8), // Compact margin
      decoration: isScheduledEvent 
          ? BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.4),
                  blurRadius: 10,
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
        child: CustomPaint(
          painter: isScheduledEvent ? BasketballCourtPainter() : null,
          child: Stack(
        children: [
          // Pin icon in upper left corner for scheduled runs
          if (isScheduledEvent)
            Positioned(
              top: 0,
              left: 0,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.grey.shade700.withOpacity(0.6),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomRight: Radius.circular(8),
                  ),
                ),
                child: Icon(Icons.push_pin, size: 12, color: Colors.white.withOpacity(0.7)),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(10), // More compact padding
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with avatar and name
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(1.5), // Thinner border
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: isScheduledEvent 
                          ? [Colors.white, Colors.white.withOpacity(0.7)] // White border
                          : [Colors.deepOrange, Colors.deepOrange.withOpacity(0.5)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: CircleAvatar(
                    radius: 18, // Slightly smaller avatar
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
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              userName, 
                              style: TextStyle(
                                fontWeight: FontWeight.bold, 
                                fontSize: 14, 
                                color: Colors.white,
                                shadows: isScheduledEvent ? [Shadow(color: Colors.black.withOpacity(0.6), blurRadius: 3, offset: const Offset(0, 1))] : null,
                              ), 
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isScheduledEvent) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2), 
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: Colors.black, width: 1.0), // Black border
                              ),
                              child: const Text(
                                'SCHEDULED RUN', 
                                style: TextStyle(
                                  fontSize: 8, 
                                  fontWeight: FontWeight.bold, 
                                  color: Colors.black, // Black text
                                )
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2), // Tighter spacing
                      if (!isScheduledEvent)
                        Text(
                          timeAgo, 
                          style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
                        )
                      else
                        Text(
                          timeAgo, 
                          style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
                        ),
                    ],
                  ),
                ),
                // Compact "IN" Button for Scheduled Events (Top Right)
                if (isScheduledEvent)
                  GestureDetector(
                    onTap: () => _toggleAttending(statusId, isAttending, attendeeCount),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isAttending ? Colors.white : const Color(0xFF00C853), // Green fill for JOIN, White for IN
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 4, offset: const Offset(0, 2))],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isAttending ? Icons.check : Icons.add_rounded, 
                            color: isAttending ? Colors.black : Colors.white, // Black check, White +
                            size: isAttending ? 14 : 16, 
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isAttending ? "IN ($attendeeCount)" : "JOIN ($attendeeCount)",
                            style: TextStyle(
                              color: isAttending ? Colors.black : Colors.white, // White text on Green button
                              fontWeight: FontWeight.bold,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Icon(Icons.more_horiz, color: Colors.white.withOpacity(0.2), size: 18),
              ],
            ),
            
            // Scheduled Run Details - Centered with larger font
            if (isScheduledEvent)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 4, bottom: 0),
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.25), 
                  borderRadius: BorderRadius.circular(8), // Boxy
                  border: Border.all(color: Colors.white.withOpacity(0.8), width: 2), // Interior court lines
                ),
                child: Text(
                  courtName != null 
                    ? '$scheduledDayStr, $scheduledTimeStr @$courtName'
                    : '$scheduledDayStr, $scheduledTimeStr',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15, // Slightly larger base for readability
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            
            // Regular Content (for non-scheduled events)
            if (content.isNotEmpty && !isScheduledEvent)
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 4), // Tighter padding
                child: Text(
                  content, 
                  style: TextStyle(fontSize: 14, height: 1.3, color: Colors.white.withOpacity(0.9)), // Slightly smaller font
                ),
              ),
              
            // Image if present
            // Video display (if present)
            if (post['videoUrl'] != null && post['videoUrl'].toString().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
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
            // Image display (if no video)
            else if (imageUrl != null && imageUrl.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: imageUrl.startsWith('data:')
                    ? Image.memory(
                        Uri.parse(imageUrl).data!.contentAsBytes(),
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: 180,
                        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                      )
                    : Image.network(
                        imageUrl,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: 180,
                        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                      ),
                ),
              ),
            
            // Interaction Bar (Like, Comment)
            const SizedBox(height: 10), // Reduced spacing
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(
                children: [
                  // Like Button
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => _toggleLike(statusId, isLiked, likeCount),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                        child: Row(
                          children: [
                            Icon(
                              isLiked ? Icons.favorite : Icons.favorite_border_rounded,
                              size: 18, // Smaller icon
                              color: isLiked ? Colors.redAccent : Colors.grey[500],
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '$likeCount',
                              style: TextStyle(
                                color: isLiked ? Colors.redAccent : Colors.grey[500],
                                fontSize: 12, // Smaller font
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  
                  // Comment Button
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => _toggleComments(statusId),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                        child: Row(
                          children: [
                            Icon(
                              Icons.chat_bubble_outline_rounded,
                              size: 18,
                              color: isExpanded ? Colors.blue : Colors.grey[500],
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '$commentCount',
                              style: TextStyle(
                                color: isExpanded ? Colors.blue : Colors.grey[500],
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  
                  // Timestamp for scheduled events (since it was replaced in header)
                  if (isScheduledEvent) ...[
                    const Spacer(),
                    Text(
                      'Posted $timeAgo', 
                      style: TextStyle(
                        color: Colors.white, 
                        fontSize: 10,
                        shadows: [Shadow(color: Colors.black.withOpacity(0.6), blurRadius: 2, offset: const Offset(0, 1))],
                      ),
                    ),
                  ] else ...[
                     const Spacer(),
                     // Share Button (Visual only)
                     Icon(Icons.share_outlined, color: Colors.grey[600], size: 18),
                  ],
                  
                  // Delete Button (only for own posts)
                  if (isOwnPost) ...[
                    const SizedBox(width: 12),
                    GestureDetector(
                      onTap: () => _confirmDeletePost(statusId),
                      child: Icon(
                        Icons.delete_outline, 
                        color: isScheduledEvent ? Colors.white : Colors.grey[600], 
                        size: 18,
                        shadows: isScheduledEvent ? [Shadow(color: Colors.black.withOpacity(0.6), blurRadius: 2)] : null,
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

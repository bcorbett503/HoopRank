import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../state/check_in_state.dart';
import '../services/api_service.dart';

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

    return RefreshIndicator(
      onRefresh: () => _loadFeed(filter: 'all'),
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 100),
        itemCount: _statusPosts.length,
        itemBuilder: (context, index) => _buildFeedItemCard(_statusPosts[index]),
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
    final courtItems = _statusPosts.where((item) {
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
                  Text(
                    'Following ${followedCourts.length} court${followedCourts.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
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
            // Header showing followed courts count
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  const Icon(Icons.location_on, color: Colors.blue, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Following ${followedCourts.length} court${followedCourts.length == 1 ? '' : 's'} • ${courtItems.length} update${courtItems.length == 1 ? '' : 's'}',
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
                    backgroundImage: userPhotoUrl != null ? NetworkImage(userPhotoUrl) : null,
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
                  backgroundImage: userPhotoUrl != null ? NetworkImage(userPhotoUrl) : null,
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
    final userName = post['userName']?.toString() ?? 'Unknown';
    final userPhotoUrl = post['userPhotoUrl']?.toString();
    final content = post['content']?.toString() ?? '';
    final imageUrl = post['imageUrl']?.toString();
    final scheduledAt = post['scheduledAt'];
    // Improved extraction logic
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
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E), 
        borderRadius: BorderRadius.circular(16),
        border: isScheduledEvent 
            ? Border.all(color: Colors.green.withOpacity(0.5), width: 1.5) // Distinct green border for scheduled
            : Border.all(color: Colors.white.withOpacity(0.05)),
        boxShadow: [
          BoxShadow(
            color: isScheduledEvent 
                ? Colors.green.withOpacity(0.1) // Subtle green glow
                : Colors.black.withOpacity(0.1),
            blurRadius: isScheduledEvent ? 8 : 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12), // Compact padding
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
                          ? [Colors.green, Colors.green.withOpacity(0.5)]
                          : [Colors.deepOrange, Colors.deepOrange.withOpacity(0.5)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: CircleAvatar(
                    radius: 18, // Slightly smaller avatar
                    backgroundColor: Colors.grey[900],
                    backgroundImage: userPhotoUrl != null ? NetworkImage(userPhotoUrl) : null,
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
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white), // Slightly smaller font
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isScheduledEvent) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: Colors.green.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('SCHEDULED', style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.green)),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2), // Tighter spacing
                      if (isScheduledEvent)
                        // Context Line: Visual Box inside header
                        Container(
                          margin: const EdgeInsets.only(top: 2),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.green.withOpacity(0.3), width: 1),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.calendar_today_outlined, size: 10, color: Colors.greenAccent),
                              const SizedBox(width: 4),
                              Flexible(
                                child: RichText(
                                  text: TextSpan(
                                    style: TextStyle(color: Colors.greenAccent.withOpacity(0.9), fontSize: 11, fontWeight: FontWeight.w500),
                                    children: [
                                      TextSpan(text: '$scheduledDayStr, '), 
                                      TextSpan(text: scheduledTimeStr),
                                      if (courtName != null) ...[
                                        const TextSpan(text: ' @'),
                                        TextSpan(text: courtName, style: const TextStyle(fontWeight: FontWeight.bold)),
                                      ]
                                    ],
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                              ),
                            ],
                          ),
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
                        color: isAttending ? Colors.green : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.green, width: 1),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isAttending ? Icons.check : Icons.add,
                            color: isAttending ? Colors.white : Colors.green,
                            size: 12,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isAttending ? "IN ($attendeeCount)" : (attendeeCount > 0 ? "JOIN ($attendeeCount)" : "JOIN"),
                            style: TextStyle(
                              color: isAttending ? Colors.white : Colors.green,
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
            
            // Content
            if (content.isNotEmpty && (courtName == null || content != '@$courtName'))
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 4), // Tighter padding
                child: Text(
                  content, 
                  style: TextStyle(fontSize: 14, height: 1.3, color: Colors.white.withOpacity(0.9)), // Slightly smaller font
                ),
              ),
              
            // Image if present
            if (imageUrl != null && imageUrl.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: 180, // Reduced height
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
                      style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 10),
                    ),
                  ] else ...[
                     const Spacer(),
                     // Share Button (Visual only)
                     Icon(Icons.share_outlined, color: Colors.grey[600], size: 18),
                  ]
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
                                  ? NetworkImage(comment['userPhotoUrl']) 
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

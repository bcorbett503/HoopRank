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
      if (feed.isNotEmpty) {
        debugPrint('FEED: First item type=${feed.first['type']}');
      }
      if (mounted) {
        setState(() {
          _statusPosts = feed;
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
          margin: const EdgeInsets.only(bottom: 12),
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
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            dividerColor: Colors.transparent,
            tabs: const [
              Tab(text: 'All'),
              Tab(text: 'Courts'),
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

    // Filter to only show court-related items
    final courtItems = _statusPosts.where((item) => 
      item['type'] == 'checkin' || item['type'] == 'match'
    ).toList();

    if (courtItems.isEmpty) {
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

    return RefreshIndicator(
      onRefresh: () => _loadFeed(filter: 'courts'),
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 100),
        itemCount: courtItems.length,
        itemBuilder: (context, index) => _buildFeedItemCard(courtItems[index]),
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

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: Colors.blue.withOpacity(0.08),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.blue.withOpacity(0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: Colors.blue,
              backgroundImage: userPhotoUrl != null ? NetworkImage(userPhotoUrl) : null,
              child: userPhotoUrl == null
                  ? Text(userName.isNotEmpty ? userName[0].toUpperCase() : '?',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 14, color: Colors.white),
                      children: [
                        TextSpan(text: userName, style: const TextStyle(fontWeight: FontWeight.w600)),
                        const TextSpan(text: ' checked in at '),
                        TextSpan(text: courtName, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.blue)),
                      ],
                    ),
                  ),
                  if (timeAgo.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(timeAgo, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                    ),
                ],
              ),
            ),
            const Icon(Icons.location_on, color: Colors.blue, size: 20),
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

    String timeAgo = _formatTimeAgo(createdAt);

    final statusColor = matchStatus == 'ended' ? Colors.green : Colors.orange;
    final statusText = matchStatus == 'ended' ? 'Completed' : (matchStatus == 'live' ? 'Live' : 'Waiting');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: statusColor.withOpacity(0.08),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: statusColor.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: statusColor,
              backgroundImage: userPhotoUrl != null ? NetworkImage(userPhotoUrl) : null,
              child: userPhotoUrl == null
                  ? Text(userName.isNotEmpty ? userName[0].toUpperCase() : '?',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 14, color: Colors.white),
                      children: [
                        TextSpan(text: userName, style: const TextStyle(fontWeight: FontWeight.w600)),
                        const TextSpan(text: ' played at '),
                        TextSpan(text: courtName, style: TextStyle(fontWeight: FontWeight.w600, color: statusColor)),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(statusText, style: TextStyle(fontSize: 10, color: statusColor, fontWeight: FontWeight.bold)),
                        ),
                        if (timeAgo.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Text(timeAgo, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.sports_basketball, color: statusColor, size: 20),
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
    String scheduledTimeStr = '';
    if (isScheduledEvent) {
      try {
        final schedDate = DateTime.parse(scheduledAt.toString());
        final now = DateTime.now();
        final isToday = schedDate.year == now.year && schedDate.month == now.month && schedDate.day == now.day;
        final isTomorrow = schedDate.year == now.year && schedDate.month == now.month && schedDate.day == now.day + 1;
        final hour = schedDate.hour > 12 ? schedDate.hour - 12 : schedDate.hour;
        final amPm = schedDate.hour >= 12 ? 'PM' : 'AM';
        if (isToday) {
          scheduledTimeStr = 'Today at $hour:${schedDate.minute.toString().padLeft(2, '0')} $amPm';
        } else if (isTomorrow) {
          scheduledTimeStr = 'Tomorrow at $hour:${schedDate.minute.toString().padLeft(2, '0')} $amPm';
        } else {
          scheduledTimeStr = '${schedDate.month}/${schedDate.day} at $hour:${schedDate.minute.toString().padLeft(2, '0')} $amPm';
        }
      } catch (_) {}
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: isScheduledEvent ? Colors.green.withOpacity(0.08) : Colors.white.withOpacity(0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isScheduledEvent ? BorderSide(color: Colors.green.withOpacity(0.3)) : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with avatar and name
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: isScheduledEvent ? Colors.green : Colors.deepOrange,
                  backgroundImage: userPhotoUrl != null ? NetworkImage(userPhotoUrl) : null,
                  child: userPhotoUrl == null
                      ? Text(userName.isNotEmpty ? userName[0].toUpperCase() : '?',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(userName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      if (timeAgo.isNotEmpty)
                        Text(timeAgo, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                    ],
                  ),
                ),
                if (isScheduledEvent)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.event, size: 14, color: Colors.green),
                        const SizedBox(width: 4),
                        Text(scheduledTimeStr, style: const TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            // Content
            Text(content, style: const TextStyle(fontSize: 14)),
            // Image if present
            if (imageUrl != null && imageUrl.isNotEmpty) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  imageUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: 200,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ],
            const SizedBox(height: 10),
            
            // "I'm IN" button for scheduled events
            if (isScheduledEvent) ...[
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _toggleAttending(statusId, isAttending, attendeeCount),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: isAttending ? Colors.green : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.green, width: 2),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              isAttending ? Icons.check_circle : Icons.add_circle_outline,
                              color: isAttending ? Colors.white : Colors.green,
                              size: 20,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              isAttending ? "I'M IN!" : "I'M IN",
                              style: TextStyle(
                                color: isAttending ? Colors.white : Colors.green,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            if (attendeeCount > 0) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isAttending ? Colors.white.withOpacity(0.2) : Colors.green.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '$attendeeCount going',
                                  style: TextStyle(
                                    color: isAttending ? Colors.white : Colors.green,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
            
            // Like/Comment action row
            Row(
              children: [
                // Like button
                GestureDetector(
                  onTap: () => _toggleLike(statusId, isLiked, likeCount),
                  child: Row(
                    children: [
                      Icon(
                        isLiked ? Icons.favorite : Icons.favorite_border,
                        size: 20,
                        color: isLiked ? Colors.red : Colors.grey[400],
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '$likeCount',
                        style: TextStyle(color: Colors.grey[400], fontSize: 13),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 20),
                // Comment button
                GestureDetector(
                  onTap: () => _toggleComments(statusId),
                  child: Row(
                    children: [
                      Icon(
                        Icons.chat_bubble_outline,
                        size: 18,
                        color: isExpanded ? Colors.blue : Colors.grey[400],
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '$commentCount',
                        style: TextStyle(color: Colors.grey[400], fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            // Expanded comments section
            if (isExpanded) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Existing comments
                    if (comments.isEmpty)
                      Text('No comments yet', style: TextStyle(color: Colors.grey[500], fontSize: 12))
                    else
                      ...comments.map((comment) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 12,
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
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    comment['userName'] ?? 'User',
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                                  ),
                                  Text(
                                    comment['content'] ?? '',
                                    style: const TextStyle(fontSize: 12),
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

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../services/court_service.dart';

/// Activity item for display in the Followed Courts feed
class CourtActivity {
  final String courtId;
  final String courtName;
  final String type; // 'check_in' or 'match'
  final String description;
  final DateTime timestamp;
  final String? playerId;
  final String? playerName;
  final String? playerPhotoUrl;
  final Map<String, dynamic>? matchData;

  CourtActivity({
    required this.courtId,
    required this.courtName,
    required this.type,
    required this.description,
    required this.timestamp,
    this.playerId,
    this.playerName,
    this.playerPhotoUrl,
    this.matchData,
  });

  String get timeAgo {
    final diff = DateTime.now().difference(timestamp);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'just now';
  }
}

/// Represents a followed court with its recent activity for display
class FollowedCourtInfo {
  final String courtId;
  final String courtName;
  final String? address;
  final int checkInCount;
  final List<CourtActivity> recentActivity;
  final DateTime? lastActivityTime;

  FollowedCourtInfo({
    required this.courtId,
    required this.courtName,
    this.address,
    required this.checkInCount,
    required this.recentActivity,
    this.lastActivityTime,
  });
}

/// Represents a player's status/availability message
class PlayerStatus {
  final String playerId;
  final String playerName;
  final String? photoUrl;
  final String status;
  final DateTime updatedAt;

  PlayerStatus({
    required this.playerId,
    required this.playerName,
    this.photoUrl,
    required this.status,
    required this.updatedAt,
  });

  String get timeAgo {
    final diff = DateTime.now().difference(updatedAt);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'just now';
  }
}

/// Activity item for display in the Followed Players feed
class PlayerActivity {
  final String playerId;
  final String type; // 'status', 'check_in', or 'match'
  final String description;
  final DateTime timestamp;
  final String? icon;
  final Map<String, dynamic>? matchData;

  PlayerActivity({
    required this.playerId,
    required this.type,
    required this.description,
    required this.timestamp,
    this.icon,
    this.matchData,
  });

  String get timeAgo {
    final diff = DateTime.now().difference(timestamp);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'just now';
  }
}

/// Represents a followed player with their profile and recent activity for display
class FollowedPlayerInfo {
  final String playerId;
  final String name;
  final String? photoUrl;
  final double rating;
  final String? currentStatus;
  final List<PlayerActivity> recentActivity;
  final DateTime? lastActivityTime;

  FollowedPlayerInfo({
    required this.playerId,
    required this.name,
    this.photoUrl,
    required this.rating,
    this.currentStatus,
    required this.recentActivity,
    this.lastActivityTime,
  });
}

/// Manages court check-in and follow state
class CheckInState extends ChangeNotifier {
  // Map of courtId -> list of checked-in players
  final Map<String, List<CheckedInPlayer>> _courtCheckIns = {};
  
  // Set of court IDs the current user has checked into
  final Set<String> _userCheckedInCourts = {};
  
  // Set of court IDs the current user follows
  final Set<String> _followedCourts = {};
  
  // Set of court IDs the current user has alerts enabled for (push notifications)
  final Set<String> _alertCourts = {};
  
  // Set of player IDs the current user follows
  final Set<String> _followedPlayers = {};
  
  // Map of player ID -> their current status (what they're up to)
  final Map<String, PlayerStatus> _playerStatuses = {};
  
  // Current user ID (set on login)
  String? _currentUserId;
  
  /// Initialize with mock data for demo purposes
  Future<void> initialize(String? userId) async {
    _currentUserId = userId;
    
    // Load user's persisted data from local cache first
    await _loadUserCheckIns();
    await _loadFollowedCourts();
    await _loadAlertCourts();
    await _loadFollowedPlayers();
    
    // Then sync with backend API (will overwrite local data if successful)
    await _syncFollowsFromApi();
    
    // Add mock check-in data for popular courts
    _addMockCheckIns();
    
    notifyListeners();
  }
  
  /// Sync follows from backend API (overwrites local cache on success)
  Future<void> _syncFollowsFromApi() async {
    if (_currentUserId == null) return;
    try {
      final data = await ApiService.getFollows();
      
      // Update courts
      final courts = data['courts'] as List? ?? [];
      _followedCourts.clear();
      _alertCourts.clear();
      for (final c in courts) {
        final courtId = c['courtId'] as String?;
        final alertsEnabled = c['alertsEnabled'] as bool? ?? false;
        if (courtId != null) {
          _followedCourts.add(courtId);
          if (alertsEnabled) _alertCourts.add(courtId);
        }
      }
      
      // Update players
      final players = data['players'] as List? ?? [];
      _followedPlayers.clear();
      for (final p in players) {
        final playerId = p['playerId'] as String?;
        if (playerId != null) {
          _followedPlayers.add(playerId);
        }
      }
      
      // Save to local cache
      await _saveFollowedCourts();
      await _saveAlertCourts();
      await _saveFollowedPlayers();
      
      debugPrint('Synced follows from API: ${_followedCourts.length} courts, ${_followedPlayers.length} players');
    } catch (e) {
      debugPrint('Error syncing follows from API (using local cache): $e');
    }
  }
  
  /// Load user's check-ins from SharedPreferences
  Future<void> _loadUserCheckIns() async {
    if (_currentUserId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'user_${_currentUserId}_checked_in_courts';
      final checkedInCourts = prefs.getStringList(key) ?? [];
      _userCheckedInCourts.addAll(checkedInCourts);
    } catch (e) {
      debugPrint('Error loading check-ins: $e');
    }
  }
  
  /// Save user's check-ins to SharedPreferences
  Future<void> _saveUserCheckIns() async {
    if (_currentUserId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'user_${_currentUserId}_checked_in_courts';
      await prefs.setStringList(key, _userCheckedInCourts.toList());
    } catch (e) {
      debugPrint('Error saving check-ins: $e');
    }
  }
  
  /// Load followed courts from SharedPreferences
  Future<void> _loadFollowedCourts() async {
    if (_currentUserId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'user_${_currentUserId}_followed_courts';
      final followed = prefs.getStringList(key) ?? [];
      _followedCourts.addAll(followed);
    } catch (e) {
      debugPrint('Error loading followed courts: $e');
    }
  }
  
  /// Save followed courts to SharedPreferences
  Future<void> _saveFollowedCourts() async {
    if (_currentUserId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'user_${_currentUserId}_followed_courts';
      await prefs.setStringList(key, _followedCourts.toList());
    } catch (e) {
      debugPrint('Error saving followed courts: $e');
    }
  }
  
  /// Load alert courts from SharedPreferences
  Future<void> _loadAlertCourts() async {
    if (_currentUserId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'user_${_currentUserId}_alert_courts';
      final alerts = prefs.getStringList(key) ?? [];
      _alertCourts.addAll(alerts);
    } catch (e) {
      debugPrint('Error loading alert courts: $e');
    }
  }
  
  /// Save alert courts to SharedPreferences
  Future<void> _saveAlertCourts() async {
    if (_currentUserId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'user_${_currentUserId}_alert_courts';
      await prefs.setStringList(key, _alertCourts.toList());
    } catch (e) {
      debugPrint('Error saving alert courts: $e');
    }
  }
  
  /// Add mock check-in data for demo
  void _addMockCheckIns() {
    final now = DateTime.now();
    
    // Olympic Club - several demo players
    _courtCheckIns['olympic_club_sf'] = [
      CheckedInPlayer(
        id: 'demo_player_1',
        name: 'Marcus Johnson',
        rating: 4.85,
        photoUrl: null,
        checkedInAt: now.subtract(const Duration(hours: 2)),
      ),
      CheckedInPlayer(
        id: 'demo_player_2',
        name: 'DeShawn Williams',
        rating: 4.72,
        photoUrl: null,
        checkedInAt: now.subtract(const Duration(hours: 5)),
      ),
      CheckedInPlayer(
        id: 'demo_player_3',
        name: 'Anthony Davis',
        rating: 4.68,
        photoUrl: null,
        checkedInAt: now.subtract(const Duration(days: 1)),
      ),
      CheckedInPlayer(
        id: 'demo_player_4',
        name: 'Jordan Mitchell',
        rating: 4.45,
        photoUrl: null,
        checkedInAt: now.subtract(const Duration(days: 2)),
      ),
    ];
    
    // Add a few more courts with demo check-ins
    _courtCheckIns['node/123456789'] = [
      CheckedInPlayer(
        id: 'demo_player_5',
        name: 'Chris Thompson',
        rating: 4.52,
        photoUrl: null,
        checkedInAt: now.subtract(const Duration(hours: 8)),
      ),
      CheckedInPlayer(
        id: 'demo_player_6',
        name: 'Kevin Park',
        rating: 4.31,
        photoUrl: null,
        checkedInAt: now.subtract(const Duration(days: 1)),
      ),
    ];
  }
  
  // ==================== CHECK-IN METHODS ====================
  
  /// Check if a court has any check-ins (for green border)
  /// Check if a court has any check-ins (for green border)
  bool hasCheckIns(String courtId) {
    final players = _courtCheckIns[courtId];
    return players != null && players.isNotEmpty;
  }
  
  /// Get all court IDs that currently have check-ins (for Active filter)
  Set<String> get activeCourts => _courtCheckIns.keys.where((courtId) {
    final players = _courtCheckIns[courtId];
    return players != null && players.isNotEmpty;
  }).toSet();
  
  /// Get number of players checked in at a court
  int getCheckInCount(String courtId) {
    return _courtCheckIns[courtId]?.length ?? 0;
  }
  
  /// Get list of players checked in at a court, sorted by rating (descending)
  List<CheckedInPlayer> getCheckedInPlayers(String courtId) {
    final players = _courtCheckIns[courtId] ?? [];
    return List.from(players)
      ..sort((a, b) => b.rating.compareTo(a.rating));
  }
  
  /// Check if current user is checked in at a court
  bool isUserCheckedIn(String courtId) {
    return _userCheckedInCourts.contains(courtId);
  }
  
  /// Check in current user at a court
  Future<void> checkIn(String courtId, {
    required String userName,
    required double userRating,
    String? userPhotoUrl,
  }) async {
    if (_currentUserId == null) return;
    if (_userCheckedInCourts.contains(courtId)) return;
    
    _userCheckedInCourts.add(courtId);
    
    final player = CheckedInPlayer(
      id: _currentUserId!,
      name: userName,
      rating: userRating,
      photoUrl: userPhotoUrl,
      checkedInAt: DateTime.now(),
    );
    
    if (_courtCheckIns.containsKey(courtId)) {
      _courtCheckIns[courtId]!.add(player);
    } else {
      _courtCheckIns[courtId] = [player];
    }
    
    await _saveUserCheckIns();
    notifyListeners();
  }
  
  /// Check out current user from a court
  Future<void> checkOut(String courtId) async {
    if (_currentUserId == null) return;
    
    _userCheckedInCourts.remove(courtId);
    _courtCheckIns[courtId]?.removeWhere((p) => p.id == _currentUserId);
    
    if (_courtCheckIns[courtId]?.isEmpty ?? false) {
      _courtCheckIns.remove(courtId);
    }
    
    await _saveUserCheckIns();
    notifyListeners();
  }
  
  /// Get all courts the current user is checked into
  Set<String> get userCheckedInCourts => Set.unmodifiable(_userCheckedInCourts);
  
  // ==================== FOLLOW METHODS ====================
  
  /// Check if current user follows a court
  bool isFollowing(String courtId) {
    return _followedCourts.contains(courtId);
  }
  
  /// Follow a court
  Future<void> followCourt(String courtId) async {
    if (_followedCourts.contains(courtId)) return;
    
    _followedCourts.add(courtId);
    await _saveFollowedCourts();
    notifyListeners();
    
    // Sync to backend
    ApiService.followCourt(courtId, alertsEnabled: _alertCourts.contains(courtId));
  }
  
  /// Unfollow a court
  Future<void> unfollowCourt(String courtId) async {
    _followedCourts.remove(courtId);
    await _saveFollowedCourts();
    notifyListeners();
    
    // Sync to backend
    ApiService.unfollowCourt(courtId);
  }
  
  /// Toggle follow status for a court
  Future<void> toggleFollow(String courtId) async {
    if (isFollowing(courtId)) {
      await unfollowCourt(courtId);
    } else {
      await followCourt(courtId);
    }
  }
  
  /// Get all followed courts
  Set<String> get followedCourts => Set.unmodifiable(_followedCourts);
  
  /// Get number of followed courts
  int get followedCourtCount => _followedCourts.length;
  
  // ==================== ALERT METHODS ====================
  
  /// Check if current user has alerts enabled for a court
  bool isAlertEnabled(String courtId) {
    return _alertCourts.contains(courtId);
  }
  
  /// Enable alerts for a court (get push notifications on check-ins/games)
  Future<void> enableAlert(String courtId) async {
    if (_alertCourts.contains(courtId)) return;
    
    _alertCourts.add(courtId);
    await _saveAlertCourts();
    notifyListeners();
    
    // Sync to backend
    ApiService.setCourtAlert(courtId, true);
  }
  
  /// Disable alerts for a court
  Future<void> disableAlert(String courtId) async {
    _alertCourts.remove(courtId);
    await _saveAlertCourts();
    notifyListeners();
    
    // Sync to backend
    ApiService.setCourtAlert(courtId, false);
  }
  
  /// Toggle alert status for a court
  Future<void> toggleAlert(String courtId) async {
    if (isAlertEnabled(courtId)) {
      await disableAlert(courtId);
    } else {
      await enableAlert(courtId);
    }
  }
  
  /// Get all courts with alerts enabled
  Set<String> get alertCourts => Set.unmodifiable(_alertCourts);
  
  
  /// Get names of followed courts for display
  List<String> getFollowedCourtNames() {
    final courtService = CourtService();
    return _followedCourts.map((courtId) {
      final court = courtService.getCourtById(courtId);
      return court?.name ?? 'Unknown Court';
    }).toList();
  }
  
  /// Get activity feed for followed courts (check-ins and matches)
  List<CourtActivity> getFollowedCourtActivity() {
    final activities = <CourtActivity>[];
    final courtService = CourtService();
    
    for (final courtId in _followedCourts) {
      // Get court name
      final court = courtService.getCourtById(courtId);
      final courtName = court?.name ?? 'Unknown Court';
      
      // Add check-in activities
      final checkIns = _courtCheckIns[courtId] ?? [];
      for (final player in checkIns) {
        activities.add(CourtActivity(
          courtId: courtId,
          courtName: courtName,
          type: 'check_in',
          description: '${player.name} checked in',
          timestamp: player.checkedInAt,
          playerId: player.id,
          playerName: player.name,
          playerPhotoUrl: player.photoUrl,
        ));
      }
    }
    
    // Sort by timestamp (most recent first)
    activities.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    
    // Limit to most recent 20 activities
    return activities.take(20).toList();
  }
  
  /// Get followed courts with their activity, sorted by most recent activity
  Future<List<FollowedCourtInfo>> getFollowedCourtsWithActivity() async {
    final courtService = CourtService();
    await courtService.loadCourts(); // Ensure courts are loaded before lookup
    final courts = <FollowedCourtInfo>[];
    
    for (final courtId in _followedCourts) {
      final court = courtService.getCourtById(courtId);
      final courtName = court?.name ?? 'Unknown Court';

      final checkIns = _courtCheckIns[courtId] ?? [];
      
      // Build activity list for this court
      final activity = <CourtActivity>[];
      for (final player in checkIns) {
        activity.add(CourtActivity(
          courtId: courtId,
          courtName: courtName,
          type: 'check_in',
          description: '${player.name} checked in',
          timestamp: player.checkedInAt,
          playerId: player.id,
          playerName: player.name,
          playerPhotoUrl: player.photoUrl,
        ));
      }
      
      // Sort activity by most recent
      activity.sort((a, b) => b.timestamp.compareTo(a.timestamp));
      
      // Get most recent activity time
      final lastActivity = activity.isNotEmpty ? activity.first.timestamp : null;
      
      courts.add(FollowedCourtInfo(
        courtId: courtId,
        courtName: courtName,
        address: court?.address,
        checkInCount: checkIns.length,
        recentActivity: activity.take(3).toList(), // Show up to 3 recent activities
        lastActivityTime: lastActivity,
      ));
    }
    
    // Sort by most recent activity (courts with activity first, then by time)
    courts.sort((a, b) {
      if (a.lastActivityTime == null && b.lastActivityTime == null) return 0;
      if (a.lastActivityTime == null) return 1;
      if (b.lastActivityTime == null) return -1;
      return b.lastActivityTime!.compareTo(a.lastActivityTime!);
    });
    
    return courts;
  }
  
  // ==================== FOLLOW PLAYER METHODS ====================
  
  /// Load followed players from SharedPreferences
  Future<void> _loadFollowedPlayers() async {
    if (_currentUserId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'user_${_currentUserId}_followed_players';
      final followed = prefs.getStringList(key) ?? [];
      _followedPlayers.addAll(followed);
    } catch (e) {
      debugPrint('Error loading followed players: $e');
    }
  }
  
  /// Save followed players to SharedPreferences
  Future<void> _saveFollowedPlayers() async {
    if (_currentUserId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'user_${_currentUserId}_followed_players';
      await prefs.setStringList(key, _followedPlayers.toList());
    } catch (e) {
      debugPrint('Error saving followed players: $e');
    }
  }
  
  /// Check if current user follows a player
  bool isFollowingPlayer(String playerId) {
    return _followedPlayers.contains(playerId);
  }
  
  /// Follow a player
  Future<void> followPlayer(String playerId) async {
    if (playerId == _currentUserId) return; // Can't follow yourself
    if (_followedPlayers.contains(playerId)) return;
    
    _followedPlayers.add(playerId);
    await _saveFollowedPlayers();
    notifyListeners();
    
    // Sync to backend
    ApiService.followPlayer(playerId);
  }
  
  /// Unfollow a player
  Future<void> unfollowPlayer(String playerId) async {
    if (!_followedPlayers.contains(playerId)) return;
    
    _followedPlayers.remove(playerId);
    await _saveFollowedPlayers();
    notifyListeners();
    
    // Sync to backend
    ApiService.unfollowPlayer(playerId);
  }
  
  /// Toggle follow status for a player
  Future<void> toggleFollowPlayer(String playerId) async {
    if (isFollowingPlayer(playerId)) {
      await unfollowPlayer(playerId);
    } else {
      await followPlayer(playerId);
    }
  }
  
  /// Get all followed players
  Set<String> get followedPlayers => Set.unmodifiable(_followedPlayers);
  
  /// Get number of followed players
  int get followedPlayerCount => _followedPlayers.length;
  
  /// Get a player's name by ID (from any available source)
  String getPlayerName(String playerId) {
    // Check if there's a status with this player
    if (_playerStatuses.containsKey(playerId)) {
      return _playerStatuses[playerId]!.playerName;
    }
    // Check checked-in players
    for (final players in _courtCheckIns.values) {
      final player = players.firstWhere(
        (p) => p.id == playerId,
        orElse: () => CheckedInPlayer(
          id: '', name: '', rating: 0, checkedInAt: DateTime.now(),
        ),
      );
      if (player.id.isNotEmpty) {
        return player.name;
      }
    }
    return 'Unknown Player';
  }
  
  /// Set current user's status
  Future<void> setMyStatus(String status, {required String userName, String? photoUrl}) async {
    if (_currentUserId == null) return;
    
    _playerStatuses[_currentUserId!] = PlayerStatus(
      playerId: _currentUserId!,
      playerName: userName,
      photoUrl: photoUrl,
      status: status,
      updatedAt: DateTime.now(),
    );
    
    // Save status to prefs
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_${_currentUserId}_status', status);
      await prefs.setString('user_${_currentUserId}_status_time', DateTime.now().toIso8601String());
    } catch (e) {
      debugPrint('Error saving status: $e');
    }
    
    notifyListeners();
  }
  
  /// Clear current user's status
  Future<void> clearMyStatus() async {
    if (_currentUserId == null) return;
    
    _playerStatuses.remove(_currentUserId);
    
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('user_${_currentUserId}_status');
      await prefs.remove('user_${_currentUserId}_status_time');
    } catch (e) {
      debugPrint('Error clearing status: $e');
    }
    
    notifyListeners();
  }
  
  /// Get the current user's status
  String? getMyStatus() {
    if (_currentUserId == null) return null;
    return _playerStatuses[_currentUserId]?.status;
  }
  
  /// Get all followed players with their statuses for display
  List<PlayerStatus> getFollowedPlayerStatuses() {
    final statuses = <PlayerStatus>[];
    
    for (final playerId in _followedPlayers) {
      final status = _playerStatuses[playerId];
      if (status != null) {
        statuses.add(status);
      }
    }
    
    // Sort by most recent update
    statuses.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    
    return statuses;
  }
  
  /// Get all followed players with their recent activities (status, check-ins, matches)
  /// Returns a list of FollowedPlayerInfo objects ready for display
  Future<List<FollowedPlayerInfo>> getFollowedPlayersInfo() async {
    final List<FollowedPlayerInfo> players = [];
    
    for (final playerId in _followedPlayers) {
      try {
        // Fetch player profile from API
        final profile = await ApiService.getProfile(playerId);
        if (profile == null) continue;
        
        final name = profile['name']?.toString() ?? 'Unknown';
        final photoUrl = profile['photoUrl']?.toString() ?? profile['avatar_url']?.toString();
        final rating = (profile['rating'] is num)
            ? (profile['rating'] as num).toDouble()
            : double.tryParse(profile['rating']?.toString() ?? '') ?? 3.0;
        
        // Build activity list
        final List<PlayerActivity> activities = [];
        
        // 1. Check for status update
        final status = _playerStatuses[playerId];
        if (status != null) {
          activities.add(PlayerActivity(
            playerId: playerId,
            type: 'status',
            description: status.status,
            timestamp: status.updatedAt,
            icon: '💬',
          ));
        }
        
        // 2. Check for court check-ins (find courts where this player is checked in)
        for (final entry in _courtCheckIns.entries) {
          final courtId = entry.key;
          final checkedInPlayers = entry.value;
          for (final pip in checkedInPlayers) {
            if (pip.id == playerId) {
              final court = CourtService().getCourtById(courtId);
              final courtName = court?.name ?? 'a court';
              activities.add(PlayerActivity(
                playerId: playerId,
                type: 'check_in',
                description: 'Checked in at $courtName',
                timestamp: pip.checkedInAt,
                icon: '📍',
              ));
            }
          }
        }
        
        // 3. Get recent matches from profile (if available)
        final recentMatches = profile['recentMatches'] as List<dynamic>? ?? [];
        for (final match in recentMatches.take(3)) {
          if (match is Map<String, dynamic>) {
            final createdAt = match['createdAt'] != null
                ? DateTime.tryParse(match['createdAt'].toString()) ?? DateTime.now()
                : DateTime.now();
            final opponentName = _extractOpponentName(match, playerId);
            final score = _formatMatchScore(match, playerId);
            activities.add(PlayerActivity(
              playerId: playerId,
              type: 'match',
              description: 'Played $opponentName $score',
              timestamp: createdAt,
              icon: '🏀',
              matchData: match,
            ));
          }
        }
        
        // Sort activities by timestamp (most recent first)
        activities.sort((a, b) => b.timestamp.compareTo(a.timestamp));
        
        // Get most recent activity time
        final lastActivity = activities.isNotEmpty ? activities.first.timestamp : null;
        
        players.add(FollowedPlayerInfo(
          playerId: playerId,
          name: name,
          photoUrl: photoUrl,
          rating: rating,
          currentStatus: status?.status,
          recentActivity: activities.take(3).toList(), // Max 3 activities
          lastActivityTime: lastActivity,
        ));
      } catch (e) {
        debugPrint('Error fetching player info for $playerId: $e');
      }
    }
    
    // Sort by most recent activity (players with activity first)
    players.sort((a, b) {
      if (a.lastActivityTime == null && b.lastActivityTime == null) return 0;
      if (a.lastActivityTime == null) return 1;
      if (b.lastActivityTime == null) return -1;
      return b.lastActivityTime!.compareTo(a.lastActivityTime!);
    });
    
    return players;
  }
  
  /// Helper to extract opponent name from match data
  String _extractOpponentName(Map<String, dynamic> match, String playerId) {
    final player1 = match['player1'] as Map<String, dynamic>?;
    final player2 = match['player2'] as Map<String, dynamic>?;
    
    if (player1?['id'] == playerId) {
      return player2?['name']?.toString() ?? 'opponent';
    } else {
      return player1?['name']?.toString() ?? 'opponent';
    }
  }
  
  /// Helper to format match score from match data
  String _formatMatchScore(Map<String, dynamic> match, String playerId) {
    final score = match['score'] as Map<String, dynamic>?;
    if (score == null) return '';
    
    final player1Score = score['player1'] ?? 0;
    final player2Score = score['player2'] ?? 0;
    final winnerId = match['winnerId']?.toString();
    
    final player1 = match['player1'] as Map<String, dynamic>?;
    
    if (player1?['id'] == playerId) {
      final result = winnerId == playerId ? 'W' : 'L';
      return '($player1Score-$player2Score) $result';
    } else {
      final result = winnerId == playerId ? 'W' : 'L';
      return '($player2Score-$player1Score) $result';
    }
  }
}

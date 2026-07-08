import '../models.dart';

double _toDouble(dynamic value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

int _toInt(dynamic value, {int fallback = 0}) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

bool _toBool(dynamic value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    return value.toLowerCase() == 'true' || value == '1';
  }
  return fallback;
}

String? _stringOrNull(dynamic value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty || text.toLowerCase() == 'null') {
    return null;
  }
  return text;
}

class MapHubPrivacy {
  final bool pushEnabled;
  final bool publicProfile;
  final bool publicLocation;
  final bool mapVisibilityEnabled;
  final double discoverRadiusMi;
  final String discoverMode;

  const MapHubPrivacy({
    this.pushEnabled = true,
    this.publicProfile = true,
    this.publicLocation = false,
    this.mapVisibilityEnabled = false,
    this.discoverRadiusMi = 25.0,
    this.discoverMode = 'open',
  });

  factory MapHubPrivacy.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const MapHubPrivacy();
    return MapHubPrivacy(
      pushEnabled:
          _toBool(json['pushEnabled'] ?? json['push_enabled'], fallback: true),
      publicProfile: _toBool(json['publicProfile'] ?? json['public_profile'],
          fallback: true),
      publicLocation:
          _toBool(json['publicLocation'] ?? json['public_location']),
      mapVisibilityEnabled: _toBool(
        json['mapVisibilityEnabled'] ?? json['map_visibility_enabled'],
      ),
      discoverRadiusMi: _toDouble(
        json['discoverRadiusMi'] ?? json['discover_radius_mi'],
        fallback: 25.0,
      ),
      discoverMode: _stringOrNull(json['discoverMode'] ?? json['discover_mode'])
              ?.toLowerCase() ??
          'open',
    );
  }
}

class MapHubRunSummary {
  final String id;
  final String? title;
  final String gameMode;
  final DateTime? scheduledAt;
  final int maxPlayers;
  final int attendeeCount;

  const MapHubRunSummary({
    required this.id,
    this.title,
    this.gameMode = 'Run',
    this.scheduledAt,
    this.maxPlayers = 0,
    this.attendeeCount = 0,
  });

  factory MapHubRunSummary.fromJson(Map<String, dynamic> json) {
    return MapHubRunSummary(
      id: json['id']?.toString() ?? '',
      title: _stringOrNull(json['title']),
      gameMode: _stringOrNull(json['gameMode'] ?? json['game_mode']) ?? 'Run',
      scheduledAt: DateTime.tryParse(json['scheduledAt']?.toString() ?? ''),
      maxPlayers: _toInt(json['maxPlayers'] ?? json['max_players']),
      attendeeCount: _toInt(json['attendeeCount'] ?? json['attendee_count']),
    );
  }
}

class MapHubCourt {
  final Court court;
  final int activeCheckInCount;
  final int followerCount;
  final String? statusLabel;
  final MapHubRunSummary? nextRun;
  final CourtTopFollower? topFollower;

  const MapHubCourt({
    required this.court,
    this.activeCheckInCount = 0,
    this.followerCount = 0,
    this.statusLabel,
    this.nextRun,
    this.topFollower,
  });

  factory MapHubCourt.fromJson(Map<String, dynamic> json) {
    final rawRun = json['nextRun'] ?? json['next_run'];
    final rawFollower = json['topFollower'] ?? json['top_follower'];
    final topFollower = rawFollower is Map
        ? CourtTopFollower.fromJson(Map<String, dynamic>.from(rawFollower))
        : null;

    final court = Court.fromJson({
      ...json,
      'topFollower': topFollower == null
          ? null
          : {
              'id': topFollower.id,
              'name': topFollower.name,
              'photoUrl': topFollower.photoUrl,
              'rating': topFollower.rating,
            },
      'hasUpcomingRun':
          json['hasUpcomingRun'] ?? json['has_upcoming_run'] ?? false,
      'hasUpcomingActivity':
          json['hasUpcomingActivity'] ?? json['has_upcoming_activity'] ?? false,
    });

    return MapHubCourt(
      court: court,
      activeCheckInCount:
          _toInt(json['activeCheckInCount'] ?? json['active_check_in_count']),
      followerCount: _toInt(json['followerCount'] ?? json['follower_count']),
      statusLabel: _stringOrNull(json['statusLabel'] ?? json['status_label']),
      nextRun: rawRun is Map
          ? MapHubRunSummary.fromJson(Map<String, dynamic>.from(rawRun))
          : null,
      topFollower: topFollower,
    );
  }
}

class MapHubPlayer {
  final String id;
  final String name;
  final String? avatarUrl;
  final Map<String, dynamic>? avatarConfig;
  final double rating;
  final String? position;
  final String? city;
  final double lat;
  final double lng;
  final String? customStatus;
  final String statusLabel;
  final String? checkedInCourtId;
  final String? checkedInCourtName;
  final bool acceptingChallenges;
  final bool isNewPlayer;
  final bool isCurrentUser;

  const MapHubPlayer({
    required this.id,
    required this.name,
    this.avatarUrl,
    this.avatarConfig,
    this.rating = 3.0,
    this.position,
    this.city,
    required this.lat,
    required this.lng,
    this.customStatus,
    this.statusLabel = 'Available nearby',
    this.checkedInCourtId,
    this.checkedInCourtName,
    this.acceptingChallenges = true,
    this.isNewPlayer = false,
    this.isCurrentUser = false,
  });

  factory MapHubPlayer.fromJson(Map<String, dynamic> json) {
    final rawConfig = json['avatarConfig'] ?? json['avatar_config'];
    return MapHubPlayer(
      id: json['id']?.toString() ?? '',
      name: _stringOrNull(json['name']) ?? 'Player',
      avatarUrl: _stringOrNull(json['avatarUrl'] ?? json['avatar_url']),
      avatarConfig:
          rawConfig is Map ? Map<String, dynamic>.from(rawConfig) : null,
      rating: _toDouble(json['rating'] ?? json['hoop_rank'], fallback: 3.0),
      position: _stringOrNull(json['position']),
      city: _stringOrNull(json['city']),
      lat: _toDouble(json['lat']),
      lng: _toDouble(json['lng']),
      customStatus:
          _stringOrNull(json['customStatus'] ?? json['custom_status']),
      statusLabel: _stringOrNull(json['statusLabel'] ?? json['status_label']) ??
          'Available nearby',
      checkedInCourtId: _stringOrNull(
          json['checkedInCourtId'] ?? json['checked_in_court_id']),
      checkedInCourtName: _stringOrNull(
          json['checkedInCourtName'] ?? json['checked_in_court_name']),
      acceptingChallenges: json['acceptingChallenges'] == null &&
              json['accepting_challenges'] == null
          ? true
          : _toBool(
              json['acceptingChallenges'] ?? json['accepting_challenges']),
      isNewPlayer: _toBool(json['isNewPlayer'] ?? json['is_new_player']),
      isCurrentUser: _toBool(json['isCurrentUser'] ?? json['is_current_user']),
    );
  }
}

class MapHubData {
  final MapHubPrivacy privacy;
  final List<MapHubCourt> courts;
  final List<MapHubPlayer> players;

  const MapHubData({
    required this.privacy,
    required this.courts,
    required this.players,
  });

  factory MapHubData.fromJson(Map<String, dynamic> json) {
    return MapHubData(
      privacy: MapHubPrivacy.fromJson(json['privacy'] is Map
          ? Map<String, dynamic>.from(json['privacy'])
          : null),
      courts: (json['courts'] is List ? json['courts'] as List : const [])
          .whereType<Map>()
          .map((item) => MapHubCourt.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      players: (json['players'] is List ? json['players'] as List : const [])
          .whereType<Map>()
          .map((item) => MapHubPlayer.fromJson(Map<String, dynamic>.from(item)))
          .where((player) => player.id.isNotEmpty)
          .toList(),
    );
  }
}

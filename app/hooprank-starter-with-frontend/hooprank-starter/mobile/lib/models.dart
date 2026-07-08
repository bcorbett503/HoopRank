// =============================================================================
// HoopRank Data Models
// =============================================================================
import 'package:flutter/foundation.dart'; // for debugPrint
// This file defines the core data models used throughout the application.
//
// Model Hierarchy:
//   User (base) - Authenticated identity with social/competitive stats
//   └── Player  - Extends User with athletic profile details
//
// The API primarily returns User objects. Player objects are used when
// detailed athletic stats (offense, defense, etc.) are needed for UI display.
// =============================================================================

/// Resilient number parsing helper
/// Handles both num and String values from backend responses
double _parseDouble(dynamic value, {double fallback = 0.0}) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

int _parseInt(dynamic value, {int fallback = 0}) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

String? _firstNonEmptyString(List<dynamic> values) {
  for (final value in values) {
    final text = value?.toString().trim();
    if (text == null || text.isEmpty || text.toLowerCase() == 'null') {
      continue;
    }
    return text;
  }
  return null;
}

/// Base identity model representing an authenticated user
/// This is the primary model returned by API endpoints
class User {
  final String id;
  final String name;
  final String? photoUrl;
  final String? team; // Used as zipcode/location fallback
  final String? position; // 'G', 'F', 'C'
  final double rating;
  final double? distanceMi;
  final int matchesPlayed;
  final String? height;
  final int wins;
  final int losses;
  final String? city;
  // Community rating / contest tracking
  final int gamesPlayed;
  final int gamesContested;
  final double contestRate;
  final int? age;
  final List<String> badges;
  final Map<String, dynamic>? avatarConfig;
  final bool acceptingChallenges;
  final bool locEnabled;
  final double? lat;
  final double? lng;

  User({
    required this.id,
    required this.name,
    this.photoUrl,
    this.team,
    this.position,
    this.rating = 3.0,
    this.distanceMi,
    this.matchesPlayed = 0,
    this.height,
    this.wins = 0,
    this.losses = 0,
    this.city,
    this.gamesPlayed = 0,
    this.gamesContested = 0,
    this.contestRate = 0.0,
    this.age,
    this.badges = const [],
    this.avatarConfig,
    this.acceptingChallenges = true,
    this.locEnabled = false,
    this.lat,
    this.lng,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    final id = json['id']?.toString() ?? '';
    if (id.isEmpty) {
      throw const FormatException('User id cannot be null or empty');
    }

    final gamesPlayed = _parseInt(json['gamesPlayed'] ?? json['games_played']);
    final gamesContested =
        _parseInt(json['gamesContested'] ?? json['games_contested']);
    final rawContestRate = json['contestRate'] ?? json['contest_rate'];
    final contestRate = rawContestRate != null
        ? _parseDouble(rawContestRate)
        : (gamesPlayed > 0 ? gamesContested.toDouble() / gamesPlayed : 0.0);

    // Handle both camelCase (app) and snake_case (production backend) field names
    final position = json['position']?.toString();
    final rawBadges = json['badges'];
    final parsedBadges = rawBadges is List
        ? rawBadges.map((e) => e.toString()).toList()
        : <String>[];
    final rawAvatarConfig = json['avatarConfig'] ?? json['avatar_config'];

    debugPrint(
        'USER.fromJson: id=$id, json[position]=${json['position']}, parsed position=$position');
    return User(
      id: id,
      name: json['name']?.toString() ??
          json['display_name']?.toString() ??
          'Unknown',
      photoUrl: _firstNonEmptyString([
        json['photoUrl'],
        json['photo_url'],
        json['avatarUrl'],
        json['avatar_url'],
        json['avatar'],
        json['profilePictureUrl'],
        json['profile_picture_url'],
      ]),
      team: json['team']?.toString(),
      position: position,
      rating: _parseDouble(json['rating'] ?? json['hoop_rank'], fallback: 3.0),
      distanceMi: (() {
        final rawDistance = json['distanceMi'] ??
            json['distance_mi'] ??
            json['distanceMiles'] ??
            json['distance_miles'];
        if (rawDistance == null) return null;
        return _parseDouble(rawDistance);
      })(),
      matchesPlayed: _parseInt(json['matchesPlayed'] ?? json['matches_played']),
      height: json['height']?.toString(),
      wins: _parseInt(json['wins']),
      losses: _parseInt(json['losses']),
      city: json['city']?.toString(),
      gamesPlayed: gamesPlayed,
      gamesContested: gamesContested,
      contestRate: contestRate,
      age: json['age'] != null ? _parseInt(json['age']) : null,
      badges: parsedBadges,
      avatarConfig: rawAvatarConfig is Map
          ? Map<String, dynamic>.from(rawAvatarConfig)
          : null,
      acceptingChallenges: json['acceptingChallenges'] == null &&
              json['accepting_challenges'] == null
          ? true
          : json['acceptingChallenges'] == true ||
              json['accepting_challenges'] == true ||
              json['acceptingChallenges'] == 1 ||
              json['accepting_challenges'] == 1,
      locEnabled: json['locEnabled'] == true ||
          json['loc_enabled'] == true ||
          json['locEnabled'] == 1 ||
          json['loc_enabled'] == 1,
      lat: json['lat'] == null ? null : _parseDouble(json['lat']),
      lng: json['lng'] == null ? null : _parseDouble(json['lng']),
    );
  }

  /// Convert User to a full Player with default athletic stats
  Player toPlayer({
    String? slug,
    int age = 25,
    String weight = '180 lbs',
    double offense = 75,
    double defense = 75,
    double shooting = 75,
    double passing = 75,
    double rebounding = 75,
  }) {
    return Player(
      id: id,
      slug: slug ?? id,
      name: name,
      team: team ?? city ?? 'Free Agent',
      position: position ?? 'G',
      age: age,
      height: height ?? '6\'0"',
      weight: weight,
      city: city,
      rating: rating,
      offense: offense,
      defense: defense,
      shooting: shooting,
      passing: passing,
      rebounding: rebounding,
      badges: badges,
    );
  }

  /// Check if the user has completed profile setup
  /// Profile is considered complete when they have set their position
  bool get isProfileComplete => position != null && position!.isNotEmpty;

  @override
  String toString() => 'User(id: $id, name: $name, rating: $rating)';
}

/// Extended player model with full athletic profile
/// Used for match setup, detailed profile views, and mock data
class Player {
  final String id;
  final String slug;
  final String name;
  final String team;
  final String position; // 'G', 'F', 'C'
  final int age;
  final String height;
  final String weight;
  final String? city;
  final double rating;
  final double offense;
  final double defense;
  final double shooting;
  final double passing;
  final double rebounding;
  final List<String> badges;

  Player({
    required this.id,
    required this.slug,
    required this.name,
    required this.team,
    required this.position,
    required this.age,
    required this.height,
    required this.weight,
    this.city,
    required this.rating,
    required this.offense,
    required this.defense,
    required this.shooting,
    required this.passing,
    required this.rebounding,
    this.badges = const [],
  });

  /// Create Player from JSON with resilient parsing
  factory Player.fromJson(Map<String, dynamic> json) {
    return Player(
      id: json['id']?.toString() ?? '',
      slug: json['slug']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unknown',
      team: json['team']?.toString() ?? 'Free Agent',
      position: json['position']?.toString() ?? 'G',
      age: _parseInt(json['age'], fallback: 25),
      height: json['height']?.toString() ?? '6\'0"',
      weight: json['weight']?.toString() ?? '180 lbs',
      city: json['city']?.toString() ??
          json['zip']
              ?.toString(), // Fallback to zip if city is missing in existing JSON
      rating: _parseDouble(json['rating'], fallback: 3.0),
      offense: _parseDouble(json['offense'], fallback: 75),
      defense: _parseDouble(json['defense'], fallback: 75),
      shooting: _parseDouble(json['shooting'], fallback: 75),
      passing: _parseDouble(json['passing'], fallback: 75),
      rebounding: _parseDouble(json['rebounding'], fallback: 75),
    );
  }

  /// Convert to a lightweight User object (for API compatibility)
  User toUser() {
    return User(
      id: id,
      name: name,
      position: position,
      rating: rating,
      height: height,
      team: team,
    );
  }

  @override
  String toString() => 'Player(id: $id, name: $name, rating: $rating)';
}

/// Match record from the database
class Match {
  final String id;
  final String challengerId;
  final String opponentId;
  final String
      status; // 'pending', 'accepted', 'completed', 'waiting', 'live', 'ended'
  final DateTime? scheduledAt;
  final String? courtId;
  final String? winnerId;
  final double? ratingDelta;

  Match({
    required this.id,
    required this.challengerId,
    required this.opponentId,
    required this.status,
    this.scheduledAt,
    this.courtId,
    this.winnerId,
    this.ratingDelta,
  });
}

/// Represents a player checked in at a court
class CheckedInPlayer {
  final String id;
  final String name;
  final double rating;
  final String? photoUrl;
  final DateTime checkedInAt;

  CheckedInPlayer({
    required this.id,
    required this.name,
    required this.rating,
    this.photoUrl,
    required this.checkedInAt,
  });

  /// Returns how long ago the player checked in as a human-readable string
  String get checkedInAgo {
    final diff = DateTime.now().difference(checkedInAt);
    if (diff.inDays > 0) {
      return '${diff.inDays}d ago';
    } else if (diff.inHours > 0) {
      return '${diff.inHours}h ago';
    } else if (diff.inMinutes > 0) {
      return '${diff.inMinutes}m ago';
    } else {
      return 'just now';
    }
  }
}

/// Top-ranked follower at a court, used as the map's featured "king" avatar.
class CourtTopFollower {
  final String id;
  final String name;
  final String? photoUrl;
  final double rating;

  const CourtTopFollower({
    required this.id,
    required this.name,
    this.photoUrl,
    this.rating = 0.0,
  });

  factory CourtTopFollower.fromJson(Map<String, dynamic> json) {
    return CourtTopFollower(
      id: _firstNonEmptyString([
            json['id'],
            json['userId'],
            json['topFollowerId'],
            json['top_follower_id'],
          ]) ??
          '',
      name: _firstNonEmptyString([
            json['name'],
            json['userName'],
            json['topFollowerName'],
            json['top_follower_name'],
          ]) ??
          'Unknown',
      photoUrl: _firstNonEmptyString([
        json['photoUrl'],
        json['photo_url'],
        json['avatarUrl'],
        json['avatar_url'],
        json['topFollowerPhotoUrl'],
        json['top_follower_photo_url'],
      ]),
      rating: _parseDouble(
        json['rating'] ??
            json['hoop_rank'] ??
            json['topFollowerRating'] ??
            json['top_follower_rating'],
      ),
    );
  }
}

/// Basketball court location with Kings for each game mode
class Court {
  final String id;
  final String name;
  final double lat;
  final double lng;
  final String? address;
  final bool isSignature; // Signature courts are high-traffic/famous venues
  final bool isIndoor; // Indoor venues (gyms, schools, rec centers)
  final String access; // 'public', 'members', or 'paid'
  final String?
      venueType; // 'school', 'college', 'rec_center', 'gym', 'outdoor', 'other'
  final String? imageUrl; // Hero image for court cards/details
  final String? imageSourceUrl; // Attribution/source page for the hero image
  final String? imageSourceLabel; // Human label for the image source
  final int? followerCount; // Number of users following this court
  // King of the Court for each mode (name, rating, and user ID for challenges)
  final String? king1v1;
  final String? king1v1Id;
  final double? king1v1Rating;
  final String? king3v3;
  final String? king3v3Id;
  final double? king3v3Rating;
  final String? king5v5;
  final String? king5v5Id;
  final double? king5v5Rating;
  final CourtTopFollower? topFollower;
  final bool hasUpcomingRun;
  final bool hasUpcomingActivity;

  Court({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    this.address,
    this.isSignature = false,
    this.isIndoor = false,
    this.access = 'public',
    this.venueType,
    this.imageUrl,
    this.imageSourceUrl,
    this.imageSourceLabel,
    this.followerCount = 0,
    this.king1v1,
    this.king1v1Id,
    this.king1v1Rating,
    this.king3v3,
    this.king3v3Id,
    this.king3v3Rating,
    this.king5v5,
    this.king5v5Id,
    this.king5v5Rating,
    this.topFollower,
    this.hasUpcomingRun = false,
    this.hasUpcomingActivity = false,
  });

  /// Legacy getter for backwards compatibility
  String? get king => king1v1;

  /// Check if court has any Kings
  bool get hasKings => king1v1 != null || king3v3 != null || king5v5 != null;

  /// Ranked follower shown as the featured map avatar.
  bool get hasTopFollower => topFollower != null;

  /// Copy with method to update king data from API
  Court copyWithKings({
    String? king1v1,
    String? king1v1Id,
    double? king1v1Rating,
    String? king3v3,
    String? king3v3Id,
    double? king3v3Rating,
    String? king5v5,
    String? king5v5Id,
    double? king5v5Rating,
    int? followerCount,
    String? imageUrl,
    String? imageSourceUrl,
    String? imageSourceLabel,
    CourtTopFollower? topFollower,
    bool? hasUpcomingRun,
    bool? hasUpcomingActivity,
  }) {
    return Court(
      id: id,
      name: name,
      lat: lat,
      lng: lng,
      address: address,
      isSignature: isSignature,
      isIndoor: isIndoor,
      access: access,
      venueType: venueType,
      imageUrl: imageUrl ?? this.imageUrl,
      imageSourceUrl: imageSourceUrl ?? this.imageSourceUrl,
      imageSourceLabel: imageSourceLabel ?? this.imageSourceLabel,
      followerCount: followerCount ?? this.followerCount,
      king1v1: king1v1 ?? this.king1v1,
      king1v1Id: king1v1Id ?? this.king1v1Id,
      king1v1Rating: king1v1Rating ?? this.king1v1Rating,
      king3v3: king3v3 ?? this.king3v3,
      king3v3Id: king3v3Id ?? this.king3v3Id,
      king3v3Rating: king3v3Rating ?? this.king3v3Rating,
      king5v5: king5v5 ?? this.king5v5,
      king5v5Id: king5v5Id ?? this.king5v5Id,
      king5v5Rating: king5v5Rating ?? this.king5v5Rating,
      topFollower: topFollower ?? this.topFollower,
      hasUpcomingRun: hasUpcomingRun ?? this.hasUpcomingRun,
      hasUpcomingActivity: hasUpcomingActivity ?? this.hasUpcomingActivity,
    );
  }

  factory Court.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic>? topFollowerJson;
    final rawTopFollower = json['topFollower'];
    if (rawTopFollower is Map) {
      topFollowerJson = Map<String, dynamic>.from(rawTopFollower);
    } else {
      final flatTopFollowerId = _firstNonEmptyString(
          [json['topFollowerId'], json['top_follower_id']]);
      if (flatTopFollowerId != null) {
        topFollowerJson = {
          'id': flatTopFollowerId,
          'name': json['topFollowerName'] ?? json['top_follower_name'],
          'photoUrl':
              json['topFollowerPhotoUrl'] ?? json['top_follower_photo_url'],
          'rating': json['topFollowerRating'] ?? json['top_follower_rating'],
        };
      }
    }

    return Court(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unknown Court',
      lat: _parseDouble(json['lat']),
      lng: _parseDouble(json['lng']),
      address: _firstNonEmptyString([json['address'], json['city']]),
      isSignature: json['signature'] == true || json['isSignature'] == true,
      isIndoor: json['indoor'] == true || json['isIndoor'] == true,
      access: json['access']?.toString() ?? 'public',
      venueType:
          json['venue_type']?.toString() ?? json['venueType']?.toString(),
      imageUrl: _firstNonEmptyString([
        json['imageUrl'],
        json['image_url'],
        json['heroImageUrl'],
        json['hero_image_url'],
      ]),
      imageSourceUrl: _firstNonEmptyString([
        json['imageSourceUrl'],
        json['image_source_url'],
        json['photoSourceUrl'],
        json['photo_source_url'],
      ]),
      imageSourceLabel: _firstNonEmptyString([
        json['imageSourceLabel'],
        json['image_source_label'],
        json['photoSourceLabel'],
        json['photo_source_label'],
      ]),
      followerCount: _parseInt(json['follower_count'] ?? json['followerCount']),
      king1v1: json['king1v1']?.toString() ?? json['king']?.toString(),
      king1v1Id: json['king1v1Id']?.toString(),
      king1v1Rating: json['king1v1Rating'] != null
          ? _parseDouble(json['king1v1Rating'])
          : null,
      king3v3: json['king3v3']?.toString(),
      king3v3Id: json['king3v3Id']?.toString(),
      king3v3Rating: json['king3v3Rating'] != null
          ? _parseDouble(json['king3v3Rating'])
          : null,
      king5v5: json['king5v5']?.toString(),
      king5v5Id: json['king5v5Id']?.toString(),
      king5v5Rating: json['king5v5Rating'] != null
          ? _parseDouble(json['king5v5Rating'])
          : null,
      topFollower: topFollowerJson == null
          ? null
          : CourtTopFollower.fromJson(topFollowerJson),
      hasUpcomingRun:
          json['hasUpcomingRun'] == true || json['has_upcoming_run'] == true,
      hasUpcomingActivity: json['hasUpcomingActivity'] == true ||
          json['has_upcoming_activity'] == true,
    );
  }
}

/// Represents a user who follows ("hearts") a court.
/// Includes their global 1v1 HoopRank # when available.
class CourtFollower {
  final String id;
  final String name;
  final String? photoUrl;
  final double rating;
  final int? rank;

  CourtFollower({
    required this.id,
    required this.name,
    this.photoUrl,
    required this.rating,
    this.rank,
  });

  factory CourtFollower.fromJson(Map<String, dynamic> json) {
    final rawRank = json['rank'];
    int? rank;
    if (rawRank is num) {
      rank = rawRank.toInt();
    } else if (rawRank is String) {
      rank = int.tryParse(rawRank);
    }

    return CourtFollower(
      id: json['id']?.toString() ?? json['userId']?.toString() ?? '',
      name:
          json['name']?.toString() ?? json['userName']?.toString() ?? 'Unknown',
      photoUrl: json['photoUrl']?.toString() ??
          json['avatar_url']?.toString() ??
          json['userPhotoUrl']?.toString(),
      rating: _parseDouble(json['rating'] ?? json['hoop_rank'], fallback: 0.0),
      rank: rank,
    );
  }
}

/// Represents a user attending a scheduled run
class RunAttendee {
  final String id;
  final String name;
  final String? photoUrl;

  RunAttendee({
    required this.id,
    required this.name,
    this.photoUrl,
  });

  factory RunAttendee.fromJson(Map<String, dynamic> json) {
    return RunAttendee(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unknown',
      photoUrl: json['photoUrl']?.toString(),
    );
  }
}

/// Scheduled pickup run at a court
class ScheduledRun {
  final String id;
  final String courtId;
  final String? courtName;
  final String? courtCity;
  final double? courtLat;
  final double? courtLng;
  final String createdBy;
  final String creatorName;
  final String? creatorPhotoUrl;
  final String? title;
  final String gameMode; // '3v3', '5v5'
  final String? courtType; // 'full' or 'half'
  final String? ageRange; // '18+', '21+', '30+', '40+', '50+', 'open'
  final DateTime scheduledAt;
  final int durationMinutes;
  final int maxPlayers;
  final String? notes;
  final DateTime createdAt;
  final int attendeeCount;
  final bool isAttending;
  final List<RunAttendee> attendees;
  final bool isRecurring;
  final String? recurrenceRule;

  ScheduledRun({
    required this.id,
    required this.courtId,
    this.courtName,
    this.courtCity,
    this.courtLat,
    this.courtLng,
    required this.createdBy,
    required this.creatorName,
    this.creatorPhotoUrl,
    this.title,
    required this.gameMode,
    this.courtType,
    this.ageRange,
    required this.scheduledAt,
    this.durationMinutes = 120,
    this.maxPlayers = 10,
    this.notes,
    required this.createdAt,
    this.attendeeCount = 0,
    this.isAttending = false,
    this.attendees = const [],
    this.isRecurring = false,
    this.recurrenceRule,
  });

  /// Get relative time string for display
  /// Note: scheduledAt is treated as an absolute UTC timestamp and converted to the
  /// user's local timezone for accurate display.
  String get timeString {
    final now = DateTime.now();
    final localScheduled = scheduledAt.toLocal();

    if (isRecurring) {
      final dayName = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ][localScheduled.weekday - 1];
      return 'Every $dayName ${_formatTime(localScheduled)}';
    }

    final diff = localScheduled.difference(now);

    if (diff.isNegative) return 'Past';

    final todayDate = DateTime(now.year, now.month, now.day);
    final runDate =
        DateTime(localScheduled.year, localScheduled.month, localScheduled.day);
    final calendarDiff = runDate.difference(todayDate).inDays;

    if (calendarDiff == 0) {
      if (diff.inHours < 1 && diff.inMinutes >= 0) {
        return 'In ${diff.inMinutes}m';
      }
      return 'Today ${_formatTime(localScheduled)}';
    } else if (calendarDiff == 1) {
      return 'Tomorrow ${_formatTime(localScheduled)}';
    } else if (calendarDiff < 7) {
      final dayName = [
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
        'Sat',
        'Sun'
      ][localScheduled.weekday - 1];
      return '$dayName ${_formatTime(localScheduled)}';
    } else {
      return '${localScheduled.month}/${localScheduled.day} ${_formatTime(localScheduled)}';
    }
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final period = dt.hour >= 12 ? 'pm' : 'am';
    return '$hour:${dt.minute.toString().padLeft(2, '0')}$period';
  }

  /// Check if run is almost full
  bool get isAlmostFull => attendeeCount >= maxPlayers - 2;
  bool get isFull => attendeeCount >= maxPlayers;

  /// Display label for court type
  String? get courtTypeLabel {
    if (courtType == 'full') return 'Full Court';
    if (courtType == 'half') return 'Half Court';
    return null;
  }

  factory ScheduledRun.fromJson(Map<String, dynamic> json) {
    return ScheduledRun(
      id: json['id']?.toString() ?? '',
      courtId: json['courtId']?.toString() ?? '',
      courtName: json['courtName']?.toString(),
      courtCity: json['courtCity']?.toString(),
      courtLat:
          json['courtLat'] != null ? _parseDouble(json['courtLat']) : null,
      courtLng:
          json['courtLng'] != null ? _parseDouble(json['courtLng']) : null,
      createdBy: json['createdBy']?.toString() ?? '',
      creatorName: json['creatorName']?.toString() ?? 'Unknown',
      creatorPhotoUrl: json['creatorPhotoUrl']?.toString(),
      title: json['title']?.toString(),
      gameMode: json['gameMode']?.toString() ?? '5v5',
      courtType: json['courtType']?.toString(),
      ageRange: json['ageRange']?.toString(),
      scheduledAt: (() {
        String dtString = json['scheduledAt']?.toString() ?? '';
        if (dtString.isNotEmpty && !dtString.endsWith('Z')) {
          dtString += 'Z';
        }
        return DateTime.tryParse(dtString) ?? DateTime.now();
      })(),
      durationMinutes: _parseInt(json['durationMinutes'], fallback: 120),
      maxPlayers: _parseInt(json['maxPlayers'], fallback: 10),
      notes: json['notes']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      attendeeCount: _parseInt(json['attendeeCount']),
      isAttending: json['isAttending'] == true,
      isRecurring: json['isRecurring'] == true,
      recurrenceRule: json['recurrenceRule']?.toString(),
      attendees: (json['attendees'] as List<dynamic>?)
              ?.map((a) => RunAttendee.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class CalendarCourtInfo {
  final String? id;
  final String? name;
  final String? city;
  final String? address;
  final double? lat;
  final double? lng;

  const CalendarCourtInfo({
    this.id,
    this.name,
    this.city,
    this.address,
    this.lat,
    this.lng,
  });

  factory CalendarCourtInfo.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const CalendarCourtInfo();
    }

    return CalendarCourtInfo(
      id: json['id']?.toString() ?? json['courtId']?.toString(),
      name: json['name']?.toString() ?? json['courtName']?.toString(),
      city: json['city']?.toString() ?? json['courtCity']?.toString(),
      address: _firstNonEmptyString([
        json['address'],
        json['courtAddress'],
        json['city'],
        json['courtCity'],
      ]),
      lat: json['lat'] != null || json['courtLat'] != null
          ? _parseDouble(json['lat'] ?? json['courtLat'])
          : null,
      lng: json['lng'] != null || json['courtLng'] != null
          ? _parseDouble(json['lng'] ?? json['courtLng'])
          : null,
    );
  }
}

class CalendarParticipantInfo {
  final String id;
  final String name;
  final String? photoUrl;

  const CalendarParticipantInfo({
    required this.id,
    required this.name,
    this.photoUrl,
  });

  factory CalendarParticipantInfo.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const CalendarParticipantInfo(id: '', name: 'Unknown');
    }

    return CalendarParticipantInfo(
      id: json['id']?.toString() ?? json['userId']?.toString() ?? '',
      name: json['name']?.toString() ??
          json['displayName']?.toString() ??
          json['display_name']?.toString() ??
          'Unknown',
      photoUrl: _firstNonEmptyString([
        json['photoUrl'],
        json['photo_url'],
        json['avatarUrl'],
        json['avatar_url'],
      ]),
    );
  }
}

class CalendarRunDetails {
  final String runId;
  final int? statusId;
  final String gameMode;
  final String? courtType;
  final String? ageRange;
  final int durationMinutes;
  final int maxPlayers;
  final int attendeeCount;
  final bool isRecurring;
  final String? recurrenceRule;
  final String? notes;
  final CalendarParticipantInfo creator;
  final List<RunAttendee> attendeePreview;
  final String occurrenceKey;

  const CalendarRunDetails({
    required this.runId,
    this.statusId,
    required this.gameMode,
    this.courtType,
    this.ageRange,
    required this.durationMinutes,
    required this.maxPlayers,
    required this.attendeeCount,
    required this.isRecurring,
    this.recurrenceRule,
    this.notes,
    required this.creator,
    required this.attendeePreview,
    required this.occurrenceKey,
  });

  factory CalendarRunDetails.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const CalendarRunDetails(
        runId: '',
        gameMode: '5v5',
        durationMinutes: 120,
        maxPlayers: 15,
        attendeeCount: 0,
        isRecurring: false,
        creator: CalendarParticipantInfo(id: '', name: 'Unknown'),
        attendeePreview: [],
        occurrenceKey: '',
      );
    }

    return CalendarRunDetails(
      runId: (json['runId'] ?? json['run_id'] ?? json['id'])?.toString() ?? '',
      statusId: json['statusId'] != null || json['status_id'] != null
          ? _parseInt(json['statusId'] ?? json['status_id'])
          : null,
      gameMode: (json['gameMode'] ?? json['game_mode'])?.toString() ?? '5v5',
      courtType: (json['courtType'] ?? json['court_type'])?.toString(),
      ageRange: (json['ageRange'] ?? json['age_range'])?.toString(),
      durationMinutes: _parseInt(
        json['durationMinutes'] ?? json['duration_minutes'],
        fallback: 120,
      ),
      maxPlayers: _parseInt(
        json['maxPlayers'] ?? json['max_players'],
        fallback: 15,
      ),
      attendeeCount: _parseInt(json['attendeeCount'] ?? json['attendee_count']),
      isRecurring: json['isRecurring'] == true || json['is_recurring'] == true,
      recurrenceRule:
          (json['recurrenceRule'] ?? json['recurrence_rule'])?.toString(),
      notes: json['notes']?.toString(),
      creator: CalendarParticipantInfo.fromJson(
        json['creator'] as Map<String, dynamic>?,
      ),
      attendeePreview:
          ((json['attendeePreview'] ?? json['attendees']) as List<dynamic>?)
                  ?.map((a) => RunAttendee.fromJson(
                        Map<String, dynamic>.from(a as Map),
                      ))
                  .toList() ??
              const [],
      occurrenceKey:
          (json['occurrenceKey'] ?? json['occurrence_key'])?.toString() ?? '',
    );
  }

  bool get isFull => attendeeCount >= maxPlayers;
  bool get isAlmostFull => attendeeCount >= maxPlayers - 2;

  String? get courtTypeLabel {
    if (courtType == 'full') return 'Full Court';
    if (courtType == 'half') return 'Half Court';
    return null;
  }
}

class CalendarScheduledMatchDetails {
  final String matchId;
  final String challengeId;
  final String viewerRole;
  final String visibility;
  final String? message;
  final CalendarParticipantInfo creator;
  final CalendarParticipantInfo opponent;

  const CalendarScheduledMatchDetails({
    required this.matchId,
    required this.challengeId,
    required this.viewerRole,
    required this.visibility,
    this.message,
    required this.creator,
    required this.opponent,
  });

  factory CalendarScheduledMatchDetails.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const CalendarScheduledMatchDetails(
        matchId: '',
        challengeId: '',
        viewerRole: 'observer',
        visibility: 'followed_and_nearby',
        creator: CalendarParticipantInfo(id: '', name: 'Unknown'),
        opponent: CalendarParticipantInfo(id: '', name: 'Unknown'),
      );
    }

    return CalendarScheduledMatchDetails(
      matchId: (json['matchId'] ?? json['match_id'])?.toString() ?? '',
      challengeId:
          (json['challengeId'] ?? json['challenge_id'])?.toString() ?? '',
      viewerRole:
          (json['viewerRole'] ?? json['viewer_role'])?.toString() ?? 'observer',
      visibility: json['visibility']?.toString() ?? 'followed_and_nearby',
      message: json['message']?.toString(),
      creator: CalendarParticipantInfo.fromJson(
        json['creator'] as Map<String, dynamic>?,
      ),
      opponent: CalendarParticipantInfo.fromJson(
        json['opponent'] as Map<String, dynamic>?,
      ),
    );
  }

  bool get isParticipant => viewerRole == 'creator' || viewerRole == 'opponent';
  bool get isCreator => viewerRole == 'creator';
  bool get isOpponent => viewerRole == 'opponent';
}

class CalendarCourtEventDetails {
  final String eventId;
  final String eventType;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String? timezone;
  final bool isRecurring;
  final String? recurrenceRule;
  final String? seriesStartsOn;
  final String? seriesEndsOn;
  final String? organizerName;
  final String? registrationUrl;
  final String? sourceUrl;
  final String? sourceTitle;
  final String? costText;
  final String? audience;
  final String? ageRange;
  final String? skillLevel;
  final String? format;
  final String? evidenceType;
  final String? confidence;
  final String? status;
  final String? notes;
  final String occurrenceKey;

  const CalendarCourtEventDetails({
    required this.eventId,
    required this.eventType,
    this.startsAt,
    this.endsAt,
    this.timezone,
    this.isRecurring = false,
    this.recurrenceRule,
    this.seriesStartsOn,
    this.seriesEndsOn,
    this.organizerName,
    this.registrationUrl,
    this.sourceUrl,
    this.sourceTitle,
    this.costText,
    this.audience,
    this.ageRange,
    this.skillLevel,
    this.format,
    this.evidenceType,
    this.confidence,
    this.status,
    this.notes,
    this.occurrenceKey = '',
  });

  factory CalendarCourtEventDetails.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const CalendarCourtEventDetails(
        eventId: '',
        eventType: 'event',
      );
    }

    DateTime? parseDateTime(dynamic value) {
      var text = value?.toString() ?? '';
      if (text.isNotEmpty && !text.endsWith('Z')) {
        text += 'Z';
      }
      return DateTime.tryParse(text);
    }

    return CalendarCourtEventDetails(
      eventId:
          (json['eventId'] ?? json['event_id'] ?? json['id'])?.toString() ?? '',
      eventType:
          (json['eventType'] ?? json['event_type'])?.toString() ?? 'event',
      startsAt: parseDateTime(json['startsAt'] ?? json['starts_at']),
      endsAt: parseDateTime(json['endsAt'] ?? json['ends_at']),
      timezone: json['timezone']?.toString(),
      isRecurring: json['isRecurring'] == true || json['is_recurring'] == true,
      recurrenceRule:
          (json['recurrenceRule'] ?? json['recurrence_rule'])?.toString(),
      seriesStartsOn:
          (json['seriesStartsOn'] ?? json['series_starts_on'])?.toString(),
      seriesEndsOn:
          (json['seriesEndsOn'] ?? json['series_ends_on'])?.toString(),
      organizerName:
          (json['organizerName'] ?? json['organizer_name'])?.toString(),
      registrationUrl:
          (json['registrationUrl'] ?? json['registration_url'])?.toString(),
      sourceUrl: (json['sourceUrl'] ?? json['source_url'])?.toString(),
      sourceTitle: (json['sourceTitle'] ?? json['source_title'])?.toString(),
      costText: (json['costText'] ?? json['cost_text'])?.toString(),
      audience: json['audience']?.toString(),
      ageRange: (json['ageRange'] ?? json['age_range'])?.toString(),
      skillLevel: (json['skillLevel'] ?? json['skill_level'])?.toString(),
      format: json['format']?.toString(),
      evidenceType: (json['evidenceType'] ?? json['evidence_type'])?.toString(),
      confidence: json['confidence']?.toString(),
      status: json['status']?.toString(),
      notes: json['notes']?.toString(),
      occurrenceKey:
          (json['occurrenceKey'] ?? json['occurrence_key'])?.toString() ?? '',
    );
  }

  String get typeLabel {
    switch (eventType) {
      case 'team_game':
        return 'GAME';
      case 'tournament':
        return 'TOURNAMENT';
      case 'league':
        return 'LEAGUE';
      case 'practice':
        return 'PRACTICE';
      case 'camp':
        return 'CAMP';
      case 'clinic':
        return 'CLINIC';
      case 'tryout':
        return 'TRYOUT';
      default:
        return 'EVENT';
    }
  }
}

class CalendarEvent {
  final String id;
  final String type;
  final DateTime scheduledAt;
  final String title;
  final double? distanceMiles;
  final bool isConfirmedByMe;
  final bool isOwnedByMe;
  final CalendarCourtInfo court;
  final CalendarRunDetails? run;
  final CalendarScheduledMatchDetails? scheduledMatch;
  final CalendarCourtEventDetails? courtEvent;

  const CalendarEvent({
    required this.id,
    required this.type,
    required this.scheduledAt,
    required this.title,
    this.distanceMiles,
    required this.isConfirmedByMe,
    required this.isOwnedByMe,
    required this.court,
    this.run,
    this.scheduledMatch,
    this.courtEvent,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    DateTime parseScheduledAt() {
      var text = (json['scheduledAt'] ??
                  json['scheduled_at'] ??
                  json['startsAt'] ??
                  json['starts_at'])
              ?.toString() ??
          '';
      if (text.isNotEmpty && !text.endsWith('Z')) {
        text += 'Z';
      }
      return DateTime.tryParse(text) ?? DateTime.now();
    }

    final type =
        (json['type'] ?? json['eventType'] ?? json['event_type'])?.toString() ??
            'event';
    final runJson = json['run'] ?? json['runDetails'] ?? json['run_details'];
    final matchJson = json['scheduledMatch'] ??
        json['scheduled_match'] ??
        json['match'] ??
        json['matchDetails'];
    final courtEventJson =
        json['courtEvent'] ?? json['court_event'] ?? json['event'];

    return CalendarEvent(
      id: json['id']?.toString() ??
          json['eventId']?.toString() ??
          '${type}_${json.hashCode}',
      type: type,
      scheduledAt: parseScheduledAt(),
      title: json['title']?.toString() ?? 'Calendar Event',
      distanceMiles: (() {
        final value = json['distanceMiles'] ?? json['distance_miles'];
        if (value == null) return null;
        return _parseDouble(value);
      })(),
      isConfirmedByMe: json['isConfirmedByMe'] == true ||
          json['is_confirmed_by_me'] == true ||
          json['isAttendingByMe'] == true,
      isOwnedByMe: json['isOwnedByMe'] == true ||
          json['is_owned_by_me'] == true ||
          json['isOwnedByMe'] == 1,
      court: CalendarCourtInfo.fromJson(
        (json['court'] is Map)
            ? Map<String, dynamic>.from(json['court'] as Map)
            : json,
      ),
      run: runJson is Map
          ? CalendarRunDetails.fromJson(Map<String, dynamic>.from(runJson))
          : null,
      scheduledMatch: matchJson is Map
          ? CalendarScheduledMatchDetails.fromJson(
              Map<String, dynamic>.from(matchJson),
            )
          : null,
      courtEvent: courtEventJson is Map
          ? CalendarCourtEventDetails.fromJson(
              Map<String, dynamic>.from(courtEventJson),
            )
          : null,
    );
  }

  bool get isRun => type == 'run' && run != null;
  bool get isScheduledMatch =>
      type == 'scheduled_match' && scheduledMatch != null;
  bool get isCourtEvent => type == 'court_event' && courtEvent != null;

  String get dayLabel {
    final local = scheduledAt.toLocal();
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return '${weekdays[local.weekday - 1]} ${local.month}/${local.day}';
  }

  String get timeLabel {
    final local = scheduledAt.toLocal();
    final hour =
        local.hour > 12 ? local.hour - 12 : (local.hour == 0 ? 12 : local.hour);
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '$hour:${local.minute.toString().padLeft(2, '0')} $period';
  }

  String get reminderKey {
    if (isScheduledMatch) {
      final challengeId = scheduledMatch!.challengeId;
      if (challengeId.isNotEmpty) return 'scheduled_match:$challengeId';
    }
    if (isRun) {
      final runId = run!.runId;
      if (runId.isNotEmpty) {
        return 'run:$runId:${scheduledAt.toUtc().toIso8601String()}';
      }
    }
    return '$type:$id';
  }
}

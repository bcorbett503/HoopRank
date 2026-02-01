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

/// Base identity model representing an authenticated user
/// This is the primary model returned by API endpoints
class User {
  final String id;
  final String name;
  final String? photoUrl;
  final String? team; // Used as zipcode/location fallback
  final String? position; // 'G', 'F', 'C'
  final double rating;
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

  User({
    required this.id,
    required this.name,
    this.photoUrl,
    this.team,
    this.position,
    this.rating = 3.0,
    this.matchesPlayed = 0,
    this.height,
    this.wins = 0,
    this.losses = 0,
    this.city,
    this.gamesPlayed = 0,
    this.gamesContested = 0,
    this.contestRate = 0.0,
    this.age,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    final id = json['id']?.toString() ?? '';
    if (id.isEmpty) {
      throw FormatException('User id cannot be null or empty');
    }

    final gamesPlayed = _parseInt(json['gamesPlayed'] ?? json['games_played']);
    final gamesContested = _parseInt(json['gamesContested'] ?? json['games_contested']);
    final contestRate = json['contestRate'] ?? json['contest_rate'] != null 
        ? _parseDouble(json['contestRate'] ?? json['contest_rate']) 
        : (gamesPlayed > 0 ? gamesContested / gamesPlayed : 0.0);

    // Handle both camelCase (app) and snake_case (production backend) field names
    final position = json['position']?.toString();
    debugPrint('USER.fromJson: id=$id, json[position]=${json['position']}, parsed position=$position');
    return User(
      id: id,
      name: json['name']?.toString() ?? json['display_name']?.toString() ?? 'Unknown',
      photoUrl: json['photoUrl']?.toString() ?? json['avatar_url']?.toString(),
      team: json['team']?.toString(),
      position: position,
      rating: _parseDouble(json['rating'] ?? json['hoop_rank'], fallback: 3.0),
      matchesPlayed: _parseInt(json['matchesPlayed'] ?? json['matches_played']),
      height: json['height']?.toString(),
      wins: _parseInt(json['wins']),
      losses: _parseInt(json['losses']),
      city: json['city']?.toString(),
      gamesPlayed: gamesPlayed,
      gamesContested: gamesContested,
      contestRate: contestRate,
      age: json['age'] != null ? _parseInt(json['age']) : null,
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
      zip: team,
      rating: rating,
      offense: offense,
      defense: defense,
      shooting: shooting,
      passing: passing,
      rebounding: rebounding,
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
  final String? zip;
  final double rating;
  final double offense;
  final double defense;
  final double shooting;
  final double passing;
  final double rebounding;

  Player({
    required this.id,
    required this.slug,
    required this.name,
    required this.team,
    required this.position,
    required this.age,
    required this.height,
    required this.weight,
    this.zip,
    required this.rating,
    required this.offense,
    required this.defense,
    required this.shooting,
    required this.passing,
    required this.rebounding,
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
      zip: json['zip']?.toString(),
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
      team: zip,
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
  final String status; // 'pending', 'accepted', 'completed', 'waiting', 'live', 'ended'
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

/// Basketball court location with Kings for each game mode
class Court {
  final String id;
  final String name;
  final double lat;
  final double lng;
  final String? address;
  final bool isSignature; // Signature courts are high-traffic/famous venues
  final bool isIndoor; // Indoor venues (gyms, schools, rec centers)
  final int followerCount; // Number of users following this court
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

  Court({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    this.address,
    this.isSignature = false,
    this.isIndoor = false,
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
  });


  /// Legacy getter for backwards compatibility
  String? get king => king1v1;

  /// Check if court has any Kings
  bool get hasKings => king1v1 != null || king3v3 != null || king5v5 != null;

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
  }) {
    return Court(
      id: id,
      name: name,
      lat: lat,
      lng: lng,
      address: address,
      isSignature: isSignature,
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
    );
  }

  factory Court.fromJson(Map<String, dynamic> json) {
    return Court(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unknown Court',
      lat: _parseDouble(json['lat']),
      lng: _parseDouble(json['lng']),
      address: json['address']?.toString(),
      isSignature: json['signature'] == true || json['isSignature'] == true,
      followerCount: _parseInt(json['follower_count'] ?? json['followerCount']),
      king1v1: json['king1v1']?.toString() ?? json['king']?.toString(),
      king1v1Id: json['king1v1Id']?.toString(),
      king1v1Rating: json['king1v1Rating'] != null ? _parseDouble(json['king1v1Rating']) : null,
      king3v3: json['king3v3']?.toString(),
      king3v3Id: json['king3v3Id']?.toString(),
      king3v3Rating: json['king3v3Rating'] != null ? _parseDouble(json['king3v3Rating']) : null,
      king5v5: json['king5v5']?.toString(),
      king5v5Id: json['king5v5Id']?.toString(),
      king5v5Rating: json['king5v5Rating'] != null ? _parseDouble(json['king5v5Rating']) : null,
    );
  }
}

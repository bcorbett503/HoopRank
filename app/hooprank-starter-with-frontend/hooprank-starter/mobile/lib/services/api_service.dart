import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models.dart';

class ApiService {
  // Production URL - Railway deployment
  static const String _productionUrl = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
  
  // Development URLs
  static const String _emulatorUrl = 'http://10.0.2.2:4000';  // Android emulator
  static const String _localUrl = 'http://localhost:4000';     // iOS simulator / web
  
  // Set to true ONLY when running local backend server
  static const bool _useLocalServer = false;
  
  // Automatically select URL based on environment
  static String get baseUrl {
    if (kReleaseMode || !_useLocalServer) {
      return _productionUrl;
    }
    // Only use emulator URL when explicitly developing locally
    return _emulatorUrl;
  } 


  static String? _authToken;
  static String? _userId;
  
  static String? get userId => _userId;

  static void setAuthToken(String token) {
    _authToken = token;
  }

  static void setUserId(String id) {
    _userId = id;
  }

  static Future<User> authenticate(String idToken, {
    required String uid,
    String? email,
    String? name,
    String? photoUrl,
    String? provider,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/users/auth'),
      headers: {
        'Authorization': 'Bearer $idToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'id': uid,
        'email': email,
        'name': name,
        'photoUrl': photoUrl,
        'provider': provider,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return User.fromJson(data);
    } else {
      throw Exception('Failed to authenticate');
    }
  }

  /// Get current user's data (for refreshing rating after match confirmation)
  static Future<User?> getMe() async {
    if (_userId == null || _userId!.isEmpty) return null;
    
    final response = await http.get(
      Uri.parse('$baseUrl/users/me'),
      headers: {
        'x-user-id': _userId!,
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return User.fromJson(data);
    }
    return null;
  }

  static Future<User> devLogin(String id, String name) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/dev'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'id': id,
        'name': name,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return User.fromJson(data);
    } else {
      throw Exception('Failed to dev login');
    }
  }

  static Future<Map<String, dynamic>?> getProfile(String userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userId'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      return null;
    }
  }

  static Future<void> updateProfile(String userId, Map<String, dynamic> data) async {
    if (_authToken == null && _userId == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse('$baseUrl/users/$userId/profile'),
      headers: {
        'Authorization': 'Bearer $_authToken',
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(data),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to update profile');
    }
  }

  /// Upload an image for profile or team
  /// [type] - 'profile' or 'team'
  /// [targetId] - userId or teamId
  /// [imageFile] - the image file to upload
  /// Returns null on success, or an error message on failure
  static Future<String?> uploadImage({
    required String type,
    required String targetId,
    required File imageFile,
  }) async {
    try {
      debugPrint('uploadImage: type=$type, targetId=$targetId, userId=$_userId');
      final bytes = await imageFile.readAsBytes();
      debugPrint('uploadImage: Read ${bytes.length} bytes from image');
      final base64Image = base64Encode(bytes);
      final mimeType = imageFile.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      final dataUrl = 'data:$mimeType;base64,$base64Image';
      debugPrint('uploadImage: Base64 data URL length: ${dataUrl.length}');
      
      final response = await http.post(
        Uri.parse('$baseUrl/upload'),
        headers: {
          'x-user-id': _userId ?? '',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'type': type,
          'targetId': targetId,
          'imageData': dataUrl,
        }),
      );
      
      debugPrint('uploadImage: Response status=${response.statusCode}');
      debugPrint('uploadImage: Response body=${response.body}');
      
      if (response.statusCode == 200) {
        debugPrint('Image uploaded successfully for $type: $targetId');
        return null; // Success
      } else {
        debugPrint('Upload failed: status=${response.statusCode}, body=${response.body}');
        return 'Status ${response.statusCode}: ${response.body}';
      }
    } catch (e) {
      debugPrint('Upload error: $e');
      return 'Error: $e';
    }
  }

  static Future<void> createMatch({
    required String hostId,
    required String guestId,
    String? message,
  }) async {
    if (_authToken == null && _userId == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse('$baseUrl/matches'),
      headers: {
        'Authorization': 'Bearer $_authToken',
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'hostId': hostId,
        'guestId': guestId,
        'message': message,
      }),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to create match');
    }
  }

  /// Creates a challenge (NOT a match). Match is created when challenge is accepted.
  static Future<Map<String, dynamic>> createChallenge({
    required String toUserId,
    required String message,
  }) async {
    if (_authToken == null && _userId == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse('$baseUrl/challenges'),
      headers: {
        'Authorization': 'Bearer $_authToken',
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'toUserId': toUserId,
        'message': message,
      }),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to create challenge');
    }
    return jsonDecode(response.body);
  }

  /// Get rankings (players for 1v1, teams for 3v3/5v5)
  static Future<List<Map<String, dynamic>>> getRankings({required String mode}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/rankings?mode=$mode'),
      headers: {'x-user-id': _userId ?? ''},
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
    }
    return [];
  }

  /// Get all players
  static Future<List<User>> getPlayers() async {
    debugPrint('>>> getPlayers() called, userId: $_userId');
    
    try {
      final uri = Uri.parse('$baseUrl/users');
      final response = await http.get(uri, headers: {'x-user-id': _userId ?? ''});
      
      debugPrint('>>> getPlayers() response: ${response.statusCode}, length: ${response.body.length}');
      
      if (response.statusCode != 200) {
        debugPrint('>>> getPlayers() non-200: ${response.body}');
        return [];
      }
      
      final List<dynamic> jsonList = jsonDecode(response.body);
      debugPrint('>>> getPlayers() parsed ${jsonList.length} items');
      
      final List<User> users = [];
      for (var i = 0; i < jsonList.length; i++) {
        try {
          users.add(User.fromJson(jsonList[i]));
        } catch (e) {
          debugPrint('>>> getPlayers() Failed to parse user $i: $e');
        }
      }
      
      debugPrint('>>> getPlayers() returning ${users.length} users');
      return users;
    } catch (e) {
      debugPrint('>>> getPlayers() ERROR: $e');
      return [];
    }
  }


  /// Get nearby players within specified radius
  static Future<List<User>> getNearbyPlayers({int radiusMiles = 25}) async {
    debugPrint('>>> getNearbyPlayers() called, userId: $_userId, radius: $radiusMiles');
    
    try {
      final uri = Uri.parse('$baseUrl/users/nearby?radiusMiles=$radiusMiles');
      final response = await http.get(uri, headers: {'x-user-id': _userId ?? ''});
      
      debugPrint('>>> getNearbyPlayers() response: ${response.statusCode}, length: ${response.body.length}');
      
      if (response.statusCode != 200) {
        debugPrint('>>> getNearbyPlayers() non-200: ${response.body}');
        return [];
      }
      
      final List<dynamic> jsonList = jsonDecode(response.body);
      debugPrint('>>> getNearbyPlayers() parsed ${jsonList.length} items');
      
      final List<User> users = [];
      for (var i = 0; i < jsonList.length; i++) {
        try {
          users.add(User.fromJson(jsonList[i]));
        } catch (e) {
          debugPrint('>>> getNearbyPlayers() Failed to parse user $i: $e');
        }
      }
      
      debugPrint('>>> getNearbyPlayers() returning ${users.length} users');
      return users;
    } catch (e) {
      debugPrint('>>> getNearbyPlayers() ERROR: $e');
      return [];
    }
  }

  static Future<Map<String, dynamic>?> getUserStats(String userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userId/stats'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      return null;
    }
  }

  static Future<List<Map<String, dynamic>>> getUserRankHistory(String userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userId/rank-history'),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final List<dynamic> series = data['series'] ?? [];
      return series.cast<Map<String, dynamic>>();
    } else {
      return [];
    }
  }

  /// Register FCM token for push notifications
  static Future<void> registerFcmToken(String userId, String token) async {
    final response = await http.post(
      Uri.parse('$baseUrl/users/$userId/fcm-token'),
      headers: {
        'Authorization': 'Bearer $_authToken',
        'x-user-id': userId,
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'token': token}),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to register FCM token');
    }
  }

  /// Get count of unread messages for badge display
  static Future<int> getUnreadMessageCount() async {
    if (_userId == null || _userId!.isEmpty) return 0;
    
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/messages/unread-count'),
        headers: {
          'x-user-id': _userId!,
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['unreadCount'] ?? 0;
      }
    } catch (e) {
      debugPrint('Failed to get unread count: $e');
    }
    return 0;
  }

  /// Get a specific match by ID
  static Future<Map<String, dynamic>?> getMatch(String matchId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/matches/$matchId'),
      headers: {
        'x-user-id': _userId ?? '',
      },
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  /// Submit score for a match
  static Future<Map<String, dynamic>> submitScore({
    required String matchId,
    required int myScore,
    required int opponentScore,
  }) async {
    if (_userId == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse('$baseUrl/matches/$matchId/score'),
      headers: {
        'x-user-id': _userId!,
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'me': myScore,
        'opponent': opponentScore,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final body = response.body;
      throw Exception('Failed to submit score: $body');
    }
  }

  /// Confirm opponent's submitted score
  static Future<Map<String, dynamic>> confirmScore(String matchId) async {
    if (_userId == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse('$baseUrl/matches/$matchId/confirm'),
      headers: {
        'x-user-id': _userId!,
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final body = response.body;
      throw Exception('Failed to confirm score: $body');
    }
  }

  /// Contest opponent's submitted score
  static Future<Map<String, dynamic>> contestScore(String matchId) async {
    if (_userId == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse('$baseUrl/matches/$matchId/contest'),
      headers: {
        'x-user-id': _userId!,
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to contest score');
    }
  }

  /// Get user's match history
  static Future<List<Map<String, dynamic>>> getUserMatchHistory(String userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userId/recent-games'),
      headers: {
        'x-user-id': _userId ?? '',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
      return [];
    } else {
      return [];
    }
  }

  /// Get user's current rating info
  static Future<Map<String, dynamic>?> getUserRating(String userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userId/rating'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  /// Get matches awaiting score confirmation from current user
  static Future<List<Map<String, dynamic>>> getPendingConfirmations() async {
    final response = await http.get(
      Uri.parse('$baseUrl/matches/pending-confirmation'),
      headers: {
        'x-user-id': _userId ?? '',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
    }
    return [];
  }

  /// Get local activity feed (recent games from nearby players)
  static Future<List<Map<String, dynamic>>> getLocalActivity({int limit = 20, int radiusMiles = 25}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/activity/local?limit=$limit&radiusMiles=$radiusMiles'),
      headers: {
        'x-user-id': _userId ?? '',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
    }
    return [];
  }

  /// Get global activity feed (most recent completed matches app-wide)
  static Future<List<Map<String, dynamic>>> getGlobalActivity({int limit = 3}) async {
    debugPrint('>>> getGlobalActivity: calling $baseUrl/activity/global?limit=$limit');
    final response = await http.get(
      Uri.parse('$baseUrl/activity/global?limit=$limit'),
      headers: {
        'x-user-id': _userId ?? '',
      },
    );

    debugPrint('>>> getGlobalActivity: status=${response.statusCode}, body=${response.body}');
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
    }
    return [];
  }

  // ===================
  // Teams API
  // ===================

  /// Get user's teams
  static Future<List<Map<String, dynamic>>> getMyTeams() async {
    final response = await http.get(
      Uri.parse('$baseUrl/teams'),
      headers: {'x-user-id': _userId ?? ''},
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
    }
    return [];
  }

  /// Get pending team invites
  static Future<List<Map<String, dynamic>>> getTeamInvites() async {
    final response = await http.get(
      Uri.parse('$baseUrl/teams/invites'),
      headers: {'x-user-id': _userId ?? ''},
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
    }
    return [];
  }

  /// Create a new team
  static Future<Map<String, dynamic>?> createTeam({
    required String name,
    required String teamType,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams'),
      headers: {
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'name': name,
        'teamType': teamType,
      }),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to create team: ${response.body}');
  }

  /// Get team details
  static Future<Map<String, dynamic>?> getTeamDetail(String teamId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/teams/$teamId'),
      headers: {'x-user-id': _userId ?? ''},
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  /// Accept team invite
  static Future<bool> acceptTeamInvite(String teamId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/$teamId/accept'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Decline team invite
  static Future<bool> declineTeamInvite(String teamId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/$teamId/decline'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Leave team
  static Future<bool> leaveTeam(String teamId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/$teamId/leave'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Delete team (owner only)
  static Future<bool> deleteTeam(String teamId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/teams/$teamId'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Invite player to team
  static Future<bool> inviteToTeam(String teamId, String userId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/$teamId/invite/$userId'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Get a user's team memberships (for checking before invite)
  static Future<List<Map<String, dynamic>>> getUserTeams(String userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/teams/user/$userId'),
      headers: {'x-user-id': _userId ?? ''},
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return List<Map<String, dynamic>>.from(data['teams'] ?? []);
    }
    return [];
  }

  /// Remove member from team (owner only)
  static Future<bool> removeTeamMember(String teamId, String userId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/teams/$teamId/members/$userId'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Get team rankings by type and scope
  static Future<List<Map<String, dynamic>>> getTeamRankings({
    required String teamType,
    String scope = 'global',
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/rankings?mode=$teamType&scope=$scope'),
      headers: {'x-user-id': _userId ?? ''},
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
    }
    return [];
  }

  // ===================
  // Team Challenges & Matches
  // ===================

  /// Challenge another team
  static Future<Map<String, dynamic>?> challengeTeam({
    required String teamId,
    required String opponentTeamId,
    String? message,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/$teamId/challenge/$opponentTeamId'),
      headers: {
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'message': message ?? ''}),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to challenge team: ${response.body}');
  }

  /// Get pending team challenges
  static Future<List<Map<String, dynamic>>> getTeamChallenges() async {
    final response = await http.get(
      Uri.parse('$baseUrl/teams/challenges'),
      headers: {'x-user-id': _userId ?? ''},
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
    }
    return [];
  }

  /// Create a team challenge
  static Future<bool> createTeamChallenge({
    required String challengerTeamId,
    required String opponentTeamId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/$challengerTeamId/challenge/$opponentTeamId'),
      headers: {
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({}),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return true;
    }
    final body = jsonDecode(response.body);
    throw Exception(body['error'] ?? 'Failed to create team challenge');
  }

  /// Accept team challenge
  static Future<bool> acceptTeamChallenge(String matchId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/challenges/$matchId/accept'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Decline team challenge
  static Future<bool> declineTeamChallenge(String matchId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/challenges/$matchId/decline'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Submit team match score
  static Future<Map<String, dynamic>?> submitTeamScore({
    required String matchId,
    required int myTeamScore,
    required int opponentTeamScore,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/teams/matches/$matchId/score'),
      headers: {
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'myTeamScore': myTeamScore,
        'opponentTeamScore': opponentTeamScore,
      }),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to submit score: ${response.body}');
  }

  // ===================
  // Follow API (Courts & Players)
  // ===================

  /// Get all user's follows (courts + players)
  static Future<Map<String, dynamic>> getFollows() async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/me/follows'),
      headers: {'x-user-id': _userId ?? ''},
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return {'courts': [], 'players': []};
  }

  /// Follow a court
  static Future<bool> followCourt(String courtId, {bool alertsEnabled = false}) async {
    final response = await http.post(
      Uri.parse('$baseUrl/users/me/follows/courts'),
      headers: {
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'courtId': courtId,
        'alertsEnabled': alertsEnabled,
      }),
    );
    return response.statusCode == 200;
  }

  /// Unfollow a court
  static Future<bool> unfollowCourt(String courtId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/users/me/follows/courts/${Uri.encodeComponent(courtId)}'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }

  /// Set court alert preference
  static Future<bool> setCourtAlert(String courtId, bool enabled) async {
    final response = await http.put(
      Uri.parse('$baseUrl/users/me/follows/courts/${Uri.encodeComponent(courtId)}/alerts'),
      headers: {
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'enabled': enabled}),
    );
    return response.statusCode == 200;
  }

  /// Follow a player
  static Future<bool> followPlayer(String playerId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/users/me/follows/players'),
      headers: {
        'x-user-id': _userId ?? '',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'playerId': playerId}),
    );
    return response.statusCode == 200;
  }

  /// Unfollow a player
  static Future<bool> unfollowPlayer(String playerId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/users/me/follows/players/$playerId'),
      headers: {'x-user-id': _userId ?? ''},
    );
    return response.statusCode == 200;
  }
}


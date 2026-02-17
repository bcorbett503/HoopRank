import 'dart:convert';
import '../models.dart';
import 'api_service.dart';

class Message {
  final String id;
  final String senderId;
  final String receiverId;
  final String content;
  final DateTime createdAt;
  final String? matchId;
  final bool isChallenge;
  final String? challengeStatus; // 'pending', 'accepted', 'declined', 'expired'
  final String? imageUrl;

  Message({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    required this.createdAt,
    this.matchId,
    this.isChallenge = false,
    this.challengeStatus,
    this.imageUrl,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id']?.toString() ?? '',
      // Handle both legacy (senderId/receiverId) and PostgreSQL (from_id/to_id) field names
      senderId: (json['senderId'] ?? json['from_id'])?.toString() ?? '',
      receiverId: (json['receiverId'] ?? json['to_id'])?.toString() ?? '',
      content: (json['content'] ?? json['body'])?.toString() ?? '',
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt']) 
          : json['created_at'] != null 
              ? DateTime.parse(json['created_at']) 
              : DateTime.now(),
      matchId: (json['matchId'] ?? json['match_id'])?.toString(),
      isChallenge: json['isChallenge'] ?? json['is_challenge'] ?? false,
      challengeStatus: (json['challengeStatus'] ?? json['challenge_status'])?.toString(),
      imageUrl: (json['imageUrl'] ?? json['image_url'])?.toString(),
    );
  }


  Map<String, dynamic> toJson() {
    return {
      'senderId': senderId,
      'receiverId': receiverId,
      'content': content,
      'matchId': matchId,
      'isChallenge': isChallenge,
      if (imageUrl != null) 'imageUrl': imageUrl,
    };
  }
}

class Conversation {
  final String? threadId;
  final User user;
  final Message? lastMessage;
  final int unreadCount;

  Conversation({this.threadId, required this.user, this.lastMessage, this.unreadCount = 0});

  factory Conversation.fromJson(Map<String, dynamic> json) {
    // Handle null user gracefully
    final userJson = json['user'];
    if (userJson == null) {
      throw FormatException('Conversation requires a user object');
    }
    return Conversation(
      threadId: json['threadId']?.toString(),
      user: User.fromJson(userJson as Map<String, dynamic>),
      lastMessage: json['lastMessage'] != null ? Message.fromJson(json['lastMessage']) : null,
      unreadCount: (json['unreadCount'] is int) ? json['unreadCount'] : int.tryParse(json['unreadCount']?.toString() ?? '0') ?? 0,
    );
  }
  
  bool get hasUnread => unreadCount > 0;
}

class ChallengeRequest {
  final Message message;
  final User otherUser; // The opponent (challenger or challengee)
  final String direction; // 'sent' or 'received'
  final Map<String, dynamic>? court; // Optional tagged court

  ChallengeRequest({required this.message, required this.otherUser, required this.direction, this.court});

  factory ChallengeRequest.fromJson(Map<String, dynamic> json) {
    return ChallengeRequest(
      message: Message.fromJson(json['message']),
      // Support both 'otherUser' (new) and 'sender' (legacy) keys
      otherUser: User.fromJson(json['otherUser'] ?? json['sender']),
      direction: json['direction'] ?? 'received',
      court: json['court'] as Map<String, dynamic>?,
    );
  }

  bool get isSent => direction == 'sent';
  bool get isReceived => direction == 'received';
  String? get courtName => court?['name'];
  String? get courtCity => court?['city'];
}

// Team group chat message
class TeamMessage {
  final String id;
  final String senderId;
  final String content;
  final DateTime createdAt;
  final String? senderName;
  final String? senderPhotoUrl;
  final String? imageUrl;

  TeamMessage({
    required this.id,
    required this.senderId,
    required this.content,
    required this.createdAt,
    this.senderName,
    this.senderPhotoUrl,
    this.imageUrl,
  });

  factory TeamMessage.fromJson(Map<String, dynamic> json) {
    return TeamMessage(
      id: json['id'],
      senderId: json['senderId'],
      content: json['content'],
      createdAt: DateTime.parse(json['createdAt']),
      senderName: json['senderName'],
      senderPhotoUrl: json['senderPhotoUrl'],
      imageUrl: (json['imageUrl'] ?? json['image_url'])?.toString(),
    );
  }
}

// Team group chat thread
class TeamConversation {
  final String teamId;
  final String teamName;
  final String teamType; // '3v3' or '5v5'
  final String? threadId;
  final String? lastMessage;
  final String? lastSenderName;
  final DateTime? lastMessageAt;

  TeamConversation({
    required this.teamId,
    required this.teamName,
    required this.teamType,
    this.threadId,
    this.lastMessage,
    this.lastSenderName,
    this.lastMessageAt,
  });

  factory TeamConversation.fromJson(Map<String, dynamic> json) {
    return TeamConversation(
      teamId: json['teamId'],
      teamName: json['teamName'],
      teamType: json['teamType'],
      threadId: json['threadId'],
      lastMessage: json['lastMessage'],
      lastSenderName: json['lastSenderName'],
      lastMessageAt: json['lastMessageAt'] != null 
          ? DateTime.parse(json['lastMessageAt']) 
          : null,
    );
  }
}

/// MessagesService — all HTTP calls go through ApiService.authed*() wrappers
/// for consistent token refresh and 401 retry behaviour.
class MessagesService {
  String get baseUrl => ApiService.baseUrl;

  Future<List<ChallengeRequest>> getPendingChallenges(String userId) async {
    final response = await ApiService.authedGet(
      Uri.parse('$baseUrl/challenges'),
      userId: userId,
    );

    
    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((raw) {
        final c = raw as Map<String, dynamic>;

        Map<String, dynamic> asMap(dynamic value) {
          if (value is Map<String, dynamic>) return value;
          if (value is Map) return value.cast<String, dynamic>();
          return <String, dynamic>{};
        }

        final fromUser = asMap(c['fromUser']);
        final toUser = asMap(c['toUser']);
        final court = c['court'] is Map ? (c['court'] as Map).cast<String, dynamic>() : null;

        final fromUserId = (c['from_user_id'] ?? c['fromUserId'] ?? fromUser['id'])?.toString() ?? '';
        final toUserId = (c['to_user_id'] ?? c['toUserId'] ?? toUser['id'])?.toString() ?? '';
        final isSent = fromUserId == userId;

        final direction = isSent ? 'sent' : 'received';
        final otherUserJson = isSent ? toUser : fromUser;
        final fallbackOtherUser = <String, dynamic>{
          'id': isSent ? toUserId : fromUserId,
          'name': 'Unknown',
        };

        final message = Message(
          id: c['id']?.toString() ?? '',
          senderId: fromUserId,
          receiverId: toUserId,
          content: c['message']?.toString() ?? '',
          createdAt: c['created_at'] != null
              ? DateTime.parse(c['created_at'])
              : c['createdAt'] != null
                  ? DateTime.parse(c['createdAt'])
                  : DateTime.now(),
          matchId: (c['match_id'] ?? c['matchId'])?.toString(),
          isChallenge: true,
          challengeStatus: c['status']?.toString(),
        );

        return ChallengeRequest(
          message: message,
          otherUser: User.fromJson(otherUserJson.isEmpty ? fallbackOtherUser : otherUserJson),
          direction: direction,
          court: court,
        );
      }).toList();
    } else {
      throw Exception('Failed to load challenges');
    }
  }

  Future<void> cancelChallenge(String userId, String challengeId) async {
    final response = await ApiService.authedDelete(
      Uri.parse('$baseUrl/challenges/$challengeId'),
      userId: userId,
    );

    if (response.statusCode != 200) {
      final body = json.decode(response.body);
      throw Exception(body['error'] ?? 'Failed to cancel challenge');
    }
  }

  /// Accept a challenge and get the created matchId
  Future<Map<String, dynamic>> acceptChallenge(String userId, String challengeId) async {
    final response = await ApiService.authedPut(
      Uri.parse('$baseUrl/challenges/$challengeId/accept'),
      userId: userId,
    );

    
    if (response.statusCode == 200 || response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      final body = json.decode(response.body);
      throw Exception(body['message'] ?? body['error'] ?? 'Failed to accept challenge');
    }
  }

  /// Decline a challenge
  Future<void> declineChallenge(String userId, String challengeId) async {
    final response = await ApiService.authedPut(
      Uri.parse('$baseUrl/challenges/$challengeId/decline'),
      userId: userId,
    );


    if (response.statusCode != 200 && response.statusCode != 201) {
      final body = json.decode(response.body);
      throw Exception(body['message'] ?? body['error'] ?? 'Failed to decline challenge');
    }
  }

  Future<List<Conversation>> getConversations(String userId) async {
    final response = await ApiService.authedGet(
      Uri.parse('$baseUrl/messages/conversations'),
      userId: userId,
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => Conversation.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load conversations');
    }
  }

  Future<void> deleteThread(String userId, String threadId) async {
    final response = await ApiService.authedDelete(
      Uri.parse('$baseUrl/threads/$threadId'),
      userId: userId,
    );

    if (response.statusCode != 200) {
      final body = json.decode(response.body);
      throw Exception(body['error'] ?? 'Failed to delete thread');
    }
  }

  Future<List<Message>> getMessages(String userId, String otherUserId) async {
    final response = await ApiService.authedGet(
      Uri.parse('$baseUrl/messages/$otherUserId'),
      userId: userId,
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => Message.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load messages');
    }
  }

  /// Mark all messages from otherUserId as read
  Future<void> markConversationAsRead(String userId, String otherUserId) async {
    try {
      await ApiService.authedPut(
        Uri.parse('$baseUrl/messages/$otherUserId/read'),
        userId: userId,
      );
    } catch (e) {
    }
  }

  Future<Message> sendMessage(String senderId, String receiverId, String content, {String? matchId, String? imageUrl}) async {
    
    final body = <String, dynamic>{
      'senderId': senderId,
      'receiverId': receiverId,
      'content': content,
    };
    if (matchId != null) {
      body['matchId'] = matchId;
    }
    if (imageUrl != null) {
      body['imageUrl'] = imageUrl;
    }
    
    final response = await ApiService.authedPost(
      Uri.parse('$baseUrl/messages'),
      body: json.encode(body),
      headers: {'Content-Type': 'application/json'},
      userId: senderId,
    );


    if (response.statusCode == 201) {
      return Message.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed (${response.statusCode}): ${response.body}');
    }
  }

  /// Send a challenge to another player
  /// Optionally tag a court where the game will be played
  Future<void> sendChallenge(String senderId, String receiverId, String message, {String? courtId}) async {
    
    final body = <String, dynamic>{
      'toUserId': receiverId,
      'message': message,
    };
    if (courtId != null) {
      body['courtId'] = courtId;
    }
    
    final response = await ApiService.authedPost(
      Uri.parse('$baseUrl/challenges'),
      body: json.encode(body),
      headers: {'Content-Type': 'application/json'},
      userId: senderId,
    );


    if (response.statusCode != 201) {
      final errorBody = json.decode(response.body);
      throw Exception(errorBody['message'] ?? errorBody['error'] ?? 'Failed to send challenge');
    }
  }

  // === Team Group Chat Methods ===

  /// Get list of team chats the user is a member of
  Future<List<TeamConversation>> getTeamChats(String userId) async {
    final response = await ApiService.authedGet(
      Uri.parse('$baseUrl/messages/team-chats'),
      userId: userId,
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => TeamConversation.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load team chats');
    }
  }

  /// Get messages for a specific team chat
  Future<List<TeamMessage>> getTeamMessages(String userId, String teamId) async {
    final response = await ApiService.authedGet(
      Uri.parse('$baseUrl/teams/$teamId/messages'),
      userId: userId,
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => TeamMessage.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load team messages');
    }
  }

  /// Send a message to a team chat
  Future<TeamMessage> sendTeamMessage(String userId, String teamId, String content, {String? imageUrl}) async {
    final body = <String, dynamic>{'content': content};
    if (imageUrl != null) {
      body['imageUrl'] = imageUrl;
    }
    final response = await ApiService.authedPost(
      Uri.parse('$baseUrl/teams/$teamId/messages'),
      body: json.encode(body),
      headers: {'Content-Type': 'application/json'},
      userId: userId,
    );

    if (response.statusCode == 201) {
      return TeamMessage.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to send team message');
    }
  }

  // === Team Challenge Methods ===

  /// Get pending team challenges for all teams the user is a member of
  Future<List<TeamChallengeRequest>> getPendingTeamChallenges(String userId, List<String> teamIds) async {
    final List<TeamChallengeRequest> allChallenges = [];

    for (final teamId in teamIds) {
      try {
        final response = await ApiService.authedGet(
          Uri.parse('$baseUrl/teams/$teamId/challenges'),
          userId: userId,
        );

        if (response.statusCode == 200) {
          final List<dynamic> data = json.decode(response.body);
          for (final c in data) {
            allChallenges.add(TeamChallengeRequest.fromJson(c, teamId));
          }
        }
      } catch (e) {
      }
    }

    return allChallenges;
  }

  /// Accept a team challenge
  Future<Map<String, dynamic>> acceptTeamChallenge(String userId, String teamId, String challengeId) async {
    final response = await ApiService.authedPost(
      Uri.parse('$baseUrl/teams/$teamId/challenges/$challengeId/accept'),
      userId: userId,
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      final body = json.decode(response.body);
      throw Exception(body['message'] ?? 'Failed to accept team challenge');
    }
  }

  /// Decline a team challenge
  Future<void> declineTeamChallenge(String userId, String teamId, String challengeId) async {
    final response = await ApiService.authedPost(
      Uri.parse('$baseUrl/teams/$teamId/challenges/$challengeId/decline'),
      userId: userId,
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      final body = json.decode(response.body);
      throw Exception(body['message'] ?? 'Failed to decline team challenge');
    }
  }
}

/// Team challenge request model for display in feed
class TeamChallengeRequest {
  final String id;
  final String fromTeamId;
  final String fromTeamName;
  final String toTeamId;
  final String toTeamName;
  final String teamType;
  final String message;
  final String status;
  final DateTime createdAt;
  final String direction; // 'incoming' or 'outgoing'
  final String myTeamId; // The team that the current user is on

  TeamChallengeRequest({
    required this.id,
    required this.fromTeamId,
    required this.fromTeamName,
    required this.toTeamId,
    required this.toTeamName,
    required this.teamType,
    required this.message,
    required this.status,
    required this.createdAt,
    required this.direction,
    required this.myTeamId,
  });

  factory TeamChallengeRequest.fromJson(Map<String, dynamic> json, String myTeamId) {
    return TeamChallengeRequest(
      id: json['id'] ?? '',
      fromTeamId: json['fromTeamId'] ?? '',
      fromTeamName: json['fromTeamName'] ?? 'Unknown Team',
      toTeamId: json['toTeamId'] ?? '',
      toTeamName: json['toTeamName'] ?? 'Unknown Team',
      teamType: json['teamType'] ?? '3v3',
      message: json['message'] ?? 'Team challenge!',
      status: json['status'] ?? 'pending',
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt']) 
          : DateTime.now(),
      direction: json['direction'] ?? 'incoming',
      myTeamId: myTeamId,
    );
  }

  bool get isIncoming => direction == 'incoming';
  bool get isOutgoing => direction == 'outgoing';
  String get opponentTeamName => isIncoming ? fromTeamName : toTeamName;
  String get opponentTeamId => isIncoming ? fromTeamId : toTeamId;
}

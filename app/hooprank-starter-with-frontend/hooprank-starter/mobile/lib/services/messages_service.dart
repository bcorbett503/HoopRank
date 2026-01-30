import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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

  Message({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    required this.createdAt,
    this.matchId,
    this.isChallenge = false,
    this.challengeStatus,
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
    );
  }


  Map<String, dynamic> toJson() {
    return {
      'senderId': senderId,
      'receiverId': receiverId,
      'content': content,
      'matchId': matchId,
      'isChallenge': isChallenge,
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
  final User sender; // Actually the "other" user (opponent)
  final String direction; // 'sent' or 'received'

  ChallengeRequest({required this.message, required this.sender, required this.direction});

  factory ChallengeRequest.fromJson(Map<String, dynamic> json) {
    return ChallengeRequest(
      message: Message.fromJson(json['message']),
      sender: User.fromJson(json['sender']),
      direction: json['direction'] ?? 'received',
    );
  }

  bool get isSent => direction == 'sent';
  bool get isReceived => direction == 'received';
}

// Team group chat message
class TeamMessage {
  final String id;
  final String senderId;
  final String content;
  final DateTime createdAt;
  final String? senderName;
  final String? senderPhotoUrl;

  TeamMessage({
    required this.id,
    required this.senderId,
    required this.content,
    required this.createdAt,
    this.senderName,
    this.senderPhotoUrl,
  });

  factory TeamMessage.fromJson(Map<String, dynamic> json) {
    return TeamMessage(
      id: json['id'],
      senderId: json['senderId'],
      content: json['content'],
      createdAt: DateTime.parse(json['createdAt']),
      senderName: json['senderName'],
      senderPhotoUrl: json['senderPhotoUrl'],
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

class MessagesService {
  String get baseUrl => ApiService.baseUrl; // Use same URL as ApiService
  final _storage = const FlutterSecureStorage();

  Future<String?> _getToken() async {
    return await _storage.read(key: 'auth_token');
  }

  Future<List<ChallengeRequest>> getPendingChallenges(String userId) async {
    final token = await _getToken();
    print('Getting challenges for userId: $userId');
    final response = await http.get(
      Uri.parse('$baseUrl/messages/challenges'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
      },
    );

    print('Challenges response status: ${response.statusCode}');
    print('Challenges response body: ${response.body}');
    
    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      print('Parsed ${data.length} challenges');
      return data.map((json) => ChallengeRequest.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load challenges');
    }
  }

  Future<void> cancelChallenge(String userId, String challengeId) async {
    final token = await _getToken();
    final response = await http.delete(
      Uri.parse('$baseUrl/challenges/$challengeId'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
      },
    );

    if (response.statusCode != 200) {
      final body = json.decode(response.body);
      throw Exception(body['error'] ?? 'Failed to cancel challenge');
    }
  }

  /// Accept a challenge and get the created matchId
  Future<Map<String, dynamic>> acceptChallenge(String userId, String challengeId) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/challenges/$challengeId/accept'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      final body = json.decode(response.body);
      throw Exception(body['error'] ?? 'Failed to accept challenge');
    }
  }

  /// Decline a challenge
  Future<void> declineChallenge(String userId, String challengeId) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/challenges/$challengeId/decline'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode != 200) {
      final body = json.decode(response.body);
      throw Exception(body['error'] ?? 'Failed to decline challenge');
    }
  }

  Future<List<Conversation>> getConversations(String userId) async {
    final token = await _getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/messages/conversations/$userId'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
      },
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => Conversation.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load conversations');
    }
  }

  Future<void> deleteThread(String userId, String threadId) async {
    final token = await _getToken();
    final response = await http.delete(
      Uri.parse('$baseUrl/threads/$threadId'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
      },
    );

    if (response.statusCode != 200) {
      final body = json.decode(response.body);
      throw Exception(body['error'] ?? 'Failed to delete thread');
    }
  }

  Future<List<Message>> getMessages(String userId, String otherUserId) async {
    final token = await _getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/messages/$userId/$otherUserId'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
      },
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => Message.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load messages');
    }
  }

  Future<Message> sendMessage(String senderId, String receiverId, String content, {String? matchId}) async {
    final token = await _getToken();
    
    print('=== SENDING MESSAGE ===');
    print('senderId: $senderId');
    print('receiverId: $receiverId');
    print('content: $content');
    
    final body = <String, dynamic>{
      'senderId': senderId,
      'receiverId': receiverId,
      'content': content,
    };
    // Only include matchId if it's not null (Zod rejects null, needs undefined)
    if (matchId != null) {
      body['matchId'] = matchId;
    }
    
    final response = await http.post(
      Uri.parse('$baseUrl/messages'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        'x-user-id': senderId,
      },
      body: json.encode(body),
    );

    print('Response status: ${response.statusCode}');
    print('Response body: ${response.body}');

    if (response.statusCode == 201) {
      return Message.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed (${response.statusCode}): ${response.body}');
    }
  }

  /// Send a challenge to another player
  Future<void> sendChallenge(String senderId, String receiverId, String message) async {
    final token = await _getToken();
    
    print('=== SENDING CHALLENGE ===');
    print('senderId: $senderId');
    print('receiverId: $receiverId');
    print('message: $message');
    
    final body = <String, dynamic>{
      'senderId': senderId,
      'receiverId': receiverId,
      'content': message,
      'isChallenge': true,
    };
    
    final response = await http.post(
      Uri.parse('$baseUrl/messages'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        'x-user-id': senderId,
      },
      body: json.encode(body),
    );

    print('Challenge response status: ${response.statusCode}');
    print('Challenge response body: ${response.body}');

    if (response.statusCode != 201) {
      final errorBody = json.decode(response.body);
      throw Exception(errorBody['message'] ?? errorBody['error'] ?? 'Failed to send challenge');
    }
  }

  // === Team Group Chat Methods ===

  /// Get list of team chats the user is a member of
  Future<List<TeamConversation>> getTeamChats(String userId) async {
    final token = await _getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/messages/team-chats'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
      },
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
    final token = await _getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/teams/$teamId/messages'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
      },
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => TeamMessage.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load team messages');
    }
  }

  /// Send a message to a team chat
  Future<TeamMessage> sendTeamMessage(String userId, String teamId, String content) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/teams/$teamId/messages'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        'x-user-id': userId,
      },
      body: json.encode({'content': content}),
    );

    if (response.statusCode == 201) {
      return TeamMessage.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to send team message');
    }
  }
}

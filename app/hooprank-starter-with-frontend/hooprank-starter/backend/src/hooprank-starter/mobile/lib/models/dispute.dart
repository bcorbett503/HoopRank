class Dispute {
  final String id;
  final String matchId;
  final String openedBy;
  final String status;
  final List<DisputeMessage> messages;

  Dispute({
    required this.id,
    required this.matchId,
    required this.openedBy,
    required this.status,
    required this.messages,
  });

  factory Dispute.fromJson(Map<String, dynamic> json) {
    return Dispute(
      id: json['id'],
      matchId: json['matchId'],
      openedBy: json['openedBy'],
      status: json['status'],
      messages: (json['messages'] as List)
          .map((m) => DisputeMessage.fromJson(m))
          .toList(),
    );
  }
}

class DisputeMessage {
  final String authorId;
  final String body;
  final String createdAt;
  final String? mediaUrl;

  DisputeMessage({
    required this.authorId,
    required this.body,
    required this.createdAt,
    this.mediaUrl,
  });

  factory DisputeMessage.fromJson(Map<String, dynamic> json) {
    return DisputeMessage(
      authorId: json['authorId'],
      body: json['body'],
      createdAt: json['createdAt'],
      mediaUrl: json['mediaUrl'],
    );
  }
}

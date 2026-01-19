class Match {
  final String id;
  final String? courtId;
  final String hostId;
  final String? guestId;
  final List<String> teamA;
  final List<String> teamB;
  final String format;
  final String status;
  final String createdAt;
  final Map<String, double>? ratingDiff;

  Match({
    required this.id,
    this.courtId,
    required this.hostId,
    this.guestId,
    required this.teamA,
    required this.teamB,
    required this.format,
    required this.status,
    required this.createdAt,
    this.ratingDiff,
  });

  factory Match.fromJson(Map<String, dynamic> json) {
    return Match(
      id: json['id'],
      courtId: json['courtId'],
      hostId: json['hostId'],
      guestId: json['guestId'],
      teamA: List<String>.from(json['teamA'] ?? []),
      teamB: List<String>.from(json['teamB'] ?? []),
      format: json['format'],
      status: json['status'],
      createdAt: json['createdAt'],
      ratingDiff: json['ratingDiff'] != null
          ? Map<String, double>.from((json['ratingDiff'] as Map).map(
              (key, value) => MapEntry(key, (value as num).toDouble())))
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courtId': courtId,
      'hostId': hostId,
      'guestId': guestId,
      'teamA': teamA,
      'teamB': teamB,
      'format': format,
      'status': status,
      'createdAt': createdAt,
      'ratingDiff': ratingDiff,
    };
  }
}

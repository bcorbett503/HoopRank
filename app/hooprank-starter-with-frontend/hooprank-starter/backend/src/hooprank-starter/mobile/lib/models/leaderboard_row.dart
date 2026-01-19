class LeaderboardRow {
  final int rank;
  final String userId;
  final double hoopRank;
  final double? shootingRank;

  LeaderboardRow({
    required this.rank,
    required this.userId,
    required this.hoopRank,
    this.shootingRank,
  });

  factory LeaderboardRow.fromJson(Map<String, dynamic> json) {
    return LeaderboardRow(
      rank: json['rank'],
      userId: json['userId'],
      hoopRank: (json['hoopRank'] as num).toDouble(),
      shootingRank: (json['shootingRank'] as num?)?.toDouble(),
    );
  }
}

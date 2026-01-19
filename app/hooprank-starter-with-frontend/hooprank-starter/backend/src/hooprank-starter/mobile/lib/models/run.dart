class Run {
  final String id;
  final String courtId;
  final String startsAt;
  final double? skillMin;
  final double? skillMax;
  final List<String> members;
  final String privacy;

  Run({
    required this.id,
    required this.courtId,
    required this.startsAt,
    this.skillMin,
    this.skillMax,
    required this.members,
    required this.privacy,
  });

  factory Run.fromJson(Map<String, dynamic> json) {
    return Run(
      id: json['id'],
      courtId: json['courtId'],
      startsAt: json['startsAt'],
      skillMin: (json['skillMin'] as num?)?.toDouble(),
      skillMax: (json['skillMax'] as num?)?.toDouble(),
      members: List<String>.from(json['members'] ?? []),
      privacy: json['privacy'],
    );
  }
}

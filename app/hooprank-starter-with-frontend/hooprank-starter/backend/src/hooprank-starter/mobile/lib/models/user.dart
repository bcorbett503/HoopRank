class User {
  final String id;
  final String name;
  final String? avatarUrl;
  final double hoopRank;
  final double? shootingRank;
  final String? city;
  final String? region;
  final String? country;

  User({
    required this.id,
    required this.name,
    this.avatarUrl,
    required this.hoopRank,
    this.shootingRank,
    this.city,
    this.region,
    this.country,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      name: json['name'],
      avatarUrl: json['avatarUrl'],
      hoopRank: (json['hoopRank'] as num).toDouble(),
      shootingRank: (json['shootingRank'] as num?)?.toDouble(),
      city: json['city'],
      region: json['region'],
      country: json['country'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'avatarUrl': avatarUrl,
      'hoopRank': hoopRank,
      'shootingRank': shootingRank,
      'city': city,
      'region': region,
      'country': country,
    };
  }
}

class Court {
  final String id;
  final String name;
  final double lat;
  final double lng;
  final String? address;
  final CourtKing? king;

  Court({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    this.address,
    this.king,
  });

  factory Court.fromJson(Map<String, dynamic> json) {
    return Court(
      id: json['id'],
      name: json['name'],
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      address: json['address'],
      king: json['king'] != null ? CourtKing.fromJson(json['king']) : null,
    );
  }
}

class CourtKing {
  final String userId;
  final String gainedAt;

  CourtKing({required this.userId, required this.gainedAt});

  factory CourtKing.fromJson(Map<String, dynamic> json) {
    return CourtKing(
      userId: json['userId'],
      gainedAt: json['gainedAt'],
    );
  }
}

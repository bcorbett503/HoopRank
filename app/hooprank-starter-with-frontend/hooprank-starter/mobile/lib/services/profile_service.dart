import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import '../models.dart';
import 'mock_data.dart';

class ProfileData {
  final String firstName;
  final String lastName;
  final DateTime? birthdate;
  final String city;
  final List<String> badges;
  final int heightFt;
  final int heightIn;
  final String position;
  final String? profilePictureUrl;
  final String visibility; // 'public', 'friends', 'private'

  ProfileData({
    required this.firstName,
    required this.lastName,
    this.birthdate,
    required this.city,
    this.badges = const [],
    required this.heightFt,
    required this.heightIn,
    required this.position,
    this.profilePictureUrl,
    this.visibility = 'public',
  });

  // Calculate age from birthdate
  int get age {
    if (birthdate == null) return 0;
    final now = DateTime.now();
    int age = now.year - birthdate!.year;
    if (now.month < birthdate!.month ||
        (now.month == birthdate!.month && now.day < birthdate!.day)) {
      age--;
    }
    return age;
  }

  Map<String, dynamic> toJson() => {
        'firstName': firstName,
        'lastName': lastName,
        'birthdate': birthdate?.toIso8601String(),
        'city': city,
        'badges': badges,
        'heightFt': heightFt,
        'heightIn': heightIn,
        'position': position,
        'profilePictureUrl': profilePictureUrl,
        'visibility': visibility,
      };

  factory ProfileData.fromJson(Map<String, dynamic> json) => ProfileData(
        firstName: json['firstName'] ?? '',
        lastName: json['lastName'] ?? '',
        birthdate: json['birthdate'] != null
            ? DateTime.tryParse(json['birthdate'])
            : null,
        city: json['city'] ?? '',
        badges: (json['badges'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        heightFt: json['heightFt'] ?? 6,
        heightIn: json['heightIn'] ?? 0,
        position: json['position'] ?? 'G',
        profilePictureUrl: json['profilePictureUrl'],
        visibility: json['visibility'] ?? 'public',
      );
}

class ProfileService {
  static String _key(String userId) => 'hooprank:profile:$userId';

  static Future<ProfileData?> getProfile(String userId) async {
    // Try local storage first
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key(userId));
      if (raw != null) {
        return ProfileData.fromJson(jsonDecode(raw));
      }
    } catch (e) {}

    // Try API if local storage doesn't have it
    if (!userId.startsWith('dev-user-')) {
      try {
        final data = await ApiService.getProfile(userId);
        if (data == null) return null;

        // Parse birthdate or calculate from age
        DateTime? birthdate;
        if (data['birthdate'] != null) {
          birthdate = DateTime.tryParse(data['birthdate']);
        } else if (data['age'] != null) {
          // Fallback: estimate birthdate from age
          final age = data['age'] as int;
          birthdate = DateTime(DateTime.now().year - age, 1, 1);
        }

        final rawHeight = data['height']?.toString().trim() ?? '';
        final match = RegExp(r"^(\d+)'\s*(\d{1,2})?").firstMatch(rawHeight);
        final parsedHeightFt = int.tryParse(match?.group(1) ?? '') ?? 6;
        final parsedHeightIn = int.tryParse(match?.group(2) ?? '') ?? 0;

        final profileData = ProfileData(
          firstName: data['name']?.split(' ')[0] ?? '',
          lastName: data['name']?.split(' ').skip(1).join(' ') ?? '',
          birthdate: birthdate,
          city: data['city'] ?? '',
          badges: (data['badges'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              const [],
          heightFt: parsedHeightFt.clamp(4, 7),
          heightIn: parsedHeightIn.clamp(0, 11),
          position: data['position'] ?? '',
          profilePictureUrl:
              data['photoUrl'] ?? data['avatar_url'] ?? data['photo_url'],
          visibility: 'public',
        );

        // Cache API profile locally so future loads are instant and resilient.
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_key(userId), jsonEncode(profileData.toJson()));
        } catch (_) {}
        return profileData;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  static Future<void> saveProfile(String userId, ProfileData data) async {
    // Save to local storage
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(userId), jsonEncode(data.toJson()));

    // Try to save to API (if available)
    try {
      await ApiService.updateProfile(userId, {
        'name': '${data.firstName} ${data.lastName}',
        'birthdate': data.birthdate?.toIso8601String(),
        'age': data.age, // Keep age for backward compatibility
        'city': data.city,
        'badges': data.badges,
        'height': "${data.heightFt}'${data.heightIn}\"",
        'position': data.position,
        'photoUrl': data.profilePictureUrl,
      });
    } catch (e) {
      // Continue anyway - local storage save succeeded
    }
  }

  static void applyProfileToPlayer(String playerId, ProfileData data) {
    try {
      final p = mockPlayers.firstWhere((p) => p.id == playerId);
      // Since Player fields are final, we'd technically need to replace the object in the list
      // or make them non-final. For this mock, let's replace the object in the list.
      final index = mockPlayers.indexOf(p);
      mockPlayers[index] = Player(
        id: p.id,
        slug: p.slug,
        name: p.name,
        team: p.team,
        position: data.position,
        age: data.age,
        height: "${data.heightFt}'${data.heightIn}\"",
        weight: p.weight,
        city: data.city,
        rating: p.rating,
        offense: p.offense,
        defense: p.defense,
        shooting: p.shooting,
        passing: p.passing,
        rebounding: p.rebounding,
      );
    } catch (e) {
      // Player not found
    }
  }

  static Future<List<Map<String, dynamic>>> getRankHistory(
      String userId) async {
    // Mock data for now
    // In a real app, this would fetch from backend
    await Future.delayed(const Duration(milliseconds: 500));
    return [
      {'month': 0, 'rank': 3.5},
      {'month': 1, 'rank': 3.8},
      {'month': 2, 'rank': 4.1},
      {'month': 3, 'rank': 4.2},
    ];
  }
}

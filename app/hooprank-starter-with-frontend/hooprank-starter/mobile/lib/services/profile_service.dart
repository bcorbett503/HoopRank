import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import '../models.dart';
import 'mock_data.dart';

class ProfileData {
  final String firstName;
  final String lastName;
  final int age;
  final String zip;
  final int heightFt;
  final int heightIn;
  final String position;
  final String? profilePictureUrl;
  final String visibility; // 'public', 'friends', 'private'

  ProfileData({
    required this.firstName,
    required this.lastName,
    required this.age,
    required this.zip,
    required this.heightFt,
    required this.heightIn,
    required this.position,
    this.profilePictureUrl,
    this.visibility = 'public',
  });

  Map<String, dynamic> toJson() => {
        'firstName': firstName,
        'lastName': lastName,
        'age': age,
        'zip': zip,
        'heightFt': heightFt,
        'heightIn': heightIn,
        'position': position,
        'profilePictureUrl': profilePictureUrl,
        'visibility': visibility,
      };

  factory ProfileData.fromJson(Map<String, dynamic> json) => ProfileData(
        firstName: json['firstName'] ?? '',
        lastName: json['lastName'] ?? '',
        age: json['age'],
        zip: json['zip'],
        heightFt: json['heightFt'],
        heightIn: json['heightIn'],
        position: json['position'],
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
    } catch (e) {
      print('Error reading local profile: $e');
    }

    // Try API if local storage doesn't have it
    if (!userId.startsWith('dev-user-')) {
      try {
        final data = await ApiService.getProfile(userId);
        if (data == null) return null;
        
        return ProfileData(
          firstName: data['name']?.split(' ')[0] ?? '',
          lastName: data['name']?.split(' ').skip(1).join(' ') ?? '',
          age: data['age'] ?? 0,
          zip: data['zip'] ?? '',
          heightFt: int.tryParse(data['height']?.split("'")[0] ?? '0') ?? 0,
          heightIn: int.tryParse(data['height']?.split("'")[1]?.replaceAll('"', '') ?? '0') ?? 0,
          position: data['position'] ?? '',
          profilePictureUrl: data['photoUrl'],
          visibility: 'public',
        );
      } catch (e) {
        print('Error fetching profile from API: $e');
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
        'age': data.age,
        'zip': data.zip,
        'height': "${data.heightFt}'${data.heightIn}\"",
        'position': data.position,
        'photoUrl': data.profilePictureUrl,
      });
    } catch (e) {
      print('Error saving profile to API: $e');
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
        zip: data.zip,
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
  static Future<List<Map<String, dynamic>>> getRankHistory(String userId) async {
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

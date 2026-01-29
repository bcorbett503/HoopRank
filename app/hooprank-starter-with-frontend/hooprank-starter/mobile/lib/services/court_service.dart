import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import '../models.dart';
import 'mock_courts_data.dart';
import 'indoor_gyms_data.dart';

class CourtService {
  static final CourtService _instance = CourtService._internal();
  factory CourtService() => _instance;
  CourtService._internal();

  List<Court> _courts = [];
  bool _isLoaded = false;

  Future<void> loadCourts() async {
    if (_isLoaded) return;

    try {
      // Load outdoor basketball courts
      final List<Map<String, dynamic>> outdoorData = mockCourtsData;
      
      // Load indoor venues (gyms, schools, rec centers)
      final List<Map<String, dynamic>> indoorData = indoorGymsData;

      // Curated set of TRUE signature courts - famous streetball/high-traffic locations
      // Only these specific courts get the signature designation
      final signatureCourtNames = <String>{
        // NYC
        'rucker park', 'holcombe rucker park', 'west 4th', 'the cage', 'dyckman',
        // LA
        'drew league', 'king drew', 'venice beach', 'pan pacific', 'jesse owens',
        // Chicago
        'seward park', 'washington park', 'foster park',
        // Detroit
        'st. cecilia', 'saint cecilia', 'the saint',
        // DC
        'barry farm', 'watts branch', 'turkey thicket',
        // Philadelphia
        'hank gathers', 'tarken', 'murphy recreation',
        // Atlanta
        'run n shoot', 'piedmont park', 'grant park',
        // Houston
        'emancipation park', 'fonde recreation',
        // Bay Area
        'mosswood', 'kezar pavilion', 'bushrod', 'defremery',
        // Boston
        'malcolm x park',
        // Miami
        'jose marti', 'overtown youth', 'hadley park',
        // Seattle
        'cal anderson', 'rainier playfield',
        // Denver
        'rude recreation',
        // Portland
        'irving park', 'dishman',
        // Dallas
        'kiest park', 'exline',
        // Indianapolis
        'tarkington park',
      };
      
      // Helper to check if a court name matches any signature court
      bool isSignatureCourt(String name) {
        final nameLower = name.toLowerCase();
        return signatureCourtNames.any((sig) => nameLower.contains(sig));
      }
      
      // Process outdoor courts
      final outdoorCourts = outdoorData.map((json) {
        final id = (json['id'] as String?) ?? 'unknown';
        final name = (json['name'] as String?) ?? 'Basketball Court';
        
        // Only explicitly marked signature courts or those in curated list
        final isSignature = json['signature'] == true || 
            json['isSignature'] == true ||
            isSignatureCourt(name);

        return Court(
          id: id,
          name: name,
          lat: (json['lat'] as num).toDouble(),
          lng: (json['lng'] as num).toDouble(),
          address: (json['city'] as String?) ?? (json['address'] as String?),
          isSignature: isSignature,
          isIndoor: false,
        );
      }).toList();
      
      // Process indoor venues - NOT all are signature, only famous ones
      final indoorCourts = indoorData.map((json) {
        final id = (json['id'] as String?) ?? 'unknown';
        final name = (json['name'] as String?) ?? 'Indoor Court';
        final category = (json['category'] as String?) ?? 'other';
        
        // Indoor signature if explicitly marked or in curated list
        final isSignature = json['signature'] == true ||
            json['isSignature'] == true ||
            isSignatureCourt(name);
        
        return Court(
          id: id,
          name: name,
          lat: (json['lat'] as num).toDouble(),
          lng: (json['lng'] as num).toDouble(),
          address: (json['city'] as String?) ?? (json['address'] as String?),
          isSignature: isSignature,
          isIndoor: true,
        );
      }).toList();
      
      // Merge both datasets
      _courts = [...outdoorCourts, ...indoorCourts];

      // Add The Olympic Club San Francisco as a featured signature court
      const brettUserId = '3zIDc7PjlYYksXxZp6nH6EbILeh1';
      final olympicClub = Court(
        id: 'olympic_club_sf',
        name: 'The Olympic Club',
        lat: 37.7878,
        lng: -122.4099,
        address: '524 Post Street, San Francisco, CA',
        isSignature: true,
        isIndoor: true,
        king1v1: 'Brett Corbett',
        king1v1Id: brettUserId,
        king1v1Rating: 4.95,
      );
      
      // Insert at the beginning so it appears prominently
      _courts.insert(0, olympicClub);

      _isLoaded = true;
      print('Loaded ${_courts.length} courts (${outdoorCourts.length} outdoor, ${indoorCourts.length} indoor)');
    } catch (e, st) {
      print('Error loading courts: $e\n$st');
      _courts = [];
    }
  }

  /// Check if courts are loaded
  bool get isLoaded => _isLoaded;

  /// Get all loaded courts
  List<Court> get courts => _courts;

  List<Court> getCourts() {
    return _courts;
  }

  Court? getCourtById(String id) {
    try {
      return _courts.firstWhere((c) => c.id == id);
    } catch (e) {
      return null;
    }
  }

  // Helper to find courts near a location
  List<Court> getCourtsNear(double lat, double lng, {double radiusKm = 50}) {
    return _courts.where((court) {
      final distanceInMeters = Geolocator.distanceBetween(lat, lng, court.lat, court.lng);
      return distanceInMeters <= (radiusKm * 1000);
    }).toList()
      ..sort((a, b) {
        final distA = Geolocator.distanceBetween(lat, lng, a.lat, a.lng);
        final distB = Geolocator.distanceBetween(lat, lng, b.lat, b.lng);
        return distA.compareTo(distB);
      });
  }

  List<Court> getCourtsInBounds(double south, double west, double north, double east, {int limit = 100}) {
    return _courts.where((court) {
      return court.lat >= south &&
             court.lat <= north &&
             court.lng >= west &&
             court.lng <= east;
    }).take(limit).toList();
  }

  List<Court> searchCourts(String query) {
    if (query.isEmpty) return _courts;
    final lowerQuery = query.toLowerCase();
    return _courts.where((court) {
      return court.name.toLowerCase().contains(lowerQuery) ||
             (court.address?.toLowerCase().contains(lowerQuery) ?? false);
    }).toList();
  }
}

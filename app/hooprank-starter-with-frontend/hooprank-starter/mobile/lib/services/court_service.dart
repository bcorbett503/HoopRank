import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import '../models.dart';
import 'mock_courts_data.dart';

class CourtService {
  static final CourtService _instance = CourtService._internal();
  factory CourtService() => _instance;
  CourtService._internal();

  List<Court> _courts = [];
  bool _isLoaded = false;

  Future<void> loadCourts() async {
    if (_isLoaded) return;

    try {
      // Use hardcoded mock data (from OSM Overpass)
      final List<Map<String, dynamic>> data = mockCourtsData;

      _courts = data.map((json) {
        final id = (json['id'] as String?) ?? 'unknown';
        final name = (json['name'] as String?) ?? 'Basketball Court';
        final hash = id.hashCode.abs();
        
        // Determine if this is a signature court
        // Signature courts have special names or are well-known venues
        final nameUpper = name.toUpperCase();
        final isSignature = nameUpper.contains('ARENA') ||
            nameUpper.contains('CENTER') ||
            nameUpper.contains('CENTRE') ||
            nameUpper.contains('GYMNASIUM') ||
            nameUpper.contains('STADIUM') ||
            nameUpper.contains('COLISEUM') ||
            nameUpper.contains('GYM') ||
            nameUpper.contains('FIELDHOUSE') ||
            nameUpper.contains('OLYMPIC CLUB') ||
            (hash % 15 == 0); // Also include ~7% of other courts for demo

        return Court(
          id: id,
          name: name,
          lat: (json['lat'] as num).toDouble(),
          lng: (json['lng'] as num).toDouble(),
          address: (json['city'] as String?) ?? (json['address'] as String?),
          isSignature: isSignature,
          // Kings will be populated from real backend data when available
        );
      }).toList();

      // Add The Olympic Club San Francisco as a featured signature court
      // Located at 524 Post Street, San Francisco
      final olympicClub = Court(
        id: 'olympic_club_sf',
        name: 'The Olympic Club',
        lat: 37.7878,
        lng: -122.4099,
        address: '524 Post Street, San Francisco, CA',
        isSignature: true,
        king1v1: 'Brett Corbett',
        king1v1Rating: 4.95,
        king3v3: 'Brett Corbett',
        king3v3Rating: 4.90,
        king5v5: 'Brett Corbett',
        king5v5Rating: 4.85,
      );
      
      // Insert at the beginning so it appears prominently
      _courts.insert(0, olympicClub);

      _isLoaded = true;
      print('Loaded ${_courts.length} courts from mock data');
    } catch (e, st) {
      print('Error loading courts: $e\n$st');
      _courts = [];
    }
  }

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

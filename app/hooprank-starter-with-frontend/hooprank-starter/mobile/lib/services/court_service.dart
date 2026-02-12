import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import '../models.dart';
import 'api_service.dart';

class CourtService {
  static final CourtService _instance = CourtService._internal();
  factory CourtService() => _instance;
  CourtService._internal();

  List<Court> _courts = [];
  bool _isLoaded = false;

  Future<void> loadCourts() async {
    if (_isLoaded) return;

    try {
      debugPrint('CourtService: Loading courts from API (primary source)...');
      
      // PRIMARY: Fetch ALL courts from API (includes all discovery data)
      bool apiLoaded = false;
      try {
        // Startup timeout: avoid blocking first-load on weak networks.
        // Falls back to local assets if API doesn't respond in 10 seconds.
        final apiCourts = await ApiService.getCourtsFromApi(limit: 5000)
            .timeout(const Duration(seconds: 10));
        debugPrint('CourtService: Fetched ${apiCourts.length} courts from API');
        
        if (apiCourts.isNotEmpty) {
          _courts = apiCourts;
          for (final court in apiCourts) {
            _registerApiCourt(court);
          }
          apiLoaded = true;
        }
      } catch (e) {
        debugPrint('CourtService: API fetch failed: $e');
      }
      
      // FALLBACK: Load from local JSON asset if API failed
      if (!apiLoaded) {
        // Telemetry: log fallback usage so auth/backend failures don't silently
        // degrade into stale local court data.
        debugPrint('[TELEMETRY] CourtService: API unreachable — falling back to local assets. '
            'This may indicate auth timing or network issues.');
        final jsonString = await rootBundle.loadString('assets/data/courts_named.json');
        final List<dynamic> jsonData = jsonDecode(jsonString);
        
        _courts = jsonData.map((json) => Court(
          id: json['id'] as String? ?? 'unknown',
          name: json['name'] as String? ?? 'Court',
          lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
          lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
          address: json['city'] as String?,
          isIndoor: json['indoor'] == true,
          access: json['access'] as String? ?? 'public',
          isSignature: json['signatureCity'] == true,
        )).toList();
        debugPrint('CourtService: Loaded ${_courts.length} courts from local assets (fallback)');
      }

      // Always include The Olympic Club as a featured court
      const brettUserId = '3zIDc7PjlYYksXxZp6nH6EbILeh1';
      final olympicClub = Court(
        id: '44444444-4444-4444-4444-444444444444',
        name: 'The Olympic Club',
        lat: 37.7878,
        lng: -122.4099,
        address: '524 Post Street, San Francisco, CA',
        isSignature: true,
        isIndoor: true,
        access: 'members',
        king1v1: 'Brett Corbett',
        king1v1Id: brettUserId,
        king1v1Rating: 4.95,
      );
      
      // Insert at beginning if not already present
      if (!_courts.any((c) => c.id == olympicClub.id)) {
        _courts.insert(0, olympicClub);
      }

      _isLoaded = true;
      debugPrint('CourtService: Total courts available: ${_courts.length}');
    } catch (e, st) {
      debugPrint('CourtService: Error loading courts: $e\n$st');
      // Use fallback signature courts on error
      _courts = _getSignatureCourtsFallback();
      _isLoaded = true;
    }
  }

  /// Fallback list of famous signature courts when API unavailable
  List<Court> _getSignatureCourtsFallback() {
    return [
      // NYC
      Court(id: 'rucker', name: 'Rucker Park', lat: 40.8302, lng: -73.9360, isSignature: true, isIndoor: false),
      Court(id: 'west4th', name: 'West 4th Street Courts (The Cage)', lat: 40.7321, lng: -74.0006, isSignature: true, isIndoor: false),
      Court(id: 'dyckman', name: 'Dyckman Park', lat: 40.8665, lng: -73.9273, isSignature: true, isIndoor: false),
      // LA
      Court(id: 'venice', name: 'Venice Beach Courts', lat: 33.9850, lng: -118.4695, isSignature: true, isIndoor: false),
      // Chicago
      Court(id: 'seward', name: 'Seward Park', lat: 41.9022, lng: -87.6564, isSignature: true, isIndoor: false),
      // Philadelphia
      Court(id: 'hankgathers', name: 'Hank Gathers Recreation Center', lat: 39.9774, lng: -75.1532, isSignature: true, isIndoor: true),
      // Bay Area
      Court(id: 'mosswood', name: 'Mosswood Park', lat: 37.8258, lng: -122.2608, isSignature: true, isIndoor: false),
    ];
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
      // Fallback: search in API courts map if we have one with this ID
      final apiCourt = _apiCourtsById[id];
      if (apiCourt != null) {
        return apiCourt;
      }
      return null;
    }
  }
  
  /// Find court by name (for cross-ID-format deep linking)
  Court? getCourtByName(String name) {
    try {
      return _courts.firstWhere(
        (c) => c.name.toLowerCase() == name.toLowerCase()
      );
    } catch (e) {
      // Try partial match
      try {
        return _courts.firstWhere(
          (c) => c.name.toLowerCase().contains(name.toLowerCase()) ||
                 name.toLowerCase().contains(c.name.toLowerCase())
        );
      } catch (e) {
        return null;
      }
    }
  }
  
  /// Lookup court by ID or fallback to name
  Court? findCourt({String? id, String? name, double? lat, double? lng}) {
    // First try by ID
    if (id != null && id.isNotEmpty) {
      final byId = getCourtById(id);
      if (byId != null) return byId;
    }
    
    // Then try by name
    if (name != null && name.isNotEmpty) {
      final byName = getCourtByName(name);
      if (byName != null) return byName;
    }
    
    // Finally try by coordinates (within ~100m)
    if (lat != null && lng != null) {
      try {
        return _courts.firstWhere(
          (c) => (c.lat - lat).abs() < 0.001 && (c.lng - lng).abs() < 0.001
        );
      } catch (e) {
        return null;
      }
    }
    
    return null;
  }
  
  // Map to store API courts by their IDs for quick lookup
  final Map<String, Court> _apiCourtsById = {};
  
  /// Register an API court for lookup (called when merging API courts)
  void _registerApiCourt(Court court) {
    _apiCourtsById[court.id] = court;
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

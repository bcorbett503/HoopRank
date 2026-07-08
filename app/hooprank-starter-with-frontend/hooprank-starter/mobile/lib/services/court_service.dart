import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import '../models.dart';
import 'api_service.dart';

typedef CourtServiceApiCourtsLoader = Future<List<Court>> Function({
  double? lat,
  double? lng,
  int limit,
});
typedef CourtServiceAssetLoader = Future<String> Function(String key);

enum _CourtDataSource { api, assetFallback, signatureFallback }

class CourtService extends ChangeNotifier {
  static final CourtService _instance = CourtService._internal();
  factory CourtService() => _instance;
  CourtService._internal();

  List<Court> _courts = [];
  bool _isLoaded = false;
  DateTime? _lastLoadedAt;
  _CourtDataSource? _lastSource;
  Future<void>? _ongoingLoad;
  Timer? _fallbackRetryTimer;
  int _fallbackRetryAttempts = 0;
  static const _staleDuration = Duration(minutes: 30);
  static const _fallbackRetryDelay = Duration(minutes: 1);
  static const _apiRetryAttempts = 3;
  static const _maxFallbackRetryAttempts = 3;

  @visibleForTesting
  CourtServiceApiCourtsLoader? apiCourtsLoaderOverride;

  @visibleForTesting
  CourtServiceAssetLoader? assetLoaderOverride;

  @visibleForTesting
  Duration? fallbackRetryDelayOverride;

  bool get _isStale {
    if (_lastLoadedAt == null) return true;
    final age = DateTime.now().difference(_lastLoadedAt!);
    if (_lastSource == _CourtDataSource.api) {
      return age > _staleDuration;
    }
    return age > _fallbackRetryDelay;
  }

  Future<void> loadCourts({bool force = false}) async {
    if (!force && _isLoaded && !_isStale) return;
    if (_ongoingLoad != null) {
      return _ongoingLoad!;
    }

    final loadFuture = _loadCourtsInternal(force: force);
    _ongoingLoad = loadFuture;
    try {
      await loadFuture;
    } finally {
      if (identical(_ongoingLoad, loadFuture)) {
        _ongoingLoad = null;
      }
    }
  }

  Future<void> _loadCourtsInternal({required bool force}) async {
    try {
      debugPrint('CourtService: Loading courts from API (primary source)...');

      final hadExistingCourts = _courts.isNotEmpty;
      final previousCount = _courts.length;
      final previousSource = _lastSource;

      final apiCourts = await _fetchApiCourtsWithRetry(limit: 5000);
      if (apiCourts.isNotEmpty) {
        _applyApiCourts(apiCourts);
        return;
      }

      if (hadExistingCourts) {
        debugPrint(
            '[TELEMETRY] CourtService: API unavailable — preserving $previousCount previously loaded courts '
            'from ${previousSource?.name ?? 'unknown'} instead of falling back to bundled assets.');
        _isLoaded = true;
        if (previousSource != _CourtDataSource.api) {
          _scheduleFallbackRetry();
        }
        return;
      }

      // First-load fallback only: if the app has no live court data yet, use the
      // bundled snapshot so the map can still render something offline.
      debugPrint(
          '[TELEMETRY] CourtService: API unreachable on cold load — falling back to local assets. '
          'This is a stale snapshot and will be retried soon.');
      _applyFallbackCourts(await _loadAssetFallbackCourts(),
          source: _CourtDataSource.assetFallback);
    } catch (e, st) {
      debugPrint('CourtService: Error loading courts: $e\n$st');
      if (_courts.isNotEmpty) {
        debugPrint(
            '[TELEMETRY] CourtService: Preserving ${_courts.length} existing courts after load error.');
        _isLoaded = true;
        if (_lastSource != _CourtDataSource.api) {
          _scheduleFallbackRetry();
        }
        return;
      }
      _applyFallbackCourts(_getSignatureCourtsFallback(),
          source: _CourtDataSource.signatureFallback);
    }
  }

  Future<List<Court>> _fetchApiCourtsWithRetry({int limit = 5000}) async {
    Object? lastError;
    for (var attempt = 1; attempt <= _apiRetryAttempts; attempt++) {
      try {
        final apiCourts = await _loadCourtsFromApi(limit: limit)
            .timeout(const Duration(seconds: 10));
        debugPrint(
            'CourtService: API attempt $attempt fetched ${apiCourts.length} courts');
        if (apiCourts.isNotEmpty) {
          return apiCourts;
        }
      } catch (e) {
        lastError = e;
        debugPrint('CourtService: API attempt $attempt failed: $e');
      }

      if (attempt < _apiRetryAttempts) {
        await Future<void>.delayed(Duration(milliseconds: 500 * attempt));
      }
    }

    if (lastError != null) {
      debugPrint('CourtService: Exhausted API retries: $lastError');
    }
    return const [];
  }

  Future<List<Court>> _loadCourtsFromApi({int limit = 5000}) {
    final loader = apiCourtsLoaderOverride;
    if (loader != null) {
      return loader(limit: limit);
    }
    return ApiService.getCourtsFromApi(limit: limit);
  }

  Future<List<Court>> _loadAssetFallbackCourts() async {
    final assetLoader = assetLoaderOverride ?? rootBundle.loadString;
    final jsonString = await assetLoader('assets/data/courts_named.json');
    final List<dynamic> jsonData = jsonDecode(jsonString);

    return jsonData
        .map((json) => Court(
              id: json['id'] as String? ?? 'unknown',
              name: json['name'] as String? ?? 'Court',
              lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
              lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
              address: json['city'] as String?,
              isIndoor: json['indoor'] == true,
              access: json['access'] as String? ?? 'public',
              isSignature: json['signatureCity'] == true,
            ))
        .toList();
  }

  void _applyApiCourts(List<Court> apiCourts) {
    _courts = apiCourts;
    _apiCourtsById.clear();
    for (final court in apiCourts) {
      _registerApiCourt(court);
    }
    _fallbackRetryTimer?.cancel();
    _fallbackRetryTimer = null;
    _fallbackRetryAttempts = 0;
    _isLoaded = true;
    _lastLoadedAt = DateTime.now();
    _lastSource = _CourtDataSource.api;
    debugPrint('CourtService: Total courts available: ${_courts.length}');
    notifyListeners();
  }

  void _applyFallbackCourts(List<Court> fallbackCourts,
      {required _CourtDataSource source}) {
    _courts = fallbackCourts;
    _apiCourtsById.clear();
    _isLoaded = true;
    _lastLoadedAt = DateTime.now();
    _lastSource = source;
    debugPrint(
        'CourtService: Loaded ${_courts.length} courts from ${source.name}');
    notifyListeners();
    _scheduleFallbackRetry();
  }

  void _scheduleFallbackRetry() {
    if (_fallbackRetryAttempts >= _maxFallbackRetryAttempts) {
      debugPrint(
          '[TELEMETRY] CourtService: Reached max fallback retry attempts; waiting for the next manual refresh.');
      return;
    }

    _fallbackRetryTimer?.cancel();
    final nextAttempt = _fallbackRetryAttempts + 1;
    final retryDelay = fallbackRetryDelayOverride ?? _fallbackRetryDelay;
    _fallbackRetryTimer = Timer(retryDelay, () async {
      _fallbackRetryTimer = null;
      _fallbackRetryAttempts = nextAttempt;
      debugPrint(
          '[TELEMETRY] CourtService: Retrying API court load after fallback '
          '($nextAttempt/$_maxFallbackRetryAttempts).');
      await loadCourts(force: true);
    });
  }

  /// Fallback list of famous signature courts when API unavailable
  List<Court> _getSignatureCourtsFallback() {
    return [
      // NYC
      Court(
          id: 'rucker',
          name: 'Rucker Park',
          lat: 40.8302,
          lng: -73.9360,
          isSignature: true,
          isIndoor: false),
      Court(
          id: 'west4th',
          name: 'West 4th Street Courts (The Cage)',
          lat: 40.7321,
          lng: -74.0006,
          isSignature: true,
          isIndoor: false),
      Court(
          id: 'dyckman',
          name: 'Dyckman Park',
          lat: 40.8665,
          lng: -73.9273,
          isSignature: true,
          isIndoor: false),
      // LA
      Court(
          id: 'venice',
          name: 'Venice Beach Courts',
          lat: 33.9850,
          lng: -118.4695,
          isSignature: true,
          isIndoor: false),
      // Chicago
      Court(
          id: 'seward',
          name: 'Seward Park',
          lat: 41.9022,
          lng: -87.6564,
          isSignature: true,
          isIndoor: false),
      // Philadelphia
      Court(
          id: 'hankgathers',
          name: 'Hank Gathers Recreation Center',
          lat: 39.9774,
          lng: -75.1532,
          isSignature: true,
          isIndoor: true),
      // Bay Area
      Court(
          id: 'mosswood',
          name: 'Mosswood Park',
          lat: 37.8258,
          lng: -122.2608,
          isSignature: true,
          isIndoor: false),
    ];
  }

  /// Force a fresh reload from the API (used on app resume).
  Future<void> forceRefresh() async {
    await loadCourts(force: true);
  }

  @visibleForTesting
  void resetForTesting() {
    _courts = [];
    _apiCourtsById.clear();
    _isLoaded = false;
    _lastLoadedAt = null;
    _lastSource = null;
    _fallbackRetryTimer?.cancel();
    _fallbackRetryTimer = null;
    _fallbackRetryAttempts = 0;
    apiCourtsLoaderOverride = null;
    assetLoaderOverride = null;
    fallbackRetryDelayOverride = null;
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
      return _courts
          .firstWhere((c) => c.name.toLowerCase() == name.toLowerCase());
    } catch (e) {
      // Try partial match
      try {
        return _courts.firstWhere((c) =>
            c.name.toLowerCase().contains(name.toLowerCase()) ||
            name.toLowerCase().contains(c.name.toLowerCase()));
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
            (c) => (c.lat - lat).abs() < 0.001 && (c.lng - lng).abs() < 0.001);
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
      final distanceInMeters =
          Geolocator.distanceBetween(lat, lng, court.lat, court.lng);
      return distanceInMeters <= (radiusKm * 1000);
    }).toList()
      ..sort((a, b) {
        final distA = Geolocator.distanceBetween(lat, lng, a.lat, a.lng);
        final distB = Geolocator.distanceBetween(lat, lng, b.lat, b.lng);
        return distA.compareTo(distB);
      });
  }

  /// Return courts within a bounding box.
  ///
  /// NOTE: `limit` is optional. CourtMapWidget applies filtering (indoor/outdoor,
  /// followed, runs, etc) and then caps the result based on zoom level to avoid
  /// rendering thousands of markers at once.
  List<Court> getCourtsInBounds(
      double south, double west, double north, double east,
      {int? limit}) {
    final results = _courts.where((court) {
      return court.lat >= south &&
          court.lat <= north &&
          court.lng >= west &&
          court.lng <= east;
    });

    if (limit != null) return results.take(limit).toList();
    return results.toList();
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

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import '../models.dart';
import 'api_service.dart';

typedef CourtServiceBboxLoader = Future<List<Court>> Function({
  required double south,
  required double west,
  required double north,
  required double east,
  int limit,
});
typedef CourtServiceAssetLoader = Future<String> Function(String key);

/// Regionally-loaded court store.
///
/// The old design downloaded the ENTIRE court index (225k courts, ~100 MB
/// JSON) at startup, which OOMed low-RAM phones. Now the cache fills from
/// server bbox fetches: one around the device's last-known location at
/// startup, then per-viewport as the map moves; individual courts resolve
/// by id and global search hits the server. The bundled 35k snapshot is an
/// OFFLINE DISPLAY fallback only — its `site-N` ids are not valid backend
/// UUIDs, so it must never be the primary layer for follows/matches/runs.
class CourtService extends ChangeNotifier {
  static final CourtService _instance = CourtService._internal();
  factory CourtService() => _instance;
  CourtService._internal();

  final Map<String, Court> _courtsById = {};
  List<Court> _courts = [];
  bool _isLoaded = false;
  bool _initialRegionLoaded = false;
  bool _assetFallbackLoaded = false;
  Future<void>? _ongoingLoad;

  // Regional overlay bookkeeping: bbox fetches are snapped to grid cells so
  // panning around the same metro doesn't refetch. Cells expire after
  // [_regionTtl] so follower counts/images stay reasonably fresh.
  static const double _regionCellDegrees = 0.5;
  static const Duration _regionTtl = Duration(minutes: 30);
  static const int _regionFetchLimit = 1000;
  // A bbox wider than this (whole-country zooms) isn't worth fetching — the
  // base snapshot already paints overview zooms and the server caps rows.
  static const double _maxRegionSpanDegrees = 6.0;
  final Map<String, DateTime> _fetchedRegionCells = {};
  final Set<String> _regionCellsInFlight = {};
  final Set<String> _assetCourtIds = {};
  final Map<String, Future<Court?>> _inflightResolvesById = {};

  @visibleForTesting
  CourtServiceBboxLoader? bboxLoaderOverride;

  @visibleForTesting
  CourtServiceAssetLoader? assetLoaderOverride;

  /// Warms the cache with real server courts around the device's last-known
  /// location (no permission prompt). Offline cold-start falls back to the
  /// bundled display-only snapshot so the map still paints something.
  Future<void> loadCourts({bool force = false}) async {
    if (_initialRegionLoaded && !force) return;
    if (_ongoingLoad != null) {
      // Join the in-flight load; a force still gets its own run afterward.
      await _ongoingLoad!;
      if (!force || _ongoingLoad != null) return;
    }
    final loadFuture = _loadInitialRegion();
    _ongoingLoad = loadFuture;
    try {
      await loadFuture;
    } finally {
      if (identical(_ongoingLoad, loadFuture)) {
        _ongoingLoad = null;
      }
    }
  }

  Future<void> _loadInitialRegion() async {
    try {
      Position? position;
      try {
        position = await Geolocator.getLastKnownPosition();
      } catch (_) {
        position = null;
      }
      if (position != null) {
        // ~±55 km box around the user; merges real backend courts.
        await ensureRegionLoaded(
          position.latitude - 0.5,
          position.longitude - 0.5,
          position.latitude + 0.5,
          position.longitude + 0.5,
        );
      }
      _initialRegionLoaded = _courtsById.isNotEmpty;
    } catch (e) {
      debugPrint('CourtService: initial region load failed: $e');
    } finally {
      // Offline (or no location yet): keep the map paintable with the
      // bundled snapshot. Server rows replace these as soon as any region
      // fetch succeeds.
      if (_courtsById.isEmpty) {
        await _loadAssetFallbackIntoCache();
      }
      _isLoaded = true;
      notifyListeners();
    }
  }

  Future<void> _loadAssetFallbackIntoCache() async {
    if (_assetFallbackLoaded) return;
    try {
      final assetCourts = await _loadAssetFallbackCourts();
      for (final court in assetCourts) {
        if (_courtsById.containsKey(court.id)) continue;
        _assetCourtIds.add(court.id);
      }
      _mergeCourts(assetCourts, overwrite: false);
      _assetFallbackLoaded = true;
      debugPrint(
          '[TELEMETRY] CourtService: offline — using bundled snapshot (${_courts.length} courts, display-only ids)');
    } catch (e) {
      debugPrint('CourtService: asset fallback failed: $e');
      if (_courtsById.isEmpty) {
        _mergeCourts(_getSignatureCourtsFallback(), overwrite: false);
      }
    }
  }

  /// Fetch any not-yet-loaded cells overlapping the given bounds and merge
  /// the richer server rows into the store. Fire-and-forget from the map's
  /// viewport updates: when new courts land, listeners are notified and the
  /// map recomputes.
  Future<void> ensureRegionLoaded(
      double south, double west, double north, double east) async {
    if ((north - south).abs() > _maxRegionSpanDegrees ||
        (east - west).abs() > _maxRegionSpanDegrees) {
      return;
    }

    // Pad so small pans stay inside the fetched area.
    final latPad = (north - south).abs() * 0.25;
    final lngPad = (east - west).abs() * 0.25;
    final s = south - latPad, n = north + latPad;
    final w = west - lngPad, e = east + lngPad;

    final now = DateTime.now();
    final staleCells = <String>[];
    for (final cell in _cellsForBounds(s, w, n, e)) {
      final fetchedAt = _fetchedRegionCells[cell];
      final fresh = fetchedAt != null && now.difference(fetchedAt) < _regionTtl;
      if (!fresh && !_regionCellsInFlight.contains(cell)) {
        staleCells.add(cell);
      }
    }
    if (staleCells.isEmpty) return;
    _regionCellsInFlight.addAll(staleCells);

    try {
      final loader = bboxLoaderOverride ?? _fetchBboxFromApi;
      final regionCourts = await loader(
        south: s,
        west: w,
        north: n,
        east: e,
        limit: _regionFetchLimit,
      );
      var changed = _evictAssetCourts();
      changed = _mergeCourts(regionCourts, overwrite: true) || changed;
      // A response at the row cap was truncated (alphabetical, not spatial):
      // don't stamp the cells, so zooming in refetches the smaller bbox.
      if (regionCourts.length < _regionFetchLimit) {
        final fetchedAt = DateTime.now();
        for (final cell in staleCells) {
          _fetchedRegionCells[cell] = fetchedAt;
        }
      }
      if (changed) {
        debugPrint(
            'CourtService: region merge added/updated courts (cache now ${_courts.length})');
        notifyListeners();
      }
    } catch (e) {
      debugPrint('CourtService: region fetch failed (will retry on pan): $e');
    } finally {
      _regionCellsInFlight.removeAll(staleCells);
    }
  }

  Future<List<Court>> _fetchBboxFromApi({
    required double south,
    required double west,
    required double north,
    required double east,
    int limit = _regionFetchLimit,
  }) {
    return ApiService.getCourtsInBbox(
      south: south,
      west: west,
      north: north,
      east: east,
      limit: limit,
    ).timeout(const Duration(seconds: 10));
  }

  Iterable<String> _cellsForBounds(
      double south, double west, double north, double east) sync* {
    final s = (south / _regionCellDegrees).floor();
    final n = (north / _regionCellDegrees).floor();
    final w = (west / _regionCellDegrees).floor();
    final e = (east / _regionCellDegrees).floor();
    for (var lat = math.min(s, n); lat <= math.max(s, n); lat++) {
      for (var lng = math.min(w, e); lng <= math.max(w, e); lng++) {
        yield '$lat:$lng';
      }
    }
  }

  /// Resolve a court by id, fetching from the server when it isn't cached
  /// (deep links / followed courts outside any loaded region). Concurrent
  /// callers for the same id share one request.
  Future<Court?> resolveCourtById(String id) {
    final cached = getCourtById(id);
    if (cached != null) return Future.value(cached);
    final inflight = _inflightResolvesById[id];
    if (inflight != null) return inflight;

    final future = _resolveCourtByIdRemote(id).whenComplete(() {
      _inflightResolvesById.remove(id);
    });
    _inflightResolvesById[id] = future;
    return future;
  }

  Future<Court?> _resolveCourtByIdRemote(String id) async {
    try {
      final fetched = await ApiService.getCourtByIdFromApi(id)
          .timeout(const Duration(seconds: 8));
      var changed = _evictAssetCourts();
      if (fetched != null) {
        changed = _mergeCourts([fetched], overwrite: true) || changed;
      }
      if (changed) notifyListeners();
      return fetched;
    } catch (e) {
      debugPrint('CourtService: resolveCourtById($id) failed: $e');
      return null;
    }
  }

  /// Resolve many ids (e.g. courts with scheduled runs) — only misses hit
  /// the network, a few at a time. Bounded at 60 network resolves per call
  /// as a runaway guard; callers with larger sets should move to a bulk
  /// endpoint before that bound matters.
  Future<void> resolveCourtsByIds(Iterable<String> ids) async {
    final missing = ids.where((id) => getCourtById(id) == null).toList();
    if (missing.isEmpty) return;
    const batchSize = 6;
    for (var i = 0; i < missing.length && i < 60; i += batchSize) {
      final batch = missing.skip(i).take(batchSize);
      await Future.wait(batch.map(resolveCourtById));
    }
  }

  /// Server-side global search; results merge into the cache so the sync
  /// [searchCourts] (and marker taps) see them immediately.
  Future<List<Court>> searchCourtsRemote(String query, {int limit = 50}) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return const [];
    try {
      final results =
          await ApiService.searchCourtsFromApi(trimmed, limit: limit)
              .timeout(const Duration(seconds: 8));
      var changed = _evictAssetCourts();
      if (results.isNotEmpty) {
        changed = _mergeCourts(results, overwrite: true) || changed;
      }
      if (changed) notifyListeners();
      return results;
    } catch (e) {
      debugPrint('CourtService: remote search failed: $e');
      return const [];
    }
  }

  /// Merge courts into the id-keyed store. Server rows ([overwrite] true)
  /// replace existing entries (they carry images/follower counts); the
  /// offline snapshot never clobbers server rows. Returns true only when
  /// the store actually changed — identical refetches must NOT notify, or
  /// the notify → map recompute → refetch ring never settles.
  bool _mergeCourts(List<Court> incoming, {required bool overwrite}) {
    var changed = false;
    for (final court in incoming) {
      if (court.id.isEmpty) continue;
      final existing = _courtsById[court.id];
      if (existing == null || (overwrite && !_sameCourt(existing, court))) {
        _courtsById[court.id] = court;
        changed = true;
      }
    }
    if (changed) {
      _courts = _courtsById.values.toList(growable: false);
    }
    return changed;
  }

  bool _sameCourt(Court a, Court b) {
    return a.name == b.name &&
        a.lat == b.lat &&
        a.lng == b.lng &&
        a.address == b.address &&
        a.isIndoor == b.isIndoor &&
        a.access == b.access &&
        a.isSignature == b.isSignature &&
        a.venueType == b.venueType &&
        a.imageUrl == b.imageUrl &&
        a.followerCount == b.followerCount &&
        a.hasUpcomingRun == b.hasUpcomingRun &&
        a.hasUpcomingActivity == b.hasUpcomingActivity;
  }

  /// Offline-snapshot rows carry `site-N` ids that are NOT valid backend
  /// UUIDs. The moment any server fetch succeeds (connectivity proven),
  /// evict them all so they can't produce duplicate markers or leak
  /// invalid ids into follows/matches/check-ins. Returns true if evicted.
  bool _evictAssetCourts() {
    if (_assetCourtIds.isEmpty) return false;
    for (final id in _assetCourtIds) {
      _courtsById.remove(id);
    }
    _assetCourtIds.clear();
    _assetFallbackLoaded = false;
    _courts = _courtsById.values.toList(growable: false);
    debugPrint(
        'CourtService: server reachable — evicted offline snapshot rows');
    return true;
  }

  /// True when a court id came from the offline snapshot (display-only —
  /// never submit these ids to the backend).
  bool isDisplayOnlyCourt(String id) => _assetCourtIds.contains(id);

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

  /// Fallback list of famous signature courts when the bundled asset fails
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

  /// App-resume refresh: expire the regional overlay so the next viewport
  /// update refetches fresh rows (no giant reload).
  Future<void> forceRefresh() async {
    _fetchedRegionCells.clear();
    await loadCourts(force: true);
  }

  @visibleForTesting
  void resetForTesting() {
    _courts = [];
    _courtsById.clear();
    _fetchedRegionCells.clear();
    _regionCellsInFlight.clear();
    _assetCourtIds.clear();
    _inflightResolvesById.clear();
    _isLoaded = false;
    _initialRegionLoaded = false;
    _assetFallbackLoaded = false;
    bboxLoaderOverride = null;
    assetLoaderOverride = null;
  }

  /// Check if courts are loaded
  bool get isLoaded => _isLoaded;

  /// Get all loaded courts
  List<Court> get courts => _courts;

  List<Court> getCourts() {
    return _courts;
  }

  Court? getCourtById(String id) {
    return _courtsById[id];
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

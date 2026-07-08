import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models.dart';
import '../models/map_hub_models.dart';
import '../services/court_service.dart';
import '../services/api_service.dart';
import '../state/check_in_state.dart';
import '../state/app_state.dart';
import 'package:go_router/go_router.dart';
import '../utils/court_images.dart';
import '../utils/flat_avatar.dart';

import 'avatar_image.dart';
import 'basketball_marker.dart';
import 'player_map_marker.dart';
import 'player_status_sheet.dart';

const double kCourtSelectionZoom = 16.0;
const double kCourtDeepLinkPreviewZoom = 16.0;
const double kUserLocationInitialZoom = 12.5;
const Color kCourtFilterAccentColor = Color(0xFFF47C2C);
const Color kCourtFilterAccentBorderColor = Color(0xFFFFB067);
const Color kCourtFilterHintColor = Color(0xFF1FA463);
const Color kCourtFilterHintBorderColor = Color(0xFF7ED8A5);
const int kTopFollowerLegacyPrefetchBatchLimit = 8;

enum CourtFollowFilterMode {
  all,
  mine,
  allFollowed,
}

const String kCourtFollowFilterEducationPrefsPrefix =
    'court_follow_filter_education_v1_';

String? courtFollowFilterEducationPrefsKeyForUser(String? userId) {
  final trimmed = userId?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }
  return '$kCourtFollowFilterEducationPrefsPrefix$trimmed';
}

bool shouldShowCourtFollowFilterEducation({
  required bool preferenceLoaded,
  required bool educationCompleted,
  required CourtFollowFilterMode followFilterMode,
}) {
  return preferenceLoaded &&
      !educationCompleted &&
      followFilterMode != CourtFollowFilterMode.all;
}

List<Court> buildCourtListForViewport({
  required List<Court> visibleCourts,
  Court? previewCourt,
  required bool showPreviewCourtOnly,
}) {
  if (!showPreviewCourtOnly || previewCourt == null) {
    return visibleCourts;
  }

  for (final court in visibleCourts) {
    if (court.id == previewCourt.id) {
      return [court];
    }
  }

  return [previewCourt];
}

bool courtHasFollowOrScheduledRunSignal({
  required Court court,
  required bool isFollowing,
  required int followerCountFromState,
}) {
  final knownFollowerCount = court.followerCount ?? 0;
  return isFollowing ||
      followerCountFromState > 0 ||
      knownFollowerCount > 0 ||
      court.hasUpcomingRun;
}

class CourtMapWidget extends StatefulWidget {
  final Function(Court) onCourtSelected;
  final double? limitDistanceKm;
  final String? initialCourtId;
  final double? initialLat;
  final double? initialLng;
  final String? initialCourtName;
  final bool showCourtList;
  final bool showPlayers;
  final bool showStatusBubbles;
  final bool showHubControls;
  final String? initialRunsFilter;
  final bool? initialIndoorFilter;
  final Function(MapHubPlayer)? onPlayerSelected;
  final VoidCallback? onFeedSelected;

  const CourtMapWidget({
    super.key,
    required this.onCourtSelected,
    this.limitDistanceKm,
    this.initialCourtId,
    this.initialLat,
    this.initialLng,
    this.initialCourtName,
    this.showCourtList = true,
    this.showPlayers = false,
    this.showStatusBubbles = false,
    this.showHubControls = false,
    this.initialRunsFilter,
    this.initialIndoorFilter = true,
    this.onPlayerSelected,
    this.onFeedSelected,
  });

  @override
  State<CourtMapWidget> createState() => _CourtMapWidgetState();
}

class _CourtMapWidgetState extends State<CourtMapWidget>
    with WidgetsBindingObserver {
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  final CourtService _courtService = CourtService();
  Timer? _debounceTimer;
  List<Court> _courts = [];
  int? _courtsTotalBeforeCap; // Used to show "zoom in" hint when we cap results
  int? _courtsCapLimit;
  bool _isLoading = true;
  LatLng _initialCenter =
      const LatLng(38.0194, -122.5376); // Default to San Rafael
  double _currentZoom = kUserLocationInitialZoom;
  LatLng? _currentUserMapPoint;
  CourtFollowFilterMode _followFilterMode = CourtFollowFilterMode.all;
  bool? _filterIndoor; // null=all, true=indoor only, false=outdoor only
  String? _filterAccess; // null=all, 'public', 'private'
  String? _runsFilter; // null=off, 'today'=runs today, 'all'=all upcoming runs
  Set<String> _courtsWithRuns = {}; // Court IDs with runs (based on filter)
  Court? _deepLinkPreviewCourt;
  bool _showDeepLinkPreviewOnly = false;
  bool _mapReady = false;
  bool _didAutoOpenDeepLinkDetails = false;
  final Map<String, CourtTopFollower?> _topFollowersByCourtId = {};
  final Set<String> _topFollowerRequestsInFlight = {};
  bool _didLoadFollowFilterEducation = false;
  bool _hasCompletedFollowFilterEducation = false;
  String? _followFilterEducationUserId;
  MapHubPrivacy _mapHubPrivacy = const MapHubPrivacy();
  final Map<String, MapHubCourt> _mapHubCourtsById = {};
  List<MapHubPlayer> _mapHubPlayers = [];
  bool _isMapHubLoading = false;
  bool _hubPlayersVisible = true;
  bool _hubCourtsVisible = true;
  bool _isSavingMapVisibility = false;

  bool _noCourtsFound = false;
  bool _didInitialZoomOutToFindCourts = false;

  bool get _isMapHubEnabled =>
      widget.showPlayers || widget.showStatusBubbles || widget.showHubControls;

  LatLng? _currentUserProfilePoint() {
    final user = Provider.of<AuthState>(context, listen: false).currentUser;
    final lat = user?.lat;
    final lng = user?.lng;
    if (user?.locEnabled != true || lat == null || lng == null) {
      return null;
    }
    if (lat == 0 && lng == 0) {
      return null;
    }
    return LatLng(lat, lng);
  }

  MapHubPlayer? _currentUserMapPlayer(User? user) {
    final point = _currentUserMapPoint;
    if (point == null) return null;

    if (user == null) return null;

    // listen: true so the marker's status pill updates live when the player
    // sets a new status from the sheet.
    final currentStatus =
        Provider.of<CheckInState>(context).getMyStatus()?.trim();
    final statusLabel =
        currentStatus == null || currentStatus.isEmpty ? 'now' : currentStatus;

    return MapHubPlayer(
      id: user.id,
      name: user.name,
      avatarUrl: user.photoUrl,
      avatarConfig: user.avatarConfig,
      rating: user.rating,
      position: user.position,
      city: user.city,
      lat: point.latitude,
      lng: point.longitude,
      customStatus: currentStatus,
      statusLabel: statusLabel,
      acceptingChallenges: user.acceptingChallenges,
      isCurrentUser: true,
    );
  }

  Future<void> _loadMapHubData({bool force = false}) async {
    if (!_isMapHubEnabled) return;
    if (_isMapHubLoading && !force) return;

    final center = _mapReady ? _mapController.camera.center : _initialCenter;
    final radiusKm = _calculateRadiusFromZoom(_currentZoom);
    final radiusMiles = (radiusKm * 0.621371).clamp(1.0, 100.0).toDouble();

    _isMapHubLoading = true;
    final hub = await ApiService.getMapHub(
      lat: center.latitude,
      lng: center.longitude,
      radiusMiles: radiusMiles,
      includePlayers: widget.showPlayers,
    );

    if (!mounted) return;
    setState(() {
      if (hub != null) {
        _mapHubPrivacy = hub.privacy;
        _mapHubPlayers = hub.players;
        _mapHubCourtsById
          ..clear()
          ..addEntries(
              hub.courts.map((court) => MapEntry(court.court.id, court)));
      }
      _isMapHubLoading = false;
    });
  }

  Future<void> _toggleMapVisibility(bool enabled) async {
    if (_isSavingMapVisibility) return;
    final authState = Provider.of<AuthState>(context, listen: false);
    final userId = authState.currentUser?.id;
    if (userId == null || userId.isEmpty) return;

    setState(() => _isSavingMapVisibility = true);
    try {
      if (enabled) {
        final position = await _determinePosition();
        await ApiService.updateProfile(userId, {
          'lat': position.latitude,
          'lng': position.longitude,
          'locEnabled': true,
        });
      } else {
        await ApiService.updateProfile(userId, {'locEnabled': false});
      }

      final settings = await ApiService.updatePrivacySettings({
        'mapVisibilityEnabled': enabled,
        'publicLocation': enabled,
      });
      final parsedSettings = Map<String, dynamic>.from(settings)
        ..remove('success');

      if (!mounted) return;
      setState(() {
        _mapHubPrivacy = MapHubPrivacy.fromJson(parsedSettings);
      });
      await _loadMapHubData(force: true);
    } catch (e) {
      debugPrint('MAP HUB: Failed to update visibility: $e');
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          const SnackBar(content: Text('Unable to update map visibility.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSavingMapVisibility = false);
      }
    }
  }

  List<Court> _mergeMapHubCourtData(List<Court> courts) {
    if (_mapHubCourtsById.isEmpty) return courts;
    return courts.map((court) {
      final hubCourt = _mapHubCourtsById[court.id];
      if (hubCourt == null) return court;
      return court.copyWithKings(
        followerCount: hubCourt.followerCount,
        imageUrl: hubCourt.court.imageUrl,
        imageSourceUrl: hubCourt.court.imageSourceUrl,
        imageSourceLabel: hubCourt.court.imageSourceLabel,
        topFollower: hubCourt.topFollower,
        hasUpcomingRun: hubCourt.court.hasUpcomingRun,
        hasUpcomingActivity: hubCourt.activeCheckInCount > 0 ||
            hubCourt.court.hasUpcomingActivity,
      );
    }).toList();
  }

  bool _courtHasAnyFollowers(Court court, CheckInState checkInState) {
    final followerCountFromState = checkInState.getFollowerCount(court.id);
    return courtHasFollowOrScheduledRunSignal(
      court: court,
      isFollowing: checkInState.isFollowing(court.id),
      followerCountFromState: followerCountFromState,
    );
  }

  int _followFilterCount(CheckInState checkInState) {
    switch (_followFilterMode) {
      case CourtFollowFilterMode.mine:
        return checkInState.followedCourts.length;
      case CourtFollowFilterMode.allFollowed:
        return checkInState.courtsWithFollowersCount;
      case CourtFollowFilterMode.all:
        return 0;
    }
  }

  bool _courtMatchesActiveFilters(Court court, CheckInState checkInState) {
    switch (_followFilterMode) {
      case CourtFollowFilterMode.mine:
        if (!checkInState.isFollowing(court.id)) {
          return false;
        }
        break;
      case CourtFollowFilterMode.allFollowed:
        if (!_courtHasAnyFollowers(court, checkInState)) {
          return false;
        }
        break;
      case CourtFollowFilterMode.all:
        break;
    }

    // Indoor/Outdoor filter
    if (_filterIndoor != null && court.isIndoor != _filterIndoor) {
      return false;
    }

    // Access filter
    if (_filterAccess != null) {
      if (_filterAccess == 'private') {
        final isPrivate = court.access == 'members' || court.access == 'paid';
        if (!isPrivate) return false;
      } else {
        if (court.access != _filterAccess) return false;
      }
    }

    // Runs filter (today or all upcoming)
    if (_runsFilter != null && !_courtsWithRuns.contains(court.id)) {
      return false;
    }

    return true;
  }

  CourtTopFollower? _resolvedTopFollowerForCourt(Court court) {
    final hubTopFollower = _mapHubCourtsById[court.id]?.topFollower;
    if (hubTopFollower != null) {
      return hubTopFollower;
    }
    if (_topFollowersByCourtId.containsKey(court.id)) {
      return _topFollowersByCourtId[court.id];
    }
    return court.topFollower;
  }

  void _prefetchTopFollowers(List<Court> courts) {
    if (!mounted || courts.isEmpty) return;

    final checkInState = Provider.of<CheckInState>(context, listen: false);
    var legacyRequestsStarted = 0;
    for (final court in courts) {
      final existingTopFollower =
          _mapHubCourtsById[court.id]?.topFollower ?? court.topFollower;
      if (existingTopFollower != null) {
        _topFollowersByCourtId.putIfAbsent(court.id, () => existingTopFollower);
        continue;
      }

      if (_isMapHubEnabled) {
        continue;
      }

      final followerCountFromState = checkInState.getFollowerCount(court.id);
      final knownFollowerCount = court.followerCount ?? 0;
      final shouldTryLoading = knownFollowerCount > 0 ||
          followerCountFromState > 0 ||
          checkInState.isFollowing(court.id);

      if (!shouldTryLoading ||
          _topFollowersByCourtId.containsKey(court.id) ||
          _topFollowerRequestsInFlight.contains(court.id)) {
        continue;
      }

      if (legacyRequestsStarted >= kTopFollowerLegacyPrefetchBatchLimit) {
        break;
      }

      legacyRequestsStarted++;
      _topFollowerRequestsInFlight.add(court.id);
      unawaited(_loadTopFollowerForCourt(court.id));
    }
  }

  Future<void> _loadTopFollowerForCourt(String courtId) async {
    try {
      final followers = await ApiService.getCourtFollowers(courtId, limit: 1);
      final leader = followers.isEmpty
          ? null
          : CourtTopFollower(
              id: followers.first.id,
              name: followers.first.name,
              photoUrl: followers.first.photoUrl,
              rating: followers.first.rating,
            );

      _topFollowersByCourtId[courtId] = leader;
      if (!mounted) return;
      setState(() {});
    } catch (e) {
      debugPrint('MAP: Failed to load top follower for court $courtId: $e');
    } finally {
      _topFollowerRequestsInFlight.remove(courtId);
    }
  }

  Future<void> _zoomOutUntilAtLeastOneCourtVisible() async {
    // "Landing" behavior: avoid empty maps when default filters exclude nearby courts.
    if (_didInitialZoomOutToFindCourts) return;

    // If this map is being used in a limited-radius context, zooming out is
    // misleading (we should only show courts within the limit).
    if (widget.limitDistanceKm != null) return;

    final hasDeepLink = widget.initialCourtId != null ||
        widget.initialCourtName != null ||
        (widget.initialLat != null && widget.initialLng != null);
    if (hasDeepLink) return;

    // Only do this in browse mode (empty query). If the user is searching,
    // they expect the map to stay put.
    if (_searchController.text.trim().isNotEmpty) return;

    _didInitialZoomOutToFindCourts = true;

    // Ensure the initial viewport is reflected in the marker list.
    _updateCourtsForMapCenter();

    // Zoom out in steps until at least one court passes filters in view.
    const minZoom = 6.0;
    const step = 1.0;
    const maxSteps = 12;

    var steps = 0;
    while (mounted &&
        _courts.isEmpty &&
        _currentZoom > minZoom &&
        steps < maxSteps) {
      final nextZoom = (_currentZoom - step).clamp(minZoom, 18.0).toDouble();
      if (nextZoom == _currentZoom) break;

      _mapController.move(_mapController.camera.center, nextZoom);
      setState(() => _currentZoom = nextZoom);
      _updateCourtsForMapCenter();

      // Give the map a moment to rebuild markers if needed.
      await Future.delayed(const Duration(milliseconds: 60));
      steps++;
    }

    if (!mounted) return;
    if (_courts.isEmpty) {
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content: Text(
              'No courts found nearby. Try searching or changing filters.'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  double _suggestedZoomForRunDistanceMeters(double meters) {
    // Heuristic zoom-out levels so "Find Runs" jumps show context.
    // (Lower zoom = more zoomed out.)
    final double baseZoom;
    if (meters >= 300000) {
      baseZoom = 7.5; // 300km+
    } else if (meters >= 150000) {
      baseZoom = 8.5; // 150km+
    } else if (meters >= 50000) {
      baseZoom = 9.5; // 50km+
    } else if (meters >= 15000) {
      baseZoom = 11.0; // 15km+
    } else if (meters >= 5000) {
      baseZoom = 12.5; // 5km+
    } else if (meters >= 1500) {
      baseZoom = 13.5; // 1.5km+
    } else {
      baseZoom = 14.5;
    }

    // One extra notch out for better context on "Find Runs" jumps.
    return (baseZoom - 1.0).clamp(3.0, 18.0).toDouble();
  }

  void _maybePanToNearestCourtWithRun() {
    if (_runsFilter == null) return;

    final messenger = ScaffoldMessenger.maybeOf(context);

    if (_courtsWithRuns.isEmpty) {
      messenger?.showSnackBar(
        const SnackBar(content: Text('No scheduled runs found.')),
      );
      return;
    }

    final checkInState = Provider.of<CheckInState>(context, listen: false);
    final bounds = _mapController.camera.visibleBounds;
    final courtsInView = _courtService.getCourtsInBounds(
      bounds.south,
      bounds.west,
      bounds.north,
      bounds.east,
    );

    // If there are any courts with runs in the current viewport, keep the
    // camera where it is (no surprise jump).
    if (courtsInView.any((c) => _courtMatchesActiveFilters(c, checkInState))) {
      return;
    }

    final from = _mapController.camera.center;
    const distance = Distance();

    Court? nearest;
    double nearestMeters = double.infinity;

    for (final court in _courtService.getCourts()) {
      if (!_courtMatchesActiveFilters(court, checkInState)) continue;

      // If this widget is being used in a limited-radius context, don't jump
      // outside the allowed area.
      if (widget.limitDistanceKm != null) {
        final metersFromOrigin = distance.as(
          LengthUnit.Meter,
          _initialCenter,
          LatLng(court.lat, court.lng),
        );
        if (metersFromOrigin > widget.limitDistanceKm! * 1000) continue;
      }

      final meters =
          distance.as(LengthUnit.Meter, from, LatLng(court.lat, court.lng));
      if (meters < nearestMeters) {
        nearestMeters = meters;
        nearest = court;
      }
    }

    if (nearest == null) {
      messenger?.showSnackBar(
        const SnackBar(
            content: Text('No courts with runs match your filters.')),
      );
      return;
    }

    final target = LatLng(nearest.lat, nearest.lng);
    final zoom = _suggestedZoomForRunDistanceMeters(nearestMeters);
    _mapController.move(target, zoom);
    setState(() => _currentZoom = zoom);

    // Update markers immediately instead of waiting for the debounce.
    _updateCourtsForMapCenter();

    final miles = nearestMeters / 1609.344;
    messenger?.showSnackBar(
      SnackBar(
        content: Text(
          'No runs in view. Nearest run: ${nearest.name} (${miles.toStringAsFixed(1)} mi)',
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _filterIndoor = widget.initialIndoorFilter;
    _runsFilter = widget.initialRunsFilter;
    WidgetsBinding.instance.addObserver(this);
    _courtService.addListener(_handleCourtServiceChanged);
    _initializeMap();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id.trim();
    if (_followFilterEducationUserId == userId &&
        _didLoadFollowFilterEducation) {
      return;
    }
    _followFilterEducationUserId = userId;
    unawaited(_loadFollowFilterEducationState());
  }

  @override
  void didUpdateWidget(covariant CourtMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    final deepLinkChanged = widget.initialCourtId != oldWidget.initialCourtId ||
        widget.initialCourtName != oldWidget.initialCourtName ||
        widget.initialLat != oldWidget.initialLat ||
        widget.initialLng != oldWidget.initialLng;

    if (!deepLinkChanged) {
      return;
    }

    _didAutoOpenDeepLinkDetails = false;

    final hasDeepLink = widget.initialCourtId != null ||
        widget.initialCourtName != null ||
        (widget.initialLat != null && widget.initialLng != null);

    if (!hasDeepLink) {
      _dismissDeepLinkPreview();
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _handleDeepLinkNavigation();
    });
  }

  void _dismissDeepLinkPreview() {
    if (!_showDeepLinkPreviewOnly && _deepLinkPreviewCourt == null) {
      return;
    }

    setState(() {
      _showDeepLinkPreviewOnly = false;
      _deepLinkPreviewCourt = null;
    });
  }

  void _activateDeepLinkPreview(Court court) {
    final target = LatLng(court.lat, court.lng);
    setState(() {
      _clearMapFilters();
      _deepLinkPreviewCourt = court;
      _showDeepLinkPreviewOnly = true;
      _currentZoom = kCourtDeepLinkPreviewZoom;
    });
    _mapController.move(target, kCourtDeepLinkPreviewZoom);
    _updateCourtsForMapCenter();
  }

  void _openDeepLinkCourtDetails(Court court) {
    if (_didAutoOpenDeepLinkDetails) {
      return;
    }

    _didAutoOpenDeepLinkDetails = true;
    Future.delayed(const Duration(milliseconds: 250), () {
      if (!mounted) {
        return;
      }
      widget.onCourtSelected(court);
    });
  }

  /// Zoom to a court's location and show its details.
  void _zoomToCourtAndSelect(
    Court court, {
    double zoom = kCourtSelectionZoom,
    bool showDetails = true,
  }) {
    debugPrint(
        'MAP: Zooming to court: ${court.name} at (${court.lat}, ${court.lng})');
    final target = LatLng(court.lat, court.lng);

    if (_showDeepLinkPreviewOnly) {
      _dismissDeepLinkPreview();
    }

    _mapController.move(target, zoom);
    setState(() {
      _currentZoom = zoom;
    });
    _updateCourtsForMapCenter();

    if (!showDetails) {
      return;
    }

    // Show court details sheet after a brief delay to allow map animation
    Future.delayed(const Duration(milliseconds: 200), () {
      if (mounted) {
        widget.onCourtSelected(court);
      }
    });
  }

  void _clearMapFilters() {
    _followFilterMode = CourtFollowFilterMode.all;
    _filterIndoor = null;
    _filterAccess = null;
    _runsFilter = null;
    _courtsWithRuns = {};
  }

  Court? _resolveDeepLinkCourt() {
    Court? targetCourt;

    if (widget.initialCourtId != null) {
      targetCourt = _courtService.getCourtById(widget.initialCourtId!);
      targetCourt ??= _courtService.findCourt(
        id: widget.initialCourtId!,
        name: widget.initialCourtName,
        lat: widget.initialLat,
        lng: widget.initialLng,
      );
    }

    if (targetCourt == null && widget.initialCourtName != null) {
      targetCourt = _courtService.getCourtByName(widget.initialCourtName!);
    }

    return targetCourt;
  }

  LatLng? _currentDeepLinkTarget() {
    if (_deepLinkPreviewCourt != null) {
      return LatLng(_deepLinkPreviewCourt!.lat, _deepLinkPreviewCourt!.lng);
    }

    if (widget.initialLat != null && widget.initialLng != null) {
      return LatLng(widget.initialLat!, widget.initialLng!);
    }

    return null;
  }

  void _primeInitialDeepLinkPreview(Court? targetCourt) {
    _clearMapFilters();

    if (targetCourt != null) {
      _deepLinkPreviewCourt = targetCourt;
      _showDeepLinkPreviewOnly = true;
      _initialCenter = LatLng(targetCourt.lat, targetCourt.lng);
      _currentZoom = kCourtDeepLinkPreviewZoom;
      _courts = [targetCourt];
      return;
    }

    if (widget.initialLat != null && widget.initialLng != null) {
      _initialCenter = LatLng(widget.initialLat!, widget.initialLng!);
      _currentZoom = kCourtDeepLinkPreviewZoom;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _courtService.removeListener(_handleCourtServiceChanged);
    _debounceTimer?.cancel();
    _mapController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshCourtsFromService(force: true);
    }
  }

  void _handleCourtServiceChanged() {
    if (!mounted || _isLoading) return;

    if (_searchController.text.trim().isNotEmpty) {
      _onSearchChanged(_searchController.text);
      return;
    }

    if (widget.limitDistanceKm != null) {
      final nearbyCourts = _applyFilters(_courtService.getCourtsNear(
        _initialCenter.latitude,
        _initialCenter.longitude,
        radiusKm: widget.limitDistanceKm!,
      ));
      final capped =
          _capCourtsForPerformance(nearbyCourts, isSearchMode: false);
      _prefetchTopFollowers(capped);
      setState(() {
        _courts = capped;
        _noCourtsFound = capped.isEmpty;
      });
      return;
    }

    if (_mapReady) {
      _updateCourtsForMapCenter();
      return;
    }

    final allCourts = _applyFilters(_courtService.getCourts());
    final capped = _capCourtsForPerformance(allCourts, isSearchMode: false);
    _prefetchTopFollowers(capped);
    setState(() {
      _courts = capped;
    });
  }

  void _refreshCourtsFromService({bool force = false}) {
    if (force) {
      unawaited(_courtService.forceRefresh());
    } else {
      unawaited(_courtService.loadCourts());
    }
  }

  Future<void> _initializeMap() async {
    // Check if we have deep link parameters BEFORE doing async work
    final hasDeepLink = widget.initialCourtId != null ||
        widget.initialCourtName != null ||
        (widget.initialLat != null && widget.initialLng != null);

    await _courtService.loadCourts();
    await _loadInitialRunsFilterIfNeeded();
    final courts = _courtService.getCourts();

    final initialDeepLinkCourt = hasDeepLink ? _resolveDeepLinkCourt() : null;
    if (initialDeepLinkCourt != null) {
      debugPrint('MAP: Priming deep link court: ${initialDeepLinkCourt.name}');
    }

    if (hasDeepLink) {
      if (mounted) {
        setState(() {
          _primeInitialDeepLinkPreview(initialDeepLinkCourt);
          if (_courts.isEmpty) {
            _courts = courts;
          }
          _isLoading = false;
        });
        _prefetchTopFollowers(_courts);
      }
      return;
    }

    bool locationObtained = false;

    // First, try to get the user's GPS location
    try {
      Position position = await _determinePosition();
      _initialCenter = LatLng(position.latitude, position.longitude);
      _currentUserMapPoint = _initialCenter;
      _currentZoom = kUserLocationInitialZoom;
      locationObtained = true;
      debugPrint(
          'MAP: Using GPS location: ${position.latitude}, ${position.longitude}');

      if (widget.limitDistanceKm != null) {
        final nearbyCourts = _courtService.getCourtsNear(
            position.latitude, position.longitude,
            radiusKm: widget.limitDistanceKm!);

        if (mounted) {
          final filteredNearbyCourts = _applyFilters(nearbyCourts);
          _prefetchTopFollowers(filteredNearbyCourts);
          setState(() {
            _courts = filteredNearbyCourts;
            _noCourtsFound = nearbyCourts.isEmpty;
            _isLoading = false;
            _currentZoom = kUserLocationInitialZoom;
          });
          return;
        }
      }
    } catch (e) {
      debugPrint('MAP: GPS location failed: $e');
    }

    // If GPS failed, the app will simply use the default coordinates (San Rafael).
    // The legacy Zip Code fallback logic was removed as profiles now use City.

    // Log if using default location
    if (!locationObtained) {
      final profilePoint = _currentUserProfilePoint();
      if (profilePoint != null) {
        _initialCenter = profilePoint;
        _currentUserMapPoint = profilePoint;
        _currentZoom = kUserLocationInitialZoom;
        locationObtained = true;
        debugPrint(
            'MAP: Using profile location: ${profilePoint.latitude}, ${profilePoint.longitude}');
      } else {
        debugPrint('MAP: Using default location (San Rafael)');
      }
    }

    if (mounted) {
      final filteredCourts =
          _capCourtsForPerformance(_applyFilters(courts), isSearchMode: true);
      _prefetchTopFollowers(filteredCourts);
      setState(() {
        _courts = filteredCourts;
        _isLoading = false;
      });
    }
  }

  /// Handle deep link navigation after map is ready
  void _handleDeepLinkNavigation() {
    Court? targetCourt = _resolveDeepLinkCourt();
    if (widget.initialCourtId != null) {
      debugPrint('MAP: Deep link court ID: ${widget.initialCourtId}');
    }

    // If still not found but we have coordinates, navigate to that location anyway
    if (targetCourt == null &&
        widget.initialLat != null &&
        widget.initialLng != null) {
      debugPrint(
          'MAP: Court not found, but navigating to coordinates: ${widget.initialLat}, ${widget.initialLng}');
      final target = LatLng(widget.initialLat!, widget.initialLng!);
      _dismissDeepLinkPreview();
      _mapController.move(target, kCourtDeepLinkPreviewZoom);
      setState(() {
        _currentZoom = kCourtDeepLinkPreviewZoom;
      });
      _updateCourtsForMapCenter();
    } else if (targetCourt != null) {
      debugPrint('MAP: Found deep link court: ${targetCourt.name}');
      if (_mapReady) {
        _zoomToCourtAndSelect(targetCourt);
      } else {
        _activateDeepLinkPreview(targetCourt);
      }
    } else if (widget.initialCourtId != null) {
      debugPrint('MAP: Court not found for ID: ${widget.initialCourtId}');
    }
  }

  Future<Position> _determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return Future.error('Location services are disabled.');
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return Future.error('Location permissions are denied');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return Future.error('Location permissions are permanently denied.');
    }

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.bestForNavigation,
    );
  }

  Future<void> _moveToUserLocation() async {
    try {
      _dismissDeepLinkPreview();
      Position position = await _determinePosition();
      if (!mounted) return;
      final point = LatLng(position.latitude, position.longitude);
      _mapController.move(point, kUserLocationInitialZoom);
      setState(() {
        _currentZoom = kUserLocationInitialZoom;
        _currentUserMapPoint = point;
      });
      _updateCourtsForMapCenter();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not get location: $e')),
      );
    }
  }

  void _onSearchChanged(String query) {
    _dismissDeepLinkPreview();

    final trimmed = query.trim();

    // Empty search means "browse the map". Never render the entire court set at once.
    // This prevents crashes when toggling filters (e.g., Indoor -> Outdoor) while zoomed out.
    if (trimmed.isEmpty) {
      _updateCourtsForMapCenter();
      return;
    }

    List<Court> filteredCourts = _courtService.searchCourts(trimmed);
    filteredCourts = _applyFilters(filteredCourts);

    final capped = _capCourtsForPerformance(filteredCourts, isSearchMode: true);
    if (!mounted) return;
    _prefetchTopFollowers(capped);
    setState(() {
      _courts = capped;
    });
  }

  void _setFollowFilter(CourtFollowFilterMode mode) {
    _dismissDeepLinkPreview();
    if (_followFilterMode == mode) {
      return;
    }
    setState(() {
      _followFilterMode = mode;
    });
    // Re-run search with current query
    _onSearchChanged(_searchController.text);
  }

  String? _followFilterEducationPrefsKey() {
    return courtFollowFilterEducationPrefsKeyForUser(
      Provider.of<AuthState>(context, listen: false).currentUser?.id,
    );
  }

  Future<void> _loadFollowFilterEducationState() async {
    final prefsKey = _followFilterEducationPrefsKey();
    if (prefsKey == null) {
      if (!mounted) return;
      setState(() {
        _didLoadFollowFilterEducation = true;
        _hasCompletedFollowFilterEducation = false;
      });
      return;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final completed = prefs.getBool(prefsKey) ?? false;
      if (!mounted) return;
      setState(() {
        _didLoadFollowFilterEducation = true;
        _hasCompletedFollowFilterEducation = completed;
      });
    } catch (e) {
      debugPrint('MAP: Failed to load court follow filter education: $e');
      if (!mounted) return;
      setState(() {
        _didLoadFollowFilterEducation = true;
        _hasCompletedFollowFilterEducation = false;
      });
    }
  }

  Future<void> _completeFollowFilterEducation() async {
    if (_hasCompletedFollowFilterEducation) {
      return;
    }

    if (mounted) {
      setState(() {
        _hasCompletedFollowFilterEducation = true;
      });
    } else {
      _hasCompletedFollowFilterEducation = true;
    }

    final prefsKey = _followFilterEducationPrefsKey();
    if (prefsKey == null) {
      return;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(prefsKey, true);
    } catch (e) {
      debugPrint('MAP: Failed to save court follow filter education: $e');
    }
  }

  bool get _shouldShowFollowFilterEducation =>
      shouldShowCourtFollowFilterEducation(
        preferenceLoaded: _didLoadFollowFilterEducation,
        educationCompleted: _hasCompletedFollowFilterEducation,
        followFilterMode: _followFilterMode,
      );

  Widget _buildFollowFilterEducationCallout() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 210),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: kCourtFilterHintColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: kCourtFilterHintBorderColor.withValues(alpha: 0.95),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.16),
              blurRadius: 10,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.only(top: 1),
              child: Icon(
                Icons.filter_alt_rounded,
                size: 14,
                color: Colors.white,
              ),
            ),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Tap filters to see all courts.',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _toggleIndoorFilter(bool? value) {
    _dismissDeepLinkPreview();
    setState(() {
      _filterIndoor = value;
    });
    _onSearchChanged(_searchController.text);
  }

  void _setAccessFilter(String? access) {
    _dismissDeepLinkPreview();
    setState(() {
      _filterAccess = access;
    });
    _onSearchChanged(_searchController.text);
  }

  Future<void> _setRunsFilter(String? filter) async {
    _dismissDeepLinkPreview();
    if (filter == null) {
      // Clear runs filter
      setState(() {
        _runsFilter = null;
        _courtsWithRuns = {};
      });
    } else {
      try {
        // Load court IDs with runs from API.
        final courtsWithRuns = await _loadCourtsWithRuns(filter);
        if (!mounted) return;
        setState(() {
          _runsFilter = filter;
          _courtsWithRuns = courtsWithRuns;
        });
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(content: Text('Could not load scheduled runs: $e')),
        );
      }
    }
    _onSearchChanged(_searchController.text);

    // If the "Find Runs" filter results in an empty viewport, jump to the
    // nearest court with a run and zoom out for context.
    if (filter != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _maybePanToNearestCourtWithRun();
      });
    }
  }

  Future<Set<String>> _loadCourtsWithRuns(String filter) {
    return ApiService.getCourtsWithRuns(today: filter == 'today');
  }

  Future<void> _loadInitialRunsFilterIfNeeded() async {
    final filter = widget.initialRunsFilter;
    if (filter == null) return;

    _runsFilter = filter;
    try {
      _courtsWithRuns = await _loadCourtsWithRuns(filter);
    } catch (e) {
      debugPrint('MAP: Could not load initial scheduled-run filter: $e');
      _runsFilter = null;
      _courtsWithRuns = {};
    }
  }

  List<Court> _applyFilters(List<Court> courts) {
    var filtered = courts;
    final checkInState = Provider.of<CheckInState>(context, listen: false);

    filtered = filtered
        .where((court) => _courtMatchesActiveFilters(court, checkInState))
        .toList();
    return filtered;
  }

  void _updateCourtsForMapCenter() {
    // Use visible bounds to filter courts - only show courts actually visible on map
    final bounds = _mapController.camera.visibleBounds;

    var courtsInView = _courtService.getCourtsInBounds(
      bounds.south,
      bounds.west,
      bounds.north,
      bounds.east,
    );

    // Apply filters to map view as well
    courtsInView = _applyFilters(courtsInView);

    final capped = _capCourtsForPerformance(courtsInView, isSearchMode: false);
    _prefetchTopFollowers(capped);

    if (mounted) {
      setState(() {
        _courts = capped;
      });
    }
    unawaited(_loadMapHubData());
  }

  int _maxCourtsForZoom(double zoom) {
    // Rendering thousands of markers will crash/jank on iOS.
    // At low zoom levels, granularity doesn't matter anyway, so we cap aggressively.
    if (zoom >= 15) return 400;
    if (zoom >= 13) return 250;
    if (zoom >= 11) return 150;
    return 80;
  }

  List<Court> _capCourtsForPerformance(List<Court> courts,
      {required bool isSearchMode}) {
    final max = _maxCourtsForZoom(_currentZoom);
    _courtsTotalBeforeCap = null;
    _courtsCapLimit = null;

    if (courts.length <= max) return courts;

    _courtsTotalBeforeCap = courts.length;
    _courtsCapLimit = max;

    // In browse mode, prioritize courts closest to the map center so the map stays useful.
    // In search mode, we avoid distance sorting (it can hide far-away matches); just cap
    // deterministically and rely on the list + selection to navigate.
    if (!isSearchMode) {
      final center = _mapController.camera.center;
      const distance = Distance();
      final withDistance = courts
          .map((c) => MapEntry(
                c,
                distance.as(LengthUnit.Meter, center, LatLng(c.lat, c.lng)),
              ))
          .toList()
        ..sort((a, b) => a.value.compareTo(b.value));
      return withDistance.take(max).map((e) => e.key).toList();
    }

    final sortedByName = [...courts]..sort((a, b) => a.name.compareTo(b.name));
    return sortedByName.take(max).toList();
  }

  // Keep this for backwards compatibility with initial load
  double _calculateRadiusFromZoom(double zoom) {
    // Approximate radius based on zoom level
    // Higher zoom = smaller radius (more zoomed in)
    if (zoom >= 15) return 2.0; // 2km
    if (zoom >= 13) return 5.0; // 5km
    if (zoom >= 11) return 15.0; // 15km
    if (zoom >= 9) return 50.0; // 50km
    return 100.0; // 100km
  }

  void _zoomIn() {
    _dismissDeepLinkPreview();
    setState(() {
      _currentZoom++;
      _mapController.move(_mapController.camera.center, _currentZoom);
    });
  }

  void _zoomOut() {
    _dismissDeepLinkPreview();
    setState(() {
      _currentZoom--;
      _mapController.move(_mapController.camera.center, _currentZoom);
    });
  }

  Widget _kingBadge(String mode, Color color) {
    return Container(
      margin: const EdgeInsets.only(right: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.3),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(mode,
          style: TextStyle(
              fontSize: 9, color: color, fontWeight: FontWeight.bold)),
    );
  }

  /// Filter chip widget for search bar
  Widget _buildFilterChip({
    required IconData icon,
    required String label,
    required bool isSelected,
    required Color color,
    required VoidCallback onTap,
    int? count,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.grey[300],
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 14, color: isSelected ? Colors.white : Colors.grey[700]),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: isSelected ? Colors.white : Colors.grey[700],
              ),
            ),
            if (count != null && count > 0) ...[
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: isSelected ? color.withOpacity(0.7) : Colors.grey[400],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? Colors.white : Colors.grey[700],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Badge widget for court type (indoor/outdoor, access)
  Widget _buildCourtTypeBadge(Court court) {
    // Indoor/Outdoor badge with distinct colors
    final indoorColor = court.isIndoor
        ? const Color(0xFF2196F3) // Blue for indoor
        : const Color(0xFF424242); // Dark grey/asphalt for outdoor
    final indoorIcon = court.isIndoor ? Icons.home : Icons.wb_sunny;
    final indoorLabel = court.isIndoor ? 'Indoor' : 'Outdoor';

    // Access badge colors — 'members' and 'paid' both show as "Private"
    Color accessColor;
    IconData accessIcon;
    final bool isPrivate = court.access == 'members' || court.access == 'paid';
    if (isPrivate) {
      accessColor = const Color(0xFFFF9800); // Orange for private
      accessIcon = Icons.lock;
    } else {
      accessColor = const Color(0xFF4CAF50); // Green for public
      accessIcon = Icons.lock_open;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Indoor/Outdoor badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: indoorColor.withOpacity(0.2),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: indoorColor.withOpacity(0.5)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(indoorIcon, size: 10, color: indoorColor),
              const SizedBox(width: 3),
              Text(
                indoorLabel,
                style: TextStyle(
                    fontSize: 9,
                    color: indoorColor,
                    fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        const SizedBox(width: 4),
        // Access badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: accessColor.withOpacity(0.2),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: accessColor.withOpacity(0.5)),
          ),
          child: Icon(accessIcon, size: 10, color: accessColor),
        ),
      ],
    );
  }

  Widget _buildCourtSelectionHint({
    required Color accentColor,
    required bool isPreviewCourt,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: isPreviewCourt
            ? accentColor.withOpacity(0.08)
            : Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isPreviewCourt
              ? accentColor.withOpacity(0.28)
              : Colors.white.withOpacity(0.1),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.touch_app_rounded,
            size: 15,
            color: isPreviewCourt ? accentColor : Colors.white70,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Select to see details',
              style: TextStyle(
                color: Colors.grey[100],
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Icon(
            Icons.chevron_right_rounded,
            size: 18,
            color: isPreviewCourt ? accentColor : Colors.grey[400],
          ),
        ],
      ),
    );
  }

  String? _courtStatusLabel(Court court, CheckInState checkInState) {
    final hubStatus = _mapHubCourtsById[court.id]?.statusLabel;
    if (hubStatus != null && hubStatus.trim().isNotEmpty) {
      return hubStatus;
    }
    final checkInCount = checkInState.getCheckInCount(court.id);
    if (checkInCount > 0) {
      return checkInCount == 1 ? '1 player here' : '$checkInCount players here';
    }
    if (court.hasUpcomingRun) {
      return 'Run scheduled';
    }
    return null;
  }

  Color _courtStatusColor(Court court, CheckInState checkInState) {
    final hubCourt = _mapHubCourtsById[court.id];
    if ((hubCourt?.activeCheckInCount ?? 0) > 0 ||
        checkInState.getCheckInCount(court.id) > 0) {
      return const Color(0xFF16A34A);
    }
    if (hubCourt?.nextRun != null || court.hasUpcomingRun) {
      return const Color(0xFFFF6B35);
    }
    return const Color(0xFFEA580C);
  }

  Widget _buildCourtMarkerChild({
    required Court court,
    required double markerSize,
    required bool isSignature,
    required bool hasKings,
    required bool hasActivity,
    required CourtTopFollower? topFollower,
    required String? statusLabel,
    required Color statusColor,
  }) {
    final marker = BasketballMarker(
      size: markerSize,
      isLegendary: isSignature,
      hasKing: hasKings || topFollower != null,
      isIndoor: court.isIndoor,
      hasActivity: hasActivity,
      activityColor: statusColor,
      courtImageUrl: courtMarkerImageUrlFor(court),
      avatarUrl: topFollower?.photoUrl,
      avatarLabel: topFollower?.name,
      onTap: () => _zoomToCourtAndSelect(court),
    );

    if (!widget.showStatusBubbles ||
        statusLabel == null ||
        statusLabel.trim().isEmpty) {
      return marker;
    }

    return SizedBox(
      width: 132,
      height: markerSize + 34,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          marker,
          Positioned(
            top: markerSize - 2,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 126),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: statusColor.withValues(alpha: 0.28)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Text(
                statusLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: statusColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapHubControls() {
    if (!widget.showHubControls) return const SizedBox.shrink();

    return Positioned(
      left: 16,
      bottom: 16,
      child: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _isSavingMapVisibility
                    ? null
                    : () => _toggleMapVisibility(
                          !_mapHubPrivacy.mapVisibilityEnabled,
                        ),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  height: 42,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.18),
                        blurRadius: 10,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_isSavingMapVisibility)
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      else
                        Icon(
                          _mapHubPrivacy.mapVisibilityEnabled
                              ? Icons.visibility
                              : Icons.visibility_off,
                          size: 18,
                          color: _mapHubPrivacy.mapVisibilityEnabled
                              ? const Color(0xFF16A34A)
                              : const Color(0xFF6B7280),
                        ),
                      const SizedBox(width: 8),
                      Text(
                        _mapHubPrivacy.mapVisibilityEnabled
                            ? 'Visible'
                            : 'Hidden',
                        style: const TextStyle(
                          color: Color(0xFF111827),
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildHubIconButton(
                  tooltip: 'Players',
                  icon: Icons.groups_rounded,
                  selected: _hubPlayersVisible,
                  onTap: () => setState(
                    () => _hubPlayersVisible = !_hubPlayersVisible,
                  ),
                ),
                const SizedBox(width: 8),
                _buildHubIconButton(
                  tooltip: 'Courts',
                  icon: Icons.sports_basketball,
                  selected: _hubCourtsVisible,
                  onTap: () => setState(
                    () => _hubCourtsVisible = !_hubCourtsVisible,
                  ),
                ),
                if (widget.onFeedSelected != null) ...[
                  const SizedBox(width: 8),
                  _buildHubIconButton(
                    tooltip: 'Feed',
                    icon: Icons.dynamic_feed_rounded,
                    selected: false,
                    onTap: widget.onFeedSelected,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHubIconButton({
    required String tooltip,
    required IconData icon,
    required bool selected,
    required VoidCallback? onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? const Color(0xFFFF6B35) : Colors.white,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.16),
                  blurRadius: 9,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Icon(
              icon,
              color: selected ? Colors.white : const Color(0xFF111827),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_noCourtsFound) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.location_off, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              'No courts found within ${widget.limitDistanceKm}km',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _isLoading = true;
                  _noCourtsFound = false;
                });
                _initializeMap();
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    final listCourts = buildCourtListForViewport(
      visibleCourts: _courts,
      previewCourt: _deepLinkPreviewCourt,
      showPreviewCourtOnly: _showDeepLinkPreviewOnly,
    );
    final rawMarkerCourts =
        _showDeepLinkPreviewOnly && _deepLinkPreviewCourt != null
            ? [_deepLinkPreviewCourt!]
            : _courts;
    final markerCourts =
        _hubCourtsVisible ? _mergeMapHubCourtData(rawMarkerCourts) : <Court>[];
    final authState = Provider.of<AuthState>(context);
    final currentUserMapPlayer = _currentUserMapPlayer(authState.currentUser);
    final currentUserMapPlayerId = currentUserMapPlayer?.id;
    final topOverlayOffset =
        widget.showCourtList ? 16.0 : MediaQuery.of(context).padding.top + 10.0;

    final mapStack = Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _initialCenter,
            initialZoom: _currentZoom,
            onMapReady: () {
              if (!_mapReady) {
                setState(() {
                  _mapReady = true;
                });
              }
              final previewTarget = _currentDeepLinkTarget();
              if (_showDeepLinkPreviewOnly && previewTarget != null) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!mounted || !_showDeepLinkPreviewOnly) {
                    return;
                  }
                  _mapController.move(
                    previewTarget,
                    kCourtDeepLinkPreviewZoom,
                  );
                  setState(() {
                    _currentZoom = kCourtDeepLinkPreviewZoom;
                  });
                  _updateCourtsForMapCenter();
                  if (_deepLinkPreviewCourt != null) {
                    _openDeepLinkCourtDetails(_deepLinkPreviewCourt!);
                  }
                });
                return;
              }

              // Filter courts after map is ready and we can get bounds.
              _updateCourtsForMapCenter();
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                if (_runsFilter != null) {
                  _maybePanToNearestCourtWithRun();
                } else {
                  _zoomOutUntilAtLeastOneCourtVisible();
                }
              });
            },
            onPositionChanged: (position, hasGesture) {
              if (hasGesture && _showDeepLinkPreviewOnly) {
                _dismissDeepLinkPreview();
              }
              _currentZoom = position.zoom ?? 10.0;
              // Debounce court updates to avoid rebuilding on every frame
              _debounceTimer?.cancel();
              _debounceTimer = Timer(const Duration(milliseconds: 150), () {
                _updateCourtsForMapCenter();
              });
            },
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.bcorbett.hooprank',
            ),
            MarkerLayer(
              markers: markerCourts.map((court) {
                // Signature courts get the crown marker and are larger
                final isSignature = court.isSignature;
                final hasKings = court.hasKings;
                final topFollower = _resolvedTopFollowerForCourt(court);
                final hasTopFollower = topFollower != null;
                // Check if court has active check-ins
                final checkInState =
                    Provider.of<CheckInState>(context, listen: false);
                final hasCheckIns = checkInState.hasCheckIns(court.id);
                final statusLabel = _courtStatusLabel(court, checkInState);
                final statusColor = _courtStatusColor(court, checkInState);

                // Determine marker size - slightly larger for the pin design
                double markerSize;

                if (isSignature) {
                  markerSize = 50;
                } else if (court.isIndoor) {
                  markerSize = 42;
                } else if (hasKings) {
                  markerSize = 46;
                } else {
                  markerSize = 40;
                }

                if (hasTopFollower) {
                  markerSize *= 1.25;
                }

                // Scale up selected court slightly
                // (If we had selected court state easily accessible here)

                return Marker(
                  point: LatLng(court.lat, court.lng),
                  width: widget.showStatusBubbles &&
                          statusLabel != null &&
                          statusLabel.trim().isNotEmpty
                      ? 132
                      : markerSize,
                  height: widget.showStatusBubbles &&
                          statusLabel != null &&
                          statusLabel.trim().isNotEmpty
                      ? markerSize + 34
                      : markerSize,
                  alignment: Alignment.topCenter,
                  child: _buildCourtMarkerChild(
                    court: court,
                    markerSize: markerSize,
                    isSignature: isSignature,
                    hasKings: hasKings,
                    hasActivity: hasCheckIns ||
                        (_mapHubCourtsById[court.id]?.activeCheckInCount ?? 0) >
                            0 ||
                        (_mapHubCourtsById[court.id]?.court.hasUpcomingRun ??
                            false) ||
                        court.hasUpcomingRun,
                    topFollower: topFollower,
                    statusLabel: statusLabel,
                    statusColor: statusColor,
                  ),
                );
              }).toList(),
            ),
            if (widget.showPlayers && _hubPlayersVisible)
              MarkerLayer(
                markers: _mapHubPlayers
                    .where((player) => player.lat != 0 || player.lng != 0)
                    .where((player) => player.id != currentUserMapPlayerId)
                    .map(
                      (player) => Marker(
                        point: LatLng(player.lat, player.lng),
                        width: PlayerMapMarker.markerWidth,
                        height: PlayerMapMarker.markerHeight,
                        alignment: Alignment.topCenter,
                        child: PlayerMapMarker(
                          player: player,
                          onTap: () => widget.onPlayerSelected?.call(player),
                        ),
                      ),
                    )
                    .toList(),
              ),
            if (currentUserMapPlayer != null)
              MarkerLayer(
                markers: [
                  Marker(
                    point: LatLng(
                      currentUserMapPlayer.lat,
                      currentUserMapPlayer.lng,
                    ),
                    width: PlayerMapMarker.markerWidth,
                    height: PlayerMapMarker.markerHeight,
                    alignment: Alignment.topCenter,
                    child: PlayerMapMarker(
                      player: currentUserMapPlayer,
                      // Un-customized: tap nudges to profile setup.
                      // Customized: tap opens the status preset sheet.
                      onTap: flatAvatarSvg(currentUserMapPlayer.avatarConfig) ==
                              null
                          ? () => context.go('/profile/setup?returnTo=/play')
                          : () => PlayerStatusSheet.show(context),
                    ),
                  ),
                ],
              ),
          ],
        ),
        Positioned(
          top: topOverlayOffset,
          left: 16,
          right: 16,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Search bar
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
                child: TextField(
                  controller: _searchController,
                  decoration: const InputDecoration(
                    hintText: 'Search courts...',
                    prefixIcon: Icon(Icons.search),
                    border: InputBorder.none,
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                  onChanged: _onSearchChanged,
                ),
              ),
              const SizedBox(height: 8),
              // Simplified filter row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Scheduled Runs dropdown (primary)
                  Expanded(
                    child: PopupMenuButton<String>(
                      onOpened: () {},
                      onSelected: (value) async {
                        if (value == 'off') {
                          await _setRunsFilter(null);
                          return;
                        }

                        await _setRunsFilter(value);
                      },
                      itemBuilder: (context) => [
                        PopupMenuItem(
                          value: 'today',
                          child: Row(
                            children: [
                              Icon(Icons.today,
                                  size: 18,
                                  color: _runsFilter == 'today'
                                      ? Colors.deepOrange
                                      : null),
                              const SizedBox(width: 8),
                              Text('Today',
                                  style: TextStyle(
                                      color: _runsFilter == 'today'
                                          ? Colors.deepOrange
                                          : null)),
                              if (_runsFilter == 'today') const Spacer(),
                              if (_runsFilter == 'today')
                                const Icon(Icons.check,
                                    size: 16, color: Colors.deepOrange),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: 'all',
                          child: Container(
                            width: double.infinity,
                            child: Row(
                              children: [
                                Icon(Icons.calendar_month,
                                    size: 18,
                                    color: _runsFilter == 'all'
                                        ? Colors.deepOrange
                                        : null),
                                const SizedBox(width: 8),
                                Text('All Upcoming',
                                    style: TextStyle(
                                        color: _runsFilter == 'all'
                                            ? Colors.deepOrange
                                            : null)),
                                if (_runsFilter == 'all') const Spacer(),
                                if (_runsFilter == 'all')
                                  const Icon(Icons.check,
                                      size: 16, color: Colors.deepOrange),
                              ],
                            ),
                          ),
                        ),
                        if (_runsFilter != null) ...[
                          const PopupMenuDivider(),
                          const PopupMenuItem(
                            value: 'off',
                            child: Row(
                              children: [
                                Icon(Icons.close, size: 18, color: Colors.grey),
                                SizedBox(width: 8),
                                Text('Clear Filter',
                                    style: TextStyle(color: Colors.grey)),
                              ],
                            ),
                          ),
                        ],
                      ],
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _runsFilter != null
                              ? const Color(0xFFFF5722)
                              : Colors.grey[800],
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.calendar_today,
                              size: 16,
                              color: _runsFilter != null
                                  ? Colors.white
                                  : Colors.grey[400],
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _runsFilter == 'today'
                                  ? 'Today'
                                  : (_runsFilter == 'all'
                                      ? 'All Runs'
                                      : 'Find Runs'),
                              style: TextStyle(
                                color: _runsFilter != null
                                    ? Colors.white
                                    : Colors.grey[400],
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(width: 2),
                            Icon(
                              Icons.arrow_drop_down,
                              size: 16,
                              color: _runsFilter != null
                                  ? Colors.white
                                  : Colors.grey[400],
                            ),
                            if (_courtsWithRuns.isNotEmpty) ...[
                              const SizedBox(width: 2),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${_courtsWithRuns.length}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Indoor/Outdoor filter dropdown
                          PopupMenuButton<String>(
                            onSelected: (value) {
                              switch (value) {
                                case 'all':
                                  setState(() {
                                    _filterIndoor = null;
                                  });
                                  _onSearchChanged(_searchController.text);
                                  break;
                                case 'indoor':
                                  _toggleIndoorFilter(
                                      _filterIndoor == true ? null : true);
                                  break;
                                case 'outdoor':
                                  _toggleIndoorFilter(
                                      _filterIndoor == false ? null : false);
                                  break;
                              }
                            },
                            itemBuilder: (context) => [
                              const PopupMenuItem(
                                value: 'all',
                                child: Row(
                                  children: [
                                    Icon(Icons.clear_all, size: 18),
                                    SizedBox(width: 8),
                                    Text('Show All'),
                                  ],
                                ),
                              ),
                              const PopupMenuDivider(),
                              PopupMenuItem(
                                value: 'indoor',
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.home,
                                      size: 18,
                                      color: _filterIndoor == true
                                          ? kCourtFilterAccentColor
                                          : null,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Indoor',
                                      style: TextStyle(
                                        color: _filterIndoor == true
                                            ? kCourtFilterAccentColor
                                            : null,
                                      ),
                                    ),
                                    if (_filterIndoor == true) const Spacer(),
                                    if (_filterIndoor == true)
                                      const Icon(
                                        Icons.check,
                                        size: 16,
                                        color: kCourtFilterAccentColor,
                                      ),
                                  ],
                                ),
                              ),
                              PopupMenuItem(
                                value: 'outdoor',
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.wb_sunny,
                                      size: 18,
                                      color: _filterIndoor == false
                                          ? kCourtFilterAccentColor
                                          : null,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Outdoor',
                                      style: TextStyle(
                                        color: _filterIndoor == false
                                            ? kCourtFilterAccentColor
                                            : null,
                                      ),
                                    ),
                                    if (_filterIndoor == false) const Spacer(),
                                    if (_filterIndoor == false)
                                      const Icon(
                                        Icons.check,
                                        size: 16,
                                        color: kCourtFilterAccentColor,
                                      ),
                                  ],
                                ),
                              ),
                            ],
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: _filterIndoor != null
                                    ? kCourtFilterAccentColor
                                    : Colors.grey[800],
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: _filterIndoor != null
                                      ? kCourtFilterAccentBorderColor
                                      : Colors.white.withValues(alpha: 0.08),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _filterIndoor == true
                                        ? 'Indoor'
                                        : (_filterIndoor == false
                                            ? 'Outdoor'
                                            : 'All'),
                                    style: TextStyle(
                                      color: _filterIndoor != null
                                          ? Colors.white
                                          : Colors.grey[400],
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Icon(
                                    Icons.filter_alt_rounded,
                                    size: 15,
                                    color: _filterIndoor != null
                                        ? Colors.white
                                        : Colors.grey[400],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Followed scope chip (heart icon only) — last
                          Consumer<CheckInState>(
                            builder: (context, checkInState, _) {
                              final followedCount =
                                  _followFilterCount(checkInState);
                              return PopupMenuButton<String>(
                                onSelected: (value) {
                                  switch (value) {
                                    case 'all':
                                      _setFollowFilter(
                                          CourtFollowFilterMode.all);
                                      unawaited(
                                          _completeFollowFilterEducation());
                                      break;
                                    case 'mine':
                                      _setFollowFilter(
                                          CourtFollowFilterMode.mine);
                                      break;
                                    case 'followed':
                                      _setFollowFilter(
                                        CourtFollowFilterMode.allFollowed,
                                      );
                                      break;
                                  }
                                },
                                itemBuilder: (context) => [
                                  PopupMenuItem(
                                    value: 'all',
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.clear_all,
                                          size: 18,
                                          color: _followFilterMode ==
                                                  CourtFollowFilterMode.all
                                              ? kCourtFilterAccentColor
                                              : null,
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          'All Courts',
                                          style: TextStyle(
                                            color: _followFilterMode ==
                                                    CourtFollowFilterMode.all
                                                ? kCourtFilterAccentColor
                                                : null,
                                          ),
                                        ),
                                        if (_followFilterMode ==
                                            CourtFollowFilterMode.all)
                                          const Spacer(),
                                        if (_followFilterMode ==
                                            CourtFollowFilterMode.all)
                                          const Icon(
                                            Icons.check,
                                            size: 16,
                                            color: kCourtFilterAccentColor,
                                          ),
                                      ],
                                    ),
                                  ),
                                  PopupMenuItem(
                                    value: 'mine',
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.favorite_rounded,
                                          size: 18,
                                          color: _followFilterMode ==
                                                  CourtFollowFilterMode.mine
                                              ? kCourtFilterAccentColor
                                              : null,
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          'My Follows',
                                          style: TextStyle(
                                            color: _followFilterMode ==
                                                    CourtFollowFilterMode.mine
                                                ? kCourtFilterAccentColor
                                                : null,
                                          ),
                                        ),
                                        if (_followFilterMode ==
                                            CourtFollowFilterMode.mine)
                                          const Spacer(),
                                        if (_followFilterMode ==
                                            CourtFollowFilterMode.mine)
                                          const Icon(
                                            Icons.check,
                                            size: 16,
                                            color: kCourtFilterAccentColor,
                                          ),
                                      ],
                                    ),
                                  ),
                                  PopupMenuItem(
                                    value: 'followed',
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.favorite_rounded,
                                          size: 18,
                                          color: _followFilterMode ==
                                                  CourtFollowFilterMode
                                                      .allFollowed
                                              ? kCourtFilterAccentColor
                                              : null,
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          'All Follows',
                                          style: TextStyle(
                                            color: _followFilterMode ==
                                                    CourtFollowFilterMode
                                                        .allFollowed
                                                ? kCourtFilterAccentColor
                                                : null,
                                          ),
                                        ),
                                        if (_followFilterMode ==
                                            CourtFollowFilterMode.allFollowed)
                                          const Spacer(),
                                        if (_followFilterMode ==
                                            CourtFollowFilterMode.allFollowed)
                                          const Icon(
                                            Icons.check,
                                            size: 16,
                                            color: kCourtFilterAccentColor,
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 10, horizontal: 12),
                                  decoration: BoxDecoration(
                                    color: _followFilterMode !=
                                            CourtFollowFilterMode.all
                                        ? kCourtFilterAccentColor
                                        : Colors.grey[800],
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: _followFilterMode !=
                                              CourtFollowFilterMode.all
                                          ? kCourtFilterAccentBorderColor
                                          : Colors.white
                                              .withValues(alpha: 0.08),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        _followFilterMode !=
                                                CourtFollowFilterMode.all
                                            ? Icons.favorite
                                            : Icons.favorite_border,
                                        size: 18,
                                        color: _followFilterMode !=
                                                CourtFollowFilterMode.all
                                            ? Colors.white
                                            : Colors.grey[400],
                                      ),
                                      if (followedCount > 0) ...[
                                        const SizedBox(width: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 5, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: Colors.white
                                                .withValues(alpha: 0.2),
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            '$followedCount',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ],
                                      const SizedBox(width: 2),
                                      Icon(
                                        Icons.filter_alt_rounded,
                                        size: 15,
                                        color: _followFilterMode !=
                                                CourtFollowFilterMode.all
                                            ? Colors.white
                                            : Colors.grey[400],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                      if (_shouldShowFollowFilterEducation) ...[
                        const SizedBox(height: 6),
                        _buildFollowFilterEducationCallout(),
                      ],
                    ],
                  ),
                ],
              ),
              if (_courtsTotalBeforeCap != null &&
                  _courtsCapLimit != null &&
                  _courtsTotalBeforeCap! > _courtsCapLimit!) ...[
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.55),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.zoom_in,
                          size: 16, color: Colors.white70),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Showing $_courtsCapLimit of $_courtsTotalBeforeCap courts. Zoom in to see more.',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        Positioned(
          bottom: 16,
          right: 16,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FloatingActionButton(
                heroTag: 'zoom_in',
                mini: true,
                onPressed: _zoomIn,
                child: const Icon(Icons.add),
              ),
              const SizedBox(height: 8),
              FloatingActionButton(
                heroTag: 'zoom_out',
                mini: true,
                onPressed: _zoomOut,
                child: const Icon(Icons.remove),
              ),
              const SizedBox(height: 16),
              FloatingActionButton(
                heroTag: 'my_location',
                onPressed: _moveToUserLocation,
                child: const Icon(Icons.my_location),
              ),
            ],
          ),
        ),
        _buildMapHubControls(),
      ],
    );

    if (!widget.showCourtList) {
      return mapStack;
    }

    return Column(
      children: [
        Expanded(
          flex: 2,
          child: mapStack,
        ),
        Expanded(
          flex: 1,
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            itemCount: listCourts.length,
            itemBuilder: (context, index) {
              final court = listCourts[index];
              final isPreviewCourt = _showDeepLinkPreviewOnly &&
                  _deepLinkPreviewCourt?.id == court.id;

              // Determine image and styling
              final listMarkerImageUrl = courtMarkerImageUrlFor(court);
              Color accentColor;

              if (court.isSignature) {
                accentColor = Colors.amber;
              } else if (court.hasKings) {
                accentColor = Colors.orange;
              } else {
                accentColor = const Color(0xFF00C853); // HoopRank Green default
              }

              return Consumer<CheckInState>(
                builder: (context, checkInState, _) {
                  final isFollowing = checkInState.isFollowing(court.id);
                  final checkInCount = checkInState.getCheckInCount(court.id);
                  final hasActivity = checkInCount > 0;
                  const previewAccentColor = Color(0xFFFF7A45);

                  return Container(
                    key: index == 0 ? null : null,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E1E),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: isPreviewCourt
                              ? previewAccentColor.withOpacity(0.7)
                              : hasActivity
                                  ? const Color(0xFF00C853).withOpacity(0.3)
                                  : Colors.white.withOpacity(0.05),
                          width: isPreviewCourt ? 1.6 : 1),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                        if (isPreviewCourt)
                          BoxShadow(
                            color: previewAccentColor.withOpacity(0.18),
                            blurRadius: 18,
                            offset: const Offset(0, 10),
                          ),
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _zoomToCourtAndSelect(court),
                        borderRadius: BorderRadius.circular(16),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              // Court Image/Icon
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: hasActivity
                                          ? const Color(0xFF00C853)
                                          : accentColor.withOpacity(0.5),
                                      width: 2),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: HoopRankAvatarImage(
                                    imageUrl: listMarkerImageUrl,
                                    width: 56,
                                    height: 56,
                                    fit: BoxFit.cover,
                                    fallback: _CourtListImageFallback(
                                      accentColor: accentColor,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),

                              // Main Details
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Court Name & Badges
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            court.name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                        if (isPreviewCourt) ...[
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color: previewAccentColor
                                                  .withOpacity(0.16),
                                              borderRadius:
                                                  BorderRadius.circular(999),
                                              border: Border.all(
                                                color: previewAccentColor
                                                    .withOpacity(0.4),
                                              ),
                                            ),
                                            child: Text(
                                              'MAP PREVIEW',
                                              style: TextStyle(
                                                color: previewAccentColor,
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                                letterSpacing: 0.5,
                                              ),
                                            ),
                                          ),
                                        ],
                                        if (hasActivity) ...[
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF00C853),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              'LIVE: $checkInCount',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 10,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 4),

                                    // Address line
                                    if (court.address != null &&
                                        court.address!.isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 2),
                                        child: Row(
                                          children: [
                                            Icon(Icons.location_on,
                                                size: 12,
                                                color: Colors.grey[500]),
                                            const SizedBox(width: 3),
                                            Expanded(
                                              child: Text(
                                                court.address!,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    color: Colors.grey[500],
                                                    fontSize: 12),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),

                                    const SizedBox(height: 10),
                                    _buildCourtSelectionHint(
                                      accentColor: isPreviewCourt
                                          ? previewAccentColor
                                          : accentColor,
                                      isPreviewCourt: isPreviewCourt,
                                    ),

                                    // Bottom Row: Kings & Followers
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        // Kings Badges
                                        if (court.hasKings) ...[
                                          Icon(Icons.emoji_events_rounded,
                                              size: 14,
                                              color: Colors.amber[700]),
                                          const SizedBox(width: 4),
                                          if (court.king1v1 != null)
                                            _kingBadge(
                                                '1v1', Colors.deepOrange),
                                          if (court.king3v3 != null)
                                            _kingBadge('3v3', Colors.blue),
                                          if (court.king5v5 != null)
                                            _kingBadge('5v5', Colors.purple),
                                          if (!court.isSignature)
                                            const SizedBox(
                                                width:
                                                    8), // Spacer if we have more stuff
                                        ],

                                        // Signature Badge (if space allows or instead of kings if it's simpler)
                                        if (court.isSignature)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              gradient: const LinearGradient(
                                                  colors: [
                                                    Color(0xFFFFD700),
                                                    Color(0xFFFFA500)
                                                  ]),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: const Text('LEGENDARY',
                                                style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.black)),
                                          ),

                                        // Court type badges (Indoor/Outdoor, Access)
                                        if (!court.isSignature) ...[
                                          const Spacer(),
                                          _buildCourtTypeBadge(court),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),

                              // Action Buttons Column
                              Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  // Follow Heart
                                  GestureDetector(
                                    onTap: () {
                                      checkInState.toggleFollow(court.id);
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: isFollowing
                                            ? Colors.red.withOpacity(0.15)
                                            : Colors.transparent,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        isFollowing
                                            ? Icons.favorite
                                            : Icons.favorite_border_rounded,
                                        size: 20,
                                        color: isFollowing
                                            ? Colors.redAccent
                                            : Colors.grey[600],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CourtListImageFallback extends StatelessWidget {
  final Color accentColor;

  const _CourtListImageFallback({required this.accentColor});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            accentColor.withValues(alpha: 0.86),
            const Color(0xFF111827),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _CourtListFallbackPainter(),
            ),
          ),
          Icon(
            Icons.sports_basketball,
            color: Colors.white.withValues(alpha: 0.32),
            size: 22,
          ),
        ],
      ),
    );
  }
}

class _CourtListFallbackPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final line = Paint()
      ..color = Colors.white.withValues(alpha: 0.72)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6;

    final court = rect.deflate(8);
    canvas.drawRect(court, line);
    canvas.drawLine(
      Offset(court.center.dx, court.top),
      Offset(court.center.dx, court.bottom),
      line,
    );
    canvas.drawCircle(court.center, 5, line);
  }

  @override
  bool shouldRepaint(covariant _CourtListFallbackPainter oldDelegate) => false;
}

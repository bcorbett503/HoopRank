import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models.dart';
import '../models/map_hub_models.dart';
import '../utils/player_clustering.dart';
import '../services/court_service.dart';
import '../services/api_service.dart';
import '../services/recommended_matchup_engine.dart';
import '../state/check_in_state.dart';
import '../state/app_state.dart';
import 'package:go_router/go_router.dart';
import '../utils/court_images.dart';
import '../utils/flat_avatar.dart';

import 'avatar_image.dart';
import 'basketball_marker.dart';
import 'map_control_buttons.dart';
import 'player_map_marker.dart';
import 'player_status_sheet.dart';
import 'permission_prompts.dart';

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

  /// When true, the first-run "Put Yourself on the Map" + "Accept Challenges"
  /// permission onboarding runs on this map (only the primary hub map).
  final bool enablePermissionOnboarding;
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
    this.enablePermissionOnboarding = false,
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
  // Default view: courts the community follows ("all follows") — a map of
  // real hoop spots — rather than only courts with scheduled runs.
  CourtFollowFilterMode _followFilterMode = CourtFollowFilterMode.allFollowed;
  // True once the user explicitly taps a follow-filter chip; the
  // empty-viewport fallback in _updateCourtsForMapCenter never overrides
  // an explicit choice.
  bool _userChoseFollowFilter = false;
  CheckInState? _observedCheckInState;
  // Recommended matchup: the engine picks the best opponent among nearby
  // players who are actually visible on the map; their marker gets the
  // spotlight + flag treatment. Computed once per map session.
  String? _recommendedMatchupId;
  bool _matchupComputeStarted = false;
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
  bool _ranPermissionOnboarding = false;

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

  /// Frosted chip styling for the top filter row — matches the floating map
  /// buttons (frosted white + navy ink; brand orange when a filter is on).
  BoxDecoration _topChipDecoration({required bool active}) => BoxDecoration(
        color: active ? const Color(0xFFFF6B35) : const Color(0xF2FFFFFF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: active ? Colors.white : const Color(0x0F000000),
          width: active ? 1.5 : 0.5,
        ),
        boxShadow: [
          BoxShadow(
            color: active
                ? const Color(0xFFF0490F).withValues(alpha: 0.35)
                : Colors.black.withValues(alpha: 0.16),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      );

  Color _topChipInk(bool active) => active ? Colors.white : kMapControlInk;

  /// Screen-space player consolidation: at the current zoom, players whose
  /// avatars would pile on top of each other merge into a [PlayerCluster]
  /// rendered as one count bubble. The merge radius widens as the map zooms
  /// out, so a metro view reads "N hoopers" while zooming in fans the group
  /// back out into full avatars. Pre-ready (or on projection failure) every
  /// player stands alone.
  /// Past street-level zoom clustering turns off entirely — co-located
  /// players (same court) must fan out into real avatars here, otherwise a
  /// bubble at max zoom could never be expanded.
  static const _playerClusterMaxZoom = 15.5;

  List<PlayerCluster> _computePlayerClusters(List<MapHubPlayer> others) {
    if (!_mapReady ||
        others.length < 2 ||
        _currentZoom >= _playerClusterMaxZoom) {
      return [
        for (final p in others) PlayerCluster([p]),
      ];
    }
    final camera = _mapController.camera;
    return clusterMapPlayers(
      others,
      project: (p) => camera.latLngToScreenPoint(LatLng(p.lat, p.lng)),
      radius: clusterRadiusForZoom(_currentZoom),
    );
  }

  /// Tap on a cluster bubble: dive toward the group so it fans out into
  /// individual avatars (the tighter merge radius at higher zoom does the
  /// splitting naturally).
  void _expandPlayerCluster(PlayerCluster cluster) {
    final targetZoom = (_currentZoom + 2.5).clamp(3.0, kCourtSelectionZoom);
    _currentZoom = targetZoom;
    _mapController.move(LatLng(cluster.lat, cluster.lng), targetZoom);
    setState(() {});
  }

  /// Collision-aware labels: project every player marker to screen space and
  /// suppress the labels (name pill + status) of LOWER-priority players whose
  /// pills would overlap an already-accepted player's. Priority: the current
  /// user (always wins), then players accepting challenges, then by rating.
  /// Avatars always render — only the text is dropped. Because all player
  /// markers share the same box/alignment, only relative offsets matter, so
  /// this is robust to how flutter_map anchors the marker.
  Set<String> _computeLabelSuppression(
    List<MapHubPlayer> others,
    MapHubPlayer? me,
    bool statusesVisible,
  ) {
    if (!_mapReady || others.isEmpty) return const {};
    try {
      final camera = _mapController.camera;
      List<Rect> rectsFor(double x, double y, {required bool withStatus}) => [
            // Name/rank pill zone at the marker top.
            Rect.fromCenter(center: Offset(x, y + 13), width: 150, height: 34),
            // Status pill zone under the figure.
            if (withStatus)
              Rect.fromCenter(
                  center: Offset(x, y + 182), width: 165, height: 34),
          ];

      final accepted = <Rect>[];
      final suppressed = <String>{};
      if (me != null) {
        final pt = camera.latLngToScreenPoint(LatLng(me.lat, me.lng));
        accepted.addAll(rectsFor(pt.x, pt.y, withStatus: true));
      }
      final ordered = [...others]..sort((a, b) {
          if (a.acceptingChallenges != b.acceptingChallenges) {
            return a.acceptingChallenges ? -1 : 1;
          }
          return b.rating.compareTo(a.rating);
        });
      for (final p in ordered) {
        final pt = camera.latLngToScreenPoint(LatLng(p.lat, p.lng));
        final rects = rectsFor(pt.x, pt.y, withStatus: statusesVisible);
        if (rects.any((r) => accepted.any((a) => a.overlaps(r)))) {
          suppressed.add(p.id);
        } else {
          accepted.addAll(rects);
        }
      }
      return suppressed;
    } catch (_) {
      return const {};
    }
  }

  /// Whether a court at [lat],[lng] sits under the current-user marker on
  /// screen. Used to hide that court's status bubble so the large "Me" avatar
  /// reads cleanly instead of colliding with nearby "5v5 scheduled" pills.
  /// (The court pin still shows and stays tappable.)
  bool _courtStatusOverlapsUser(double lat, double lng, MapHubPlayer? me) {
    if (me == null || !_mapReady) return false;
    try {
      final camera = _mapController.camera;
      final mePt = camera.latLngToScreenPoint(LatLng(me.lat, me.lng));
      final courtPt = camera.latLngToScreenPoint(LatLng(lat, lng));
      return (courtPt.x - mePt.x).abs() < 120 &&
          (courtPt.y - mePt.y).abs() < 145;
    } catch (_) {
      return false;
    }
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

    // Pick the recommended matchup once real players are on the map.
    if (hub != null &&
        widget.showPlayers &&
        hub.players.isNotEmpty &&
        !_matchupComputeStarted) {
      _matchupComputeStarted = true;
      unawaited(_computeRecommendedMatchup());
    }

    // First-run permission onboarding, once we know the visibility state.
    if (hub != null &&
        widget.enablePermissionOnboarding &&
        !_ranPermissionOnboarding) {
      _ranPermissionOnboarding = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _maybeRunPermissionOnboarding();
      });
    }
  }

  /// Pick the best matchup among nearby players who are visible on the map.
  /// Uses the same engine + nearby-players pipeline the home feed's
  /// "recommended matchup" card used, so scoring (rating similarity,
  /// proximity, reliability, youth screening) stays consistent.
  Future<void> _computeRecommendedMatchup() async {
    try {
      final authUser =
          Provider.of<AuthState>(context, listen: false).currentUser;
      if (authUser == null) return;

      final center = _mapReady ? _mapController.camera.center : _initialCenter;
      final radiusMiles =
          _mapHubPrivacy.discoverRadiusMi.clamp(1.0, 100.0).round();
      final candidates = await ApiService.getNearbyPlayers(
        radiusMiles: radiusMiles,
        lat: center.latitude,
        lng: center.longitude,
      );
      if (!mounted || candidates.isEmpty) return;

      final pick = RecommendedMatchupEngine.pickBestOnMap(
        currentUser: authUser,
        candidates: candidates,
        mapPlayers: _mapHubPlayers,
        discoverMode: _mapHubPrivacy.discoverMode,
        searchRadiusMiles: _mapHubPrivacy.discoverRadiusMi,
      );
      if (!mounted || pick == null) return;
      setState(() => _recommendedMatchupId = pick.player.id);
    } catch (e) {
      debugPrint('Recommended matchup: skipped ($e)');
    }
  }

  /// Snapchat-style first-run flow: offer to go live on the map, then to accept
  /// challenges. Each step is shown at most once (gated by SharedPreferences).
  Future<void> _maybeRunPermissionOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted &&
        !_mapHubPrivacy.mapVisibilityEnabled &&
        prefs.getBool(kSeenMapVisibilityPrompt) != true) {
      await prefs.setBool(kSeenMapVisibilityPrompt, true);
      if (!mounted) return;
      final goLive = await showMapVisibilityPrompt(context);
      if (goLive && mounted) {
        await _toggleMapVisibility(true);
      }
    }
    if (!mounted) return;
    await maybeShowAcceptChallengesPrompt(context);
  }

  /// Enabling visibility from the toggle goes through the "Put Yourself on the
  /// Map" sheet (and chains the Accept Challenges prompt on first opt-in).
  Future<void> _requestGoVisible() async {
    final goLive = await showMapVisibilityPrompt(context);
    if (!goLive || !mounted) return;
    await _toggleMapVisibility(true);
    if (mounted) await maybeShowAcceptChallengesPrompt(context);
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
    // Follow data (my follows + follower counts) loads asynchronously and
    // drives the follows filter; refilter the viewport whenever it changes,
    // otherwise the map can stay blank until the user pans.
    final checkInState = Provider.of<CheckInState>(context, listen: false);
    if (!identical(_observedCheckInState, checkInState)) {
      _observedCheckInState?.removeListener(_handleCheckInStateChanged);
      _observedCheckInState = checkInState
        ..addListener(_handleCheckInStateChanged);
    }
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
    _observedCheckInState?.removeListener(_handleCheckInStateChanged);
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

  void _handleCheckInStateChanged() {
    if (!mounted || !_mapReady || _isLoading) return;
    if (_searchController.text.trim().isNotEmpty) return;
    _updateCourtsForMapCenter();
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
    // An explicit tap (even re-selecting the active chip) disables the
    // blank-viewport auto-fallback — the user owns the filter now.
    _userChoseFollowFilter = true;
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

    final rawCourtsInView = _courtService.getCourtsInBounds(
      bounds.south,
      bounds.west,
      bounds.north,
      bounds.east,
    );

    // Apply filters to map view as well
    var courtsInView = _applyFilters(rawCourtsInView);

    // Fallback: if the default follows filter hides every court in view
    // (no followed courts around here), show all courts instead of a blank
    // map. Only fires once follow data has actually settled, and never
    // after the user has picked a filter themselves.
    if (courtsInView.isEmpty &&
        rawCourtsInView.isNotEmpty &&
        _followFilterMode == CourtFollowFilterMode.allFollowed &&
        !_userChoseFollowFilter &&
        (_observedCheckInState?.followerCountsLoaded ?? false)) {
      _followFilterMode = CourtFollowFilterMode.all;
      courtsInView = _applyFilters(rawCourtsInView);
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content:
              Text('No followed courts in this area yet — showing all courts.'),
          duration: Duration(seconds: 3),
        ),
      );
    }

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
                    : () => _mapHubPrivacy.mapVisibilityEnabled
                        ? _toggleMapVisibility(false)
                        : _requestGoVisible(),
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
    // Exclude the current user from the players layer by their auth id (not the
    // GPS-derived marker id, which is null until location resolves) so they
    // never render twice — the backend map hub includes them in the list.
    final myPlayerId = authState.currentUser?.id.trim();
    // Below this zoom the map is at metro scale: drop status bubbles and
    // court labels so only avatars, name pills and pins remain.
    final showMapLabels = _currentZoom >= 11.5;
    final otherMapPlayers = _mapHubPlayers
        .where((player) => player.lat != 0 || player.lng != 0)
        .where((player) => myPlayerId == null || player.id.trim() != myPlayerId)
        .toList();
    // The recommended matchup renders as its own spotlighted marker — never
    // swallowed into a cluster, labels never suppressed.
    MapHubPlayer? recommendedPlayer;
    if (_recommendedMatchupId != null) {
      for (final p in otherMapPlayers) {
        if (p.id == _recommendedMatchupId) {
          recommendedPlayer = p;
          break;
        }
      }
    }
    final clusterablePlayers = recommendedPlayer == null
        ? otherMapPlayers
        : [
            for (final p in otherMapPlayers)
              if (p.id != recommendedPlayer.id) p,
          ];
    // Consolidate players whose avatars would pile up at this zoom into
    // count bubbles; zooming in separates them back into full avatars.
    final playerClusters = _computePlayerClusters(clusterablePlayers);
    final unclusteredPlayers = [
      for (final c in playerClusters)
        if (c.isSingle) c.single,
    ];
    final suppressedLabelIds = _computeLabelSuppression(
      unclusteredPlayers,
      currentUserMapPlayer,
      showMapLabels,
    );
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
                // Re-cluster/re-suppress right away at the new camera —
                // the court refetch below repaints again when it lands.
                if (mounted) setState(() {});
                _updateCourtsForMapCenter();
              });
            },
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.bcorbett.hooprank',
              // Tile fetches fail routinely on flaky mobile connections;
              // handle them so they never surface as uncaught exceptions.
              errorTileCallback: (tile, error, stackTrace) {
                debugPrint('Map tile failed (${tile.coordinates}): $error');
              },
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
                final rawStatusLabel = _courtStatusLabel(court, checkInState);
                final statusColor = _courtStatusColor(court, checkInState);
                // Declutter: hide this court's labels (status bubble +
                // top-follower name) when it sits under the "Me" marker OR
                // when zoomed out past the label threshold — at metro scale
                // the pills pile up into noise. The pin stays tappable.
                final overlapsMe = _courtStatusOverlapsUser(
                    court.lat, court.lng, currentUserMapPlayer);
                final statusLabel =
                    (overlapsMe || !showMapLabels) ? null : rawStatusLabel;

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
                    topFollower:
                        (overlapsMe || !showMapLabels) ? null : topFollower,
                    statusLabel: statusLabel,
                    statusColor: statusColor,
                  ),
                );
              }).toList(),
            ),
            if (widget.showPlayers && _hubPlayersVisible)
              MarkerLayer(
                markers: [
                  for (final cluster in playerClusters)
                    if (cluster.isSingle)
                      Marker(
                        point: LatLng(cluster.single.lat, cluster.single.lng),
                        width: PlayerMapMarker.markerWidth,
                        height: PlayerMapMarker.markerHeight,
                        alignment: Alignment.topCenter,
                        child: PlayerMapMarker(
                          player: cluster.single,
                          showDetails: showMapLabels,
                          showLabels:
                              !suppressedLabelIds.contains(cluster.single.id),
                          onTap: () =>
                              widget.onPlayerSelected?.call(cluster.single),
                        ),
                      )
                    else
                      Marker(
                        point: LatLng(cluster.lat, cluster.lng),
                        width: PlayerClusterMarker.markerWidth,
                        height: PlayerClusterMarker.markerHeight,
                        alignment: Alignment.topCenter,
                        child: PlayerClusterMarker(
                          members: cluster.members,
                          onTap: () => _expandPlayerCluster(cluster),
                        ),
                      ),
                  // Last so the spotlighted matchup draws above neighbors.
                  if (recommendedPlayer != null)
                    Marker(
                      point: LatLng(
                        recommendedPlayer.lat,
                        recommendedPlayer.lng,
                      ),
                      width: PlayerMapMarker.markerWidth,
                      height: PlayerMapMarker.markerHeight +
                          PlayerMapMarker.recommendedFlagExtent,
                      alignment: Alignment.topCenter,
                      child: Builder(builder: (context) {
                        final rec = recommendedPlayer!;
                        return PlayerMapMarker(
                          player: rec,
                          isRecommended: true,
                          showDetails: showMapLabels,
                          onTap: () => widget.onPlayerSelected?.call(rec),
                        );
                      }),
                    ),
                ],
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
              // Search bar — frosted pill matching the floating map buttons.
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xF2FFFFFF),
                  borderRadius: BorderRadius.circular(999),
                  border:
                      Border.all(color: const Color(0x0F000000), width: 0.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.16),
                      blurRadius: 14,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(
                    color: kMapControlInk,
                    fontWeight: FontWeight.w600,
                  ),
                  cursorColor: kMapControlInk,
                  decoration: InputDecoration(
                    hintText: 'Search courts...',
                    hintStyle: TextStyle(
                      color: kMapControlInk.withValues(alpha: 0.45),
                      fontWeight: FontWeight.w600,
                    ),
                    prefixIcon: const Icon(Icons.search, color: kMapControlInk),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
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
                        decoration:
                            _topChipDecoration(active: _runsFilter != null),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.calendar_today,
                              size: 16,
                              color: _topChipInk(_runsFilter != null),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _runsFilter == 'today'
                                  ? 'Today'
                                  : (_runsFilter == 'all'
                                      ? 'All Runs'
                                      : 'Find Runs'),
                              style: TextStyle(
                                color: _topChipInk(_runsFilter != null),
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(width: 2),
                            Icon(
                              Icons.arrow_drop_down,
                              size: 16,
                              color: _topChipInk(_runsFilter != null),
                            ),
                            if (_courtsWithRuns.isNotEmpty) ...[
                              const SizedBox(width: 2),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: _runsFilter != null
                                      ? Colors.white.withValues(alpha: 0.25)
                                      : kMapControlInk.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${_courtsWithRuns.length}',
                                  style: TextStyle(
                                    color: _topChipInk(_runsFilter != null),
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
                              decoration: _topChipDecoration(
                                  active: _filterIndoor != null),
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
                                      color: _topChipInk(_filterIndoor != null),
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Icon(
                                    Icons.filter_alt_rounded,
                                    size: 15,
                                    color: _topChipInk(_filterIndoor != null),
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
                                child: Builder(builder: (context) {
                                  final followActive = _followFilterMode !=
                                      CourtFollowFilterMode.all;
                                  return Container(
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 10, horizontal: 12),
                                    decoration: _topChipDecoration(
                                        active: followActive),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          followActive
                                              ? Icons.favorite
                                              : Icons.favorite_border,
                                          size: 18,
                                          color: _topChipInk(followActive),
                                        ),
                                        if (followedCount > 0) ...[
                                          const SizedBox(width: 4),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 5, vertical: 1),
                                            decoration: BoxDecoration(
                                              color: followActive
                                                  ? Colors.white
                                                      .withValues(alpha: 0.25)
                                                  : kMapControlInk.withValues(
                                                      alpha: 0.08),
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              '$followedCount',
                                              style: TextStyle(
                                                color:
                                                    _topChipInk(followActive),
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
                                          color: _topChipInk(followActive),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
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
              MapZoomPill(onZoomIn: _zoomIn, onZoomOut: _zoomOut),
              const SizedBox(height: 14),
              FrostedCircleButton(
                size: 52,
                tooltip: 'My location',
                onTap: _moveToUserLocation,
                child: const Icon(
                  Icons.my_location,
                  size: 23,
                  color: kMapControlInk,
                ),
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

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/court_service.dart';
import '../services/profile_service.dart';
import '../services/zipcode_service.dart';
import '../services/api_service.dart';
import '../state/check_in_state.dart';
import '../state/app_state.dart';
import '../state/tutorial_state.dart';
import 'basketball_marker.dart';

class CourtMapWidget extends StatefulWidget {
  final Function(Court) onCourtSelected;
  final double? limitDistanceKm;
  final String? initialCourtId;
  final double? initialLat;
  final double? initialLng;
  final String? initialCourtName;

  const CourtMapWidget({
    super.key,
    required this.onCourtSelected,
    this.limitDistanceKm,
    this.initialCourtId,
    this.initialLat,
    this.initialLng,
    this.initialCourtName,
  });

  @override
  State<CourtMapWidget> createState() => _CourtMapWidgetState();
}


class _CourtMapWidgetState extends State<CourtMapWidget> {
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounceTimer;
  List<Court> _courts = [];
  bool _isLoading = true;
  LatLng _initialCenter = const LatLng(38.0194, -122.5376); // Default to San Rafael
  double _currentZoom = 14.0;
  bool _showFollowedOnly = false; // Filter for courts with followers
  bool? _filterIndoor = true; // null=all, true=indoor only, false=outdoor only
  String? _filterAccess; // null=all, 'public', 'private'
  String? _runsFilter; // null=off, 'today'=runs today, 'all'=all upcoming runs
  Set<String> _courtsWithRuns = {}; // Court IDs with runs (based on filter)

  bool _noCourtsFound = false;

  @override
  void initState() {
    super.initState();
    _initializeMap();
  }

  @override
  void didUpdateWidget(covariant CourtMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Handle navigation to a new court
    if (widget.initialCourtId != null && widget.initialCourtId != oldWidget.initialCourtId) {
      _navigateToCourt(widget.initialCourtId!);
    }
  }
  
  void _navigateToCourt(String courtId) {
    debugPrint('MAP: _navigateToCourt called with courtId: $courtId');
    
    // First try direct ID lookup
    Court? targetCourt = CourtService().getCourtById(courtId);
    
    // If not found, try the enhanced findCourt method
    if (targetCourt == null) {
      debugPrint('MAP: Court not found by ID, trying findCourt...');
      targetCourt = CourtService().findCourt(id: courtId);
    }
    
    if (targetCourt != null) {
      _zoomToCourtAndSelect(targetCourt);
    } else {
      debugPrint('MAP: Court not found for ID: $courtId');
    }
  }
  
  /// Zoom to a court's location and show its details
  void _zoomToCourtAndSelect(Court court) {
    debugPrint('MAP: Zooming to court: ${court.name} at (${court.lat}, ${court.lng})');
    final target = LatLng(court.lat, court.lng);
    _mapController.move(target, 16.0);
    // Show court details sheet after a brief delay to allow map animation
    Future.delayed(const Duration(milliseconds: 200), () {
      if (mounted) {
        widget.onCourtSelected(court);
      }
    });
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _mapController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _initializeMap() async {
    // Check if we have deep link parameters BEFORE doing async work
    final hasDeepLink = widget.initialCourtId != null || 
                        widget.initialCourtName != null ||
                        (widget.initialLat != null && widget.initialLng != null);
    
    await CourtService().loadCourts();
    
    bool locationObtained = false;
    
    // First, try to get the user's GPS location
    try {
      Position position = await _determinePosition();
      _initialCenter = LatLng(position.latitude, position.longitude);
      _currentZoom = 14.0;
      locationObtained = true;
      debugPrint('MAP: Using GPS location: ${position.latitude}, ${position.longitude}');
      
      if (widget.limitDistanceKm != null) {
        final nearbyCourts = CourtService().getCourtsNear(
          position.latitude, 
          position.longitude, 
          radiusKm: widget.limitDistanceKm!
        );
        
        if (mounted) {
          setState(() {
            _courts = nearbyCourts;
            _noCourtsFound = nearbyCourts.isEmpty;
            _isLoading = false;
            _currentZoom = 15.0;
          });
          return;
        }
      }
    } catch (e) {
      debugPrint('MAP: GPS location failed: $e');
    }
    
    // If GPS failed, try to use the user's registered zipcode
    if (!locationObtained) {
      try {
        final authState = Provider.of<AuthState>(context, listen: false);
        final userId = authState.currentUser?.id;
        
        if (userId != null) {
          final profile = await ProfileService.getProfile(userId);
          
          if (profile != null && profile.zip.isNotEmpty) {
            final coords = ZipcodeService.getCoordinatesForZipcode(profile.zip);
            _initialCenter = LatLng(coords.latitude, coords.longitude);
            _currentZoom = 12.0; // Slightly zoomed out for zipcode-based centering
            locationObtained = true;
            debugPrint('MAP: Using zipcode location for ${profile.zip}: ${coords.latitude}, ${coords.longitude}');
          }
        }
      } catch (e) {
        debugPrint('MAP: Zipcode fallback failed: $e');
      }
    }
    
    // Log if using default location
    if (!locationObtained) {
      debugPrint('MAP: Using default location (San Rafael)');
    }

    if (mounted) {
      final courts = CourtService().getCourts();
      setState(() {
        _courts = courts;
        _isLoading = false;
      });
      
      // Handle initial court selection from query params or direct coords
      // Use post-frame callback to ensure map is ready
      if (hasDeepLink) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _handleDeepLinkNavigation();
        });
      }
    }
  }
  
  /// Handle deep link navigation after map is ready
  void _handleDeepLinkNavigation() {
    Court? targetCourt;
    
    // First try by court ID
    if (widget.initialCourtId != null) {
      debugPrint('MAP: Deep link court ID: ${widget.initialCourtId}');
      targetCourt = CourtService().getCourtById(widget.initialCourtId!);
      if (targetCourt == null) {
        debugPrint('MAP: Court not found by ID, trying findCourt...');
        targetCourt = CourtService().findCourt(
          id: widget.initialCourtId!,
          name: widget.initialCourtName,
          lat: widget.initialLat,
          lng: widget.initialLng,
        );
      }
    }
    
    // If still not found, try by name
    if (targetCourt == null && widget.initialCourtName != null) {
      debugPrint('MAP: Trying to find court by name: ${widget.initialCourtName}');
      targetCourt = CourtService().getCourtByName(widget.initialCourtName!);
    }
    
    // If still not found but we have coordinates, navigate to that location anyway
    if (targetCourt == null && widget.initialLat != null && widget.initialLng != null) {
      debugPrint('MAP: Court not found, but navigating to coordinates: ${widget.initialLat}, ${widget.initialLng}');
      final target = LatLng(widget.initialLat!, widget.initialLng!);
      _mapController.move(target, 16.0);
    } else if (targetCourt != null) {
      debugPrint('MAP: Found deep link court: ${targetCourt.name}');
      _zoomToCourtAndSelect(targetCourt);
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
      Position position = await _determinePosition();
      _mapController.move(LatLng(position.latitude, position.longitude), 15.0);
      setState(() {
        _currentZoom = 15.0;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not get location: $e')),
      );
    }
  }

  void _onSearchChanged(String query) {
    List<Court> filteredCourts = CourtService().searchCourts(query);
    filteredCourts = _applyFilters(filteredCourts);
    
    setState(() {
      _courts = filteredCourts;
    });
  }
  
  void _toggleFollowedFilter() {
    setState(() {
      _showFollowedOnly = !_showFollowedOnly;
    });
    // Re-run search with current query
    _onSearchChanged(_searchController.text);
  }
  
  void _toggleIndoorFilter(bool? value) {
    setState(() {
      _filterIndoor = value;
    });
    _onSearchChanged(_searchController.text);
  }
  
  void _setAccessFilter(String? access) {
    setState(() {
      _filterAccess = access;
    });
    _onSearchChanged(_searchController.text);
  }
  
  void _setRunsFilter(String? filter) async {
    if (filter == null) {
      // Clear runs filter
      setState(() {
        _runsFilter = null;
        _courtsWithRuns = {};
      });
    } else {
      // Load court IDs with runs from API
      final courtsWithRuns = await ApiService.getCourtsWithRuns(today: filter == 'today');
      setState(() {
        _runsFilter = filter;
        _courtsWithRuns = courtsWithRuns;
      });
    }
    _onSearchChanged(_searchController.text);
  }
  
  List<Court> _applyFilters(List<Court> courts) {
    var filtered = courts;
    
    // Followed filter - courts that have followers
    if (_showFollowedOnly) {
      final checkInState = Provider.of<CheckInState>(context, listen: false);
      filtered = filtered.where((court) => checkInState.getFollowerCount(court.id) > 0).toList();
    }
    
    // Indoor/Outdoor filter
    if (_filterIndoor != null) {
      filtered = filtered.where((court) => court.isIndoor == _filterIndoor).toList();
    }
    
    // Access filter
    if (_filterAccess != null) {
      if (_filterAccess == 'private') {
        filtered = filtered.where((court) => court.access == 'members' || court.access == 'paid').toList();
      } else {
        filtered = filtered.where((court) => court.access == _filterAccess).toList();
      }
    }
    
    // Runs filter (today or all upcoming)
    if (_runsFilter != null) {
      filtered = filtered.where((court) => _courtsWithRuns.contains(court.id)).toList();
    }
    
    return filtered;
  }

  void _updateCourtsForMapCenter() {
    // Use visible bounds to filter courts - only show courts actually visible on map
    final bounds = _mapController.camera.visibleBounds;
    
    var courtsInView = CourtService().getCourtsInBounds(
      bounds.south,
      bounds.west,
      bounds.north,
      bounds.east,
    );
    
    // Apply filters to map view as well
    courtsInView = _applyFilters(courtsInView);
    
    if (mounted) {
      setState(() {
        _courts = courtsInView;
      });
    }
  }

  // Keep this for backwards compatibility with initial load
  double _calculateRadiusFromZoom(double zoom) {
    // Approximate radius based on zoom level
    // Higher zoom = smaller radius (more zoomed in)
    if (zoom >= 15) return 2.0;   // 2km
    if (zoom >= 13) return 5.0;   // 5km
    if (zoom >= 11) return 15.0;  // 15km
    if (zoom >= 9) return 50.0;   // 50km
    return 100.0;                 // 100km
  }

  void _zoomIn() {
    setState(() {
      _currentZoom++;
      _mapController.move(_mapController.camera.center, _currentZoom);
    });
  }

  void _zoomOut() {
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
      child: Text(mode, style: TextStyle(fontSize: 9, color: color, fontWeight: FontWeight.bold)),
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
            Icon(icon, size: 14, color: isSelected ? Colors.white : Colors.grey[700]),
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
                style: TextStyle(fontSize: 9, color: indoorColor, fontWeight: FontWeight.bold),
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

    return Column(
            children: [
              Expanded(
                flex: 2,
                child: Stack(
                  children: [
                      FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: _initialCenter,
                          initialZoom: _currentZoom,
                          onMapReady: () {
                            // Filter courts after map is ready and we can get bounds
                            _updateCourtsForMapCenter();
                          },
                          onPositionChanged: (position, hasGesture) {
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
                          markers: _courts.map((court) {
                            // Signature courts get the crown marker and are larger
                            final isSignature = court.isSignature;
                            final hasKings = court.hasKings;
                            // Check if court has active check-ins
                            final checkInState = Provider.of<CheckInState>(context, listen: false);
                            final hasCheckIns = checkInState.hasCheckIns(court.id);
                            
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
                            
                            // Scale up selected court slightly
                            // (If we had selected court state easily accessible here)
                            
                            return Marker(
                              point: LatLng(court.lat, court.lng),
                              width: markerSize,
                              height: markerSize,
                              alignment: Alignment.topCenter,
                              child: BasketballMarker(
                                size: markerSize,
                                isLegendary: isSignature,
                                hasKing: hasKings,
                                isIndoor: court.isIndoor,
                                hasActivity: hasCheckIns,
                                onTap: () => _zoomToCourtAndSelect(court),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                    Positioned(
                      top: 16,
                      left: 16,
                      right: 16,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Search bar
                          Card(
                            elevation: 4,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            child: TextField(
                              controller: _searchController,
                              decoration: const InputDecoration(
                                hintText: 'Search courts...',
                                prefixIcon: Icon(Icons.search),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              ),
                              onChanged: _onSearchChanged,
                            ),
                          ),
                          const SizedBox(height: 8),
                          // Simplified filter row
                          Row(
                            children: [
                              // Scheduled Runs dropdown (primary)
                              Expanded(
                                child: PopupMenuButton<String>(
                                  onSelected: (value) {
                                    if (value == 'off') {
                                      _setRunsFilter(null);
                                    } else {
                                      _setRunsFilter(value);
                                    }
                                  },
                                  itemBuilder: (context) => [
                                    PopupMenuItem(
                                      value: 'today',
                                      child: Row(
                                        children: [
                                          Icon(Icons.today, size: 18, color: _runsFilter == 'today' ? Colors.deepOrange : null),
                                          const SizedBox(width: 8),
                                          Text('Today', style: TextStyle(color: _runsFilter == 'today' ? Colors.deepOrange : null)),
                                          if (_runsFilter == 'today') const Spacer(),
                                          if (_runsFilter == 'today') const Icon(Icons.check, size: 16, color: Colors.deepOrange),
                                        ],
                                      ),
                                    ),
                                    PopupMenuItem(
                                      value: 'all',
                                      child: Row(
                                        children: [
                                          Icon(Icons.calendar_month, size: 18, color: _runsFilter == 'all' ? Colors.deepOrange : null),
                                          const SizedBox(width: 8),
                                          Text('All Upcoming', style: TextStyle(color: _runsFilter == 'all' ? Colors.deepOrange : null)),
                                          if (_runsFilter == 'all') const Spacer(),
                                          if (_runsFilter == 'all') const Icon(Icons.check, size: 16, color: Colors.deepOrange),
                                        ],
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
                                            Text('Clear Filter', style: TextStyle(color: Colors.grey)),
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
                                          color: _runsFilter != null ? Colors.white : Colors.grey[400],
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          _runsFilter == 'today' ? 'Today' : (_runsFilter == 'all' ? 'All Runs' : 'Runs'),
                                          style: TextStyle(
                                            color: _runsFilter != null ? Colors.white : Colors.grey[400],
                                            fontWeight: FontWeight.w600,
                                            fontSize: 13,
                                          ),
                                        ),
                                        const SizedBox(width: 2),
                                        Icon(
                                          Icons.arrow_drop_down,
                                          size: 16,
                                          color: _runsFilter != null ? Colors.white : Colors.grey[400],
                                        ),
                                        if (_courtsWithRuns.isNotEmpty) ...[
                                          const SizedBox(width: 2),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
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
                              // Followed chip (primary)
                              Expanded(
                                child: Consumer<CheckInState>(
                                  builder: (context, checkInState, _) {
                                    final followedCount = checkInState.followedCourts.length;
                                    return GestureDetector(
                                      onTap: _toggleFollowedFilter,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 10),
                                        decoration: BoxDecoration(
                                          color: _showFollowedOnly 
                                              ? Colors.red 
                                              : Colors.grey[800],
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(
                                              _showFollowedOnly ? Icons.favorite : Icons.favorite_border,
                                              size: 16,
                                              color: _showFollowedOnly ? Colors.white : Colors.grey[400],
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              'Followed',
                                              style: TextStyle(
                                                color: _showFollowedOnly ? Colors.white : Colors.grey[400],
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13,
                                              ),
                                            ),
                                            if (followedCount > 0) ...[
                                              const SizedBox(width: 4),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                                decoration: BoxDecoration(
                                                  color: Colors.white.withOpacity(0.2),
                                                  borderRadius: BorderRadius.circular(8),
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
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                              const SizedBox(width: 8),
                              // All + More filters dropdown
                              PopupMenuButton<String>(
                                onSelected: (value) {
                                  switch (value) {
                                    case 'all':
                                      setState(() {
                                        _filterIndoor = null;
                                        _filterAccess = null;
                                        _runsFilter = null;
                                        _showFollowedOnly = false;
                                        _courtsWithRuns = {};
                                      });
                                      _onSearchChanged(_searchController.text);
                                      break;
                                    case 'indoor':
                                      _toggleIndoorFilter(_filterIndoor == true ? null : true);
                                      break;
                                    case 'outdoor':
                                      _toggleIndoorFilter(_filterIndoor == false ? null : false);
                                      break;
                                    case 'public':
                                      _setAccessFilter(_filterAccess == 'public' ? null : 'public');
                                      break;
                                    case 'private':
                                      _setAccessFilter(_filterAccess == 'private' ? null : 'private');
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
                                        Icon(Icons.home, size: 18, color: _filterIndoor == true ? Colors.blue : null),
                                        const SizedBox(width: 8),
                                        Text('Indoor', style: TextStyle(color: _filterIndoor == true ? Colors.blue : null)),
                                        if (_filterIndoor == true) const Spacer(),
                                        if (_filterIndoor == true) const Icon(Icons.check, size: 16, color: Colors.blue),
                                      ],
                                    ),
                                  ),
                                  PopupMenuItem(
                                    value: 'outdoor',
                                    child: Row(
                                      children: [
                                        Icon(Icons.wb_sunny, size: 18, color: _filterIndoor == false ? Colors.grey[700] : null),
                                        const SizedBox(width: 8),
                                        Text('Outdoor', style: TextStyle(color: _filterIndoor == false ? Colors.grey[700] : null)),
                                        if (_filterIndoor == false) const Spacer(),
                                        if (_filterIndoor == false) Icon(Icons.check, size: 16, color: Colors.grey[700]),
                                      ],
                                    ),
                                  ),
                                  const PopupMenuDivider(),
                                  PopupMenuItem(
                                    value: 'public',
                                    child: Row(
                                      children: [
                                        Icon(Icons.lock_open, size: 18, color: _filterAccess == 'public' ? Colors.green : null),
                                        const SizedBox(width: 8),
                                        Text('Public', style: TextStyle(color: _filterAccess == 'public' ? Colors.green : null)),
                                        if (_filterAccess == 'public') const Spacer(),
                                        if (_filterAccess == 'public') const Icon(Icons.check, size: 16, color: Colors.green),
                                      ],
                                    ),
                                  ),
                                  PopupMenuItem(
                                    value: 'private',
                                    child: Row(
                                      children: [
                                        Icon(Icons.lock, size: 18, color: _filterAccess == 'private' ? Colors.orange : null),
                                        const SizedBox(width: 8),
                                        Text('Private', style: TextStyle(color: _filterAccess == 'private' ? Colors.orange : null)),
                                        if (_filterAccess == 'private') const Spacer(),
                                        if (_filterAccess == 'private') const Icon(Icons.check, size: 16, color: Colors.orange),
                                      ],
                                    ),
                                  ),
                                ],
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: (_filterIndoor != null || _filterAccess != null) 
                                        ? const Color(0xFF00C853) 
                                        : Colors.grey[800],
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'All',
                                        style: TextStyle(
                                          color: (_filterIndoor != null || _filterAccess != null) 
                                              ? Colors.white 
                                              : Colors.grey[400],
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Icon(
                                        Icons.arrow_drop_down,
                                        size: 18,
                                        color: (_filterIndoor != null || _filterAccess != null) 
                                            ? Colors.white 
                                            : Colors.grey[400],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
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
                  ],
                ),
              ),
              Expanded(
                flex: 1,
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: _courts.length,
                  itemBuilder: (context, index) {
                    final court = _courts[index];
                    
                    // Determine assets and styling
                    String listMarkerAsset;
                    Color accentColor;
                    
                    if (court.isSignature) {
                      listMarkerAsset = 'assets/court_marker_signature_crown.jpg';
                      accentColor = Colors.amber;
                    } else if (court.hasKings) {
                      listMarkerAsset = 'assets/court_marker_king.jpg';
                      accentColor = Colors.orange;
                    } else {
                      listMarkerAsset = 'assets/court_marker.jpg';
                      accentColor = const Color(0xFF00C853); // HoopRank Green default
                    }
                    
                    return Consumer<CheckInState>(
                      builder: (context, checkInState, _) {
                        final isFollowing = checkInState.isFollowing(court.id);
                        final hasAlert = checkInState.isAlertEnabled(court.id);
                        final followerCount = checkInState.getFollowerCount(court.id);
                        final checkInCount = checkInState.getCheckInCount(court.id);
                        final hasActivity = checkInCount > 0;
                        
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E1E1E),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: hasActivity 
                                  ? const Color(0xFF00C853).withOpacity(0.3) 
                                  : Colors.white.withOpacity(0.05)
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.2),
                                blurRadius: 8,
                                offset: const Offset(0, 4),
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
                                          color: hasActivity ? const Color(0xFF00C853) : accentColor.withOpacity(0.5), 
                                          width: 2
                                        ),
                                        image: DecorationImage(
                                          image: AssetImage(listMarkerAsset),
                                          fit: BoxFit.cover,
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
                                              if (hasActivity) ...[
                                                const SizedBox(width: 8),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF00C853),
                                                    borderRadius: BorderRadius.circular(4),
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
                                          if (court.address != null && court.address!.isNotEmpty)
                                            Padding(
                                              padding: const EdgeInsets.only(top: 2),
                                              child: Row(
                                                children: [
                                                  Icon(Icons.location_on, size: 12, color: Colors.grey[500]),
                                                  const SizedBox(width: 3),
                                                  Expanded(
                                                    child: Text(
                                                      court.address!, 
                                                      maxLines: 2, 
                                                      overflow: TextOverflow.ellipsis,
                                                      style: TextStyle(color: Colors.grey[500], fontSize: 12),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            
                                          // Bottom Row: Kings & Followers
                                          const SizedBox(height: 8),
                                          Row(
                                            children: [
                                              // Kings Badges
                                              if (court.hasKings) ...[
                                                Icon(Icons.emoji_events_rounded, size: 14, color: Colors.amber[700]),
                                                const SizedBox(width: 4),
                                                if (court.king1v1 != null) _kingBadge('1v1', Colors.deepOrange),
                                                if (court.king3v3 != null) _kingBadge('3v3', Colors.blue),
                                                if (court.king5v5 != null) _kingBadge('5v5', Colors.purple),
                                                if (!court.isSignature) const SizedBox(width: 8), // Spacer if we have more stuff
                                              ],
                                              
                                              // Signature Badge (if space allows or instead of kings if it's simpler)
                                              if (court.isSignature)
                                                 Container(
                                                   padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                   decoration: BoxDecoration(
                                                     gradient: const LinearGradient(colors: [Color(0xFFFFD700), Color(0xFFFFA500)]),
                                                     borderRadius: BorderRadius.circular(4),
                                                   ),
                                                   child: const Text('LEGENDARY', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black)),
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
                                          key: index == 0 ? TutorialKeys.getKey(TutorialKeys.courtFollowButton) : null,
                                          onTap: () {
                                            checkInState.toggleFollow(court.id);
                                            final tutorial = context.read<TutorialState>();
                                            if (tutorial.isActive && tutorial.currentStep?.id == 'follow_court') {
                                              tutorial.completeStep('follow_court');
                                            }
                                          },
                                          child: Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: isFollowing ? Colors.red.withOpacity(0.15) : Colors.transparent,
                                              shape: BoxShape.circle,
                                            ),
                                            child: Icon(
                                              isFollowing ? Icons.favorite : Icons.favorite_border_rounded,
                                              size: 20,
                                              color: isFollowing ? Colors.redAccent : Colors.grey[600],
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        // Alert Bell
                                        GestureDetector(
                                          key: index == 0 ? TutorialKeys.getKey(TutorialKeys.courtAlertBell) : null,
                                          onTap: () {
                                            checkInState.toggleAlert(court.id);
                                            final tutorial = context.read<TutorialState>();
                                            if (tutorial.isActive && tutorial.currentStep?.id == 'enable_notifications') {
                                              tutorial.completeStep('enable_notifications');
                                            }
                                          },
                                          child: Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: hasAlert ? Colors.orange.withOpacity(0.15) : Colors.transparent,
                                              shape: BoxShape.circle,
                                            ),
                                            child: Icon(
                                              hasAlert ? Icons.notifications_active : Icons.notifications_none_rounded,
                                              size: 20,
                                              color: hasAlert ? Colors.orange : Colors.grey[600],
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

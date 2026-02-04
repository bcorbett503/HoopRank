import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/court_service.dart';
import '../services/profile_service.dart';
import '../services/zipcode_service.dart';
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
  List<Court> _courts = [];
  bool _isLoading = true;
  LatLng _initialCenter = const LatLng(38.0194, -122.5376); // Default to San Rafael
  double _currentZoom = 14.0;
  bool _showActiveOnly = false; // Filter for courts with same-day activity

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

    return await Geolocator.getCurrentPosition();
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
    
    // Apply active filter if enabled
    if (_showActiveOnly) {
      final checkInState = Provider.of<CheckInState>(context, listen: false);
      filteredCourts = filteredCourts.where((court) {
        return checkInState.hasCheckIns(court.id);
      }).toList();
    }
    
    setState(() {
      _courts = filteredCourts;
    });
  }
  
  void _toggleActiveFilter() {
    setState(() {
      _showActiveOnly = !_showActiveOnly;
    });
    // Re-run search with current query
    _onSearchChanged(_searchController.text);
  }

  void _updateCourtsForMapCenter() {
    // Use visible bounds to filter courts - only show courts actually visible on map
    final bounds = _mapController.camera.visibleBounds;
    
    final courtsInView = CourtService().getCourtsInBounds(
      bounds.south,
      bounds.west,
      bounds.north,
      bounds.east,
    );
    
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
                            // Update courts based on visible bounds on ANY change
                            _updateCourtsForMapCenter();
                          },
                        ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.example.mobile',
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
                      child: Card(
                        elevation: 4,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        child: Row(
                          children: [
                            Expanded(
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
                            // Active filter toggle
                            Consumer<CheckInState>(
                              builder: (context, checkInState, _) {
                                final activeCount = checkInState.activeCourts.length;
                                return GestureDetector(
                                  onTap: _toggleActiveFilter,
                                  child: Container(
                                    margin: const EdgeInsets.only(right: 8),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: _showActiveOnly ? Colors.green : Colors.grey[300],
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.local_fire_department,
                                          size: 16,
                                          color: _showActiveOnly ? Colors.white : Colors.grey[700],
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          'Active',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: _showActiveOnly ? Colors.white : Colors.grey[700],
                                          ),
                                        ),
                                        if (activeCount > 0) ...[
                                          const SizedBox(width: 4),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                            decoration: BoxDecoration(
                                              color: _showActiveOnly ? Colors.green[800] : Colors.grey[400],
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              '$activeCount',
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                                color: _showActiveOnly ? Colors.white : Colors.grey[700],
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
                          ],
                        ),
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
                  itemCount: _courts.length,
                  itemBuilder: (context, index) {
                    final court = _courts[index];
                    
                    // Determine which marker image to use for the list
                    String listMarkerAsset;
                    double listMarkerSize;
                    Color borderColor;
                    
                    if (court.isSignature) {
                      listMarkerAsset = 'assets/court_marker_signature_crown.jpg';
                      listMarkerSize = 44;
                      borderColor = Colors.amber;
                    } else if (court.hasKings) {
                      listMarkerAsset = 'assets/court_marker_king.jpg';
                      listMarkerSize = 40;
                      borderColor = Colors.orange;
                    } else {
                      listMarkerAsset = 'assets/court_marker.jpg';
                      listMarkerSize = 36;
                      borderColor = Colors.grey.shade400;
                    }
                    
                    return ListTile(
                      leading: Container(
                        width: listMarkerSize,
                        height: listMarkerSize,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: borderColor, width: 2),
                        ),
                        child: ClipOval(
                          child: Image.asset(
                            listMarkerAsset,
                            width: listMarkerSize,
                            height: listMarkerSize,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      title: Row(
                        children: [
                          Expanded(
                            child: Text(court.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                          ),
                          if (court.isSignature)
                            Container(
                              margin: const EdgeInsets.only(left: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFFFD700), Color(0xFFFFA500)],
                                ),
                                borderRadius: BorderRadius.circular(6),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.amber.withOpacity(0.4),
                                    blurRadius: 4,
                                    spreadRadius: 1,
                                  ),
                                ],
                              ),
                              child: const Text('👑 Legendary', 
                                style: TextStyle(fontSize: 10, color: Colors.black87, fontWeight: FontWeight.bold)),
                            ),
                        ],
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (court.address != null)
                            Text(court.address!, maxLines: 1, overflow: TextOverflow.ellipsis,
                                 style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                          if (court.hasKings)
                            Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Row(
                                children: [
                                  const Text('👑 ', style: TextStyle(fontSize: 12)),
                                  if (court.king1v1 != null)
                                    _kingBadge('1v1', Colors.deepOrange),
                                  if (court.king3v3 != null)
                                    _kingBadge('3v3', Colors.blue),
                                  if (court.king5v5 != null)
                                    _kingBadge('5v5', Colors.purple),
                                ],
                              ),
                            ),
                        ],
                      ),
                      trailing: Consumer<CheckInState>(
                        builder: (context, checkInState, _) {
                          final isFollowing = checkInState.isFollowing(court.id);
                          final hasAlert = checkInState.isAlertEnabled(court.id);
                          return Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // Follower count badge
                              if (checkInState.getFollowerCount(court.id) > 0)
                                Container(
                                  margin: const EdgeInsets.only(right: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.red.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.favorite, size: 12, color: Colors.red.shade300),
                                      const SizedBox(width: 2),
                                      Text(
                                        '${checkInState.getFollowerCount(court.id)}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.red.shade300,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              // Bell for alerts (tutorial target for first court)
                              IconButton(
                                key: index == 0 ? TutorialKeys.getKey(TutorialKeys.courtAlertBell) : null,
                                icon: Icon(
                                  hasAlert ? Icons.notifications_active : Icons.notifications_none,
                                  size: 20,
                                ),
                                color: hasAlert ? Colors.orange : Colors.grey[500],
                                onPressed: () {
                                  checkInState.toggleAlert(court.id);
                                  // Complete tutorial step if active
                                  final tutorial = context.read<TutorialState>();
                                  if (tutorial.isActive && tutorial.currentStep?.id == 'enable_notifications') {
                                    tutorial.completeStep('enable_notifications');
                                  }
                                },
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              ),
                              // Heart for follow (tutorial target for first court)
                              IconButton(
                                key: index == 0 ? TutorialKeys.getKey(TutorialKeys.courtFollowButton) : null,
                                icon: Icon(
                                  isFollowing ? Icons.favorite : Icons.favorite_border,
                                  size: 22,
                                ),
                                color: isFollowing ? Colors.red : Colors.grey[500],
                                onPressed: () {
                                  checkInState.toggleFollow(court.id);
                                  // Complete tutorial step if active
                                  final tutorial = context.read<TutorialState>();
                                  if (tutorial.isActive && tutorial.currentStep?.id == 'follow_court') {
                                    tutorial.completeStep('follow_court');
                                  }
                                },
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              ),
                            ],
                          );
                        },
                      ),
                      onTap: () => _zoomToCourtAndSelect(court),
                    );
                  },
                ),
              ),
            ],
          );
  }
}

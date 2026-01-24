import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/court_service.dart';
import '../state/check_in_state.dart';

class CourtMapWidget extends StatefulWidget {
  final Function(Court) onCourtSelected;
  final double? limitDistanceKm;
  final String? initialCourtId;

  const CourtMapWidget({
    super.key,
    required this.onCourtSelected,
    this.limitDistanceKm,
    this.initialCourtId,
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
  double _currentZoom = 10.0;
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
    final targetCourt = CourtService().getCourtById(courtId);
    if (targetCourt != null) {
      final target = LatLng(targetCourt.lat, targetCourt.lng);
      _mapController.move(target, 15.0);
      widget.onCourtSelected(targetCourt);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _initializeMap() async {
    await CourtService().loadCourts();
    
    try {
      Position position = await _determinePosition();
      _initialCenter = LatLng(position.latitude, position.longitude);
      
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
            _currentZoom = 15.0; // Zoom in closer for nearby search
          });
          return;
        }
      }
    } catch (e) {
      debugPrint('Error getting location: $e');
    }

    if (mounted) {
      setState(() {
        _courts = CourtService().getCourts();
        _isLoading = false;
      });
      
      // Handle initial court selection from query params
      if (widget.initialCourtId != null) {
        final targetCourt = CourtService().getCourtById(widget.initialCourtId!);
        if (targetCourt != null) {
          // Move map to the target court
          _initialCenter = LatLng(targetCourt.lat, targetCourt.lng);
          _currentZoom = 15.0;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _mapController.move(_initialCenter, _currentZoom);
            // Auto-select the court to show its details
            widget.onCourtSelected(targetCourt);
          });
        }
      }
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
                            
                            // Determine marker image and size (circular, so use same width/height)
                            String markerAsset;
                            double markerSize;
                            
                            if (isSignature) {
                              // Signature courts: crown marker, larger size
                              markerAsset = 'assets/court_marker_signature_crown.jpg';
                              markerSize = 36;
                            } else if (hasKings) {
                              // Courts with kings: king marker
                              markerAsset = 'assets/court_marker_king.jpg';
                              markerSize = 28;
                            } else {
                              // Regular courts
                              markerAsset = 'assets/court_marker.jpg';
                              markerSize = 22;
                            }
                            
                            return Marker(
                              point: LatLng(court.lat, court.lng),
                              width: markerSize,
                              height: markerSize,
                              child: GestureDetector(
                                onTap: () => widget.onCourtSelected(court),
                                child: Container(
                                  width: markerSize,
                                  height: markerSize,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: hasCheckIns
                                          ? Colors.green  // Active courts with check-ins
                                          : (isSignature 
                                              ? Colors.amber 
                                              : (hasKings ? Colors.orange : Colors.white)),
                                      width: hasCheckIns ? 3 : (isSignature ? 2.5 : 2),
                                    ),
                                    boxShadow: [
                                      if (hasCheckIns)
                                        BoxShadow(
                                          color: Colors.green.withOpacity(0.5),
                                          blurRadius: 8,
                                          spreadRadius: 2,
                                        ),
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.3),
                                        blurRadius: 4,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: ClipOval(
                                    child: Image.asset(
                                      markerAsset,
                                      width: markerSize,
                                      height: markerSize,
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                ),
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
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.amber.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: Colors.amber.withOpacity(0.5)),
                              ),
                              child: const Text('★ Signature', 
                                style: TextStyle(fontSize: 10, color: Colors.amber, fontWeight: FontWeight.bold)),
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
                              // Bell for alerts
                              IconButton(
                                icon: Icon(
                                  hasAlert ? Icons.notifications_active : Icons.notifications_none,
                                  size: 20,
                                ),
                                color: hasAlert ? Colors.orange : Colors.grey[500],
                                onPressed: () => checkInState.toggleAlert(court.id),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              ),
                              // Heart for follow
                              IconButton(
                                icon: Icon(
                                  isFollowing ? Icons.favorite : Icons.favorite_border,
                                  size: 22,
                                ),
                                color: isFollowing ? Colors.red : Colors.grey[500],
                                onPressed: () => checkInState.toggleFollow(court.id),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              ),
                            ],
                          );
                        },
                      ),
                      onTap: () => widget.onCourtSelected(court),
                    );
                  },
                ),
              ),
            ],
          );
  }
}

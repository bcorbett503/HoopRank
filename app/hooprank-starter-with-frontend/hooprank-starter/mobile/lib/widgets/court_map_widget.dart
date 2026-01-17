import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../models.dart';
import '../services/court_service.dart';

class CourtMapWidget extends StatefulWidget {
  final Function(Court) onCourtSelected;
  final double? limitDistanceKm;

  const CourtMapWidget({
    super.key,
    required this.onCourtSelected,
    this.limitDistanceKm,
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

  bool _noCourtsFound = false;

  @override
  void initState() {
    super.initState();
    _initializeMap();
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
    setState(() {
      _courts = CourtService().searchCourts(query);
    });
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
                            return Marker(
                              point: LatLng(court.lat, court.lng),
                              width: 40,
                              height: 40,
                              child: GestureDetector(
                                onTap: () => widget.onCourtSelected(court),
                                child: const Icon(
                                  Icons.location_on,
                                  color: Colors.red,
                                  size: 40,
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
                    return ListTile(
                      leading: const Icon(Icons.sports_basketball, color: Colors.orange),
                      title: Text(court.name),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(court.address ?? 'No address'),
                          if (court.king != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Row(
                                children: [
                                  const Icon(Icons.emoji_events, size: 16, color: Colors.amber),
                                  const SizedBox(width: 4),
                                  Text(
                                    'King: ${court.king}',
                                    style: const TextStyle(
                                      color: Colors.amber,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
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

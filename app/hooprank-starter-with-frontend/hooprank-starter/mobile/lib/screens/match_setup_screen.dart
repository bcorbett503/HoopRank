import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
import '../services/api_service.dart';
import '../services/court_service.dart';
import '../models.dart';

class MatchSetupScreen extends StatefulWidget {
  const MatchSetupScreen({super.key});

  @override
  State<MatchSetupScreen> createState() => _MatchSetupScreenState();
}

class _MatchSetupScreenState extends State<MatchSetupScreen> {
  String _search = '';
  List<User> _players = [];
  bool _isLoading = true;
  
  // Court selection
  Court? _selectedCourt;
  bool _isLoadingCourt = true;
  String? _courtError;
  List<Court> _allCourts = [];
  List<Court> _followedCourts = [];

  @override
  void initState() {
    super.initState();
    _loadPlayers();
    _loadCourts();
  }

  Future<void> _loadCourts() async {
    setState(() => _isLoadingCourt = true);
    try {
      // Load all courts
      await CourtService().loadCourts();
      _allCourts = CourtService().getAllCourts();
      
      // Get followed court IDs and resolve to Court objects
      final checkInState = Provider.of<CheckInState>(context, listen: false);
      final followedIds = checkInState.followedCourts;
      _followedCourts = _allCourts.where((c) => followedIds.contains(c.id)).toList();
      
      // Auto-detect nearby court if none selected
      await _detectNearbyCourt();
      
      if (mounted) setState(() => _isLoadingCourt = false);
    } catch (e) {
      debugPrint('Error loading courts: $e');
      if (mounted) setState(() {
        _courtError = 'Failed to load courts';
        _isLoadingCourt = false;
      });
    }
  }

  Future<void> _detectNearbyCourt() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      
      if (permission == LocationPermission.denied || 
          permission == LocationPermission.deniedForever) {
        return; // No auto-detection, user can still select manually
      }
      
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      
      // Find courts within 200 meters
      final nearbyCourts = CourtService().getCourtsNear(
        position.latitude,
        position.longitude,
        radiusKm: 0.2,
      );
      
      if (mounted && nearbyCourts.isNotEmpty && _selectedCourt == null) {
        setState(() => _selectedCourt = nearbyCourts.first);
        Provider.of<MatchState>(context, listen: false).setCourt(nearbyCourts.first);
      }
    } catch (e) {
      debugPrint('Error detecting nearby court: $e');
    }
  }

  void _showCourtPicker() {
    String searchText = '';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final filteredCourts = searchText.isEmpty
                ? [..._followedCourts, ..._allCourts.where((c) => !_followedCourts.any((f) => f.id == c.id))]
                : _allCourts.where((c) => c.name.toLowerCase().contains(searchText.toLowerCase())).toList();
            
            return DraggableScrollableSheet(
              initialChildSize: 0.7,
              minChildSize: 0.5,
              maxChildSize: 0.9,
              expand: false,
              builder: (context, scrollController) {
                return Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          Container(
                            width: 40, height: 4,
                            decoration: BoxDecoration(
                              color: Colors.grey[600],
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text('Select Court', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 12),
                          TextField(
                            decoration: InputDecoration(
                              hintText: 'Search courts...',
                              prefixIcon: const Icon(Icons.search),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                              filled: true,
                              fillColor: Colors.grey[850],
                            ),
                            onChanged: (val) => setModalState(() => searchText = val),
                          ),
                        ],
                      ),
                    ),
                    if (_followedCourts.isNotEmpty && searchText.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text('FOLLOWED COURTS', style: TextStyle(fontSize: 11, color: Colors.grey[500], fontWeight: FontWeight.bold)),
                        ),
                      ),
                    Expanded(
                      child: ListView.builder(
                        controller: scrollController,
                        itemCount: filteredCourts.length,
                        itemBuilder: (context, index) {
                          final court = filteredCourts[index];
                          final isFollowed = _followedCourts.any((f) => f.id == court.id);
                          final isSelected = _selectedCourt?.id == court.id;
                          
                          // Add divider before "All Courts" section
                          final showAllCourtsHeader = searchText.isEmpty && 
                              _followedCourts.isNotEmpty && 
                              index == _followedCourts.length;
                          
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (showAllCourtsHeader)
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                                  child: Text('ALL COURTS', style: TextStyle(fontSize: 11, color: Colors.grey[500], fontWeight: FontWeight.bold)),
                                ),
                              ListTile(
                                leading: Image.asset('assets/court_marker.jpg', width: 32, height: 26),
                                title: Text(court.name, style: TextStyle(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
                                subtitle: court.city != null ? Text(court.city!, style: TextStyle(color: Colors.grey[500], fontSize: 12)) : null,
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (isFollowed) Icon(Icons.star, size: 16, color: Colors.orange[300]),
                                    if (isSelected) const Icon(Icons.check, color: Colors.green),
                                  ],
                                ),
                                onTap: () {
                                  setState(() => _selectedCourt = court);
                                  Provider.of<MatchState>(context, listen: false).setCourt(court);
                                  Navigator.pop(context);
                                },
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }

  Future<void> _loadPlayers() async {
    try {
      final players = await ApiService.getPlayers();
      final me = Provider.of<AuthState>(context, listen: false).currentUser;
      if (mounted) {
        setState(() {
          // Filter out current user
          _players = players.where((p) => p.id != me?.id).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading players: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildCourtRow() {
    if (_isLoadingCourt) {
      return Row(
        children: [
          const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: 8),
          Text('Loading courts...', style: TextStyle(color: Colors.grey[500])),
        ],
      );
    }
    
    if (_selectedCourt != null) {
      return Row(
        children: [
          Image.asset('assets/court_marker.jpg', width: 24, height: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(_selectedCourt!.name, style: const TextStyle(fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          Icon(Icons.check_circle, size: 18, color: Colors.green[400]),
          const SizedBox(width: 8),
          Icon(Icons.edit, size: 16, color: Colors.grey[400]),
        ],
      );
    }
    
    // No court selected
    return Row(
      children: [
        Icon(Icons.add_location_alt, size: 18, color: Colors.orange[300]),
        const SizedBox(width: 8),
        Text('Tap to select court', style: TextStyle(color: Colors.orange[300])),
        const Spacer(),
        Icon(Icons.chevron_right, size: 18, color: Colors.grey[400]),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final match = context.watch<MatchState>();
    final me = auth.currentUser;
    
    final filteredPlayers = _players.where((p) => 
      p.name.toLowerCase().contains(_search.toLowerCase())
    ).toList();

    final canStart = match.opponent != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Set up your match')),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Mode: 1 v 1', style: TextStyle(color: Colors.grey)),
                  const SizedBox(height: 8),
                  // Tappable court selection row
                  InkWell(
                    onTap: _isLoadingCourt ? null : _showCourtPicker,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.grey[850],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: _buildCourtRow(),
                    ),
                  ),
                  const Divider(height: 24),
                  // Only show player picker if opponent not already set
                  if (match.opponent == null) ...[
                    const Text('Choose opponent', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextField(
                      decoration: const InputDecoration(
                        hintText: 'Search players...',
                        prefixIcon: Icon(Icons.search),
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 16),
                      ),
                      onChanged: (val) => setState(() => _search = val),
                    ),
                    const SizedBox(height: 16),
                    if (_isLoading)
                      const Center(child: CircularProgressIndicator())
                    else if (filteredPlayers.isEmpty)
                      Center(
                        child: Column(
                          children: [
                            Icon(Icons.person_search, size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 8),
                            Text(
                              _search.isEmpty ? 'No players found' : 'No players match "$_search"',
                              style: TextStyle(color: Colors.grey[500]),
                            ),
                          ],
                        ),
                      )
                    else
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 2.5,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                        ),
                        itemCount: filteredPlayers.length,
                        itemBuilder: (context, index) {
                          final p = filteredPlayers[index];
                          final isSelected = match.opponent?.id == p.id;
                          return InkWell(
                            onTap: () => match.setOpponent(p.toPlayer()),
                            child: Container(
                              decoration: BoxDecoration(
                                color: isSelected ? Colors.deepOrange.withOpacity(0.1) : Colors.white,
                                border: Border.all(color: isSelected ? Colors.deepOrange : Colors.grey.shade300),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              padding: const EdgeInsets.all(8),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  Text('Rating: ${p.rating.toStringAsFixed(1)}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                  ] else ...[
                    // Show matchup when opponent is already set
                    const SizedBox(height: 32),
                    Center(
                      child: Column(
                        children: [
                          const Text('Match Ready!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 16),
                          Text(
                            'You accepted a challenge from ${match.opponent?.name ?? "opponent"}',
                            style: const TextStyle(color: Colors.grey, fontSize: 14),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 32),
                          const Icon(Icons.sports_basketball, size: 80, color: Colors.deepOrange),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4, offset: const Offset(0, -2))],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('You', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(me?.name ?? 'Me', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const Text('VS', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Opponent', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(match.opponent?.name ?? '—', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: canStart
                        ? () {
                            match.startMatch();
                            context.go('/match/live');
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.deepOrange,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: const Text('Start Game'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}


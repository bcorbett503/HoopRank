import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../services/messages_service.dart';
import 'chat_screen.dart';

class PlayersScreen extends StatefulWidget {
  const PlayersScreen({super.key});

  @override
  State<PlayersScreen> createState() => _PlayersScreenState();
}

class _PlayersScreenState extends State<PlayersScreen> {
  List<User> _allPlayers = [];
  List<User> _filteredPlayers = [];
  bool _isLoading = true;

  // Filter state
  bool _isLocal = false; // false = Global, true = Local (25 miles)
  RangeValues _rankRange = const RangeValues(0, 5); // Min 0, Max 5

  @override
  void initState() {
    super.initState();
    _loadPlayers();
  }

  Future<void> _loadPlayers() async {
    try {
      // Load players based on proximity filter
      final players = _isLocal 
          ? await ApiService.getNearbyPlayers(radiusMiles: 25)
          : await ApiService.getPlayers();
      setState(() {
        _allPlayers = players;
        _applyFilters();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      print('Error loading players: $e');
    }
  }

  void _applyFilters() {
    _filteredPlayers = _allPlayers.where((player) {
      // Apply rank filter
      final rating = player.rating;
      return rating >= _rankRange.start && rating <= _rankRange.end;
    }).toList();
    
    // Sort by rating descending
    _filteredPlayers.sort((a, b) => b.rating.compareTo(a.rating));
  }

  void _onProximityChanged(bool isLocal) {
    setState(() {
      _isLocal = isLocal;
      _isLoading = true;
    });
    _loadPlayers();
  }

  void _onRankRangeChanged(RangeValues values) {
    setState(() {
      _rankRange = values;
      _applyFilters();
    });
  }

  String _getRankLabel(double rating) {
    if (rating >= 5.0) return 'Legend';
    if (rating >= 4.5) return 'Elite';
    if (rating >= 4.0) return 'Pro';
    if (rating >= 3.5) return 'All-Star';
    if (rating >= 3.0) return 'Starter';
    if (rating >= 2.5) return 'Bench';
    if (rating >= 2.0) return 'Rookie';
    return 'Newcomer';
  }

  Future<void> _showChallengeDialog(User player) async {
    final TextEditingController messageController = TextEditingController();
    
    return showDialog<void>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text('Challenge ${player.name}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Send a message to start the challenge:'),
              const SizedBox(height: 10),
              TextField(
                controller: messageController,
                decoration: const InputDecoration(
                  hintText: 'Let\'s play 1v1!',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Cancel'),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
            TextButton(
              child: const Text('Challenge'),
              onPressed: () async {
                final message = messageController.text.trim();
                if (message.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please enter a message')),
                  );
                  return;
                }
                
                Navigator.of(context).pop();
                await _sendChallenge(player, message);
              },
            ),
          ],
        );
      },
    );
  }

  Future<void> _sendChallenge(User player, String message) async {
    final currentUser = Provider.of<AuthState>(context, listen: false).currentUser;
    if (currentUser == null) return;

    try {
      await ApiService.createChallenge(
        toUserId: player.id,
        message: message,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Challenge sent to ${player.name}!')),
        );
        
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ChatScreen(otherUser: player),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error sending challenge: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = Provider.of<AuthState>(context, listen: false).currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Players'),
      ),
      body: Column(
        children: [
          // Filter Controls
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[900],
              border: Border(
                bottom: BorderSide(color: Colors.grey[800]!, width: 1),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Proximity Toggle
                Row(
                  children: [
                    const Text('Location:', style: TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(width: 16),
                    ToggleButtons(
                      isSelected: [!_isLocal, _isLocal],
                      onPressed: (index) => _onProximityChanged(index == 1),
                      borderRadius: BorderRadius.circular(8),
                      selectedColor: Colors.white,
                      fillColor: Colors.deepOrange,
                      color: Colors.grey,
                      constraints: const BoxConstraints(minWidth: 80, minHeight: 36),
                      children: const [
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12),
                          child: Text('Global'),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12),
                          child: Text('Local'),
                        ),
                      ],
                    ),
                    if (_isLocal)
                      const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: Text('(25 mi)', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Rank Range Slider
                Row(
                  children: [
                    const Text('Rank:', style: TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${_getRankLabel(_rankRange.start)} (${_rankRange.start.toStringAsFixed(1)})',
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                              Text(
                                '${_getRankLabel(_rankRange.end)} (${_rankRange.end.toStringAsFixed(1)})',
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                            ],
                          ),
                          RangeSlider(
                            values: _rankRange,
                            min: 0,
                            max: 5,
                            divisions: 10,
                            activeColor: Colors.deepOrange,
                            inactiveColor: Colors.grey[700],
                            labels: RangeLabels(
                              _rankRange.start.toStringAsFixed(1),
                              _rankRange.end.toStringAsFixed(1),
                            ),
                            onChanged: _onRankRangeChanged,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                // Results count
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    '${_filteredPlayers.length} players found',
                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          
          // Players List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredPlayers.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_off, size: 48, color: Colors.grey[600]),
                            const SizedBox(height: 16),
                            Text(
                              'No players found',
                              style: TextStyle(color: Colors.grey[600], fontSize: 16),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Try adjusting your filters',
                              style: TextStyle(color: Colors.grey[700], fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: _filteredPlayers.length,
                        itemBuilder: (context, index) {
                          final player = _filteredPlayers[index];
                          if (player.id == currentUser?.id) return const SizedBox.shrink();

                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundImage: player.photoUrl != null
                                    ? NetworkImage(player.photoUrl!)
                                    : null,
                                child: player.photoUrl == null
                                    ? Text(player.name.isNotEmpty ? player.name[0] : '?')
                                    : null,
                              ),
                              title: Text(player.name),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('⭐ ${player.rating.toStringAsFixed(1)} • ${_getRankLabel(player.rating)}'),
                                  if (player.city != null)
                                    Text('📍 ${player.city}', style: const TextStyle(fontSize: 12)),
                                ],
                              ),
                              isThreeLine: player.city != null,
                              trailing: ElevatedButton(
                                onPressed: () => _showChallengeDialog(player),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.deepOrange,
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('Challenge'),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

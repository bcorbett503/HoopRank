import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
import '../state/tutorial_state.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../services/messages_service.dart';
import '../widgets/player_profile_sheet.dart';
import 'chat_screen.dart';
import 'team_detail_screen.dart';

/// Rankings Screen with Players (1v1) and Teams (3v3/5v5) tabs
class RankingsScreen extends StatefulWidget {
  final int initialTab;
  final String? initialTeamType;
  
  const RankingsScreen({
    super.key,
    this.initialTab = 0,
    this.initialTeamType,
  });

  @override
  State<RankingsScreen> createState() => _RankingsScreenState();
}

class _RankingsScreenState extends State<RankingsScreen> with SingleTickerProviderStateMixin {
  final MessagesService _messagesService = MessagesService();
  
  late TabController _tabController;
  
  // Players tab state
  List<User> _players = [];
  Map<String, String> _playerTeamIds = {}; // Map player id -> team id
  Set<String> _pendingChallengeUserIds = {};
  bool _isLoadingPlayers = true;
  bool _isLocal = false;
  String _searchQuery = '';
  String _ageFilter = 'All'; // 'All', '13-18', '18-25', '26-35', '35+'
  String _rankFilter = 'All'; // 'All', '1+', '2+', '3+', '4+'
  
  // Teams tab state
  List<Map<String, dynamic>> _teams = [];
  bool _isLoadingTeams = true;
  String _teamFilter = '3v3'; // '3v3' or '5v5'
  String _teamSearchQuery = '';
  bool _isTeamLocal = false;
  
  // User's teams for invite functionality
  List<Map<String, dynamic>> _myTeams = [];
  
  // Current user's own ranking info
  double _myRating = 3.0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this, initialIndex: widget.initialTab);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      if (_tabController.index == 1 && _teams.isEmpty) {
        _fetchTeams();
      }
    });
    
    // Apply initial team type if provided (for deep linking)
    if (widget.initialTeamType != null) {
      _teamFilter = widget.initialTeamType!;
    }
    
    _fetchPlayers();
    _fetchMyTeams();
    _fetchMyRating();
    
    // If starting on Teams tab, fetch teams immediately
    if (widget.initialTab == 1) {
      _fetchTeams();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Auto-refresh data when navigating to this screen
    _fetchPlayers();
    _fetchMyTeams();
    if (_tabController.index == 1) {
      _fetchTeams();
    }
  }

  Future<void> _fetchPlayers() async {
    final currentUser = Provider.of<AuthState>(context, listen: false).currentUser;
    setState(() => _isLoadingPlayers = true);
    
    try {
      final url = _isLocal 
          ? '${ApiService.baseUrl}/users/nearby?radiusMiles=25'
          : '${ApiService.baseUrl}/rankings?mode=1v1';
      
      final response = await http.get(
        Uri.parse(url),
        headers: {'x-user-id': currentUser?.id ?? ''},
      );
      
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        // Handle both formats: direct array (users/nearby) or wrapped in 'rankings' key
        final List<dynamic> jsonList = decoded is List 
            ? decoded 
            : (decoded['rankings'] as List?) ?? [];
        final List<User> players = [];
        final Map<String, String> playerTeamIds = {};
        for (var item in jsonList) {
          final id = item['id']?.toString() ?? '';
          if (id.isNotEmpty) {
            double rating = 0.0;
            final ratingValue = item['rating'];
            if (ratingValue is num) {
              rating = ratingValue.toDouble();
            } else if (ratingValue is String) {
              rating = double.tryParse(ratingValue) ?? 0.0;
            }
            
            // Parse age from API response
            int? age;
            final ageValue = item['age'];
            if (ageValue is int) {
              age = ageValue;
            } else if (ageValue is num) {
              age = ageValue.toInt();
            }
            
            players.add(User(
              id: id,
              name: item['name']?.toString() ?? 'Unknown',
              photoUrl: item['photoUrl']?.toString(),
              position: item['position']?.toString(),
              rating: rating,
              city: item['city']?.toString(),
              team: item['team']?.toString(),
              age: age,
            ));
            // Store teamId separately
            final teamId = item['teamId']?.toString();
            if (teamId != null) {
              playerTeamIds[id] = teamId;
            }
          }
        }
        
        Set<String> pendingIds = {};
        if (currentUser != null) {
          try {
            final challenges = await _messagesService.getPendingChallenges(currentUser.id);
            for (final c in challenges) {
              if (c.isSent) pendingIds.add(c.otherUser.id);
            }
          } catch (e) {
            debugPrint('Error loading challenges: $e');
          }
        }
        
        setState(() {
          _players = players;
          _playerTeamIds = playerTeamIds;
          _pendingChallengeUserIds = pendingIds;
          _isLoadingPlayers = false;
        });
      } else {
        setState(() => _isLoadingPlayers = false);
      }
    } catch (e) {
      debugPrint('Error: $e');
      setState(() => _isLoadingPlayers = false);
    }
  }

  Future<void> _fetchTeams() async {
    setState(() => _isLoadingTeams = true);
    try {
      // Use /rankings endpoint with mode=3v3 or 5v5 to get all teams (not just user's teams)
      final scope = _isTeamLocal ? 'local' : 'global';
      final response = await http.get(
        Uri.parse('${ApiService.baseUrl}/rankings?mode=$_teamFilter&scope=$scope'),
        headers: {'x-user-id': ApiService.userId ?? ''},
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final rawTeams = (data as List?)?.cast<Map<String, dynamic>>() ?? [];
        debugPrint('_fetchTeams: got ${rawTeams.length} teams from /rankings?mode=$_teamFilter');
        setState(() {
          _teams = rawTeams;
          _isLoadingTeams = false;
        });
      } else {
        debugPrint('Failed to fetch teams: ${response.statusCode}');
        setState(() => _isLoadingTeams = false);
      }
    } catch (e) {
      debugPrint('Error fetching teams: $e');
      setState(() => _isLoadingTeams = false);
    }
  }

  Future<void> _fetchMyTeams() async {
    try {
      final teams = await ApiService.getMyTeams();
      setState(() => _myTeams = teams);
    } catch (e) {
      debugPrint('Error fetching my teams: $e');
    }
  }

  void _fetchMyRating() {
    final appState = Provider.of<AuthState>(context, listen: false);
    final currentUser = appState.currentUser;
    if (currentUser != null) {
      setState(() {
        _myRating = currentUser.rating;
      });
    }
  }

  List<User> get _filteredPlayers {
    final currentUser = Provider.of<AuthState>(context, listen: false).currentUser;
    
    return _players.where((p) {
      if (p.id == currentUser?.id) return false;
      if (!p.name.toLowerCase().contains(_searchQuery.toLowerCase())) return false;
      
      // Rank filter - filter by minimum rating
      if (_rankFilter != 'All') {
        final minRating = double.parse(_rankFilter.replaceAll('+', ''));
        if (p.rating < minRating) return false;
      }
      
      // Age filter - exclude users without age data when filter is active
      if (_ageFilter != 'All') {
        if (p.age == null) return false; // No age data = exclude when filtering
        final age = p.age!;
        switch (_ageFilter) {
          case '13-18':
            if (age < 13 || age > 18) return false;
            break;
          case '18-25':
            if (age < 18 || age > 25) return false;
            break;
          case '26-35':
            if (age < 26 || age > 35) return false;
            break;
          case '35+':
            if (age < 35) return false;
            break;
        }
      }
      
      return true;
    }).toList()
      ..sort((a, b) => b.rating.compareTo(a.rating));
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

  /// Build a rating chip for the My HoopRanks section
  Widget _buildRatingChip(String label, double rating, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              label,
              style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.5),
            ),
          ),
          Expanded(child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                rating.toStringAsFixed(2),
                style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                _getRankLabel(rating),
                style: const TextStyle(color: Colors.white54, fontSize: 10),
              ),
            ],
          )),
        ],
      ),
    );
  }

  /// Build a team slot for 3v3 or 5v5 - shows rating if user has team, or "Find a Team" if not
  Widget _buildTeamSlot(String teamType, Color color) {
    // Find user's team of this type
    final team = _myTeams.firstWhere(
      (t) => t['teamType'] == teamType,
      orElse: () => <String, dynamic>{},
    );
    
    final hasTeam = team.isNotEmpty;
    // Parse rating safely - backend may return String or num
    final ratingValue = team['rating'];
    final rating = hasTeam ? (ratingValue is num ? ratingValue.toDouble() : (double.tryParse(ratingValue?.toString() ?? '') ?? 3.0)) : 0.0;
    final teamName = hasTeam ? (team['name'] ?? teamType) : null;
    
    return GestureDetector(
      onTap: () {
        if (!hasTeam) {
          // Navigate to Teams tab to find/create a team
          final tabController = DefaultTabController.of(context);
          if (tabController.length > 1) {
            tabController.animateTo(1); // Switch to Teams tab
          }
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: hasTeam ? Colors.white.withOpacity(0.1) : Colors.white.withOpacity(0.05)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                teamType,
                style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.5),
              ),
            ),
            Expanded(child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (hasTeam) ...[
                  Text(
                    rating.toStringAsFixed(2),
                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    teamName!,
                    style: const TextStyle(color: Colors.white54, fontSize: 10),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    textAlign: TextAlign.center,
                  ),
                ] else ...[
                  const Icon(Icons.add_circle_outline, color: Colors.white30, size: 24),
                  const SizedBox(height: 4),
                  const Text(
                    'JOIN',
                    style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ],
              ],
            )),
          ],
        ),
      ),
    );
  }

  void _showPlayerProfile(User player) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => PlayerProfileSheet(
        player: player,
        onMessage: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => ChatScreen(userId: player.id)),
          );
        },
        onChallenge: () {
          _showChallengeDialog(player);
        },
        onInviteToTeam: () {
          _showInviteToTeamDialog(player);
        },
      ),
    );
  }

  void _showInviteToTeamDialog(User player) async {
    // Always refresh teams to catch newly created ones
    await _fetchMyTeams();
    
    // Fetch player's existing team memberships
    final playerTeams = await ApiService.getUserTeams(player.id);
    final playerTeamTypes = playerTeams.map((t) => t['teamType'] as String?).toSet();
    
    // Check if player is already on both 3v3 and 5v5 teams
    final hasAll3v3 = playerTeamTypes.contains('3v3');
    final hasAll5v5 = playerTeamTypes.contains('5v5');
    final playerIsOnBothTypes = hasAll3v3 && hasAll5v5;
    
    // Build team names string for message
    final teamNamesList = playerTeams.map((t) => '${t['name']} (${t['teamType']})').toList();
    final teamsMessage = teamNamesList.join(' and ');
    
    // Filter to teams where user is owner and team isn't full
    final eligibleTeams = _myTeams.where((t) => t['isOwner'] == true).toList();
    
    if (eligibleTeams.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create a team first to invite players')),
      );
      return;
    }
    
    // If player is already on both team types, show message
    if (playerIsOnBothTypes) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${player.name} is already on $teamsMessage')),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Invite ${player.name} to Team'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: eligibleTeams.length,
            itemBuilder: (context, index) {
              final team = eligibleTeams[index];
              final teamType = team['teamType'] as String?;
              
              // Check if player is already on a team of this type
              final existingTeamOfType = playerTeams.firstWhere(
                (t) => t['teamType'] == teamType,
                orElse: () => <String, dynamic>{},
              );
              final isAlreadyOnTeamType = existingTeamOfType.isNotEmpty;
              final existingTeamName = existingTeamOfType['name'] ?? '';
              
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: team['teamType'] == '3v3' ? Colors.blue : Colors.purple,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          team['teamType'] ?? '3v3',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(team['name'] ?? 'Team', style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text('${team['memberCount'] ?? 1} members', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        onPressed: isAlreadyOnTeamType
                            ? () {
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('${player.name} is already on a $teamType team: $existingTeamName'),
                                  ),
                                );
                              }
                            : () async {
                                Navigator.pop(ctx);
                                try {
                                  await ApiService.inviteToTeam(team['id'], player.id);
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Invited ${player.name} to ${team['name']}!')),
                                    );
                                  }
                                } catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Failed to invite: $e')),
                                    );
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isAlreadyOnTeamType ? Colors.grey : Colors.deepOrange,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        ),
                        child: Text(isAlreadyOnTeamType ? 'On Team' : 'Invite'),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }

  void _showChallengeDialog(User player) {
    final messageController = TextEditingController(text: 'Want to play?');
    
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.sports_basketball, color: Colors.deepOrange),
            const SizedBox(width: 8),
            Expanded(child: Text('Challenge ${player.name}')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: messageController,
              decoration: InputDecoration(
                labelText: 'Your message',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              maxLines: 2,
              autofocus: true,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              final message = messageController.text.trim();
              if (message.isEmpty) return;
              Navigator.pop(dialogContext);
              
              try {
                await ApiService.createChallenge(toUserId: player.id, message: message);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Challenge sent to ${player.name}!')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e')),
                  );
                }
              }
            },
            icon: const Icon(Icons.sports_basketball),
            label: const Text('Send Challenge'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          TabBar(
            controller: _tabController,
            tabs: const [
              Tab(text: 'Players (1v1)'),
              Tab(text: 'Teams'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildPlayersTab(),
                _buildTeamsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayersTab() {
    final filtered = _filteredPlayers;
    
    return Column(
      children: [
        // === My HoopRanks Section ===
        Container(
          width: double.infinity,
          margin: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.grey.shade900,
                Colors.blueGrey.shade900,
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.4),
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.amber.withOpacity(0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.emoji_events, size: 14, color: Colors.amber),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'RANKINGS',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
                // Rating chips row
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(child: _buildRatingChip('1v1', _myRating, Colors.deepOrange)),
                      const SizedBox(width: 8),
                      Expanded(child: _buildTeamSlot('3v3', Colors.blue)),
                      const SizedBox(width: 8),
                      Expanded(child: _buildTeamSlot('5v5', Colors.purple)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        
        // Search and filter
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search by name...',
              hintStyle: TextStyle(color: Colors.white30),
              prefixIcon: const Icon(Icons.search, color: Colors.white54),
              filled: true,
              fillColor: Colors.white.withOpacity(0.05),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
        ),
        
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                // Location filter
                ChoiceChip(
                  label: const Text('Global'),
                  selected: !_isLocal,
                  onSelected: (_) {
                    setState(() => _isLocal = false);
                    _fetchPlayers();
                  },
                ),
                const SizedBox(width: 6),
                ChoiceChip(
                  key: TutorialKeys.getKey(TutorialKeys.rankingsLocalChip),
                  label: const Text('Local'),
                  selected: _isLocal,
                  onSelected: (_) {
                    setState(() => _isLocal = true);
                    _fetchPlayers();
                    // Complete tutorial step if active
                    final tutorial = context.read<TutorialState>();
                    if (tutorial.isActive && tutorial.currentStep?.id == 'local_players') {
                      tutorial.completeStep('local_players');
                    }
                  },
                ),
                const SizedBox(width: 12),
                Container(width: 1, height: 24, color: Colors.grey[600]),
                const SizedBox(width: 12),
                // Rank filter dropdown
                DropdownButton<String>(
                  value: _rankFilter,
                  underline: const SizedBox(),
                  isDense: true,
                  items: ['All', '1+', '2+', '3+', '4+']
                      .map((r) => DropdownMenuItem(value: r, child: Text('Rating: $r')))
                      .toList(),
                  onChanged: (v) => setState(() => _rankFilter = v ?? 'All'),
                ),
                const SizedBox(width: 12),
                Container(width: 1, height: 24, color: Colors.grey[600]),
                const SizedBox(width: 12),
                // Age filter dropdown
                DropdownButton<String>(
                  value: _ageFilter,
                  underline: const SizedBox(),
                  isDense: true,
                  items: ['All', '13-18', '18-25', '26-35', '35+']
                      .map((a) => DropdownMenuItem(value: a, child: Text('Age: $a')))
                      .toList(),
                  onChanged: (v) => setState(() => _ageFilter = v ?? 'All'),
                ),
              ],
            ),
          ),
        ),
        
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(
            children: [
              Text('${filtered.length} players', style: TextStyle(color: Colors.grey[500])),
              if (_isLocal) Text(' (25 mi)', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
            ],
          ),
        ),
        
        Expanded(
          child: _isLoadingPlayers
              ? const Center(child: CircularProgressIndicator())
              : filtered.isEmpty
                  ? const Center(child: Text('No players found'))
                  : RefreshIndicator(
                      onRefresh: _fetchPlayers,
                      child: ListView.builder(
                        itemCount: filtered.length,
                        itemBuilder: (context, index) => _buildPlayerCard(filtered[index], index),
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildPlayerCard(User player, int index) {
    final hasPending = _pendingChallengeUserIds.contains(player.id);
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
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
          onTap: () => _showPlayerProfile(player),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: Colors.blue.withOpacity(0.2),
                  backgroundImage: player.photoUrl != null ? NetworkImage(player.photoUrl!) : null,
                  child: player.photoUrl == null
                      ? Text(player.name.isNotEmpty ? player.name[0].toUpperCase() : '?', 
                          style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold))
                      : null,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        player.name, 
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)
                      ),
                      const SizedBox(height: 4),
                      GestureDetector(
                        onTap: _playerTeamIds[player.id] != null
                            ? () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => TeamDetailScreen(teamId: _playerTeamIds[player.id]!),
                                  ),
                                )
                            : () => _showInviteToTeamDialog(player),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              player.team ?? 'No Team',
                              style: TextStyle(
                                color: _playerTeamIds[player.id] != null ? Colors.blue[300] : Colors.white30,
                                fontSize: 13,
                                fontWeight: _playerTeamIds[player.id] != null ? FontWeight.w500 : FontWeight.normal,
                              ),
                            ),
                            if (player.team == null) ...[
                              const SizedBox(width: 4),
                              Icon(Icons.add_circle_outline, size: 14, color: Colors.blue),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (hasPending)
                  Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.orange.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.orange.withOpacity(0.3)),
                    ),
                    child: const Text('Pending', style: TextStyle(fontSize: 10, color: Colors.orange, fontWeight: FontWeight.bold)),
                  ),
                // Quick action buttons (tutorial target for first player)
                Row(
                  key: index == 0 ? TutorialKeys.getKey(TutorialKeys.playerActionButtons) : null,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chat_bubble_outline, size: 20),
                      color: Colors.white30,
                      tooltip: 'Message',
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                      onPressed: () {
                        // Complete tutorial step if active
                        final tutorial = context.read<TutorialState>();
                        if (tutorial.isActive && tutorial.currentStep?.id == 'player_actions') {
                          tutorial.completeStep('player_actions');
                        }
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => ChatScreen(userId: player.id)),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.sports_basketball, size: 20),
                      color: Colors.deepOrange,
                      tooltip: 'Challenge',
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                      onPressed: () {
                        // Complete tutorial step if active
                        final tutorial = context.read<TutorialState>();
                        if (tutorial.isActive && tutorial.currentStep?.id == 'player_actions') {
                          tutorial.completeStep('player_actions');
                        }
                        _showChallengeDialog(player);
                      },
                    ),
                    // Follow heart button
                    Consumer<CheckInState>(
                      builder: (context, checkInState, _) {
                        final isFollowing = checkInState.isFollowingPlayer(player.id);
                        return IconButton(
                          icon: Icon(
                            isFollowing ? Icons.favorite : Icons.favorite_border,
                            size: 20,
                          ),
                          color: isFollowing ? Colors.blueAccent : Colors.white30,
                          tooltip: isFollowing ? 'Unfollow' : 'Follow',
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          onPressed: () {
                            checkInState.toggleFollowPlayer(player.id);
                            // Complete tutorial step if active
                            final tutorial = context.read<TutorialState>();
                            if (tutorial.isActive && tutorial.currentStep?.id == 'player_actions') {
                              tutorial.completeStep('player_actions');
                            }
                          },
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        player.rating.toStringAsFixed(1), 
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.amber)
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(_getRankLabel(player.rating), 
                        style: const TextStyle(fontSize: 10, color: Colors.white30)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTeamsTab() {
    // Filter teams by search query
    final filteredTeams = _teams.where((t) {
      final name = (t['name'] ?? '').toString().toLowerCase();
      return name.contains(_teamSearchQuery.toLowerCase());
    }).toList();
    
    return Column(
      children: [
        // Search field
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search teams by name...',
              hintStyle: TextStyle(color: Colors.white30),
              prefixIcon: const Icon(Icons.search, color: Colors.white54),
              filled: true,
              fillColor: Colors.white.withOpacity(0.05),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (v) => setState(() => _teamSearchQuery = v),
          ),
        ),
        
        // Mode and location filter
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              ChoiceChip(
                label: const Text('3v3'),
                selected: _teamFilter == '3v3',
                selectedColor: Colors.blue,
                labelStyle: TextStyle(color: _teamFilter == '3v3' ? Colors.white : null),
                onSelected: (_) {
                  setState(() => _teamFilter = '3v3');
                  _fetchTeams();
                },
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('5v5'),
                selected: _teamFilter == '5v5',
                selectedColor: Colors.purple,
                labelStyle: TextStyle(color: _teamFilter == '5v5' ? Colors.white : null),
                onSelected: (_) {
                  setState(() => _teamFilter = '5v5');
                  _fetchTeams();
                },
              ),
              const SizedBox(width: 12),
              Container(width: 1, height: 24, color: Colors.grey[600]),
              const SizedBox(width: 12),
              ChoiceChip(
                label: const Text('Global'),
                selected: !_isTeamLocal,
                onSelected: (_) {
                  setState(() => _isTeamLocal = false);
                  _fetchTeams();
                },
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Local'),
                selected: _isTeamLocal,
                onSelected: (_) {
                  setState(() => _isTeamLocal = true);
                  _fetchTeams();
                },
              ),
            ],
          ),
        ),
        
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              Text('${filteredTeams.length} teams', style: TextStyle(color: Colors.grey[500])),
              if (_isTeamLocal) const Text(' (25 mi)', style: TextStyle(color: Colors.grey)),
            ],
          ),
        ),
        
        Expanded(
          child: _isLoadingTeams
              ? const Center(child: CircularProgressIndicator())
              : filteredTeams.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.groups, size: 64, color: Colors.grey[400]),
                          const SizedBox(height: 16),
                          Text('No $_teamFilter teams found', style: TextStyle(color: Colors.grey[600])),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchTeams,
                      child: ListView.builder(
                        itemCount: filteredTeams.length,
                        itemBuilder: (context, index) => _buildTeamRankingCard(filteredTeams[index], index + 1),
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildTeamRankingCard(Map<String, dynamic> team, int rank) {
    // Parse safely - backend may return String or num
    final ratingValue = team['rating'];
    final rating = ratingValue is num ? ratingValue.toDouble() : (double.tryParse(ratingValue?.toString() ?? '') ?? 3.0);
    final winsValue = team['wins'];
    final wins = winsValue is int ? winsValue : (int.tryParse(winsValue?.toString() ?? '') ?? 0);
    final lossesValue = team['losses'];
    final losses = lossesValue is int ? lossesValue : (int.tryParse(lossesValue?.toString() ?? '') ?? 0);
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
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
          onTap: () => _showTeamActionSheet(team),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Rank number
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: rank <= 3 ? Colors.amber.withOpacity(0.2) : Colors.white.withOpacity(0.05),
                    shape: BoxShape.circle,
                    border: rank <= 3 ? Border.all(color: Colors.amber.withOpacity(0.5)) : null,
                  ),
                  child: Center(
                    child: Text(
                      '#$rank', 
                      style: TextStyle(
                        fontWeight: FontWeight.bold, 
                        fontSize: 12,
                        color: rank <= 3 ? Colors.amber : Colors.white54
                      )
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                // Team type badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _teamFilter == '3v3' ? Colors.blue.withOpacity(0.2) : Colors.purple.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: _teamFilter == '3v3' ? Colors.blue.withOpacity(0.3) : Colors.purple.withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    _teamFilter, 
                    style: TextStyle(
                      color: _teamFilter == '3v3' ? Colors.blue[300] : Colors.purple[200], 
                      fontWeight: FontWeight.bold, 
                      fontSize: 11
                    )
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        team['name'] ?? 'Team', 
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${team['memberCount'] ?? 1} members • ${team['ownerName'] ?? 'Unknown'}', 
                        style: const TextStyle(color: Colors.white30, fontSize: 12)
                      ),
                    ],
                  ),
                ),
                // Follow heart button
                Consumer<CheckInState>(
                  builder: (context, checkInState, _) {
                    final teamId = team['id']?.toString() ?? '';
                    final isOwnTeam = _myTeams.any((t) => t['id'] == team['id']);
                    final isFollowing = checkInState.isFollowingTeam(teamId);
                    // Auto-follow own team
                    if (isOwnTeam && !isFollowing) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        checkInState.followTeam(teamId, teamName: team['name']?.toString());
                      });
                    }
                    return IconButton(
                      icon: Icon(
                        (isFollowing || isOwnTeam) ? Icons.favorite : Icons.favorite_border,
                        size: 20,
                      ),
                      color: (isFollowing || isOwnTeam) ? Colors.red : Colors.white30,
                      tooltip: isOwnTeam ? 'Your team' : (isFollowing ? 'Unfollow' : 'Follow'),
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                      onPressed: isOwnTeam ? null : () {
                        if (isFollowing) {
                          checkInState.unfollowTeam(teamId);
                        } else {
                          checkInState.followTeam(teamId, teamName: team['name']?.toString());
                        }
                      },
                    );
                  },
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        rating.toStringAsFixed(2), 
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white)
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$wins W - $losses L', 
                      style: const TextStyle(fontSize: 11, color: Colors.white30)
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showTeamActionSheet(Map<String, dynamic> team) {
    final hasTeamOfType = _myTeams.any((t) => t['teamType'] == team['teamType']);
    // Check if this is the user's own team
    final isOwnTeam = _myTeams.any((t) => t['id'] == team['id']);
    // Can only challenge if user has a team of this type AND it's not their own team
    final canChallenge = hasTeamOfType && !isOwnTeam;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Team header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: team['teamType'] == '3v3' ? Colors.blue : Colors.purple,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(team['teamType'] ?? '3v3', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      team['name'] ?? 'Team',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                  if (isOwnTeam)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.green.withOpacity(0.5)),
                      ),
                      child: const Text('Your Team', style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Builder(builder: (context) {
                final rv = team['rating']; 
                final ratingD = rv is num ? rv.toDouble() : (double.tryParse(rv?.toString() ?? '') ?? 3.0);
                return Text('Rating: ${ratingD.toStringAsFixed(2)} • ${team['wins'] ?? 0}W-${team['losses'] ?? 0}L',
                    style: TextStyle(color: Colors.grey[400]));
              }),
              const SizedBox(height: 20),
              
              // View Details
              ListTile(
                leading: const Icon(Icons.visibility, color: Colors.white),
                title: const Text('View Team Details', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => TeamDetailScreen(teamId: team['id'])));
                },
              ),
              
              // Message Team (only show if not own team)
              if (!isOwnTeam)
                ListTile(
                  leading: const Icon(Icons.chat_bubble_outline, color: Colors.blue),
                  title: const Text('Message Team', style: TextStyle(color: Colors.white)),
                  subtitle: Text('Chat with ${team['name']}', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    // Navigate to team chat (using team's chat_id if available)
                    final chatId = team['chatId'];
                    if (chatId != null) {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => ChatScreen(userId: chatId)));
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Team chat not available')),
                      );
                    }
                  },
                ),
              
              // Challenge Team (disabled if own team or no team of same type)
              if (!isOwnTeam)
                ListTile(
                  leading: Icon(Icons.sports_basketball, 
                      color: canChallenge ? Colors.deepOrange : Colors.grey),
                  title: Text('Challenge Team', 
                      style: TextStyle(color: canChallenge ? Colors.white : Colors.grey)),
                  subtitle: Text(
                    canChallenge 
                        ? 'Send a ${team['teamType']} challenge' 
                        : 'You need a ${team['teamType']} team to challenge',
                    style: TextStyle(color: Colors.grey[500], fontSize: 12),
                  ),
                  onTap: canChallenge ? () {
                    Navigator.pop(ctx);
                    _showChallengeTeamDialog(team);
                  } : null,
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showChallengeTeamDialog(Map<String, dynamic> opponentTeam) {
    // Find user's team of matching type
    final myTeam = _myTeams.firstWhere(
      (t) => t['teamType'] == opponentTeam['teamType'],
      orElse: () => <String, dynamic>{},
    );
    if (myTeam.isEmpty) return;

    final messageController = TextEditingController(text: 'Let\'s play!');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Challenge ${opponentTeam['name']}?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Your team: ${myTeam['name']}'),
            const SizedBox(height: 8),
            Text('Mode: ${opponentTeam['teamType']}'),
            const SizedBox(height: 16),
            TextField(
              controller: messageController,
              decoration: InputDecoration(
                labelText: 'Message (optional)',
                hintText: 'Add a message to your challenge...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                filled: true,
                fillColor: Colors.grey[800],
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 8),
            Text('They will receive a notification to accept or decline.', 
                style: TextStyle(color: Colors.grey[600], fontSize: 12)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ApiService.challengeTeam(
                  teamId: myTeam['id'],
                  opponentTeamId: opponentTeam['id'],
                  message: messageController.text.isNotEmpty ? messageController.text : null,
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Challenge sent to ${opponentTeam['name']}!')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed to send challenge: $e')),
                  );
                }
              }
            },
            icon: const Icon(Icons.sports_basketball),
            label: const Text('Send Challenge'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

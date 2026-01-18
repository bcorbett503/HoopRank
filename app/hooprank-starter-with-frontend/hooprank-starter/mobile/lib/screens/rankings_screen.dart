import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../services/messages_service.dart';
import '../widgets/player_profile_sheet.dart';
import 'chat_screen.dart';
import 'team_detail_screen.dart';

/// Rankings Screen with Players (1v1) and Teams (3v3/5v5) tabs
class RankingsScreen extends StatefulWidget {
  const RankingsScreen({super.key});

  @override
  State<RankingsScreen> createState() => _RankingsScreenState();
}

class _RankingsScreenState extends State<RankingsScreen> with SingleTickerProviderStateMixin {
  final MessagesService _messagesService = MessagesService();
  
  late TabController _tabController;
  
  // Players tab state
  List<User> _players = [];
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

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      if (_tabController.index == 1 && _teams.isEmpty) {
        _fetchTeams();
      }
    });
    _fetchPlayers();
    _fetchMyTeams();
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
            
            players.add(User(
              id: id,
              name: item['name']?.toString() ?? 'Unknown',
              photoUrl: item['photoUrl']?.toString(),
              position: item['position']?.toString(),
              rating: rating,
              city: item['city']?.toString(),
            ));
          }
        }
        
        Set<String> pendingIds = {};
        if (currentUser != null) {
          try {
            final challenges = await _messagesService.getPendingChallenges(currentUser.id);
            for (final c in challenges) {
              if (c.isSent) pendingIds.add(c.sender.id);
            }
          } catch (e) {
            debugPrint('Error loading challenges: $e');
          }
        }
        
        setState(() {
          _players = players;
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
      final response = await http.get(
        Uri.parse('${ApiService.baseUrl}/rankings?mode=$_teamFilter'),
        headers: {'x-user-id': ApiService.userId ?? ''},
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _teams = (data['rankings'] as List?)?.cast<Map<String, dynamic>>() ?? [];
          _isLoadingTeams = false;
        });
      } else {
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
    
    // Filter to teams where user is owner and team isn't full
    final eligibleTeams = _myTeams.where((t) => t['isOwner'] == true).toList();
    
    if (eligibleTeams.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create a team first to invite players')),
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
                        onPressed: () async {
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
                          backgroundColor: Colors.deepOrange,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        ),
                        child: const Text('Invite'),
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
      appBar: AppBar(
        title: const Text('Rankings'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Players (1v1)'),
            Tab(text: 'Teams'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildPlayersTab(),
          _buildTeamsTab(),
        ],
      ),
    );
  }

  Widget _buildPlayersTab() {
    final filtered = _filteredPlayers;
    
    return Column(
      children: [
        // Search and filter
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search by name...',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Theme.of(context).cardColor,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
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
                  label: const Text('Local'),
                  selected: _isLocal,
                  onSelected: (_) {
                    setState(() => _isLocal = true);
                    _fetchPlayers();
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
                        itemBuilder: (context, index) => _buildPlayerCard(filtered[index]),
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildPlayerCard(User player) {
    final hasPending = _pendingChallengeUserIds.contains(player.id);
    
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: InkWell(
        onTap: () => _showPlayerProfile(player),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: Colors.deepOrange.withOpacity(0.2),
                backgroundImage: player.photoUrl != null ? NetworkImage(player.photoUrl!) : null,
                child: player.photoUrl == null
                    ? Text(player.name[0].toUpperCase(), 
                        style: const TextStyle(color: Colors.deepOrange, fontWeight: FontWeight.bold))
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(player.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    if (player.position != null || player.city != null)
                      Text(player.position ?? player.city ?? '', 
                          style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                  ],
                ),
              ),
              if (hasPending)
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.orange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('Pending', style: TextStyle(fontSize: 10, color: Colors.orange)),
                ),
              // Quick action buttons
              IconButton(
                icon: const Icon(Icons.chat_bubble_outline, size: 20),
                color: Colors.grey[400],
                tooltip: 'Message',
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => ChatScreen(userId: player.id)),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.sports_basketball, size: 20),
                color: Colors.deepOrange,
                tooltip: 'Challenge',
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
                onPressed: () => _showChallengeDialog(player),
              ),
              // Add to team button
              IconButton(
                icon: const Icon(Icons.group_add, size: 20),
                color: Colors.blue,
                tooltip: 'Invite to team',
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
                onPressed: () => _showInviteToTeamDialog(player),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(player.rating.toStringAsFixed(2), 
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  Text(_getRankLabel(player.rating), 
                      style: const TextStyle(fontSize: 11, color: Colors.deepOrange)),
                ],
              ),
            ],
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
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Theme.of(context).cardColor,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
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
    final rating = (team['rating'] as num?)?.toDouble() ?? 3.0;
    final wins = team['wins'] ?? 0;
    final losses = team['losses'] ?? 0;
    
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: InkWell(
        onTap: () => _showTeamActionSheet(team),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Rank number
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: rank <= 3 ? Colors.amber : Colors.grey[700],
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text('#$rank', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                ),
              ),
              const SizedBox(width: 12),
              // Team type badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _teamFilter == '3v3' ? Colors.blue : Colors.purple,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(_teamFilter, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(team['name'] ?? 'Team', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    Text('${team['memberCount'] ?? 1} members • ${team['ownerName'] ?? 'Unknown'}', 
                        style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(rating.toStringAsFixed(2), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  Text('$wins W - $losses L', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showTeamActionSheet(Map<String, dynamic> team) {
    final hasTeamOfType = _myTeams.any((t) => t['teamType'] == team['teamType']);
    
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
                ],
              ),
              const SizedBox(height: 8),
              Text('Rating: ${((team['rating'] as num?)?.toDouble() ?? 3.0).toStringAsFixed(2)} • ${team['wins'] ?? 0}W-${team['losses'] ?? 0}L',
                  style: TextStyle(color: Colors.grey[400])),
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
              
              // Message Team
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
              
              // Challenge Team
              ListTile(
                leading: Icon(Icons.sports_basketball, 
                    color: hasTeamOfType ? Colors.deepOrange : Colors.grey),
                title: Text('Challenge Team', 
                    style: TextStyle(color: hasTeamOfType ? Colors.white : Colors.grey)),
                subtitle: Text(
                  hasTeamOfType ? 'Send a ${team['teamType']} challenge' : 'You need a ${team['teamType']} team to challenge',
                  style: TextStyle(color: Colors.grey[500], fontSize: 12),
                ),
                onTap: hasTeamOfType ? () {
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
                await ApiService.createTeamChallenge(
                  challengerTeamId: myTeam['id'],
                  opponentTeamId: opponentTeam['id'],
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

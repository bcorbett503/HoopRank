import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import 'team_detail_screen.dart';

/// Teams screen - replaces Maps tab
/// Shows user's teams and allows creating new teams
class TeamsScreen extends StatefulWidget {
  const TeamsScreen({super.key});

  @override
  State<TeamsScreen> createState() => _TeamsScreenState();
}

class _TeamsScreenState extends State<TeamsScreen> with SingleTickerProviderStateMixin {
  List<Map<String, dynamic>> _myTeams = [];
  List<Map<String, dynamic>> _invites = [];
  bool _isLoading = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
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
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final teams = await ApiService.getMyTeams();
      final invites = await ApiService.getTeamInvites();
      if (mounted) {
        setState(() {
          _myTeams = teams;
          _invites = invites;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading teams: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showCreateTeamDialog() {
    final nameController = TextEditingController();
    String teamType = '3v3';
    File? selectedImage;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Create Team'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Team Logo Picker
                GestureDetector(
                  onTap: () async {
                    // Show bottom sheet with camera/gallery options
                    final ImageSource? source = await showModalBottomSheet<ImageSource>(
                      context: context,
                      builder: (ctx) => SafeArea(
                        child: Wrap(
                          children: [
                            ListTile(
                              leading: const Icon(Icons.camera_alt),
                              title: const Text('Take a Photo'),
                              onTap: () => Navigator.pop(ctx, ImageSource.camera),
                            ),
                            ListTile(
                              leading: const Icon(Icons.photo_library),
                              title: const Text('Choose from Gallery'),
                              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
                            ),
                          ],
                        ),
                      ),
                    );
                    if (source != null) {
                      final picker = ImagePicker();
                      final picked = await picker.pickImage(source: source);
                      if (picked != null) {
                        setDialogState(() => selectedImage = File(picked.path));
                      }
                    }
                  },
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.deepOrange.withOpacity(0.5), width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.deepOrange.withOpacity(0.3),
                          blurRadius: 8,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: Stack(
                      children: [
                        if (selectedImage != null)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.file(selectedImage!, fit: BoxFit.cover, width: 80, height: 80),
                          )
                        else
                          Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.add_photo_alternate, color: Colors.grey[600], size: 28),
                                const SizedBox(height: 4),
                                Text('Logo', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                              ],
                            ),
                          ),
                        // Camera icon overlay
                        Positioned(
                          bottom: 4,
                          right: 4,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Colors.deepOrange,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt, color: Colors.white, size: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Team Name',
                    hintText: 'Enter team name',
                  ),
                  autofocus: true,
                ),
                const SizedBox(height: 16),
                const Text('Team Type', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('3v3'),
                        selected: teamType == '3v3',
                        onSelected: (_) => setDialogState(() => teamType = '3v3'),
                        selectedColor: Colors.deepOrange,
                        labelStyle: TextStyle(
                          color: teamType == '3v3' ? Colors.white : null,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('5v5'),
                        selected: teamType == '5v5',
                        onSelected: (_) => setDialogState(() => teamType = '5v5'),
                        selectedColor: Colors.deepOrange,
                        labelStyle: TextStyle(
                          color: teamType == '5v5' ? Colors.white : null,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  teamType == '3v3' ? 'Max 5 members' : 'Max 10 members',
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.trim().isEmpty) return;
                Navigator.pop(context);
                await _createTeam(nameController.text.trim(), teamType, selectedImage);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepOrange,
                foregroundColor: Colors.white,
              ),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _createTeam(String name, String teamType, File? logoImage) async {
    try {
      final team = await ApiService.createTeam(name: name, teamType: teamType);
      if (team != null && mounted) {
        // Upload logo if selected
        if (logoImage != null) {
          await ApiService.uploadImage(
            type: 'team',
            targetId: team['id'],
            imageFile: logoImage,
          );
        }
        _loadData();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Team "$name" created!')),
        );
      }
    } catch (e) {
      if (mounted) {
        final errorStr = e.toString().toLowerCase();
        if (errorStr.contains('team_name_taken') || errorStr.contains('already exists')) {
          // Show friendly dialog for duplicate name
          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
                  SizedBox(width: 8),
                  Text('Name Taken'),
                ],
              ),
              content: Text(
                'A $teamType team named "$name" already exists.\n\nPlease choose a different name for your team.',
              ),
              actions: [
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _showCreateTeamDialog(); // Re-open the create dialog
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.deepOrange,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Choose New Name'),
                ),
              ],
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to create team. Please try again.')),
          );
        }
      }
    }
  }

  Future<void> _acceptInvite(Map<String, dynamic> invite) async {
    try {
      await ApiService.acceptTeamInvite(invite['id']);
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Joined ${invite['name']}!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to accept invite: $e')),
        );
      }
    }
  }

  Future<void> _declineInvite(Map<String, dynamic> invite) async {
    try {
      await ApiService.declineTeamInvite(invite['id']);
      _loadData();
    } catch (e) {
      print('Failed to decline invite: $e');
    }
  }

  void _showCreateChallengeSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.sports_basketball, color: Colors.green, size: 24),
                SizedBox(width: 8),
                Text(
                  'Create Team Challenge',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Select game type to find opponents',
              style: TextStyle(color: Colors.grey[400], fontSize: 13),
            ),
            const SizedBox(height: 20),
            // 3v3 option
            ListTile(
              leading: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.blue,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  '3v3',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
              title: const Text('3v3 Challenge'),
              subtitle: const Text('Find 3v3 teams to play'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.pop(ctx);
                // Navigate to Team Rankings with 3v3 and Local filter
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const _TeamRankingsWithFilter(teamType: '3v3'),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            // 5v5 option
            ListTile(
              leading: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.purple,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  '5v5',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
              title: const Text('5v5 Challenge'),
              subtitle: const Text('Find 5v5 teams to play'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.pop(ctx);
                // Navigate to Team Rankings with 5v5 and Local filter
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const _TeamRankingsWithFilter(teamType: '5v5'),
                  ),
                );
              },
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.grey[400],
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Teams'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            const Tab(text: 'My Teams'),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Invites'),
                  if (_invites.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${_invites.length}',
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.deepOrange))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildMyTeamsTab(),
                _buildInvitesTab(),
              ],
            ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Create Challenge button (Bottom Left)
            if (_myTeams.isNotEmpty)
              FloatingActionButton.extended(
                heroTag: 'createChallenge',
                onPressed: _showCreateChallengeSheet,
                backgroundColor: Colors.green,
                icon: const Icon(Icons.sports_basketball),
                label: const Text('Create Challenge'),
              )
            else
              const SizedBox(), // Spacer to keep Create Team on right if needed, or remove to center/left it? 
              // Actually, using Spacer() between them below handles positioning.
              // If I want Create Team to STAY right even if Challenge is missing:
              // Row(children: [Spacer(), CreateTeam]) works.
            
            if (_myTeams.isEmpty && false) const SizedBox(), // explicit NO-OP

            // Spacer is NOT needed if using MainAxisAlignment.spaceBetween with 2 items.
            // But if 1 item (Create Team), spaceBetween aligns it to start (Left).
            // So we need:
            if (_myTeams.isEmpty) const Spacer(), // Push Create Team to right

            // Create Team button (Bottom Right)
            FloatingActionButton.extended(
              heroTag: 'createTeam',
              onPressed: _showCreateTeamDialog,
              backgroundColor: Colors.deepOrange,
              icon: const Icon(Icons.add),
              label: const Text('Create Team'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMyTeamsTab() {
    if (_myTeams.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.groups, size: 64, color: Colors.white.withOpacity(0.1)),
            const SizedBox(height: 16),
            const Text(
              'No teams yet',
              style: TextStyle(fontSize: 18, color: Colors.white54, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Create a team to start playing 3v3 or 5v5',
              style: TextStyle(color: Colors.white30),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _myTeams.length,
        itemBuilder: (context, index) => _buildTeamCard(_myTeams[index]),
      ),
    );
  }

  Widget _buildTeamCard(Map<String, dynamic> team) {
    final isOwner = team['isOwner'] == true;
    final teamType = team['teamType'] ?? '3v3';
    final rating = (team['rating'] as num?)?.toDouble() ?? 3.0;
    final wins = team['wins'] ?? 0;
    final losses = team['losses'] ?? 0;
    final memberCount = team['memberCount'] ?? 1;
    final pendingCount = team['pendingCount'] ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => TeamDetailScreen(teamId: team['id']),
              ),
            ).then((_) => _loadData());
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    // Team type badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: teamType == '3v3' ? Colors.blue.withOpacity(0.2) : Colors.purple.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: teamType == '3v3' ? Colors.blue.withOpacity(0.3) : Colors.purple.withOpacity(0.3),
                        ),
                      ),
                      child: Text(
                        teamType,
                        style: TextStyle(
                          color: teamType == '3v3' ? Colors.blue[300] : Colors.purple[200], 
                          fontWeight: FontWeight.bold, 
                          fontSize: 11
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        team['name'] ?? 'Team',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                    if (isOwner)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.amber.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.amber.withOpacity(0.3)),
                        ),
                        child: const Text('Owner', style: TextStyle(fontSize: 10, color: Colors.amber, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildStatChip(Icons.star, rating.toStringAsFixed(1)),
                    const SizedBox(width: 12),
                    _buildStatChip(Icons.people, '$memberCount'),
                    const SizedBox(width: 12),
                    _buildStatChip(Icons.emoji_events, '$wins W - $losses L'),
                    if (pendingCount > 0) ...[
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.deepOrange.withOpacity(0.3)),
                        ),
                        child: Text(
                          '$pendingCount pending', 
                          style: TextStyle(fontSize: 11, color: Colors.deepOrange, fontWeight: FontWeight.bold)
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatChip(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(color: Colors.grey[700])),
      ],
    );
  }

  Widget _buildInvitesTab() {
    if (_invites.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.mail_outline, size: 64, color: Colors.white.withOpacity(0.1)),
            const SizedBox(height: 16),
            const Text(
              'No pending invites',
              style: TextStyle(fontSize: 18, color: Colors.white54, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _invites.length,
        itemBuilder: (context, index) => _buildInviteCard(_invites[index]),
      ),
    );
  }

  Widget _buildInviteCard(Map<String, dynamic> invite) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
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
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: invite['teamType'] == '3v3' ? Colors.blue.withOpacity(0.2) : Colors.purple.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: invite['teamType'] == '3v3' ? Colors.blue.withOpacity(0.3) : Colors.purple.withOpacity(0.3)
                    ),
                  ),
                  child: Text(
                    invite['teamType'] ?? '3v3',
                    style: TextStyle(
                      color: invite['teamType'] == '3v3' ? Colors.blue[300] : Colors.purple[200], 
                      fontWeight: FontWeight.bold, 
                      fontSize: 11
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    invite['name'] ?? 'Team',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Invited by ${invite['ownerName'] ?? 'Unknown'}',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _declineInvite(invite),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red[300],
                      side: BorderSide(color: Colors.red.withOpacity(0.5)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _acceptInvite(invite),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.deepOrange,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: const Text('Accept'),
                  ),
                ),
              ],
            ),
          ],
      ),
    );
  }
}

/// Helper widget to show Team Rankings filtered by team type and Local
class _TeamRankingsWithFilter extends StatefulWidget {
  final String teamType;
  
  const _TeamRankingsWithFilter({required this.teamType});

  @override
  State<_TeamRankingsWithFilter> createState() => _TeamRankingsWithFilterState();
}

class _TeamRankingsWithFilterState extends State<_TeamRankingsWithFilter> {
  List<Map<String, dynamic>> _teams = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTeams();
  }

  Future<void> _loadTeams() async {
    setState(() => _isLoading = true);
    try {
      // Load teams of the specified type, filtered by local
      final teams = await ApiService.getTeamRankings(
        teamType: widget.teamType,
        scope: 'local',
      );
      if (mounted) {
        setState(() {
          _teams = teams;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading teams: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.teamType} Teams - Local'),
        backgroundColor: widget.teamType == '3v3' ? Colors.blue : Colors.purple,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _teams.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.groups, size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'No ${widget.teamType} teams nearby',
                        style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Be the first to challenge!',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadTeams,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _teams.length,
                    itemBuilder: (context, index) {
                      final team = _teams[index];
                      final rating = (team['rating'] as num?)?.toDouble() ?? 3.0;
                      final wins = team['wins'] ?? 0;
                      final losses = team['losses'] ?? 0;
                      
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
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
                            borderRadius: BorderRadius.circular(16),
                            onTap: () {
                               // Optional: View team details if we wanted to
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Row(
                                children: [
                                  Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: widget.teamType == '3v3' 
                                          ? Colors.blue.withOpacity(0.2) 
                                          : Colors.purple.withOpacity(0.2),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Center(
                                      child: Text(
                                        '${index + 1}',
                                        style: TextStyle(
                                          color: widget.teamType == '3v3' ? Colors.blue : Colors.purple,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          team['name'] ?? 'Team',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '⭐ ${rating.toStringAsFixed(2)} • $wins W - $losses L', 
                                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Challenge sent to ${team['name']}!')),
                                      );
                                      Navigator.pop(context);
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.deepOrange,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      elevation: 0,
                                    ),
                                    child: const Text('Challenge'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

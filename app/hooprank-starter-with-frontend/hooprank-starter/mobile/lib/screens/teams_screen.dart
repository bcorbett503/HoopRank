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
                    final picker = ImagePicker();
                    final picked = await picker.pickImage(source: ImageSource.gallery);
                    if (picked != null) {
                      setDialogState(() => selectedImage = File(picked.path));
                    }
                  },
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.deepOrange.withOpacity(0.5)),
                    ),
                    child: selectedImage != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.file(selectedImage!, fit: BoxFit.cover),
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.add_photo_alternate, color: Colors.grey[600], size: 28),
                              const SizedBox(height: 4),
                              Text('Logo', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create team: $e')),
        );
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateTeamDialog,
        backgroundColor: Colors.deepOrange,
        icon: const Icon(Icons.add),
        label: const Text('Create Team'),
      ),
    );
  }

  Widget _buildMyTeamsTab() {
    if (_myTeams.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.groups, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No teams yet',
              style: TextStyle(fontSize: 18, color: Colors.grey[600]),
            ),
            const SizedBox(height: 8),
            Text(
              'Create a team to start playing 3v3 or 5v5',
              style: TextStyle(color: Colors.grey[500]),
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

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => TeamDetailScreen(teamId: team['id']),
            ),
          ).then((_) => _loadData());
        },
        borderRadius: BorderRadius.circular(12),
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
                      color: teamType == '3v3' ? Colors.blue : Colors.purple,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      teamType,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      team['name'] ?? 'Team',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ),
                  if (isOwner)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.amber[100],
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text('Owner', style: TextStyle(fontSize: 12, color: Colors.amber)),
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
                        color: Colors.orange[100],
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text('$pendingCount pending', style: TextStyle(fontSize: 12, color: Colors.orange[800])),
                    ),
                  ],
                ],
              ),
            ],
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
            Icon(Icons.mail_outline, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No pending invites',
              style: TextStyle(fontSize: 18, color: Colors.grey[600]),
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
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: invite['teamType'] == '3v3' ? Colors.blue : Colors.purple,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    invite['teamType'] ?? '3v3',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    invite['name'] ?? 'Team',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Invited by ${invite['ownerName'] ?? 'Unknown'}',
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _declineInvite(invite),
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
                    ),
                    child: const Text('Accept'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

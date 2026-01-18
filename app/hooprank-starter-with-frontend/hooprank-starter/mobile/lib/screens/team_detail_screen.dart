import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/api_service.dart';
import '../widgets/player_profile_sheet.dart';

/// Team detail screen showing roster and team info
class TeamDetailScreen extends StatefulWidget {
  final String teamId;

  const TeamDetailScreen({super.key, required this.teamId});

  @override
  State<TeamDetailScreen> createState() => _TeamDetailScreenState();
}

class _TeamDetailScreenState extends State<TeamDetailScreen> {
  Map<String, dynamic>? _team;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTeam();
  }

  Future<void> _loadTeam() async {
    setState(() => _isLoading = true);
    try {
      final team = await ApiService.getTeamDetail(widget.teamId);
      if (mounted) {
        setState(() {
          _team = team;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading team: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _leaveTeam() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Leave Team'),
        content: Text('Are you sure you want to leave ${_team?['name']}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Leave'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await ApiService.leaveTeam(widget.teamId);
        if (mounted) Navigator.pop(context);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to leave team: $e')),
          );
        }
      }
    }
  }

  Future<void> _deleteTeam() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Team'),
        content: Text('Are you sure you want to delete ${_team?['name']}? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await ApiService.deleteTeam(widget.teamId);
        if (mounted) Navigator.pop(context);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete team: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Team')),
        body: const Center(child: CircularProgressIndicator(color: Colors.deepOrange)),
      );
    }

    if (_team == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Team')),
        body: const Center(child: Text('Team not found')),
      );
    }

    final team = _team!;
    final isOwner = team['isOwner'] == true;
    final members = (team['members'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final acceptedMembers = members.where((m) => m['status'] == 'accepted').toList();
    final pendingMembers = members.where((m) => m['status'] == 'pending').toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(team['name'] ?? 'Team'),
        actions: [
          if (isOwner)
            IconButton(
              icon: const Icon(Icons.delete),
              onPressed: _deleteTeam,
            )
          else
            IconButton(
              icon: const Icon(Icons.exit_to_app),
              onPressed: _leaveTeam,
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadTeam,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Team header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: team['teamType'] == '3v3' ? Colors.blue : Colors.purple,
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        team['teamType'] ?? '3v3',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      team['name'] ?? 'Team',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildHeaderStat('Rating', (team['rating'] as num?)?.toStringAsFixed(1) ?? '3.0'),
                        Container(width: 1, height: 30, color: Colors.white.withOpacity(0.3), margin: const EdgeInsets.symmetric(horizontal: 20)),
                        _buildHeaderStat('Wins', '${team['wins'] ?? 0}'),
                        Container(width: 1, height: 30, color: Colors.white.withOpacity(0.3), margin: const EdgeInsets.symmetric(horizontal: 20)),
                        _buildHeaderStat('Losses', '${team['losses'] ?? 0}'),
                      ],
                    ),
                  ],
                ),
              ),

              // Team chat button
              if (team['threadId'] != null)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: ElevatedButton.icon(
                    onPressed: () {
                      // Navigate to team chat
                      // TODO: Navigate to messages screen with this thread
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Team chat coming soon!')),
                      );
                    },
                    icon: const Icon(Icons.chat),
                    label: const Text('Team Chat'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.deepOrange,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 48),
                    ),
                  ),
                ),

              // Roster section
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    const Text(
                      'Roster',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    Text(
                      '${acceptedMembers.length} / ${team['teamType'] == '3v3' ? 5 : 10}',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: acceptedMembers.length,
                itemBuilder: (context, index) => _buildMemberTile(
                  acceptedMembers[index], 
                  canRemove: isOwner,
                ),
              ),

              // Pending members (owner only)
              if (isOwner && pendingMembers.isNotEmpty) ...[
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Pending Invites',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey[700]),
                  ),
                ),
                const SizedBox(height: 8),
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: pendingMembers.length,
                  itemBuilder: (context, index) => _buildMemberTile(pendingMembers[index], isPending: true),
                ),
              ],

              const SizedBox(height: 80), // Space for FAB
            ],
          ),
        ),
      ),
      floatingActionButton: isOwner
          ? FloatingActionButton.extended(
              onPressed: () => context.go('/rankings'),
              backgroundColor: Colors.deepOrange,
              icon: const Icon(Icons.person_add),
              label: const Text('Invite'),
            )
          : null,
    );
  }

  Widget _buildHeaderStat(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildMemberTile(Map<String, dynamic> member, {bool isPending = false, bool canRemove = false}) {
    final isMemberOwner = member['role'] == 'owner';
    final memberId = member['userId'] ?? member['id'];
    
    return ListTile(
      onTap: memberId != null 
          ? () => PlayerProfileSheet.showById(context, memberId.toString())
          : null,
      leading: CircleAvatar(
        backgroundImage: member['photoUrl'] != null ? NetworkImage(member['photoUrl']) : null,
        backgroundColor: isPending ? Colors.grey[300] : Colors.deepOrange[100],
        child: member['photoUrl'] == null
            ? Text(
                (member['name'] ?? '?')[0].toUpperCase(),
                style: TextStyle(color: isPending ? Colors.grey : Colors.deepOrange),
              )
            : null,
      ),
      title: Text(
        member['name'] ?? 'Unknown',
        style: TextStyle(
          fontWeight: isMemberOwner ? FontWeight.bold : FontWeight.normal,
          color: isPending ? Colors.grey : Colors.blue,
          decoration: isPending ? null : TextDecoration.underline,
        ),
      ),
      subtitle: Text(
        isPending ? 'Pending invite' : 'Rating: ${(member['rating'] as num?)?.toStringAsFixed(1) ?? '3.0'}',
        style: TextStyle(color: isPending ? Colors.grey : null),
      ),
      trailing: isMemberOwner
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.amber[100],
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text('Captain', style: TextStyle(fontSize: 12, color: Colors.amber)),
            )
          : canRemove && !isPending
              ? IconButton(
                  icon: const Icon(Icons.person_remove, color: Colors.red),
                  tooltip: 'Remove from team',
                  onPressed: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Remove Member'),
                        content: Text('Remove ${member['name']} from the team?'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                          ElevatedButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                            child: const Text('Remove'),
                          ),
                        ],
                      ),
                    );
                    if (confirm == true) {
                      try {
                        await ApiService.removeTeamMember(widget.teamId, member['userId'] ?? member['id']);
                        _loadTeam();
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Failed to remove: $e')),
                          );
                        }
                      }
                    }
                  },
                )
              : null,
    );
  }
}

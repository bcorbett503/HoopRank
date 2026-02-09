import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../state/check_in_state.dart';
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
      debugPrint('Team loaded: logoUrl = ${team?['logoUrl']}');
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

  Future<void> _pickTeamLogo() async {
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
      final picked = await picker.pickImage(source: source, maxWidth: 512, maxHeight: 512, imageQuality: 75);
      if (picked != null) {
        debugPrint('Team logo: Picked image at ${picked.path}');
        // Upload the image - returns null on success, error message on failure
        final error = await ApiService.uploadImage(
          type: 'team',
          targetId: widget.teamId,
          imageFile: File(picked.path),
        );
        debugPrint('Team logo: Upload error = $error');
        if (mounted) {
          if (error == null) {
            _loadTeam(); // Refresh to show new logo
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Team logo updated!')),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Upload failed: $error'), backgroundColor: Colors.red, duration: const Duration(seconds: 8)),
            );
          }
        }
      }
    }
  }

  /// Helper to get image provider from logo URL (handles base64 data URLs and http URLs)
  ImageProvider _getLogoImage(String logoUrl) {
    if (logoUrl.startsWith('data:')) {
      // It's a base64 data URL like "data:image/jpeg;base64,/9j/4AAQ..."
      final parts = logoUrl.split(',');
      if (parts.length == 2) {
        final base64Data = parts[1];
        final bytes = base64Decode(base64Data);
        return MemoryImage(bytes);
      }
    }
    // Fallback to NetworkImage for regular URLs
    return NetworkImage(logoUrl);
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

    final checkInState = Provider.of<CheckInState>(context);
    final isFollowing = checkInState.isFollowingTeam(widget.teamId);

    return Scaffold(
      appBar: AppBar(
        title: Text(team['name'] ?? 'Team'),
        actions: [
          // Follow/unfollow button
          IconButton(
            icon: Icon(
              isFollowing ? Icons.favorite : Icons.favorite_border,
              color: isFollowing ? Colors.redAccent : null,
            ),
            tooltip: isFollowing ? 'Unfollow team' : 'Follow team',
            onPressed: () {
              checkInState.toggleFollowTeam(
                widget.teamId,
                teamName: team['name'],
              );
            },
          ),
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
                    // Team Logo (editable for owners)
                    GestureDetector(
                      onTap: isOwner ? _pickTeamLogo : null,
                      child: Stack(
                        children: [
                          Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 3),
                              image: team['logoUrl'] != null
                                  ? DecorationImage(
                                      image: _getLogoImage(team['logoUrl']),
                                      fit: BoxFit.cover,
                                    )
                                  : null,
                            ),
                            child: team['logoUrl'] == null
                                ? Center(
                                    child: Text(
                                      (team['name'] ?? 'T')[0].toUpperCase(),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 32,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  )
                                : null,
                          ),
                          if (isOwner)
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: const BoxDecoration(
                                  color: Colors.deepOrange,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.camera_alt, color: Colors.white, size: 16),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
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
                    if (team['ageGroup'] != null || team['gender'] != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (team['ageGroup'] != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              margin: const EdgeInsets.only(right: 6),
                              decoration: BoxDecoration(
                                color: Colors.teal.withOpacity(0.3),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(team['ageGroup'], style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                            ),
                          if (team['gender'] != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.indigo.withOpacity(0.3),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(team['gender'], style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 8),
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
                        Builder(builder: (context) {
                          final rv = team['rating'];
                          final ratingStr = rv is num ? rv.toStringAsFixed(1) : (double.tryParse(rv?.toString() ?? '')?.toStringAsFixed(1) ?? '3.0');
                          return _buildHeaderStat('Rating', ratingStr);
                        }),
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

              // Recent Matches section
              if (team['recentMatches'] != null && (team['recentMatches'] as List).isNotEmpty) ...[
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Recent Matches',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 8),
                ...((team['recentMatches'] as List).map<Widget>((match) {
                  final won = match['won'] == true;
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: won ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: won ? Colors.green.withOpacity(0.3) : Colors.red.withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          won ? Icons.emoji_events : Icons.close,
                          color: won ? Colors.green : Colors.red,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'vs ${match['creatorTeamName'] == team['name'] ? match['opponentTeamName'] : match['creatorTeamName']}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${match['scoreCreator']} - ${match['scoreOpponent']}',
                                style: TextStyle(color: Colors.grey[500], fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: won ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            won ? 'WIN' : 'LOSS',
                            style: TextStyle(
                              color: won ? Colors.green : Colors.red,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList()),
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
      subtitle: Builder(builder: (context) {
        final mr = member['rating'];
        final ratingStr = mr is num ? mr.toStringAsFixed(1) : (double.tryParse(mr?.toString() ?? '')?.toStringAsFixed(1) ?? '3.0');
        return Text(
          isPending ? 'Pending invite' : 'Rating: $ratingStr',
          style: TextStyle(color: isPending ? Colors.grey : null),
        );
      }),
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

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../widgets/scaffold_with_nav_bar.dart';
import 'team_detail_screen.dart';

/// Teams screen — redesigned with inline invites + Schedule tab
class TeamsScreen extends StatefulWidget {
  const TeamsScreen({super.key});

  @override
  State<TeamsScreen> createState() => _TeamsScreenState();
}

class _TeamsScreenState extends State<TeamsScreen> with SingleTickerProviderStateMixin {
  List<Map<String, dynamic>> _myTeams = [];
  List<Map<String, dynamic>> _invites = [];
  List<Map<String, dynamic>> _events = [];
  bool _isLoading = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (mounted) setState(() {}); // redraw FABs when tab changes
    });
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
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        ApiService.getMyTeams(),
        ApiService.getTeamInvites(),
        ApiService.getAllTeamEvents(),
      ]);
      if (mounted) {
        setState(() {
          _myTeams = results[0] as List<Map<String, dynamic>>;
          _invites = results[1] as List<Map<String, dynamic>>;
          _events = results[2] as List<Map<String, dynamic>>;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading teams: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ==============================
  // Single-team limit check
  // ==============================
  bool _canAddTeam() => _myTeams.isEmpty;

  void _showSubscriberDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.lock, color: Colors.amber, size: 28),
            SizedBox(width: 8),
            Text('One Team Limit'),
          ],
        ),
        content: const Text(
          'You already have a team!\n\n'
          'Managing multiple teams is coming soon for HoopRank subscribers. '
          'Stay tuned! 🏀',
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
            ),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  // ==============================
  // Create Team
  // ==============================
  void _showCreateTeamDialog() {
    if (!_canAddTeam()) {
      _showSubscriberDialog();
      return;
    }

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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
                        labelStyle: TextStyle(color: teamType == '3v3' ? Colors.white : null),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('5v5'),
                        selected: teamType == '5v5',
                        onSelected: (_) => setDialogState(() => teamType = '5v5'),
                        selectedColor: Colors.deepOrange,
                        labelStyle: TextStyle(color: teamType == '5v5' ? Colors.white : null),
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
        if (logoImage != null) {
          await ApiService.uploadImage(type: 'team', targetId: team['id'], imageFile: logoImage);
        }
        _loadData();
        ScaffoldWithNavBar.refreshBadge?.call();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Team "$name" created!')),
        );
      }
    } catch (e) {
      if (mounted) {
        final errorStr = e.toString().toLowerCase();
        if (errorStr.contains('team_name_taken') || errorStr.contains('already exists')) {
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
              content: Text('A $teamType team named "$name" already exists.\n\nPlease choose a different name.'),
              actions: [
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _showCreateTeamDialog();
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange, foregroundColor: Colors.white),
                  child: const Text('Choose New Name'),
                ),
              ],
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to create team. Please try again.')),
          );
        }
      }
    }
  }

  // ==============================
  // Invites
  // ==============================
  Future<void> _acceptInvite(Map<String, dynamic> invite) async {
    // Check single-team limit
    if (_myTeams.isNotEmpty) {
      _showSubscriberDialog();
      return;
    }
    try {
      await ApiService.acceptTeamInvite(invite['id']);
      _loadData();
      ScaffoldWithNavBar.refreshBadge?.call();
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
      ScaffoldWithNavBar.refreshBadge?.call();
    } catch (e) {
      debugPrint('Failed to decline invite: $e');
    }
  }

  // ==============================
  // Add Practice / Add Game dialogs
  // ==============================
  void _showAddPracticeDialog() {
    if (_myTeams.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create or join a team first')),
      );
      return;
    }

    final titleController = TextEditingController(text: 'Practice');
    final locationController = TextEditingController();
    final notesController = TextEditingController();
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    TimeOfDay selectedTime = const TimeOfDay(hour: 18, minute: 0);
    String? recurrence;
    String selectedTeamId = _myTeams.first['id']?.toString() ?? '';

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.fitness_center, color: Colors.green, size: 24),
              SizedBox(width: 8),
              Text('Add Practice'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Team selector (if multiple teams)
                if (_myTeams.length > 1) ...[
                  DropdownButtonFormField<String>(
                    value: selectedTeamId,
                    decoration: const InputDecoration(labelText: 'Team'),
                    items: _myTeams.map((t) => DropdownMenuItem(
                      value: t['id']?.toString(),
                      child: Text(t['name'] ?? 'Team'),
                    )).toList(),
                    onChanged: (v) => setDialogState(() => selectedTeamId = v ?? selectedTeamId),
                  ),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                const SizedBox(height: 12),
                // Date picker
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_today, size: 20),
                  title: Text(DateFormat('EEE, MMM d').format(selectedDate)),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: selectedDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setDialogState(() => selectedDate = picked);
                  },
                ),
                // Time picker
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.access_time, size: 20),
                  title: Text(selectedTime.format(context)),
                  onTap: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: selectedTime,
                    );
                    if (picked != null) setDialogState(() => selectedTime = picked);
                  },
                ),
                TextField(
                  controller: locationController,
                  decoration: const InputDecoration(labelText: 'Location (optional)', hintText: 'e.g. City Gym'),
                ),
                const SizedBox(height: 12),
                // Recurrence
                DropdownButtonFormField<String?>(
                  value: recurrence,
                  decoration: const InputDecoration(labelText: 'Repeat'),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('None')),
                    DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
                    DropdownMenuItem(value: 'biweekly', child: Text('Every 2 Weeks')),
                    DropdownMenuItem(value: 'daily', child: Text('Daily')),
                  ],
                  onChanged: (v) => setDialogState(() => recurrence = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  decoration: const InputDecoration(labelText: 'Notes (optional)'),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                final eventDate = DateTime(
                  selectedDate.year, selectedDate.month, selectedDate.day,
                  selectedTime.hour, selectedTime.minute,
                );
                try {
                  await ApiService.createTeamEvent(
                    teamId: selectedTeamId,
                    type: 'practice',
                    title: titleController.text.trim().isEmpty ? 'Practice' : titleController.text.trim(),
                    eventDate: eventDate.toUtc().toIso8601String(),
                    locationName: locationController.text.trim().isEmpty ? null : locationController.text.trim(),
                    recurrenceRule: recurrence,
                    notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
                  );
                  _loadData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Practice added!')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to create practice: $e')),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddGameDialog() {
    if (_myTeams.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create or join a team first')),
      );
      return;
    }

    final titleController = TextEditingController();
    final locationController = TextEditingController();
    final opponentController = TextEditingController();
    final notesController = TextEditingController();
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    TimeOfDay selectedTime = const TimeOfDay(hour: 18, minute: 0);
    String selectedTeamId = _myTeams.first['id']?.toString() ?? '';

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.sports_basketball, color: Colors.purple, size: 24),
              SizedBox(width: 8),
              Text('Add Game'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_myTeams.length > 1) ...[
                  DropdownButtonFormField<String>(
                    value: selectedTeamId,
                    decoration: const InputDecoration(labelText: 'Your Team'),
                    items: _myTeams.map((t) => DropdownMenuItem(
                      value: t['id']?.toString(),
                      child: Text(t['name'] ?? 'Team'),
                    )).toList(),
                    onChanged: (v) => setDialogState(() => selectedTeamId = v ?? selectedTeamId),
                  ),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: opponentController,
                  decoration: const InputDecoration(labelText: 'Opponent Team Name', hintText: 'e.g. Lakers'),
                ),
                const SizedBox(height: 12),
                // Date picker
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_today, size: 20),
                  title: Text(DateFormat('EEE, MMM d').format(selectedDate)),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: selectedDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setDialogState(() => selectedDate = picked);
                  },
                ),
                // Time picker
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.access_time, size: 20),
                  title: Text(selectedTime.format(context)),
                  onTap: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: selectedTime,
                    );
                    if (picked != null) setDialogState(() => selectedTime = picked);
                  },
                ),
                TextField(
                  controller: locationController,
                  decoration: const InputDecoration(labelText: 'Location (optional)', hintText: 'e.g. Downtown Court'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(labelText: 'Title (optional)', hintText: 'e.g. Semifinal'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  decoration: const InputDecoration(labelText: 'Notes (optional)'),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                final opponent = opponentController.text.trim();
                final eventDate = DateTime(
                  selectedDate.year, selectedDate.month, selectedDate.day,
                  selectedTime.hour, selectedTime.minute,
                );
                try {
                  await ApiService.createTeamEvent(
                    teamId: selectedTeamId,
                    type: 'game',
                    title: titleController.text.trim().isEmpty ? 'vs ${opponent.isEmpty ? "TBD" : opponent}' : titleController.text.trim(),
                    eventDate: eventDate.toUtc().toIso8601String(),
                    locationName: locationController.text.trim().isEmpty ? null : locationController.text.trim(),
                    opponentTeamName: opponent.isEmpty ? null : opponent,
                    notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
                  );
                  _loadData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Game added!')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to create game: $e')),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.purple, foregroundColor: Colors.white),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  // ==============================
  // Attendance toggle
  // ==============================
  Future<void> _toggleAttendance(Map<String, dynamic> event, String status) async {
    final teamId = event['teamId']?.toString() ?? '';
    final eventId = event['id']?.toString() ?? '';
    if (teamId.isEmpty || eventId.isEmpty) return;

    try {
      await ApiService.toggleEventAttendance(teamId, eventId, status);
      _loadData();
    } catch (e) {
      debugPrint('Failed to toggle attendance: $e');
    }
  }

  // ==============================
  // BUILD
  // ==============================
  @override
  Widget build(BuildContext context) {
    final isScheduleTab = _tabController.index == 1;

    return Scaffold(
      body: Column(
        children: [
          TabBar(
            controller: _tabController,
            tabs: const [
              Tab(text: 'My Teams'),
              Tab(text: 'Schedule'),
            ],
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.deepOrange))
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildMyTeamsTab(),
                      _buildScheduleTab(),
                    ],
                  ),
          ),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: isScheduleTab ? _buildScheduleFABs() : _buildMyTeamsFAB(),
    );
  }

  // ==============================
  // FABs
  // ==============================
  Widget? _buildMyTeamsFAB() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          FloatingActionButton.extended(
            heroTag: 'createTeam',
            onPressed: _showCreateTeamDialog,
            backgroundColor: Colors.deepOrange,
            icon: const Icon(Icons.add),
            label: const Text('Create Team'),
          ),
        ],
      ),
    );
  }

  Widget? _buildScheduleFABs() {
    if (_myTeams.isEmpty) return null;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          FloatingActionButton.extended(
            heroTag: 'addPractice',
            onPressed: _showAddPracticeDialog,
            backgroundColor: Colors.green,
            icon: const Icon(Icons.fitness_center),
            label: const Text('Add Practice'),
          ),
          FloatingActionButton.extended(
            heroTag: 'addGame',
            onPressed: _showAddGameDialog,
            backgroundColor: Colors.purple,
            icon: const Icon(Icons.sports_basketball),
            label: const Text('Add Game'),
          ),
        ],
      ),
    );
  }

  // ==============================
  // MY TEAMS tab (with inline invites at top)
  // ==============================
  Widget _buildMyTeamsTab() {
    final totalItems = _invites.length + _myTeams.length;

    if (totalItems == 0) {
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
            const Text(
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
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
        itemCount: totalItems,
        itemBuilder: (context, index) {
          // Invites first
          if (index < _invites.length) {
            return _buildInlineInviteCard(_invites[index]);
          }
          // Then teams
          return _buildTeamCard(_myTeams[index - _invites.length]);
        },
      ),
    );
  }

  Widget _buildInlineInviteCard(Map<String, dynamic> invite) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.deepOrange.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.deepOrange.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.deepOrange.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.mail, color: Colors.deepOrange, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invite['name'] ?? 'Team',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                ),
                const SizedBox(height: 2),
                Text(
                  '${invite['teamType'] ?? '3v3'} team invite',
                  style: TextStyle(color: Colors.grey[400], fontSize: 12),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: () => _declineInvite(invite),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.red[300],
              side: BorderSide(color: Colors.red.withOpacity(0.4)),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              minimumSize: Size.zero,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Decline', style: TextStyle(fontSize: 12)),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: () => _acceptInvite(invite),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              minimumSize: Size.zero,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Accept', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _buildTeamCard(Map<String, dynamic> team) {
    final isOwner = team['isOwner'] == true;
    final teamType = team['teamType'] ?? '3v3';
    final ratingValue = team['rating'];
    final rating = ratingValue is num ? ratingValue.toDouble() : (double.tryParse(ratingValue?.toString() ?? '') ?? 3.0);
    final winsValue = team['wins'];
    final wins = winsValue is int ? winsValue : (int.tryParse(winsValue?.toString() ?? '') ?? 0);
    final lossesValue = team['losses'];
    final losses = lossesValue is int ? lossesValue : (int.tryParse(lossesValue?.toString() ?? '') ?? 0);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 4)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => TeamDetailScreen(teamId: team['id']),
            )).then((_) => _loadData());
          },
          borderRadius: BorderRadius.circular(16),
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
                          fontSize: 11,
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
                    _buildStatChip(Icons.emoji_events, '$wins W - $losses L'),
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
        Text(text, style: TextStyle(color: Colors.grey[500])),
      ],
    );
  }

  // ==============================
  // SCHEDULE tab
  // ==============================
  Widget _buildScheduleTab() {
    if (_events.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.event_note, size: 64, color: Colors.white.withOpacity(0.1)),
            const SizedBox(height: 16),
            const Text(
              'No upcoming events',
              style: TextStyle(fontSize: 18, color: Colors.white54, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _myTeams.isEmpty
                  ? 'Join a team to see your schedule'
                  : 'Tap + to add a practice or game',
              style: const TextStyle(color: Colors.white30),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
        itemCount: _events.length,
        itemBuilder: (context, index) => _buildEventCard(_events[index]),
      ),
    );
  }

  Widget _buildEventCard(Map<String, dynamic> event) {
    final isPractice = event['type'] == 'practice';
    final accentColor = isPractice ? Colors.green : Colors.purple;
    final eventDate = DateTime.tryParse(event['eventDate']?.toString() ?? '');
    final dateStr = eventDate != null ? DateFormat('EEE, MMM d • h:mm a').format(eventDate.toLocal()) : 'TBD';
    final inCount = event['inCount'] ?? 0;
    final outCount = event['outCount'] ?? 0;
    final myStatus = event['myStatus']?.toString();
    final teamName = event['teamName'] ?? '';
    final recurrence = event['recurrenceRule'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accentColor.withOpacity(0.15)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row: type badge + title + team name
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: accentColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isPractice ? 'PRACTICE' : 'GAME',
                    style: TextStyle(color: accentColor, fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 0.5),
                  ),
                ),
                if (recurrence != null) ...[
                  const SizedBox(width: 6),
                  Icon(Icons.repeat, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 2),
                  Text(recurrence, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                ],
                const Spacer(),
                if (teamName.isNotEmpty)
                  Text(teamName, style: TextStyle(color: Colors.grey[600], fontSize: 11)),
              ],
            ),
            const SizedBox(height: 10),
            // Title
            Text(
              event['title'] ?? (isPractice ? 'Practice' : 'Game'),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 6),
            // Date/time row
            Row(
              children: [
                Icon(Icons.access_time, size: 14, color: Colors.grey[500]),
                const SizedBox(width: 4),
                Text(dateStr, style: TextStyle(color: Colors.grey[400], fontSize: 13)),
              ],
            ),
            // Location
            if (event['locationName'] != null && (event['locationName'] as String).isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.place, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Text(event['locationName'], style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                ],
              ),
            ],
            // Opponent (games only)
            if (!isPractice && event['opponentTeamName'] != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.groups, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Text('vs ${event['opponentTeamName']}', style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                ],
              ),
            ],
            const SizedBox(height: 12),
            // Attendance row
            Row(
              children: [
                // IN count
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(myStatus == 'in' ? 0.25 : 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: myStatus == 'in' ? Colors.green : Colors.green.withOpacity(0.2),
                      width: myStatus == 'in' ? 1.5 : 1,
                    ),
                  ),
                  child: InkWell(
                    onTap: () => _toggleAttendance(event, 'in'),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle, size: 16, color: myStatus == 'in' ? Colors.green : Colors.green.withOpacity(0.5)),
                        const SizedBox(width: 4),
                        Text(
                          'IN $inCount',
                          style: TextStyle(
                            color: myStatus == 'in' ? Colors.green : Colors.green.withOpacity(0.6),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // OUT count
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(myStatus == 'out' ? 0.2 : 0.05),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: myStatus == 'out' ? Colors.red : Colors.red.withOpacity(0.15),
                      width: myStatus == 'out' ? 1.5 : 1,
                    ),
                  ),
                  child: InkWell(
                    onTap: () => _toggleAttendance(event, 'out'),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.cancel, size: 16, color: myStatus == 'out' ? Colors.red : Colors.red.withOpacity(0.4)),
                        const SizedBox(width: 4),
                        Text(
                          'OUT $outCount',
                          style: TextStyle(
                            color: myStatus == 'out' ? Colors.red : Colors.red.withOpacity(0.5),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                // Notes indicator
                if (event['notes'] != null && (event['notes'] as String).isNotEmpty)
                  Tooltip(
                    message: event['notes'],
                    child: Icon(Icons.note, size: 16, color: Colors.grey[600]),
                  ),
              ],
            ),
          ],
        ),
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
      debugPrint('Error loading teams: $e');
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
                      Text('No ${widget.teamType} teams nearby', style: TextStyle(fontSize: 18, color: Colors.grey[600])),
                      const SizedBox(height: 8),
                      Text('Be the first to challenge!', style: TextStyle(color: Colors.grey[500])),
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
                      final rv = team['rating'];
                      final rating = rv is num ? rv.toDouble() : (double.tryParse(rv?.toString() ?? '') ?? 3.0);
                      final wv = team['wins'];
                      final wins = wv is int ? wv : (int.tryParse(wv?.toString() ?? '') ?? 0);
                      final lv = team['losses'];
                      final losses = lv is int ? lv : (int.tryParse(lv?.toString() ?? '') ?? 0);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.grey[900],
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white.withOpacity(0.05)),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 4)),
                          ],
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () {},
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

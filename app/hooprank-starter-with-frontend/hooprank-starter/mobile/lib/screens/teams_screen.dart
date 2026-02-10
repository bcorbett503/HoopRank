import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../services/api_service.dart';
import '../services/court_service.dart';
import '../models.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
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
  List<Map<String, dynamic>> _allTeams = []; // cached for opponent search
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
      // Ensure courts are loaded for court picker (same pattern as status composer)
      await CourtService().loadCourts();
      // Load all teams for opponent search (from 5v5 + 3v3 rankings)
      try {
        final fiveResults = await ApiService.getTeamRankings(teamType: '5v5');
        final threeResults = await ApiService.getTeamRankings(teamType: '3v3');
        final seen = <String>{};
        _allTeams = [];
        for (final t in [...fiveResults, ...threeResults]) {
          final id = t['id']?.toString() ?? '';
          if (id.isNotEmpty && seen.add(id)) _allTeams.add(t);
        }
        debugPrint('TEAMS_SEARCH: loaded ${_allTeams.length} teams for search');
      } catch (e) {
        debugPrint('Failed to load all teams for search: $e');
      }
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
    String teamType = '5v5';
    String? ageGroup;
    String? gender;
    String? skillLevel;
    File? selectedImage;

    final ageGroups = ['U10', 'U12', 'U14', 'U18', 'HS', 'College', 'Open'];
    final genders = ['Mens', 'Womens', 'Coed'];
    final skillLevels = ['Recreational', 'Competitive', 'Elite'];
    final skillIcons = {
      'Recreational': Icons.directions_walk,
      'Competitive': Icons.fitness_center,
      'Elite': Icons.emoji_events,
    };

    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Create Team'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // --- Team Logo ---
                Center(
                  child: GestureDetector(
                    onTap: () async {
                      final picker = ImagePicker();
                      final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 512, maxHeight: 512);
                      if (picked != null) {
                        setDialogState(() => selectedImage = File(picked.path));
                      }
                    },
                    child: Stack(
                      children: [
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: Colors.grey[700],
                          backgroundImage: selectedImage != null ? FileImage(selectedImage!) : null,
                          child: selectedImage == null
                              ? const Icon(Icons.groups, size: 36, color: Colors.white54)
                              : null,
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
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
                const SizedBox(height: 12),

                // --- Team Name ---
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Team Name',
                    hintText: 'Enter team name',
                  ),
                  autofocus: true,
                ),

                const SizedBox(height: 16),

                // --- Team Type ---
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

                const SizedBox(height: 16),

                // --- Skill Level ---
                const Text('Skill Level', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: skillLevels.map((sl) => ChoiceChip(
                    avatar: skillLevel == sl ? null : Icon(skillIcons[sl], size: 16),
                    label: Text(sl, style: const TextStyle(fontSize: 12)),
                    selected: skillLevel == sl,
                    onSelected: (_) => setDialogState(() => skillLevel = skillLevel == sl ? null : sl),
                    selectedColor: Colors.deepPurple,
                    labelStyle: TextStyle(color: skillLevel == sl ? Colors.white : null),
                    visualDensity: VisualDensity.compact,
                  )).toList(),
                ),

                const SizedBox(height: 16),

                // --- Age Group ---
                const Text('Age Group', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: ageGroups.map((ag) => ChoiceChip(
                    label: Text(ag, style: const TextStyle(fontSize: 12)),
                    selected: ageGroup == ag,
                    onSelected: (_) => setDialogState(() => ageGroup = ageGroup == ag ? null : ag),
                    selectedColor: Colors.teal,
                    labelStyle: TextStyle(color: ageGroup == ag ? Colors.white : null),
                    visualDensity: VisualDensity.compact,
                  )).toList(),
                ),

                const SizedBox(height: 16),

                // --- Gender ---
                const Text('Gender', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  children: genders.map((g) => ChoiceChip(
                    label: Text(g, style: const TextStyle(fontSize: 12)),
                    selected: gender == g,
                    onSelected: (_) => setDialogState(() => gender = gender == g ? null : g),
                    selectedColor: Colors.indigo,
                    labelStyle: TextStyle(color: gender == g ? Colors.white : null),
                    visualDensity: VisualDensity.compact,
                  )).toList(),
                ),

                const SizedBox(height: 12),
                Text(
                  teamType == '3v3' ? 'Max 5 members' : 'Max 10 members',
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.trim().isEmpty ||
                    skillLevel == null ||
                    ageGroup == null ||
                    gender == null) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    const SnackBar(
                      content: Text('Please fill in all fields'),
                      backgroundColor: Colors.red,
                    ),
                  );
                  return;
                }
                Navigator.pop(dialogContext);
                await _createTeam(
                  nameController.text.trim(),
                  teamType,
                  selectedImage,
                  ageGroup: ageGroup,
                  gender: gender,
                  skillLevel: skillLevel,
                );
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

  Future<void> _createTeam(String name, String teamType, File? logoImage, {String? ageGroup, String? gender, String? skillLevel, String? homeCourtId, String? city, String? description}) async {
    try {
      final team = await ApiService.createTeam(name: name, teamType: teamType, ageGroup: ageGroup, gender: gender, skillLevel: skillLevel, homeCourtId: homeCourtId, city: city, description: description);
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
  // Court search helper
  // ==============================
  List<Court> _getFollowedCourts() {
    try {
      final checkInState = Provider.of<CheckInState>(context, listen: false);
      final courtService = Provider.of<CourtService>(context, listen: false);
      final followedIds = checkInState.followedCourts;
      final courts = <Court>[];
      for (final id in followedIds) {
        final c = courtService.getCourtById(id);
        if (c != null) courts.add(c);
      }
      return courts;
    } catch (e) {
      return [];
    }
  }

  List<Court> _searchCourts(String query) {
    try {
      final courtService = CourtService();
      if (!courtService.isLoaded) {
        // Trigger load asynchronously - results will appear on next rebuild
        courtService.loadCourts().then((_) {
          if (mounted) setState(() {});
        });
        return [];
      }
      final results = courtService.searchCourts(query).take(5).toList();
      debugPrint('COURT_SEARCH: query="$query" totalCourts=${courtService.courts.length} results=${results.length}');
      return results;
    } catch (e) {
      debugPrint('COURT_SEARCH ERROR: $e');
      return [];
    }
  }

  /// Search cached teams by name for opponent picker
  List<Map<String, dynamic>> _searchTeams(String query) {
    if (query.isEmpty || _allTeams.isEmpty) return [];
    final lowerQuery = query.toLowerCase();
    final myTeamIds = _myTeams.map((t) => t['id']?.toString()).toSet();
    return _allTeams.where((team) {
      final name = (team['name'] ?? team['teamName'] ?? '').toString().toLowerCase();
      final id = team['id']?.toString() ?? '';
      return name.contains(lowerQuery) && !myTeamIds.contains(id);
    }).take(5).toList();
  }

  // ==============================
  // Shared: Court picker widget builder (status-composer style)
  // ==============================
  Widget _buildCourtPicker({
    required Court? selectedCourt,
    required TextEditingController searchController,
    required void Function(Court?) onCourtSelected,
    required void Function(void Function()) setState,
  }) {
    final followedCourts = _getFollowedCourts();
    final hasOverflow = followedCourts.length >= 3;
    // Compute search results directly from the controller text
    final query = searchController.text.trim();
    final searchResults = query.isEmpty ? <Court>[] : _searchCourts(query);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Section header
        Row(
          children: [
            Icon(Icons.favorite, size: 14, color: Colors.redAccent.withOpacity(0.7)),
            const SizedBox(width: 6),
            const Text('Your courts:', style: TextStyle(color: Colors.white54, fontSize: 12)),
            if (hasOverflow) ...[
              const Spacer(),
              Text('scroll ↕', style: TextStyle(color: Colors.white.withOpacity(0.25), fontSize: 10, fontStyle: FontStyle.italic)),
            ],
          ],
        ),
        const SizedBox(height: 8),

        // Selected court badge
        if (selectedCourt != null)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.15),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.green.withOpacity(0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle, size: 16, color: Colors.green),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    selectedCourt.name,
                    style: const TextStyle(color: Colors.green, fontSize: 13, fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () => setState(() => onCourtSelected(null)),
                  child: const Icon(Icons.close, size: 16, color: Colors.green),
                ),
              ],
            ),
          ),

        // Bounded scrollable box with followed courts
        if (selectedCourt == null && followedCourts.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 120),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
              color: Colors.white.withOpacity(0.03),
            ),
            child: ScrollbarTheme(
              data: ScrollbarThemeData(
                thumbColor: WidgetStateProperty.all(Colors.white.withOpacity(0.2)),
                radius: const Radius.circular(4),
                thickness: WidgetStateProperty.all(3.0),
              ),
              child: Scrollbar(
                thumbVisibility: hasOverflow,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: followedCourts.take(5).map((court) => ActionChip(
                      avatar: const Icon(Icons.location_on, size: 16, color: Colors.blue),
                      label: Text(
                        court.name,
                        style: const TextStyle(fontSize: 12, color: Colors.white70),
                        overflow: TextOverflow.ellipsis,
                      ),
                      backgroundColor: Colors.blue.withOpacity(0.15),
                      side: BorderSide(color: Colors.blue.withOpacity(0.3)),
                      onPressed: () => setState(() {
                        onCourtSelected(court);
                        searchController.clear();
                      }),
                    )).toList(),
                  ),
                ),
              ),
            ),
          ),

        // Search field
        if (selectedCourt == null) ...[
          const SizedBox(height: 10),
          TextField(
            controller: searchController,
            decoration: InputDecoration(
              hintText: 'Search other courts...',
              hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 13),
              prefixIcon: Icon(Icons.search, size: 18, color: Colors.white.withOpacity(0.3)),
              suffixIcon: searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () => setState(() {
                        searchController.clear();
                      }),
                    )
                  : null,
              isDense: true,
              filled: true,
              fillColor: Colors.white.withOpacity(0.04),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.06))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.blue.withOpacity(0.4))),
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
            style: const TextStyle(fontSize: 13),
            onChanged: (_) => setState(() {}),
          ),

          // Search results
          if (searchResults.isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 120),
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.blue.withOpacity(0.15)),
                color: Colors.white.withOpacity(0.03),
              ),
              child: ListView.builder(
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                itemCount: searchResults.length,
                itemBuilder: (context, i) {
                  final court = searchResults[i];
                  return ListTile(
                    dense: true,
                    visualDensity: VisualDensity.compact,
                    leading: Icon(court.isIndoor ? Icons.roofing : Icons.park, size: 18, color: Colors.blue),
                    title: Text(court.name, style: const TextStyle(fontSize: 13)),
                    subtitle: court.address != null
                        ? Text(court.address!, style: TextStyle(fontSize: 11, color: Colors.grey[500]))
                        : null,
                    onTap: () => setState(() {
                      onCourtSelected(court);
                      searchController.clear();
                    }),
                  );
                },
              ),
            ),
        ],
      ],
    );
  }

  // ==============================
  // Shared: Inline date & time pickers
  // ==============================
  Widget _buildInlineDatePicker(DateTime selectedDate, void Function(DateTime) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.calendar_today, size: 16, color: Colors.blue),
            const SizedBox(width: 6),
            Text(
              DateFormat('EEEE, MMM d').format(selectedDate),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.blue),
            ),
          ],
        ),
        const SizedBox(height: 4),
        SizedBox(
          height: 120,
          child: CupertinoTheme(
            data: const CupertinoThemeData(
              brightness: Brightness.dark,
              textTheme: CupertinoTextThemeData(
                dateTimePickerTextStyle: TextStyle(color: Colors.white, fontSize: 16),
              ),
            ),
            child: CupertinoDatePicker(
              mode: CupertinoDatePickerMode.date,
              initialDateTime: selectedDate,
              minimumDate: DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day),
              maximumDate: DateTime.now().add(const Duration(days: 365)),
              onDateTimeChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInlineTimePicker(TimeOfDay selectedTime, void Function(DateTime) onChanged) {
    final now = DateTime.now();
    final dt = DateTime(now.year, now.month, now.day, selectedTime.hour, selectedTime.minute);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.access_time, size: 16, color: Colors.orange),
            const SizedBox(width: 6),
            Text(
              DateFormat('h:mm a').format(dt),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.orange),
            ),
          ],
        ),
        const SizedBox(height: 4),
        SizedBox(
          height: 120,
          child: CupertinoTheme(
            data: const CupertinoThemeData(
              brightness: Brightness.dark,
              textTheme: CupertinoTextThemeData(
                dateTimePickerTextStyle: TextStyle(color: Colors.white, fontSize: 16),
              ),
            ),
            child: CupertinoDatePicker(
              mode: CupertinoDatePickerMode.time,
              initialDateTime: dt,
              use24hFormat: false,
              minuteInterval: 5,
              onDateTimeChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  // ==============================
  // Add Practice (full-screen sheet)
  // ==============================
  void _showAddPracticeDialog() {
    if (_myTeams.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create or join a team first')),
      );
      return;
    }

    final titleController = TextEditingController(text: 'Practice');
    final courtSearchController = TextEditingController();
    final notesController = TextEditingController();
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    TimeOfDay selectedTime = const TimeOfDay(hour: 18, minute: 0);
    String? recurrence;
    String selectedTeamId = _myTeams.first['id']?.toString() ?? '';
    Court? selectedCourt;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.92,
          decoration: BoxDecoration(
            color: Colors.grey[900],
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.pop(sheetContext),
              ),
              title: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.fitness_center, color: Colors.green, size: 20),
                  const SizedBox(width: 8),
                  const Text('Add Practice', style: TextStyle(color: Colors.white, fontSize: 16)),
                ],
              ),
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: ElevatedButton(
                    onPressed: () async {
                      Navigator.pop(sheetContext);
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
                          locationName: selectedCourt?.name ?? null,
                          courtId: selectedCourt?.id,
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
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    ),
                    child: const Text('Create'),
                  ),
                ),
              ],
            ),
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Court picker (status-composer style)
                  _buildCourtPicker(
                    selectedCourt: selectedCourt,
                    searchController: courtSearchController,
                    onCourtSelected: (court) { selectedCourt = court; },
                    setState: setSheetState,
                  ),
                  const SizedBox(height: 20),

                  // Date picker
                  _buildInlineDatePicker(selectedDate, (dt) {
                    setSheetState(() => selectedDate = dt);
                  }),
                  const SizedBox(height: 12),

                  // Time picker
                  _buildInlineTimePicker(selectedTime, (dt) {
                    setSheetState(() => selectedTime = TimeOfDay(hour: dt.hour, minute: dt.minute));
                  }),
                  const SizedBox(height: 20),

                  // Team selector
                  if (_myTeams.length > 1) ...[
                    Row(
                      children: [
                        Icon(Icons.groups, size: 14, color: Colors.green.withOpacity(0.7)),
                        const SizedBox(width: 6),
                        const Text('Team:', style: TextStyle(color: Colors.white54, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedTeamId,
                      decoration: InputDecoration(
                        isDense: true,
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.04),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: _myTeams.map((t) => DropdownMenuItem(
                        value: t['id']?.toString(),
                        child: Text(t['name'] ?? 'Team', style: const TextStyle(fontSize: 13)),
                      )).toList(),
                      onChanged: (v) => setSheetState(() => selectedTeamId = v ?? selectedTeamId),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Recurrence
                  Row(
                    children: [
                      Icon(Icons.repeat, size: 14, color: Colors.orange.withOpacity(0.7)),
                      const SizedBox(width: 6),
                      const Text('Repeat:', style: TextStyle(color: Colors.white54, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String?>(
                    value: recurrence,
                    decoration: InputDecoration(
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.04),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    items: const [
                      DropdownMenuItem(value: null, child: Text('None', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'weekly', child: Text('Weekly', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'biweekly', child: Text('Every 2 Weeks', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'daily', child: Text('Daily', style: TextStyle(fontSize: 13))),
                    ],
                    onChanged: (v) => setSheetState(() => recurrence = v),
                  ),
                  const SizedBox(height: 16),

                  // Title
                  TextField(
                    controller: titleController,
                    decoration: InputDecoration(
                      hintText: 'Title',
                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 13),
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.04),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    style: const TextStyle(fontSize: 13),
                  ),
                  const SizedBox(height: 12),

                  // Notes
                  TextField(
                    controller: notesController,
                    decoration: InputDecoration(
                      hintText: 'Notes (optional)',
                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 13),
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.04),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    style: const TextStyle(fontSize: 13),
                    maxLines: 2,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ==============================
  // Add Game (full-screen sheet)
  // ==============================
  void _showAddGameDialog() {
    if (_myTeams.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create or join a team first')),
      );
      return;
    }

    final titleController = TextEditingController();
    final courtSearchController = TextEditingController();
    final opponentController = TextEditingController();
    final notesController = TextEditingController();
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    TimeOfDay selectedTime = const TimeOfDay(hour: 18, minute: 0);
    String selectedTeamId = _myTeams.first['id']?.toString() ?? '';
    Court? selectedCourt;
    String? selectedOpponentId;
    String? selectedOpponentName;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.92,
          decoration: BoxDecoration(
            color: Colors.grey[900],
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.pop(sheetContext),
              ),
              title: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.sports_basketball, color: Colors.purple, size: 20),
                  const SizedBox(width: 8),
                  const Text('Add Game', style: TextStyle(color: Colors.white, fontSize: 16)),
                ],
              ),
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: ElevatedButton(
                    onPressed: () async {
                      Navigator.pop(sheetContext);
                      final opponent = selectedOpponentName ?? opponentController.text.trim();
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
                          locationName: selectedCourt?.name ?? null,
                          courtId: selectedCourt?.id,
                          opponentTeamId: selectedOpponentId,
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
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.purple,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    ),
                    child: const Text('Create'),
                  ),
                ),
              ],
            ),
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Court picker (status-composer style)
                  _buildCourtPicker(
                    selectedCourt: selectedCourt,
                    searchController: courtSearchController,
                    onCourtSelected: (court) { selectedCourt = court; },
                    setState: setSheetState,
                  ),
                  const SizedBox(height: 20),

                  // Opponent section — bounded box with followed teams
                  Row(
                    children: [
                      Icon(Icons.sports_basketball, size: 14, color: Colors.purple.withOpacity(0.7)),
                      const SizedBox(width: 6),
                      const Text('Opponent:', style: TextStyle(color: Colors.white54, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Selected opponent badge
                  if (selectedOpponentName != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.purple.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.purple.withOpacity(0.4)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_circle, size: 16, color: Colors.purple),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              'vs $selectedOpponentName',
                              style: const TextStyle(color: Colors.purple, fontSize: 13, fontWeight: FontWeight.w500),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: () => setSheetState(() {
                              selectedOpponentName = null;
                              selectedOpponentId = null;
                              opponentController.clear();
                            }),
                            child: const Icon(Icons.close, size: 16, color: Colors.purple),
                          ),
                        ],
                      ),
                    ),

                  // Followed teams bounded box
                  if (selectedOpponentName == null)
                    Builder(builder: (_) {
                      final checkInState = Provider.of<CheckInState>(context, listen: false);
                      final teamNames = checkInState.followedTeamNames;
                      if (teamNames.isEmpty) return const SizedBox.shrink();
                      final hasOverflow = teamNames.length >= 3;
                      return Container(
                        constraints: const BoxConstraints(maxHeight: 120),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withOpacity(0.08)),
                          color: Colors.white.withOpacity(0.03),
                        ),
                        child: ScrollbarTheme(
                          data: ScrollbarThemeData(
                            thumbColor: WidgetStateProperty.all(Colors.white.withOpacity(0.2)),
                            radius: const Radius.circular(4),
                            thickness: WidgetStateProperty.all(3.0),
                          ),
                          child: Scrollbar(
                            thumbVisibility: hasOverflow,
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
                              child: Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: teamNames.entries.map((entry) => ActionChip(
                                  avatar: const Icon(Icons.groups, size: 16, color: Colors.purple),
                                  label: Text(
                                    entry.value,
                                    style: const TextStyle(fontSize: 12, color: Colors.white70),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  backgroundColor: Colors.purple.withOpacity(0.15),
                                  side: BorderSide(color: Colors.purple.withOpacity(0.3)),
                                  onPressed: () => setSheetState(() {
                                    selectedOpponentId = entry.key;
                                    selectedOpponentName = entry.value;
                                    opponentController.clear();
                                  }),
                                )).toList(),
                              ),
                            ),
                          ),
                        ),
                      );
                    }),

                  // Search/custom opponent input
                  if (selectedOpponentName == null) ...[
                    const SizedBox(height: 10),
                    TextField(
                      controller: opponentController,
                      decoration: InputDecoration(
                        hintText: 'Search or type team name...',
                        hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 13),
                        prefixIcon: Icon(Icons.search, size: 18, color: Colors.white.withOpacity(0.3)),
                        suffixIcon: opponentController.text.isNotEmpty
                            ? GestureDetector(
                                onTap: () => setSheetState(() => opponentController.clear()),
                                child: Icon(Icons.close, size: 18, color: Colors.white.withOpacity(0.4)),
                              )
                            : null,
                        isDense: true,
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.04),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.06))),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.purple.withOpacity(0.4))),
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                      style: const TextStyle(fontSize: 13),
                      onChanged: (_) => setSheetState(() {}),
                    ),
                    // Live search results
                    Builder(builder: (_) {
                      final query = opponentController.text.trim();
                      if (query.isEmpty) return const SizedBox.shrink();
                      final teamResults = _searchTeams(query);
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (teamResults.isNotEmpty)
                            Container(
                              margin: const EdgeInsets.only(top: 4),
                              constraints: const BoxConstraints(maxHeight: 200),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.purple.withOpacity(0.2)),
                                color: Colors.grey[850],
                              ),
                              child: ListView.separated(
                                shrinkWrap: true,
                                padding: EdgeInsets.zero,
                                itemCount: teamResults.length,
                                separatorBuilder: (_, __) => Divider(height: 1, color: Colors.white.withOpacity(0.06)),
                                itemBuilder: (_, i) {
                                  final team = teamResults[i];
                                  final teamName = (team['name'] ?? team['teamName'] ?? 'Unknown').toString();
                                  final teamType = (team['teamType'] ?? '').toString();
                                  return ListTile(
                                    dense: true,
                                    visualDensity: const VisualDensity(vertical: -3),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                                    leading: const Icon(Icons.groups, size: 18, color: Colors.purple),
                                    title: Text(teamName, style: const TextStyle(fontSize: 13, color: Colors.white)),
                                    subtitle: teamType.isNotEmpty
                                        ? Text(teamType, style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4)))
                                        : null,
                                    onTap: () => setSheetState(() {
                                      selectedOpponentId = team['id']?.toString();
                                      selectedOpponentName = teamName;
                                      opponentController.clear();
                                    }),
                                  );
                                },
                              ),
                            ),
                          // "Use custom name" option
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: InkWell(
                              onTap: () => setSheetState(() {
                                selectedOpponentName = opponentController.text.trim();
                                selectedOpponentId = null;
                              }),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.purple.withOpacity(0.2)),
                                  color: Colors.purple.withOpacity(0.06),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.add, size: 16, color: Colors.purple),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Use "${opponentController.text.trim()}"',
                                      style: const TextStyle(fontSize: 13, color: Colors.purple),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      );
                    }),
                  ],
                  const SizedBox(height: 20),

                  // Date picker
                  _buildInlineDatePicker(selectedDate, (dt) {
                    setSheetState(() => selectedDate = dt);
                  }),
                  const SizedBox(height: 12),

                  // Time picker
                  _buildInlineTimePicker(selectedTime, (dt) {
                    setSheetState(() => selectedTime = TimeOfDay(hour: dt.hour, minute: dt.minute));
                  }),
                  const SizedBox(height: 20),

                  // Team selector
                  if (_myTeams.length > 1) ...[
                    Row(
                      children: [
                        Icon(Icons.groups, size: 14, color: Colors.purple.withOpacity(0.7)),
                        const SizedBox(width: 6),
                        const Text('Your team:', style: TextStyle(color: Colors.white54, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedTeamId,
                      decoration: InputDecoration(
                        isDense: true,
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.04),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: _myTeams.map((t) => DropdownMenuItem(
                        value: t['id']?.toString(),
                        child: Text(t['name'] ?? 'Team', style: const TextStyle(fontSize: 13)),
                      )).toList(),
                      onChanged: (v) => setSheetState(() => selectedTeamId = v ?? selectedTeamId),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Title
                  TextField(
                    controller: titleController,
                    decoration: InputDecoration(
                      hintText: 'Title (optional) e.g. Semifinal',
                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 13),
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.04),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    style: const TextStyle(fontSize: 13),
                  ),
                  const SizedBox(height: 12),

                  // Notes
                  TextField(
                    controller: notesController,
                    decoration: InputDecoration(
                      hintText: 'Notes (optional)',
                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 13),
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.04),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    style: const TextStyle(fontSize: 13),
                    maxLines: 2,
                  ),
                ],
              ),
            ),
          ),
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

  /// Start a match from a scheduled game event
  Future<void> _startGameFromEvent(Map<String, dynamic> event) async {
    final teamId = event['teamId']?.toString() ?? '';
    final eventId = event['id']?.toString() ?? '';
    if (teamId.isEmpty || eventId.isEmpty) return;

    try {
      // Call API to create/get match for this event
      final result = await ApiService.startMatchFromEvent(
        teamId: teamId,
        eventId: eventId,
      );

      final match = result['match'];
      if (match == null) {
        throw Exception('No match returned from API');
      }

      // Look up team type from _myTeams
      final team = _myTeams.firstWhere(
        (t) => t['id']?.toString() == teamId,
        orElse: () => <String, dynamic>{},
      );
      final teamType = team['teamType']?.toString() ?? '5v5';
      final teamName = event['teamName']?.toString() ?? team['name']?.toString() ?? 'My Team';
      final opponentName = event['opponentTeamName']?.toString() ?? 'Opponent';

      if (!mounted) return;

      // Hydrate MatchState (same pattern as team challenge acceptance)
      final matchState = Provider.of<MatchState>(context, listen: false);
      matchState.reset();
      matchState.mode = teamType;
      matchState.myTeamId = teamId;
      matchState.myTeamName = teamName;
      matchState.opponentTeamName = opponentName;
      matchState.setMatchId(match['id']?.toString());

      // Navigate to match setup
      context.go('/match/setup');
    } catch (e) {
      debugPrint('Error starting match from event: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start match: $e')),
        );
      }
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
    final ageGroup = team['ageGroup'];
    final gender = team['gender'];
    final skillLevel = team['skillLevel'];
    final cityVal = team['city'];
    final descriptionVal = team['description'];
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
                // Row 1: Team name + Owner badge
                Row(
                  children: [
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
                const SizedBox(height: 8),
                // Row 2: Attribute badges (wrapped)
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
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
                    if (skillLevel != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.deepPurple.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.deepPurple.withOpacity(0.3)),
                        ),
                        child: Text(skillLevel, style: TextStyle(color: Colors.deepPurple[200], fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    if (ageGroup != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.teal.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.teal.withOpacity(0.3)),
                        ),
                        child: Text(ageGroup, style: TextStyle(color: Colors.teal[300], fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    if (gender != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.indigo.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.indigo.withOpacity(0.3)),
                        ),
                        child: Text(gender, style: TextStyle(color: Colors.indigo[300], fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildStatChip(Icons.star, rating.toStringAsFixed(1)),
                    const SizedBox(width: 12),
                    _buildStatChip(Icons.emoji_events, '$wins W - $losses L'),
                    if (cityVal != null && cityVal.toString().isNotEmpty) ...[
                      const SizedBox(width: 12),
                      _buildStatChip(Icons.location_on, cityVal.toString()),
                    ],
                  ],
                ),
                if (descriptionVal != null && descriptionVal.toString().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    descriptionVal.toString(),
                    style: TextStyle(color: Colors.grey[500], fontSize: 12),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
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
                // Start Game button (games only)
                if (!isPractice)
                  ElevatedButton.icon(
                    onPressed: () => _startGameFromEvent(event),
                    icon: const Icon(Icons.sports_basketball, size: 16),
                    label: const Text('Start Game', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.purple,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                // Notes indicator
                if (isPractice && event['notes'] != null && (event['notes'] as String).isNotEmpty)
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
  String? _selectedAgeGroup;
  String? _selectedGender;
  String? _myTeamId; // User's team id for challenges

  final _ageGroups = ['U10', 'U12', 'U14', 'U18', 'HS', 'College', 'Open'];
  final _genders = ['Mens', 'Womens', 'Coed'];

  @override
  void initState() {
    super.initState();
    _loadMyTeam();
    _loadTeams();
  }

  Future<void> _loadMyTeam() async {
    try {
      final teams = await ApiService.getMyTeams();
      final matching = teams.where((t) => t['teamType'] == widget.teamType).toList();
      if (matching.isNotEmpty && mounted) {
        setState(() => _myTeamId = matching.first['id']);
      }
    } catch (e) {
      debugPrint('Error loading my team: $e');
    }
  }

  Future<void> _loadTeams() async {
    setState(() => _isLoading = true);
    try {
      final teams = await ApiService.getTeamRankings(
        teamType: widget.teamType,
        scope: 'local',
        ageGroup: _selectedAgeGroup,
        gender: _selectedGender,
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

  Future<void> _challengeTeam(Map<String, dynamic> opponent) async {
    if (_myTeamId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create a team first to send challenges!')),
      );
      return;
    }
    if (_myTeamId == opponent['id']) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("You can't challenge your own team")),
      );
      return;
    }
    try {
      await ApiService.challengeTeam(
        teamId: _myTeamId!,
        opponentTeamId: opponent['id'],
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Challenge sent to ${opponent['name']}!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Challenge failed: ${e.toString().replaceAll('Exception: ', '')}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.teamType} Teams'),
        backgroundColor: widget.teamType == '3v3' ? Colors.blue : Colors.purple,
      ),
      body: Column(
        children: [
          // Filter chips row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: Colors.grey[900],
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ..._ageGroups.map((ag) => Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: FilterChip(
                      label: Text(ag, style: const TextStyle(fontSize: 11)),
                      selected: _selectedAgeGroup == ag,
                      onSelected: (_) {
                        setState(() => _selectedAgeGroup = _selectedAgeGroup == ag ? null : ag);
                        _loadTeams();
                      },
                      selectedColor: Colors.teal,
                      labelStyle: TextStyle(color: _selectedAgeGroup == ag ? Colors.white : null),
                      visualDensity: VisualDensity.compact,
                    ),
                  )),
                  const SizedBox(width: 8),
                  ..._genders.map((g) => Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: FilterChip(
                      label: Text(g, style: const TextStyle(fontSize: 11)),
                      selected: _selectedGender == g,
                      onSelected: (_) {
                        setState(() => _selectedGender = _selectedGender == g ? null : g);
                        _loadTeams();
                      },
                      selectedColor: Colors.indigo,
                      labelStyle: TextStyle(color: _selectedGender == g ? Colors.white : null),
                      visualDensity: VisualDensity.compact,
                    ),
                  )),
                ],
              ),
            ),
          ),
          // Team list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _teams.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.groups, size: 64, color: Colors.grey[400]),
                            const SizedBox(height: 16),
                            Text('No ${widget.teamType} teams found', style: TextStyle(fontSize: 18, color: Colors.grey[600])),
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
                            final ageGroup = team['ageGroup'];
                            final gender = team['gender'];

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
                                  onTap: () {
                                    Navigator.push(context, MaterialPageRoute(
                                      builder: (_) => TeamDetailScreen(teamId: team['id']),
                                    ));
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
                                              Row(
                                                children: [
                                                  Text(
                                                    '⭐ ${rating.toStringAsFixed(2)} • $wins W - $losses L',
                                                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                                                  ),
                                                  if (ageGroup != null) ...[
                                                    const SizedBox(width: 6),
                                                    Text(ageGroup, style: TextStyle(color: Colors.teal[300], fontSize: 10, fontWeight: FontWeight.bold)),
                                                  ],
                                                  if (gender != null) ...[
                                                    const SizedBox(width: 4),
                                                    Text(gender, style: TextStyle(color: Colors.indigo[300], fontSize: 10, fontWeight: FontWeight.bold)),
                                                  ],
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                        ElevatedButton(
                                          onPressed: () => _challengeTeam(team),
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
          ),
        ],
      ),
    );
  }
}

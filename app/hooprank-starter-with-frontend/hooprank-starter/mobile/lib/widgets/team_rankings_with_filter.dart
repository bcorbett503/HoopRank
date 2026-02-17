import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../screens/team_detail_screen.dart';

/// Helper widget to show Team Rankings filtered by team type and Local
class TeamRankingsWithFilter extends StatefulWidget {
  final String teamType;

  const TeamRankingsWithFilter({super.key, required this.teamType});

  @override
  State<TeamRankingsWithFilter> createState() => _TeamRankingsWithFilterState();
}

class _TeamRankingsWithFilterState extends State<TeamRankingsWithFilter> {
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

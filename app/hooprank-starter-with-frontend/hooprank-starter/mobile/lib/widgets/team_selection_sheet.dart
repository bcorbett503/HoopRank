import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// Team selection sheet for choosing opponent team in team matches
class TeamSelectionSheet extends StatefulWidget {
  final String teamType;
  final String myTeamId;
  final String myTeamName;
  final Function(Map<String, dynamic>) onTeamSelected;

  const TeamSelectionSheet({
    super.key,
    required this.teamType,
    required this.myTeamId,
    required this.myTeamName,
    required this.onTeamSelected,
  });

  @override
  State<TeamSelectionSheet> createState() => _TeamSelectionSheetState();
}

class _TeamSelectionSheetState extends State<TeamSelectionSheet> {
  List<Map<String, dynamic>> _teams = [];
  bool _isLoading = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadTeams();
  }

  Future<void> _loadTeams() async {
    try {
      final response = await ApiService.getRankings(mode: widget.teamType);
      if (mounted) {
        setState(() {
          // Filter out user's own team
          _teams = response.where((t) => t['id'] != widget.myTeamId).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredTeams = _teams.where((t) {
      final name = (t['name'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery.toLowerCase());
    }).toList();

    final color = widget.teamType == '3v3' ? Colors.blue : Colors.purple;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withOpacity(0.2),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Challenge ${widget.teamType} Team',
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              Text(
                'as ${widget.myTeamName}',
                style: TextStyle(color: Colors.grey[400]),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search teams...',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Colors.grey[800],
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
        ),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : filteredTeams.isEmpty
                  ? Center(
                      child: Text(
                        'No ${widget.teamType} teams found',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    )
                  : ListView.builder(
                      itemCount: filteredTeams.length,
                      itemBuilder: (context, index) {
                        final team = filteredTeams[index];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: color.withOpacity(0.3),
                            child: Text(
                              (team['name'] ?? '?')[0].toUpperCase(),
                              style: TextStyle(
                                  color: color, fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(team['name'] ?? 'Team'),
                          subtitle: Builder(builder: (context) {
                            final rv = team['rating'];
                            final ratingStr = rv is num
                                ? rv.toStringAsFixed(1)
                                : (double.tryParse(rv?.toString() ?? '')
                                        ?.toStringAsFixed(1) ??
                                    '3.0');
                            return Text(
                                'Rating: $ratingStr • ${team['wins'] ?? 0}W-${team['losses'] ?? 0}L');
                          }),
                          trailing: ElevatedButton(
                            onPressed: () => widget.onTeamSelected(team),
                            style: ElevatedButton.styleFrom(
                                backgroundColor: color),
                            child: const Text('Challenge'),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}

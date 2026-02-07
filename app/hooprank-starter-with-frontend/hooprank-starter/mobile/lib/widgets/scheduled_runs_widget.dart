import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../state/check_in_state.dart';

/// Widget to display and manage scheduled runs at a court
class ScheduledRunsWidget extends StatefulWidget {
  final String courtId;
  final String courtName;

  const ScheduledRunsWidget({
    super.key,
    required this.courtId,
    required this.courtName,
  });

  @override
  State<ScheduledRunsWidget> createState() => _ScheduledRunsWidgetState();
}

class _ScheduledRunsWidgetState extends State<ScheduledRunsWidget> {
  List<ScheduledRun> _runs = [];
  bool _isLoading = true;
  bool _showCreateForm = false;

  @override
  void initState() {
    super.initState();
    _loadRuns();
  }

  Future<void> _loadRuns() async {
    setState(() => _isLoading = true);
    try {
      final runs = await ApiService.getCourtRuns(widget.courtId);
      if (mounted) {
        setState(() {
          _runs = runs;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _joinRun(ScheduledRun run) async {
    final success = await ApiService.joinRun(run.id);
    if (success) {
      _loadRuns();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('You\'re in! 🏀')),
        );
      }
    }
  }

  Future<void> _leaveRun(ScheduledRun run) async {
    final success = await ApiService.leaveRun(run.id);
    if (success) {
      _loadRuns();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with title and create button
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.calendar_today, size: 18, color: Colors.orange),
                  const SizedBox(width: 8),
                  const Text(
                    'Upcoming Runs',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  if (_runs.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.orange.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${_runs.length}',
                        style: const TextStyle(
                          color: Colors.orange,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              TextButton.icon(
                onPressed: () => _showCreateRunSheet(context),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Schedule'),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.orange,
                ),
              ),
            ],
          ),
        ),

        // Empty state or runs list
        if (_runs.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: Center(
              child: Column(
                children: [
                  Icon(Icons.sports_basketball, size: 48, color: Colors.grey[600]),
                  const SizedBox(height: 12),
                  Text(
                    'No runs scheduled yet',
                    style: TextStyle(color: Colors.grey[500], fontSize: 14),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Be the first to schedule a pickup game!',
                    style: TextStyle(color: Colors.grey[600], fontSize: 12),
                  ),
                ],
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _runs.length,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemBuilder: (context, index) => _buildRunCard(_runs[index]),
          ),
      ],
    );
  }

  Widget _buildRunCard(ScheduledRun run) {
    final isFull = run.isFull;
    final isAlmostFull = run.isAlmostFull;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF2A2A2A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: run.isAttending
              ? Colors.orange.withOpacity(0.5)
              : Colors.white.withOpacity(0.05),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: Title, game mode, time
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Game mode badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _getModeColor(run.gameMode).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  run.gameMode,
                  style: TextStyle(
                    color: _getModeColor(run.gameMode),
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              // Court type badge
              if (run.courtTypeLabel != null) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.teal.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    run.courtTypeLabel!,
                    style: const TextStyle(color: Colors.teal, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
              // Age range badge
              if (run.ageRange != null && run.ageRange!.isNotEmpty) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    run.ageRange!,
                    style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (run.title != null && run.title!.isNotEmpty)
                      Text(
                        run.title!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    Text(
                      run.timeString,
                      style: TextStyle(
                        color: Colors.grey[400],
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              // Player count
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isFull
                      ? Colors.red.withOpacity(0.2)
                      : isAlmostFull
                          ? Colors.orange.withOpacity(0.2)
                          : Colors.green.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.people,
                      size: 14,
                      color: isFull
                          ? Colors.red
                          : isAlmostFull
                              ? Colors.orange
                              : Colors.green,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${run.attendeeCount}/${run.maxPlayers}',
                      style: TextStyle(
                        color: isFull
                            ? Colors.red
                            : isAlmostFull
                                ? Colors.orange
                                : Colors.green,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Attendees row
          if (run.attendees.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                // Stacked avatars
                SizedBox(
                  width: 20.0 * run.attendees.take(4).length + 16,
                  height: 28,
                  child: Stack(
                    children: [
                      for (var i = 0; i < run.attendees.take(4).length; i++)
                        Positioned(
                          left: i * 20.0,
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFF2A2A2A), width: 2),
                              color: Colors.grey[700],
                            ),
                            child: run.attendees[i].photoUrl != null
                                ? ClipOval(
                                    child: Image.network(
                                      run.attendees[i].photoUrl!,
                                      fit: BoxFit.cover,
                                    ),
                                  )
                                : Center(
                                    child: Text(
                                      run.attendees[i].name.isNotEmpty
                                          ? run.attendees[i].name[0].toUpperCase()
                                          : '?',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                          ),
                        ),
                      if (run.attendeeCount > 4)
                        Positioned(
                          left: 4 * 20.0,
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFF2A2A2A), width: 2),
                              color: Colors.grey[600],
                            ),
                            child: Center(
                              child: Text(
                                '+${run.attendeeCount - 4}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const Spacer(),
                // Join/Leave button
                if (run.isAttending)
                  TextButton(
                    onPressed: () => _leaveRun(run),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.grey,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    child: const Text('Leave'),
                  )
                else if (!isFull)
                  ElevatedButton(
                    onPressed: () => _joinRun(run),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('I\'m In'),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.grey[700],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Full',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ),
              ],
            ),
          ],

          // Notes
          if (run.notes != null && run.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              run.notes!,
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }

  Color _getModeColor(String mode) {
    switch (mode) {
      case '1v1':
        return Colors.deepOrange;
      case '3v3':
        return Colors.blue;
      case '5v5':
        return Colors.purple;
      default:
        return Colors.orange;
    }
  }

  void _showCreateRunSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => CreateRunSheet(
        courtId: widget.courtId,
        courtName: widget.courtName,
        onCreated: () {
          Navigator.pop(context);
          _loadRuns();
        },
      ),
    );
  }
}

/// Bottom sheet for creating a new run
class CreateRunSheet extends StatefulWidget {
  final String courtId;
  final String courtName;
  final VoidCallback onCreated;

  const CreateRunSheet({
    super.key,
    required this.courtId,
    required this.courtName,
    required this.onCreated,
  });

  @override
  State<CreateRunSheet> createState() => _CreateRunSheetState();
}

class _CreateRunSheetState extends State<CreateRunSheet> {
  final _titleController = TextEditingController();
  final _notesController = TextEditingController();
  String _gameMode = '5v5';
  String? _courtType; // null = unset, 'full', 'half'
  String? _ageRange; // null = unset, '18+', '21+', '30+', '40+', '50+', 'open'
  DateTime _scheduledAt = DateTime.now().add(const Duration(hours: 2));
  int _maxPlayers = 10;
  bool _isSubmitting = false;

  // Player tagging state
  String _tagMode = 'all'; // 'all', 'local', 'individual'
  final Set<String> _selectedPlayerIds = {};

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);

    try {
      final runId = await ApiService.createRun(
        courtId: widget.courtId,
        scheduledAt: _scheduledAt,
        title: _titleController.text.isEmpty ? null : _titleController.text,
        gameMode: _gameMode,
        courtType: _courtType,
        ageRange: _ageRange,
        maxPlayers: _maxPlayers,
        notes: _notesController.text.isEmpty ? null : _notesController.text,
        tagMode: _tagMode,
        taggedPlayerIds: _tagMode == 'individual' ? _selectedPlayerIds.toList() : null,
      );

      if (runId != null) {
        widget.onCreated();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to create run')),
          );
        }
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              const Icon(Icons.calendar_today, color: Colors.orange),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Schedule a Run',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      widget.courtName,
                      style: TextStyle(color: Colors.grey[400], fontSize: 13),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.grey),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Game mode selector
          const Text('Game Mode', style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 8),
          Row(
            children: ['3v3', '5v5'].map((mode) {
              final isSelected = _gameMode == mode;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _gameMode = mode;
                    _maxPlayers = mode == '3v3' ? 6 : 10;
                  }),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? _getModeColor(mode).withOpacity(0.3)
                          : Colors.grey[800],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected ? _getModeColor(mode) : Colors.transparent,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        mode,
                        style: TextStyle(
                          color: isSelected ? _getModeColor(mode) : Colors.grey,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 16),

          // Court type selector
          const Text('Court Type', style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 8),
          Row(
            children: [null, 'full', 'half'].map((type) {
              final isSelected = _courtType == type;
              final label = type == null ? 'Any' : (type == 'full' ? 'Full Court' : 'Half Court');
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _courtType = type),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: isSelected ? Colors.teal.withOpacity(0.3) : Colors.grey[800],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected ? Colors.teal : Colors.transparent,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        label,
                        style: TextStyle(
                          color: isSelected ? Colors.teal : Colors.grey,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 16),

          // Age range selector
          const Text('Age Range', style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.grey[800],
              borderRadius: BorderRadius.circular(8),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String?>(
                value: _ageRange,
                isExpanded: true,
                dropdownColor: Colors.grey[800],
                style: const TextStyle(color: Colors.white),
                hint: const Text('Any age (optional)', style: TextStyle(color: Colors.grey)),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('Any age', style: TextStyle(color: Colors.grey))),
                  ...['18+', '21+', '30+', '40+', '50+', 'Open'].map((age) =>
                    DropdownMenuItem<String?>(value: age.toLowerCase(), child: Text(age)),
                  ),
                ],
                onChanged: (val) => setState(() => _ageRange = val),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Date/Time picker
          const Text('When', style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: _scheduledAt,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 30)),
              );
              if (date != null && mounted) {
                final time = await showTimePicker(
                  context: context,
                  initialTime: TimeOfDay.fromDateTime(_scheduledAt),
                );
                if (time != null && mounted) {
                  setState(() {
                    _scheduledAt = DateTime(
                      date.year,
                      date.month,
                      date.day,
                      time.hour,
                      time.minute,
                    );
                  });
                }
              }
            },
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[800],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.access_time, color: Colors.orange, size: 20),
                  const SizedBox(width: 12),
                  Text(
                    _formatDateTime(_scheduledAt),
                    style: const TextStyle(color: Colors.white),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right, color: Colors.grey),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Max players
          Row(
            children: [
              const Text('Max Players', style: TextStyle(color: Colors.white70, fontSize: 13)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.remove_circle_outline, color: Colors.grey),
                onPressed: _maxPlayers > 2
                    ? () => setState(() => _maxPlayers--)
                    : null,
              ),
              Text(
                '$_maxPlayers',
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, color: Colors.orange),
                onPressed: _maxPlayers < 15
                    ? () => setState(() => _maxPlayers++)
                    : null,
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Tag Players Section
          const Text('Tag Players', style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 8),
          Row(
            children: ['all', 'local', 'individual'].map((mode) {
              final isSelected = _tagMode == mode;
              final label = mode == 'all' ? 'All' : (mode == 'local' ? 'Local' : 'Individual');
              final icon = mode == 'all' ? Icons.public : (mode == 'local' ? Icons.near_me : Icons.person_add);
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _tagMode = mode),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: isSelected ? Colors.orange.withOpacity(0.3) : Colors.grey[800],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected ? Colors.orange : Colors.transparent,
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 18, color: isSelected ? Colors.orange : Colors.grey),
                        const SizedBox(height: 4),
                        Text(
                          label,
                          style: TextStyle(
                            color: isSelected ? Colors.orange : Colors.grey,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          if (_tagMode == 'all')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'All your followed players will be notified',
                style: TextStyle(color: Colors.grey[500], fontSize: 12, fontStyle: FontStyle.italic),
              ),
            ),
          if (_tagMode == 'local')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Players near this court will be notified',
                style: TextStyle(color: Colors.grey[500], fontSize: 12, fontStyle: FontStyle.italic),
              ),
            ),
          if (_tagMode == 'individual') ...[
            const SizedBox(height: 8),
            _buildPlayerSelector(),
          ],

          const SizedBox(height: 16),

          // Optional title
          TextField(
            controller: _titleController,
            decoration: InputDecoration(
              hintText: 'Title (optional)',
              hintStyle: TextStyle(color: Colors.grey[600]),
              filled: true,
              fillColor: Colors.grey[800],
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide.none,
              ),
            ),
            style: const TextStyle(color: Colors.white),
          ),

          const SizedBox(height: 12),

          // Optional notes
          TextField(
            controller: _notesController,
            decoration: InputDecoration(
              hintText: 'Notes (optional)',
              hintStyle: TextStyle(color: Colors.grey[600]),
              filled: true,
              fillColor: Colors.grey[800],
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide.none,
              ),
            ),
            style: const TextStyle(color: Colors.white),
            maxLines: 2,
          ),

          const SizedBox(height: 24),

          // Submit button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text(
                      'Schedule Run',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerSelector() {
    final checkInState = context.read<CheckInState>();
    final followedIds = checkInState.followedPlayers.toList();

    if (followedIds.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.grey[800]!.withOpacity(0.5),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(Icons.info_outline, color: Colors.grey[500], size: 18),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Follow players to tag them in your runs',
                style: TextStyle(color: Colors.grey[500], fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      constraints: const BoxConstraints(maxHeight: 160),
      decoration: BoxDecoration(
        color: Colors.grey[850],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[700]!),
      ),
      child: ListView.builder(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        itemCount: followedIds.length,
        itemBuilder: (context, index) {
          final playerId = followedIds[index];
          final playerName = checkInState.getPlayerName(playerId);
          final isSelected = _selectedPlayerIds.contains(playerId);
          return ListTile(
            dense: true,
            leading: CircleAvatar(
              radius: 14,
              backgroundColor: isSelected
                  ? Colors.orange.withOpacity(0.3)
                  : Colors.grey[700],
              child: Text(
                playerName.isNotEmpty ? playerName[0].toUpperCase() : '?',
                style: TextStyle(
                  color: isSelected ? Colors.orange : Colors.white54,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
            title: Text(
              playerName,
              style: TextStyle(
                fontSize: 14,
                color: isSelected ? Colors.white : Colors.white70,
              ),
            ),
            trailing: Icon(
              isSelected ? Icons.check_circle : Icons.circle_outlined,
              color: isSelected ? Colors.orange : Colors.grey[600],
              size: 20,
            ),
            onTap: () {
              setState(() {
                if (isSelected) {
                  _selectedPlayerIds.remove(playerId);
                } else {
                  _selectedPlayerIds.add(playerId);
                }
              });
            },
          );
        },
      ),
    );
  }


  Color _getModeColor(String mode) {
    switch (mode) {
      case '1v1':
        return Colors.deepOrange;
      case '3v3':
        return Colors.blue;
      case '5v5':
        return Colors.purple;
      default:
        return Colors.orange;
    }
  }

  String _formatDateTime(DateTime dt) {
    final now = DateTime.now();
    final diff = dt.difference(now);
    
    String dayPart;
    if (diff.inDays == 0) {
      dayPart = 'Today';
    } else if (diff.inDays == 1) {
      dayPart = 'Tomorrow';
    } else {
      final days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      dayPart = '${days[dt.weekday % 7]}, ${dt.month}/${dt.day}';
    }

    final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final period = dt.hour >= 12 ? 'PM' : 'AM';
    return '$dayPart at $hour:${dt.minute.toString().padLeft(2, '0')} $period';
  }
}

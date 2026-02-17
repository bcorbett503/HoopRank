import 'package:flutter/material.dart';
import '../state/check_in_state.dart';
import '../services/court_service.dart';

/// Enhanced status composer with @-mention support for tagging players and courts
class StatusComposerSheet extends StatefulWidget {
  final CheckInState checkInState;
  final String userName;
  final String? userPhotoUrl;
  final String? initialStatus;

  const StatusComposerSheet({
    super.key,
    required this.checkInState,
    required this.userName,
    this.userPhotoUrl,
    this.initialStatus,
  });

  @override
  State<StatusComposerSheet> createState() => _StatusComposerSheetState();
}

class _StatusComposerSheetState extends State<StatusComposerSheet> {
  late TextEditingController _controller;
  final FocusNode _focusNode = FocusNode();

  // Tagged entities
  final List<Map<String, String>> _taggedPlayers = [];
  final List<Map<String, String>> _taggedCourts = [];

  // Autocomplete state
  bool _showAutocomplete = false;
  String _searchQuery = '';
  String _searchType = 'player'; // 'player' or 'court'
  int _mentionStartIndex = -1;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialStatus ?? '');
    _controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final text = _controller.text;
    final cursorPos = _controller.selection.baseOffset;

    if (cursorPos < 0 || cursorPos > text.length) {
      _hideAutocomplete();
      return;
    }

    // Look backwards for @ symbol
    int atIndex = -1;
    for (int i = cursorPos - 1; i >= 0; i--) {
      if (text[i] == '@') {
        atIndex = i;
        break;
      } else if (text[i] == ' ' || text[i] == '\n') {
        break;
      }
    }

    if (atIndex >= 0) {
      final query = text.substring(atIndex + 1, cursorPos).toLowerCase();
      setState(() {
        _showAutocomplete = true;
        _searchQuery = query;
        _mentionStartIndex = atIndex;
      });
    } else {
      _hideAutocomplete();
    }
  }

  void _hideAutocomplete() {
    if (_showAutocomplete) {
      setState(() {
        _showAutocomplete = false;
        _searchQuery = '';
        _mentionStartIndex = -1;
      });
    }
  }

  List<Map<String, dynamic>> _getPlayerSuggestions() {
    final players = <Map<String, dynamic>>[];

    // Add followed players
    for (final playerId in widget.checkInState.followedPlayers) {
      final name = widget.checkInState.getPlayerName(playerId);
      if (name.toLowerCase().contains(_searchQuery)) {
        players.add({'id': playerId, 'name': name, 'type': 'player'});
      }
    }

    // Add mock suggestions if empty
    if (players.isEmpty && _searchQuery.isEmpty) {
      players.addAll([
        {'id': 'demo_player_1', 'name': 'Marcus Johnson', 'type': 'player'},
        {'id': 'demo_player_2', 'name': 'Sarah Chen', 'type': 'player'},
        {'id': 'demo_player_3', 'name': 'Mike Williams', 'type': 'player'},
      ]);
    }

    return players.take(5).toList();
  }

  List<Map<String, dynamic>> _getCourtSuggestions() {
    final courts = <Map<String, dynamic>>[];
    final courtService = CourtService();

    // Add followed courts
    for (final courtId in widget.checkInState.followedCourts) {
      final court = courtService.getCourtById(courtId);
      if (court != null && court.name.toLowerCase().contains(_searchQuery)) {
        courts.add({'id': courtId, 'name': court.name, 'type': 'court'});
      }
    }

    // If no matches from followed, search all courts
    if (courts.isEmpty && _searchQuery.length >= 2) {
      for (final court in courtService.courts.take(50)) {
        if (court.name.toLowerCase().contains(_searchQuery)) {
          courts.add({'id': court.id, 'name': court.name, 'type': 'court'});
          if (courts.length >= 5) break;
        }
      }
    }

    return courts.take(5).toList();
  }

  void _insertMention(Map<String, dynamic> item) {
    final text = _controller.text;
    final cursorPos = _controller.selection.baseOffset;

    // Replace @query with @name
    final beforeMention = text.substring(0, _mentionStartIndex);
    final afterMention =
        cursorPos < text.length ? text.substring(cursorPos) : '';
    final mentionText = '@${item['name']} ';

    final newText = beforeMention + mentionText + afterMention;
    _controller.text = newText;
    _controller.selection = TextSelection.collapsed(
      offset: beforeMention.length + mentionText.length,
    );

    // Add to tagged list
    setState(() {
      if (item['type'] == 'player') {
        if (!_taggedPlayers.any((p) => p['id'] == item['id'])) {
          _taggedPlayers.add(
              {'id': item['id'] as String, 'name': item['name'] as String});
        }
      } else {
        if (!_taggedCourts.any((c) => c['id'] == item['id'])) {
          _taggedCourts.add(
              {'id': item['id'] as String, 'name': item['name'] as String});
        }
      }
    });

    _hideAutocomplete();
  }

  void _removeTag(String type, String id) {
    setState(() {
      if (type == 'player') {
        _taggedPlayers.removeWhere((p) => p['id'] == id);
      } else {
        _taggedCourts.removeWhere((c) => c['id'] == id);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              const Expanded(
                child: Text(
                  "What's your status?",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
                iconSize: 20,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Use @ to tag players and courts',
            style: TextStyle(color: Colors.grey[400], fontSize: 13),
          ),
          const SizedBox(height: 16),

          // Text input - larger
          TextField(
            controller: _controller,
            focusNode: _focusNode,
            autofocus: true,
            maxLength: 100,
            maxLines: 3,
            minLines: 2,
            decoration: InputDecoration(
              hintText: 'Looking for games at @Olympic Club... 🏀',
              hintStyle: TextStyle(color: Colors.grey[500]),
              filled: true,
              fillColor: Colors.grey[800],
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.all(16),
            ),
          ),

          // Autocomplete dropdown
          if (_showAutocomplete) ...[
            const SizedBox(height: 4),
            Container(
              constraints: const BoxConstraints(maxHeight: 180),
              decoration: BoxDecoration(
                color: Colors.grey[850],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[700]!),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Type toggle
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _searchType = 'player'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: _searchType == 'player'
                                  ? Colors.deepOrange.withOpacity(0.3)
                                  : null,
                              borderRadius: const BorderRadius.only(
                                  topLeft: Radius.circular(11)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person,
                                    size: 16,
                                    color: _searchType == 'player'
                                        ? Colors.deepOrange
                                        : Colors.grey),
                                const SizedBox(width: 4),
                                Text('Players',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w500,
                                      color: _searchType == 'player'
                                          ? Colors.deepOrange
                                          : Colors.grey,
                                    )),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _searchType = 'court'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: _searchType == 'court'
                                  ? Colors.blue.withOpacity(0.3)
                                  : null,
                              borderRadius: const BorderRadius.only(
                                  topRight: Radius.circular(11)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.location_on,
                                    size: 16,
                                    color: _searchType == 'court'
                                        ? Colors.blue
                                        : Colors.grey),
                                const SizedBox(width: 4),
                                Text('Courts',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w500,
                                      color: _searchType == 'court'
                                          ? Colors.blue
                                          : Colors.grey,
                                    )),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Divider(height: 1, color: Colors.grey[700]),
                  // Suggestions
                  Flexible(
                    child: ListView(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      children: (_searchType == 'player'
                              ? _getPlayerSuggestions()
                              : _getCourtSuggestions())
                          .map((item) => ListTile(
                                dense: true,
                                leading: CircleAvatar(
                                  radius: 14,
                                  backgroundColor: item['type'] == 'player'
                                      ? Colors.deepOrange.withOpacity(0.3)
                                      : Colors.blue.withOpacity(0.3),
                                  child: Icon(
                                    item['type'] == 'player'
                                        ? Icons.person
                                        : Icons.location_on,
                                    size: 14,
                                    color: item['type'] == 'player'
                                        ? Colors.deepOrange
                                        : Colors.blue,
                                  ),
                                ),
                                title: Text(item['name'] as String,
                                    style: const TextStyle(fontSize: 14)),
                                onTap: () => _insertMention(item),
                              ))
                          .toList(),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Tagged chips
          if (_taggedPlayers.isNotEmpty || _taggedCourts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                ..._taggedPlayers.map((p) => Chip(
                      avatar: const Icon(Icons.person,
                          size: 16, color: Colors.deepOrange),
                      label: Text(p['name']!,
                          style: const TextStyle(fontSize: 12)),
                      backgroundColor: Colors.deepOrange.withOpacity(0.2),
                      deleteIcon: const Icon(Icons.close, size: 14),
                      onDeleted: () => _removeTag('player', p['id']!),
                    )),
                ..._taggedCourts.map((c) => Chip(
                      avatar: const Icon(Icons.location_on,
                          size: 16, color: Colors.blue),
                      label: Text(c['name']!,
                          style: const TextStyle(fontSize: 12)),
                      backgroundColor: Colors.blue.withOpacity(0.2),
                      deleteIcon: const Icon(Icons.close, size: 14),
                      onDeleted: () => _removeTag('court', c['id']!),
                    )),
              ],
            ),
          ],

          const SizedBox(height: 16),

          // Action buttons
          Row(
            children: [
              if (widget.initialStatus != null)
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      widget.checkInState.clearMyStatus();
                      Navigator.pop(context);
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Clear Status'),
                  ),
                ),
              if (widget.initialStatus != null) const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    if (_controller.text.isNotEmpty) {
                      widget.checkInState.setMyStatus(
                        _controller.text,
                        userName: widget.userName,
                        photoUrl: widget.userPhotoUrl,
                      );
                    }
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.deepOrange,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Post Status'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

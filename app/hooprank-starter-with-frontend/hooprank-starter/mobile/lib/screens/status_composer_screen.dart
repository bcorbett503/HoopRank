import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../services/court_service.dart';
import '../state/check_in_state.dart';

/// Full-screen status composer with rich options for posting
class StatusComposerScreen extends StatefulWidget {
  final DateTime? initialScheduledTime;
  final String? initialContent;
  final XFile? initialImage;
  final Court? initialCourt;
  
  const StatusComposerScreen({
    super.key,
    this.initialScheduledTime,
    this.initialContent,
    this.initialImage,
    this.initialCourt,
  });

  @override
  State<StatusComposerScreen> createState() => _StatusComposerScreenState();
}

class _StatusComposerScreenState extends State<StatusComposerScreen> {
  final TextEditingController _textController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  final ImagePicker _imagePicker = ImagePicker();
  
  XFile? _selectedImage;
  DateTime? _scheduledTime;
  bool _isRecurring = false;
  bool _isSubmitting = false;
  
  // Run attributes (visible when scheduling)
  String _gameMode = '5v5';
  String? _courtType; // null=any, 'full', 'half'
  String? _ageRange; // null=any, '18+', '21+', '30+', '40+'
  
  // Court tagging
  List<Court> _courtSuggestions = [];
  bool _showCourtSuggestions = false;
  Court? _taggedCourt;
  
  // Quick prompts to encourage posts
  final List<String> _quickPrompts = [
    "🏀 Looking for a game?",
    "📍 Heading to the court?",
    "⏰ Running next?",
    "💪 Who's got next?",
    "🔥 Anyone around?",
  ];

  @override
  void initState() {
    super.initState();
    _textController.text = widget.initialContent ?? '';
    _selectedImage = widget.initialImage;
    _scheduledTime = widget.initialScheduledTime;
    _taggedCourt = widget.initialCourt;
    
    // If initial court is set, add @courtname to text
    if (widget.initialCourt != null && _textController.text.isEmpty) {
      _textController.text = '@${widget.initialCourt!.name} ';
    }
    
    // Auto-focus the text field
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
    
    // Listen for @ mentions
    _textController.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _textController.dispose();
    _focusNode.dispose();
    super.dispose();
  }
  
  /// Load followed courts with court data
  Future<List<Court>> _loadFollowedCourts(BuildContext context) async {
    final checkInState = Provider.of<CheckInState>(context, listen: false);
    final courtService = Provider.of<CourtService>(context, listen: false);
    final followedCourts = checkInState.followedCourts;
    
    if (followedCourts.isEmpty) return [];
    
    // Ensure courts are loaded
    await courtService.loadCourts();
    
    // Get court objects for followed court IDs
    final courts = <Court>[];
    for (final courtId in followedCourts) {
      final court = courtService.getCourtById(courtId);
      if (court != null) courts.add(court);
    }
    
    return courts;
  }

  void _onTextChanged() {
    final text = _textController.text;
    final cursorPos = _textController.selection.baseOffset;
    
    if (cursorPos <= 0 || cursorPos > text.length) {
      setState(() => _showCourtSuggestions = false);
      return;
    }
    
    final textBeforeCursor = text.substring(0, cursorPos);
    final lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex >= 0) {
      final textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.contains(' ') && textAfterAt.isNotEmpty) {
        _searchCourts(textAfterAt);
      } else if (textAfterAt.isEmpty) {
        _searchCourts('');
      } else {
        setState(() => _showCourtSuggestions = false);
      }
    } else {
      setState(() => _showCourtSuggestions = false);
    }
  }

  void _searchCourts(String query) {
    final courtService = Provider.of<CourtService>(context, listen: false);
    final courts = courtService.searchCourts(query);
    setState(() {
      _courtSuggestions = courts.take(5).toList();
      _showCourtSuggestions = courts.isNotEmpty;
    });
  }

  void _selectCourt(Court court) {
    final text = _textController.text;
    final cursorPos = _textController.selection.baseOffset;
    final textBeforeCursor = text.substring(0, cursorPos);
    final lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex >= 0) {
      final textAfterCursor = cursorPos < text.length ? text.substring(cursorPos) : '';
      final newText = text.substring(0, lastAtIndex) + '@${court.name} ' + textAfterCursor;
      _textController.text = newText;
      _textController.selection = TextSelection.collapsed(offset: lastAtIndex + court.name.length + 2);
    }
    
    setState(() {
      _taggedCourt = court;
      _showCourtSuggestions = false;
    });
  }

  Future<void> _pickImage() async {
    final image = await _imagePicker.pickImage(source: ImageSource.gallery, maxWidth: 1024, maxHeight: 1024, imageQuality: 75);
    if (image != null) {
      setState(() => _selectedImage = image);
    }
  }

  Future<void> _takePhoto() async {
    final image = await _imagePicker.pickImage(source: ImageSource.camera, maxWidth: 1024, maxHeight: 1024, imageQuality: 75);
    if (image != null) {
      setState(() => _selectedImage = image);
    }
  }

  void _showScheduleSheet() async {
    // Go directly to date picker
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Colors.deepOrange,
              onPrimary: Colors.white,
              surface: Color(0xFF1E2128),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    
    if (date != null && mounted) {
      // Show custom time picker with half-hour slots
      final time = await _showDigitalTimePicker(date);
      if (time != null && mounted) {
        setState(() {
          _scheduledTime = DateTime(date.year, date.month, date.day, time.hour, time.minute);
          // Clear media when scheduling - scheduled runs don't allow media
          _selectedImage = null;
        });
      }
    }
  }
  
  /// Custom digital time picker with only hour and half-hour options
  Future<TimeOfDay?> _showDigitalTimePicker(DateTime selectedDate) async {
    final now = DateTime.now();
    final isToday = selectedDate.year == now.year && 
                    selectedDate.month == now.month && 
                    selectedDate.day == now.day;
    
    // Generate time slots from 6am to 11pm, every 30 minutes
    final List<TimeOfDay> timeSlots = [];
    for (int hour = 6; hour <= 23; hour++) {
      for (int minute = 0; minute <= 30; minute += 30) {
        final slot = TimeOfDay(hour: hour, minute: minute);
        // If today, only show future times
        if (isToday) {
          final slotDateTime = DateTime(selectedDate.year, selectedDate.month, selectedDate.day, hour, minute);
          if (slotDateTime.isAfter(now)) {
            timeSlots.add(slot);
          }
        } else {
          timeSlots.add(slot);
        }
      }
    }
    
    return showModalBottomSheet<TimeOfDay>(
      context: context,
      backgroundColor: const Color(0xFF1E2128),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.access_time, color: Colors.deepOrange),
                  const SizedBox(width: 12),
                  Text(
                    'Pick a time for ${_formatDateOnly(selectedDate)}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 200,
                child: GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 2.0,
                  ),
                  itemCount: timeSlots.length,
                  itemBuilder: (context, index) {
                    final slot = timeSlots[index];
                    final label = _formatTimeOfDay(slot);
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => Navigator.pop(ctx, slot),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.deepOrange.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.deepOrange.withOpacity(0.3)),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            label,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 13),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
  
  String _formatDateOnly(DateTime date) {
    final now = DateTime.now();
    final isToday = date.year == now.year && date.month == now.month && date.day == now.day;
    final isTomorrow = date.difference(DateTime(now.year, now.month, now.day)).inDays == 1;
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return '${date.month}/${date.day}';
  }
  
  String _formatTimeOfDay(TimeOfDay time) {
    final hour = time.hourOfPeriod == 0 ? 12 : time.hourOfPeriod;
    final period = time.hour >= 12 ? 'PM' : 'AM';
    if (time.minute == 0) return '$hour $period';
    return '$hour:${time.minute.toString().padLeft(2, '0')} $period';
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final isToday = time.day == now.day && time.month == now.month && time.year == now.year;
    final isTomorrow = time.day == now.day + 1 && time.month == now.month && time.year == now.year;
    
    final timeStr = '${time.hour % 12 == 0 ? 12 : time.hour % 12}:${time.minute.toString().padLeft(2, '0')} ${time.hour >= 12 ? 'PM' : 'AM'}';
    
    if (isToday) return 'Today at $timeStr';
    if (isTomorrow) return 'Tomorrow at $timeStr';
    return '${time.month}/${time.day} at $timeStr';
  }

  void _usePrompt(String prompt) {
    _textController.text = prompt.replaceAll(RegExp(r'^[^\s]+ '), '');
    _textController.selection = TextSelection.collapsed(offset: _textController.text.length);
    _focusNode.requestFocus();
  }

  Future<void> _submitPost() async {
    final text = _textController.text.trim();
    if (text.isEmpty && _selectedImage == null) return;
    
    setState(() => _isSubmitting = true);
    
    try {
      // Encode image as base64 data URL if selected
      String? imageUrl;
      if (_selectedImage != null) {
        debugPrint('STATUS_IMAGE: Encoding image from ${_selectedImage!.path}');
        final bytes = await File(_selectedImage!.path).readAsBytes();
        debugPrint('STATUS_IMAGE: Read ${bytes.length} bytes');
        final mimeType = _selectedImage!.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        imageUrl = 'data:$mimeType;base64,${base64Encode(bytes)}';
        debugPrint('STATUS_IMAGE: Encoded to data URL of length ${imageUrl.length}');
      } else {
        debugPrint('STATUS_IMAGE: No image selected');
      }
      
      debugPrint('STATUS_IMAGE: Calling createStatus with imageUrl=${imageUrl != null ? 'data URL (${imageUrl.length} chars)' : 'null'}');
      await ApiService.createStatus(
        text,
        imageUrl: imageUrl,
        scheduledAt: _scheduledTime,
        courtId: _taggedCourt?.id,
        gameMode: _scheduledTime != null ? _gameMode : null,
        courtType: _scheduledTime != null ? _courtType : null,
        ageRange: _scheduledTime != null ? _ageRange : null,
      );
      
      if (mounted) {
        Navigator.pop(context, true); // Return true to indicate success
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_scheduledTime != null ? 'Game scheduled! 🎉' : 'Posted! 🏀'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to post: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasContent = _textController.text.isNotEmpty || _selectedImage != null;
    
    return Scaffold(
      backgroundColor: Colors.grey[900],
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('What\'s your status?', style: TextStyle(color: Colors.white, fontSize: 16)),
        actions: [
          // Post button
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton(
              onPressed: hasContent && !_isSubmitting ? _submitPost : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepOrange,
                disabledBackgroundColor: Colors.grey[700],
                padding: const EdgeInsets.symmetric(horizontal: 20),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              ),
              child: _isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_scheduledTime != null ? 'Schedule' : 'Post'),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Main content area
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [

                  
                  // Followed Courts - quick select
                  FutureBuilder<List<Court>>(
                    future: _loadFollowedCourts(context),
                    builder: (context, snapshot) {
                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      
                      final courts = snapshot.data!;
                      
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.favorite, size: 14, color: Colors.redAccent.withOpacity(0.7)),
                              const SizedBox(width: 6),
                              const Text(
                                'Your courts:',
                                style: TextStyle(color: Colors.white54, fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: courts.take(5).map((court) => ActionChip(
                              avatar: Icon(
                                _taggedCourt?.id == court.id ? Icons.check_circle : Icons.location_on,
                                size: 16,
                                color: _taggedCourt?.id == court.id ? Colors.green : Colors.blue,
                              ),
                              label: Text(
                                court.name,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: _taggedCourt?.id == court.id ? Colors.green : Colors.white70,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              backgroundColor: _taggedCourt?.id == court.id
                                  ? Colors.green.withOpacity(0.2)
                                  : Colors.blue.withOpacity(0.15),
                              side: BorderSide(
                                color: _taggedCourt?.id == court.id
                                    ? Colors.green.withOpacity(0.5)
                                    : Colors.blue.withOpacity(0.3),
                              ),
                              onPressed: () {
                                if (_taggedCourt?.id == court.id) {
                                  // Deselect
                                  setState(() => _taggedCourt = null);
                                } else {
                                  // Select this court
                                  setState(() => _taggedCourt = court);
                                  // Optionally add @courtname to text
                                  if (!_textController.text.contains('@${court.name}')) {
                                    final current = _textController.text;
                                    if (current.isNotEmpty && !current.endsWith(' ')) {
                                      _textController.text = '$current @${court.name}';
                                    } else {
                                      _textController.text = '${current}@${court.name}';
                                    }
                                  }
                                }
                              },
                            )).toList(),
                          ),
                          const SizedBox(height: 16),
                        ],
                      );
                    },
                  ),
                  
                  // Scheduled time badge
                  if (_scheduledTime != null)
                    GestureDetector(
                      onTap: () => setState(() => _scheduledTime = null),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.deepOrange.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.deepOrange.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.event, size: 16, color: Colors.deepOrange),
                            const SizedBox(width: 8),
                            Text(
                              _formatTime(_scheduledTime!),
                              style: const TextStyle(color: Colors.deepOrange, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(width: 8),
                            const Icon(Icons.close, size: 16, color: Colors.deepOrange),
                          ],
                        ),
                      ),
                    ),
                  
                  // Tagged court badge
                  if (_taggedCourt != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.blue.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.location_on, size: 16, color: Colors.blue),
                          const SizedBox(width: 8),
                          Text(
                            _taggedCourt!.name,
                            style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  
                  // Image preview
                  if (_selectedImage != null)
                    Stack(
                      children: [
                        Container(
                          height: 200,
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            image: DecorationImage(
                              image: FileImage(File(_selectedImage!.path)),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        Positioned(
                          top: 8,
                          right: 8,
                          child: GestureDetector(
                            onTap: () => setState(() => _selectedImage = null),
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Icon(Icons.close, color: Colors.white, size: 18),
                            ),
                          ),
                        ),
                      ],
                    ),
                  
                  // Main text input
                  TextField(
                    controller: _textController,
                    focusNode: _focusNode,
                    maxLines: null,
                    minLines: 3,
                    style: const TextStyle(color: Colors.white, fontSize: 18),
                    decoration: const InputDecoration(
                      hintText: 'What\'s on your mind, hooper?\n\nType @ to tag a court...',
                      hintStyle: TextStyle(color: Colors.white30, fontSize: 16),
                      border: InputBorder.none,
                    ),
                  ),
                  
                  // Court suggestions
                  if (_showCourtSuggestions && _courtSuggestions.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      decoration: BoxDecoration(
                        color: Colors.grey[800],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.blue.withOpacity(0.3)),
                      ),
                      child: Column(
                        children: _courtSuggestions.map((court) => ListTile(
                          leading: const Icon(Icons.location_on, color: Colors.blue),
                          title: Text(court.name, style: const TextStyle(color: Colors.white)),
                          subtitle: court.address != null 
                              ? Text(court.address!, style: TextStyle(color: Colors.grey[400]))
                              : null,
                          onTap: () => _selectCourt(court),
                        )).toList(),
                      ),
                    ),
                  
                  // ── Run Attribute Badges (shown when scheduling) ──
                  if (_scheduledTime != null) ...[
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.04),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withOpacity(0.08)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.tune, size: 14, color: Colors.deepOrange.withOpacity(0.7)),
                              const SizedBox(width: 6),
                              const Text(
                                'Run details:',
                                style: TextStyle(color: Colors.white54, fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          
                          // Game Mode chips
                          const Text('Game Mode', style: TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: ['3v3', '5v5'].map((mode) {
                              final isSelected = _gameMode == mode;
                              final color = mode == '3v3' ? Colors.blue : Colors.purple;
                              return ActionChip(
                                avatar: Icon(
                                  isSelected ? Icons.check_circle : Icons.sports_basketball,
                                  size: 16,
                                  color: isSelected ? color : Colors.grey,
                                ),
                                label: Text(
                                  mode,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isSelected ? color : Colors.white70,
                                  ),
                                ),
                                backgroundColor: isSelected
                                    ? color.withOpacity(0.2)
                                    : Colors.grey[800],
                                side: BorderSide(
                                  color: isSelected
                                      ? color.withOpacity(0.5)
                                      : Colors.transparent,
                                ),
                                onPressed: () => setState(() => _gameMode = mode),
                              );
                            }).toList(),
                          ),
                          
                          const SizedBox(height: 14),
                          
                          // Court Type chips
                          const Text('Court Type', style: TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: [null, 'full', 'half'].map((type) {
                              final isSelected = _courtType == type;
                              final label = type == null ? 'Any' : (type == 'full' ? 'Full Court' : 'Half Court');
                              final icon = type == null ? Icons.all_inclusive : (type == 'full' ? Icons.rectangle_outlined : Icons.crop_square);
                              return ActionChip(
                                avatar: Icon(
                                  isSelected ? Icons.check_circle : icon,
                                  size: 16,
                                  color: isSelected ? Colors.teal : Colors.grey,
                                ),
                                label: Text(
                                  label,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: isSelected ? Colors.teal : Colors.white70,
                                  ),
                                ),
                                backgroundColor: isSelected
                                    ? Colors.teal.withOpacity(0.2)
                                    : Colors.grey[800],
                                side: BorderSide(
                                  color: isSelected
                                      ? Colors.teal.withOpacity(0.5)
                                      : Colors.transparent,
                                ),
                                onPressed: () => setState(() => _courtType = type),
                              );
                            }).toList(),
                          ),
                          
                          const SizedBox(height: 14),
                          
                          // Age Range chips
                          const Text('Age Range', style: TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: [null, '18+', '21+', '30+', '40+'].map((age) {
                              final isSelected = _ageRange == age;
                              final label = age ?? 'Open';
                              return ActionChip(
                                avatar: Icon(
                                  isSelected ? Icons.check_circle : Icons.people_outline,
                                  size: 16,
                                  color: isSelected ? Colors.amber : Colors.grey,
                                ),
                                label: Text(
                                  label,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: isSelected ? Colors.amber : Colors.white70,
                                  ),
                                ),
                                backgroundColor: isSelected
                                    ? Colors.amber.withOpacity(0.2)
                                    : Colors.grey[800],
                                side: BorderSide(
                                  color: isSelected
                                      ? Colors.amber.withOpacity(0.5)
                                      : Colors.transparent,
                                ),
                                onPressed: () => setState(() => _ageRange = age),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          
          // Bottom toolbar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey[850],
              border: Border(top: BorderSide(color: Colors.white.withOpacity(0.1))),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  // Media buttons only shown for regular posts (not scheduled runs)
                  if (_scheduledTime == null) ...[
                    // Photo from camera
                    IconButton(
                      icon: const Icon(Icons.camera_alt, color: Colors.white70),
                      onPressed: _takePhoto,
                      tooltip: 'Take photo',
                    ),
                    // Photo from gallery
                    IconButton(
                      icon: const Icon(Icons.photo_library, color: Colors.white70),
                      onPressed: _pickImage,
                      tooltip: 'Add photo',
                    ),
                  ],
                  // Tag court - always available
                  IconButton(
                    icon: const Icon(Icons.location_on, color: Colors.white70),
                    onPressed: () {
                      _textController.text += '@';
                      _textController.selection = TextSelection.collapsed(offset: _textController.text.length);
                      _focusNode.requestFocus();
                    },
                    tooltip: 'Tag court',
                  ),
                  // Tag friend - only for regular posts
                  if (_scheduledTime == null)
                    IconButton(
                      icon: const Icon(Icons.person_add, color: Colors.white70),
                      onPressed: () {
                        // TODO: Implement friend tagging
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Friend tagging coming soon!')),
                        );
                      },
                      tooltip: 'Tag friends',
                    ),
                  const Spacer(),
                  // Schedule Run button with text - always green to draw attention
                  GestureDetector(
                    onTap: _showScheduleSheet,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.green,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.green.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _scheduledTime != null ? Icons.check_circle : Icons.calendar_month,
                            size: 18,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _scheduledTime != null ? 'Scheduled ✓' : 'Schedule Run',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

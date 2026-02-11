import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../services/court_service.dart';
import '../services/video_upload_service.dart';
import '../state/app_state.dart';
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
  final TextEditingController _courtSearchController = TextEditingController();
  final FocusNode _courtSearchFocusNode = FocusNode();
  final ImagePicker _imagePicker = ImagePicker();
  
  XFile? _selectedImage;
  XFile? _selectedVideo;
  int? _videoDurationMs;
  bool _isUploadingVideo = false;
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
  
  // Friend tagging
  String _tagMode = 'all'; // 'all', 'local', 'individual'
  final Set<String> _selectedPlayerIds = {};
  List<FollowedPlayerInfo>? _followedPlayers;
  bool _isLoadingPlayers = false;
  bool _showPlayerTagging = true;
  bool _individualExpanded = false;
  
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
    
    // Pre-load followed players
    _loadFollowedPlayers();
  }

  @override
  void dispose() {
    _textController.dispose();
    _focusNode.dispose();
    _courtSearchController.dispose();
    _courtSearchFocusNode.dispose();
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

  /// Load followed players for tagging
  Future<void> _loadFollowedPlayers() async {
    if (_isLoadingPlayers || _followedPlayers != null) return;
    setState(() => _isLoadingPlayers = true);
    try {
      final checkInState = Provider.of<CheckInState>(context, listen: false);
      final players = await checkInState.getFollowedPlayersInfo();
      if (mounted) {
        setState(() {
          _followedPlayers = players;
          _isLoadingPlayers = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading followed players: $e');
      if (mounted) setState(() => _isLoadingPlayers = false);
    }
  }

  void _onTextChanged() {
    // Just trigger rebuild for Post button state
    setState(() {});
  }

  void _onCourtSearchChanged(String query) {
    if (query.trim().isEmpty) {
      setState(() {
        _courtSuggestions = [];
        _showCourtSuggestions = false;
      });
      return;
    }
    final courtService = Provider.of<CourtService>(context, listen: false);
    final courts = courtService.searchCourts(query.trim());
    setState(() {
      _courtSuggestions = courts.take(5).toList();
      _showCourtSuggestions = courts.isNotEmpty;
    });
  }

  void _selectCourt(Court court) {
    setState(() {
      _taggedCourt = court;
      _showCourtSuggestions = false;
      _courtSearchController.clear();
    });
    _courtSearchFocusNode.unfocus();
  }

  Future<void> _pickImage() async {
    final image = await _imagePicker.pickImage(source: ImageSource.gallery, maxWidth: 1024, maxHeight: 1024, imageQuality: 75);
    if (image != null) {
      setState(() {
        _selectedImage = image;
        _selectedVideo = null;
        _videoDurationMs = null;
      });
    }
  }

  Future<void> _takePhoto() async {
    final image = await _imagePicker.pickImage(source: ImageSource.camera, maxWidth: 1024, maxHeight: 1024, imageQuality: 75);
    if (image != null) {
      setState(() {
        _selectedImage = image;
        _selectedVideo = null;
        _videoDurationMs = null;
      });
    }
  }

  Future<void> _pickVideo() async {
    final XFile? video = await _imagePicker.pickVideo(
      source: ImageSource.gallery,
      maxDuration: const Duration(seconds: 30),
    );
    if (video != null) {
      final controller = VideoPlayerController.file(File(video.path));
      try {
        await controller.initialize();
        final durationMs = controller.value.duration.inMilliseconds;
        if (!VideoUploadService.isValidDuration(durationMs)) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Video must be 30 seconds or less. Please trim it first.'),
                backgroundColor: Colors.red,
              ),
            );
          }
          return;
        }
        setState(() {
          _selectedVideo = video;
          _videoDurationMs = durationMs;
          _selectedImage = null;
        });
      } finally {
        controller.dispose();
      }
    }
  }

  Widget _toolbarIcon(IconData icon, String tooltip, VoidCallback onPressed, {Color color = Colors.white70}) {
    return SizedBox(
      width: 36,
      height: 36,
      child: IconButton(
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(),
        icon: Icon(icon, color: color, size: 22),
        onPressed: onPressed,
        tooltip: tooltip,
      ),
    );
  }

  void _showScheduleSheet() async {
    // Show inline calendar in a bottom sheet — tapping a date auto-advances to time
    final date = await showModalBottomSheet<DateTime>(
      context: context,
      backgroundColor: const Color(0xFF1E2128),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Theme(
          data: Theme.of(ctx).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Colors.deepOrange,
              onPrimary: Colors.white,
              surface: Color(0xFF1E2128),
              onSurface: Colors.white,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 40, height: 4,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.grey[600],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Pick a date',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                CalendarDatePicker(
                  initialDate: DateTime.now(),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 30)),
                  onDateChanged: (selectedDate) {
                    Navigator.pop(ctx, selectedDate);
                  },
                ),
              ],
            ),
          ),
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
  
  /// Build the friend tagging section matching the "Your Courts" chip style
  Widget _buildFriendTaggingSection() {
    if (!_showPlayerTagging) return const SizedBox.shrink();
    
    final players = _followedPlayers ?? [];
    
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
        color: Colors.white.withOpacity(0.03),
      ),
      padding: const EdgeInsets.all(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(Icons.people, size: 14, color: Colors.deepOrange.withOpacity(0.7)),
              const SizedBox(width: 6),
              const Text(
                'Invite Players:',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 8),
          
          // Mode selection: All / Local / Individual – single row
          Row(
            children: [
              Expanded(child: _buildModeChip('all', 'All', Icons.group, Colors.deepOrange,
                  subtitle: 'Everyone you follow')),
              const SizedBox(width: 6),
              Expanded(child: _buildModeChip('local', 'Local', Icons.near_me, Colors.green,
                  subtitle: 'Within 25 mi')),
              const SizedBox(width: 6),
              Expanded(child: _buildModeChip('individual', 'Individual', Icons.person_search, Colors.blue,
                  subtitle: 'Pick players')),
            ],
          ),
          
          // Player list (only for Individual mode, shown directly)
          if (_tagMode == 'individual') ...[
            const SizedBox(height: 8),
            if (_isLoadingPlayers)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.deepOrange),
                  ),
                ),
              )
            else if (players.isEmpty)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(
                  'Follow some players first to tag them here!',
                  style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13),
                ),
              )
            else
              Container(
                constraints: const BoxConstraints(maxHeight: 120),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.blue.withOpacity(0.1)),
                  color: Colors.blue.withOpacity(0.03),
                ),
                child: ScrollbarTheme(
                  data: ScrollbarThemeData(
                    thumbColor: WidgetStateProperty.all(Colors.white.withOpacity(0.2)),
                    radius: const Radius.circular(4),
                    thickness: WidgetStateProperty.all(3.0),
                  ),
                  child: Scrollbar(
                    thumbVisibility: players.length >= 4,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: players.map((player) {
                          final isSelected = _selectedPlayerIds.contains(player.playerId);
                          return ActionChip(
                            avatar: player.photoUrl != null
                                ? CircleAvatar(
                                    backgroundImage: NetworkImage(player.photoUrl!),
                                    radius: 12,
                                  )
                                : CircleAvatar(
                                    radius: 12,
                                    backgroundColor: isSelected ? Colors.blue : Colors.grey[700],
                                    child: Text(
                                      player.name.isNotEmpty ? player.name[0].toUpperCase() : '?',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                                    ),
                                  ),
                            label: Text(
                              player.name,
                              style: TextStyle(
                                fontSize: 12,
                                color: isSelected ? Colors.blue : Colors.white70,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            backgroundColor: isSelected
                                ? Colors.blue.withOpacity(0.2)
                                : Colors.grey[800],
                            side: BorderSide(
                              color: isSelected
                                  ? Colors.blue.withOpacity(0.5)
                                  : Colors.transparent,
                            ),
                            onPressed: () {
                              setState(() {
                                if (isSelected) {
                                  _selectedPlayerIds.remove(player.playerId);
                                } else {
                                  _selectedPlayerIds.add(player.playerId);
                                }
                              });
                            },
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                ),
              ),
          ],
          
          // Summary of selection
          if (_tagMode == 'all' && players.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '${players.length} player${players.length == 1 ? '' : 's'} will be notified',
                style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 11),
              ),
            ),
          if (_tagMode == 'individual' && _selectedPlayerIds.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '${_selectedPlayerIds.length} player${_selectedPlayerIds.length == 1 ? '' : 's'} selected',
                style: TextStyle(color: Colors.blue.withOpacity(0.7), fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }
  
  /// Build a compact mode selection chip matching the app design
  Widget _buildModeChip(String mode, String label, IconData icon, Color color, {String? subtitle}) {
    final isSelected = _tagMode == mode;
    return GestureDetector(
      onTap: () {
        setState(() {
          _tagMode = mode;
          if (mode != 'individual') _individualExpanded = false;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.2) : Colors.grey[800],
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? color.withOpacity(0.5) : Colors.transparent,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isSelected ? Icons.check_circle : icon,
              size: 14,
              color: isSelected ? color : Colors.grey,
            ),
            const SizedBox(width: 4),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? color : Colors.white70,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 8,
                        color: isSelected ? color.withOpacity(0.7) : Colors.white38,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
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
    if (text.isEmpty && _selectedImage == null && _selectedVideo == null) return;
    
    setState(() => _isSubmitting = true);
    
    try {
      // Encode image as base64 data URL if selected
      String? imageUrl;
      String? videoUrl;
      String? videoThumbnailUrl;
      int? videoDurationMs;
      
      if (_selectedImage != null) {
        debugPrint('STATUS_IMAGE: Encoding image from ${_selectedImage!.path}');
        final bytes = await File(_selectedImage!.path).readAsBytes();
        final mimeType = _selectedImage!.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        imageUrl = 'data:$mimeType;base64,${base64Encode(bytes)}';
      }
      
      // Upload video to Firebase Storage
      if (_selectedVideo != null) {
        setState(() => _isUploadingVideo = true);
        try {
          final authState = Provider.of<AuthState>(context, listen: false);
          final userId = authState.currentUser?.id ?? '';
          
          videoUrl = await VideoUploadService.uploadVideo(
            File(_selectedVideo!.path),
            userId,
          );
          videoThumbnailUrl = await VideoUploadService.generateAndUploadThumbnail(
            _selectedVideo!.path,
            userId,
          );
          videoDurationMs = _videoDurationMs;
          debugPrint('STATUS_VIDEO: Uploaded: $videoUrl');
        } catch (e) {
          debugPrint('STATUS_VIDEO: Upload failed: $e');
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Video upload failed: $e'), backgroundColor: Colors.red),
            );
          }
          setState(() { _isSubmitting = false; _isUploadingVideo = false; });
          return;
        }
        setState(() => _isUploadingVideo = false);
      }
      
      await ApiService.createStatus(
        text,
        imageUrl: imageUrl,
        scheduledAt: _scheduledTime,
        courtId: _taggedCourt?.id,
        videoUrl: videoUrl,
        videoThumbnailUrl: videoThumbnailUrl,
        videoDurationMs: videoDurationMs,
        gameMode: _scheduledTime != null ? _gameMode : null,
        courtType: _scheduledTime != null ? _courtType : null,
        ageRange: _scheduledTime != null ? _ageRange : null,
        tagMode: _showPlayerTagging ? _tagMode : null,
        taggedPlayerIds: _showPlayerTagging && _tagMode == 'individual' ? _selectedPlayerIds.toList() : null,
      );
      
      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_scheduledTime != null ? 'Game scheduled! 🎉' : _selectedVideo != null ? 'Video posted! 🎬' : 'Posted! 🏀'),
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
    final hasContent = _textController.text.isNotEmpty || _selectedImage != null || _selectedVideo != null;
    
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
                  : const Text('Post'),
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

                  // ── Court Search Bar ──
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.location_on, size: 14, color: Colors.blue.withOpacity(0.7)),
                          const SizedBox(width: 6),
                          const Text(
                            'Tag a court:',
                            style: TextStyle(color: Colors.white54, fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _courtSearchController,
                        focusNode: _courtSearchFocusNode,
                        onChanged: _onCourtSearchChanged,
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Search courts...',
                          hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 14),
                          prefixIcon: Icon(Icons.search, color: Colors.white.withOpacity(0.4), size: 20),
                          suffixIcon: _courtSearchController.text.isNotEmpty
                              ? IconButton(
                                  icon: Icon(Icons.close, color: Colors.white.withOpacity(0.4), size: 18),
                                  onPressed: () {
                                    _courtSearchController.clear();
                                    _onCourtSearchChanged('');
                                  },
                                )
                              : null,
                          filled: true,
                          fillColor: Colors.white.withOpacity(0.06),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: Colors.blue.withOpacity(0.5)),
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          isDense: true,
                        ),
                      ),
                      // Court search results
                      if (_showCourtSuggestions && _courtSuggestions.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          constraints: const BoxConstraints(maxHeight: 200),
                          decoration: BoxDecoration(
                            color: Colors.grey[800],
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.blue.withOpacity(0.3)),
                          ),
                          child: ListView(
                            shrinkWrap: true,
                            padding: EdgeInsets.zero,
                            children: _courtSuggestions.map((court) => ListTile(
                              dense: true,
                              leading: const Icon(Icons.location_on, color: Colors.blue, size: 20),
                              title: Text(court.name, style: const TextStyle(color: Colors.white, fontSize: 13)),
                              subtitle: court.address != null
                                  ? Text(court.address!, style: TextStyle(color: Colors.grey[400], fontSize: 11))
                                  : null,
                              onTap: () => _selectCourt(court),
                            )).toList(),
                          ),
                        ),
                      const SizedBox(height: 4),
                    ],
                  ),

                  // Followed Courts - quick select
                  FutureBuilder<List<Court>>(
                    future: _loadFollowedCourts(context),
                    builder: (context, snapshot) {
                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      
                      final courts = snapshot.data!;
                      
                      final courtsToShow = courts.take(5).toList();
                      final hasOverflow = courtsToShow.length >= 3;
                      
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
                              if (hasOverflow) ...[
                                const Spacer(),
                                Text(
                                  'scroll ↕',
                                  style: TextStyle(color: Colors.white.withOpacity(0.25), fontSize: 10, fontStyle: FontStyle.italic),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 8),
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
                                    children: courtsToShow.map((court) => ActionChip(
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
                                          setState(() => _taggedCourt = null);
                                        } else {
                                          setState(() => _taggedCourt = court);
                                        }
                                      },
                                    )).toList(),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                      );
                    },
                  ),
                  
                  // ── Friend Tagging Section ──
                  _buildFriendTaggingSection(),

                  
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
                  
                  // Video preview
                  if (_selectedVideo != null)
                    Stack(
                      children: [
                        Container(
                          height: 200,
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.videocam, color: Colors.deepOrange.shade300, size: 48),
                                const SizedBox(height: 8),
                                Text(
                                  'Video ready',
                                  style: TextStyle(color: Colors.grey.shade300, fontSize: 14),
                                ),
                                if (_videoDurationMs != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.deepOrange.withOpacity(0.3),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        VideoUploadService.formatDuration(_videoDurationMs!),
                                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        Positioned(
                          top: 8,
                          right: 8,
                          child: GestureDetector(
                            onTap: () => setState(() { _selectedVideo = null; _videoDurationMs = null; }),
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
                      hintText: 'What\'s on your mind, hooper?',
                      hintStyle: TextStyle(color: Colors.white30, fontSize: 16),
                      border: InputBorder.none,
                    ),
                  ),
                  
                  // (Court suggestions moved to search bar above)
                  
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
                    _toolbarIcon(Icons.camera_alt, 'Take photo', _takePhoto),
                    // Photo from gallery
                    _toolbarIcon(Icons.photo_library, 'Add photo', _pickImage),
                    // Video from gallery
                    _toolbarIcon(Icons.videocam, 'Add video', _pickVideo),
                  ],
                  // Tag court - always available
                  _toolbarIcon(Icons.location_on, 'Tag court', () {
                    _textController.text += '@';
                    _textController.selection = TextSelection.collapsed(offset: _textController.text.length);
                    _focusNode.requestFocus();
                  }),
                  // Tag friend toggle
                  _toolbarIcon(
                    Icons.person_add,
                    'Tag friends',
                    () {
                      setState(() => _showPlayerTagging = !_showPlayerTagging);
                      if (_showPlayerTagging && _followedPlayers == null) {
                        _loadFollowedPlayers();
                      }
                    },
                    color: _showPlayerTagging ? Colors.deepOrange : Colors.white70,
                  ),
                  const Spacer(),
                  // Schedule Run button
                  GestureDetector(
                    onTap: _showScheduleSheet,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
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
                            size: 16,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _scheduledTime != null ? 'Set ✓' : 'Run',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
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

import 'dart:convert';
import 'dart:io';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app_config.dart';
import '../services/location_service.dart';
import '../services/api_service.dart';
import '../services/messages_service.dart';
import '../services/notification_service.dart';
import '../services/analytics_service.dart';
import '../services/recommended_matchup_engine.dart';
import '../state/app_state.dart';
import '../state/onboarding_checklist_state.dart';
import '../widgets/onboarding_checklist_card.dart';
import '../state/check_in_state.dart';
import '../models.dart';
import '../utils/image_utils.dart';
import '../services/court_service.dart';
import '../services/video_upload_service.dart';
import '../widgets/hooprank_feed.dart';
import '../widgets/scaffold_with_nav_bar.dart';
import 'status_composer_screen.dart';
import 'package:video_player/video_player.dart';
import '../widgets/team_selection_sheet.dart';
import '../widgets/status_composer_sheet.dart';
import '../widgets/challenge_composer_sheet.dart';
import '../widgets/home_primary_action_section.dart';
import '../widgets/player_profile_sheet.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  static const double _feedPanelExpandedTop = 8.0;
  static const double _feedPanelCollapsedVisibleHeight = 288.0;
  static const double _feedPanelCollapsedGap = 2.0;

  final MessagesService _messagesService = MessagesService();
  final GlobalKey _feedAnchorKey = GlobalKey();
  List<ChallengeRequest> _challenges = []; // Used in _loadChallenges
  List<Map<String, dynamic>> _pendingConfirmations = [];
  List<Map<String, dynamic>> _localActivity = []; // Used in _loadLocalActivity
  bool _isLoadingChallenges = true; // Used in loading state
  bool _isLoadingActivity = true; // Used in loading state

  double? _currentRating; // Fresh rating from API
  List<Map<String, dynamic>> _myTeams = []; // User's teams with ratings
  List<Map<String, dynamic>> _teamInvites = []; // Pending team invites
  List<Map<String, dynamic>> _teamChallenges =
      []; // Pending team challenges (3v3/5v5)
  final TextEditingController _statusController = TextEditingController();
  XFile? _selectedImage; // Selected image for post
  XFile? _selectedVideo; // Selected video for post
  int? _videoDurationMs; // Video duration in milliseconds
  bool _isUploadingVideo = false; // Video upload in progress
  final ImagePicker _imagePicker = ImagePicker();

  // Court tagging autocomplete state
  List<Court> _courtSuggestions = [];
  bool _showCourtSuggestions = false;
  Court? _taggedCourt;

  // Game scheduling state
  DateTime? _scheduledTime;
  bool _isRecurring = false;
  String _recurrenceType = 'weekly'; // 'daily', 'weekly'

  // Status bar expansion state
  bool _isStatusBarExpanded = false;
  int _feedReloadVersion = 0;
  HomePrimaryActionState _primaryActionState = HomePrimaryActionState.loading;
  RecommendedMatchup? _recommendedMatchup;
  bool _isPrimaryActionSubmitting = false;
  List<User> _primaryActionCandidates = [];
  final Set<String> _skippedSuggestedMatchupIds = <String>{};
  String? _loadedSkippedMatchupsUserId;
  String _primaryDiscoverMode = 'open';
  double _primaryDiscoverRadiusMi = 25.0;
  bool _primarySuggestionSkippedThisSession = false;
  double _feedPanelProgress = 0.0;
  double _feedAnchorHeight = 0.0;
  bool _isFeedAnchorMeasurementScheduled = false;
  late final AnimationController _quickPlayPulseController;
  late final Animation<double> _quickPlayPulse;

  String _skippedSuggestedMatchupsPrefsKey(String userId) =>
      'user_${userId}_skipped_suggested_matchups';

  Future<void> _loadSkippedSuggestedMatchupsForUser(String userId) async {
    if (_loadedSkippedMatchupsUserId == userId) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved =
          prefs.getStringList(_skippedSuggestedMatchupsPrefsKey(userId));
      _skippedSuggestedMatchupIds
        ..clear()
        ..addAll(saved ?? const <String>[]);
    } catch (e) {
      debugPrint('PRIMARY_ACTION: failed loading skipped suggestions: $e');
      _skippedSuggestedMatchupIds.clear();
    } finally {
      _loadedSkippedMatchupsUserId = userId;
    }
  }

  Future<void> _persistSkippedSuggestedMatchupsForUser(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(
        _skippedSuggestedMatchupsPrefsKey(userId),
        _skippedSuggestedMatchupIds.toList(),
      );
    } catch (e) {
      debugPrint('PRIMARY_ACTION: failed saving skipped suggestions: $e');
    }
  }

  void _scheduleFeedAnchorMeasurement() {
    if (_isFeedAnchorMeasurementScheduled) return;
    _isFeedAnchorMeasurementScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _isFeedAnchorMeasurementScheduled = false;
      if (!mounted) return;
      final renderBox =
          _feedAnchorKey.currentContext?.findRenderObject() as RenderBox?;
      final nextHeight = renderBox?.size.height;
      if (nextHeight == null) return;
      if ((nextHeight - _feedAnchorHeight).abs() <= 0.5) return;
      setState(() => _feedAnchorHeight = nextHeight);
    });
  }

  void _updateFeedPanelProgress(double availableTravel, double deltaDy) {
    if (availableTravel <= 0) return;
    setState(() {
      _feedPanelProgress =
          (_feedPanelProgress - (deltaDy / availableTravel)).clamp(0.0, 1.0);
    });
  }

  void _snapFeedPanel() {
    setState(() {
      _feedPanelProgress = _feedPanelProgress >= 0.5 ? 1.0 : 0.0;
    });
  }

  void _toggleFeedPanel() {
    setState(() {
      _feedPanelProgress = _feedPanelProgress >= 0.5 ? 0.0 : 1.0;
    });
  }

  @override
  void initState() {
    super.initState();
    _quickPlayPulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _quickPlayPulse = CurvedAnimation(
      parent: _quickPlayPulseController,
      curve: Curves.easeInOut,
    );
    WidgetsBinding.instance.addObserver(this);
    // Register for push notification refresh
    NotificationService.addOnNotificationListener(_refreshAll);
    ScaffoldWithNavBar.refreshFeedTab = _refreshEmbeddedFeed;
    _loadCurrentRating(); // Fetch fresh rating from API
    _loadChallenges();
    _loadPendingConfirmations();
    _loadLocalActivity();
    _loadMyTeams(); // Load user's teams for ratings
    _loadTeamInvites(); // Load pending team invites
    _loadTeamChallenges(); // Load pending team challenges
    _loadPrimaryAction(); // Load suggested matchup/invite fallback
    _statusController
        .addListener(_onStatusTextChanged); // Court tagging listener
  }

  /// Safely parse rating that could be String or num
  double _parseRating(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  Future<void> _submitStatus(String status) async {
    if (status.isEmpty && _selectedImage == null && _selectedVideo == null)
      return;

    final authState = Provider.of<AuthState>(context, listen: false);
    final user = authState.currentUser;
    final checkInState = Provider.of<CheckInState>(context, listen: false);

    if (user != null) {
      // Encode image as base64 data URL
      String? imageUrl;
      String? videoUrl;
      String? videoThumbnailUrl;
      int? videoDurationMs;

      if (_selectedImage != null) {
        final bytes = await File(_selectedImage!.path).readAsBytes();
        final mimeType = _selectedImage!.path.toLowerCase().endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
        imageUrl = 'data:$mimeType;base64,${base64Encode(bytes)}';
        debugPrint('HOME_STATUS: Encoded image to ${imageUrl.length} chars');
      }

      // Upload video to Firebase Storage
      if (_selectedVideo != null) {
        setState(() => _isUploadingVideo = true);
        try {
          debugPrint('HOME_STATUS: Uploading video...');
          videoUrl = await VideoUploadService.uploadVideo(
            File(_selectedVideo!.path),
            user.id,
          );

          // Generate and upload thumbnail
          videoThumbnailUrl =
              await VideoUploadService.generateAndUploadThumbnail(
            _selectedVideo!.path,
            user.id,
          );

          videoDurationMs = _videoDurationMs;
          debugPrint('HOME_STATUS: Video uploaded: $videoUrl');
        } catch (e) {
          debugPrint('HOME_STATUS: Video upload failed: $e');
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Video upload failed: $e'),
                backgroundColor: Colors.red,
              ),
            );
          }
          setState(() => _isUploadingVideo = false);
          return;
        }
        setState(() => _isUploadingVideo = false);
      }

      // Update local status display
      await checkInState.setMyStatus(status,
          userName: user.name, photoUrl: user.photoUrl);

      // Also create status in backend API (with scheduled time if set)
      await ApiService.createStatus(
        status,
        imageUrl: imageUrl,
        scheduledAt: _scheduledTime,
        videoUrl: videoUrl,
        videoThumbnailUrl: videoThumbnailUrl,
        videoDurationMs: videoDurationMs,
      );

      if (mounted) {
        debugPrint(
            'ONBOARDING: _submitStatus completed, _scheduledTime=$_scheduledTime');
        String message = 'Status updated!';
        if (_scheduledTime != null) {
          message = 'Game scheduled!';
          // Complete onboarding item
          debugPrint('ONBOARDING: Triggering schedule_run completion');
          context
              .read<OnboardingChecklistState>()
              .completeItem(OnboardingItems.scheduleRun);
        } else if (_selectedVideo != null) {
          message = 'Video posted!';
        } else if (_selectedImage != null) {
          message = 'Post with photo shared!';
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message)),
        );
        _statusController.clear();
        setState(() {
          _selectedImage = null;
          _selectedVideo = null;
          _videoDurationMs = null;
          _scheduledTime = null; // Clear scheduled time after posting
          _isRecurring = false;
        });
        // Unfocus keyboard
        FocusScope.of(context).unfocus();
      }
    }
  }

  Future<void> _pickImage() async {
    final XFile? image = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 60,
    );
    if (image != null) {
      setState(() => _selectedImage = image);
    }
  }

  Future<void> _takePhoto() async {
    final XFile? photo = await _imagePicker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 85,
    );
    if (photo != null) {
      setState(() => _selectedImage = photo);
    }
  }

  Future<void> _pickVideo() async {
    final XFile? video = await _imagePicker.pickVideo(
      source: ImageSource.gallery,
      maxDuration: const Duration(seconds: 30),
    );

    if (video != null) {
      // Validate duration
      final controller = VideoPlayerController.file(File(video.path));
      try {
        await controller.initialize();
        final duration = controller.value.duration;
        final durationMs = duration.inMilliseconds;

        if (!VideoUploadService.isValidDuration(durationMs)) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                    'Video must be 30 seconds or less. Please trim it first.'),
                backgroundColor: Colors.red,
              ),
            );
          }
          return;
        }

        setState(() {
          _selectedVideo = video;
          _videoDurationMs = durationMs;
          _selectedImage = null; // Clear image if selecting video
        });
      } finally {
        controller.dispose();
      }
    }
  }

  // Court tagging: detect @ pattern and search courts
  void _onStatusTextChanged() {
    final text = _statusController.text;
    final cursorPos = _statusController.selection.baseOffset;

    debugPrint('STATUS_TAG: text="$text" cursor=$cursorPos');

    if (cursorPos < 0 || cursorPos > text.length) {
      setState(() {
        _showCourtSuggestions = false;
        _courtSuggestions = [];
      });
      return;
    }

    // Find last @ before cursor
    final textBeforeCursor = text.substring(0, cursorPos);
    final lastAtIndex = textBeforeCursor.lastIndexOf('@');

    debugPrint(
        'STATUS_TAG: textBeforeCursor="$textBeforeCursor" lastAtIndex=$lastAtIndex');

    if (lastAtIndex >= 0) {
      final query = textBeforeCursor.substring(lastAtIndex + 1);
      debugPrint('STATUS_TAG: query="$query"');
      // Check if query contains space (means tag is complete) or is empty
      if (!query.contains(' ') && query.isNotEmpty) {
        _searchCourtsForTag(query);
        return;
      }
    }

    setState(() {
      _showCourtSuggestions = false;
      _courtSuggestions = [];
    });
  }

  Future<void> _searchCourtsForTag(String query) async {
    // Ensure courts are loaded before searching
    debugPrint(
        'STATUS_TAG: isLoaded=${CourtService().isLoaded} courts=${CourtService().courts.length}');
    await CourtService().loadCourts();
    final courts = CourtService().courts;
    debugPrint(
        'STATUS_TAG: after loadCourts isLoaded=${CourtService().isLoaded} courts=${courts.length}');
    final results = CourtService().searchCourts(query).take(5).toList();
    debugPrint('STATUS_TAG: found ${results.length} results');
    if (mounted) {
      setState(() {
        _courtSuggestions = results;
        _showCourtSuggestions = results.isNotEmpty;
      });
    }
  }

  void _selectCourt(Court court) {
    final text = _statusController.text;
    final cursorPos = _statusController.selection.baseOffset;
    final textBeforeCursor = text.substring(0, cursorPos);
    final lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      final textAfterCursor =
          cursorPos < text.length ? text.substring(cursorPos) : '';
      final newText =
          text.substring(0, lastAtIndex) + '@${court.name} ' + textAfterCursor;
      _statusController.text = newText;
      _statusController.selection =
          TextSelection.collapsed(offset: lastAtIndex + court.name.length + 2);
      _taggedCourt = court;
    }

    setState(() {
      _showCourtSuggestions = false;
      _courtSuggestions = [];
    });
  }

  // Game scheduling: show compact schedule sheet with date/time/recurring
  Future<void> _showScheduleSheet() async {
    DateTime tempDate =
        _scheduledTime ?? DateTime.now().add(const Duration(hours: 1));
    TimeOfDay tempTime = TimeOfDay.fromDateTime(tempDate);
    bool tempRecurring = _isRecurring;
    String tempRecurrenceType = _recurrenceType;

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Schedule Game',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              // Date & Time row
              Row(
                children: [
                  // Date picker
                  Expanded(
                    child: GestureDetector(
                      onTap: () async {
                        final date = await showDatePicker(
                          context: context,
                          initialDate: tempDate,
                          firstDate: DateTime.now(),
                          lastDate:
                              DateTime.now().add(const Duration(days: 90)),
                          builder: (ctx, child) => Theme(
                              data: ThemeData.dark().copyWith(
                                  colorScheme: const ColorScheme.dark(
                                      primary: Colors.deepOrange)),
                              child: child!),
                        );
                        if (date != null)
                          setSheetState(() => tempDate = DateTime(
                              date.year,
                              date.month,
                              date.day,
                              tempTime.hour,
                              tempTime.minute));
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 14),
                        decoration: BoxDecoration(
                            color: Colors.grey[800],
                            borderRadius: BorderRadius.circular(8)),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today,
                                color: Colors.deepOrange, size: 18),
                            const SizedBox(width: 8),
                            Text(
                                '${tempDate.month}/${tempDate.day}/${tempDate.year}',
                                style: const TextStyle(color: Colors.white)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Time picker
                  Expanded(
                    child: GestureDetector(
                      onTap: () async {
                        final time = await showTimePicker(
                          context: context,
                          initialTime: tempTime,
                          builder: (ctx, child) => Theme(
                              data: ThemeData.dark().copyWith(
                                  colorScheme: const ColorScheme.dark(
                                      primary: Colors.deepOrange)),
                              child: child!),
                        );
                        if (time != null) setSheetState(() => tempTime = time);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 14),
                        decoration: BoxDecoration(
                            color: Colors.grey[800],
                            borderRadius: BorderRadius.circular(8)),
                        child: Row(
                          children: [
                            const Icon(Icons.access_time,
                                color: Colors.deepOrange, size: 18),
                            const SizedBox(width: 8),
                            Text(tempTime.format(context),
                                style: const TextStyle(color: Colors.white)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Recurring toggle
              Row(
                children: [
                  const Text('Recurring',
                      style: TextStyle(color: Colors.white)),
                  const Spacer(),
                  Switch(
                    value: tempRecurring,
                    activeColor: Colors.deepOrange,
                    onChanged: (v) => setSheetState(() => tempRecurring = v),
                  ),
                ],
              ),
              if (tempRecurring) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () =>
                            setSheetState(() => tempRecurrenceType = 'weekly'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: tempRecurrenceType == 'weekly'
                                ? Colors.deepOrange
                                : Colors.grey[800],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Center(
                              child: Text('Weekly',
                                  style: TextStyle(color: Colors.white))),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GestureDetector(
                        onTap: () =>
                            setSheetState(() => tempRecurrenceType = 'daily'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: tempRecurrenceType == 'daily'
                                ? Colors.deepOrange
                                : Colors.grey[800],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Center(
                              child: Text('Daily',
                                  style: TextStyle(color: Colors.white))),
                        ),
                      ),
                    ),
                  ],
                ),
                Text('Creates up to 10 scheduled events',
                    style: TextStyle(color: Colors.grey[500], fontSize: 12)),
              ],
              const SizedBox(height: 20),
              // Confirm button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context, {
                    'date': DateTime(tempDate.year, tempDate.month,
                        tempDate.day, tempTime.hour, tempTime.minute),
                    'isRecurring': tempRecurring,
                    'recurrenceType': tempRecurrenceType,
                  }),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.deepOrange,
                      padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: const Text('Schedule'),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (result != null && mounted) {
      setState(() {
        _scheduledTime = result['date'];
        _isRecurring = result['isRecurring'] ?? false;
        _recurrenceType = result['recurrenceType'] ?? 'weekly';
      });
    }
  }

  String _formatScheduledTime() {
    if (_scheduledTime == null) return '';
    final now = DateTime.now();
    final timeStr = TimeOfDay.fromDateTime(_scheduledTime!).format(context);
    String dateStr;
    if (_scheduledTime!.day == now.day && _scheduledTime!.month == now.month) {
      dateStr = 'Today';
    } else if (_scheduledTime!.day == now.day + 1 &&
        _scheduledTime!.month == now.month) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = '${_scheduledTime!.month}/${_scheduledTime!.day}';
    }
    String result = '$dateStr $timeStr';
    if (_isRecurring)
      result += ' (${_recurrenceType == 'weekly' ? 'Weekly' : 'Daily'})';
    return result;
  }

  Future<void> _loadCurrentRating() async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      final userData = await ApiService.getProfile(userId);
      if (userData != null && mounted) {
        setState(() {
          _currentRating = (userData['rating'] is num)
              ? (userData['rating'] as num).toDouble()
              : double.tryParse(userData['rating']?.toString() ?? '') ?? 3.0;
        });
      }
    } catch (e) {
      debugPrint('Error loading current rating: $e');
    }
  }

  Future<void> _loadMyTeams() async {
    try {
      final teams = await ApiService.getMyTeams();
      if (mounted) {
        setState(() => _myTeams = teams);
      }
    } catch (e) {
      debugPrint('Error loading teams: $e');
    }
  }

  Future<void> _loadTeamInvites() async {
    try {
      final invites = await ApiService.getTeamInvites();
      if (mounted) {
        setState(() => _teamInvites = invites);
      }
    } catch (e) {
      debugPrint('Error loading team invites: $e');
    }
  }

  Future<void> _loadTeamChallenges() async {
    try {
      debugPrint('Loading team challenges for user: ${ApiService.userId}');
      final challenges = await ApiService.getTeamChallenges();
      debugPrint('Team challenges received: ${challenges.length}');
      debugPrint('Team challenges data: $challenges');
      if (mounted) {
        setState(() => _teamChallenges = challenges);
      }
    } catch (e) {
      debugPrint('Error loading team challenges: $e');
    }
  }

  bool _isValidShareTarget(String? value) {
    if (value == null) return false;
    final trimmed = value.trim();
    if (trimmed.isEmpty) return false;
    final parsed = Uri.tryParse(trimmed);
    if (parsed == null) return false;
    if (parsed.scheme == 'hooprank') return true;
    return parsed.hasScheme && parsed.hasAuthority;
  }

  String _resolveShareUrl(Map<String, dynamic>? invite) {
    final appUrl = invite?['appUrl']?.toString().trim();
    final joinUrl = invite?['joinUrl']?.toString().trim();

    if (_isValidShareTarget(appUrl)) return appUrl!;
    if (_isValidShareTarget(joinUrl)) return joinUrl!;
    return AppConfig.appStoreUrl.toString();
  }

  Widget _buildQuickPlayActionRow() {
    return AnimatedBuilder(
      animation: _quickPlayPulse,
      child: _buildQuickPlayActionContent(),
      builder: (context, child) {
        final pulse = _quickPlayPulse.value;
        final borderColor = Color.lerp(
              const Color(0xFFF97316),
              const Color(0xFF2DD4BF),
              pulse,
            ) ??
            const Color(0xFFF97316);
        return Container(
          margin: EdgeInsets.zero,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: borderColor.withValues(alpha: 0.24 + (pulse * 0.16)),
                blurRadius: 18 + (pulse * 10),
                spreadRadius: 0.8 + (pulse * 0.8),
                offset: const Offset(0, 6),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 14,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFF1F2937),
                  Color(0xFF111827),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: borderColor.withValues(alpha: 0.9),
                width: 1.4 + (pulse * 0.6),
              ),
            ),
            child: child,
          ),
        );
      },
    );
  }

  Widget _buildQuickPlayActionContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Text(
              'Quick Play',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            Spacer(),
            Icon(Icons.flash_on_rounded, size: 16),
          ],
        ),
        const SizedBox(height: 2),
        const Text(
          'Challenge an opponent and start a match instantly.',
          style: TextStyle(color: Colors.white, fontSize: 12),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => context.push('/quick-play'),
                icon: const Icon(Icons.flash_on, size: 16),
                label: const Text('Start'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFFC2410C),
                  minimumSize: const Size.fromHeight(36),
                  textStyle: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => context.push('/quick-play/scan'),
                icon: const Icon(Icons.qr_code_scanner, size: 16),
                label: const Text('Scan Match'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white70, width: 1.1),
                  minimumSize: const Size.fromHeight(36),
                  textStyle: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _firstNameOrFallback(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return 'They';
    return trimmed.split(RegExp(r'\s+')).first;
  }

  Future<bool> _doesPlayerFollowCourt({
    required String playerId,
    required String courtId,
  }) async {
    try {
      final followers = await ApiService.getCourtFollowers(courtId, limit: 200);
      return followers.any((follower) => follower.id == playerId);
    } catch (e) {
      debugPrint(
          'PRIMARY_ACTION: failed to load court followers for rationale: $e');
      return false;
    }
  }

  Future<String?> _buildSuggestedVenueRationale({
    required Court court,
    required User player,
    required CheckInState checkInState,
    required bool matchedPlayerCity,
  }) async {
    final userCheckedIn = checkInState.userCheckedInCourts.contains(court.id);
    final userFollows = checkInState.followedCourts.contains(court.id);
    final playerFollows = await _doesPlayerFollowCourt(
      playerId: player.id,
      courtId: court.id,
    );

    if (userCheckedIn && playerFollows) {
      final firstName = _firstNameOrFallback(player.name);
      return 'You recently checked in here, and $firstName follows this court.';
    }

    if (userFollows && playerFollows) {
      return 'Both of you follow this court.';
    }

    if (userCheckedIn) {
      return 'You recently checked in here.';
    }

    if (matchedPlayerCity &&
        player.city != null &&
        player.city!.trim().isNotEmpty) {
      if (userFollows) {
        return 'Near ${player.city} and in your followed courts.';
      }
      return 'Near ${player.city}.';
    }

    if (userFollows) {
      return 'From courts you follow.';
    }

    if (playerFollows) {
      final firstName = _firstNameOrFallback(player.name);
      return '$firstName follows this court.';
    }

    return null;
  }

  Future<({String? id, String? name, String? rationale})>
      _resolveSuggestedVenue(User player) async {
    final checkInState = context.read<CheckInState>();
    final courtService = CourtService();
    await courtService.loadCourts();

    Court? _courtById(String id) => courtService.getCourtById(id);

    for (final courtId in checkInState.userCheckedInCourts) {
      final court = _courtById(courtId);
      if (court != null) {
        final rationale = await _buildSuggestedVenueRationale(
          court: court,
          player: player,
          checkInState: checkInState,
          matchedPlayerCity: false,
        );
        return (id: court.id, name: court.name, rationale: rationale);
      }
    }

    final followedCourtIds = checkInState.followedCourts.toList();
    if (followedCourtIds.isNotEmpty) {
      final city = player.city?.trim();
      if (city != null && city.isNotEmpty) {
        final cityLower = city.toLowerCase();
        Court? cityMatch;
        int cityMatchFollowers = -1;
        for (final courtId in followedCourtIds) {
          final court = _courtById(courtId);
          if (court == null) continue;
          final haystack = '${court.name} ${court.address ?? ''}'.toLowerCase();
          if (!haystack.contains(cityLower)) continue;

          final followerCount = checkInState.getFollowerCount(courtId);
          if (cityMatch == null || followerCount > cityMatchFollowers) {
            cityMatch = court;
            cityMatchFollowers = followerCount;
          }
        }
        if (cityMatch != null) {
          final rationale = await _buildSuggestedVenueRationale(
            court: cityMatch,
            player: player,
            checkInState: checkInState,
            matchedPlayerCity: true,
          );
          return (id: cityMatch.id, name: cityMatch.name, rationale: rationale);
        }
      }

      for (final courtId in followedCourtIds) {
        final court = _courtById(courtId);
        if (court != null) {
          final rationale = await _buildSuggestedVenueRationale(
            court: court,
            player: player,
            checkInState: checkInState,
            matchedPlayerCity: false,
          );
          return (id: court.id, name: court.name, rationale: rationale);
        }
      }
    }

    final cityFallback = player.city?.trim();
    if (cityFallback != null && cityFallback.isNotEmpty) {
      return (
        id: null,
        name: 'Any court in $cityFallback',
        rationale: 'Suggested for proximity to $cityFallback.'
      );
    }
    return (id: null, name: null, rationale: null);
  }

  Future<void> _recomputePrimaryActionFromCandidates() async {
    if (_primarySuggestionSkippedThisSession) {
      if (!mounted) return;
      setState(() {
        _recommendedMatchup = null;
        _primaryActionState = HomePrimaryActionState.inviteFallback;
      });
      return;
    }

    final authUser = context.read<AuthState>().currentUser;
    if (authUser == null) {
      if (!mounted) return;
      setState(() {
        _recommendedMatchup = null;
        _primaryActionState = HomePrimaryActionState.inviteFallback;
      });
      return;
    }

    final candidatePool = _primaryActionCandidates
        .where((user) => !_skippedSuggestedMatchupIds.contains(user.id))
        .toList();

    final recommended = RecommendedMatchupEngine.pickBest(
      currentUser: authUser,
      candidates: candidatePool,
      discoverMode: _primaryDiscoverMode,
      searchRadiusMiles: _primaryDiscoverRadiusMi,
    );

    RecommendedMatchup? enriched = recommended;
    if (recommended != null) {
      final venue = await _resolveSuggestedVenue(recommended.player);
      enriched = recommended.copyWith(
        suggestedVenueId: venue.id,
        suggestedVenueName: venue.name,
        suggestedVenueRationale: venue.rationale,
      );
    }

    if (!mounted) return;
    if (_primarySuggestionSkippedThisSession) {
      setState(() {
        _recommendedMatchup = null;
        _primaryActionState = HomePrimaryActionState.inviteFallback;
      });
      return;
    }
    setState(() {
      _recommendedMatchup = enriched;
      _primaryActionState = enriched == null
          ? HomePrimaryActionState.inviteFallback
          : HomePrimaryActionState.recommended;
    });
  }

  Future<void> _loadPrimaryAction() async {
    if (!mounted) return;

    final authUser = context.read<AuthState>().currentUser;
    if (authUser == null) {
      if (mounted) {
        setState(() {
          _recommendedMatchup = null;
          _primaryActionCandidates = [];
          _skippedSuggestedMatchupIds.clear();
          _loadedSkippedMatchupsUserId = null;
          _primarySuggestionSkippedThisSession = false;
          _primaryActionState = HomePrimaryActionState.inviteFallback;
        });
      }
      return;
    }

    await _loadSkippedSuggestedMatchupsForUser(authUser.id);

    if (_primarySuggestionSkippedThisSession) {
      setState(() {
        _recommendedMatchup = null;
        _primaryActionState = HomePrimaryActionState.inviteFallback;
      });
      return;
    }

    setState(() => _primaryActionState = HomePrimaryActionState.loading);

    try {
      final privacy = await ApiService.getPrivacySettings();
      final discoverMode =
          (privacy['discoverMode']?.toString() ?? 'open').toLowerCase();
      final discoverRadiusMi = (() {
        final value = privacy['discoverRadiusMi'];
        if (value is num) return value.toDouble();
        return double.tryParse(value?.toString() ?? '') ?? 25.0;
      })();
      final position = await LocationService.getCurrentLocation();

      final nearby = await ApiService.getNearbyPlayers(
        radiusMiles: discoverRadiusMi.round().clamp(1, 100),
        lat: position?.latitude,
        lng: position?.longitude,
      );

      if (!mounted) return;
      setState(() {
        _primaryActionCandidates = nearby;
        _primaryDiscoverMode = discoverMode;
        _primaryDiscoverRadiusMi = discoverRadiusMi;
      });
      await _recomputePrimaryActionFromCandidates();
    } catch (e) {
      debugPrint('PRIMARY_ACTION: Failed to load recommendation: $e');
      if (!mounted) return;
      setState(() {
        _recommendedMatchup = null;
        _primaryActionCandidates = [];
        _primaryActionState = HomePrimaryActionState.inviteFallback;
      });
    }
  }

  Future<void> _handleSkipSuggestion() async {
    if (_isPrimaryActionSubmitting) return;
    final current = _recommendedMatchup;
    if (current == null) return;
    _primarySuggestionSkippedThisSession = true;
    _skippedSuggestedMatchupIds.add(current.player.id);
    final authUserId = context.read<AuthState>().currentUser?.id;
    if (authUserId != null && authUserId.isNotEmpty) {
      await _persistSkippedSuggestedMatchupsForUser(authUserId);
    }
    if (mounted) {
      setState(() {
        _recommendedMatchup = null;
        _primaryActionState = HomePrimaryActionState.inviteFallback;
      });
    }
  }

  void _handleOpenSuggestedProfile() {
    final current = _recommendedMatchup;
    if (current == null) return;
    PlayerProfileSheet.showById(context, current.player.id);
  }

  void _handleOpenSuggestedVenue() {
    final venueId = _recommendedMatchup?.suggestedVenueId;
    if (venueId == null || venueId.isEmpty) return;
    context.go('/courts?courtId=${Uri.encodeComponent(venueId)}');
  }

  Future<void> _handlePrimaryChallenge() async {
    if (_isPrimaryActionSubmitting) return;
    final matchup = _recommendedMatchup;
    if (matchup == null) return;

    final note = await showChallengeComposerSheet(
      context: context,
      player: matchup.player,
      initialMessage: 'Want to run 1v1?',
    );
    if (!mounted || note == null) return;

    setState(() => _isPrimaryActionSubmitting = true);
    try {
      await ApiService.createChallenge(
        toUserId: matchup.player.id,
        message: note.isEmpty ? 'Want to run 1v1?' : note,
      );

      if (!mounted) return;
      context
          .read<OnboardingChecklistState>()
          .completeItem(OnboardingItems.challengePlayer);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Challenge sent to ${matchup.player.name}!')),
      );
      _loadChallenges();
      _loadPrimaryAction();
      ScaffoldWithNavBar.refreshBadge?.call();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send challenge: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isPrimaryActionSubmitting = false);
      }
    }
  }

  Future<void> _handleInviteFriends() async {
    if (_isPrimaryActionSubmitting) return;
    setState(() => _isPrimaryActionSubmitting = true);

    String shareUrl = AppConfig.appStoreUrl.toString();
    try {
      final invite = await ApiService.createInvite(ttlSeconds: 604800);
      shareUrl = _resolveShareUrl(invite);
    } catch (e) {
      debugPrint('PRIMARY_ACTION: invite API failed, using App Store URL: $e');
    }

    try {
      await SharePlus.instance.share(
        ShareParams(
          text: 'I want to play you 1v1 on HoopRank: $shareUrl',
          subject: 'Invite someone you want to play 1v1',
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open share sheet: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPrimaryActionSubmitting = false);
      }
    }
  }

  @override
  void dispose() {
    NotificationService.removeOnNotificationListener(_refreshAll);
    if (ScaffoldWithNavBar.refreshFeedTab == _refreshEmbeddedFeed) {
      ScaffoldWithNavBar.refreshFeedTab = null;
    }
    _quickPlayPulseController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    _statusController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh when app comes to foreground
    if (state == AppLifecycleState.resumed) {
      _loadCurrentRating(); // Refresh rating from API
      _loadChallenges();
      _loadPendingConfirmations();
      _loadLocalActivity();
      _loadPrimaryAction();
      _refreshEmbeddedFeed();
      CourtService().forceRefresh(); // Refresh court data from cloud
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Refresh all data when page is revisited (eg: navigating back to this tab)
    _refreshAll();
  }

  /// Refresh all data on the home screen
  Future<void> _refreshAll() async {
    _loadChallenges();
    _loadPendingConfirmations();
    _loadLocalActivity();
    _loadMyTeams();
    _loadTeamInvites();
    _loadTeamChallenges();
    _loadCurrentRating();
    _loadPrimaryAction();
    _refreshEmbeddedFeed();
  }

  void _refreshEmbeddedFeed() {
    if (!mounted) return;
    setState(() => _feedReloadVersion++);
  }

  Future<void> _loadChallenges() async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) {
      setState(() => _isLoadingChallenges = false);
      return;
    }

    try {
      final challenges = await _messagesService.getPendingChallenges(userId);
      if (mounted) {
        setState(() {
          _challenges = challenges;
          _isLoadingChallenges = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingChallenges = false);
      }
    }
  }

  Future<void> _loadPendingConfirmations() async {
    try {
      final confirmations = await ApiService.getPendingConfirmations();
      if (mounted) {
        setState(() => _pendingConfirmations = confirmations);
      }
    } catch (e) {}
  }

  Future<void> _loadLocalActivity() async {
    try {
      // Use global activity feed (3 most recent matches app-wide)
      final activity = await ApiService.getGlobalActivity(limit: 3);
      if (mounted) {
        setState(() {
          _localActivity = activity;
          _isLoadingActivity = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingActivity = false);
      }
    }
  }

  int? _parseScoreValue(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '');
  }

  Future<void> _adjustPendingScore(Map<String, dynamic> confirmation) async {
    final score =
        confirmation['score'] as Map<String, dynamic>? ?? <String, dynamic>{};
    final matchId = confirmation['matchId']?.toString();
    if (matchId == null || matchId.isEmpty) return;

    final myScoreCtrl = TextEditingController(
      text: (_parseScoreValue(score['me']) ?? '').toString(),
    );
    final opponentScoreCtrl = TextEditingController(
      text: (_parseScoreValue(score['opponent']) ?? '').toString(),
    );

    try {
      final adjusted = await showDialog<Map<String, int>>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: Colors.grey[900],
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Adjust Score'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: myScoreCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Your score'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: opponentScoreCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Opponent score'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final me = int.tryParse(myScoreCtrl.text.trim());
                final opponent = int.tryParse(opponentScoreCtrl.text.trim());
                if (me == null || opponent == null || me < 0 || opponent < 0) {
                  return;
                }
                Navigator.pop(ctx, {'me': me, 'opponent': opponent});
              },
              child: const Text('Submit'),
            ),
          ],
        ),
      );

      if (adjusted == null) return;
      final me = adjusted['me'];
      final opponent = adjusted['opponent'];
      if (me == null || opponent == null) return;

      // Re-submit score from this user. Backend flips submitter and waits for
      // the other participant to confirm, preserving the 2-phase workflow.
      await ApiService.submitScore(
        matchId: matchId,
        myScore: me,
        opponentScore: opponent,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Adjusted score submitted. Waiting for opponent confirmation.'),
        ),
      );
      _loadPendingConfirmations();
      _refreshEmbeddedFeed();
    } finally {
      myScoreCtrl.dispose();
      opponentScoreCtrl.dispose();
    }
  }

  Widget _buildPendingConfirmationsSection() {
    if (_pendingConfirmations.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Pending Score Confirmations',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        ..._pendingConfirmations.map((conf) {
          final score = conf['score'] as Map<String, dynamic>?;
          final opponentName = conf['opponentName'] ?? 'Opponent';
          final matchId = conf['matchId']?.toString() ?? '';
          final myScore = _parseScoreValue(score?['me']);
          final opponentScore = _parseScoreValue(score?['opponent']);

          return Card(
            color: Colors.blue.shade900.withOpacity(0.3),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.blue.shade700, width: 1),
            ),
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.scoreboard, color: Colors.blue),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '$opponentName submitted a score',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (myScore != null && opponentScore != null)
                    Text(
                      'Score: $myScore - $opponentScore',
                      style: const TextStyle(color: Colors.grey),
                    ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () async {
                            try {
                              await ApiService.confirmScore(matchId);
                              if (context.mounted) {
                                await Provider.of<AuthState>(context,
                                        listen: false)
                                    .refreshUser();
                              }
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text('Score confirmed!')),
                              );
                              _loadPendingConfirmations();
                              _loadLocalActivity();
                              _refreshEmbeddedFeed();
                              ScaffoldWithNavBar.refreshBadge?.call();
                            } catch (e) {
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Error: $e')),
                              );
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            foregroundColor: Colors.white,
                          ),
                          child: const Text('Confirm'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _adjustPendingScore(conf),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.blue[200],
                          ),
                          child: const Text('Adjust'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                backgroundColor: Colors.grey[900],
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                title: Row(
                                  children: [
                                    Icon(Icons.warning_amber_rounded,
                                        color: Colors.orange, size: 28),
                                    const SizedBox(width: 8),
                                    const Text('Contest Score?'),
                                  ],
                                ),
                                content: const Text(
                                  'Contest will void this score submission and notify the opponent.',
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(ctx, false),
                                    child: const Text('Cancel'),
                                  ),
                                  ElevatedButton(
                                    onPressed: () => Navigator.pop(ctx, true),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.red,
                                      foregroundColor: Colors.white,
                                    ),
                                    child: const Text('Contest'),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed != true) return;

                            try {
                              await ApiService.contestScore(matchId);
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text('Score contested')),
                              );
                              _loadPendingConfirmations();
                              _refreshEmbeddedFeed();
                              ScaffoldWithNavBar.refreshBadge?.call();
                            } catch (e) {
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Error: $e')),
                              );
                            }
                          },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.red,
                          ),
                          child: const Text('Contest'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Future<void> _updateLocation() async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      final position = await LocationService.getCurrentLocation();
      if (position != null) {
        await ApiService.updateProfile(userId, {
          'lat': position.latitude,
          'lng': position.longitude,
          'locEnabled': true,
        });
      }
    } catch (e) {}
  }

  String _getRankLabel(double rating) {
    if (rating >= 5.0) return 'Legend';
    if (rating >= 4.5) return 'Elite';
    if (rating >= 4.0) return 'Pro';
    if (rating >= 3.5) return 'All-Star';
    if (rating >= 3.0) return 'Starter';
    if (rating >= 2.5) return 'Bench';
    if (rating >= 2.0) return 'Rookie';
    return 'Newcomer';
  }

  Widget _buildRatingChip({
    required String label,
    required double rating,
    required Color color,
    String? teamName,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              label,
              style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5),
            ),
          ),
          Expanded(
              child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                rating.toStringAsFixed(2),
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              // Use Opacity to preserve layout space even if teamName is null
              Opacity(
                opacity: teamName != null ? 1.0 : 0.0,
                child: Text(
                  teamName ?? 'Placeholder',
                  style: const TextStyle(color: Colors.white54, fontSize: 10),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          )),
        ],
      ),
    );
  }

  /// Build a team slot for 3v3 or 5v5 - shows rating if user has team, or "Find a Team" if not
  Widget _buildTeamSlot(String teamType, Color color) {
    // Find user's team of this type
    final team = _myTeams.firstWhere(
      (t) => t['teamType'] == teamType,
      orElse: () => <String, dynamic>{},
    );

    final hasTeam = team.isNotEmpty;
    // Parse rating safely - backend may return String or num
    final rv = team['rating'];
    final rating = hasTeam
        ? (rv is num
            ? rv.toDouble()
            : (double.tryParse(rv?.toString() ?? '') ?? 3.0))
        : 0.0;
    final teamName = hasTeam ? (team['name'] ?? teamType) : null;

    return GestureDetector(
      onTap: () {
        if (!hasTeam) {
          // Navigate to Teams tab to find/create a team
          context.go('/teams');
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: hasTeam
                  ? Colors.white.withOpacity(0.1)
                  : Colors.white.withOpacity(0.05)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                teamType,
                style: TextStyle(
                    color: color,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5),
              ),
            ),
            Expanded(
                child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (hasTeam) ...[
                  Text(
                    rating.toStringAsFixed(2),
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    teamName!,
                    style: const TextStyle(color: Colors.white54, fontSize: 10),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    textAlign: TextAlign.center,
                  ),
                ] else ...[
                  const Icon(Icons.add_circle_outline,
                      color: Colors.white30, size: 24),
                  const SizedBox(height: 4),
                  const Text(
                    'JOIN',
                    style: TextStyle(
                        color: Colors.white30,
                        fontSize: 10,
                        fontWeight: FontWeight.bold),
                  ),
                ],
              ],
            )),
          ],
        ),
      ),
    );
  }

  void _showStartGameModeDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Select Game Mode',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),
              // 1v1 - individual matches
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.deepOrange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.person, color: Colors.deepOrange),
                ),
                title: const Text('1v1',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Find local players to challenge'),
                onTap: () {
                  Navigator.pop(ctx);
                  // Navigate to Rankings page with local filter - user picks player to challenge there
                  context.go('/rankings');
                },
              ),
              const Divider(),
              // 3v3 - team matches
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.groups, color: Colors.blue),
                ),
                title: const Text('3v3',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Find 3v3 teams to challenge'),
                onTap: () {
                  Navigator.pop(ctx);
                  // Navigate to Rankings -> Teams tab with 3v3 filter
                  context.go('/rankings?tab=teams&teamType=3v3');
                },
              ),
              const Divider(),
              // 5v5 - team matches
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.groups, color: Colors.purple),
                ),
                title: const Text('5v5',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Find 5v5 teams to challenge'),
                onTap: () {
                  Navigator.pop(ctx);
                  // Navigate to Rankings -> Teams tab with 5v5 filter
                  context.go('/rankings?tab=teams&teamType=5v5');
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  bool _has3v3Team() => _myTeams.any((t) => t['teamType'] == '3v3');
  bool _has5v5Team() => _myTeams.any((t) => t['teamType'] == '5v5');

  void _showStatusUpdateDialog(
      BuildContext context, CheckInState checkInState) {
    final user = Provider.of<AuthState>(context, listen: false).currentUser;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatusComposerSheet(
        checkInState: checkInState,
        userName: user?.name ?? 'Unknown',
        userPhotoUrl: user?.photoUrl,
        initialStatus: checkInState.getMyStatus(),
      ),
    );
  }

  void _showQuickChallengeSheet(
      BuildContext context, String playerId, String playerName) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Challenge $playerName',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Send a 1v1 challenge request',
              style: TextStyle(color: Colors.grey[400], fontSize: 13),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  // Navigate to match flow
                  context.go('/play');
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Challenge sent to $playerName!')),
                  );
                },
                icon: const Icon(Icons.sports_basketball),
                label: const Text('Send 1v1 Challenge'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.grey[400],
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _showTeamChallengeFlow(String teamType) {
    final myTeam = _myTeams.firstWhere(
      (t) => t['teamType'] == teamType,
      orElse: () => <String, dynamic>{},
    );

    if (myTeam.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('You need to join a $teamType team first')),
      );
      return;
    }

    // Navigate to team rankings to select opponent team
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) => TeamSelectionSheet(
          teamType: teamType,
          myTeamId: myTeam['id'],
          myTeamName: myTeam['name'] ?? 'My Team',
          onTeamSelected: (opponentTeam) async {
            Navigator.pop(context);
            try {
              await ApiService.challengeTeam(
                teamId: myTeam['id'],
                opponentTeamId: opponentTeam['id'],
              );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content:
                          Text('Challenge sent to ${opponentTeam['name']}!')),
                );
              }
            } catch (e) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to send challenge: $e')),
                );
              }
            }
          },
        ),
      ),
    );
  }

  void _showChallengeDialog(Map<String, dynamic> player) {
    final playerId = player['id'] as String?;
    final playerName = player['name'] ?? 'Player';
    final playerRating = (player['rating'] ?? 0).toDouble();

    if (playerId == null) return;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.grey[900],
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Challenge $playerName?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 40,
              backgroundImage: player['avatarUrl'] != null
                  ? safeImageProvider(player['avatarUrl'])
                  : null,
              child: player['avatarUrl'] == null
                  ? Text(playerName[0].toUpperCase(),
                      style: const TextStyle(fontSize: 24))
                  : null,
            ),
            const SizedBox(height: 12),
            Text('⭐ ${playerRating.toStringAsFixed(1)}',
                style: const TextStyle(color: Colors.grey)),
            if (player['city'] != null)
              Text('📍 ${player['city']}',
                  style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              // Send challenge to this player
              try {
                await ApiService.createChallenge(
                    toUserId: playerId, message: 'Want to play?');
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Challenge sent to $playerName!')),
                  );
                  _loadChallenges();
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
            ),
            child: const Text('Challenge'),
          ),
        ],
      ),
    );
  }

  Widget _buildChallengeBadge(ChallengeRequest challenge) {
    final isSent = challenge.isSent;
    final status = challenge.message.challengeStatus ?? 'pending';

    // Determine colors based on direction and status
    Color bgColor;
    Color borderColor;
    Color iconColor;
    IconData? icon;
    String? label;

    if (isSent) {
      // Sent challenges show status
      switch (status) {
        case 'accepted':
          bgColor = Colors.green.shade100;
          borderColor = Colors.green;
          iconColor = Colors.green.shade800;
          icon = Icons.check_circle;
          break;
        case 'declined':
          bgColor = Colors.red.shade100;
          borderColor = Colors.red;
          iconColor = Colors.red.shade800;
          icon = Icons.cancel;
          break;
        case 'expired':
          bgColor = Colors.grey.shade200;
          borderColor = Colors.grey;
          iconColor = Colors.grey.shade700;
          icon = Icons.timer_off;
          break;
        default: // pending
          bgColor = Colors.blue.shade100;
          borderColor = Colors.blue;
          iconColor = Colors.blue.shade800;
          icon = Icons.hourglass_empty;
      }
    } else {
      // Received challenges (action needed)
      bgColor = Colors.orange.shade100;
      borderColor = Colors.orange;
      iconColor = Colors.deepOrange;
      label = 'CHALLENGE';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: label != null
          ? Text(label,
              style: TextStyle(
                  fontSize: 10, color: iconColor, fontWeight: FontWeight.bold))
          : Icon(icon, size: 16, color: iconColor),
    );
  }

  Widget _buildStatusIndicator(bool isSent, String status) {
    if (!isSent) {
      // Received challenge - show action needed indicator
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.deepOrange.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.deepOrange.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.sports_basketball,
                size: 14, color: Colors.deepOrange),
            const SizedBox(width: 4),
            const Text('NEW',
                style: TextStyle(
                    fontSize: 11,
                    color: Colors.deepOrange,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }

    // Sent challenge status
    IconData icon;
    Color color;

    switch (status) {
      case 'accepted':
        icon = Icons.check_circle_outline;
        color = Colors.green;
        break;
      case 'declined':
        icon = Icons.cancel_outlined;
        color = Colors.red;
        break;
      case 'expired':
        icon = Icons.timer_off_outlined;
        color = Colors.grey;
        break;
      default: // pending
        icon = Icons.schedule;
        color = Colors.blue;
    }

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 20, color: color),
    );
  }

  Future<void> _cancelChallenge(ChallengeRequest challenge) async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Challenge?'),
        content: Text('Cancel your challenge to ${challenge.otherUser.name}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _messagesService.cancelChallenge(userId, challenge.message.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Challenge cancelled')),
          );
          _loadChallenges();
          ScaffoldWithNavBar.refreshBadge?.call();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
  }

  Future<void> _declineChallenge(ChallengeRequest challenge) async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Decline Challenge?'),
        content:
            Text('Decline the challenge from ${challenge.otherUser.name}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Yes, Decline'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _messagesService.declineChallenge(userId, challenge.message.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(
                    'Declined challenge from ${challenge.otherUser.name}')),
          );
          _loadChallenges();
          ScaffoldWithNavBar.refreshBadge?.call();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
  }

  Future<void> _acceptChallenge(ChallengeRequest challenge) async {
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) return;

    try {
      // Accept the challenge and get the matchId from backend
      final result =
          await _messagesService.acceptChallenge(userId, challenge.message.id);
      final matchId = result['matchId'] as String?;

      if (!mounted) return;

      // Set up the opponent in MatchState
      final p = Player(
        id: challenge.otherUser.id,
        slug: challenge.otherUser.id,
        name: challenge.otherUser.name,
        team: challenge.otherUser.team ?? 'Free Agent',
        position: challenge.otherUser.position ?? 'G',
        age: 25,
        height: '6\'0"',
        weight: '180 lbs',
        rating: challenge.otherUser.rating,
        offense: 80,
        defense: 80,
        shooting: 80,
        passing: 80,
        rebounding: 80,
      );

      final matchState = context.read<MatchState>();
      matchState.setOpponent(p);
      if (matchId != null) {
        matchState.setMatchId(matchId);
      }
      context
          .read<OnboardingChecklistState>()
          .completeItem(OnboardingItems.acceptChallenge);

      // Refresh badge count now that challenge is accepted
      ScaffoldWithNavBar.refreshBadge?.call();

      // Navigate to match setup
      AnalyticsService.logChallengeAccepted(mode: '1v1');
      context.push('/match/setup');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error accepting challenge: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: RichText(
          text: TextSpan(
            style: GoogleFonts.teko(
              fontSize: 32, // Slightly larger
              fontWeight: FontWeight.bold,
              fontStyle: FontStyle.italic,
              letterSpacing: 1.2,
            ),
            children: [
              TextSpan(
                text: 'HOOP',
                style: TextStyle(
                  color: Colors.deepOrange,
                  shadows: [
                    Shadow(
                      color: Colors.black.withOpacity(0.5),
                      offset: const Offset(2, 2),
                      blurRadius: 4,
                    ),
                  ],
                ),
              ),
              TextSpan(
                text: 'RANK',
                style: TextStyle(
                  color: Colors.white,
                  shadows: [
                    Shadow(
                      color: Colors.black.withOpacity(0.5),
                      offset: const Offset(2, 2),
                      blurRadius: 4,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          // Profile avatar button with notification badge
          Consumer<AuthState>(
            builder: (context, auth, _) {
              final photoUrl = auth.currentUser?.photoUrl;
              // TODO: Replace with actual notification count from API
              final notificationCount =
                  0; // Placeholder - can be wired to real data
              return GestureDetector(
                onTap: () => context.push('/profile'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Stack(
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundImage: photoUrl != null
                            ? safeImageProvider(photoUrl)
                            : null,
                        child: photoUrl == null
                            ? const Icon(Icons.person, size: 18)
                            : null,
                      ),
                      // Notification badge
                      if (notificationCount > 0)
                        Positioned(
                          right: 0,
                          top: 0,
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              color: Colors.red,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 14,
                              minHeight: 14,
                            ),
                            child: Text(
                              notificationCount > 9
                                  ? '9+'
                                  : '$notificationCount',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.help_outline),
            tooltip: 'Show Checklist',
            onPressed: () => showOnboardingChecklistModal(context),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final auth = Provider.of<AuthState>(context, listen: false);
              await auth.logout();
              if (context.mounted) {
                context.go('/login');
              }
            },
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          _scheduleFeedAnchorMeasurement();
          final viewportHeight = constraints.maxHeight;
          final measuredCollapsedTop =
              _feedAnchorHeight > 0 ? _feedAnchorHeight : viewportHeight * 0.42;
          final collapsedTop = (measuredCollapsedTop + _feedPanelCollapsedGap)
              .clamp(
                _feedPanelExpandedTop + 200.0,
                viewportHeight - _feedPanelCollapsedVisibleHeight,
              )
              .toDouble();
          final panelTravel = collapsedTop - _feedPanelExpandedTop;
          final panelTop =
              collapsedTop - (panelTravel * _feedPanelProgress.clamp(0.0, 1.0));
          final reservedFeedSpace = (viewportHeight - collapsedTop).clamp(
            _feedPanelCollapsedVisibleHeight,
            viewportHeight,
          );

          return Stack(
            children: [
              SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    KeyedSubtree(
                      key: _feedAnchorKey,
                      child: _buildHomeTopContent(),
                    ),
                    SizedBox(height: reservedFeedSpace + 16),
                    _buildHomeSupplementalContent(),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
              AnimatedPositioned(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                left: 16,
                right: 16,
                top: panelTop,
                bottom: 0,
                child: _buildFeedPanel(panelTravel),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHomeTopContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 14),
        Consumer<AuthState>(
          builder: (context, auth, _) {
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 8),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.blue.withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.edit_note,
                          size: 14,
                          color: Colors.blue,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'STATUS',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () async {
                    final result = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const StatusComposerScreen(),
                        fullscreenDialog: true,
                      ),
                    );
                    if (result == true) {
                      setState(() {});
                    }
                  },
                  child: Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Consumer<AuthState>(
                          builder: (context, authState, _) {
                            final user = authState.currentUser;
                            final photoUrl = user?.photoUrl;
                            final name = user?.name ?? '?';

                            return CircleAvatar(
                              radius: 18,
                              backgroundColor: Colors.deepOrange,
                              backgroundImage: photoUrl != null &&
                                      !isPlaceholderImage(photoUrl)
                                  ? safeImageProvider(photoUrl)
                                  : null,
                              onBackgroundImageError: photoUrl != null
                                  ? (_, __) => debugPrint(
                                        'Status avatar failed to load: $photoUrl',
                                      )
                                  : null,
                              child: (photoUrl == null ||
                                      isPlaceholderImage(photoUrl))
                                  ? Text(
                                      name.isNotEmpty
                                          ? name[0].toUpperCase()
                                          : '?',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    )
                                  : null,
                            );
                          },
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'What\'s on your mind?',
                                style: TextStyle(
                                  color: Colors.grey.shade800,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Share a status, schedule a run, or post a highlight',
                                style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 11,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
        Consumer<OnboardingChecklistState>(
          builder: (context, onboarding, _) {
            return onboarding.shouldShow
                ? const OnboardingChecklistCard()
                : const SizedBox.shrink();
          },
        ),
        _buildQuickPlayActionRow(),
      ],
    );
  }

  Widget _buildHomeSupplementalContent() {
    if (_pendingConfirmations.isEmpty && _teamInvites.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_pendingConfirmations.isNotEmpty) ...[
          _buildPendingConfirmationsSection(),
          const SizedBox(height: 12),
        ],
        if (_teamInvites.isNotEmpty) ...[
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _teamInvites.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final invite = _teamInvites[index];
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.blue.withOpacity(0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.group_add, color: Colors.blue, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        invite['name'] ?? 'Team',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () async {
                          try {
                            await ApiService.declineTeamInvite(invite['id']);
                            _loadTeamInvites();
                          } catch (_) {}
                        },
                        child: const Icon(Icons.close,
                            color: Colors.red, size: 18),
                      ),
                      const SizedBox(width: 4),
                      GestureDetector(
                        onTap: () async {
                          try {
                            await ApiService.acceptTeamInvite(invite['id']);
                            _loadTeamInvites();
                            _loadMyTeams();
                            if (mounted) {
                              context
                                  .read<OnboardingChecklistState>()
                                  .completeItem(
                                    OnboardingItems.joinOrCreateTeam,
                                  );
                            }
                          } catch (_) {}
                        },
                        child: const Icon(
                          Icons.check,
                          color: Colors.green,
                          size: 18,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  Widget _buildFeedPanel(double availableTravel) {
    final isExpanded = _feedPanelProgress >= 0.5;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF13263A),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 18,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _toggleFeedPanel,
            onVerticalDragUpdate: (details) =>
                _updateFeedPanelProgress(availableTravel, details.delta.dy),
            onVerticalDragEnd: (_) => _snapFeedPanel(),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
              child: SizedBox(
                height: 38,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    IgnorePointer(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.22),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: Colors.deepOrange.withOpacity(0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.dynamic_feed,
                            size: 15,
                            color: Colors.deepOrange,
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'FEED',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                            color: Colors.white70,
                          ),
                        ),
                        const Spacer(),
                        Icon(
                          isExpanded
                              ? Icons.keyboard_arrow_down_rounded
                              : Icons.keyboard_arrow_up_rounded,
                          size: 28,
                          color: Colors.white70,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
              child: HoopRankFeed(
                key: ValueKey('hooprank-feed-$_feedReloadVersion'),
                featuredMatchup:
                    _primaryActionState == HomePrimaryActionState.recommended
                        ? _recommendedMatchup
                        : null,
                isFeaturedMatchupSubmitting: _isPrimaryActionSubmitting,
                onFeaturedMatchupChallengePressed: _handlePrimaryChallenge,
                onFeaturedMatchupProfilePressed: _handleOpenSuggestedProfile,
                onFeaturedMatchupVenuePressed: _handleOpenSuggestedVenue,
                onFeaturedMatchupSkipPressed: _handleSkipSuggestion,
                onRefreshFeaturedMatchup: _loadPrimaryAction,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

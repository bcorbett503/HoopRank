import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Represents a single step in the interactive tutorial
class TutorialStep {
  final String id;
  final String route; // Route to navigate to for this step
  final String targetKeyName; // Name of the GlobalKey to highlight
  final String title;
  final String description;
  final IconData icon;
  final Color color;
  final bool showContinueButton;

  const TutorialStep({
    required this.id,
    required this.route,
    required this.targetKeyName,
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
    this.showContinueButton = false,
  });
}

/// Global keys registry for tutorial targets
class TutorialKeys {
  static final Map<String, GlobalKey> _keys = {};

  static GlobalKey getKey(String name) {
    return _keys.putIfAbsent(
        name, () => GlobalKey(debugLabel: 'tutorial_$name'));
  }

  static GlobalKey? tryGetKey(String name) => _keys[name];

  // Predefined key names
  // Feed (first-login empty "Following" state)
  static const String feedCtaCourtsButton = 'feed_cta_courts_button';

  // Courts map/list
  static const String courtsTopCourtCard = 'courts_top_court_card';
  static const String courtsFindRunsButton = 'courts_find_runs_button';
  static const String courtsAllUpcomingMenuItem =
      'courts_all_upcoming_menu_item';

  // Court details sheet
  static const String courtFollowButton = 'court_follow_button';
  static const String courtFollowersCard = 'court_followers_card';
  static const String courtDragHandle = 'court_drag_handle';

  // Legacy keys (kept to avoid breaking existing references; no longer used by the new tutorial flow)
  static const String rankingsLocalChip = 'rankings_local_chip';
  static const String playerActionButtons = 'player_action_buttons';
  static const String navRankings = 'nav_rankings';
  static const String navCourts = 'nav_courts';
  static const String rankingsTab = 'rankings_tab';
}

/// Manages the interactive tutorial state
class TutorialState extends ChangeNotifier {
  static const String _prefKey = 'tutorial_complete';

  bool _isActive = false;
  int _currentStepIndex = 0;
  bool _tutorialComplete = false;
  bool _initialized = false;

  final List<TutorialStep> _steps = const [
    // Step 1: Feed -> tap Courts CTA (empty Following state)
    TutorialStep(
      id: 'feed_find_courts',
      route: '/play',
      targetKeyName: TutorialKeys.feedCtaCourtsButton,
      title: 'Find Courts Near You',
      description: 'Tap Courts to find courts near you.',
      icon: Icons.location_on,
      color: Colors.blue,
    ),
    // Step 2: Courts -> open a court (top list card)
    TutorialStep(
      id: 'courts_select_court',
      route: '/courts',
      targetKeyName: TutorialKeys.courtsTopCourtCard,
      title: 'Open a Court',
      description: 'Tap a court to view its court page.',
      icon: Icons.sports_basketball,
      color: Colors.deepOrange,
    ),
    // Step 3: Court page -> follow
    TutorialStep(
      id: 'court_follow',
      route: '/courts',
      targetKeyName: TutorialKeys.courtFollowButton,
      title: 'Follow This Court',
      description:
          'Tap the heart to follow the court and see who else plays here.',
      icon: Icons.favorite,
      color: Colors.red,
    ),
    // Step 4: Court page -> King explanation
    TutorialStep(
      id: 'court_king',
      route: '/courts',
      targetKeyName: TutorialKeys.courtFollowersCard,
      title: 'Meet the King',
      description:
          'The top ranked player who follows a court becomes the King of that court.',
      icon: Icons.emoji_events,
      color: Colors.amber,
    ),
    // Step 5: Court page -> swipe down to minimize
    TutorialStep(
      id: 'court_swipe_down',
      route: '/courts',
      targetKeyName: TutorialKeys.courtDragHandle,
      title: 'Back to the Map',
      description: 'Swipe down on the handle to minimize the court page.',
      icon: Icons.swipe_down,
      color: Colors.white,
    ),
    // Step 6: Courts -> open Find Runs
    TutorialStep(
      id: 'courts_open_find_runs',
      route: '/courts',
      targetKeyName: TutorialKeys.courtsFindRunsButton,
      title: 'Find Runs',
      description: 'Tap Find Runs to discover courts with scheduled runs.',
      icon: Icons.calendar_today,
      color: Colors.deepOrange,
    ),
    // Step 7: Courts -> choose All Upcoming
    TutorialStep(
      id: 'courts_select_all_upcoming',
      route: '/courts',
      targetKeyName: TutorialKeys.courtsAllUpcomingMenuItem,
      title: 'All Upcoming',
      description: 'Select All Upcoming to see upcoming runs.',
      icon: Icons.calendar_month,
      color: Colors.deepOrange,
    ),
    // Step 8: Courts -> open a court with a run
    TutorialStep(
      id: 'courts_open_run_court',
      route: '/courts',
      targetKeyName: TutorialKeys.courtsTopCourtCard,
      title: 'See Upcoming Events',
      description: 'Tap a court with a scheduled run to see upcoming events.',
      icon: Icons.event,
      color: Colors.green,
    ),
  ];

  // Getters
  bool get isActive => _isActive;
  bool get tutorialComplete => _tutorialComplete;
  int get currentStepIndex => _currentStepIndex;
  int get totalSteps => _steps.length;
  TutorialStep? get currentStep =>
      _isActive && _currentStepIndex < _steps.length
          ? _steps[_currentStepIndex]
          : null;
  bool get initialized => _initialized;

  /// Initialize tutorial state from preferences
  Future<void> initialize() async {
    if (_initialized) return;

    final prefs = await SharedPreferences.getInstance();
    _tutorialComplete = prefs.getBool(_prefKey) ?? false;
    _initialized = true;
    notifyListeners();
  }

  /// Start the tutorial (called after profile setup)
  void startTutorial() {
    if (_tutorialComplete) return;

    _isActive = true;
    _currentStepIndex = 0;
    notifyListeners();
  }

  /// Advance to the next step
  void nextStep() {
    if (!_isActive) return;

    if (_currentStepIndex < _steps.length - 1) {
      _currentStepIndex++;
      notifyListeners();
    } else {
      completeTutorial();
    }
  }

  /// Skip to a specific step (for when user naturally completes an action)
  void advanceToStep(String stepId) {
    if (!_isActive) return;

    final index = _steps.indexWhere((s) => s.id == stepId);
    if (index > _currentStepIndex) {
      _currentStepIndex = index;
      notifyListeners();
    }
  }

  /// Mark a step as completed and advance
  void completeStep(String stepId) {
    if (!_isActive) return;

    final currentId = currentStep?.id;
    if (currentId == stepId) {
      nextStep();
    }
  }

  /// Complete the tutorial
  Future<void> completeTutorial() async {
    _isActive = false;
    _tutorialComplete = true;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKey, true);

    notifyListeners();
  }

  /// Skip the tutorial
  Future<void> skipTutorial() async {
    await completeTutorial();
  }

  /// Reset the tutorial (for restart from help button)
  Future<void> resetTutorial() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKey, false);

    _tutorialComplete = false;
    _currentStepIndex = 0;
    _isActive = true;

    notifyListeners();
  }
}

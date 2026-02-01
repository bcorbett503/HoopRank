import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Represents a single step in the interactive tutorial
class TutorialStep {
  final String id;
  final String route;           // Route to navigate to for this step
  final String targetKeyName;   // Name of the GlobalKey to highlight
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
    return _keys.putIfAbsent(name, () => GlobalKey(debugLabel: 'tutorial_$name'));
  }
  
  static GlobalKey? tryGetKey(String name) => _keys[name];
  
  // Predefined key names
  static const String courtFollowButton = 'court_follow_button';
  static const String courtAlertBell = 'court_alert_bell';
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
    // Step 1: Follow a court
    TutorialStep(
      id: 'follow_court',
      route: '/courts',
      targetKeyName: TutorialKeys.courtFollowButton,
      title: 'Follow Your Courts',
      description: 'Tap the heart to follow this court and see who plays here!',
      icon: Icons.favorite_border,
      color: Colors.red,
    ),
    // Step 2: Enable notifications
    TutorialStep(
      id: 'enable_notifications',
      route: '/courts',
      targetKeyName: TutorialKeys.courtAlertBell,
      title: 'Get Notified',
      description: 'Tap the bell to receive alerts when players schedule runs here.',
      icon: Icons.notifications_active,
      color: Colors.amber,
    ),
    // Step 3: Go to Rankings
    TutorialStep(
      id: 'go_to_rankings',
      route: '/courts',
      targetKeyName: TutorialKeys.rankingsTab,
      title: 'Check the Rankings',
      description: 'Tap the Rankings tab to see who is leading the leaderboards.',
      icon: Icons.leaderboard,
      color: Colors.blue,
    ),
    // Step 4: Find local players
    TutorialStep(
      id: 'local_players',
      route: '/rankings',
      targetKeyName: TutorialKeys.rankingsLocalChip,
      title: 'Find Nearby Players',
      description: 'Tap "Local" to see players in your area.',
      icon: Icons.location_on,
      color: Colors.green,
    ),
    // Step 5: Player actions
    TutorialStep(
      id: 'player_actions',
      route: '/rankings',
      targetKeyName: TutorialKeys.playerActionButtons,
      title: 'Connect & Compete',
      description: 'Message players, send challenges, or follow them to track their games!',
      icon: Icons.sports_basketball,
      color: Colors.deepOrange,
      showContinueButton: true,
    ),
  ];
  
  // Getters
  bool get isActive => _isActive;
  bool get tutorialComplete => _tutorialComplete;
  int get currentStepIndex => _currentStepIndex;
  int get totalSteps => _steps.length;
  TutorialStep? get currentStep => 
      _isActive && _currentStepIndex < _steps.length ? _steps[_currentStepIndex] : null;
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

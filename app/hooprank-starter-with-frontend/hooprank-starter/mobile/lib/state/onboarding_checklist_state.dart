import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Keys for each onboarding checklist item.
class OnboardingItems {
  static const String followCourt = 'follow_court';
  static const String followPlayer = 'follow_player';
  static const String scheduleRun = 'schedule_run';
  static const String joinRun = 'join_run';
  static const String joinOrCreateTeam = 'join_or_create_team';
  static const String challengePlayer = 'challenge_player';

  static const List<String> all = [
    followCourt,
    followPlayer,
    scheduleRun,
    joinRun,
    joinOrCreateTeam,
    challengePlayer,
  ];
}

/// Manages the onboarding checklist state, replacing the old tutorial overlay.
///
/// Each of the 6 items is persisted individually via SharedPreferences so
/// progress survives app restarts. The widget shown on the home screen reads
/// this state to render checked/unchecked items.
class OnboardingChecklistState extends ChangeNotifier {
  static const String _prefPrefix = 'onboarding_';
  static const String _dismissedKey = 'onboarding_dismissed';

  final Map<String, bool> _completed = {};
  bool _dismissed = false;
  bool _initialized = false;

  // ── Getters ──

  bool get initialized => _initialized;

  /// True when the user has manually dismissed the checklist card.
  bool get dismissed => _dismissed;

  /// True when every item has been completed.
  bool get allComplete =>
      OnboardingItems.all.every((key) => _completed[key] == true);

  /// Number of completed items.
  int get completedCount =>
      OnboardingItems.all.where((key) => _completed[key] == true).length;

  /// Total number of items.
  int get totalCount => OnboardingItems.all.length;

  /// Whether a specific item is complete.
  bool isComplete(String key) => _completed[key] == true;

  /// Whether the checklist card should be visible.
  bool get shouldShow => _initialized && !_dismissed && !allComplete;

  // ── Lifecycle ──

  /// Load persisted state from SharedPreferences.
  Future<void> initialize() async {
    if (_initialized) return;

    final prefs = await SharedPreferences.getInstance();
    for (final key in OnboardingItems.all) {
      _completed[key] = prefs.getBool('$_prefPrefix$key') ?? false;
    }
    _dismissed = prefs.getBool(_dismissedKey) ?? false;
    _initialized = true;
    notifyListeners();
  }

  // ── Actions ──

  /// Mark a single item as complete and persist.
  Future<void> completeItem(String key) async {
    debugPrint('ONBOARDING: completeItem called for key=$key, already=${_completed[key]}');
    if (_completed[key] == true) return; // already done
    _completed[key] = true;
    debugPrint('ONBOARDING: ✅ Marked $key as complete');
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_prefPrefix$key', true);

    // Auto-dismiss when all items are complete (the widget will animate out).
    if (allComplete) {
      _dismissed = true;
      await prefs.setBool(_dismissedKey, true);
      notifyListeners();
    }
  }

  /// User manually collapses/hides the checklist.
  Future<void> dismiss() async {
    _dismissed = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_dismissedKey, true);
  }

  /// Reset all items (used by the "help" button to re-show the checklist).
  Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    for (final key in OnboardingItems.all) {
      _completed[key] = false;
      await prefs.setBool('$_prefPrefix$key', false);
    }
    _dismissed = false;
    await prefs.setBool(_dismissedKey, false);
    notifyListeners();
  }
}

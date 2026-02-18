import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

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

/// Manages the onboarding checklist state with dual persistence:
///   1. SharedPreferences — fast local reads, survives app restarts
///   2. Backend DB (users.onboarding_progress) — survives reinstalls, syncs across devices
///
/// On initialize(), the backend and local states are merged (union) so nothing
/// is lost if either side is ahead. On completeItem(), both stores are updated.
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
  /// Shows even when all items are complete — user must explicitly dismiss.
  bool get shouldShow => _initialized && !_dismissed;

  // ── Lifecycle ──

  /// Load persisted state from SharedPreferences + backend, merging both.
  Future<void> initialize() async {
    if (_initialized) return;

    // 1. Fast local read
    final prefs = await SharedPreferences.getInstance();
    for (final key in OnboardingItems.all) {
      _completed[key] = prefs.getBool('$_prefPrefix$key') ?? false;
    }
    _dismissed = prefs.getBool(_dismissedKey) ?? false;
    _initialized = true;
    notifyListeners();

    // 2. Async backend merge (non-blocking)
    try {
      final remote = await ApiService.getOnboardingProgress();
      if (remote.isNotEmpty) {
        bool changed = false;
        for (final key in OnboardingItems.all) {
          if (remote[key] == true && _completed[key] != true) {
            _completed[key] = true;
            await prefs.setBool('$_prefPrefix$key', true);
            changed = true;
          }
        }
        if (changed) {
          debugPrint('ONBOARDING: Merged ${remote.entries.where((e) => e.value).length} items from backend');
          notifyListeners();
        }

        // Push local state back if local has items the backend doesn't
        final localMap = <String, bool>{};
        for (final key in OnboardingItems.all) {
          if (_completed[key] == true) localMap[key] = true;
        }
        if (localMap.length > remote.entries.where((e) => e.value).length) {
          ApiService.updateOnboardingProgress(localMap);
        }
      }
    } catch (e) {
      debugPrint('ONBOARDING: Backend merge failed (offline?): $e');
    }
  }

  // ── Actions ──

  /// Mark a single item as complete and persist to both local + backend.
  Future<void> completeItem(String key) async {
    debugPrint('ONBOARDING: completeItem called for key=$key, already=${_completed[key]}');
    if (_completed[key] == true) return; // already done
    _completed[key] = true;
    debugPrint('ONBOARDING: ✅ Marked $key as complete');
    notifyListeners();

    // Persist locally
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_prefPrefix$key', true);

    // Persist to backend (fire-and-forget)
    final progressMap = <String, bool>{};
    for (final k in OnboardingItems.all) {
      if (_completed[k] == true) progressMap[k] = true;
    }
    ApiService.updateOnboardingProgress(progressMap);
  }

  /// User manually collapses/hides the checklist.
  Future<void> dismiss() async {
    _dismissed = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_dismissedKey, true);
  }

  /// Re-show the checklist (used by the ? help button).
  /// Does NOT reset progress — just un-dismisses.
  Future<void> undismiss() async {
    _dismissed = false;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_dismissedKey, false);
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

    // Reset backend too
    ApiService.updateOnboardingProgress({});
  }
}

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'appsflyer_service.dart';

/// Centralized analytics service for tracking key user events.
/// Wraps Firebase Analytics to provide type-safe event logging.
class AnalyticsService {
  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
  static String? _lastRouteScreenName;

  /// Navigator observer for GoRouter screen tracking across analytics providers.
  static NavigatorObserver get observer => _HoopRankAnalyticsObserver();

  // ==================== AUTH EVENTS ====================

  static Future<void> logLogin(
      {required String provider, required bool success}) async {
    try {
      await _analytics.logLogin(loginMethod: provider);
      await _analytics.logEvent(name: 'auth_attempt', parameters: {
        'provider': provider,
        'success': success.toString(),
      });
      await AppsFlyerService.logEvent('auth_attempt', {
        'provider': provider,
        'success': success,
      });
      if (success) {
        await AppsFlyerService.logEvent('af_login', {
          'af_registration_method': provider,
        });
      }
    } catch (e) {
      debugPrint('Analytics: Failed to log login: $e');
    }
  }

  static Future<void> logSignUp({required String provider}) async {
    try {
      await _analytics.logSignUp(signUpMethod: provider);
      await AppsFlyerService.logEvent('af_complete_registration', {
        'af_registration_method': provider,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log sign up: $e');
    }
  }

  static Future<void> logRegistrationCompletedOnce({
    required String userId,
    required String provider,
  }) async {
    final normalizedUserId = userId.trim();
    if (normalizedUserId.isEmpty) {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final key = 'analytics:registration_completed:$normalizedUserId';
    if (prefs.getBool(key) ?? false) {
      return;
    }

    await logSignUp(provider: provider);
    await prefs.setBool(key, true);
  }

  // ==================== COURT EVENTS ====================

  static Future<void> logCourtCheckIn(
      {required String courtId, String? city}) async {
    try {
      await _analytics.logEvent(name: 'court_check_in', parameters: {
        'court_id': courtId,
        if (city != null) 'city': city,
      });
      await AppsFlyerService.logEvent('court_check_in', {
        'court_id': courtId,
        if (city != null) 'city': city,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log check-in: $e');
    }
  }

  static Future<void> logCourtFollow({required String courtId}) async {
    try {
      await _analytics.logEvent(name: 'court_follow', parameters: {
        'court_id': courtId,
      });
      await AppsFlyerService.logEvent('court_follow', {
        'court_id': courtId,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log court follow: $e');
    }
  }

  // ==================== COMPETITIVE EVENTS ====================

  static Future<void> logChallengeSent({required String mode}) async {
    try {
      await _analytics.logEvent(name: 'challenge_sent', parameters: {
        'mode': mode, // '1v1', '3v3', '5v5'
      });
      await AppsFlyerService.logEvent('challenge_sent', {
        'mode': mode,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log challenge sent: $e');
    }
  }

  static Future<void> logChallengeAccepted({required String mode}) async {
    try {
      await _analytics.logEvent(name: 'challenge_accepted', parameters: {
        'mode': mode,
      });
      await AppsFlyerService.logEvent('challenge_accepted', {
        'mode': mode,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log challenge accepted: $e');
    }
  }

  static Future<void> logMatchCompleted({required String mode}) async {
    try {
      await _analytics.logEvent(name: 'match_completed', parameters: {
        'mode': mode,
      });
      await AppsFlyerService.logEvent('match_completed', {
        'mode': mode,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log match completed: $e');
    }
  }

  // ==================== SOCIAL EVENTS ====================

  static Future<void> logRunJoined({required String runId}) async {
    try {
      await _analytics.logEvent(name: 'run_joined', parameters: {
        'run_id': runId,
      });
      await AppsFlyerService.logEvent('run_joined', {
        'run_id': runId,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log run joined: $e');
    }
  }

  static Future<void> logStatusPosted() async {
    try {
      await _analytics.logEvent(name: 'status_posted');
      await AppsFlyerService.logEvent('status_posted', {});
    } catch (e) {
      debugPrint('Analytics: Failed to log status posted: $e');
    }
  }

  static Future<void> logMessageSent() async {
    try {
      await _analytics.logEvent(name: 'message_sent');
      await AppsFlyerService.logEvent('message_sent', {});
    } catch (e) {
      debugPrint('Analytics: Failed to log message sent: $e');
    }
  }

  static Future<void> logTeamCreated({required String teamType}) async {
    try {
      await _analytics.logEvent(name: 'team_created', parameters: {
        'team_type': teamType,
      });
      await AppsFlyerService.logEvent('team_created', {
        'team_type': teamType,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log team created: $e');
    }
  }

  static Future<void> logInviteSent({required String channel}) async {
    try {
      await _analytics.logEvent(name: 'invite_sent', parameters: {
        'channel': channel,
      });
      await AppsFlyerService.logEvent('af_invite', {
        'af_description': 'friend_invite',
        'channel': channel,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log invite sent: $e');
    }
  }

  static Future<void> logTutorialCompletion({
    required String tutorialId,
    required bool success,
    String? content,
  }) async {
    try {
      await _analytics.logEvent(name: 'tutorial_completion', parameters: {
        'tutorial_id': tutorialId,
        'success': success.toString(),
        if (content != null) 'content': content,
      });
      await AppsFlyerService.logEvent('af_tutorial_completion', {
        'af_tutorial_id': tutorialId,
        'af_success': success,
        if (content != null) 'af_content': content,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log tutorial completion: $e');
    }
  }

  // ==================== SCREEN VIEWS ====================

  static Future<void> logScreenView({required String screenName}) async {
    final normalizedScreenName = screenName.trim();
    if (normalizedScreenName.isEmpty) {
      return;
    }

    try {
      await _analytics.logScreenView(screenName: normalizedScreenName);
      await AppsFlyerService.logEvent('screen_view', {
        'screen_name': normalizedScreenName,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log screen view: $e');
    }
  }

  static Future<void> logRouteScreenView({required String screenName}) async {
    final normalizedScreenName = screenName.trim();
    if (normalizedScreenName.isEmpty ||
        normalizedScreenName == _lastRouteScreenName) {
      return;
    }

    _lastRouteScreenName = normalizedScreenName;
    await logScreenView(screenName: normalizedScreenName);
  }

  // ==================== USER PROPERTIES ====================

  static Future<void> setUserId(String userId) async {
    try {
      await _analytics.setUserId(id: userId);
      await AppsFlyerService.setCustomerUserId(userId);
    } catch (e) {
      debugPrint('Analytics: Failed to set user ID: $e');
    }
  }

  static Future<void> setUserProperty(
      {required String name, required String value}) async {
    try {
      await _analytics.setUserProperty(name: name, value: value);
    } catch (e) {
      debugPrint('Analytics: Failed to set user property: $e');
    }
  }
}

class _HoopRankAnalyticsObserver extends RouteObserver<ModalRoute<dynamic>> {
  void _sendScreenView(Route<dynamic> route) {
    if (route is! PageRoute) {
      return;
    }

    final screenName = route.settings.name;
    if (screenName == null || screenName.isEmpty) {
      return;
    }

    AnalyticsService.logRouteScreenView(screenName: screenName);
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    _sendScreenView(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
    if (newRoute != null) {
      _sendScreenView(newRoute);
    }
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    if (previousRoute != null && route is PageRoute) {
      _sendScreenView(previousRoute);
    }
  }
}

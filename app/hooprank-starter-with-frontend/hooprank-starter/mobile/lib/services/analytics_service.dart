import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// Centralized analytics service for tracking key user events.
/// Wraps Firebase Analytics to provide type-safe event logging.
class AnalyticsService {
  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  /// Firebase Analytics observer for GoRouter navigation tracking
  static FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  // ==================== AUTH EVENTS ====================

  static Future<void> logLogin({required String provider, required bool success}) async {
    try {
      await _analytics.logLogin(loginMethod: provider);
      await _analytics.logEvent(name: 'auth_attempt', parameters: {
        'provider': provider,
        'success': success.toString(),
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log login: $e');
    }
  }

  static Future<void> logSignUp({required String provider}) async {
    try {
      await _analytics.logSignUp(signUpMethod: provider);
    } catch (e) {
      debugPrint('Analytics: Failed to log sign up: $e');
    }
  }

  // ==================== COURT EVENTS ====================

  static Future<void> logCourtCheckIn({required String courtId, String? city}) async {
    try {
      await _analytics.logEvent(name: 'court_check_in', parameters: {
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
    } catch (e) {
      debugPrint('Analytics: Failed to log challenge sent: $e');
    }
  }

  static Future<void> logChallengeAccepted({required String mode}) async {
    try {
      await _analytics.logEvent(name: 'challenge_accepted', parameters: {
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
    } catch (e) {
      debugPrint('Analytics: Failed to log run joined: $e');
    }
  }

  static Future<void> logStatusPosted() async {
    try {
      await _analytics.logEvent(name: 'status_posted');
    } catch (e) {
      debugPrint('Analytics: Failed to log status posted: $e');
    }
  }

  static Future<void> logMessageSent() async {
    try {
      await _analytics.logEvent(name: 'message_sent');
    } catch (e) {
      debugPrint('Analytics: Failed to log message sent: $e');
    }
  }

  static Future<void> logTeamCreated({required String teamType}) async {
    try {
      await _analytics.logEvent(name: 'team_created', parameters: {
        'team_type': teamType,
      });
    } catch (e) {
      debugPrint('Analytics: Failed to log team created: $e');
    }
  }

  // ==================== SCREEN VIEWS ====================

  static Future<void> logScreenView({required String screenName}) async {
    try {
      await _analytics.logScreenView(screenName: screenName);
    } catch (e) {
      debugPrint('Analytics: Failed to log screen view: $e');
    }
  }

  // ==================== USER PROPERTIES ====================

  static Future<void> setUserId(String userId) async {
    try {
      await _analytics.setUserId(id: userId);
    } catch (e) {
      debugPrint('Analytics: Failed to set user ID: $e');
    }
  }

  static Future<void> setUserProperty({required String name, required String value}) async {
    try {
      await _analytics.setUserProperty(name: name, value: value);
    } catch (e) {
      debugPrint('Analytics: Failed to set user property: $e');
    }
  }
}

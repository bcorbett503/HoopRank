import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';
import '../services/location_service.dart';
import '../services/auth_service.dart';

class AuthState extends ChangeNotifier {
  // Legacy key (Round 1). Kept for backward compatibility with existing installs.
  static const String _permissionsPromptedKey = 'hooprank:permissions_prompted';
  static const String _pushPermissionsPromptedKey =
      'hooprank:permissions_prompted_push';
  static const String _locationPermissionsPromptedKey =
      'hooprank:permissions_prompted_location';

  User? _currentUser;
  bool _onboardingComplete = false;

  User? get currentUser => _currentUser;
  bool get onboardingComplete => _onboardingComplete;

  AuthState() {
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    const storage = FlutterSecureStorage();

    // Check if onboarding has been completed
    _onboardingComplete = prefs.getBool('onboarding_complete') ?? false;

    final raw = prefs.getString('hooprank:user');
    if (raw != null) {
      try {
        final Map<String, dynamic> data = jsonDecode(raw);
        _currentUser = User.fromJson(data);
        ApiService.setUserId(_currentUser!.id);

        // Restore auth token from secure storage
        final storedToken = await storage.read(key: 'auth_token');
        if (storedToken != null) {
          ApiService.setAuthToken(storedToken);
        }

        // Register FCM token for existing session
        _registerFcmToken();

        // CRITICAL: If cached user doesn't have position, we MUST fetch from backend
        // synchronously to avoid router redirecting to profile setup incorrectly
        if (_currentUser!.position == null || _currentUser!.position!.isEmpty) {
          debugPrint(
              '_init: Cached user has no position, fetching from backend...');
          await _refreshUserSynchronously();
        } else {
          // User has position cached, can refresh in background
          _refreshUserInBackground();
        }
      } catch (e) {
        // Handle corruption
        await prefs.remove('hooprank:user');
      }
    }
    notifyListeners();
  }

  /// Synchronous refresh that blocks until user data is fetched
  Future<void> _refreshUserSynchronously() async {
    try {
      final updatedUser = await ApiService.getMe();
      if (updatedUser != null) {
        debugPrint(
            '_refreshUserSynchronously: got user with position=${updatedUser.position}');
        _currentUser = updatedUser;

        // Update persisted data
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(
            'hooprank:user',
            jsonEncode({
              'id': updatedUser.id,
              'name': updatedUser.name,
              'photoUrl': updatedUser.photoUrl,
              'team': updatedUser.team,
              'position': updatedUser.position,
              'rating': updatedUser.rating,
              'matchesPlayed': updatedUser.matchesPlayed,
            }));
      }
    } catch (e) {
      debugPrint('_refreshUserSynchronously failed: $e');
    }
  }

  /// Background refresh that doesn't block initialization
  Future<void> _refreshUserInBackground() async {
    try {
      await Future.delayed(const Duration(
          milliseconds: 500)); // Small delay to ensure API is ready
      final updatedUser = await ApiService.getMe();
      if (updatedUser != null) {
        debugPrint(
            '_refreshUserInBackground: got user with position=${updatedUser.position}');
        _currentUser = updatedUser;
        notifyListeners();

        // Update persisted data
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(
            'hooprank:user',
            jsonEncode({
              'id': updatedUser.id,
              'name': updatedUser.name,
              'photoUrl': updatedUser.photoUrl,
              'team': updatedUser.team,
              'position': updatedUser.position,
              'rating': updatedUser.rating,
              'matchesPlayed': updatedUser.matchesPlayed,
            }));
      }
    } catch (e) {
      debugPrint('_refreshUserInBackground failed: $e');
    }
  }

  Future<void> completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_complete', true);
    _onboardingComplete = true;
    notifyListeners();
  }

  Future<void> resetOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_complete', false);
    _onboardingComplete = false;
    notifyListeners();
  }

  Future<void> login(User user, {String? token}) async {
    _currentUser = user;
    debugPrint(
        'AUTH_STATE.login: user.id=${user.id}, user.position=${user.position}, isProfileComplete=${user.isProfileComplete}');
    ApiService.setUserId(user.id);
    if (token != null) {
      ApiService.setAuthToken(token);
    }
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'hooprank:user',
        jsonEncode({
          'id': user.id,
          'name': user.name,
          'photoUrl': user.photoUrl,
          'team': user.team,
          'position': user.position,
          'rating': user.rating,
          'matchesPlayed': user.matchesPlayed,
        }));

    if (token != null) {
      const storage = FlutterSecureStorage();
      await storage.write(key: 'auth_token', value: token);
    }

    // Register FCM token for push notifications
    _registerFcmToken();

    // First-login onboarding: request push + location permissions once per install.
    // We do it here (after auth is established) so the prompts are contextual to
    // an actual user session, not the app cold start.
    await _maybePromptFirstLoginPermissions();
  }

  Future<void> _maybePromptFirstLoginPermissions() async {
    final userId = _currentUser?.id;
    if (userId == null || userId.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    final legacyPrompted = prefs.getBool(_permissionsPromptedKey) ?? false;
    final pushPrompted =
        prefs.getBool(_pushPermissionsPromptedKey) ?? legacyPrompted;
    final locationPrompted =
        prefs.getBool(_locationPermissionsPromptedKey) ?? false;

    if (pushPrompted && locationPrompted) return;

    try {
      // Push notifications
      if (!pushPrompted) {
        final granted = await NotificationService().requestPermissions();
        if (granted) {
          await NotificationService().registerToken(userId);
        }
        await prefs.setBool(_pushPermissionsPromptedKey, true);
      }

      // Location services
      if (!locationPrompted) {
        final permission = await LocationService.requestPermissionIfNeeded();
        // Only mark "prompted" once the app is no longer in the raw "denied"
        // state. If the device couldn't show the system prompt (rare), we'll
        // try again later, and the feed UI provides an explicit CTA.
        if (permission != LocationPermission.denied) {
          await prefs.setBool(_locationPermissionsPromptedKey, true);
        }
      }
    } catch (e) {
      debugPrint('First-login permission prompt failed: $e');
    } finally {
      final finalPush =
          prefs.getBool(_pushPermissionsPromptedKey) ?? legacyPrompted;
      final finalLocation =
          prefs.getBool(_locationPermissionsPromptedKey) ?? false;
      if (finalPush && finalLocation) {
        await prefs.setBool(_permissionsPromptedKey, true);
      }
    }
  }

  /// Refresh user data from the backend (e.g., after rating changes)
  Future<void> refreshUser() async {
    if (_currentUser == null) return;
    try {
      debugPrint('Refreshing user data...');
      final updatedUser = await ApiService.getMe();
      debugPrint('Got updated user: ${updatedUser?.name}');
      if (updatedUser != null) {
        _currentUser = updatedUser;
        notifyListeners();

        // Update persisted data
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(
            'hooprank:user',
            jsonEncode({
              'id': updatedUser.id,
              'name': updatedUser.name,
              'photoUrl': updatedUser.photoUrl,
              'team': updatedUser.team,
              'position': updatedUser.position,
              'rating': updatedUser.rating,
              'matchesPlayed': updatedUser.matchesPlayed,
            }));
        debugPrint('User state updated to: ${_currentUser?.name}');
      }
    } catch (e) {
      debugPrint('Failed to refresh user: $e');
    }
  }

  /// Update the user's position locally (used after profile setup to ensure isProfileComplete works)
  Future<void> updateUserPosition(String position) async {
    if (_currentUser == null) return;
    debugPrint('Updating user position locally to: $position');
    _currentUser = User(
      id: _currentUser!.id,
      name: _currentUser!.name,
      photoUrl: _currentUser!.photoUrl,
      team: _currentUser!.team,
      position: position,
      rating: _currentUser!.rating,
      matchesPlayed: _currentUser!.matchesPlayed,
    );
    notifyListeners();

    // Persist the updated user
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'hooprank:user',
        jsonEncode({
          'id': _currentUser!.id,
          'name': _currentUser!.name,
          'photoUrl': _currentUser!.photoUrl,
          'team': _currentUser!.team,
          'position': _currentUser!.position,
          'rating': _currentUser!.rating,
          'matchesPlayed': _currentUser!.matchesPlayed,
        }));
  }

  Future<void> _registerFcmToken() async {
    if (_currentUser == null) return;
    try {
      await NotificationService().registerToken(_currentUser!.id);
    } catch (e) {
      debugPrint('Failed to register FCM token: $e');
    }
  }

  Future<void> logout() async {
    final previousUserId = _currentUser?.id;

    // Best-effort server cleanup before auth/user context is cleared.
    if (previousUserId != null && previousUserId.isNotEmpty) {
      try {
        await ApiService.unregisterFcmToken(previousUserId);
      } catch (e) {
        debugPrint('Failed to unregister FCM token on logout: $e');
      }
    }
    await NotificationService.clearBadge();

    _currentUser = null;
    ApiService.setUserId('');
    notifyListeners();

    // Clear local storage
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('hooprank:user');

    // Clear secure storage
    const storage = FlutterSecureStorage();
    await storage.delete(key: 'auth_token');

    // Sign out from all providers using AuthService (uses same GoogleSignIn instance)
    try {
      await AuthService.signOut();
    } catch (e) {
      debugPrint('Auth sign out failed: $e');
    }

    // Also try disconnect to clear cached credentials
    try {
      final googleSignIn = GoogleSignIn();
      await googleSignIn.disconnect();
    } catch (e) {
      debugPrint('Google disconnect failed: $e');
    }
  }
}

class MatchState extends ChangeNotifier {
  // Draft
  Player? opponent;
  Court? court;
  String mode = '1v1';
  String? matchId; // Backend match ID

  // Team match info
  String? myTeamId;
  String? myTeamName;
  String? opponentTeamName;

  // Live
  DateTime? startedAt;
  int seconds = 0;
  bool active = false;

  // Result
  int? userScore;
  int? oppScore;
  double? delta;
  double? ratingBefore;
  double? ratingAfter;
  int? rankBefore;
  int? rankAfter;

  void setOpponent(Player? p) {
    opponent = p;
    notifyListeners();
  }

  void setCourt(Court? c) {
    court = c;
    notifyListeners();
  }

  void startMatch() {
    startedAt = DateTime.now();
    seconds = 0;
    active = true;
    // Reset result
    userScore = null;
    oppScore = null;
    delta = null;
    ratingBefore = null;
    ratingAfter = null;
    rankBefore = null;
    rankAfter = null;
    notifyListeners();
  }

  void tick() {
    if (active) {
      seconds++;
      notifyListeners();
    }
  }

  void endMatch() {
    active = false;
    notifyListeners();
  }

  void setScores(int us, int os) {
    userScore = us;
    oppScore = os;
    notifyListeners();
  }

  void setOutcome({
    required double deltaVal,
    required double rBefore,
    required double rAfter,
    required int rkBefore,
    required int rkAfter,
  }) {
    delta = deltaVal;
    ratingBefore = rBefore;
    ratingAfter = rAfter;
    rankBefore = rkBefore;
    rankAfter = rkAfter;
    notifyListeners();
  }

  void setMatchId(String? id) {
    matchId = id;
    notifyListeners();
  }

  void reset() {
    opponent = null;
    court = null;
    mode = '1v1';
    matchId = null;
    myTeamId = null;
    myTeamName = null;
    opponentTeamName = null;
    startedAt = null;
    seconds = 0;
    active = false;
    userScore = null;
    oppScore = null;
    delta = null;
    ratingBefore = null;
    ratingAfter = null;
    rankBefore = null;
    rankAfter = null;
    notifyListeners();
  }
}

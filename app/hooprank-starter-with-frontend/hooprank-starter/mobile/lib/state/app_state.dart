import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import '../models.dart';
import '../services/mock_data.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';
import '../services/auth_service.dart';

class AuthState extends ChangeNotifier {
  User? _currentUser;

  User? get currentUser => _currentUser;

  AuthState() {
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('hooprank:user');
    if (raw != null) {
      try {
        final Map<String, dynamic> data = jsonDecode(raw);
        _currentUser = User.fromJson(data);
        ApiService.setUserId(_currentUser!.id);
        // Register FCM token for existing session
        _registerFcmToken();
        notifyListeners();
      } catch (e) {
        // Handle corruption
        await prefs.remove('hooprank:user');
      }
    }
  }

  Future<void> login(User user, {String? token}) async {
    _currentUser = user;
    ApiService.setUserId(user.id);
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('hooprank:user', jsonEncode({
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
        await prefs.setString('hooprank:user', jsonEncode({
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
  
  Future<void> _registerFcmToken() async {
    if (_currentUser == null) return;
    try {
      await NotificationService().registerToken(_currentUser!.id);
    } catch (e) {
      debugPrint('Failed to register FCM token: $e');
    }
  }

  Future<void> logout() async {
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

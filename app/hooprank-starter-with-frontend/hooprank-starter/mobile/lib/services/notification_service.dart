import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';
import 'api_service.dart';

/// Handles push notifications via Firebase Cloud Messaging
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = 
      FlutterLocalNotificationsPlugin();
  
  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  /// Initialize notification service - call once on app start
  Future<void> initialize() async {
    // Request permission
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    
    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      debugPrint('Push notifications authorized');
    } else {
      debugPrint('Push notifications denied');
      return;
    }

    // Initialize local notifications for foreground display
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Get FCM token
    _fcmToken = await _messaging.getToken();
    debugPrint('FCM Token: $_fcmToken');

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((token) {
      _fcmToken = token;
      _registerTokenWithBackend();
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle background/terminated message taps
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);

    // Check for initial message (app opened from terminated state via notification)
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageTap(initialMessage);
    }
  }

  /// Register the FCM token with the backend
  Future<void> registerToken(String userId) async {
    if (_fcmToken == null) return;
    
    try {
      await ApiService.registerFcmToken(userId, _fcmToken!);
      debugPrint('FCM token registered with backend');
    } catch (e) {
      debugPrint('Failed to register FCM token: $e');
    }
  }

  Future<void> _registerTokenWithBackend() async {
    // This would need the current user ID - handle in the auth flow
    debugPrint('FCM token refreshed - should re-register');
  }

  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('Foreground message: ${message.notification?.title}');
    
    // Show local notification
    if (message.notification != null) {
      _localNotifications.show(
        message.hashCode,
        message.notification!.title,
        message.notification!.body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'hooprank_channel',
            'HoopRank Notifications',
            channelDescription: 'Notifications for challenges, messages, and games',
            importance: Importance.high,
            priority: Priority.high,
          ),
        ),
        payload: message.data.toString(),
      );
    }
  }

  void _handleMessageTap(RemoteMessage message) {
    debugPrint('Message tap: ${message.data}');
    // Navigation would be handled here based on message.data['type']
    // For now, just log it - the app's routing should handle deep links
  }

  void _onNotificationTap(NotificationResponse response) {
    debugPrint('Local notification tap: ${response.payload}');
    // Handle navigation based on payload
  }
}

/// Top-level function for background message handling
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('Background message: ${message.notification?.title}');
  // Background messages are handled automatically by FCM
}

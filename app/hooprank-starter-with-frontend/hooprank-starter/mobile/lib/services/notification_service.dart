import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'api_service.dart';

/// Handles push notifications via Firebase Cloud Messaging
class NotificationService with WidgetsBindingObserver {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();
  static const MethodChannel _badgeChannel =
      MethodChannel('hooprank/notifications');

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  /// Callbacks to notify when a push notification is received (for screen refreshes)
  static final List<VoidCallback> _onNotificationCallbacks = [];

  /// Register a callback to be called when a push notification is received
  static void addOnNotificationListener(VoidCallback callback) {
    _onNotificationCallbacks.add(callback);
  }

  /// Remove a previously registered callback
  static void removeOnNotificationListener(VoidCallback callback) {
    _onNotificationCallbacks.remove(callback);
  }

  /// Notify all registered listeners (call this when push notification arrives)
  static void _notifyListeners() {
    for (final callback in _onNotificationCallbacks) {
      callback();
    }
  }

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
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Don't auto-show badge for foreground notifications
    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: false,
      sound: true,
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

    // Clear badge on app launch
    clearBadge();

    // Listen for app lifecycle changes to clear badge when app comes to foreground
    WidgetsBinding.instance.addObserver(this);
  }

  /// Clear the iOS app icon badge count
  static Future<void> clearBadge() async {
    try {
      // Cancel all delivered local notifications.
      await _instance._localNotifications.cancelAll();

      // Explicitly clear the native iOS app icon badge count.
      // This handles background pushes that may have already set a badge value.
      await _badgeChannel.invokeMethod('clearBadge');

      // Keep foreground behavior badge-free.
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
        alert: true,
        badge: false,
        sound: true,
      );

      debugPrint('Badge cleared');
    } catch (e) {
      debugPrint('Failed to clear badge: $e');
    }
  }

  /// Called when app lifecycle state changes
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // App came back to foreground — clear badge
      clearBadge();
      debugPrint('App resumed — badge cleared');
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
    final userId = ApiService.userId;
    if (_fcmToken == null || userId == null || userId.isEmpty) {
      return;
    }
    try {
      await ApiService.registerFcmToken(userId, _fcmToken!);
      debugPrint('FCM token refreshed and re-registered');
    } catch (e) {
      debugPrint('Failed to re-register refreshed FCM token: $e');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('Foreground message: ${message.notification?.title}');

    // Notify listeners to refresh (e.g., home screen)
    _notifyListeners();

    // Show local notification without badge increment
    if (message.notification != null) {
      _localNotifications.show(
        message.hashCode,
        message.notification!.title,
        message.notification!.body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'hooprank_channel',
            'HoopRank Notifications',
            channelDescription:
                'Notifications for challenges, messages, and games',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(
            presentBadge: false,
          ),
        ),
        payload: message.data.toString(),
      );
    }
  }

  void _handleMessageTap(RemoteMessage message) {
    debugPrint('Message tap: ${message.data}');
    // Clear badge when user taps a notification
    clearBadge();
  }

  void _onNotificationTap(NotificationResponse response) {
    debugPrint('Local notification tap: ${response.payload}');
    // Clear badge when user taps a local notification
    clearBadge();
  }
}

/// Top-level function for background message handling
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('Background message: ${message.notification?.title}');
  // Background messages are handled automatically by FCM
}

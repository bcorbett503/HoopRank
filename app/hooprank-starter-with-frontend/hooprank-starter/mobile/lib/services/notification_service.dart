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
    // Initialize local notifications for foreground display
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      // Do NOT request permissions at app start. We prompt on first login
      // so it feels contextual and not like a cold-start pop-up.
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
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

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((token) {
      _fcmToken = token;
      _registerTokenWithBackend();
    });

    // If the user previously granted notification permission (e.g. returning
    // install), grab the token now. If not authorized yet, we'll request on
    // first login and then fetch/register the token.
    try {
      final settings = await _messaging.getNotificationSettings();
      final status = settings.authorizationStatus;
      final isAuthorized = status == AuthorizationStatus.authorized ||
          status == AuthorizationStatus.provisional;
      if (isAuthorized) {
        _fcmToken = await _messaging.getToken();
        debugPrint('FCM Token (pre-authorized): $_fcmToken');
      } else {
        debugPrint(
          'Push notifications not authorized yet (will prompt on first login)',
        );
      }
    } catch (e) {
      debugPrint('Failed to read notification settings: $e');
    }

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

  /// Request system notification permissions (intended for first-login prompt).
  /// Returns true if notifications are authorized (or provisional), false otherwise.
  Future<bool> requestPermissions() async {
    try {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      final status = settings.authorizationStatus;
      final isAuthorized = status == AuthorizationStatus.authorized ||
          status == AuthorizationStatus.provisional;

      if (!isAuthorized) {
        debugPrint('Push notifications denied');
        return false;
      }

      // Request local-notification permissions too (foreground presentation uses
      // flutter_local_notifications). This is the same underlying iOS permission,
      // but calling it here ensures the plugin is unblocked.
      final ios = _localNotifications.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      await ios?.requestPermissions(alert: true, badge: true, sound: true);

      _fcmToken = await _messaging.getToken();
      debugPrint('FCM Token (post-authorize): $_fcmToken');
      return true;
    } catch (e) {
      debugPrint('Failed to request notification permissions: $e');
      return false;
    }
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

import 'dart:async';
import 'dart:collection';

import 'package:appsflyer_sdk/appsflyer_sdk.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class _QueuedAppsFlyerEvent {
  const _QueuedAppsFlyerEvent(this.name, this.parameters);

  final String name;
  final Map<String, Object?> parameters;
}

class _AppsFlyerStartException implements Exception {
  const _AppsFlyerStartException(this.code, this.message);

  final int code;
  final String message;

  @override
  String toString() => 'AppsFlyer start failed ($code): $message';
}

class AppsFlyerService {
  AppsFlyerService._();

  static const String _devKey = '9oW3n4eoqPLHcFtV8a5gaY';
  static const String _iosAppId = '6758069600';
  static const int _maxPendingEvents = 50;
  static const Duration _startTimeout = Duration(seconds: 8);
  static const Duration _retryAfterFailure = Duration(seconds: 15);
  static const MethodChannel _deviceIdentifiersChannel =
      MethodChannel('hooprank/device_identifiers');

  static AppsflyerSdk? _sdk;
  static bool _initialized = false;
  static bool _callbacksRegistered = false;
  static Future<void>? _initializationFuture;
  static DateTime? _lastInitializationAttempt;
  static String? _pendingCustomerUserId;
  static final Queue<_QueuedAppsFlyerEvent> _pendingEvents =
      Queue<_QueuedAppsFlyerEvent>();

  static Future<void> initialize() async {
    if (kIsWeb || _initialized) {
      return;
    }

    final activeInitialization = _initializationFuture;
    if (activeInitialization != null) {
      await activeInitialization;
      return;
    }

    final now = DateTime.now();
    final lastAttempt = _lastInitializationAttempt;
    if (lastAttempt != null &&
        now.difference(lastAttempt) < _retryAfterFailure) {
      return;
    }

    _lastInitializationAttempt = now;
    _initializationFuture = _initializeOnce().whenComplete(() {
      _initializationFuture = null;
    });
    await _initializationFuture;
  }

  static Future<void> _initializeOnce() async {
    try {
      final options = AppsFlyerOptions(
        afDevKey: _devKey,
        appId: _iosAppId,
        manualStart: true,
        disableAdvertisingIdentifier: false,
        disableCollectASA: false,
        showDebug: kDebugMode,
      );

      final sdk = AppsflyerSdk(options);
      _sdk = sdk;
      if (!_callbacksRegistered) {
        _registerCallbacks(sdk);
        _callbacksRegistered = true;
      }

      await sdk.initSdk(
        registerConversionDataCallback: true,
        registerOnAppOpenAttributionCallback: true,
        registerOnDeepLinkingCallback: true,
      );

      await _startSdk(sdk);
      _initialized = true;
      _lastInitializationAttempt = null;

      final pendingCustomerUserId = _pendingCustomerUserId;
      if (pendingCustomerUserId != null && pendingCustomerUserId.isNotEmpty) {
        await setCustomerUserId(pendingCustomerUserId);
      }

      debugPrint('AppsFlyer: SDK initialized');
      await _recordDiagnostic('started');
      await _sendEventNow('app_opened', {
        'source': 'app_start',
        'mode': _buildModeName,
      });
      await _flushPendingEvents();
      if (kDebugMode) {
        await _logDebugTestDeviceIdentifiers();
      }
    } catch (error, stackTrace) {
      _initialized = false;
      debugPrint('AppsFlyer: Failed to initialize SDK: $error');
      await _recordDiagnostic('failed', error: error);
      await _recordNonFatal(error, stackTrace, reason: 'AppsFlyer init failed');
    }
  }

  static Future<void> _startSdk(AppsflyerSdk sdk) async {
    final completer = Completer<void>();

    sdk.startSDK(
      onSuccess: () {
        if (!completer.isCompleted) {
          completer.complete();
        }
      },
      onError: (errorCode, errorMessage) {
        if (!completer.isCompleted) {
          completer.completeError(
            _AppsFlyerStartException(errorCode, errorMessage),
          );
        }
      },
    );

    await completer.future.timeout(
      _startTimeout,
      onTimeout: () {
        throw TimeoutException('AppsFlyer start timed out', _startTimeout);
      },
    );
  }

  static void _registerCallbacks(AppsflyerSdk sdk) {
    sdk.onInstallConversionData((dynamic payload) {
      _debugAttributionPayload('install conversion data', payload);
    });

    sdk.onAppOpenAttribution((dynamic payload) {
      _debugAttributionPayload('app open attribution', payload);
    });

    sdk.onDeepLinking((DeepLinkResult result) {
      if (!kDebugMode) {
        return;
      }

      debugPrint(
        'AppsFlyer: deep link callback status=${result.status} '
        'error=${result.error} '
        'payload=${_safeDebugPayload(result.deepLink?.clickEvent)}',
      );
    });
  }

  static Future<void> setCustomerUserId(String userId) async {
    final normalizedUserId = userId.trim();
    if (normalizedUserId.isEmpty) {
      return;
    }

    _pendingCustomerUserId = normalizedUserId;

    final sdk = _sdk;
    if (!_initialized || sdk == null) {
      return;
    }

    try {
      sdk.setCustomerUserId(normalizedUserId);
    } catch (error) {
      debugPrint('AppsFlyer: Failed to set customer user ID: $error');
    }
  }

  static Future<void> logEvent(
    String name,
    Map<String, Object?> parameters,
  ) async {
    final sdk = _sdk;
    if (!_initialized || sdk == null) {
      _queueEvent(name, parameters);
      unawaited(initialize());
      return;
    }

    await _sendEventNow(name, parameters);
  }

  static Future<void> _sendEventNow(
    String name,
    Map<String, Object?> parameters,
  ) async {
    final sdk = _sdk;
    if (!_initialized || sdk == null) {
      _queueEvent(name, parameters);
      return;
    }

    try {
      final sanitizedParameters = _sanitizeParameters(parameters);
      final result = await sdk.logEvent(name, sanitizedParameters);
      if (kDebugMode) {
        debugPrint(
          'AppsFlyer: logEvent $name result=$result params=$sanitizedParameters',
        );
      }
    } catch (error) {
      debugPrint('AppsFlyer: Failed to log $name: $error');
    }
  }

  static void _queueEvent(String name, Map<String, Object?> parameters) {
    final eventName = name.trim();
    if (eventName.isEmpty) {
      return;
    }

    if (_pendingEvents.length >= _maxPendingEvents) {
      _pendingEvents.removeFirst();
    }
    _pendingEvents.add(_QueuedAppsFlyerEvent(eventName, parameters));
  }

  static Future<void> _flushPendingEvents() async {
    while (_pendingEvents.isNotEmpty) {
      final event = _pendingEvents.removeFirst();
      await _sendEventNow(event.name, event.parameters);
    }
  }

  static Map<String, dynamic> _sanitizeParameters(
    Map<String, Object?> parameters,
  ) {
    final sanitized = <String, dynamic>{};

    for (final entry in parameters.entries) {
      final key = entry.key.trim();
      final value = entry.value;

      if (key.isEmpty || value == null) {
        continue;
      }

      if (value is String || value is num || value is bool) {
        sanitized[key] = value;
      } else {
        sanitized[key] = value.toString();
      }
    }

    return sanitized;
  }

  static void _debugAttributionPayload(String label, dynamic payload) {
    if (!kDebugMode) {
      return;
    }

    debugPrint('AppsFlyer: $label callback ${_safeDebugPayload(payload)}');
  }

  static Object? _safeDebugPayload(dynamic payload) {
    if (payload is Map) {
      final redacted = <String, dynamic>{};
      for (final entry in payload.entries) {
        final key = entry.key.toString();
        final normalizedKey = key.toLowerCase();
        if (normalizedKey.contains('email') ||
            normalizedKey.contains('phone') ||
            normalizedKey.contains('customer_user_id')) {
          redacted[key] = '<redacted>';
        } else {
          redacted[key] = entry.value;
        }
      }
      return redacted;
    }

    return payload;
  }

  static Future<void> _recordDiagnostic(
    String status, {
    Object? error,
  }) async {
    try {
      await FirebaseAnalytics.instance.logEvent(
        name: 'appsflyer_sdk_status',
        parameters: {
          'status': status,
          'mode': _buildModeName,
          if (error != null) 'error': error.toString(),
        },
      );
    } catch (_) {
      // Diagnostics should never interfere with attribution.
    }
  }

  static Future<void> _recordNonFatal(
    Object error,
    StackTrace stackTrace, {
    required String reason,
  }) async {
    try {
      await FirebaseCrashlytics.instance.recordError(
        error,
        stackTrace,
        reason: reason,
        fatal: false,
      );
    } catch (_) {
      // Crashlytics may be unavailable in unit tests or early app startup.
    }
  }

  static String get _buildModeName {
    if (kReleaseMode) {
      return 'release';
    }
    if (kProfileMode) {
      return 'profile';
    }
    return 'debug';
  }

  static Future<void> _logDebugTestDeviceIdentifiers() async {
    // IDFV is iOS-only; the channel is implemented in AppDelegate.swift.
    if (defaultTargetPlatform != TargetPlatform.iOS) return;
    try {
      debugPrint('AppsFlyer: Requesting iOS IDFV for test device registration');
      final idfv = await _deviceIdentifiersChannel
          .invokeMethod<String>('getVendorIdentifier')
          .timeout(const Duration(seconds: 2), onTimeout: () => null);
      if (idfv != null && idfv.isNotEmpty) {
        debugPrint(
          'AppsFlyer: iOS IDFV for test device registration: $idfv',
        );
      } else {
        debugPrint('AppsFlyer: iOS IDFV unavailable in this build');
      }
    } catch (error) {
      debugPrint('AppsFlyer: Could not read debug IDFV: $error');
    }
  }
}

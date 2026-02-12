import Flutter
import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate {
  private let badgeChannelName = "hooprank/notifications"

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Configure Firebase
    FirebaseApp.configure()
    
    // Register for push notifications
    UNUserNotificationCenter.current().delegate = self
    
    let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
    UNUserNotificationCenter.current().requestAuthorization(
      options: authOptions,
      completionHandler: { _, _ in }
    )
    application.registerForRemoteNotifications()
    
    // Set Firebase Messaging delegate
    Messaging.messaging().delegate = self

    if let controller = window?.rootViewController as? FlutterViewController {
      let badgeChannel = FlutterMethodChannel(name: badgeChannelName, binaryMessenger: controller.binaryMessenger)
      badgeChannel.setMethodCallHandler { [weak self] call, result in
        guard let self = self else {
          result(FlutterError(code: "DEALLOCATED", message: "AppDelegate deallocated", details: nil))
          return
        }
        switch call.method {
        case "clearBadge":
          self.clearApplicationBadge()
          result(nil)
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    GeneratedPluginRegistrant.register(with: self)
    clearApplicationBadge()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    clearApplicationBadge()
  }
  
  // Receive device token for push notifications
  override func application(_ application: UIApplication,
                          didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  private func clearApplicationBadge() {
    DispatchQueue.main.async {
      UIApplication.shared.applicationIconBadgeNumber = 0
      let center = UNUserNotificationCenter.current()
      if #available(iOS 16.0, *) {
        center.setBadgeCount(0) { _ in }
      }
      center.removeAllDeliveredNotifications()
    }
  }
}

// MARK: - MessagingDelegate
extension AppDelegate: MessagingDelegate {
  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    print("Firebase registration token: \(String(describing: fcmToken))")
    
    let dataDict: [String: String] = ["token": fcmToken ?? ""]
    NotificationCenter.default.post(
      name: Notification.Name("FCMToken"),
      object: nil,
      userInfo: dataDict
    )
  }
}

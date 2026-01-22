// File generated manually from google-services.json and GoogleService-Info.plist
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'DefaultFirebaseOptions have not been configured for web - '
        'you can reconfigure this by running the FlutterFire CLI again.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDtPMA0ze_BUhENT3zcjoLoIrrOeAVLCjo',
    appId: '1:655663987178:android:0aeacd36cbca8c7479da93',
    messagingSenderId: '655663987178',
    projectId: 'hooprank-503',
    storageBucket: 'hooprank-503.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDpxXOVbelRrNUhMTJPiZ_19VCm0GcZxHM',
    appId: '1:655663987178:ios:5b8a9b327498ab3379da93',
    messagingSenderId: '655663987178',
    projectId: 'hooprank-503',
    storageBucket: 'hooprank-503.firebasestorage.app',
    iosBundleId: 'com.hooprank.app',
    iosClientId: '655663987178-lqasm0e55gretsjjl66h16kca44h5mh7.apps.googleusercontent.com',
  );
}

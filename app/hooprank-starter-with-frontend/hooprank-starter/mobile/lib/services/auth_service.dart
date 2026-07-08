import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:flutter/services.dart';

typedef DebugProviderSessionFactory = Future<AuthSessionIdentity?> Function(
  String provider,
  bool linkIfAnonymous,
);

class AuthSessionIdentity {
  const AuthSessionIdentity({
    required this.uid,
    required this.idToken,
    required this.isAnonymous,
    this.email,
    this.displayName,
    this.photoUrl,
  });

  final String uid;
  final String idToken;
  final bool isAnonymous;
  final String? email;
  final String? displayName;
  final String? photoUrl;

  static Future<AuthSessionIdentity> fromFirebaseUser(User user) async {
    final idToken = await user.getIdToken();
    if (idToken == null || idToken.isEmpty) {
      throw Exception('Unable to verify guest session.');
    }

    return AuthSessionIdentity(
      uid: user.uid,
      idToken: idToken,
      isAnonymous: user.isAnonymous,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoURL,
    );
  }
}

class AuthService {
  static final GoogleSignIn _googleSignIn = GoogleSignIn();
  @visibleForTesting
  static Future<AuthSessionIdentity> Function()? debugGuestSessionFactory;
  @visibleForTesting
  static DebugProviderSessionFactory? debugProviderSessionFactory;
  @visibleForTesting
  static AuthSessionIdentity? debugCurrentSessionIdentity;

  static FirebaseAuth? get _maybeAuth =>
      Firebase.apps.isEmpty ? null : FirebaseAuth.instance;

  static FirebaseAuth get _auth {
    final auth = _maybeAuth;
    if (auth == null) {
      throw FirebaseException(
        plugin: 'firebase_core',
        code: 'no-app',
        message:
            "No Firebase App '[DEFAULT]' has been created - call Firebase.initializeApp()",
      );
    }
    return auth;
  }

  static User? get currentFirebaseUser => _maybeAuth?.currentUser;
  static String? get currentAuthUid =>
      debugCurrentSessionIdentity?.uid ?? currentFirebaseUser?.uid;
  static bool get isAnonymousSession =>
      debugCurrentSessionIdentity?.isAnonymous ??
      currentFirebaseUser?.isAnonymous ??
      false;

  static Future<UserCredential> _signInOrLinkWithCredential(
    AuthCredential credential,
    bool linkIfAnonymous,
  ) async {
    final currentUser = _auth.currentUser;
    if (currentUser != null && currentUser.isAnonymous) {
      if (!linkIfAnonymous) {
        await _auth.signOut();
      } else {
        try {
          return await currentUser.linkWithCredential(credential);
        } on FirebaseAuthException catch (e) {
          if (e.code == 'credential-already-in-use' ||
              e.code == 'email-already-in-use') {
            throw Exception(
              'That account is already linked to another HoopRank profile. Sign in with it directly instead.',
            );
          }
          rethrow;
        }
      }
    }

    return await _auth.signInWithCredential(credential);
  }

  // Sign in with Google
  static Future<UserCredential?> signInWithGoogle({
    bool linkIfAnonymous = false,
  }) async {
    try {
      // Trigger the authentication flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return null; // User canceled

      // Obtain the auth details from the request
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      // Create a new credential
      final AuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase with the Google Credential
      return await _signInOrLinkWithCredential(
        credential,
        linkIfAnonymous,
      );
    } on PlatformException {
      rethrow;
    } catch (e) {
      rethrow;
    }
  }

  static Future<AuthSessionIdentity?> signInWithProvider(
    String provider, {
    bool linkIfAnonymous = false,
  }) async {
    final debugFactory = debugProviderSessionFactory;
    if (debugFactory != null) {
      final identity = await debugFactory(provider, linkIfAnonymous);
      debugCurrentSessionIdentity = identity;
      return identity;
    }

    UserCredential? credential;
    if (provider == 'apple') {
      credential = await signInWithApple(linkIfAnonymous: linkIfAnonymous);
    } else if (provider == 'google') {
      credential = await signInWithGoogle(linkIfAnonymous: linkIfAnonymous);
    } else if (provider == 'facebook') {
      credential = await signInWithFacebook(linkIfAnonymous: linkIfAnonymous);
    }

    if (credential == null || credential.user == null) {
      return null;
    }

    await credential.user!.reload();
    final user = _auth.currentUser;
    if (user == null) {
      return null;
    }

    return AuthSessionIdentity.fromFirebaseUser(user);
  }

  // Sign in with Email/Password (for App Review demo account)
  static Future<UserCredential?> signInWithEmail(
      String email, String password) async {
    try {
      return await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
    } catch (e) {
      rethrow;
    }
  }

  // Sign in with Apple
  static Future<UserCredential?> signInWithApple({
    bool linkIfAnonymous = false,
  }) async {
    try {
      // Request Apple credential
      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      // Create OAuth credential for Firebase
      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        accessToken: appleCredential.authorizationCode,
      );

      // Sign in to Firebase with the Apple credential
      final userCredential = await _signInOrLinkWithCredential(
        oauthCredential,
        linkIfAnonymous,
      );

      // Apple only returns the name on first sign-in, so update it if provided
      if (appleCredential.givenName != null ||
          appleCredential.familyName != null) {
        final displayName = [
          appleCredential.givenName,
          appleCredential.familyName,
        ].where((n) => n != null).join(' ');

        if (displayName.isNotEmpty) {
          await userCredential.user?.updateDisplayName(displayName);
        }
      }

      return userCredential;
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        return null; // User canceled
      }
      rethrow;
    } on PlatformException {
      rethrow;
    } catch (e) {
      rethrow;
    }
  }

  // Sign in with Facebook
  static Future<UserCredential?> signInWithFacebook({
    bool linkIfAnonymous = false,
  }) async {
    try {
      // Trigger the sign-in flow
      final LoginResult result = await FacebookAuth.instance.login(
        permissions: ['public_profile'],
      );

      if (result.status == LoginStatus.success) {
        // Create a credential from the access token
        final OAuthCredential credential = FacebookAuthProvider.credential(
          result.accessToken!.tokenString,
        );

        // Sign in to Firebase with the Facebook Credential
        return await _signInOrLinkWithCredential(
          credential,
          linkIfAnonymous,
        );
      } else {
        return null; // User canceled or failed
      }
    } on PlatformException {
      throw Exception(
          'Facebook Sign-In not configured. Please use Google Sign-In.');
    } catch (e) {
      rethrow;
    }
  }

  static Future<UserCredential?> signInAnonymously() async {
    try {
      return await _auth.signInAnonymously();
    } on FirebaseAuthException catch (e) {
      if (e.code == 'operation-not-allowed') {
        throw Exception(
          'Guest join is unavailable until Firebase Anonymous Auth is enabled.',
        );
      }
      rethrow;
    } catch (e) {
      rethrow;
    }
  }

  static Future<AuthSessionIdentity> ensureGuestSession() async {
    final debugFactory = debugGuestSessionFactory;
    if (debugFactory != null) {
      final identity = await debugFactory();
      debugCurrentSessionIdentity = identity;
      return identity;
    }

    final user = currentFirebaseUser ?? (await signInAnonymously())?.user;
    if (user == null) {
      throw Exception('Unable to start a guest session.');
    }

    final identity = await AuthSessionIdentity.fromFirebaseUser(user);
    return identity;
  }

  /// Get current Firebase ID token.
  /// [forceRefresh] bypasses the SDK cache and fetches a new token from Firebase.
  /// Used by the 401-retry logic when the backend rejects an expired token.
  static Future<String?> getIdToken({bool forceRefresh = false}) async {
    final debugIdentity = debugCurrentSessionIdentity;
    if (debugIdentity != null) {
      return debugIdentity.idToken;
    }
    return await currentFirebaseUser?.getIdToken(forceRefresh);
  }

  // Sign out
  static Future<void> signOut() async {
    debugCurrentSessionIdentity = null;
    await _googleSignIn.signOut();
    await FacebookAuth.instance.logOut();
    await _maybeAuth?.signOut();
  }

  @visibleForTesting
  static void debugSetGuestSessionFactory(
    Future<AuthSessionIdentity> Function()? factory,
  ) {
    debugGuestSessionFactory = factory;
  }

  @visibleForTesting
  static void debugSetProviderSessionFactory(
    DebugProviderSessionFactory? factory,
  ) {
    debugProviderSessionFactory = factory;
  }

  @visibleForTesting
  static void debugSetCurrentSessionIdentity(AuthSessionIdentity? identity) {
    debugCurrentSessionIdentity = identity;
  }

  @visibleForTesting
  static void debugClearTestOverrides() {
    debugGuestSessionFactory = null;
    debugProviderSessionFactory = null;
    debugCurrentSessionIdentity = null;
  }
}

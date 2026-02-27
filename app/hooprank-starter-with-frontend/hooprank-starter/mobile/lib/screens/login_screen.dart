import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart' as firebase;
import 'package:url_launcher/url_launcher.dart';
import '../state/app_state.dart';
import '../models.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../services/analytics_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isLoading = false;

  Future<void> _loginWithProvider(String provider) async {
    setState(() => _isLoading = true);

    final auth = context.read<AuthState>();
    try {
      firebase.UserCredential? credential;

      if (provider == 'apple') {
        credential = await AuthService.signInWithApple();
      } else if (provider == 'google') {
        credential = await AuthService.signInWithGoogle();
      } else if (provider == 'facebook') {
        credential = await AuthService.signInWithFacebook();
      }

      if (credential == null || credential.user == null) {
        // User canceled
        setState(() => _isLoading = false);
        return;
      }

      // Force a reload to guarantee we capture the freshly updated displayName
      // (especially critical for Apple Sign-In which updates it asynchronously).
      await credential.user!.reload();
      final firebaseUser = firebase.FirebaseAuth.instance.currentUser!;
      final userId = firebaseUser.uid;
      debugPrint('LOGIN: Firebase UID = $userId');

      // Get ID token first so it's available for both success and fallback cases
      final idToken = await firebaseUser.getIdToken();

      // Try to authenticate with backend (required)
      try {
        if (idToken != null) {
          debugPrint('LOGIN: Calling ApiService.authenticate...');
          final user = await ApiService.authenticate(
            idToken,
            uid: userId,
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            photoUrl: firebaseUser.photoURL,
            provider: provider,
          );
          debugPrint(
              'LOGIN: Backend returned user: ${user.name}, position=${user.position}, isProfileComplete=${user.isProfileComplete}');

          await auth.login(user, token: idToken);
          AnalyticsService.logLogin(provider: provider, success: true);
          debugPrint(
              'LOGIN: After auth.login, currentUser position=${auth.currentUser?.position}');

          // Sign in with Apple users must not be asked for name/email again
          // per Apple Guideline 4.0. We expand this to all providers to
          // simplify the onboarding flow. If a user already has a name
          // from their credential but no position (first-time), auto-set
          // a default so they skip profile setup.
          if (!user.isProfileComplete) {
            debugPrint('LOGIN: First-time user — auto-completing profile');
            try {
              await ApiService.updateProfile(userId, {
                'position': 'G',
                'height': "6'0\"",
              });
              await auth.updateUserPosition('G');
              debugPrint('LOGIN: Auto-set position=G for new user');
            } catch (e) {
              debugPrint(
                  'LOGIN: Auto-complete failed, will show profile setup: $e');
            }
          }

          // Let the router handle redirect based on user.isProfileComplete
          // The router will redirect to /profile/setup if incomplete, or /play if complete
          if (mounted) {
            context.go(
                '/play'); // Router will intercept and redirect appropriately
          }
        }
      } catch (e) {
        debugPrint('⚠️ Backend auth failed, using local fallback: $e');
        // Create a temporary user object with incomplete profile
        final user = User(
          id: userId,
          name: firebaseUser.displayName ?? 'New User',
          photoUrl: firebaseUser.photoURL,
          // position is null, so isProfileComplete will be false
        );
        // IMPORTANT: Pass token even on fallback so authenticated API calls work
        await auth.login(user, token: idToken);
        AnalyticsService.logLogin(provider: provider, success: false);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                  'Signed in, but server sync failed. Some features may be limited.'),
              duration: Duration(seconds: 4),
            ),
          );
          context.go('/play'); // Router will redirect to /profile/setup
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Login failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.sports_basketball,
                    size: 80,
                    color: Color(0xFFFF6B35), // Orange
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Welcome to HoopRank',
                    style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Track your game, climb the ranks',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),

                  // Sign in with Apple Button (REQUIRED - must be first per Apple Guideline 4.8)
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed:
                          _isLoading ? null : () => _loginWithProvider('apple'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        elevation: 2,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 24,
                            height: 24,
                            child: const Icon(Icons.apple, size: 24),
                          ),
                          const SizedBox(width: 12),
                          const Text(
                            'Continue with Apple',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Google Sign In Button (official branding)
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _isLoading
                          ? null
                          : () => _loginWithProvider('google'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF1F1F1F),
                        elevation: 2,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: BorderSide(color: Colors.grey.shade300),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 24,
                            height: 24,
                            child: SvgPicture.string(
                              '''<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>''',
                              width: 24,
                              height: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Text(
                            'Continue with Google',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Facebook Sign In Button - hidden for now
                  // To re-enable, uncomment this section:
                  /*
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : () => _loginWithProvider('facebook'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1877F2),
                        foregroundColor: Colors.white,
                        elevation: 2,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 24,
                            height: 24,
                            child: const Icon(Icons.facebook, size: 24),
                          ),
                          const SizedBox(width: 12),
                          const Text(
                            'Continue with Facebook',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ),
                  */
                  const SizedBox(height: 24),

                  // "By continuing" text with tappable links
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: const TextStyle(
                          fontSize: 12, color: Colors.grey, height: 1.4),
                      children: [
                        const TextSpan(
                            text: 'By continuing, you agree to our '),
                        TextSpan(
                          text: 'Terms & Conditions',
                          style: const TextStyle(
                            color: Color(0xFF4A90D9),
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                          recognizer: TapGestureRecognizer()
                            ..onTap = () => launchUrl(
                                  Uri.parse(
                                      'https://hooprank-503.web.app/terms'),
                                  mode: LaunchMode.externalApplication,
                                ),
                        ),
                        const TextSpan(text: ' and '),
                        TextSpan(
                          text: 'Privacy Policy',
                          style: const TextStyle(
                            color: Color(0xFF4A90D9),
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                          recognizer: TapGestureRecognizer()
                            ..onTap = () => launchUrl(
                                  Uri.parse(
                                      'https://hooprank-503.web.app/privacy'),
                                  mode: LaunchMode.externalApplication,
                                ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
          // Loading overlay
          if (_isLoading)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Color(0xFFFF6B35)),
                    SizedBox(height: 16),
                    Text('Signing in...',
                        style: TextStyle(color: Colors.white)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

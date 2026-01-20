import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart' as firebase;
import '../state/app_state.dart';
import '../models.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

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
      
      if (provider == 'google') {
        credential = await AuthService.signInWithGoogle();
      } else if (provider == 'facebook') {
        credential = await AuthService.signInWithFacebook();
      }

      if (credential == null || credential.user == null) {
        // User canceled
        setState(() => _isLoading = false);
        return;
      }

      final firebaseUser = credential.user!;
      final userId = firebaseUser.uid;

      // Try to authenticate with backend (required)
      try {
        final idToken = await firebaseUser.getIdToken();
        if (idToken != null) {
          final user = await ApiService.authenticate(
            idToken,
            uid: userId,
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            photoUrl: firebaseUser.photoURL,
            provider: provider,
          );
          await auth.login(user);
          
          // Let the router handle redirect based on user.isProfileComplete
          // The router will redirect to /profile/setup if incomplete, or /play if complete
          if (mounted) {
            context.go('/play'); // Router will intercept and redirect appropriately
          }
        }
      } catch (e) {
        debugPrint('Backend auth failed: $e');
        // Create a temporary user object with incomplete profile
        final user = User(
          id: userId,
          name: firebaseUser.displayName ?? 'New User',
          photoUrl: firebaseUser.photoURL,
          // position is null, so isProfileComplete will be false
        );
        await auth.login(user);
        
        if (mounted) {
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
                  
                  // Google Sign In Button
                  ElevatedButton.icon(
                    onPressed: _isLoading ? null : () => _loginWithProvider('google'),
                    icon: const Icon(Icons.g_mobiledata, size: 28),
                    label: const Text('Continue with Google'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black87,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      elevation: 2,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                        side: BorderSide(color: Colors.grey.shade300),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Facebook Sign In Button
                  ElevatedButton.icon(
                    onPressed: _isLoading ? null : () => _loginWithProvider('facebook'),
                    icon: const Icon(Icons.facebook, size: 24),
                    label: const Text('Continue with Facebook'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1877F2),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      elevation: 2,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  
                  const Text(
                    'By continuing, you agree to our Terms of Service and Privacy Policy',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                    textAlign: TextAlign.center,
                  ),
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
                    Text('Signing in...', style: TextStyle(color: Colors.white)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

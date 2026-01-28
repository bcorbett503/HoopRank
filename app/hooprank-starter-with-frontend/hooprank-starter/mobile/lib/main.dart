import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';

import 'state/app_state.dart';
import 'state/check_in_state.dart';
import 'widgets/scaffold_with_nav_bar.dart';
import 'screens/home_screen.dart';
import 'screens/rankings_screen.dart';

import 'screens/matches_screen.dart';
import 'screens/login_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/profile_setup_screen.dart';
import 'screens/teams_screen.dart';
import 'screens/match_setup_screen.dart';
import 'screens/match_map_screen.dart';
import 'screens/match_live_screen.dart';
import 'screens/match_score_screen.dart';
import 'screens/match_result_screen.dart';
import 'screens/messages_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/network_test_screen.dart';
import 'screens/map_screen.dart';
import 'screens/onboarding_screen.dart';
import 'services/notification_service.dart';
import 'services/court_service.dart';

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background message: ${message.notification?.title}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  
  // Set up background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  // Initialize notification service
  await NotificationService().initialize();
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()),
        ChangeNotifierProvider(create: (_) => MatchState()),
        ChangeNotifierProvider(create: (_) => CheckInState()),
        Provider(create: (_) => CourtService()),
      ],
      child: const HoopRankApp(),
    ),
  );
}

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorHomeKey = GlobalKey<NavigatorState>(debugLabel: 'shellHome');
final _shellNavigatorTeamsKey = GlobalKey<NavigatorState>(debugLabel: 'shellTeams');
final _shellNavigatorRankingsKey = GlobalKey<NavigatorState>(debugLabel: 'shellRankings');

final _shellNavigatorMessagesKey = GlobalKey<NavigatorState>(debugLabel: 'shellMessages');
final _shellNavigatorProfileKey = GlobalKey<NavigatorState>(debugLabel: 'shellProfile');

class HoopRankApp extends StatefulWidget {
  const HoopRankApp({super.key});

  @override
  State<HoopRankApp> createState() => _HoopRankAppState();
}

class _HoopRankAppState extends State<HoopRankApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final authState = context.read<AuthState>();
    final checkInState = context.read<CheckInState>();
    
    // Initialize CheckInState when user changes
    authState.addListener(() {
      final user = authState.currentUser;
      if (user != null) {
        checkInState.initialize(user.id);
      }
    });
    
    // Initialize now if user already logged in
    if (authState.currentUser != null) {
      checkInState.initialize(authState.currentUser!.id);
    }
    
    _router = _createRouter(authState);
  }

  GoRouter _createRouter(AuthState authState) {
    return GoRouter(
      navigatorKey: _rootNavigatorKey,
      initialLocation: '/play',
      refreshListenable: authState,
      redirect: (context, state) {
        final user = authState.currentUser;
        final loggedIn = user != null;
        final isLoggingIn = state.uri.toString() == '/login';
        final isProfileSetup = state.uri.toString() == '/profile/setup';
        final isOnboarding = state.uri.toString() == '/onboarding';

        debugPrint('ROUTER: uri=${state.uri}, loggedIn=$loggedIn, isProfileComplete=${user?.isProfileComplete}, onboardingComplete=${authState.onboardingComplete}');

        // Not logged in - redirect to login (unless already there)
        if (!loggedIn && !isLoggingIn) {
          debugPrint('ROUTER: -> /login (not logged in)');
          return '/login';
        }
        
        // Logged in but profile not complete - force profile setup (except if already on setup or login)
        if (loggedIn && !user.isProfileComplete && !isProfileSetup && !isLoggingIn) {
          debugPrint('ROUTER: -> /profile/setup (profile incomplete)');
          return '/profile/setup';
        }
        
        // Profile complete but onboarding not done - show onboarding (unless already there)
        if (loggedIn && user.isProfileComplete && !authState.onboardingComplete && !isOnboarding && !isProfileSetup) {
          debugPrint('ROUTER: -> /onboarding (first time user)');
          return '/onboarding';
        }
        
        // Profile complete and on login screen - go to home
        if (loggedIn && user.isProfileComplete && isLoggingIn) {
          debugPrint('ROUTER: -> /play (profile complete, leaving login)');
          return '/play';
        }
        
        debugPrint('ROUTER: -> null (no redirect)');
        return null;
      },
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) {
            return ScaffoldWithNavBar(navigationShell: navigationShell);
          },
          branches: [
            // Rankings (now first - far left in nav)
            StatefulShellBranch(
              navigatorKey: _shellNavigatorRankingsKey,
              routes: [
                GoRoute(
                  path: '/rankings',
                  builder: (context, state) => const RankingsScreen(),
                ),
              ],
            ),

            // Messages (swapped - now second)
            StatefulShellBranch(
              navigatorKey: _shellNavigatorMessagesKey,
              routes: [
                GoRoute(
                  path: '/messages',
                  builder: (context, state) => const MessagesScreen(),
                  routes: [
                    GoRoute(
                      path: 'chat/:userId',
                      builder: (context, state) {
                        // Get userId from path params - will need to fetch user data
                        final userId = state.pathParameters['userId'] ?? '';
                        // For now we'll handle the user lookup in ChatScreen
                        return ChatScreen(userId: userId);
                      },
                    ),
                  ],
                ),
              ],
            ),

            // Play (in the middle)
            StatefulShellBranch(
              navigatorKey: _shellNavigatorHomeKey,
              routes: [
                GoRoute(
                  path: '/play',
                  builder: (context, state) => const HomeScreen(),
                ),
                GoRoute(
                  path: '/match/setup',
                  builder: (context, state) => const MatchSetupScreen(),
                ),
                GoRoute(
                  path: '/match/map',
                  builder: (context, state) => const MatchMapScreen(),
                ),
                GoRoute(
                  path: '/match/live',
                  builder: (context, state) => const MatchLiveScreen(),
                ),
                GoRoute(
                  path: '/match/score',
                  builder: (context, state) => const MatchScoreScreen(),
                ),
                GoRoute(
                  path: '/match/result',
                  builder: (context, state) => const MatchResultScreen(),
                ),
              ],
            ),

            // Teams (replaced Map)
            StatefulShellBranch(
              navigatorKey: _shellNavigatorTeamsKey,
              routes: [
                GoRoute(
                  path: '/teams',
                  builder: (context, state) => const TeamsScreen(),
                ),
              ],
            ),

            // Courts (replaced Profile)
            StatefulShellBranch(
              navigatorKey: _shellNavigatorProfileKey,
              routes: [
                GoRoute(
                  path: '/courts',
                  builder: (context, state) => const MapScreen(),
                ),
              ],
            ),
          ],
        ),
        GoRoute(
          path: '/matches',
          builder: (context, state) => const MatchesScreen(),
        ),
        // Player profile - navigate to chat which shows profile and allows messaging
        GoRoute(
          path: '/players/:id',
          builder: (context, state) {
            final playerId = state.pathParameters['id'] ?? '';
            return ChatScreen(userId: playerId);
          },
        ),
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/profile/setup',
          builder: (context, state) => const ProfileSetupScreen(),
        ),
        GoRoute(
          path: '/test',
          builder: (context, state) => const NetworkTestScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
        GoRoute(
          path: '/onboarding',
          builder: (context, state) => OnboardingScreen(
            onComplete: () => context.go('/play'),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'HoopRank',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFFFF6B35), // Orange from basketball
          secondary: const Color(0xFF00D9A3), // Green from arrow
          surface: const Color(0xFF2C3E50), // Dark blue background
          background: const Color(0xFF1A252F), // Darker blue-grey
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: Colors.white,
          onBackground: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFF1A252F),
        cardColor: const Color(0xFF2C3E50),
        useMaterial3: true,
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF2C3E50),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFFF6B35),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
        cardTheme: const CardThemeData(
          color: Color(0xFF2C3E50),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
        ),
      ),
      routerConfig: _router,
    );
  }
}

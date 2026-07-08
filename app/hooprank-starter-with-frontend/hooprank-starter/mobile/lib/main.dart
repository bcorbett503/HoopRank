import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';
import 'services/analytics_service.dart';
import 'services/appsflyer_service.dart';

import 'state/app_state.dart';
import 'state/check_in_state.dart';
import 'state/onboarding_checklist_state.dart';
import 'widgets/scaffold_with_nav_bar.dart';
import 'screens/home_map_hub_screen.dart';
import 'screens/home_screen.dart';
import 'screens/rankings_screen.dart';

import 'screens/login_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/profile_setup_screen.dart';
import 'screens/teams_screen.dart';
import 'screens/quick_play_screen.dart';
import 'screens/scan_match_screen.dart';
import 'screens/match_setup_screen.dart';
import 'screens/match_map_screen.dart';
import 'screens/match_live_screen.dart';
import 'screens/match_score_screen.dart';
import 'screens/match_result_screen.dart';
import 'screens/messages_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/network_test_screen.dart';
import 'screens/map_screen.dart';
import 'navigation/auth_redirect.dart';
import 'services/notification_service.dart';
import 'services/court_service.dart';

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background message: ${message.notification?.title}');
}

void main() {
  // Keep binding initialization + runApp in the same zone.
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // Initialize Crashlytics — catch all Flutter framework errors
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;

    // Set up background message handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Initialize notification service
    await NotificationService().initialize();

    // Initialize attribution + in-app event tracking without blocking app launch.
    unawaited(AppsFlyerService.initialize());

    runApp(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthState()),
          ChangeNotifierProvider(create: (_) => MatchState()),
          ChangeNotifierProvider(create: (_) => CheckInState()),
          ChangeNotifierProvider(create: (_) => OnboardingChecklistState()),
          Provider(create: (_) => CourtService()),
        ],
        child: const HoopRankApp(),
      ),
    );
  }, (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  });
}

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorHomeKey =
    GlobalKey<NavigatorState>(debugLabel: 'shellHome');
final _shellNavigatorCalendarKey =
    GlobalKey<NavigatorState>(debugLabel: 'shellCalendar');
final _shellNavigatorRankingsKey =
    GlobalKey<NavigatorState>(debugLabel: 'shellRankings');

final _shellNavigatorMessagesKey =
    GlobalKey<NavigatorState>(debugLabel: 'shellMessages');
final _shellNavigatorProfileKey =
    GlobalKey<NavigatorState>(debugLabel: 'shellProfile');

class HoopRankApp extends StatefulWidget {
  const HoopRankApp({super.key});

  @override
  State<HoopRankApp> createState() => _HoopRankAppState();
}

class _HoopRankAppState extends State<HoopRankApp> {
  GoRouter? _router;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    if (!_initialized) {
      _initialized = true;

      final authState = context.read<AuthState>();
      final checkInState = context.read<CheckInState>();
      final onboardingState = context.read<OnboardingChecklistState>();

      // Initialize states
      onboardingState.initialize();

      // Wire onboarding hooks into centralized state managers
      CheckInState.onCourtFollowed = () {
        onboardingState.completeItem(OnboardingItems.followCourt);
      };

      // Initialize CheckInState and analytics when user changes
      authState.addListener(() {
        final user = authState.currentUser;
        if (user != null) {
          checkInState.initialize(user.id);
          // Re-initialize onboarding for the new user (scoped to their userId)
          onboardingState.initializeForUser(user.id);
          // Set user identity for crash reports and analytics
          FirebaseCrashlytics.instance.setUserIdentifier(user.id);
          AnalyticsService.setUserId(user.id);
        }
      });

      // Initialize now if user already logged in
      if (authState.currentUser != null) {
        checkInState.initialize(authState.currentUser!.id);
        FirebaseCrashlytics.instance
            .setUserIdentifier(authState.currentUser!.id);
        AnalyticsService.setUserId(authState.currentUser!.id);
      }

      _router = _createRouter(authState);
      NotificationService.setRouter(_router!);
    }
  }

  GoRouter _createRouter(AuthState authState) {
    return GoRouter(
      navigatorKey: _rootNavigatorKey,
      initialLocation: '/play',
      refreshListenable: authState,
      observers: [AnalyticsService.observer],
      redirect: (context, state) {
        final user = authState.currentUser;
        final loggedIn = user != null;
        final isAnonymousSession = authState.isAnonymousSession;

        debugPrint(
            'ROUTER: uri=${state.uri}, loggedIn=$loggedIn, isProfileComplete=${user?.isProfileComplete}');
        final redirect = resolveAuthRedirect(
          user: user,
          isAnonymousSession: isAnonymousSession,
          uri: state.uri,
        );
        debugPrint('ROUTER: -> ${redirect ?? 'null'}');
        return redirect;
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
              observers: [AnalyticsService.observer],
              routes: [
                GoRoute(
                  name: 'rankings',
                  path: '/rankings',
                  builder: (context, state) {
                    final region = state.uri.queryParameters['region'];
                    return RankingsScreen(
                      // Key forces widget recreation when query params change
                      key: ValueKey(state.uri.toString()),
                      initialRegion: region,
                    );
                  },
                ),
              ],
            ),

            // Messages (swapped - now second)
            StatefulShellBranch(
              navigatorKey: _shellNavigatorMessagesKey,
              observers: [AnalyticsService.observer],
              routes: [
                GoRoute(
                  name: 'messages',
                  path: '/messages',
                  builder: (context, state) => const MessagesScreen(),
                  routes: [
                    GoRoute(
                      name: 'chat',
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
              observers: [AnalyticsService.observer],
              routes: [
                GoRoute(
                  name: 'play',
                  path: '/play',
                  builder: (context, state) => const HomeMapHubScreen(),
                  routes: [
                    GoRoute(
                      name: 'play_feed',
                      path: 'feed',
                      builder: (context, state) => const HomeScreen(),
                    ),
                  ],
                ),
                GoRoute(
                  name: 'quick_play',
                  path: '/quick-play',
                  builder: (context, state) => const QuickPlayScreen(),
                ),
                GoRoute(
                  name: 'scan_match',
                  path: '/quick-play/scan',
                  builder: (context, state) => const ScanMatchScreen(),
                ),
                GoRoute(
                  name: 'match_setup',
                  path: '/match/setup',
                  builder: (context, state) => const MatchSetupScreen(),
                ),
                GoRoute(
                  name: 'match_map',
                  path: '/match/map',
                  builder: (context, state) => const MatchMapScreen(),
                ),
                GoRoute(
                  name: 'match_live',
                  path: '/match/live',
                  builder: (context, state) => const MatchLiveScreen(),
                ),
                GoRoute(
                  name: 'match_score',
                  path: '/match/score',
                  builder: (context, state) => const MatchScoreScreen(),
                ),
                GoRoute(
                  name: 'match_result',
                  path: '/match/result',
                  builder: (context, state) => const MatchResultScreen(),
                ),
              ],
            ),

            // Calendar
            StatefulShellBranch(
              navigatorKey: _shellNavigatorCalendarKey,
              observers: [AnalyticsService.observer],
              routes: [
                GoRoute(
                  name: 'calendar',
                  path: '/calendar',
                  builder: (context, state) => const CalendarScreen(),
                ),
              ],
            ),

            // Courts (replaced Profile)
            StatefulShellBranch(
              navigatorKey: _shellNavigatorProfileKey,
              observers: [AnalyticsService.observer],
              routes: [
                GoRoute(
                  name: 'courts',
                  path: '/courts',
                  builder: (context, state) {
                    // Support deep linking to a specific court via multiple methods
                    final courtId = state.uri.queryParameters['courtId'];
                    final lat =
                        double.tryParse(state.uri.queryParameters['lat'] ?? '');
                    final lng =
                        double.tryParse(state.uri.queryParameters['lng'] ?? '');
                    final courtName = state.uri.queryParameters['courtName'];
                    return MapScreen(
                      initialCourtId: courtId,
                      initialLat: lat,
                      initialLng: lng,
                      initialCourtName: courtName,
                    );
                  },
                ),
              ],
            ),
          ],
        ),

        // Player profile - navigate to chat which shows profile and allows messaging
        GoRoute(
          name: 'player_profile',
          path: '/players/:id',
          builder: (context, state) {
            final playerId = state.pathParameters['id'] ?? '';
            return ChatScreen(userId: playerId);
          },
        ),
        GoRoute(
          name: 'login',
          path: '/login',
          builder: (context, state) => LoginScreen(
            returnTo: state.uri.queryParameters['returnTo'],
          ),
        ),
        GoRoute(
          path: '/claim-account',
          builder: (context, state) => LoginScreen(
            claimMode: true,
            returnTo: state.uri.queryParameters['returnTo'],
          ),
        ),
        GoRoute(
          path: '/join',
          builder: (context, state) => ScanMatchScreen(
            initialCode: state.uri.queryParameters['code'],
          ),
        ),
        GoRoute(
          name: 'profile_setup',
          path: '/profile/setup',
          builder: (context, state) => ProfileSetupScreen(
            returnTo: state.uri.queryParameters['returnTo'],
          ),
        ),
        GoRoute(
          name: 'network_test',
          path: '/test',
          builder: (context, state) => const NetworkTestScreen(),
        ),
        GoRoute(
          name: 'profile',
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
        GoRoute(
          name: 'teams',
          path: '/teams',
          builder: (context, state) => const TeamsScreen(),
        ),
        // Root path fallback - redirect to play
        GoRoute(
          path: '/',
          redirect: (context, state) => '/play',
        ),
        // Old onboarding removed - now using interactive tutorial overlay
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    // Show loading while router is initializing
    if (_router == null) {
      return const MaterialApp(
        home: Scaffold(
          backgroundColor: Color(0xFF1A252F),
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return MaterialApp.router(
      title: 'HoopRank',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFF6B35), // Orange from basketball
          secondary: Color(0xFF00D9A3), // Green from arrow
          surface: Color(0xFF2C3E50), // Dark blue background
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: Colors.white,
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
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
        cardTheme: const CardThemeData(
          color: Color(0xFF2C3E50),
          elevation: 2,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(12))),
        ),
      ),
      routerConfig: _router!,
    );
  }
}

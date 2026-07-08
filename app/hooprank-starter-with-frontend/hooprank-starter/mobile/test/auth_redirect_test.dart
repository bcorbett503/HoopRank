import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/models.dart';
import 'package:hooprank/navigation/auth_redirect.dart';

void main() {
  group('resolveAuthRedirect', () {
    test('preserves the requested route when redirecting to login', () {
      final redirect = resolveAuthRedirect(
        user: null,
        isAnonymousSession: false,
        uri: Uri.parse('/calendar'),
      );

      expect(redirect, '/login?returnTo=%2Fcalendar');
    });

    test('returns claimed users to their requested route after login', () {
      final redirect = resolveAuthRedirect(
        user: User(
          id: 'claimed-user-1',
          name: 'Claimed Player',
          rating: 3.0,
          matchesPlayed: 1,
          position: 'PG',
        ),
        isAnonymousSession: false,
        uri: Uri.parse('/login?returnTo=/calendar'),
      );

      expect(redirect, '/calendar');
    });

    test('redirects anonymous guests away from profile setup to claim account',
        () {
      final redirect = resolveAuthRedirect(
        user: User(
          id: 'guest-user-1',
          name: 'Guest Player',
          rating: 3.0,
          matchesPlayed: 1,
        ),
        isAnonymousSession: true,
        uri: Uri.parse('/profile/setup?returnTo=/match/result'),
      );

      expect(redirect, '/claim-account?returnTo=%2Fmatch%2Fresult');
    });

    test('keeps anonymous guests on deferable match flow routes', () {
      final redirect = resolveAuthRedirect(
        user: User(
          id: 'guest-user-1',
          name: 'Guest Player',
          rating: 3.0,
          matchesPlayed: 1,
        ),
        isAnonymousSession: true,
        uri: Uri.parse('/match/result'),
      );

      expect(redirect, isNull);
    });

    test('redirects incomplete claimed users to profile setup', () {
      final redirect = resolveAuthRedirect(
        user: User(
          id: 'claimed-user-1',
          name: 'Claimed Player',
          rating: 3.0,
          matchesPlayed: 1,
        ),
        isAnonymousSession: false,
        uri: Uri.parse('/profile'),
      );

      expect(redirect, '/profile/setup');
    });
  });
}

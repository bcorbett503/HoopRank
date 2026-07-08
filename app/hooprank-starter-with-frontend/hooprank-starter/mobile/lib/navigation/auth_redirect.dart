import '../models.dart';

String sanitizeAuthReturnToPath(
  String? candidate, {
  String fallback = '/play',
}) {
  final trimmed = candidate?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return fallback;
  }
  if (!trimmed.startsWith('/')) {
    return fallback;
  }
  if (trimmed == '/login' || trimmed == '/claim-account') {
    return fallback;
  }
  return trimmed;
}

String buildClaimAccountRoute({
  required String? returnTo,
}) {
  return Uri(
    path: '/claim-account',
    queryParameters: <String, String>{
      'returnTo': sanitizeAuthReturnToPath(returnTo),
    },
  ).toString();
}

String buildLoginRoute({
  required String? returnTo,
}) {
  return Uri(
    path: '/login',
    queryParameters: <String, String>{
      'returnTo': sanitizeAuthReturnToPath(returnTo),
    },
  ).toString();
}

String? resolveAuthRedirect({
  required User? user,
  required bool isAnonymousSession,
  required Uri uri,
}) {
  final loggedIn = user != null;
  final path = uri.path;
  final isLoggingIn = path == '/login';
  final isClaimingAccount = path == '/claim-account';
  final isJoiningMatch = path == '/join';
  final isProfileSetup = path == '/profile/setup';
  final canDeferProfileSetup = path == '/play' ||
      path == '/join' ||
      path == '/quick-play' ||
      path == '/quick-play/scan' ||
      path.startsWith('/match/');

  if (!loggedIn && !isLoggingIn && !isClaimingAccount && !isJoiningMatch) {
    return buildLoginRoute(returnTo: uri.toString());
  }

  if (!loggedIn && isClaimingAccount) {
    return buildLoginRoute(returnTo: uri.queryParameters['returnTo']);
  }

  if (loggedIn && isClaimingAccount && !isAnonymousSession) {
    return sanitizeAuthReturnToPath(uri.queryParameters['returnTo']);
  }

  if (loggedIn &&
      isAnonymousSession &&
      !isLoggingIn &&
      !isClaimingAccount &&
      !canDeferProfileSetup) {
    final returnTo =
        isProfileSetup ? uri.queryParameters['returnTo'] : uri.toString();
    return buildClaimAccountRoute(returnTo: returnTo);
  }

  if (loggedIn &&
      !isAnonymousSession &&
      !user.isProfileComplete &&
      !isProfileSetup &&
      !isLoggingIn &&
      !isClaimingAccount &&
      !canDeferProfileSetup) {
    return '/profile/setup';
  }

  if (loggedIn &&
      user.isProfileComplete &&
      (isLoggingIn || isClaimingAccount) &&
      !isAnonymousSession) {
    return sanitizeAuthReturnToPath(uri.queryParameters['returnTo']);
  }

  return null;
}

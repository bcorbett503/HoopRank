import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';
import '../state/app_state.dart';
import '../state/onboarding_checklist_state.dart';
import '../utils/default_avatar_variants.dart';
import '../utils/flat_avatar.dart';
import 'permission_prompt_sheet.dart';

const String _kSeenAcceptChallengesPrompt = 'seen_accept_challenges_prompt_v1';
const String kSeenMapVisibilityPrompt = 'seen_map_visibility_prompt_v1';

/// The current user's avatar SVG for the permission hero — their flat avatar if
/// they've made one, otherwise a distinct default seeded from their id.
String? _currentUserAvatarSvg(BuildContext context) {
  final user = context.read<AuthState>().currentUser;
  if (user == null) return null;
  return flatAvatarSvg(user.avatarConfig) ?? defaultAvatarSvgForId(user.id);
}

/// "Put Yourself on the Map" — the location / map-visibility opt-in.
/// Returns true if the user chose to go live. The caller performs the actual
/// enable so it can grab GPS and refresh the hub.
Future<bool> showMapVisibilityPrompt(BuildContext context) async {
  final accepted = await PermissionPromptSheet.show(
    context,
    title: 'Put Yourself on the Map',
    message: 'Share your location so players and courts near you can find you. '
        'You can go hidden any time.',
    avatarSvg: _currentUserAvatarSvg(context),
    accentIcon: Icons.location_on_rounded,
    accent: const Color(0xFF1EBEA9),
    primaryLabel: 'Go Live on the Map',
  );
  return accepted == true;
}

/// "Accept Challenges" — opt in to letting nearby players challenge you.
/// Persists the choice (backend + local user) and marks the onboarding step.
/// Returns the choice (true = accepting), or null if dismissed without choosing.
Future<bool?> showAcceptChallengesPrompt(BuildContext context) async {
  final accepted = await PermissionPromptSheet.show(
    context,
    title: 'Accept Challenges',
    message: 'Let players near you challenge you to a game. You get a heads-up '
        'for each one and can always accept or decline.',
    avatarSvg: _currentUserAvatarSvg(context),
    accentIcon: Icons.flash_on_rounded,
    accent: const Color(0xFFFF6B35),
    primaryLabel: 'Accept Challenges',
  );
  if (accepted == null || !context.mounted) return accepted;

  final auth = context.read<AuthState>();
  final user = auth.currentUser;
  if (user == null) return accepted;

  // Persist to the backend (best-effort) and the local user immediately so the
  // map marker / status reflect it right away.
  try {
    await ApiService.updateProfile(user.id, {'acceptingChallenges': accepted});
  } catch (e) {
    debugPrint('acceptingChallenges sync failed (continuing): $e');
  }
  await auth.updateUserPosition(
    user.position ?? 'G',
    acceptingChallenges: accepted,
  );

  // Making a choice (either way) completes the onboarding step.
  if (context.mounted) {
    try {
      await context
          .read<OnboardingChecklistState>()
          .completeItem(OnboardingItems.acceptChallenge);
    } catch (_) {
      // OnboardingChecklistState may not be in scope everywhere — non-fatal.
    }
  }
  return accepted;
}

/// Shows the Accept Challenges prompt once, ever (first-run onboarding).
/// Safe to call on every map open — it no-ops after the user has seen it.
Future<void> maybeShowAcceptChallengesPrompt(BuildContext context) async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kSeenAcceptChallengesPrompt) == true) return;
  if (!context.mounted) return;
  await showAcceptChallengesPrompt(context);
  await prefs.setBool(_kSeenAcceptChallengesPrompt, true);
}

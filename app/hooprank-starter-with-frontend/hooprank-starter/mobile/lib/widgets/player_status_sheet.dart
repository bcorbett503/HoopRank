import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_service.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
import 'status_composer_sheet.dart';

/// Bottom sheet opened by tapping your own avatar on the map: pick a preset
/// status (or write a custom one) that shows under your marker.
class PlayerStatusSheet {
  static const String challengePreset = 'Looking for a challenge';

  static const List<(IconData, String)> presets = [
    (Icons.flash_on_rounded, challengePreset),
    (Icons.sports_basketball, 'Looking for a run'),
    (Icons.groups_2, 'Looking for a team'),
    (Icons.local_fire_department, 'Just hooping'),
  ];

  static Future<void> show(BuildContext context) async {
    final auth = context.read<AuthState>();
    final checkIn = context.read<CheckInState>();
    final user = auth.currentUser;
    if (user == null) return;

    final current = checkIn.getMyStatus()?.trim();

    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: const Color(0xFF111827),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
              child: Row(
                children: [
                  const Text(
                    'Set your status',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const Spacer(),
                  if (current != null && current.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        current,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
            for (final (icon, label) in presets)
              ListTile(
                leading: Icon(icon, color: const Color(0xFFFF6B35)),
                title: Text(label,
                    style: const TextStyle(color: Colors.white)),
                trailing: current == label
                    ? const Icon(Icons.check_circle,
                        color: Color(0xFF22C55E), size: 20)
                    : null,
                onTap: () => Navigator.pop(sheetContext, label),
              ),
            ListTile(
              leading: const Icon(Icons.edit_outlined, color: Colors.white70),
              title: const Text('Custom status…',
                  style: TextStyle(color: Colors.white70)),
              onTap: () => Navigator.pop(sheetContext, '__custom__'),
            ),
            if (current != null && current.isNotEmpty)
              ListTile(
                leading:
                    const Icon(Icons.close_rounded, color: Colors.white54),
                title: const Text('Clear status',
                    style: TextStyle(color: Colors.white54)),
                onTap: () => Navigator.pop(sheetContext, '__clear__'),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (choice == null || !context.mounted) return;

    if (choice == '__clear__') {
      await checkIn.clearMyStatus();
      return;
    }

    if (choice == '__custom__') {
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => StatusComposerSheet(
          checkInState: checkIn,
          userName: user.name,
          userPhotoUrl: user.photoUrl,
          initialStatus: current,
        ),
      );
      return;
    }

    await checkIn.setMyStatus(
      choice,
      userName: user.name,
      photoUrl: user.photoUrl,
    );

    // "Looking for a challenge" also flips the challenge flag so the marker
    // lights up (and other players see it via the hub feed).
    if (choice == challengePreset && !user.acceptingChallenges) {
      try {
        await ApiService.updateProfile(
            user.id, {'acceptingChallenges': true});
      } catch (e) {
        debugPrint('acceptingChallenges sync failed (continuing): $e');
      }
      await auth.updateUserPosition(
        user.position ?? 'G',
        acceptingChallenges: true,
      );
    }
  }
}

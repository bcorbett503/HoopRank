import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../app_config.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
import '../utils/default_avatar_variants.dart';
import '../utils/flat_avatar.dart';
import 'map_control_buttons.dart';
import 'player_status_sheet.dart';

/// Floating quick actions docked at the bottom of the home map:
/// profile circle (avatar / setup nudge) · Quick Play · share the app.
class MapQuickActions extends StatelessWidget {
  const MapQuickActions({super.key});

  Future<void> _shareApp() async {
    await SharePlus.instance.share(
      ShareParams(
        text: 'Hoop with me on HoopRank — find courts, runs and games '
            'near you. ${AppConfig.appStoreUrlString}',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().currentUser;
    final avatarSvg = flatAvatarSvg(user?.avatarConfig);
    final needsSetup = avatarSvg == null;

    // Status CTA above the bar, then profile + Invite on the left with the
    // Quick Play orb at the true center (lined up with the Home tab below).
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _StatusChip(),
        const SizedBox(height: 10),
        SizedBox(
          height: 76,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ProfileCircle(
                      key: const ValueKey('quick_action_profile'),
                      svg: avatarSvg ?? defaultAvatarSvgForId(user?.id),
                      showNudge: needsSetup,
                      // Setup uses go() (it carries returnTo=/play and returns to
                      // the map on save); the plain profile route must push() so
                      // the map stays underneath and back returns to it.
                      onTap: () => needsSetup
                          ? context.go('/profile/setup?returnTo=/play')
                          : context.push('/profile'),
                    ),
                    const SizedBox(width: 6),
                    _InviteButton(
                      key: const ValueKey('quick_action_share'),
                      onTap: _shareApp,
                    ),
                  ],
                ),
              ),
              QuickPlayOrb(
                key: const ValueKey('quick_action_play'),
                size: 74,
                // push (not go) keeps the map underneath so back returns to it
                onTap: () => context.push('/quick-play'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The status CTA: a frosted pill that always shows — either your current
/// status or an explicit "Set your status" prompt — so updating status is a
/// visible action instead of a hidden tap-your-own-avatar gesture.
class _StatusChip extends StatelessWidget {
  const _StatusChip();

  @override
  Widget build(BuildContext context) {
    final status = context.watch<CheckInState>().getMyStatus()?.trim();
    final hasStatus = status != null && status.isNotEmpty;
    return Container(
      constraints: const BoxConstraints(maxWidth: 250),
      decoration: BoxDecoration(
        color: const Color(0xF2FFFFFF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x0F000000), width: 0.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          key: const ValueKey('quick_action_status'),
          onTap: () => PlayerStatusSheet.show(context),
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  hasStatus
                      ? Icons.flash_on_rounded
                      : Icons.add_comment_rounded,
                  size: 15,
                  color: const Color(0xFFFF6B35),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    hasStatus ? status : 'Set your status',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: kMapControlInk,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 5),
                Icon(Icons.edit_rounded,
                    size: 12, color: kMapControlInk.withValues(alpha: 0.5)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Teal invite circle — shares the app. Icon-only keeps the bar calm; mint
/// stays distinct from the frosted circles and the orange hero.
class _InviteButton extends StatelessWidget {
  final VoidCallback onTap;

  const _InviteButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Invite friends',
      child: Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: const Color(0xFF1EBEA9),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1EBEA9).withValues(alpha: 0.4),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          shape: const CircleBorder(),
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            child: const Icon(Icons.person_add_alt_1_rounded,
                size: 20, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

class _ProfileCircle extends StatelessWidget {
  final String svg;
  final bool showNudge;
  final VoidCallback onTap;

  const _ProfileCircle({
    super.key,
    required this.svg,
    required this.showNudge,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 54,
        height: 54,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.28),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              // Head-and-shoulders crop of the full-body avatar. OverflowBox
              // lets the SVG render larger than the circle so the clip really
              // crops to the head instead of shrinking the whole figure.
              child: ClipOval(
                child: OverflowBox(
                  maxWidth: 78,
                  maxHeight: 104,
                  alignment: Alignment.topCenter,
                  child: SvgPicture.string(
                    svg,
                    width: 78,
                    fit: BoxFit.fitWidth,
                  ),
                ),
              ),
            ),
            if (showNudge)
              Positioned(
                top: -1,
                right: -1,
                child: Container(
                  width: 15,
                  height: 15,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

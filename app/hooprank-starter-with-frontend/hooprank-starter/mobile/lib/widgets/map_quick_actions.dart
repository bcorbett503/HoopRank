import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../app_config.dart';
import '../state/app_state.dart';
import '../utils/default_avatar_variants.dart';
import '../utils/flat_avatar.dart';
import 'map_control_buttons.dart';

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

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _ProfileCircle(
          key: const ValueKey('quick_action_profile'),
          svg: avatarSvg ?? defaultAvatarSvgForId(user?.id),
          showNudge: needsSetup,
          // Setup uses go() (it carries returnTo=/play and returns to the map
          // on save); the plain profile route must push() so the map stays
          // underneath and back returns to it.
          onTap: () => needsSetup
              ? context.go('/profile/setup?returnTo=/play')
              : context.push('/profile'),
        ),
        QuickPlayOrb(
          key: const ValueKey('quick_action_play'),
          // push (not go) keeps the map underneath so back returns to it
          onTap: () => context.push('/quick-play'),
        ),
        FrostedCircleButton(
          key: const ValueKey('quick_action_share'),
          tooltip: 'Share HoopRank',
          onTap: _shareApp,
          child: const CustomPaint(
            size: Size(24, 24),
            painter: ShareIconPainter(),
          ),
        ),
      ],
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


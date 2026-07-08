import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../app_config.dart';
import '../state/app_state.dart';
import '../utils/default_avatar_variants.dart';
import '../utils/flat_avatar.dart';

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
        _QuickPlayButton(
          key: const ValueKey('quick_action_play'),
          // push (not go) keeps the map underneath so back returns to it
          onTap: () => context.push('/quick-play'),
        ),
        _ActionCircle(
          key: const ValueKey('quick_action_share'),
          icon: Icons.ios_share_rounded,
          tooltip: 'Share HoopRank',
          onTap: _shareApp,
        ),
      ],
    );
  }
}

class _QuickPlayButton extends StatelessWidget {
  final VoidCallback onTap;

  const _QuickPlayButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFF6B35),
      borderRadius: BorderRadius.circular(26),
      elevation: 6,
      shadowColor: Colors.black.withValues(alpha: 0.4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(26),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.sports_basketball, color: Colors.white, size: 22),
              SizedBox(width: 8),
              Text(
                'Quick Play',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
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
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            // Head-and-shoulders crop of the full-body avatar.
            child: ClipOval(
              child: Align(
                alignment: Alignment.topCenter,
                child: SvgPicture.string(
                  svg,
                  width: 96,
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

class _ActionCircle extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _ActionCircle({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 6,
      shadowColor: Colors.black.withValues(alpha: 0.4),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: tooltip,
          child: SizedBox(
            width: 54,
            height: 54,
            child: Icon(icon, color: const Color(0xFF111827), size: 24),
          ),
        ),
      ),
    );
  }
}

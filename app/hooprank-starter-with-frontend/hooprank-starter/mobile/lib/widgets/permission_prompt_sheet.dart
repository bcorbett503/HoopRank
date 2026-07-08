import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// A Snapchat-style opt-in / permission bottom sheet: a title, a short
/// explanation, the player's avatar as the hero, and a primary + secondary
/// action. Themed for HoopRank (dark surface, brand accent) rather than the
/// light Snapchat sheet it's modelled on.
///
/// Used for "Put Yourself on the Map" (location) and "Accept Challenges".
/// Returns `true` if the user tapped the primary action, `false` if they
/// declined ("Not now"), and `null` if they dismissed the sheet.
class PermissionPromptSheet extends StatelessWidget {
  final String title;
  final String message;

  /// The player's avatar SVG (flat avatar if set, else a default). Rendered as
  /// the hero illustration.
  final String? avatarSvg;

  /// Accent badge shown over the avatar (e.g. a flash bolt for challenges,
  /// a location pin for the map) and used to tint the primary button.
  final IconData accentIcon;
  final Color accent;

  final String primaryLabel;
  final String secondaryLabel;

  const PermissionPromptSheet({
    super.key,
    required this.title,
    required this.message,
    required this.avatarSvg,
    required this.accentIcon,
    required this.accent,
    required this.primaryLabel,
    this.secondaryLabel = 'Not now',
  });

  static Future<bool?> show(
    BuildContext context, {
    required String title,
    required String message,
    required String? avatarSvg,
    required IconData accentIcon,
    Color accent = const Color(0xFFFF6B35),
    required String primaryLabel,
    String secondaryLabel = 'Not now',
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PermissionPromptSheet(
        title: title,
        message: message,
        avatarSvg: avatarSvg,
        accentIcon: accentIcon,
        accent: accent,
        primaryLabel: primaryLabel,
        secondaryLabel: secondaryLabel,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF141E28),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 22),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 23,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.62),
                  fontSize: 14.5,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 26),
              _AvatarHero(
                avatarSvg: avatarSvg,
                accentIcon: accentIcon,
                accent: accent,
              ),
              const SizedBox(height: 30),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  style: FilledButton.styleFrom(
                    backgroundColor: accent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  child: Text(
                    primaryLabel,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: Text(
                  secondaryLabel,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AvatarHero extends StatelessWidget {
  final String? avatarSvg;
  final IconData accentIcon;
  final Color accent;

  const _AvatarHero({
    required this.avatarSvg,
    required this.accentIcon,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      height: 172,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Soft accent glow behind the avatar.
          Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  accent.withValues(alpha: 0.28),
                  accent.withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
          if (avatarSvg != null)
            SizedBox(
              width: 140,
              height: 150,
              child: SvgPicture.string(avatarSvg!, fit: BoxFit.contain),
            )
          else
            Icon(Icons.person, size: 96, color: Colors.white.withValues(alpha: 0.4)),
          // Accent badge, bottom-right, like the flag/pin in the reference.
          Positioned(
            right: 14,
            bottom: 18,
            child: Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: accent,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF141E28), width: 3),
                boxShadow: [
                  BoxShadow(
                    color: accent.withValues(alpha: 0.5),
                    blurRadius: 12,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Icon(accentIcon, color: Colors.white, size: 22),
            ),
          ),
        ],
      ),
    );
  }
}

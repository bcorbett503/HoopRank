import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/map_hub_models.dart';
import '../utils/avatar_render_policy.dart';
import '../utils/default_avatar_variants.dart';
import '../utils/flat_avatar.dart';
import '../utils/generated_avatar.dart';
import 'avatar_game_mesh_painter.dart';
import 'avatar_image.dart';

class PlayerMapMarker extends StatelessWidget {
  static const markerWidth = 192.0;
  static const markerHeight = 204.0;

  // Avatar figure box (kept a touch smaller so pins read cleanly on the map).
  static const _figureWidth = 140.0;
  static const _figureHeight = 134.0;

  final MapHubPlayer player;
  final VoidCallback? onTap;
  final bool allowDevelopmentAvatarSprite;

  /// When false (zoomed out), other players show only their avatar + name
  /// pill — the status bubble is hidden to keep a dense map readable. The
  /// current user always shows full detail.
  final bool showDetails;

  const PlayerMapMarker({
    super.key,
    required this.player,
    this.onTap,
    this.allowDevelopmentAvatarSprite = false,
    this.showDetails = true,
  });

  /// The current user hasn't customized a flat avatar yet: show the neutral
  /// silhouette and the profile-setup nudge badge.
  bool get needsAvatarSetup =>
      player.isCurrentUser && flatAvatarSvg(player.avatarConfig) == null;

  @override
  Widget build(BuildContext context) {
    // Every mapped player shows a default avatar to all viewers: their own
    // flat avatar if they've set one, otherwise a distinct default seeded
    // deterministically from their id (so every viewer renders the same
    // person). Only legacy generated configs fall through to the procedural
    // render path.
    final flatSvg = flatAvatarSvg(player.avatarConfig) ??
        (isGeneratedAvatarConfig(player.avatarConfig)
            ? null
            : defaultAvatarSvgForId(player.id));
    final generatedConfig = isGeneratedAvatarConfig(player.avatarConfig)
        ? HoopRankAvatarConfig.fromJson(player.avatarConfig!)
        : _fallbackAvatarConfig(player);
    final accent = player.acceptingChallenges
        ? const Color(0xFFFF6B35)
        : player.isCurrentUser
            ? const Color(0xFF22C55E)
            : player.isNewPlayer
                ? const Color(0xFF22C55E)
                : const Color(0xFF38BDF8);
    const figureTop = 34.0;
    const statusTop = 170.0;

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: markerWidth,
        height: markerHeight,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            Positioned(
              top: 0,
              // Current user keeps the rank badge ("ELITE 4.67"); other
              // players lead with WHO they are: "FirstName · 3.4".
              child: _RankBadge(
                rating: player.rating,
                accent: accent,
                name: player.isCurrentUser ? null : player.name,
              ),
            ),
            Positioned(
              top: figureTop,
              child: flatSvg != null
                  ? SizedBox(
                      key: const ValueKey('flat_avatar_figure'),
                      width: _figureWidth,
                      height: _figureHeight,
                      child: SvgPicture.string(
                        flatSvg,
                        fit: BoxFit.contain,
                      ),
                    )
                  : SizedBox(
                      width: _figureWidth,
                      height: _figureHeight,
                      child: FittedBox(
                        fit: BoxFit.contain,
                        child: _FullBodyAvatarFigure(
                          generatedConfig: generatedConfig,
                          accent: accent,
                          allowDevelopmentAvatarSprite:
                              allowDevelopmentAvatarSprite,
                        ),
                      ),
                    ),
            ),
            if (needsAvatarSetup)
              const Positioned(
                top: 30,
                left: 26,
                child: _SetupNudgeBadge(),
              ),
            if (showDetails || player.isCurrentUser)
              Positioned(
                top: statusTop,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 160),
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.18),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (player.acceptingChallenges) ...[
                      Icon(
                        Icons.flash_on_rounded,
                        size: 13,
                        color: accent,
                      ),
                      const SizedBox(width: 4),
                    ],
                    if (player.isCurrentUser) ...[
                      const Text(
                        'Me',
                        style: TextStyle(
                          color: Color(0xFF111827),
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(width: 5),
                    ],
                    Flexible(
                      child: Text(
                        player.statusLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: player.isCurrentUser
                              ? const Color(0xFF15803D)
                              : player.acceptingChallenges
                                  ? const Color(0xFFEA580C)
                                  : player.isNewPlayer
                                      ? const Color(0xFF15803D)
                                      : const Color(0xFF374151),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  HoopRankAvatarConfig _fallbackAvatarConfig(MapHubPlayer player) {
    final seed = player.id.trim().isNotEmpty ? player.id : player.name;
    final hash = _stableHash(seed);
    final base = avatarBasePersonPresets[hash % avatarBasePersonPresets.length];
    final hairOptions = ['fade', 'straight', 'curls', 'locs', 'braids', 'buzz'];
    final outfitOptions = ['jersey', 'tee', 'hoodie', 'warmups'];
    return HoopRankAvatarConfig.fromJson(
      buildGeneratedAvatarConfig(
        seed: seed,
        label: player.name,
        variant: hash,
        position: player.position ?? 'G',
        baseAppearance: base.value,
        hairStyle: hairOptions[(hash ~/ 5) % hairOptions.length],
        outfit: outfitOptions[(hash ~/ 11) % outfitOptions.length],
        stance: player.acceptingChallenges ? 'tripleThreat' : 'crossedArms',
        jerseyNumber: ((hash % 89) + 1).toString(),
      ),
    );
  }

  int _stableHash(String value) {
    var hash = 17;
    for (final unit in value.codeUnits) {
      hash = (hash * 37 + unit) & 0x7fffffff;
    }
    return hash;
  }
}

/// Circular nudge shown on the current user's neutral avatar until they
/// finish profile setup: person icon with a red notification dot.
class _SetupNudgeBadge extends StatelessWidget {
  const _SetupNudgeBadge();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      key: const ValueKey('setup_nudge_badge'),
      width: 40,
      height: 40,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFF4581B), width: 2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 6,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: const Icon(
              Icons.person_add_alt_1,
              size: 19,
              color: Color(0xFFF4581B),
            ),
          ),
          Positioned(
            top: -2,
            right: -2,
            child: Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RankBadge extends StatelessWidget {
  final double rating;
  final Color accent;

  /// When set, the badge reads "FirstName · 3.4" instead of the rank label —
  /// used for OTHER players, where identity beats rank tier on a busy map.
  final String? name;

  const _RankBadge({
    required this.rating,
    required this.accent,
    this.name,
  });

  String get _label {
    final first = name?.trim().split(RegExp(r'\s+')).first ?? '';
    if (first.isNotEmpty) {
      return '$first · ${rating.toStringAsFixed(1)}';
    }
    return '${_rankLabel(rating).toUpperCase()} ${rating.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 142),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFF111827).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.workspace_premium_rounded,
            size: 13,
            color: accent,
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              _label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w900,
                height: 1,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _rankLabel(double rating) {
    if (rating >= 5.0) return 'Legend';
    if (rating >= 4.5) return 'Elite';
    if (rating >= 4.0) return 'Pro';
    if (rating >= 3.5) return 'All-Star';
    if (rating >= 3.0) return 'Starter';
    if (rating >= 2.5) return 'Bench';
    if (rating >= 2.0) return 'Rookie';
    return 'New';
  }
}

class _FullBodyAvatarFigure extends StatelessWidget {
  final HoopRankAvatarConfig generatedConfig;
  final Color accent;
  final bool allowDevelopmentAvatarSprite;

  const _FullBodyAvatarFigure({
    required this.generatedConfig,
    required this.accent,
    required this.allowDevelopmentAvatarSprite,
  });

  @override
  Widget build(BuildContext context) {
    final config = generatedConfig;
    final primary = _colorFromHex(config.primaryColor) ?? accent;
    final secondary =
        _colorFromHex(config.secondaryColor) ?? const Color(0xFF111827);
    final configJson = config.toJson();
    final basePreset = avatarBasePersonPresetFor(config.baseAppearance);
    final skin = _colorFromHex(generatedAvatarSkinToneHex(configJson)) ??
        const Color(0xFF6F3F2A);
    final hair = _colorFromHex(generatedAvatarHairColorHex(configJson)) ??
        const Color(0xFF111827);
    final heightScale = generatedAvatarHeightScale(configJson);
    final bodyWidthScale = generatedAvatarBodyWidthScale(configJson);
    final renderPlan = resolvePlayerMapAvatarRenderPlan(
      avatarConfig: configJson,
      allowDevelopmentAvatarSprite: allowDevelopmentAvatarSprite,
    );

    Widget paintedFigure() {
      return Stack(
        alignment: Alignment.topCenter,
        children: [
          Positioned.fill(
            child: Transform.scale(
              alignment: Alignment.bottomCenter,
              scaleX: bodyWidthScale,
              scaleY: heightScale,
              child: RepaintBoundary(
                child: CustomPaint(
                  painter: AvatarGameMeshPainter(
                    config: config,
                    basePreset: basePreset,
                    skinTone: skin,
                    hairColor: hair,
                    primary: primary,
                    secondary: secondary,
                    compact: true,
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }

    if (renderPlan.usesImage) {
      final imageFallback = renderPlan.allowProceduralPainterFallback
          ? paintedFigure()
          : const _ProductionAvatarMissingFigure();
      return SizedBox(
        key: const ValueKey('full_body_avatar_figure'),
        width: 164,
        height: 158,
        child: Transform(
          alignment: Alignment.bottomCenter,
          transform: Matrix4.diagonal3Values(
            renderPlan.imageScaleX,
            renderPlan.imageScaleY,
            1,
          ),
          child: HoopRankAvatarImage(
            imageUrl: renderPlan.imageUrl,
            fit: BoxFit.contain,
            fallback: imageFallback,
          ),
        ),
      );
    }

    if (renderPlan.usesPlaceholder) {
      return const SizedBox(
        key: ValueKey('full_body_avatar_figure'),
        width: 164,
        height: 158,
        child: _ProductionAvatarMissingFigure(),
      );
    }

    return SizedBox(
      key: const ValueKey('full_body_avatar_figure'),
      width: 164,
      height: 158,
      child: paintedFigure(),
    );
  }
}

class _ProductionAvatarMissingFigure extends StatelessWidget {
  const _ProductionAvatarMissingFigure();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Icon(
        Icons.view_in_ar_rounded,
        color: Colors.white.withValues(alpha: .58),
        size: 54,
      ),
    );
  }
}

Color? _colorFromHex(String? value) {
  if (value == null) return null;
  final cleaned = value.replaceFirst('#', '').trim();
  if (cleaned.length != 6) return null;
  final parsed = int.tryParse(cleaned, radix: 16);
  if (parsed == null) return null;
  return Color(0xFF000000 | parsed);
}

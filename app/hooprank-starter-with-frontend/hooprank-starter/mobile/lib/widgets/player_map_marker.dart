import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/map_hub_models.dart';
import '../utils/avatar_render_policy.dart';
import '../utils/default_avatar_variants.dart';
import '../utils/flat_avatar.dart';
import '../utils/generated_avatar.dart';
import 'avatar_game_mesh_painter.dart';
import 'avatar_image.dart';

/// Zoomed-out consolidation marker: a group of nearby players renders as
/// the highest-priority member's full avatar with a ghosted teammate behind
/// it and a "N hoopers" pill + count badge — so the map keeps its character
/// (you always see a real player) while the pile-up collapses to one marker.
/// Tapping dives toward the group, which fans out into individual avatars.
class PlayerClusterMarker extends StatelessWidget {
  static const markerWidth = PlayerMapMarker.markerWidth;
  static const markerHeight = PlayerMapMarker.markerHeight;

  static const _figureWidth = 140.0;
  static const _figureHeight = 134.0;

  /// Cluster members, highest priority first (the seed leads the stack).
  final List<MapHubPlayer> members;
  final VoidCallback? onTap;

  const PlayerClusterMarker({
    super.key,
    required this.members,
    this.onTap,
  });

  int get count => members.length;

  String? _svgFor(MapHubPlayer p) =>
      flatAvatarSvg(p.avatarConfig) ?? defaultAvatarSvgForId(p.id);

  @override
  Widget build(BuildContext context) {
    final rep = members.first;
    final ghost = members.length > 1 ? members[1] : null;
    final accent = members.any((p) => p.acceptingChallenges)
        ? const Color(0xFFFF6B35)
        : const Color(0xFF38BDF8);
    final repSvg = _svgFor(rep);
    final ghostSvg = ghost == null ? null : _svgFor(ghost);

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: markerWidth,
        height: markerHeight,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            // "N hoopers" pill where a player's name pill would sit.
            Positioned(
              top: 0,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xF2111827),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.groups_rounded, size: 14, color: accent),
                    const SizedBox(width: 4),
                    Text(
                      '$count hoopers',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Ghosted teammate peeking out behind the lead avatar sells the
            // "stack of players" read without text clutter.
            if (ghostSvg != null)
              Positioned(
                top: 28,
                child: Transform.translate(
                  offset: const Offset(20, 0),
                  child: Opacity(
                    opacity: 0.45,
                    child: SizedBox(
                      width: _figureWidth * 0.92,
                      height: _figureHeight * 0.92,
                      child: SvgPicture.string(ghostSvg, fit: BoxFit.contain),
                    ),
                  ),
                ),
              ),
            Positioned(
              top: 34,
              child: SizedBox(
                key: const ValueKey('player_cluster_lead_avatar'),
                width: _figureWidth,
                height: _figureHeight,
                child: repSvg != null
                    ? SvgPicture.string(repSvg, fit: BoxFit.contain)
                    : const SizedBox.shrink(),
              ),
            ),
            // "+N" badge overlapping the figure's shoulder.
            if (count > 1)
              Positioned(
                top: 44,
                right: 34,
                child: Container(
                  key: const ValueKey('player_cluster_count_badge'),
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xF2111827),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.45),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Text(
                    '+${count - 1}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w900,
                      height: 1,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class PlayerMapMarker extends StatelessWidget {
  static const markerWidth = 192.0;
  static const markerHeight = 204.0;

  /// Extra marker height used when [isRecommended]: the matchup flag sits
  /// above the rank badge, so the whole marker grows by this much.
  static const recommendedFlagExtent = 34.0;

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

  /// When false, ALL labels (name pill + status) are hidden — used by the
  /// map's collision pass when this marker's labels would overlap a
  /// higher-priority player's. The avatar itself always renders.
  final bool showLabels;

  /// Recommended matchup treatment: golden spotlight behind the avatar and
  /// a "Recommended matchup" flag above it, nudging the user to tap and
  /// challenge or message this player. Use the taller
  /// [recommendedFlagExtent]-augmented marker box when set.
  final bool isRecommended;

  const PlayerMapMarker({
    super.key,
    required this.player,
    this.onTap,
    this.allowDevelopmentAvatarSprite = false,
    this.showDetails = true,
    this.showLabels = true,
    this.isRecommended = false,
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
    // The recommended flag occupies the top strip; everything else shifts
    // down by its extent so the avatar/badge layout stays identical.
    final yOff = isRecommended ? recommendedFlagExtent : 0.0;
    const figureTop = 34.0;
    const statusTop = 170.0;

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: markerWidth,
        height: markerHeight + yOff,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            if (isRecommended)
              Positioned(
                top: figureTop + yOff - 10,
                child: const _RecommendedSpotlight(),
              ),
            if (isRecommended)
              const Positioned(
                top: 0,
                child: _RecommendedMatchupFlag(),
              ),
            if (showLabels || player.isCurrentUser)
              Positioned(
                top: yOff,
                // Current user keeps the rank badge ("ELITE 4.67"); other
                // players lead with WHO they are: "FirstName · 3.4".
                child: _RankBadge(
                  rating: player.rating,
                  accent: accent,
                  name: player.isCurrentUser ? null : player.name,
                ),
              ),
            Positioned(
              top: figureTop + yOff,
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
              Positioned(
                top: 30 + yOff,
                left: 26,
                child: const _SetupNudgeBadge(),
              ),
            if ((showDetails && showLabels) || player.isCurrentUser)
              Positioned(
                top: statusTop + yOff,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 160),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
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

/// Golden spotlight glow behind the recommended matchup's avatar so the
/// marker pops against every map style without any animation cost.
class _RecommendedSpotlight extends StatelessWidget {
  const _RecommendedSpotlight();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: 156,
        height: 150,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              const Color(0xFFFFC94D).withValues(alpha: 0.55),
              const Color(0xFFFFB74D).withValues(alpha: 0.22),
              Colors.transparent,
            ],
            stops: const [0.0, 0.55, 1.0],
          ),
        ),
      ),
    );
  }
}

/// "Recommended matchup" pennant that drops in above the avatar — the visual
/// call-to-action to tap the player and challenge or message them.
class _RecommendedMatchupFlag extends StatelessWidget {
  const _RecommendedMatchupFlag();

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 650),
      curve: Curves.elasticOut,
      builder: (context, t, child) {
        return Transform.scale(scale: 0.6 + 0.4 * t, child: child);
      },
      child: Container(
        key: const ValueKey('recommended_matchup_flag'),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFF6B35), Color(0xFFF59E0B)],
          ),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.flag_rounded, size: 14, color: Colors.white),
            SizedBox(width: 4),
            Text(
              'Recommended matchup',
              style: TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
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

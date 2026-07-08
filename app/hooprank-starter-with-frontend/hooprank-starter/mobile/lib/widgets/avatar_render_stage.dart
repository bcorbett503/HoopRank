import 'package:flutter/material.dart';
import 'package:model_viewer_plus/model_viewer_plus.dart';

import '../utils/avatar_model_viewer_runtime.dart';
import '../utils/avatar_render_policy.dart';
import '../utils/generated_avatar.dart';
import 'avatar_game_mesh_painter.dart';
import 'avatar_image.dart';

const _avatarStageBackgroundAsset =
    'assets/avatar_renders/avatar_stage_console_bg.png';

class AvatarRenderStage extends StatelessWidget {
  final String? imageUrl;
  final String? modelUrl;
  final String? modelPosterUrl;
  final String? modelAnimationName;
  final String? modelCameraOrbit;
  final String? modelCameraTarget;
  final String? modelFieldOfView;
  final String? modelScale;
  final Widget? fallback;
  final EdgeInsetsGeometry padding;
  final double avatarScale;
  final Map<String, dynamic>? avatarConfig;
  final bool preferModelViewer;
  final bool allowDevelopmentAvatarSprite;

  const AvatarRenderStage({
    super.key,
    required this.imageUrl,
    this.modelUrl,
    this.modelPosterUrl,
    this.modelAnimationName,
    this.modelCameraOrbit,
    this.modelCameraTarget,
    this.modelFieldOfView,
    this.modelScale,
    this.fallback,
    this.padding = const EdgeInsets.fromLTRB(14, 10, 14, 6),
    this.avatarScale = 1.12,
    this.avatarConfig,
    this.preferModelViewer = false,
    this.allowDevelopmentAvatarSprite = false,
  });

  @override
  Widget build(BuildContext context) {
    final hasModel =
        preferModelViewer && modelUrl != null && modelUrl!.trim().isNotEmpty;

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: DecoratedBox(
        decoration: const BoxDecoration(color: Color(0xFF020617)),
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Stack(
              fit: StackFit.expand,
              children: [
                const Positioned.fill(
                  child: Image(
                    image: AssetImage(_avatarStageBackgroundAsset),
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                  ),
                ),
                Positioned.fill(
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: .18),
                            Colors.transparent,
                            Colors.black.withValues(alpha: .22),
                          ],
                          stops: const [0, .42, 1],
                        ),
                      ),
                    ),
                  ),
                ),
                const Positioned.fill(
                  child: IgnorePointer(
                    child: CustomPaint(painter: _AvatarStageLightingPainter()),
                  ),
                ),
                Positioned.fill(
                  child: Padding(
                    padding: padding,
                    child: hasModel
                        ? _StageModel(
                            modelUrl: modelUrl!,
                            posterUrl: modelPosterUrl ?? imageUrl,
                            animationName: modelAnimationName,
                            cameraOrbit: modelCameraOrbit,
                            cameraTarget: modelCameraTarget,
                            fieldOfView: modelFieldOfView,
                            scale: modelScale,
                            avatarConfig: avatarConfig,
                            fallback: fallback,
                          )
                        : _StageAvatar(
                            imageUrl: imageUrl,
                            fallback: fallback,
                            scale: avatarScale,
                            avatarConfig: avatarConfig,
                            allowDevelopmentAvatarSprite:
                                allowDevelopmentAvatarSprite,
                          ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StageModel extends StatelessWidget {
  final String modelUrl;
  final String? posterUrl;
  final String? animationName;
  final String? cameraOrbit;
  final String? cameraTarget;
  final String? fieldOfView;
  final String? scale;
  final Map<String, dynamic>? avatarConfig;
  final Widget? fallback;

  const _StageModel({
    required this.modelUrl,
    required this.posterUrl,
    required this.animationName,
    required this.cameraOrbit,
    required this.cameraTarget,
    required this.fieldOfView,
    required this.scale,
    required this.avatarConfig,
    required this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    final src = _modelViewerUrl(modelUrl);
    final dynamicScale = _avatarModelScale(avatarConfig);

    if (src == null) {
      return fallback ??
          const Center(
            child: Icon(Icons.person, color: Colors.white54, size: 72),
          );
    }

    return ModelViewer(
      id: hoopRankAvatarModelViewerId,
      src: src,
      poster: _modelViewerPosterUrl(src, posterUrl),
      alt: 'Interactive 3D HoopRank player avatar',
      loading: Loading.eager,
      reveal: Reveal.auto,
      ar: false,
      cameraControls: true,
      disablePan: true,
      disableZoom: true,
      disableTap: true,
      touchAction: TouchAction.panY,
      autoRotate: false,
      autoRotateDelay: 450,
      rotationPerSecond: '14deg',
      interactionPrompt: InteractionPrompt.none,
      cameraOrbit: _emptyToNull(cameraOrbit) ?? '0deg 74deg 3.2m',
      cameraTarget: _emptyToNull(cameraTarget) ?? '0m 1.15m 0m',
      fieldOfView: _emptyToNull(fieldOfView) ?? '20deg',
      minCameraOrbit: '-38deg 66deg 2.7m',
      maxCameraOrbit: '38deg 82deg 4m',
      environmentImage: 'neutral',
      exposure: 1.08,
      shadowIntensity: .58,
      shadowSoftness: .92,
      animationName: _emptyToNull(animationName),
      autoPlay: _emptyToNull(animationName) != null,
      scale: _emptyToNull(dynamicScale) ?? _emptyToNull(scale),
      relatedJs: _avatarMaterialOverrideJs(avatarConfig),
      backgroundColor: Colors.transparent,
      debugLogging: false,
    );
  }
}

class _StageAvatar extends StatelessWidget {
  final String? imageUrl;
  final Widget? fallback;
  final double scale;
  final Map<String, dynamic>? avatarConfig;
  final bool allowDevelopmentAvatarSprite;

  const _StageAvatar({
    required this.imageUrl,
    required this.fallback,
    required this.scale,
    required this.avatarConfig,
    required this.allowDevelopmentAvatarSprite,
  });

  @override
  Widget build(BuildContext context) {
    final heightScale = generatedAvatarHeightScale(avatarConfig);
    final bodyWidthScale = generatedAvatarBodyWidthScale(avatarConfig);
    final clothesTint = _hexColor(
      generatedAvatarClothesTintHex(avatarConfig),
      fallback: const Color(0xFFFF6B35),
    );
    final skinTone = _hexColor(
      generatedAvatarSkinToneHex(avatarConfig),
      fallback: const Color(0xFFC9895F),
    );
    final hairColor = _hexColor(
      generatedAvatarHairColorHex(avatarConfig),
      fallback: const Color(0xFF1F1713),
    );
    final config = isGeneratedAvatarConfig(avatarConfig)
        ? HoopRankAvatarConfig.fromJson(avatarConfig!)
        : null;
    final basePreset = avatarBasePersonPresetFor(config?.baseAppearance);
    final renderPlan = resolveAvatarStageRenderPlan(
      avatarConfig: avatarConfig,
      providedImageUrl: imageUrl,
      allowDevelopmentAvatarSprite: allowDevelopmentAvatarSprite,
    );

    if (config != null) {
      Widget paintedAvatar({required bool includeOuterScale}) {
        final painted = Transform(
          alignment: Alignment.bottomCenter,
          transform: Matrix4.diagonal3Values(bodyWidthScale, heightScale, 1),
          child: CustomPaint(
            painter: AvatarGameMeshPainter(
              config: config,
              basePreset: basePreset,
              skinTone: skinTone,
              hairColor: hairColor,
              primary: clothesTint,
              secondary: _hexColor(
                config.secondaryColor,
                fallback: const Color(0xFF111827),
              ),
            ),
          ),
        );
        if (!includeOuterScale) return painted;
        return Transform.scale(
          alignment: Alignment.bottomCenter,
          scale: scale,
          child: painted,
        );
      }

      if (renderPlan.source == AvatarResolvedRenderSource.productionImage) {
        return _ScaledAvatarImage(
          imageUrl: renderPlan.imageUrl,
          fallback: fallback ?? const _ProductionAvatarUnavailable(),
          scale: scale,
          heightScale: renderPlan.imageScaleY,
          bodyWidthScale: renderPlan.imageScaleX,
        );
      }
      if (renderPlan.source ==
          AvatarResolvedRenderSource.bundledCustomizedSprite) {
        final spriteFallback = renderPlan.allowProceduralPainterFallback
            ? paintedAvatar(includeOuterScale: false)
            : fallback ?? const _ProductionAvatarUnavailable();
        return Transform.scale(
          alignment: Alignment.bottomCenter,
          scale: scale,
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
              fallback: spriteFallback,
            ),
          ),
        );
      }
      if (renderPlan.usesPlaceholder) {
        return fallback ?? const _ProductionAvatarUnavailable();
      }
      return paintedAvatar(includeOuterScale: true);
    }

    return _ScaledAvatarImage(
      imageUrl: imageUrl,
      fallback: fallback,
      scale: scale,
      heightScale: heightScale,
      bodyWidthScale: bodyWidthScale,
    );
  }
}

class _ScaledAvatarImage extends StatelessWidget {
  final String? imageUrl;
  final Widget? fallback;
  final double scale;
  final double heightScale;
  final double bodyWidthScale;

  const _ScaledAvatarImage({
    required this.imageUrl,
    required this.fallback,
    required this.scale,
    required this.heightScale,
    required this.bodyWidthScale,
  });

  @override
  Widget build(BuildContext context) {
    return Transform.scale(
      alignment: Alignment.bottomCenter,
      scale: scale,
      child: Transform(
        alignment: Alignment.bottomCenter,
        transform: Matrix4.diagonal3Values(bodyWidthScale, heightScale, 1),
        child: HoopRankAvatarImage(
          imageUrl: imageUrl,
          fit: BoxFit.contain,
          fallback: fallback ??
              const Center(
                child: Icon(Icons.person, color: Colors.white54, size: 72),
              ),
        ),
      ),
    );
  }
}

class _ProductionAvatarUnavailable extends StatelessWidget {
  const _ProductionAvatarUnavailable();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Icon(
        Icons.view_in_ar_rounded,
        color: Colors.white.withValues(alpha: .46),
        size: 72,
      ),
    );
  }
}

Color _hexColor(String value, {required Color fallback}) {
  final hex = value.trim().replaceFirst('#', '');
  if (hex.length != 6) return fallback;
  final parsed = int.tryParse(hex, radix: 16);
  if (parsed == null) return fallback;
  return Color(0xFF000000 | parsed);
}

String? _modelViewerUrl(String? url) {
  final trimmed = url?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  if (trimmed.startsWith('asset://')) {
    return trimmed.substring('asset://'.length);
  }
  return trimmed;
}

String? _modelViewerPosterUrl(String modelSrc, String? posterUrl) {
  final poster = _modelViewerUrl(posterUrl);
  if (poster == null) return null;

  final posterIsRelative = !poster.startsWith('http://') &&
      !poster.startsWith('https://') &&
      !poster.startsWith('data:') &&
      !poster.startsWith('file://');

  if (posterIsRelative) return null;
  return poster;
}

String? _avatarModelScale(Map<String, dynamic>? avatarConfig) {
  if (!isGeneratedAvatarConfig(avatarConfig)) return null;
  const previewFitScale = .72;
  final height = generatedAvatarHeightScale(avatarConfig) * previewFitScale;
  final width = generatedAvatarBodyWidthScale(avatarConfig) * previewFitScale;
  return '${width.toStringAsFixed(3)} ${height.toStringAsFixed(3)} '
      '${width.toStringAsFixed(3)}';
}

String? _avatarMaterialOverrideJs(Map<String, dynamic>? avatarConfig) {
  final scale = _avatarModelScale(avatarConfig);
  return buildAvatarModelViewerCustomizationJs(
    avatarConfig: avatarConfig,
    modelScale: scale,
  );
}

String? _emptyToNull(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}

class _AvatarStageLightingPainter extends CustomPainter {
  const _AvatarStageLightingPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final haloPaint = Paint()
      ..shader = const RadialGradient(
        colors: [
          Color(0x6638BDF8),
          Color(0x3314B8A6),
          Colors.transparent,
        ],
      ).createShader(
        Rect.fromCircle(
          center: Offset(size.width * .5, size.height * .42),
          radius: size.width * .46,
        ),
      );
    canvas.drawCircle(
      Offset(size.width * .5, size.height * .42),
      size.width * .46,
      haloPaint,
    );

    final topRimPaint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.white.withValues(alpha: .0),
          Colors.white.withValues(alpha: .18),
          Colors.white.withValues(alpha: .0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, 1));
    canvas.drawRect(
      Rect.fromLTWH(size.width * .08, size.height * .075, size.width * .84, 1),
      topRimPaint,
    );

    final spotlightPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          Colors.white.withValues(alpha: .12),
          const Color(0xFFFF6B35).withValues(alpha: .045),
          Colors.transparent,
        ],
      ).createShader(
        Rect.fromCenter(
          center: Offset(size.width * .5, size.height * .76),
          width: size.width * .9,
          height: size.height * .34,
        ),
      );
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.width * .5, size.height * .76),
        width: size.width * .9,
        height: size.height * .34,
      ),
      spotlightPaint,
    );

    final shadowPaint = Paint()
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 28)
      ..color = Colors.black.withValues(alpha: .64);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.width * .5, size.height * .91),
        width: size.width * .58,
        height: size.height * .105,
      ),
      shadowPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _AvatarStageLightingPainter oldDelegate) =>
      false;
}

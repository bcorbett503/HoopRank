import 'generated_avatar.dart';

enum AvatarResolvedRenderSource {
  providedImage,
  productionImage,
  productionSprite,
  developmentBasePreviewSprite,
  bundledCustomizedSprite,
  proceduralPainter,
  placeholder,
}

class AvatarResolvedRenderPlan {
  final AvatarResolvedRenderSource source;
  final String? imageUrl;
  final double imageScaleX;
  final double imageScaleY;
  final bool customizedSpriteMatchesConfig;
  final bool allowProceduralPainterFallback;

  const AvatarResolvedRenderPlan({
    required this.source,
    this.imageUrl,
    this.imageScaleX = 1,
    this.imageScaleY = 1,
    this.customizedSpriteMatchesConfig = false,
    this.allowProceduralPainterFallback = false,
  });

  bool get usesImage => imageUrl != null && imageUrl!.trim().isNotEmpty;

  bool get usesProceduralPainter =>
      source == AvatarResolvedRenderSource.proceduralPainter;

  bool get usesPlaceholder => source == AvatarResolvedRenderSource.placeholder;
}

AvatarResolvedRenderPlan resolveAvatarStageRenderPlan({
  required Map<String, dynamic>? avatarConfig,
  String? providedImageUrl,
  bool allowDevelopmentAvatarSprite = false,
}) {
  final heightScale = generatedAvatarHeightScale(avatarConfig);
  final bodyWidthScale = generatedAvatarBodyWidthScale(avatarConfig);

  if (!isGeneratedAvatarConfig(avatarConfig)) {
    final imageUrl = _emptyToNull(providedImageUrl);
    return imageUrl == null
        ? const AvatarResolvedRenderPlan(
            source: AvatarResolvedRenderSource.placeholder,
          )
        : AvatarResolvedRenderPlan(
            source: AvatarResolvedRenderSource.providedImage,
            imageUrl: imageUrl,
            imageScaleX: bodyWidthScale,
            imageScaleY: heightScale,
          );
  }

  final productionImageUrl = generatedAvatarProductionImageUrl(avatarConfig);
  if (productionImageUrl != null) {
    return AvatarResolvedRenderPlan(
      source: AvatarResolvedRenderSource.productionImage,
      imageUrl: productionImageUrl,
      imageScaleX: bodyWidthScale,
      imageScaleY: heightScale,
    );
  }

  final customizedSpriteUrl = generatedAvatarCustomizedSpriteUrl(
    avatarConfig,
    allowDevelopmentFallback: allowDevelopmentAvatarSprite,
  );
  if (customizedSpriteUrl != null) {
    final matchesConfig =
        generatedAvatarCustomizedSpriteMatchesConfig(avatarConfig);
    return AvatarResolvedRenderPlan(
      source: AvatarResolvedRenderSource.bundledCustomizedSprite,
      imageUrl: customizedSpriteUrl,
      imageScaleX: 1,
      imageScaleY: matchesConfig ? 1 : heightScale,
      customizedSpriteMatchesConfig: matchesConfig,
      allowProceduralPainterFallback:
          generatedAvatarProceduralPainterFallbackAllowed(avatarConfig),
    );
  }

  if (generatedAvatarProceduralPainterFallbackAllowed(avatarConfig)) {
    return const AvatarResolvedRenderPlan(
      source: AvatarResolvedRenderSource.proceduralPainter,
      allowProceduralPainterFallback: true,
    );
  }
  return const AvatarResolvedRenderPlan(
    source: AvatarResolvedRenderSource.placeholder,
  );
}

AvatarResolvedRenderPlan resolvePlayerMapAvatarRenderPlan({
  required Map<String, dynamic>? avatarConfig,
  bool allowDevelopmentAvatarSprite = false,
}) {
  final heightScale = generatedAvatarHeightScale(avatarConfig);
  final bodyWidthScale = generatedAvatarBodyWidthScale(avatarConfig);
  final productionSpriteUrl = generatedAvatarProductionSpriteUrl(avatarConfig);
  if (productionSpriteUrl != null) {
    return AvatarResolvedRenderPlan(
      source: AvatarResolvedRenderSource.productionSprite,
      imageUrl: productionSpriteUrl,
    );
  }

  final basePreviewSpriteUrl = generatedAvatarPreviewSpriteUrl(
    avatarConfig,
    allowDevelopmentBaseRig: allowDevelopmentAvatarSprite,
  );
  if (basePreviewSpriteUrl != null) {
    return AvatarResolvedRenderPlan(
      source: AvatarResolvedRenderSource.developmentBasePreviewSprite,
      imageUrl: basePreviewSpriteUrl,
      imageScaleX: bodyWidthScale,
      imageScaleY: heightScale,
      allowProceduralPainterFallback:
          generatedAvatarProceduralPainterFallbackAllowed(avatarConfig),
    );
  }

  final customizedSpriteUrl = generatedAvatarCustomizedSpriteUrl(
    avatarConfig,
    allowDevelopmentFallback: allowDevelopmentAvatarSprite,
  );
  if (customizedSpriteUrl != null) {
    final matchesConfig =
        generatedAvatarCustomizedSpriteMatchesConfig(avatarConfig);
    return AvatarResolvedRenderPlan(
      source: AvatarResolvedRenderSource.bundledCustomizedSprite,
      imageUrl: customizedSpriteUrl,
      imageScaleX: 1,
      imageScaleY: matchesConfig ? 1 : heightScale,
      customizedSpriteMatchesConfig: matchesConfig,
      allowProceduralPainterFallback:
          generatedAvatarProceduralPainterFallbackAllowed(avatarConfig),
    );
  }

  if (generatedAvatarProceduralPainterFallbackAllowed(avatarConfig)) {
    return const AvatarResolvedRenderPlan(
      source: AvatarResolvedRenderSource.proceduralPainter,
      allowProceduralPainterFallback: true,
    );
  }
  return const AvatarResolvedRenderPlan(
    source: AvatarResolvedRenderSource.placeholder,
  );
}

String? _emptyToNull(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}

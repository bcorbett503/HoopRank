import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/utils/avatar_render_policy.dart';
import 'package:hooprank/utils/generated_avatar.dart';

void main() {
  test('stage plan uses explicit placeholder for generated avatars by default',
      () {
    final config = buildGeneratedAvatarConfig(
      seed: 'stage-policy-player',
      label: 'Stage Policy Player',
      variant: 1,
    );

    final plan = resolveAvatarStageRenderPlan(
      avatarConfig: config,
      providedImageUrl: generatedAvatarDataUrl(config),
    );

    expect(plan.source, AvatarResolvedRenderSource.placeholder);
    expect(plan.usesPlaceholder, isTrue);
    expect(plan.usesImage, isFalse);
    expect(plan.usesProceduralPainter, isFalse);
    expect(plan.allowProceduralPainterFallback, isFalse);
  });

  test('stage plan prefers provider production sprite export', () {
    final config = attachProductionAvatarModel(
      config: buildGeneratedAvatarConfig(
        seed: 'stage-policy-provider-player',
        label: 'Stage Policy Provider Player',
        variant: 1,
      ),
      modelAssetId: 'provider-avatar-stage-policy',
      modelUrl: 'https://cdn.hooprank.test/avatars/stage-policy.glb',
      modelPosterUrl: 'https://cdn.hooprank.test/avatars/stage-policy.webp',
      modelSpriteUrl:
          'https://cdn.hooprank.test/avatars/stage-policy-sprite.webp',
      modelSource: avatarModelSourceExternalGlb,
      modelQualityTier: avatarModelQualityModernGameRig,
    );

    final plan = resolveAvatarStageRenderPlan(
      avatarConfig: config,
      providedImageUrl: generatedAvatarDataUrl(config),
    );

    expect(plan.source, AvatarResolvedRenderSource.productionImage);
    expect(
      plan.imageUrl,
      'https://cdn.hooprank.test/avatars/stage-policy-sprite.webp',
    );
    expect(plan.usesImage, isTrue);
    expect(plan.usesProceduralPainter, isFalse);
  });

  test('map plan uses explicit placeholder when provider sprite is missing',
      () {
    final config = buildGeneratedAvatarConfig(
      seed: 'map-policy-provider-player',
      label: 'Map Policy Provider Player',
      variant: 1,
      modelAssetId: 'provider-avatar-map-policy',
      modelUrl: 'https://cdn.hooprank.test/avatars/map-policy.glb',
      modelSource: avatarModelSourceProvider,
      modelQualityTier: avatarModelQualityModernGameRig,
      modelRigContract: avatarModelRigContractBaseV1,
      modelTopology: avatarModelTopologyReusableBaseRig,
      modelCapabilities: avatarModelBaseRigCapabilities,
    );

    final plan = resolvePlayerMapAvatarRenderPlan(avatarConfig: config);

    expect(plan.source, AvatarResolvedRenderSource.placeholder);
    expect(plan.usesPlaceholder, isTrue);
    expect(plan.usesImage, isFalse);
    expect(plan.usesProceduralPainter, isFalse);
  });

  test('map plan uses provider production sprite export when present', () {
    final config = attachProductionAvatarModel(
      config: buildGeneratedAvatarConfig(
        seed: 'map-policy-sprite-player',
        label: 'Map Policy Sprite Player',
        variant: 1,
      ),
      modelAssetId: 'provider-avatar-map-sprite-policy',
      modelUrl: 'https://cdn.hooprank.test/avatars/map-sprite-policy.glb',
      modelPosterUrl:
          'https://cdn.hooprank.test/avatars/map-sprite-policy.webp',
      modelSpriteUrl:
          'https://cdn.hooprank.test/avatars/map-sprite-policy-sprite.webp',
      modelSource: avatarModelSourceExternalGlb,
      modelQualityTier: avatarModelQualityModernGameRig,
    );

    final plan = resolvePlayerMapAvatarRenderPlan(avatarConfig: config);

    expect(plan.source, AvatarResolvedRenderSource.productionSprite);
    expect(
      plan.imageUrl,
      'https://cdn.hooprank.test/avatars/map-sprite-policy-sprite.webp',
    );
    expect(plan.imageScaleX, 1);
    expect(plan.imageScaleY, 1);
    expect(plan.usesImage, isTrue);
  });
}

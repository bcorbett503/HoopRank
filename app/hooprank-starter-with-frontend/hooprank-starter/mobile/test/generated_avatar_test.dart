import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/utils/generated_avatar.dart';

void main() {
  test('builds a deep basketball avatar config and premium render URL', () {
    final config = buildGeneratedAvatarConfig(
      seed: 'player-1',
      label: 'Maya Buckets',
      variant: 2,
      position: 'G',
      bodyType: 'strong',
      height: 'tall',
      skinTone: 'deep',
      hairStyle: 'braids',
      hairColor: 'blue',
      outfit: 'warmups',
      stance: 'jumper',
      accessory: 'goggles',
      courtVibe: 'proAm',
      jerseyNumber: '7',
    );

    final avatar = HoopRankAvatarConfig.fromJson(config);
    expect(avatar.gender, 'male');
    expect(avatar.baseAppearance, 'black');
    expect(avatar.bodyType, 'medium');
    expect(avatar.height, 'tall');
    expect(avatar.skinTone, 'deep');
    expect(avatar.hairStyle, 'braids');
    expect(avatar.hairColor, 'blue');
    expect(avatar.outfit, 'warmups');
    expect(avatar.stance, 'jumper');
    expect(avatar.accessory, 'goggles');
    expect(avatar.courtVibe, 'proAm');
    expect(avatar.jerseyNumber, '07');
    expect(avatar.modelAssetId, 'player_shooter_01');
    expect(avatar.modelBaseRigAssetId, avatarModelMaleMediumBaseRigAssetId);
    expect(avatar.modelUrl, isNull);
    expect(avatar.modelPosterUrl, isNull);
    expect(avatar.modelAnimationName, isNull);
    expect(avatar.modelCameraOrbit, isNull);
    expect(avatar.modelCameraTarget, isNull);
    expect(avatar.modelFieldOfView, isNull);
    expect(avatar.modelScale, isNull);
    expect(avatar.modelSource, avatarModelSourceProductionDcc);
    expect(avatar.modelQualityTier, avatarModelQualityModernGameRig);
    expect(avatar.modelRigContract, avatarModelRigContractBaseV1);
    expect(avatar.modelTopology, avatarModelTopologyReusableBaseRig);
    expect(avatar.modelCapabilities, containsAll(avatarModelBaseRigCapabilities));

    expect(generatedAvatarDataUrl(config), isEmpty);
    expect(generatedAvatarRenderAssetPath(avatar), nextgen3dWarmupsJumperAsset);
    expect(generatedAvatarPreviewScale(config), closeTo(.972, .0001));
    expect(generatedAvatarHeightScale(config), 1.06);
    expect(generatedAvatarBodyWidthScale(config), 1.0);
    expect(generatedAvatarSkinToneHex(config), '#6F3F2A');
    expect(generatedAvatarHairColorHex(config), '#1D4ED8');
    expect(generatedAvatarClothesTintHex(config), avatar.primaryColor);
    final modelSpec = generatedAvatarModelSpec(config);
    expect(modelSpec, isNull,
        reason: '3D production avatar models are gated off by default');
    expect(generatedAvatarModelUrl(config), isNull);

    final developmentModelSpec = generatedAvatarModelSpec(
      config,
      allowDevelopmentBaseRig: true,
    );
    expect(developmentModelSpec, isNull,
        reason: 'Development rig specs require bundled dev asset opt-in.');
    expect(generatedAvatarProductionImageUrl(config), isNull);
    expect(generatedAvatarFallbackArtworkAllowed(config), isFalse);

    final femaleConfig = avatar.copyWith(gender: 'female').toJson();
    expect(
      generatedAvatarDataUrl(femaleConfig),
      isEmpty,
    );
    expect(
      generatedAvatarRenderAssetPath(
          HoopRankAvatarConfig.fromJson(femaleConfig)),
      nextgen3dFemaleWarmupsJumperAsset,
    );
    expect(generatedAvatarBodyWidthScale(femaleConfig), closeTo(.92, .0001));
  });

  test('explicit provider GLB configs can render through production model path',
      () {
    final config = attachProductionAvatarModel(
      config: buildGeneratedAvatarConfig(
        seed: 'provider-player',
        label: 'Maya Buckets',
        variant: 1,
      ),
      modelAssetId: 'provider-avatar-123',
      modelUrl: 'https://cdn.hooprank.test/avatars/provider-avatar-123.glb',
      modelPosterUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-123.webp',
      modelSpriteUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-123-sprite.webp',
      modelAnimationName: 'idle',
      modelCameraOrbit: '0deg 72deg 3.1m',
      modelCameraTarget: '0m 1.08m 0m',
      modelFieldOfView: '21deg',
      modelScale: '1 1 1',
      modelSource: avatarModelSourceExternalGlb,
      modelQualityTier: avatarModelQualityModernGameRig,
      modelLicense: 'commercial',
      modelAttribution: 'HoopRank provider import test',
    );

    final modelSpec = generatedAvatarModelSpec(config);

    expect(modelSpec, isNotNull);
    expect(modelSpec!.url,
        'https://cdn.hooprank.test/avatars/provider-avatar-123.glb');
    expect(modelSpec.source, avatarModelSourceExternalGlb);
    expect(modelSpec.baseRigAssetId, 'provider-avatar-123');
    expect(modelSpec.qualityTier, avatarModelQualityModernGameRig);
    expect(modelSpec.rigContract, avatarModelRigContractBaseV1);
    expect(modelSpec.topology, avatarModelTopologyReusableBaseRig);
    expect(modelSpec.capabilities, containsAll(avatarModelBaseRigCapabilities));
    expect(modelSpec.license, 'commercial');
    expect(modelSpec.attribution, 'HoopRank provider import test');
    expect(modelSpec.spriteUrl,
        'https://cdn.hooprank.test/avatars/provider-avatar-123-sprite.webp');
    expect(generatedAvatarProductionSpriteUrl(config),
        'https://cdn.hooprank.test/avatars/provider-avatar-123-sprite.webp');

    final roundTrip = HoopRankAvatarConfig.fromJson(config).toJson();
    expect(roundTrip['modelSource'], avatarModelSourceExternalGlb);
    expect(roundTrip['modelBaseRigAssetId'], 'provider-avatar-123');
    expect(roundTrip['modelQualityTier'], avatarModelQualityModernGameRig);
    expect(roundTrip['modelRigContract'], avatarModelRigContractBaseV1);
    expect(roundTrip['modelTopology'], avatarModelTopologyReusableBaseRig);
    expect(
      roundTrip['modelCapabilities'],
      containsAll(avatarModelBaseRigCapabilities),
    );
    expect(roundTrip['modelLicense'], 'commercial');
    expect(roundTrip['modelAttribution'], 'HoopRank provider import test');
    expect(roundTrip['modelSpriteUrl'],
        'https://cdn.hooprank.test/avatars/provider-avatar-123-sprite.webp');
    expect(generatedAvatarProductionImageUrl(config),
        'https://cdn.hooprank.test/avatars/provider-avatar-123-sprite.webp');
    expect(generatedAvatarDataUrl(config),
        'https://cdn.hooprank.test/avatars/provider-avatar-123-sprite.webp');
  });

  test('provider avatar data URL falls back to production poster', () {
    final config = buildGeneratedAvatarConfig(
      seed: 'provider-player-poster',
      label: 'Maya Buckets',
      variant: 1,
      modelAssetId: 'provider-avatar-poster',
      modelUrl: 'https://cdn.hooprank.test/avatars/provider-avatar-poster.glb',
      modelPosterUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-poster.webp',
      modelSource: avatarModelSourceExternalGlb,
      modelQualityTier: avatarModelQualityModernGameRig,
      modelRigContract: avatarModelRigContractBaseV1,
      modelTopology: avatarModelTopologyReusableBaseRig,
      modelCapabilities: avatarModelBaseRigCapabilities,
    );

    expect(generatedAvatarProductionSpriteUrl(config), isNull);
    expect(generatedAvatarProductionImageUrl(config),
        'https://cdn.hooprank.test/avatars/provider-avatar-poster.webp');
    expect(generatedAvatarDataUrl(config),
        'https://cdn.hooprank.test/avatars/provider-avatar-poster.webp');
  });

  test('raw provider model suppresses low-quality fallback artwork', () {
    final config = buildGeneratedAvatarConfig(
      seed: 'provider-player-no-renders',
      label: 'Maya Buckets',
      variant: 1,
      modelAssetId: 'provider-avatar-no-renders',
      modelUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-no-renders.glb',
      modelSource: avatarModelSourceProvider,
      modelQualityTier: avatarModelQualityModernGameRig,
      modelRigContract: avatarModelRigContractBaseV1,
      modelTopology: avatarModelTopologyReusableBaseRig,
      modelCapabilities: avatarModelBaseRigCapabilities,
    );

    expect(generatedAvatarModelSpec(config), isNotNull);
    expect(generatedAvatarProductionSpriteUrl(config), isNull);
    expect(generatedAvatarProductionImageUrl(config), isNull);
    expect(generatedAvatarFallbackArtworkAllowed(config), isFalse);
    expect(generatedAvatarDataUrl(config), isEmpty);
  });

  test('attachProductionAvatarModel requires complete render exports', () {
    expect(
      () => attachProductionAvatarModel(
        config: buildGeneratedAvatarConfig(
          seed: 'provider-player-incomplete',
          label: 'Maya Buckets',
          variant: 1,
        ),
        modelAssetId: 'provider-avatar-incomplete',
        modelUrl:
            'https://cdn.hooprank.test/avatars/provider-avatar-incomplete.glb',
        modelPosterUrl:
            'https://cdn.hooprank.test/avatars/provider-avatar-incomplete.webp',
        modelSpriteUrl: '',
        modelSource: avatarModelSourceProvider,
        modelQualityTier: avatarModelQualityModernGameRig,
      ),
      throwsArgumentError,
    );
  });

  test('low-quality avatar fallback policy is explicit opt-in', () {
    final generatedConfig = buildGeneratedAvatarConfig(
      seed: 'fallback-player',
      label: 'Fallback Player',
      variant: 1,
    );

    expect(
      avatarFallbackArtworkAllowedForBuild(
        productionModelsEnabled: false,
        fallbackOverrideEnabled: false,
      ),
      isFalse,
    );
    expect(
      avatarFallbackArtworkAllowedForBuild(
        productionModelsEnabled: true,
        fallbackOverrideEnabled: false,
      ),
      isFalse,
    );
    expect(
      avatarFallbackArtworkAllowedForBuild(
        productionModelsEnabled: true,
        fallbackOverrideEnabled: true,
      ),
      isTrue,
    );
    expect(
      generatedAvatarProceduralPainterFallbackAllowed(generatedConfig),
      isFalse,
      reason: 'Painter fallback requires its own explicit build flag.',
    );
  });

  test('provider base-rig model survives pose and outfit selection', () {
    final config = HoopRankAvatarConfig.fromJson(
      attachProductionAvatarModel(
        config: buildGeneratedAvatarConfig(
          seed: 'provider-player',
          label: 'Maya Buckets',
          variant: 1,
          outfit: 'jersey',
          stance: 'tripleThreat',
        ),
        modelAssetId: 'provider-base-rig-123',
        modelUrl: 'https://cdn.hooprank.test/avatars/base-rig-123.glb',
        modelPosterUrl:
            'https://cdn.hooprank.test/avatars/base-rig-123-poster.webp',
        modelSpriteUrl:
            'https://cdn.hooprank.test/avatars/base-rig-123-sprite.webp',
        modelAnimationName: 'tripleThreatIdle',
        modelCameraOrbit: '0deg 72deg 3.1m',
        modelCameraTarget: '0m 1.08m 0m',
        modelFieldOfView: '21deg',
        modelScale: '1 1 1',
        modelSource: avatarModelSourceProvider,
        modelQualityTier: avatarModelQualityModernGameRig,
        modelLicense: 'commercial',
        modelAttribution: 'HoopRank provider import test',
      ),
    );

    final lowDribble = avatarLookPresetFor(
      outfit: 'tee',
      stance: 'dribble',
    )!
        .applyTo(config);
    final modelSpec = generatedAvatarModelSpec(lowDribble.toJson());

    expect(lowDribble.outfit, 'tee');
    expect(lowDribble.stance, 'dribble');
    expect(lowDribble.modelAssetId, 'provider-base-rig-123');
    expect(lowDribble.modelBaseRigAssetId, 'provider-base-rig-123');
    expect(lowDribble.modelUrl,
        'https://cdn.hooprank.test/avatars/base-rig-123.glb');
    expect(lowDribble.modelPosterUrl,
        'https://cdn.hooprank.test/avatars/base-rig-123-poster.webp');
    expect(lowDribble.modelSpriteUrl,
        'https://cdn.hooprank.test/avatars/base-rig-123-sprite.webp');
    expect(lowDribble.modelAnimationName, 'dribbleIdle');
    expect(lowDribble.modelSource, avatarModelSourceProvider);
    expect(lowDribble.modelQualityTier, avatarModelQualityModernGameRig);
    expect(lowDribble.modelRigContract, avatarModelRigContractBaseV1);
    expect(lowDribble.modelTopology, avatarModelTopologyReusableBaseRig);
    expect(
      lowDribble.modelCapabilities,
      containsAll(avatarModelBaseRigCapabilities),
    );
    expect(lowDribble.modelLicense, 'commercial');
    expect(lowDribble.modelAttribution, 'HoopRank provider import test');
    expect(modelSpec, isNotNull);
    expect(
        modelSpec!.url, 'https://cdn.hooprank.test/avatars/base-rig-123.glb');
    expect(modelSpec.baseRigAssetId, 'provider-base-rig-123');
    expect(modelSpec.animationName, 'dribbleIdle');
    expect(modelSpec.topology, avatarModelTopologyReusableBaseRig);
    expect(modelSpec.capabilities, containsAll(avatarModelBaseRigCapabilities));
  });

  test('model customization payload maps avatar controls to rig slots', () {
    final config = attachProductionAvatarModel(
      config: buildGeneratedAvatarConfig(
        seed: 'custom-player',
        label: 'Maya Buckets',
        variant: 3,
        gender: 'female',
        bodyType: 'strong',
        height: 'tall',
        baseAppearance: 'white',
        hairStyle: 'braids',
        hairColor: 'blonde',
        outfit: 'jersey',
        stance: 'tripleThreat',
        primaryColor: '#22C55E',
        secondaryColor: '#111827',
      ),
      modelAssetId: 'provider-avatar-789',
      modelUrl: 'https://cdn.hooprank.test/avatars/provider-avatar-789.glb',
      modelPosterUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-789.webp',
      modelSpriteUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-789-sprite.webp',
      modelSource: avatarModelSourceProvider,
      modelQualityTier: avatarModelQualityModernGameRig,
    );

    final payload = generatedAvatarModelCustomizationPayload(config)!;
    final materials = payload['materials'] as Map<String, dynamic>;
    final materialVisibility =
        payload['materialVisibility'] as Map<String, dynamic>;
    final nodeVisibility = payload['nodeVisibility'] as Map<String, dynamic>;
    final morphTargets = payload['morphTargets'] as Map<String, dynamic>;

    expect(payload['contract'], avatarModelRigContractBaseV1);
    expect(payload['runtimeBinding'], avatarModelRuntimeBindingBaseLayers);
    expect(payload['baseSelectionAxes'], avatarModelBaseSelectionAxes);
    expect(payload['runtimeLayerAxes'], avatarModelRuntimeLayerAxes);
    expect(payload['baseRigAssetIds'], avatarModelBaseRigAssetIds);
    expect(payload['layeredBaseRigOnly'], isTrue);
    expect(payload['baseRigAssetId'], 'provider-avatar-789');
    expect(payload['baseBody'], {'gender': 'female', 'build': 'medium'});
    expect(payload['animationName'], 'tripleThreatIdle');
    expect(payload['look'], {'outfit': 'jersey', 'stance': 'tripleThreat'});
    expect(materials['avatar_skin'], '#F2C7A8');
    expect(materials['avatar_hair'], '#D8B56A');
    expect(materials['avatar_jersey_primary'], '#22C55E');
    expect(
      (materialVisibility['hair'] as Map<String, dynamic>)['selected'],
      'avatar_hair_braids',
    );
    expect(
      (nodeVisibility['outfit'] as Map<String, dynamic>)['selected'],
      'avatar_outfit_jersey',
    );
    expect(morphTargets['avatar_height_tall'], 1);
    expect(nodeVisibility.containsKey('body'), isFalse);
    expect(morphTargets.containsKey('avatar_build_strong'), isFalse);
    expect(morphTargets.containsKey('avatar_gender_feminine'), isFalse);
  });

  test('avatar gender and build select one of six base body rigs', () {
    expect(avatarModelBaseRigDefinitions, hasLength(6));
    expect(
      avatarModelBaseRigDefinitions
          .map(
            (definition) =>
                '${definition.gender}:${definition.build}:${definition.assetId}',
          )
          .toSet(),
      {
        'male:skinny:$avatarModelMaleSkinnyBaseRigAssetId',
        'male:medium:$avatarModelMaleMediumBaseRigAssetId',
        'male:big:$avatarModelMaleBigBaseRigAssetId',
        'female:skinny:$avatarModelFemaleSkinnyBaseRigAssetId',
        'female:medium:$avatarModelFemaleMediumBaseRigAssetId',
        'female:big:$avatarModelFemaleBigBaseRigAssetId',
      },
    );
    expect(
      avatarModelBaseRigAssetIdFor(gender: 'male', bodyType: 'skinny'),
      avatarModelMaleSkinnyBaseRigAssetId,
    );
    expect(
      avatarModelBaseRigAssetIdFor(gender: 'male', bodyType: 'medium'),
      avatarModelMaleMediumBaseRigAssetId,
    );
    expect(
      avatarModelBaseRigAssetIdFor(gender: 'male', bodyType: 'big'),
      avatarModelMaleBigBaseRigAssetId,
    );
    expect(
      avatarModelBaseRigAssetIdFor(gender: 'female', bodyType: 'skinny'),
      avatarModelFemaleSkinnyBaseRigAssetId,
    );
    expect(
      avatarModelBaseRigAssetIdFor(gender: 'female', bodyType: 'medium'),
      avatarModelFemaleMediumBaseRigAssetId,
    );
    expect(
      avatarModelBaseRigAssetIdFor(gender: 'female', bodyType: 'big'),
      avatarModelFemaleBigBaseRigAssetId,
    );

    final config = HoopRankAvatarConfig.fromJson(
      buildGeneratedAvatarConfig(
        seed: 'six-base',
        label: 'Six Base',
        variant: 0,
        gender: 'male',
        bodyType: 'skinny',
      ),
    );
    expect(config.bodyType, 'skinny');
    expect(config.modelBaseRigAssetId, avatarModelMaleSkinnyBaseRigAssetId);

    final retargeted = config.copyWith(gender: 'female', bodyType: 'big');
    expect(retargeted.modelBaseRigAssetId, avatarModelFemaleBigBaseRigAssetId);

    expect(normalizeAvatarBodyType('lean'), 'skinny');
    expect(normalizeAvatarBodyType('balanced'), 'medium');
    expect(normalizeAvatarBodyType('strong'), 'medium');
  });

  test('bundled sprites normalize stale look rigs back to six base bodies', () {
    final rawConfig = {
      ...buildGeneratedAvatarConfig(
        seed: 'stale-look-rig',
        label: 'Stale Look Rig',
        variant: 0,
        gender: 'female',
        bodyType: 'big',
        height: 'tall',
        outfit: 'hoodie',
        stance: 'crossedArms',
      ),
      'modelBaseRigAssetId': 'player_locked_in_01',
    };
    final config = HoopRankAvatarConfig.fromJson(rawConfig);

    expect(
      avatarModelBaseRigAssetIdForConfig(config),
      avatarModelFemaleBigBaseRigAssetId,
    );
    expect(
      generatedAvatarCustomizedSpriteId(rawConfig),
      contains('rig_$avatarModelFemaleBigBaseRigAssetId'),
    );
    expect(
      generatedAvatarCustomizedSpriteId(rawConfig),
      isNot(contains('rig_player_locked_in_01')),
    );
    expect(
      generatedAvatarModelCustomizationPayload(rawConfig)!['baseRigAssetId'],
      avatarModelFemaleBigBaseRigAssetId,
    );
  });

  test('development base-rig preview assets require bundle opt-in', () {
    final config = buildGeneratedAvatarConfig(
      seed: 'dev-preview',
      label: 'Dev Preview',
      variant: 0,
      gender: 'female',
      bodyType: 'big',
    );

    expect(generatedAvatarModelSpec(config), isNull);
    expect(generatedAvatarProductionSpriteUrl(config), isNull);
    expect(generatedAvatarPreviewSpriteUrl(config), isNull);
    expect(
      generatedAvatarModelSpec(
        config,
        allowDevelopmentBaseRig: true,
      ),
      isNull,
      reason: 'Development rigs are not shipped unless bundle opt-in is set.',
    );
    expect(
      generatedAvatarPreviewSpriteUrl(
        config,
        allowDevelopmentBaseRig: true,
      ),
      isNull,
    );
    expect(generatedAvatarProductionSpriteUrl(config), isNull);
  });

  test('customized avatar sprite id covers visible render axes', () {
    final config = buildGeneratedAvatarConfig(
      seed: 'sprite-player',
      label: 'Sprite Player',
      variant: 0,
      gender: 'female',
      bodyType: 'big',
      height: 'tall',
      baseAppearance: 'white',
      skinTone: 'fair',
      hairStyle: 'braids',
      hairColor: 'blonde',
      outfit: 'hoodie',
      stance: 'crossedArms',
      accessory: 'headband',
      primaryColor: '#22C55E',
      secondaryColor: '#111827',
      jerseyNumber: '9',
    );

    final spriteId = generatedAvatarCustomizedSpriteId(config);

    expect(spriteId, contains('look_player_locked_in_01'));
    expect(spriteId, contains('rig_$avatarModelFemaleBigBaseRigAssetId'));
    expect(spriteId, contains('gender_female'));
    expect(spriteId, contains('build_big'));
    expect(spriteId, contains('height_tall'));
    expect(spriteId, contains('base_white'));
    expect(spriteId, contains('skin_fair'));
    expect(spriteId, contains('hair_braids_blonde'));
    expect(spriteId, contains('outfit_hoodie'));
    expect(spriteId, contains('stance_crossedarms'));
    expect(spriteId, contains('accessory_headband'));
    expect(spriteId, contains('primary_22c55e'));
    expect(spriteId, contains('secondary_111827'));
    expect(spriteId, contains('jersey_09'));
    final assetStem = generatedAvatarCustomizedSpriteAssetStem(config);
    expect(assetStem, startsWith('avatar_'));
    expect(assetStem.length, lessThan(32));
    expect(
      generatedAvatarCustomizedSpriteAssetPath(config),
      '$generatedAvatarSpriteRoot$assetStem.$generatedAvatarSpriteExtension',
    );
    final bundledConfig = generatedAvatarBundledSpriteConfig(config)!;
    final bundledStem = generatedAvatarCustomizedSpriteAssetStem(bundledConfig);
    expect(generatedAvatarCustomizedSpriteMatchesConfig(config), isFalse);
    expect(
      generatedAvatarCustomizedSpriteUrl(
        config,
        allowDevelopmentFallback: true,
      ),
      isNull,
    );
    expect(
      generatedAvatarCustomizedSpriteAssetPath(bundledConfig),
      '$generatedAvatarSpriteRoot$bundledStem.$generatedAvatarSpriteExtension',
    );
  });

  test('bundled customized sprites resolve to existing starter pack renders',
      () {
    final outsideStarterPack = buildGeneratedAvatarConfig(
      seed: 'starter-pack-player',
      label: 'Starter Pack Player',
      variant: 1,
      gender: 'male',
      bodyType: 'big',
      height: 'tall',
      baseAppearance: 'white',
      skinTone: 'fair',
      hairStyle: 'buzz',
      hairColor: 'brown',
      outfit: 'hoodie',
      stance: 'dribble',
      accessory: 'goggles',
      primaryColor: '#22C55E',
      secondaryColor: '#111827',
      jerseyNumber: '9',
    );

    final bundled = HoopRankAvatarConfig.fromJson(
      generatedAvatarBundledSpriteConfig(outsideStarterPack)!,
    );

    expect(bundled.gender, 'male');
    expect(bundled.bodyType, 'big');
    expect(bundled.modelBaseRigAssetId, avatarModelMaleBigBaseRigAssetId);
    expect(bundled.baseAppearance, 'white');
    expect(bundled.skinTone, 'fair');
    expect(bundled.height, 'standard');
    expect(bundled.hairStyle, 'fade');
    expect(bundled.hairColor, 'brown');
    expect(bundled.outfit, 'hoodie');
    expect(bundled.stance, 'crossedArms');
    expect(bundled.accessory, 'headband');
    expect(bundled.primaryColor, '#F97316');
    expect(bundled.secondaryColor, '#111827');
    expect(bundled.jerseyNumber, '23');
    expect(generatedAvatarCustomizedSpriteMatchesConfig(outsideStarterPack),
        isFalse);
    expect(
      generatedAvatarCustomizedSpriteUrl(
        outsideStarterPack,
        allowDevelopmentFallback: true,
      ),
      isNull,
    );
    expect(
      generatedAvatarCustomizedSpriteAssetPath(bundled.toJson()),
      startsWith(generatedAvatarSpriteRoot),
    );
    expect(
      File(generatedAvatarCustomizedSpriteAssetPath(bundled.toJson()))
          .existsSync(),
      isTrue,
    );

    final exactStarterPack = buildGeneratedAvatarConfig(
      seed: 'starter-pack-exact',
      label: 'Starter Pack Exact',
      variant: 0,
      gender: 'female',
      bodyType: 'skinny',
      height: 'standard',
      baseAppearance: 'latino',
      skinTone: 'bronze',
      hairStyle: 'fade',
      hairColor: 'black',
      outfit: 'tee',
      stance: 'dribble',
      accessory: 'sleeve',
      primaryColor: '#F97316',
      secondaryColor: '#111827',
      jerseyNumber: '23',
    );

    expect(
      generatedAvatarCustomizedSpriteMatchesConfig(exactStarterPack),
      isTrue,
    );
    expect(
      File(generatedAvatarCustomizedSpriteAssetPath(exactStarterPack))
          .existsSync(),
      isTrue,
    );
  });

  test('full variation space resolves to source starter sprite assets', () {
    final resolvedPaths = <String>{};
    final existenceCache = <String, bool>{};
    for (final config in buildGeneratedAvatarVariationConfigs()) {
      expect(
        generatedAvatarCustomizedSpriteUrl(
          config,
          allowDevelopmentFallback: true,
        ),
        isNull,
      );
      final bundledConfig = generatedAvatarBundledSpriteConfig(config);
      expect(bundledConfig, isNotNull);
      final path = generatedAvatarCustomizedSpriteAssetPath(bundledConfig!);
      expect(path, startsWith(generatedAvatarSpriteRoot));
      resolvedPaths.add(path);
      final exists = existenceCache.putIfAbsent(
        path,
        () => File(path).existsSync(),
      );
      expect(exists, isTrue, reason: '$path should exist in source pack');
    }

    expect(resolvedPaths.length, 96);
  });

  test('bundled starter sprites require bundle opt-in', () {
    final config = buildGeneratedAvatarConfig(
      seed: 'starter-pack-default-off',
      label: 'Starter Pack Default Off',
      variant: 0,
    );

    expect(generatedAvatarCustomizedSpriteUrl(config), isNull);
    expect(
      generatedAvatarCustomizedSpriteUrl(
        config,
        allowDevelopmentFallback: true,
      ),
      isNull,
      reason: 'Starter sprites are not shipped unless bundle opt-in is set.',
    );
  });

  test('provider production models do not use bundled customized sprites', () {
    final config = attachProductionAvatarModel(
      config: buildGeneratedAvatarConfig(
        seed: 'provider-sprite-player',
        label: 'Maya Buckets',
        variant: 1,
      ),
      modelAssetId: 'provider-avatar-sprite',
      modelUrl: 'https://cdn.hooprank.test/avatars/provider-avatar-sprite.glb',
      modelPosterUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-sprite.webp',
      modelSpriteUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-sprite.webp',
      modelSource: avatarModelSourceProvider,
      modelQualityTier: avatarModelQualityModernGameRig,
    );

    expect(generatedAvatarModelSpec(config), isNotNull);
    expect(generatedAvatarCustomizedSpriteUrl(config), isNull);
  });

  test('unsafe and prototype avatar model urls are blocked by default', () {
    final missingSource = buildGeneratedAvatarConfig(
      seed: 'provider-player',
      label: 'Maya Buckets',
      variant: 1,
      modelAssetId: 'provider-avatar-123',
      modelUrl: 'https://cdn.hooprank.test/avatars/provider-avatar-123.glb',
      modelQualityTier: avatarModelQualityModernGameRig,
    );
    expect(generatedAvatarModelSpec(missingSource), isNull);

    final insecureRemote = buildGeneratedAvatarConfig(
      seed: 'provider-player',
      label: 'Maya Buckets',
      variant: 1,
      modelAssetId: 'provider-avatar-123',
      modelUrl: 'http://cdn.hooprank.test/avatars/provider-avatar-123.glb',
      modelSource: avatarModelSourceExternalGlb,
      modelQualityTier: avatarModelQualityModernGameRig,
    );
    expect(generatedAvatarModelSpec(insecureRemote), isNull);

    final debugPrototype = buildGeneratedAvatarConfig(
      seed: 'debug-player',
      label: 'Maya Buckets',
      variant: 1,
      modelAssetId: 'game_rig_player_guard_01',
      modelUrl: 'assets/avatar_models/game_rig_player_guard_01.glb',
      modelSource: avatarModelSourceDebugPrototype,
      modelQualityTier: avatarModelQualityPrototype,
    );
    expect(generatedAvatarModelSpec(debugPrototype), isNull);
    expect(isDebugPrototypeAvatarModelUrl(debugPrototype['modelUrl'] as String),
        isTrue);
    expect(isProductionAvatarModelUrl(debugPrototype['modelUrl'] as String),
        isFalse);

    final oneOffLookMesh = buildGeneratedAvatarConfig(
      seed: 'legacy-look-player',
      label: 'Maya Buckets',
      variant: 1,
      modelAssetId: 'player_guard_01',
      modelUrl: 'assets/avatar_models/player_guard_01.glb',
      modelPosterUrl: 'assets/avatar_models/player_guard_01_poster.webp',
      modelSource: avatarModelSourceProductionDcc,
      modelQualityTier: avatarModelQualityModernGameRig,
      modelRigContract: avatarModelRigContractBaseV1,
      modelTopology: avatarModelTopologyReusableBaseRig,
      modelCapabilities: avatarModelBaseRigCapabilities,
    );
    expect(generatedAvatarModelSpec(oneOffLookMesh), isNull);
    expect(isProductionAvatarModelUrl(oneOffLookMesh['modelUrl'] as String),
        isFalse);
    expect(
      isProductionAvatarImageUrl(oneOffLookMesh['modelPosterUrl'] as String),
      isFalse,
    );

    expect(
      isProductionAvatarModelUrl(
        avatarModelBaseRigModelUrl(avatarModelMaleMediumBaseRigAssetId),
      ),
      isTrue,
    );
    expect(
      isProductionAvatarImageUrl(
        avatarModelBaseRigSpriteUrl(avatarModelMaleMediumBaseRigAssetId),
      ),
      isTrue,
    );
  });

  test('base person presets define game-style appearance rigs', () {
    expect(
      avatarBasePersonPresets.map((preset) => preset.value),
      ['white', 'asian', 'black', 'latino'],
    );

    final white = avatarBasePersonPresetFor('white');
    expect(white.skinTone, 'fair');
    expect(white.defaultHairColor, 'brown');
    expect(white.eyeStyle, 'round');

    final asian = avatarBasePersonPresetFor('asian');
    expect(asian.skinTone, 'golden');
    expect(asian.defaultHairStyle, 'straight');
    expect(asian.eyeStyle, 'almond');

    final black = avatarBasePersonPresetFor('black');
    expect(black.skinTone, 'deep');
    expect(black.defaultHairStyle, 'curls');
    expect(black.noseWidthScale, greaterThan(1));

    final latino = avatarBasePersonPresetFor('latino');
    expect(latino.skinTone, 'bronze');
    expect(latino.defaultHairColor, 'black');
    expect(latino.mouthWidthScale, greaterThan(1));
  });

  test('new player avatar keeps identity and preserves hoodie render asset',
      () {
    final config = buildNewPlayerAvatarConfig(seed: 'new-user');

    expect(isGeneratedAvatarConfig(config), isTrue);
    expect(isNewPlayerAvatarConfig(config), isTrue);
    expect(config['label'], newPlayerAvatarLabel);

    expect(generatedAvatarDataUrl(config), isEmpty);
    expect(
      generatedAvatarRenderAssetPath(HoopRankAvatarConfig.fromJson(config)),
      nextgen3dHoodieCrossedArmsAsset,
    );
    expect(config['modelAssetId'], 'player_locked_in_01');
    expect(generatedAvatarModelUrl(config), isNull);
  });

  test('all generated avatar render assets exist in the app bundle source', () {
    for (final assetPath in generatedAvatarRenderAssets) {
      final file = File(assetPath);
      expect(file.existsSync(), isTrue, reason: '$assetPath is missing');
      expect(file.lengthSync(), greaterThan(500000),
          reason: '$assetPath should be a high-resolution render asset');
    }
  });

  test('full avatar variation space covers every base hair and clothes combo',
      () {
    final configs = buildGeneratedAvatarVariationConfigs().toList();
    final ids = configs.map(generatedAvatarVariationId).toSet();

    expect(
      generatedAvatarFullVariationCount,
      avatarLookPresets.length *
          avatarGenderOptions.length *
          avatarBodyOptions.length *
          avatarBasePersonPresets.length *
          avatarHairStyleOptions.length *
          avatarHairColorOptions.length *
          avatarColorOptions.length,
    );
    expect(configs, hasLength(generatedAvatarFullVariationCount));
    expect(ids, hasLength(generatedAvatarFullVariationCount));
    expect(
      ids,
      contains(
        'player_guard_01__gender_male__build_skinny__base_white__hair_fade_black__fit_orange',
      ),
    );
    expect(
      ids,
      contains(
        'player_dribble_01__gender_female__build_big__base_latino__hair_bald_blue__fit_purple',
      ),
    );
    final femaleBigConfig = HoopRankAvatarConfig.fromJson(
      configs.firstWhere(
        (config) =>
            generatedAvatarVariationId(config) ==
            'player_dribble_01__gender_female__build_big__base_latino__hair_bald_blue__fit_purple',
      ),
    );
    expect(
      femaleBigConfig.modelBaseRigAssetId,
      avatarModelFemaleBigBaseRigAssetId,
    );
    expect(femaleBigConfig.modelUrl, isNull);
  });

  test('avatar render quality review tracks active pack and art gate', () {
    final file = File('assets/avatar_renders/quality_review.json');
    expect(file.existsSync(), isTrue);

    final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    expect(json['schemaVersion'], 1);
    expect(json['activePack'], 'nextgen3d');
    expect(json['qualityTier'], 'next-gen-console-style-generated');
    expect(json['productionArtStatus'], 'not_approved');
    expect(json['renderSource'], 'generated-procedural-3d-mesh-projection');
    expect(json['activeAssets'], generatedAvatarRenderAssets);
    expect(json['blockingGaps'], isNotEmpty);
    expect(json['approvalRequirements'], isNotEmpty);
  });

  test('shipping asset manifest excludes generated avatar stand-ins', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();

    expect(pubspec, isNot(contains('    - assets/\n')));
    expect(pubspec, isNot(contains('assets/avatar_sprites/')));
    expect(pubspec, isNot(contains('    - assets/avatar_models/\n')));
    expect(pubspec, isNot(contains('assets/avatar_renders/nextgen3d_')));
    expect(pubspec, isNot(contains('assets/avatar_renders/aaa3d_')));
    expect(pubspec, isNot(contains('assets/avatar_renders/pro3d_')));
    expect(pubspec, isNot(contains('assets/avatar_renders/ultra3d_')));
    expect(pubspec, isNot(contains('assets/avatar_renders/console_')));
    expect(pubspec, isNot(contains('assets/avatar_renders/elite3d_')));
    expect(pubspec, isNot(contains('assets/avatar_renders/ps5_')));

    final catalog =
        jsonDecode(File('assets/avatar_models/catalog.json').readAsStringSync())
            as Map<String, dynamic>;
    final productionApproved = catalog['status'] == 'production_dcc_assets';
    for (final assetId in avatarModelBaseRigAssetIds) {
      if (productionApproved) {
        expect(pubspec, contains('assets/avatar_models/$assetId.glb'));
        expect(
            pubspec, contains('assets/avatar_models/${assetId}_poster.webp'));
        expect(
            pubspec, contains('assets/avatar_models/${assetId}_sprite.webp'));
      } else {
        expect(pubspec, isNot(contains('assets/avatar_models/$assetId.glb')));
        expect(pubspec,
            isNot(contains('assets/avatar_models/${assetId}_poster.webp')));
        expect(pubspec,
            isNot(contains('assets/avatar_models/${assetId}_sprite.webp')));
      }
    }

    for (final obsoleteAsset in [
      'assets/avatar_models/game_rig_player_guard_01.glb',
      'assets/avatar_models/game_rig_player_locked_in_01.glb',
      'assets/avatar_models/game_rig_player_shooter_01.glb',
      'assets/avatar_models/game_rig_player_dribble_01.glb',
      'assets/avatar_models/player_guard_01.glb',
      'assets/avatar_models/player_locked_in_01.glb',
      'assets/avatar_models/player_shooter_01.glb',
      'assets/avatar_models/player_dribble_01.glb',
    ]) {
      expect(
        File(obsoleteAsset).existsSync(),
        isFalse,
        reason: '$obsoleteAsset should not be checked in as avatar topology',
      );
    }
  });

  test('avatar model catalog defines six base rigs and look bindings', () {
    final file = File('assets/avatar_models/catalog.json');
    expect(file.existsSync(), isTrue);

    final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    expect(json['schemaVersion'], 1);
    expect(json['status'], 'awaiting_production_dcc_assets');

    final baseRigTargets = json['baseRigTargets'] as List<dynamic>;
    expect(baseRigTargets, hasLength(6));
    final baseRigIds = baseRigTargets
        .map((target) => (target as Map<String, dynamic>)['modelAssetId'])
        .cast<String>()
        .toSet();
    expect(baseRigIds, avatarModelBaseRigAssetIds.toSet());
    for (final rawTarget in baseRigTargets) {
      final baseRigTarget = rawTarget as Map<String, dynamic>;
      expect(baseRigTarget['gender'], anyOf('male', 'female'));
      expect(baseRigTarget['build'], anyOf('skinny', 'medium', 'big'));
      expect(baseRigTarget['modelUrl'], endsWith('.glb'));
      expect(baseRigTarget['modelSource'], avatarModelSourceProductionDcc);
      expect(
        baseRigTarget['modelQualityTier'],
        avatarModelQualityModernGameRig,
      );
      expect(baseRigTarget['modelRigContract'], avatarModelRigContractBaseV1);
      expect(
        baseRigTarget['modelTopology'],
        avatarModelTopologyReusableBaseRig,
      );
      expect(
        baseRigTarget['runtimeBinding'],
        avatarModelRuntimeBindingBaseLayers,
      );
      expect(
        baseRigTarget['customizationLayerAxes'],
        containsAll(avatarModelRuntimeLayerAxes),
      );
      expect(
        baseRigTarget['customizationLayerAxes'],
        isNot(contains(anyOf(avatarModelBaseSelectionAxes))),
      );
      expect(
        baseRigTarget['assetDelivery'],
        'development_procedural_base_rig_v1',
      );
      expect(
        baseRigTarget['modelCapabilities'],
        containsAll(avatarModelBaseRigCapabilities),
      );
      expect(
        baseRigTarget['requiredAnimationClips'],
        containsAll([
          'tripleThreatIdle',
          'lockedInIdle',
          'jumperIdle',
          'dribbleIdle',
        ]),
      );
      expect(baseRigTarget['requiredMaterialSlots'], contains('avatar_skin'));
      expect(
        baseRigTarget['requiredVisibilityNodes'],
        contains('avatar_outfit_jersey'),
      );
      expect(
        baseRigTarget['requiredMorphTargets'],
        contains('avatar_height_tall'),
      );
    }

    final slots = json['requiredSlots'] as List<dynamic>;
    expect(slots, hasLength(4));
    expect(
      slots.map((slot) => (slot as Map<String, dynamic>)['modelAssetId']),
      containsAll([
        'player_guard_01',
        'player_locked_in_01',
        'player_shooter_01',
        'player_dribble_01',
      ]),
    );

    for (final rawSlot in slots) {
      final slot = rawSlot as Map<String, dynamic>;
      expect(slot['baseRigAssetIds'], containsAll(avatarModelBaseRigAssetIds));
      expect(slot.containsKey('modelUrl'), isFalse);
      expect(slot.containsKey('modelPosterUrl'), isFalse);
      expect(slot.containsKey('modelSpriteUrl'), isFalse);
      expect(slot['modelAnimationName'], isNotEmpty);
      expect(slot['modelCameraOrbit'], isNotEmpty);
      expect(slot['modelCameraTarget'], isNotEmpty);
      expect(slot['modelFieldOfView'], isNotEmpty);
      expect(slot['modelScale'], isNotEmpty);
      expect(slot['modelSource'], avatarModelSourceProductionDcc);
      expect(slot['modelQualityTier'], avatarModelQualityModernGameRig);
      expect(slot['modelRigContract'], avatarModelRigContractBaseV1);
      expect(slot['modelTopology'], avatarModelTopologyReusableBaseRig);
      expect(
        slot['modelCapabilities'],
        containsAll(avatarModelBaseRigCapabilities),
      );
    }
  });

  test('avatar model rig contract defines scalable customization slots', () {
    final file = File(avatarModelRigContractAsset);
    expect(file.existsSync(), isTrue);

    final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    expect(json['schemaVersion'], 1);
    expect(json['contractId'], avatarModelRigContractBaseV1);
    expect(
      (json['baseBodyVariants'] as List<dynamic>)
          .map((raw) => (raw as Map<String, dynamic>)['modelAssetId'])
          .toSet(),
      avatarModelBaseRigAssetIds.toSet(),
    );
    expect(json['runtimeBinding'], avatarModelRuntimeBindingBaseLayers);
    expect(json['baseSelectionAxes'], avatarModelBaseSelectionAxes);
    expect(json['runtimeLayerAxes'], avatarModelRuntimeLayerAxes);
    expect(json['nonLayeredBaseAxes'], avatarModelBaseSelectionAxes);
    final runtimeCustomizationLayers =
        json['runtimeCustomizationLayers'] as Map<String, dynamic>;
    expect(runtimeCustomizationLayers['raceAndSkin'],
        containsAll(['baseAppearance', 'skinTone']));
    expect(runtimeCustomizationLayers['hair'],
        containsAll(['hairStyle', 'hairColor']));
    expect(runtimeCustomizationLayers['height'], contains('height'));
    expect(runtimeCustomizationLayers['clothes'],
        containsAll(['outfit', 'clothesTint']));
    expect(runtimeCustomizationLayers['pose'],
        containsAll(['stance', 'modelAnimationName']));
    expect(
      json['requiredMaterialSlots'],
      containsAll([
        'avatar_skin',
        'avatar_hair',
        'avatar_jersey_primary',
        'avatar_shoe',
        'avatar_ball',
      ]),
    );
    expect(
      (json['visibilityGroups'] as Map<String, dynamic>)['hair'],
      containsAll(['avatar_hair_fade', 'avatar_hair_braids']),
    );
    expect(
      (json['visibilityGroups'] as Map<String, dynamic>)['outfit'],
      containsAll(['avatar_outfit_jersey', 'avatar_outfit_hoodie']),
    );
    expect(
      (json['morphTargets'] as Map<String, dynamic>)['height'],
      containsAll(['avatar_height_tall', 'avatar_height_center']),
    );
    expect((json['morphTargets'] as Map<String, dynamic>)['build'], isNull);
    expect((json['morphTargets'] as Map<String, dynamic>)['gender'], isNull);
    expect(
      json['requiredRuntimeCapabilities'],
      containsAll(avatarModelBaseRigCapabilities),
    );
    final qualityFloors =
        json['productionQualityFloors'] as Map<String, dynamic>;
    expect(qualityFloors['minTriangleCount'], greaterThanOrEqualTo(20000));
    expect(qualityFloors['minVertexCount'], greaterThanOrEqualTo(12000));
    expect(qualityFloors['minJointCount'], greaterThanOrEqualTo(32));
    expect(qualityFloors['minTextureCount'], greaterThanOrEqualTo(6));
    expect(
      qualityFloors['minNormalMappedMaterialCount'],
      greaterThanOrEqualTo(4),
    );
  });

  test('premium look presets match production model catalog slots', () {
    final file = File('assets/avatar_models/catalog.json');
    final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    final slots = <String, Map<String, dynamic>>{};
    for (final rawSlot in json['requiredSlots'] as List<dynamic>) {
      final slot = rawSlot as Map<String, dynamic>;
      slots[slot['modelAssetId'] as String] = slot;
    }

    expect(avatarLookPresets, hasLength(4));
    for (final preset in avatarLookPresets) {
      expect(generatedAvatarRenderAssets, contains(preset.renderAsset));
      final slot = slots[preset.modelAssetId];
      expect(slot, isNotNull, reason: '${preset.label} missing catalog slot');
      expect(slot!['outfit'], preset.outfit);
      expect(slot['baseRigAssetIds'], containsAll(avatarModelBaseRigAssetIds));
      expect(slot['stance'], preset.stance);
      expect(slot.containsKey('modelUrl'), isFalse);
      expect(slot.containsKey('modelPosterUrl'), isFalse);
      expect(slot.containsKey('modelSpriteUrl'), isFalse);
      expect(slot['modelAnimationName'], preset.modelAnimationName);
      expect(slot['modelCameraOrbit'], preset.modelCameraOrbit);
      expect(slot['modelCameraTarget'], preset.modelCameraTarget);
      expect(slot['modelFieldOfView'], preset.modelFieldOfView);
      expect(slot['modelScale'], preset.modelScale);
      expect(slot['modelSource'], preset.modelSource);
      expect(slot['modelQualityTier'], preset.modelQualityTier);
      expect(slot['modelRigContract'], preset.modelRigContract);
      expect(slot['modelTopology'], preset.modelTopology);
      expect(slot['modelCapabilities'], containsAll(preset.modelCapabilities));
      expect(preset.avatarPreviewScale, greaterThan(1));
    }
  });
}

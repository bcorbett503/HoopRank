import 'dart:math';

const String generatedAvatarType = 'generatedHoopRankAvatar';
const String newPlayerAvatarLabel = 'New to HoopRank';
const String generatedAvatarAssetScheme = 'asset://';
const String generatedAvatarRenderRoot = 'assets/avatar_renders/';
const String generatedAvatarSpriteRoot = 'assets/avatar_sprites/';
const String generatedAvatarSpriteExtension = 'webp';
const String avatarModelSourceProductionDcc = 'productionDcc';
const String avatarModelSourceExternalGlb = 'externalGlb';
const String avatarModelSourceProvider = 'avatarProvider';
const String avatarModelSourceDebugPrototype = 'debugPrototype';
const String avatarModelQualityModernGameRig = 'modernGameRig';
const String avatarModelQualityPrototype = 'prototype';
const String avatarModelRigContractBaseV1 = 'hooprank_base_avatar_rig_v1';
const String avatarModelRigContractAsset =
    'assets/avatar_models/rig_contract.json';
const String avatarModelRuntimeBindingBaseLayers =
    'base_body_plus_runtime_layers';
const String avatarModelMaleSkinnyBaseRigAssetId = 'player_male_skinny_01';
const String avatarModelMaleMediumBaseRigAssetId = 'player_male_medium_01';
const String avatarModelMaleBigBaseRigAssetId = 'player_male_big_01';
const String avatarModelFemaleSkinnyBaseRigAssetId = 'player_female_skinny_01';
const String avatarModelFemaleMediumBaseRigAssetId = 'player_female_medium_01';
const String avatarModelFemaleBigBaseRigAssetId = 'player_female_big_01';
const String avatarModelBaseRigAssetId = avatarModelMaleMediumBaseRigAssetId;
const List<AvatarBaseModelDefinition> avatarModelBaseRigDefinitions = [
  AvatarBaseModelDefinition(
    assetId: avatarModelMaleSkinnyBaseRigAssetId,
    gender: 'male',
    build: 'skinny',
  ),
  AvatarBaseModelDefinition(
    assetId: avatarModelMaleMediumBaseRigAssetId,
    gender: 'male',
    build: 'medium',
  ),
  AvatarBaseModelDefinition(
    assetId: avatarModelMaleBigBaseRigAssetId,
    gender: 'male',
    build: 'big',
  ),
  AvatarBaseModelDefinition(
    assetId: avatarModelFemaleSkinnyBaseRigAssetId,
    gender: 'female',
    build: 'skinny',
  ),
  AvatarBaseModelDefinition(
    assetId: avatarModelFemaleMediumBaseRigAssetId,
    gender: 'female',
    build: 'medium',
  ),
  AvatarBaseModelDefinition(
    assetId: avatarModelFemaleBigBaseRigAssetId,
    gender: 'female',
    build: 'big',
  ),
];
final List<String> avatarModelBaseRigAssetIds = List.unmodifiable(
  avatarModelBaseRigDefinitions.map((definition) => definition.assetId),
);
const String avatarModelTopologyReusableBaseRig = 'reusableBaseRig';
const String avatarModelTopologyPoseSpecificRig = 'poseSpecificRig';
const List<String> avatarModelBaseSelectionAxes = [
  'gender',
  'build',
];
const List<String> avatarModelRuntimeLayerAxes = [
  'baseAppearance',
  'skinTone',
  'hairStyle',
  'hairColor',
  'height',
  'outfit',
  'clothesTint',
  'stance',
  'modelAnimationName',
];
const List<String> avatarModelBaseRigCapabilities = [
  'runtimeMaterialColors',
  'hairVisibilityNodes',
  'outfitVisibilityNodes',
  'heightMorphTargets',
  'namedAnimationClips',
  'transparentMapSprite',
];
const bool productionAvatarModelsEnabled = bool.fromEnvironment(
    'HOOPRANK_PRODUCTION_AVATAR_MODELS',
    defaultValue: false);
const bool debugPrototypeAvatarModelsEnabled = bool.fromEnvironment(
    'HOOPRANK_DEBUG_PROTOTYPE_AVATAR_MODELS',
    defaultValue: false);
const bool lowQualityAvatarFallbacksEnabled = bool.fromEnvironment(
    'HOOPRANK_ALLOW_LOW_QUALITY_AVATAR_FALLBACKS',
    defaultValue: false);
const bool proceduralAvatarPainterFallbacksEnabled = bool.fromEnvironment(
    'HOOPRANK_ENABLE_PROCEDURAL_AVATAR_PAINTER_FALLBACKS',
    defaultValue: false);
const bool bundledCustomizedAvatarSpritesEnabled = bool.fromEnvironment(
    'HOOPRANK_BUNDLED_CUSTOMIZED_AVATAR_SPRITES',
    defaultValue: false);
const bool bundledDevelopmentAvatarModelsEnabled = bool.fromEnvironment(
    'HOOPRANK_BUNDLED_DEVELOPMENT_AVATAR_MODELS',
    defaultValue: false);
const bool bundledDevelopmentAvatarSpritesEnabled = bool.fromEnvironment(
    'HOOPRANK_BUNDLED_DEVELOPMENT_AVATAR_SPRITES',
    defaultValue: false);
const String aaa3dGuardTripleThreatAsset =
    '${generatedAvatarRenderRoot}aaa3d_guard_triple_threat_cutout.png';
const String aaa3dHoodieCrossedArmsAsset =
    '${generatedAvatarRenderRoot}aaa3d_hoodie_crossed_arms_cutout.png';
const String aaa3dWarmupsJumperAsset =
    '${generatedAvatarRenderRoot}aaa3d_warmups_jumper_cutout.png';
const String aaa3dTeeDribbleAsset =
    '${generatedAvatarRenderRoot}aaa3d_tee_dribble_cutout.png';
const String pro3dGuardTripleThreatAsset =
    '${generatedAvatarRenderRoot}pro3d_guard_triple_threat_cutout.png';
const String pro3dHoodieCrossedArmsAsset =
    '${generatedAvatarRenderRoot}pro3d_hoodie_crossed_arms_cutout.png';
const String pro3dWarmupsJumperAsset =
    '${generatedAvatarRenderRoot}pro3d_warmups_jumper_cutout.png';
const String pro3dTeeDribbleAsset =
    '${generatedAvatarRenderRoot}pro3d_tee_dribble_cutout.png';
const String ultra3dGuardTripleThreatAsset =
    '${generatedAvatarRenderRoot}ultra3d_guard_triple_threat_cutout.png';
const String ultra3dHoodieCrossedArmsAsset =
    '${generatedAvatarRenderRoot}ultra3d_hoodie_crossed_arms_cutout.png';
const String ultra3dWarmupsJumperAsset =
    '${generatedAvatarRenderRoot}ultra3d_warmups_jumper_cutout.png';
const String ultra3dTeeDribbleAsset =
    '${generatedAvatarRenderRoot}ultra3d_tee_dribble_cutout.png';
const String nextgen3dGuardTripleThreatAsset =
    '${generatedAvatarRenderRoot}nextgen3d_guard_triple_threat_cutout.png';
const String nextgen3dHoodieCrossedArmsAsset =
    '${generatedAvatarRenderRoot}nextgen3d_hoodie_crossed_arms_cutout.png';
const String nextgen3dWarmupsJumperAsset =
    '${generatedAvatarRenderRoot}nextgen3d_warmups_jumper_cutout.png';
const String nextgen3dTeeDribbleAsset =
    '${generatedAvatarRenderRoot}nextgen3d_tee_dribble_cutout.png';
const String nextgen3dFemaleGuardTripleThreatAsset =
    '${generatedAvatarRenderRoot}nextgen3d_female_guard_triple_threat_cutout.png';
const String nextgen3dFemaleHoodieCrossedArmsAsset =
    '${generatedAvatarRenderRoot}nextgen3d_female_hoodie_crossed_arms_cutout.png';
const String nextgen3dFemaleWarmupsJumperAsset =
    '${generatedAvatarRenderRoot}nextgen3d_female_warmups_jumper_cutout.png';
const String nextgen3dFemaleTeeDribbleAsset =
    '${generatedAvatarRenderRoot}nextgen3d_female_tee_dribble_cutout.png';

const List<String> generatedAvatarRenderAssets = [
  nextgen3dGuardTripleThreatAsset,
  nextgen3dHoodieCrossedArmsAsset,
  nextgen3dWarmupsJumperAsset,
  nextgen3dTeeDribbleAsset,
  nextgen3dFemaleGuardTripleThreatAsset,
  nextgen3dFemaleHoodieCrossedArmsAsset,
  nextgen3dFemaleWarmupsJumperAsset,
  nextgen3dFemaleTeeDribbleAsset,
];

const List<AvatarLookPreset> avatarLookPresets = [
  AvatarLookPreset(
    label: 'Triple Threat',
    caption: 'Guard',
    outfit: 'jersey',
    stance: 'tripleThreat',
    accessory: 'sleeve',
    courtVibe: 'proAm',
    renderAsset: nextgen3dGuardTripleThreatAsset,
    modelAssetId: 'player_guard_01',
    modelAnimationName: 'tripleThreatIdle',
    modelCameraOrbit: '0deg 72deg 3.2m',
    modelCameraTarget: '0m 1.12m 0m',
    modelFieldOfView: '20deg',
    modelScale: '1 1 1',
    avatarPreviewScale: 1.18,
  ),
  AvatarLookPreset(
    label: 'Locked In',
    caption: 'Hoodie',
    outfit: 'hoodie',
    stance: 'crossedArms',
    accessory: 'headband',
    courtVibe: 'rec',
    renderAsset: nextgen3dHoodieCrossedArmsAsset,
    modelAssetId: 'player_locked_in_01',
    modelAnimationName: 'lockedInIdle',
    modelCameraOrbit: '0deg 72deg 3.2m',
    modelCameraTarget: '0m 1.12m 0m',
    modelFieldOfView: '20deg',
    modelScale: '1 1 1',
    avatarPreviewScale: 1.02,
  ),
  AvatarLookPreset(
    label: 'Pull-Up',
    caption: 'Warmups',
    outfit: 'warmups',
    stance: 'jumper',
    accessory: 'headband',
    courtVibe: 'night',
    renderAsset: nextgen3dWarmupsJumperAsset,
    modelAssetId: 'player_shooter_01',
    modelAnimationName: 'jumperIdle',
    modelCameraOrbit: '0deg 72deg 3.2m',
    modelCameraTarget: '0m 1.12m 0m',
    modelFieldOfView: '20deg',
    modelScale: '1 1 1',
    avatarPreviewScale: 1.08,
  ),
  AvatarLookPreset(
    label: 'Low Dribble',
    caption: 'Park Tee',
    outfit: 'tee',
    stance: 'dribble',
    accessory: 'sleeve',
    courtVibe: 'blacktop',
    renderAsset: nextgen3dTeeDribbleAsset,
    modelAssetId: 'player_dribble_01',
    modelAnimationName: 'dribbleIdle',
    modelCameraOrbit: '0deg 72deg 3.2m',
    modelCameraTarget: '0m 1.12m 0m',
    modelFieldOfView: '20deg',
    modelScale: '1 1 1',
    avatarPreviewScale: 1.12,
  ),
];

const List<AvatarOption> avatarGenderOptions = [
  AvatarOption('male', 'Male'),
  AvatarOption('female', 'Female'),
];

const List<AvatarBasePersonPreset> avatarBasePersonPresets = [
  AvatarBasePersonPreset(
    value: 'white',
    label: 'White',
    skinTone: 'fair',
    skinHex: '#F2C7A8',
    defaultHairStyle: 'fade',
    defaultHairColor: 'brown',
    faceShape: 'oval',
    eyeStyle: 'round',
    headWidthScale: .96,
    headHeightScale: 1.0,
    eyeSpacing: .18,
    eyeWidthScale: 1.0,
    eyeHeightScale: 1.0,
    noseWidthScale: .9,
    mouthWidthScale: 1.0,
  ),
  AvatarBasePersonPreset(
    value: 'asian',
    label: 'Asian',
    skinTone: 'golden',
    skinHex: '#E9B77F',
    defaultHairStyle: 'straight',
    defaultHairColor: 'black',
    faceShape: 'softSquare',
    eyeStyle: 'almond',
    headWidthScale: 1.02,
    headHeightScale: .96,
    eyeSpacing: .2,
    eyeWidthScale: 1.12,
    eyeHeightScale: .56,
    noseWidthScale: .82,
    mouthWidthScale: .92,
  ),
  AvatarBasePersonPreset(
    value: 'black',
    label: 'Black',
    skinTone: 'deep',
    skinHex: '#6F3F2A',
    defaultHairStyle: 'curls',
    defaultHairColor: 'black',
    faceShape: 'broadOval',
    eyeStyle: 'round',
    headWidthScale: 1.05,
    headHeightScale: 1.0,
    eyeSpacing: .19,
    eyeWidthScale: 1.04,
    eyeHeightScale: 1.02,
    noseWidthScale: 1.22,
    mouthWidthScale: 1.18,
  ),
  AvatarBasePersonPreset(
    value: 'latino',
    label: 'Latino',
    skinTone: 'bronze',
    skinHex: '#B8754A',
    defaultHairStyle: 'fade',
    defaultHairColor: 'black',
    faceShape: 'angular',
    eyeStyle: 'softRound',
    headWidthScale: 1.0,
    headHeightScale: 1.0,
    eyeSpacing: .18,
    eyeWidthScale: 1.04,
    eyeHeightScale: .92,
    noseWidthScale: 1.02,
    mouthWidthScale: 1.08,
  ),
];

const List<AvatarOption> avatarBaseAppearanceOptions = [
  AvatarOption('white', 'White'),
  AvatarOption('asian', 'Asian'),
  AvatarOption('black', 'Black'),
  AvatarOption('latino', 'Latino'),
];

const List<AvatarOption> avatarBodyOptions = [
  AvatarOption('skinny', 'Skinny'),
  AvatarOption('medium', 'Medium'),
  AvatarOption('big', 'Big'),
];

String normalizeAvatarGender(String? gender) {
  return gender == 'female' ? 'female' : 'male';
}

String normalizeAvatarBodyType(String? bodyType) {
  return switch (bodyType) {
    'skinny' || 'lean' => 'skinny',
    'big' => 'big',
    _ => 'medium',
  };
}

String avatarModelBaseRigBuildClass(String? bodyType) {
  return normalizeAvatarBodyType(bodyType);
}

String avatarModelBaseRigAssetIdFor({
  required String? gender,
  required String? bodyType,
}) {
  return avatarModelBaseRigDefinitionFor(
    gender: gender,
    bodyType: bodyType,
  ).assetId;
}

AvatarBaseModelDefinition avatarModelBaseRigDefinitionFor({
  required String? gender,
  required String? bodyType,
}) {
  return avatarModelBaseRigDefinitions.firstWhere(
    (definition) => definition.matches(gender: gender, bodyType: bodyType),
    orElse: () => avatarModelBaseRigDefinitions.firstWhere(
      (definition) =>
          definition.gender == 'male' && definition.build == 'medium',
    ),
  );
}

String avatarModelBaseRigAssetIdForConfig(HoopRankAvatarConfig config) {
  final explicitBaseRigAssetId = config.modelBaseRigAssetId?.trim();
  if (explicitBaseRigAssetId != null &&
      avatarModelBaseRigAssetIds.contains(explicitBaseRigAssetId)) {
    return explicitBaseRigAssetId;
  }
  return avatarModelBaseRigAssetIdFor(
    gender: config.gender,
    bodyType: config.bodyType,
  );
}

String avatarModelBaseRigModelUrl(String baseRigAssetId) =>
    'assets/avatar_models/$baseRigAssetId.glb';

String avatarModelBaseRigPosterUrl(String baseRigAssetId) =>
    'assets/avatar_models/${baseRigAssetId}_poster.webp';

String avatarModelBaseRigSpriteUrl(String baseRigAssetId) =>
    'assets/avatar_models/${baseRigAssetId}_sprite.webp';

const List<AvatarOption> avatarHeightOptions = [
  AvatarOption('compact', '5-10 Guard'),
  AvatarOption('standard', '6-3 Wing'),
  AvatarOption('tall', '6-7 Forward'),
  AvatarOption('center', '6-10 Big'),
];

const List<AvatarOption> avatarSkinToneOptions = [
  AvatarOption('fair', 'Fair'),
  AvatarOption('golden', 'Golden'),
  AvatarOption('bronze', 'Bronze'),
  AvatarOption('tan', 'Tan'),
  AvatarOption('light', 'Light'),
  AvatarOption('brown', 'Brown'),
  AvatarOption('deep', 'Deep'),
  AvatarOption('rich', 'Rich'),
];

const List<AvatarOption> avatarHairStyleOptions = [
  AvatarOption('fade', 'Fade'),
  AvatarOption('straight', 'Straight'),
  AvatarOption('curls', 'Curls'),
  AvatarOption('locs', 'Locs'),
  AvatarOption('braids', 'Braids'),
  AvatarOption('buzz', 'Buzz'),
  AvatarOption('bald', 'Bald'),
];

const List<AvatarOption> avatarHairColorOptions = [
  AvatarOption('black', 'Black'),
  AvatarOption('brown', 'Brown'),
  AvatarOption('blonde', 'Blonde'),
  AvatarOption('red', 'Red'),
  AvatarOption('blue', 'Blue'),
];

const List<AvatarOption> avatarOutfitOptions = [
  AvatarOption('jersey', 'Jersey'),
  AvatarOption('hoodie', 'Hoodie'),
  AvatarOption('warmups', 'Warmups'),
  AvatarOption('tee', 'Park Tee'),
];

const List<AvatarOption> avatarStanceOptions = [
  AvatarOption('tripleThreat', 'Triple Threat'),
  AvatarOption('dribble', 'Low Dribble'),
  AvatarOption('jumper', 'Jumper'),
  AvatarOption('crossedArms', 'Locked In'),
];

const List<AvatarOption> avatarAccessoryOptions = [
  AvatarOption('none', 'None'),
  AvatarOption('headband', 'Headband'),
  AvatarOption('sleeve', 'Arm Sleeve'),
  AvatarOption('wristbands', 'Wristbands'),
  AvatarOption('chain', 'Chain'),
  AvatarOption('goggles', 'Goggles'),
];

const List<AvatarOption> avatarCourtVibeOptions = [
  AvatarOption('blacktop', 'Blacktop'),
  AvatarOption('rec', 'Rec Center'),
  AvatarOption('summer', 'Summer Run'),
  AvatarOption('night', 'Night Lights'),
  AvatarOption('proAm', 'Pro-Am'),
  AvatarOption('street', 'Streetball'),
];

const List<AvatarSwatch> avatarColorOptions = [
  AvatarSwatch('orange', 'HoopRank', '#F97316', '#111827'),
  AvatarSwatch('green', 'Money Green', '#22C55E', '#111827'),
  AvatarSwatch('sky', 'Sky Court', '#38BDF8', '#0F172A'),
  AvatarSwatch('pink', 'Tunnel Fit', '#FB7185', '#111827'),
  AvatarSwatch('gold', 'Gold Run', '#EAB308', '#18181B'),
  AvatarSwatch('purple', 'Pro-Am', '#8B5CF6', '#111827'),
];

class AvatarOption {
  final String value;
  final String label;

  const AvatarOption(this.value, this.label);
}

class AvatarSwatch {
  final String value;
  final String label;
  final String primary;
  final String secondary;

  const AvatarSwatch(this.value, this.label, this.primary, this.secondary);
}

class AvatarBaseModelDefinition {
  final String assetId;
  final String gender;
  final String build;

  const AvatarBaseModelDefinition({
    required this.assetId,
    required this.gender,
    required this.build,
  });

  bool matches({
    required String? gender,
    required String? bodyType,
  }) {
    return this.gender == normalizeAvatarGender(gender) &&
        build == avatarModelBaseRigBuildClass(bodyType);
  }
}

class AvatarBasePersonPreset {
  final String value;
  final String label;
  final String skinTone;
  final String skinHex;
  final String defaultHairStyle;
  final String defaultHairColor;
  final String faceShape;
  final String eyeStyle;
  final double headWidthScale;
  final double headHeightScale;
  final double eyeSpacing;
  final double eyeWidthScale;
  final double eyeHeightScale;
  final double noseWidthScale;
  final double mouthWidthScale;

  const AvatarBasePersonPreset({
    required this.value,
    required this.label,
    required this.skinTone,
    required this.skinHex,
    required this.defaultHairStyle,
    required this.defaultHairColor,
    required this.faceShape,
    required this.eyeStyle,
    required this.headWidthScale,
    required this.headHeightScale,
    required this.eyeSpacing,
    required this.eyeWidthScale,
    required this.eyeHeightScale,
    required this.noseWidthScale,
    required this.mouthWidthScale,
  });

  HoopRankAvatarConfig applyTo(HoopRankAvatarConfig config) {
    return config.copyWith(
      baseAppearance: value,
      skinTone: skinTone,
      hairStyle: defaultHairStyle,
      hairColor: defaultHairColor,
    );
  }
}

class AvatarLookPreset {
  final String label;
  final String caption;
  final String outfit;
  final String stance;
  final String accessory;
  final String courtVibe;
  final String renderAsset;
  final String modelAssetId;
  final String modelBaseRigAssetId;
  final String modelAnimationName;
  final String modelCameraOrbit;
  final String modelCameraTarget;
  final String modelFieldOfView;
  final String modelScale;
  final String modelSource;
  final String modelQualityTier;
  final String modelRigContract;
  final String modelTopology;
  final List<String> modelCapabilities;
  final double avatarPreviewScale;

  const AvatarLookPreset({
    required this.label,
    required this.caption,
    required this.outfit,
    required this.stance,
    required this.accessory,
    required this.courtVibe,
    required this.renderAsset,
    required this.modelAssetId,
    this.modelBaseRigAssetId = avatarModelBaseRigAssetId,
    required this.modelAnimationName,
    required this.modelCameraOrbit,
    required this.modelCameraTarget,
    required this.modelFieldOfView,
    required this.modelScale,
    this.modelSource = avatarModelSourceProductionDcc,
    this.modelQualityTier = avatarModelQualityModernGameRig,
    this.modelRigContract = avatarModelRigContractBaseV1,
    this.modelTopology = avatarModelTopologyReusableBaseRig,
    this.modelCapabilities = avatarModelBaseRigCapabilities,
    this.avatarPreviewScale = 1.18,
  });

  String get imageUrl => '$generatedAvatarAssetScheme$renderAsset';

  HoopRankAvatarConfig applyTo(HoopRankAvatarConfig config) {
    final preserveBaseRig = _shouldPreserveAttachedBaseRig(config);
    final selectedBaseRigAssetId = avatarModelBaseRigAssetIdFor(
      gender: config.gender,
      bodyType: config.bodyType,
    );
    return HoopRankAvatarConfig(
      seed: config.seed,
      label: config.label,
      variant: config.variant,
      position: config.position,
      isNewPlayer: config.isNewPlayer,
      gender: config.gender,
      baseAppearance: config.baseAppearance,
      bodyType: config.bodyType,
      height: config.height,
      skinTone: config.skinTone,
      hairStyle: config.hairStyle,
      hairColor: config.hairColor,
      outfit: outfit,
      stance: stance,
      accessory: accessory,
      courtVibe: courtVibe,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      jerseyNumber: config.jerseyNumber,
      modelAssetId: preserveBaseRig ? config.modelAssetId : modelAssetId,
      modelBaseRigAssetId:
          preserveBaseRig ? config.modelBaseRigAssetId : selectedBaseRigAssetId,
      modelUrl: preserveBaseRig
          ? config.modelUrl
          : (productionAvatarModelsEnabled
              ? avatarModelBaseRigModelUrl(selectedBaseRigAssetId)
              : null),
      modelPosterUrl: preserveBaseRig
          ? config.modelPosterUrl
          : (productionAvatarModelsEnabled
              ? avatarModelBaseRigPosterUrl(selectedBaseRigAssetId)
              : null),
      modelSpriteUrl: preserveBaseRig
          ? config.modelSpriteUrl
          : (productionAvatarModelsEnabled
              ? avatarModelBaseRigSpriteUrl(selectedBaseRigAssetId)
              : null),
      modelAnimationName: preserveBaseRig
          ? modelAnimationName
          : (productionAvatarModelsEnabled ? modelAnimationName : null),
      modelCameraOrbit: preserveBaseRig
          ? (config.modelCameraOrbit ?? modelCameraOrbit)
          : (productionAvatarModelsEnabled ? modelCameraOrbit : null),
      modelCameraTarget: preserveBaseRig
          ? (config.modelCameraTarget ?? modelCameraTarget)
          : (productionAvatarModelsEnabled ? modelCameraTarget : null),
      modelFieldOfView: preserveBaseRig
          ? (config.modelFieldOfView ?? modelFieldOfView)
          : (productionAvatarModelsEnabled ? modelFieldOfView : null),
      modelScale: preserveBaseRig
          ? (config.modelScale ?? modelScale)
          : (productionAvatarModelsEnabled ? modelScale : null),
      modelSource: preserveBaseRig ? config.modelSource : modelSource,
      modelQualityTier:
          preserveBaseRig ? config.modelQualityTier : modelQualityTier,
      modelRigContract:
          preserveBaseRig ? config.modelRigContract : modelRigContract,
      modelTopology: preserveBaseRig ? config.modelTopology : modelTopology,
      modelCapabilities:
          preserveBaseRig ? config.modelCapabilities : modelCapabilities,
      modelLicense: preserveBaseRig ? config.modelLicense : null,
      modelAttribution: preserveBaseRig ? config.modelAttribution : null,
    );
  }
}

class HoopRankAvatarConfig {
  final String seed;
  final String label;
  final int variant;
  final String? position;
  final bool isNewPlayer;
  final String gender;
  final String baseAppearance;
  final String bodyType;
  final String height;
  final String skinTone;
  final String hairStyle;
  final String hairColor;
  final String outfit;
  final String stance;
  final String accessory;
  final String courtVibe;
  final String primaryColor;
  final String secondaryColor;
  final String jerseyNumber;
  final String? modelAssetId;
  final String? modelBaseRigAssetId;
  final String? modelUrl;
  final String? modelPosterUrl;
  final String? modelSpriteUrl;
  final String? modelAnimationName;
  final String? modelCameraOrbit;
  final String? modelCameraTarget;
  final String? modelFieldOfView;
  final String? modelScale;
  final String? modelSource;
  final String? modelQualityTier;
  final String? modelRigContract;
  final String? modelTopology;
  final List<String> modelCapabilities;
  final String? modelLicense;
  final String? modelAttribution;

  const HoopRankAvatarConfig({
    required this.seed,
    required this.label,
    required this.variant,
    this.position,
    this.isNewPlayer = false,
    this.gender = 'male',
    this.baseAppearance = 'black',
    this.bodyType = 'medium',
    this.height = 'standard',
    this.skinTone = 'deep',
    this.hairStyle = 'curls',
    this.hairColor = 'black',
    this.outfit = 'jersey',
    this.stance = 'tripleThreat',
    this.accessory = 'none',
    this.courtVibe = 'blacktop',
    this.primaryColor = '#F97316',
    this.secondaryColor = '#111827',
    this.jerseyNumber = '23',
    this.modelAssetId,
    this.modelBaseRigAssetId,
    this.modelUrl,
    this.modelPosterUrl,
    this.modelSpriteUrl,
    this.modelAnimationName,
    this.modelCameraOrbit,
    this.modelCameraTarget,
    this.modelFieldOfView,
    this.modelScale,
    this.modelSource,
    this.modelQualityTier,
    this.modelRigContract,
    this.modelTopology,
    this.modelCapabilities = const [],
    this.modelLicense,
    this.modelAttribution,
  });

  factory HoopRankAvatarConfig.fromJson(Map<String, dynamic> json) {
    final colorValue = json['colorway']?.toString();
    final swatch = avatarColorOptions.firstWhere(
      (option) => option.value == colorValue,
      orElse: () => avatarColorOptions.first,
    );
    final baseAppearance = _baseAppearanceFromJson(json);
    final basePreset = avatarBasePersonPresetFor(baseAppearance);
    return HoopRankAvatarConfig(
      seed: json['seed']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      variant: _variantFromConfig(json),
      position: _emptyToNull(json['position']),
      isNewPlayer: isNewPlayerAvatarConfig(json),
      gender: normalizeAvatarGender(
        _optionOrDefault(
          json['gender'] ?? json['sex'],
          avatarGenderOptions,
          'male',
        ),
      ),
      baseAppearance: baseAppearance,
      bodyType: normalizeAvatarBodyType(
        (json['bodyType'] ?? json['body_type'])?.toString(),
      ),
      height: _optionOrDefault(
        json['height'] ?? json['heightClass'] ?? json['height_class'],
        avatarHeightOptions,
        'standard',
      ),
      skinTone: _optionOrDefault(
        json['skinTone'] ?? json['skin_tone'],
        avatarSkinToneOptions,
        basePreset.skinTone,
      ),
      hairStyle: _optionOrDefault(
        json['hairStyle'] ?? json['hair_style'],
        avatarHairStyleOptions,
        basePreset.defaultHairStyle,
      ),
      hairColor: _optionOrDefault(
        json['hairColor'] ?? json['hair_color'],
        avatarHairColorOptions,
        basePreset.defaultHairColor,
      ),
      outfit: _optionOrDefault(json['outfit'], avatarOutfitOptions, 'jersey'),
      stance:
          _optionOrDefault(json['stance'], avatarStanceOptions, 'tripleThreat'),
      accessory:
          _optionOrDefault(json['accessory'], avatarAccessoryOptions, 'none'),
      courtVibe: _optionOrDefault(
        json['courtVibe'] ?? json['court_vibe'],
        avatarCourtVibeOptions,
        'blacktop',
      ),
      primaryColor: json['primaryColor']?.toString() ??
          json['primary_color']?.toString() ??
          swatch.primary,
      secondaryColor: json['secondaryColor']?.toString() ??
          json['secondary_color']?.toString() ??
          swatch.secondary,
      jerseyNumber:
          _jerseyNumber(json['jerseyNumber'] ?? json['jersey_number']),
      modelAssetId: _emptyToNull(
        json['modelAssetId'] ?? json['model_asset_id'] ?? json['modelPreset'],
      ),
      modelBaseRigAssetId: _emptyToNull(
        json['modelBaseRigAssetId'] ??
            json['model_base_rig_asset_id'] ??
            json['baseRigAssetId'] ??
            json['base_rig_asset_id'],
      ),
      modelUrl: _emptyToNull(
        json['modelUrl'] ??
            json['model_url'] ??
            json['modelAsset'] ??
            json['model_asset'],
      ),
      modelPosterUrl: _emptyToNull(
        json['modelPosterUrl'] ??
            json['model_poster_url'] ??
            json['modelPoster'],
      ),
      modelSpriteUrl: _emptyToNull(
        json['modelSpriteUrl'] ??
            json['model_sprite_url'] ??
            json['mapSpriteUrl'] ??
            json['map_sprite_url'] ??
            json['spriteUrl'] ??
            json['sprite_url'],
      ),
      modelAnimationName: _emptyToNull(
        json['modelAnimationName'] ??
            json['model_animation_name'] ??
            json['animationName'],
      ),
      modelCameraOrbit: _emptyToNull(
        json['modelCameraOrbit'] ??
            json['model_camera_orbit'] ??
            json['cameraOrbit'],
      ),
      modelCameraTarget: _emptyToNull(
        json['modelCameraTarget'] ??
            json['model_camera_target'] ??
            json['cameraTarget'],
      ),
      modelFieldOfView: _emptyToNull(
        json['modelFieldOfView'] ??
            json['model_field_of_view'] ??
            json['fieldOfView'],
      ),
      modelScale: _emptyToNull(
        json['modelScale'] ?? json['model_scale'] ?? json['scale'],
      ),
      modelSource: _emptyToNull(
        json['modelSource'] ??
            json['model_source'] ??
            json['modelProvider'] ??
            json['model_provider'],
      ),
      modelQualityTier: _emptyToNull(
        json['modelQualityTier'] ??
            json['model_quality_tier'] ??
            json['qualityTier'] ??
            json['quality_tier'],
      ),
      modelRigContract: _emptyToNull(
        json['modelRigContract'] ??
            json['model_rig_contract'] ??
            json['rigContract'] ??
            json['rig_contract'],
      ),
      modelTopology: _emptyToNull(
        json['modelTopology'] ??
            json['model_topology'] ??
            json['avatarRigTopology'] ??
            json['avatar_rig_topology'],
      ),
      modelCapabilities: _stringList(
        json['modelCapabilities'] ??
            json['model_capabilities'] ??
            json['avatarRigCapabilities'] ??
            json['avatar_rig_capabilities'],
      ),
      modelLicense: _emptyToNull(
        json['modelLicense'] ?? json['model_license'] ?? json['license'],
      ),
      modelAttribution: _emptyToNull(
        json['modelAttribution'] ??
            json['model_attribution'] ??
            json['attribution'],
      ),
    );
  }

  HoopRankAvatarConfig copyWith({
    String? seed,
    String? label,
    int? variant,
    String? position,
    bool? isNewPlayer,
    String? gender,
    String? baseAppearance,
    String? bodyType,
    String? height,
    String? skinTone,
    String? hairStyle,
    String? hairColor,
    String? outfit,
    String? stance,
    String? accessory,
    String? courtVibe,
    String? primaryColor,
    String? secondaryColor,
    String? jerseyNumber,
    String? modelAssetId,
    String? modelBaseRigAssetId,
    String? modelUrl,
    String? modelPosterUrl,
    String? modelSpriteUrl,
    String? modelAnimationName,
    String? modelCameraOrbit,
    String? modelCameraTarget,
    String? modelFieldOfView,
    String? modelScale,
    String? modelSource,
    String? modelQualityTier,
    String? modelRigContract,
    String? modelTopology,
    List<String>? modelCapabilities,
    String? modelLicense,
    String? modelAttribution,
  }) {
    final nextGender = normalizeAvatarGender(gender ?? this.gender);
    final nextBodyType = normalizeAvatarBodyType(bodyType ?? this.bodyType);
    final canRetargetBundledBaseRig = modelBaseRigAssetId == null &&
        (this.modelBaseRigAssetId == null ||
            avatarModelBaseRigAssetIds.contains(this.modelBaseRigAssetId));
    return HoopRankAvatarConfig(
      seed: seed ?? this.seed,
      label: label ?? this.label,
      variant: variant ?? this.variant,
      position: position ?? this.position,
      isNewPlayer: isNewPlayer ?? this.isNewPlayer,
      gender: nextGender,
      baseAppearance: baseAppearance ?? this.baseAppearance,
      bodyType: nextBodyType,
      height: height ?? this.height,
      skinTone: skinTone ?? this.skinTone,
      hairStyle: hairStyle ?? this.hairStyle,
      hairColor: hairColor ?? this.hairColor,
      outfit: outfit ?? this.outfit,
      stance: stance ?? this.stance,
      accessory: accessory ?? this.accessory,
      courtVibe: courtVibe ?? this.courtVibe,
      primaryColor: primaryColor ?? this.primaryColor,
      secondaryColor: secondaryColor ?? this.secondaryColor,
      jerseyNumber: jerseyNumber ?? this.jerseyNumber,
      modelAssetId: modelAssetId ?? this.modelAssetId,
      modelBaseRigAssetId: modelBaseRigAssetId ??
          (canRetargetBundledBaseRig
              ? avatarModelBaseRigAssetIdFor(
                  gender: nextGender,
                  bodyType: nextBodyType,
                )
              : this.modelBaseRigAssetId),
      modelUrl: modelUrl ?? this.modelUrl,
      modelPosterUrl: modelPosterUrl ?? this.modelPosterUrl,
      modelSpriteUrl: modelSpriteUrl ?? this.modelSpriteUrl,
      modelAnimationName: modelAnimationName ?? this.modelAnimationName,
      modelCameraOrbit: modelCameraOrbit ?? this.modelCameraOrbit,
      modelCameraTarget: modelCameraTarget ?? this.modelCameraTarget,
      modelFieldOfView: modelFieldOfView ?? this.modelFieldOfView,
      modelScale: modelScale ?? this.modelScale,
      modelSource: modelSource ?? this.modelSource,
      modelQualityTier: modelQualityTier ?? this.modelQualityTier,
      modelRigContract: modelRigContract ?? this.modelRigContract,
      modelTopology: modelTopology ?? this.modelTopology,
      modelCapabilities: modelCapabilities ?? this.modelCapabilities,
      modelLicense: modelLicense ?? this.modelLicense,
      modelAttribution: modelAttribution ?? this.modelAttribution,
    );
  }

  Map<String, dynamic> toJson() {
    final json = {
      'type': generatedAvatarType,
      'seed': seed,
      'label': label,
      'variant': variant % generatedAvatarVariantCount,
      'position': position,
      'isNewPlayer': isNewPlayer,
      'gender': gender,
      'baseAppearance': baseAppearance,
      'bodyType': normalizeAvatarBodyType(bodyType),
      'height': height,
      'skinTone': skinTone,
      'hairStyle': hairStyle,
      'hairColor': hairColor,
      'outfit': outfit,
      'stance': stance,
      'accessory': accessory,
      'courtVibe': courtVibe,
      'primaryColor': primaryColor,
      'secondaryColor': secondaryColor,
      'jerseyNumber': jerseyNumber,
    };
    if (modelAssetId != null && modelAssetId!.trim().isNotEmpty) {
      json['modelAssetId'] = modelAssetId!;
    }
    if (modelBaseRigAssetId != null && modelBaseRigAssetId!.trim().isNotEmpty) {
      json['modelBaseRigAssetId'] = modelBaseRigAssetId!;
    }
    if (modelSource != null && modelSource!.trim().isNotEmpty) {
      json['modelSource'] = modelSource!;
    }
    if (modelQualityTier != null && modelQualityTier!.trim().isNotEmpty) {
      json['modelQualityTier'] = modelQualityTier!;
    }
    if (modelRigContract != null && modelRigContract!.trim().isNotEmpty) {
      json['modelRigContract'] = modelRigContract!;
    }
    if (modelTopology != null && modelTopology!.trim().isNotEmpty) {
      json['modelTopology'] = modelTopology!;
    }
    if (modelCapabilities.isNotEmpty) {
      json['modelCapabilities'] = modelCapabilities;
    }
    if (modelLicense != null && modelLicense!.trim().isNotEmpty) {
      json['modelLicense'] = modelLicense!;
    }
    if (modelAttribution != null && modelAttribution!.trim().isNotEmpty) {
      json['modelAttribution'] = modelAttribution!;
    }
    if (modelUrl != null && modelUrl!.trim().isNotEmpty) {
      json['modelUrl'] = modelUrl!;
      if (modelPosterUrl != null && modelPosterUrl!.trim().isNotEmpty) {
        json['modelPosterUrl'] = modelPosterUrl!;
      }
      if (modelSpriteUrl != null && modelSpriteUrl!.trim().isNotEmpty) {
        json['modelSpriteUrl'] = modelSpriteUrl!;
      }
      if (modelAnimationName != null && modelAnimationName!.trim().isNotEmpty) {
        json['modelAnimationName'] = modelAnimationName!;
      }
      if (modelCameraOrbit != null && modelCameraOrbit!.trim().isNotEmpty) {
        json['modelCameraOrbit'] = modelCameraOrbit!;
      }
      if (modelCameraTarget != null && modelCameraTarget!.trim().isNotEmpty) {
        json['modelCameraTarget'] = modelCameraTarget!;
      }
      if (modelFieldOfView != null && modelFieldOfView!.trim().isNotEmpty) {
        json['modelFieldOfView'] = modelFieldOfView!;
      }
      if (modelScale != null && modelScale!.trim().isNotEmpty) {
        json['modelScale'] = modelScale!;
      }
    }
    return json;
  }

  String toDataUrl() => generatedAvatarDataUrl(toJson());
}

int get generatedAvatarVariantCount => avatarColorOptions.length;

int get generatedAvatarFullVariationCount =>
    avatarLookPresets.length *
    avatarGenderOptions.length *
    avatarBodyOptions.length *
    avatarBasePersonPresets.length *
    avatarHairStyleOptions.length *
    avatarHairColorOptions.length *
    avatarColorOptions.length;

Map<String, dynamic> buildGeneratedAvatarConfig({
  required String seed,
  required String label,
  required int variant,
  String? position,
  bool isNewPlayer = false,
  String gender = 'male',
  String? baseAppearance,
  String bodyType = 'medium',
  String height = 'standard',
  String? skinTone,
  String? hairStyle,
  String? hairColor,
  String outfit = 'jersey',
  String stance = 'tripleThreat',
  String accessory = 'none',
  String courtVibe = 'blacktop',
  String? primaryColor,
  String? secondaryColor,
  String jerseyNumber = '23',
  String? modelAssetId,
  String? modelBaseRigAssetId,
  String? modelUrl,
  String? modelPosterUrl,
  String? modelSpriteUrl,
  String? modelAnimationName,
  String? modelCameraOrbit,
  String? modelCameraTarget,
  String? modelFieldOfView,
  String? modelScale,
  String? modelSource,
  String? modelQualityTier,
  String? modelRigContract,
  String? modelTopology,
  List<String>? modelCapabilities,
  String? modelLicense,
  String? modelAttribution,
}) {
  final swatch = avatarColorOptions[variant.abs() % avatarColorOptions.length];
  final preset = avatarLookPresetFor(outfit: outfit, stance: stance);
  final basePreset = avatarBasePersonPresetFor(
    _optionOrDefault(
      baseAppearance ?? _baseAppearanceForLegacySkinTone(skinTone),
      avatarBaseAppearanceOptions,
      'black',
    ),
  );
  final explicitModelUrl = _emptyToNull(modelUrl);
  final normalizedGender = normalizeAvatarGender(gender);
  final normalizedBodyType = normalizeAvatarBodyType(bodyType);
  final selectedBaseRigAssetId = _emptyToNull(modelBaseRigAssetId) ??
      avatarModelBaseRigAssetIdFor(
        gender: normalizedGender,
        bodyType: normalizedBodyType,
      );
  final presetModelUrl = productionAvatarModelsEnabled
      ? avatarModelBaseRigModelUrl(selectedBaseRigAssetId)
      : null;
  final usesPresetModelUrl =
      explicitModelUrl == null || explicitModelUrl == presetModelUrl;
  return HoopRankAvatarConfig(
    seed: seed,
    label: isNewPlayer ? newPlayerAvatarLabel : label.trim(),
    variant: variant,
    position: position,
    isNewPlayer: isNewPlayer,
    gender: normalizedGender,
    baseAppearance: basePreset.value,
    bodyType: normalizedBodyType,
    height: height,
    skinTone: skinTone ?? basePreset.skinTone,
    hairStyle: hairStyle ?? basePreset.defaultHairStyle,
    hairColor: hairColor ?? basePreset.defaultHairColor,
    outfit: outfit,
    stance: stance,
    accessory: accessory,
    courtVibe: courtVibe,
    primaryColor: primaryColor ?? swatch.primary,
    secondaryColor: secondaryColor ?? swatch.secondary,
    jerseyNumber: _jerseyNumber(jerseyNumber),
    modelAssetId: _emptyToNull(modelAssetId) ?? preset?.modelAssetId,
    modelBaseRigAssetId: selectedBaseRigAssetId,
    modelUrl: explicitModelUrl ?? presetModelUrl,
    modelPosterUrl: _emptyToNull(modelPosterUrl) ??
        (productionAvatarModelsEnabled
            ? avatarModelBaseRigPosterUrl(selectedBaseRigAssetId)
            : null),
    modelSpriteUrl: _emptyToNull(modelSpriteUrl) ??
        (productionAvatarModelsEnabled
            ? avatarModelBaseRigSpriteUrl(selectedBaseRigAssetId)
            : null),
    modelAnimationName: _emptyToNull(modelAnimationName) ??
        (productionAvatarModelsEnabled ? preset?.modelAnimationName : null),
    modelCameraOrbit: _emptyToNull(modelCameraOrbit) ??
        (productionAvatarModelsEnabled ? preset?.modelCameraOrbit : null),
    modelCameraTarget: _emptyToNull(modelCameraTarget) ??
        (productionAvatarModelsEnabled ? preset?.modelCameraTarget : null),
    modelFieldOfView: _emptyToNull(modelFieldOfView) ??
        (productionAvatarModelsEnabled ? preset?.modelFieldOfView : null),
    modelScale: _emptyToNull(modelScale) ??
        (productionAvatarModelsEnabled ? preset?.modelScale : null),
    modelSource: _emptyToNull(modelSource) ??
        (usesPresetModelUrl ? preset?.modelSource : null),
    modelQualityTier: _emptyToNull(modelQualityTier) ??
        (usesPresetModelUrl ? preset?.modelQualityTier : null),
    modelRigContract: _emptyToNull(modelRigContract) ??
        (usesPresetModelUrl ? preset?.modelRigContract : null),
    modelTopology: _emptyToNull(modelTopology) ??
        (usesPresetModelUrl ? preset?.modelTopology : null),
    modelCapabilities: modelCapabilities ??
        (usesPresetModelUrl ? preset?.modelCapabilities : const <String>[]) ??
        const <String>[],
    modelLicense: _emptyToNull(modelLicense),
    modelAttribution: _emptyToNull(modelAttribution),
  ).toJson();
}

Map<String, dynamic> buildNewPlayerAvatarConfig({
  required String seed,
  int variant = 0,
}) {
  return buildGeneratedAvatarConfig(
    seed: seed,
    label: newPlayerAvatarLabel,
    variant: variant,
    isNewPlayer: true,
    outfit: 'hoodie',
    stance: 'crossedArms',
    accessory: 'headband',
    jerseyNumber: '00',
  );
}

Map<String, dynamic> attachProductionAvatarModel({
  required Map<String, dynamic> config,
  required String modelAssetId,
  String? modelBaseRigAssetId,
  required String modelUrl,
  required String modelPosterUrl,
  required String modelSpriteUrl,
  String? modelAnimationName,
  String? modelCameraOrbit,
  String? modelCameraTarget,
  String? modelFieldOfView,
  String? modelScale,
  String modelSource = avatarModelSourceExternalGlb,
  String modelQualityTier = avatarModelQualityModernGameRig,
  String modelRigContract = avatarModelRigContractBaseV1,
  String modelTopology = avatarModelTopologyReusableBaseRig,
  List<String> modelCapabilities = avatarModelBaseRigCapabilities,
  String? modelLicense,
  String? modelAttribution,
}) {
  if (!isGeneratedAvatarConfig(config)) {
    throw ArgumentError.value(
      config,
      'config',
      'Production avatar models can only be attached to generated avatars.',
    );
  }
  _validateProductionAvatarAttachment(
    modelUrl: modelUrl,
    modelPosterUrl: modelPosterUrl,
    modelSpriteUrl: modelSpriteUrl,
    modelSource: modelSource,
    modelQualityTier: modelQualityTier,
    modelRigContract: modelRigContract,
    modelTopology: modelTopology,
    modelCapabilities: modelCapabilities,
  );
  return HoopRankAvatarConfig.fromJson(config)
      .copyWith(
        modelAssetId: modelAssetId,
        modelBaseRigAssetId: _emptyToNull(modelBaseRigAssetId) ??
            (modelTopology == avatarModelTopologyReusableBaseRig
                ? modelAssetId
                : null),
        modelUrl: modelUrl,
        modelPosterUrl: modelPosterUrl,
        modelSpriteUrl: modelSpriteUrl,
        modelAnimationName: modelAnimationName,
        modelCameraOrbit: modelCameraOrbit,
        modelCameraTarget: modelCameraTarget,
        modelFieldOfView: modelFieldOfView,
        modelScale: modelScale,
        modelSource: modelSource,
        modelQualityTier: modelQualityTier,
        modelRigContract: modelRigContract,
        modelTopology: modelTopology,
        modelCapabilities: modelCapabilities,
        modelLicense: modelLicense,
        modelAttribution: modelAttribution,
      )
      .toJson();
}

void _validateProductionAvatarAttachment({
  required String modelUrl,
  required String modelPosterUrl,
  required String modelSpriteUrl,
  required String modelSource,
  required String modelQualityTier,
  required String modelRigContract,
  required String modelTopology,
  required List<String> modelCapabilities,
}) {
  final errors = <String>[];
  if (!isProductionAvatarModelUrl(modelUrl)) {
    errors.add('modelUrl must be a production HTTPS or bundled GLB URL');
  }
  if (!isProductionAvatarImageUrl(modelPosterUrl)) {
    errors.add('modelPosterUrl must be a production PNG/WebP/JPG URL');
  }
  if (!isProductionAvatarImageUrl(modelSpriteUrl)) {
    errors.add('modelSpriteUrl must be a production PNG/WebP/JPG URL');
  }
  if (modelSource != avatarModelSourceProductionDcc &&
      modelSource != avatarModelSourceExternalGlb &&
      modelSource != avatarModelSourceProvider) {
    errors.add(
        'modelSource must be productionDcc, externalGlb, or avatarProvider');
  }
  if (modelQualityTier != avatarModelQualityModernGameRig) {
    errors.add('modelQualityTier must be modernGameRig');
  }
  if (modelRigContract != avatarModelRigContractBaseV1) {
    errors.add('modelRigContract must be $avatarModelRigContractBaseV1');
  }
  if (modelTopology != avatarModelTopologyReusableBaseRig) {
    errors.add('modelTopology must be reusableBaseRig');
  }
  if (!_hasBaseRigCapabilities(modelCapabilities)) {
    errors.add('modelCapabilities must include every base-rig capability');
  }
  if (errors.isNotEmpty) {
    throw ArgumentError(
        'Incomplete production avatar attachment: ${errors.join('; ')}');
  }
}

/// Historical name retained for existing call sites.
///
/// Generated avatars now resolve to bundled high-end render assets instead of
/// procedural SVG/PNG strings. The returned value is an app-local image URL.
String generatedAvatarDataUrl(Map<String, dynamic> rawConfig) {
  final config = HoopRankAvatarConfig.fromJson(rawConfig);
  final productionImageUrl = generatedAvatarProductionImageUrl(rawConfig);
  if (productionImageUrl != null) return productionImageUrl;
  if (!generatedAvatarFallbackArtworkAllowed(rawConfig)) return '';
  return '$generatedAvatarAssetScheme${generatedAvatarRenderAssetPath(config)}';
}

String? generatedAvatarModelUrl(
  Map<String, dynamic>? rawConfig, {
  bool allowDevelopmentBaseRig = false,
}) {
  return generatedAvatarModelSpec(
    rawConfig,
    allowDevelopmentBaseRig: allowDevelopmentBaseRig,
  )?.url;
}

AvatarModelSpec? generatedAvatarModelSpec(
  Map<String, dynamic>? rawConfig, {
  bool allowDevelopmentBaseRig = false,
}) {
  if (!isGeneratedAvatarConfig(rawConfig)) return null;
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  final url = config.modelUrl?.trim();
  final allowBundledDevelopmentBaseRig =
      allowDevelopmentBaseRig && bundledDevelopmentAvatarModelsEnabled;
  if ((url == null || url.isEmpty) &&
      (productionAvatarModelsEnabled || allowBundledDevelopmentBaseRig)) {
    return _baseRigAvatarModelSpec(
      config,
      productionApproved: productionAvatarModelsEnabled,
    );
  }
  if (allowBundledDevelopmentBaseRig &&
      url != null &&
      isBundledProductionAvatarModelUrl(url) &&
      !_isBundledBaseRigAvatarModelUrl(url)) {
    return _baseRigAvatarModelSpec(
      config,
      productionApproved: false,
    );
  }
  if (url == null || url.isEmpty) return null;
  if (!_avatarModelRuntimeAllowed(config, url)) return null;
  return AvatarModelSpec(
    url: url,
    assetId: config.modelAssetId,
    baseRigAssetId: config.modelBaseRigAssetId,
    posterUrl: config.modelPosterUrl,
    spriteUrl: config.modelSpriteUrl,
    animationName: config.modelAnimationName,
    cameraOrbit: config.modelCameraOrbit,
    cameraTarget: config.modelCameraTarget,
    fieldOfView: config.modelFieldOfView,
    scale: config.modelScale,
    source: config.modelSource,
    qualityTier: config.modelQualityTier,
    rigContract: config.modelRigContract,
    topology: config.modelTopology,
    capabilities: config.modelCapabilities,
    license: config.modelLicense,
    attribution: config.modelAttribution,
  );
}

AvatarModelSpec _baseRigAvatarModelSpec(
  HoopRankAvatarConfig config, {
  required bool productionApproved,
}) {
  final preset = avatarLookPresetFor(
    outfit: config.outfit,
    stance: config.stance,
  );
  final baseRigAssetId = avatarModelBaseRigAssetIdForConfig(config);
  return AvatarModelSpec(
    url: avatarModelBaseRigModelUrl(baseRigAssetId),
    assetId: config.modelAssetId ?? preset?.modelAssetId,
    baseRigAssetId: baseRigAssetId,
    posterUrl: avatarModelBaseRigPosterUrl(baseRigAssetId),
    spriteUrl: avatarModelBaseRigSpriteUrl(baseRigAssetId),
    animationName: preset?.modelAnimationName ?? config.modelAnimationName,
    cameraOrbit: config.modelCameraOrbit ?? preset?.modelCameraOrbit,
    cameraTarget: config.modelCameraTarget ?? preset?.modelCameraTarget,
    fieldOfView: config.modelFieldOfView ?? preset?.modelFieldOfView,
    scale: config.modelScale ?? preset?.modelScale,
    source: productionApproved
        ? avatarModelSourceProductionDcc
        : avatarModelSourceDebugPrototype,
    qualityTier: productionApproved
        ? avatarModelQualityModernGameRig
        : avatarModelQualityPrototype,
    rigContract: avatarModelRigContractBaseV1,
    topology: avatarModelTopologyReusableBaseRig,
    capabilities: avatarModelBaseRigCapabilities,
  );
}

String? generatedAvatarProductionSpriteUrl(Map<String, dynamic>? rawConfig) {
  final modelSpec = generatedAvatarModelSpec(rawConfig);
  final spriteUrl = modelSpec?.spriteUrl?.trim();
  if (spriteUrl == null || spriteUrl.isEmpty) return null;
  if (!isProductionAvatarImageUrl(spriteUrl)) return null;
  return spriteUrl;
}

/// Returns an image for previewing the selected base body.
///
/// Development base-rig sprites are not exact customized renders: runtime
/// material, hair, outfit, and pose layers still need the model-viewer or
/// layered runtime render path. Keep this opt-in so map/player avatars do not
/// collapse distinct customizations into the same static base body.
String? generatedAvatarPreviewSpriteUrl(
  Map<String, dynamic>? rawConfig, {
  bool allowDevelopmentBaseRig = false,
}) {
  final productionSpriteUrl = generatedAvatarProductionSpriteUrl(rawConfig);
  if (productionSpriteUrl != null) return productionSpriteUrl;
  if (!allowDevelopmentBaseRig) return null;
  if (!bundledDevelopmentAvatarSpritesEnabled) return null;

  final modelSpec = generatedAvatarModelSpec(
    rawConfig,
    allowDevelopmentBaseRig: true,
  );
  if (modelSpec?.source != avatarModelSourceDebugPrototype) return null;
  final spriteUrl = modelSpec?.spriteUrl?.trim();
  if (spriteUrl == null || spriteUrl.isEmpty) return null;
  if (!isProductionAvatarImageUrl(spriteUrl)) return null;
  return spriteUrl;
}

String? generatedAvatarCustomizedSpriteUrl(
  Map<String, dynamic>? rawConfig, {
  bool allowDevelopmentFallback = false,
}) {
  final allowBundledSprite = bundledCustomizedAvatarSpritesEnabled ||
      lowQualityAvatarFallbacksEnabled ||
      (allowDevelopmentFallback && bundledDevelopmentAvatarSpritesEnabled);
  if (!allowBundledSprite) return null;
  if (!isGeneratedAvatarConfig(rawConfig)) return null;
  if (generatedAvatarModelSpec(rawConfig) != null) return null;
  final spriteConfig = generatedAvatarBundledSpriteConfig(rawConfig);
  if (spriteConfig == null) return null;
  return '$generatedAvatarAssetScheme'
      '${generatedAvatarCustomizedSpriteAssetPath(spriteConfig)}';
}

Map<String, dynamic>? generatedAvatarBundledSpriteConfig(
  Map<String, dynamic>? rawConfig,
) {
  if (!isGeneratedAvatarConfig(rawConfig)) return null;
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  final basePreset = avatarBasePersonPresetFor(config.baseAppearance);
  final look = _starterPackLookPresetFor(config);
  final starterSwatch = avatarColorOptions.first;
  return buildGeneratedAvatarConfig(
    seed: config.seed,
    label: config.label,
    variant: config.variant,
    position: config.position,
    isNewPlayer: config.isNewPlayer,
    gender: config.gender,
    baseAppearance: basePreset.value,
    bodyType: config.bodyType,
    height: 'standard',
    skinTone: basePreset.skinTone,
    hairStyle: basePreset.defaultHairStyle,
    hairColor: basePreset.defaultHairColor,
    outfit: look.outfit,
    stance: look.stance,
    accessory: look.accessory,
    courtVibe: look.courtVibe,
    primaryColor: starterSwatch.primary,
    secondaryColor: starterSwatch.secondary,
    jerseyNumber: '23',
    modelAssetId: look.modelAssetId,
    modelBaseRigAssetId: avatarModelBaseRigAssetIdFor(
      gender: config.gender,
      bodyType: config.bodyType,
    ),
    modelSource: look.modelSource,
    modelQualityTier: look.modelQualityTier,
    modelRigContract: look.modelRigContract,
    modelTopology: look.modelTopology,
    modelCapabilities: look.modelCapabilities,
  );
}

bool generatedAvatarCustomizedSpriteMatchesConfig(
  Map<String, dynamic>? rawConfig,
) {
  final spriteConfig = generatedAvatarBundledSpriteConfig(rawConfig);
  if (spriteConfig == null || !isGeneratedAvatarConfig(rawConfig)) {
    return false;
  }
  return generatedAvatarCustomizedSpriteId(rawConfig!) ==
      generatedAvatarCustomizedSpriteId(spriteConfig);
}

String generatedAvatarCustomizedSpriteAssetPath(
  Map<String, dynamic> rawConfig,
) {
  return '$generatedAvatarSpriteRoot'
      '${generatedAvatarCustomizedSpriteAssetStem(rawConfig)}.'
      '$generatedAvatarSpriteExtension';
}

AvatarLookPreset _starterPackLookPresetFor(HoopRankAvatarConfig config) {
  final exact = avatarLookPresetFor(
    outfit: config.outfit,
    stance: config.stance,
  );
  if (exact != null) return exact;
  for (final preset in avatarLookPresets) {
    if (preset.outfit == config.outfit) return preset;
  }
  for (final preset in avatarLookPresets) {
    if (preset.stance == config.stance) return preset;
  }
  return avatarLookPresets.first;
}

String generatedAvatarCustomizedSpriteAssetStem(
  Map<String, dynamic> rawConfig,
) {
  return 'avatar_${_stableSpriteIdHash(generatedAvatarCustomizedSpriteId(rawConfig))}';
}

String generatedAvatarCustomizedSpriteId(Map<String, dynamic> rawConfig) {
  final config = HoopRankAvatarConfig.fromJson(rawConfig);
  final look = avatarLookPresetFor(
    outfit: config.outfit,
    stance: config.stance,
  );
  final baseRigAssetId = avatarModelBaseRigAssetIdForConfig(config);
  return [
    'look_${look?.modelAssetId ?? '${config.outfit}_${config.stance}'}',
    'rig_$baseRigAssetId',
    'gender_${config.gender}',
    'build_${normalizeAvatarBodyType(config.bodyType)}',
    'height_${config.height}',
    'base_${config.baseAppearance}',
    'skin_${config.skinTone}',
    'hair_${config.hairStyle}_${config.hairColor}',
    'outfit_${config.outfit}',
    'stance_${config.stance}',
    'accessory_${config.accessory}',
    'fit_${_swatchValueFor(config.primaryColor, config.secondaryColor)}',
    'primary_${config.primaryColor}',
    'secondary_${config.secondaryColor}',
    'jersey_${config.jerseyNumber}',
  ].map(_fileSafePart).where((part) => part.isNotEmpty).join('__');
}

String? generatedAvatarProductionImageUrl(Map<String, dynamic>? rawConfig) {
  final modelSpec = generatedAvatarModelSpec(rawConfig);
  final spriteUrl = modelSpec?.spriteUrl?.trim();
  if (spriteUrl != null && isProductionAvatarImageUrl(spriteUrl)) {
    return spriteUrl;
  }
  final posterUrl = modelSpec?.posterUrl?.trim();
  if (posterUrl != null && isProductionAvatarImageUrl(posterUrl)) {
    return posterUrl;
  }
  return null;
}

bool generatedAvatarFallbackArtworkAllowed(Map<String, dynamic>? rawConfig) {
  if (!isGeneratedAvatarConfig(rawConfig)) return true;
  final hasProductionModel = generatedAvatarModelSpec(rawConfig) != null;
  return avatarFallbackArtworkAllowedForBuild(
    productionModelsEnabled:
        productionAvatarModelsEnabled || hasProductionModel,
    fallbackOverrideEnabled: lowQualityAvatarFallbacksEnabled,
  );
}

bool generatedAvatarProceduralPainterFallbackAllowed(
  Map<String, dynamic>? rawConfig,
) {
  if (!isGeneratedAvatarConfig(rawConfig)) return true;
  return generatedAvatarFallbackArtworkAllowed(rawConfig) &&
      proceduralAvatarPainterFallbacksEnabled;
}

bool avatarFallbackArtworkAllowedForBuild({
  required bool productionModelsEnabled,
  required bool fallbackOverrideEnabled,
}) {
  return fallbackOverrideEnabled;
}

Map<String, dynamic>? generatedAvatarModelCustomizationPayload(
  Map<String, dynamic>? rawConfig,
) {
  if (!isGeneratedAvatarConfig(rawConfig)) return null;
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  final primary = config.outfit == 'warmups'
      ? '#F8FAFC'
      : generatedAvatarClothesTintHex(rawConfig);
  final hairSlot =
      config.hairStyle == 'bald' ? null : 'avatar_hair_${config.hairStyle}';
  final outfitSlot = 'avatar_outfit_${config.outfit}';
  final selectedBaseRigAssetId =
      _avatarModelCustomizationBaseRigAssetId(config, rawConfig);

  return {
    'contract': config.modelRigContract ?? avatarModelRigContractBaseV1,
    'runtimeBinding': avatarModelRuntimeBindingBaseLayers,
    'baseSelectionAxes': avatarModelBaseSelectionAxes,
    'runtimeLayerAxes': avatarModelRuntimeLayerAxes,
    'baseRigAssetIds': avatarModelBaseRigAssetIds,
    'layeredBaseRigOnly': true,
    'baseRigAssetId': selectedBaseRigAssetId,
    'baseBody': {
      'gender': config.gender,
      'build': avatarModelBaseRigBuildClass(config.bodyType),
    },
    'animationName':
        avatarLookPresetFor(outfit: config.outfit, stance: config.stance)
                ?.modelAnimationName ??
            config.modelAnimationName,
    'look': {
      'outfit': config.outfit,
      'stance': config.stance,
    },
    'materials': {
      'avatar_skin': generatedAvatarSkinToneHex(rawConfig),
      'avatar_skin_shadow':
          _avatarShadowHex(generatedAvatarSkinToneHex(rawConfig)),
      'avatar_hair': generatedAvatarHairColorHex(rawConfig),
      'avatar_jersey_primary': primary,
      'avatar_shorts_secondary': config.secondaryColor,
      'avatar_trim': '#FFFFFF',
      'avatar_shoe': '#F4F8FF',
      'avatar_sole': '#111827',
      'avatar_sneaker_accent': primary,
      'avatar_ball': '#D97706',
      'avatar_ball_seam': '#5B250C',
    },
    'materialVisibility': {
      'hair': {
        'selected': hairSlot,
        'slots': [
          'avatar_hair_fade',
          'avatar_hair_straight',
          'avatar_hair_curls',
          'avatar_hair_locs',
          'avatar_hair_braids',
          'avatar_hair_buzz',
        ],
      },
    },
    'nodeVisibility': {
      'hair': {
        'selected': hairSlot,
        'nodes': [
          'avatar_hair_fade',
          'avatar_hair_straight',
          'avatar_hair_curls',
          'avatar_hair_locs',
          'avatar_hair_braids',
          'avatar_hair_buzz',
        ],
      },
      'outfit': {
        'selected': outfitSlot,
        'nodes': [
          'avatar_outfit_jersey',
          'avatar_outfit_hoodie',
          'avatar_outfit_warmups',
          'avatar_outfit_tee',
        ],
      },
    },
    'morphTargets': {
      'avatar_height_compact': config.height == 'compact' ? 1 : 0,
      'avatar_height_tall': config.height == 'tall' ? 1 : 0,
      'avatar_height_center': config.height == 'center' ? 1 : 0,
    },
  };
}

String _avatarModelCustomizationBaseRigAssetId(
  HoopRankAvatarConfig config,
  Map<String, dynamic> rawConfig,
) {
  final explicitBaseRigAssetId = config.modelBaseRigAssetId?.trim();
  if (explicitBaseRigAssetId != null &&
      explicitBaseRigAssetId.isNotEmpty &&
      !avatarModelBaseRigAssetIds.contains(explicitBaseRigAssetId)) {
    final modelSpec = generatedAvatarModelSpec(rawConfig);
    if (modelSpec?.baseRigAssetId == explicitBaseRigAssetId) {
      return explicitBaseRigAssetId;
    }
  }
  return avatarModelBaseRigAssetIdForConfig(config);
}

bool _avatarModelRuntimeAllowed(HoopRankAvatarConfig config, String url) {
  if (isDebugPrototypeAvatarModelUrl(url)) {
    return debugPrototypeAvatarModelsEnabled;
  }

  if (!isProductionAvatarModelUrl(url)) return false;

  final isBundledProductionModel = isBundledProductionAvatarModelUrl(url);
  final source = config.modelSource ??
      (isBundledProductionModel ? avatarModelSourceProductionDcc : null);
  final quality = config.modelQualityTier ??
      (isBundledProductionModel ? avatarModelQualityModernGameRig : null);
  final rigContract = config.modelRigContract ??
      (isBundledProductionModel ? avatarModelRigContractBaseV1 : null);
  final hasProductionSource = source == avatarModelSourceProductionDcc ||
      source == avatarModelSourceExternalGlb ||
      source == avatarModelSourceProvider;
  final hasProductionQuality = quality == avatarModelQualityModernGameRig;
  final hasRigContract = rigContract == avatarModelRigContractBaseV1;

  if (!hasProductionSource || !hasProductionQuality || !hasRigContract) {
    return false;
  }
  if (isExternalAvatarModelUrl(url)) return true;
  return productionAvatarModelsEnabled;
}

bool _isBundledBaseRigAvatarModelUrl(String url) {
  final normalized = _localAvatarAssetPath(url);
  return avatarModelBaseRigAssetIds.any(
    (assetId) => normalized == avatarModelBaseRigModelUrl(assetId),
  );
}

bool _isBundledBaseRigAvatarImageUrl(String url) {
  final normalized = _localAvatarAssetPath(url);
  return avatarModelBaseRigAssetIds.any(
    (assetId) =>
        normalized == avatarModelBaseRigPosterUrl(assetId) ||
        normalized == avatarModelBaseRigSpriteUrl(assetId),
  );
}

String _localAvatarAssetPath(String url) {
  final normalized = url.trim().toLowerCase();
  const assetScheme = generatedAvatarAssetScheme;
  if (normalized.startsWith(assetScheme)) {
    return normalized.substring(assetScheme.length);
  }
  return normalized;
}

bool _shouldPreserveAttachedBaseRig(HoopRankAvatarConfig config) {
  final url = config.modelUrl?.trim();
  if (url == null || url.isEmpty) return false;
  final source = config.modelSource;
  final hasProviderSource = source == avatarModelSourceExternalGlb ||
      source == avatarModelSourceProvider;
  return hasProviderSource &&
      config.modelQualityTier == avatarModelQualityModernGameRig &&
      config.modelRigContract == avatarModelRigContractBaseV1 &&
      config.modelTopology == avatarModelTopologyReusableBaseRig &&
      _hasBaseRigCapabilities(config.modelCapabilities) &&
      _avatarModelRuntimeAllowed(config, url);
}

bool _hasBaseRigCapabilities(List<String> capabilities) {
  if (capabilities.isEmpty) return false;
  final declared = capabilities.toSet();
  return avatarModelBaseRigCapabilities.every(declared.contains);
}

bool isExternalAvatarModelUrl(String? url) {
  final normalized = url?.trim().toLowerCase();
  if (normalized == null || normalized.isEmpty) return false;
  return normalized.startsWith('https://') && normalized.endsWith('.glb');
}

bool isProductionAvatarModelUrl(String? url) {
  final normalized = url?.trim().toLowerCase();
  if (normalized == null || normalized.isEmpty) return false;
  if (!normalized.endsWith('.glb')) return false;
  if (isDebugPrototypeAvatarModelUrl(normalized)) return false;
  if (isExternalAvatarModelUrl(normalized)) return true;
  return isBundledProductionAvatarModelUrl(normalized);
}

bool isProductionAvatarSpriteUrl(String? url) {
  return isProductionAvatarImageUrl(url);
}

bool isProductionAvatarImageUrl(String? url) {
  final normalized = url?.trim().toLowerCase();
  if (normalized == null || normalized.isEmpty) return false;
  final isImage = normalized.endsWith('.png') ||
      normalized.endsWith('.webp') ||
      normalized.endsWith('.jpg') ||
      normalized.endsWith('.jpeg');
  if (!isImage) return false;
  if (isDebugPrototypeAvatarModelUrl(normalized)) return false;
  if (normalized.startsWith('https://')) return true;
  return _isBundledBaseRigAvatarImageUrl(normalized);
}

bool isDebugPrototypeAvatarModelUrl(String? url) {
  final normalized = url?.trim().toLowerCase();
  if (normalized == null || normalized.isEmpty) return false;
  return normalized.contains('/game_rig_') ||
      normalized.contains('debug_game_rig') ||
      normalized.contains('prototype') ||
      normalized.contains('lit_relief');
}

bool isBundledProductionAvatarModelUrl(String? url) {
  final normalized = url?.trim().toLowerCase();
  if (normalized == null || normalized.isEmpty) return false;
  return _isBundledBaseRigAvatarModelUrl(normalized);
}

String generatedAvatarRenderAssetPath(HoopRankAvatarConfig config) {
  final preset = avatarLookPresetFor(
    outfit: config.outfit,
    stance: config.stance,
  );
  if (config.gender == 'female') {
    return _femaleRenderAssetFor(preset) ??
        nextgen3dFemaleGuardTripleThreatAsset;
  }
  return preset?.renderAsset ?? nextgen3dGuardTripleThreatAsset;
}

String? _femaleRenderAssetFor(AvatarLookPreset? preset) {
  return switch (preset?.renderAsset) {
    nextgen3dGuardTripleThreatAsset => nextgen3dFemaleGuardTripleThreatAsset,
    nextgen3dHoodieCrossedArmsAsset => nextgen3dFemaleHoodieCrossedArmsAsset,
    nextgen3dWarmupsJumperAsset => nextgen3dFemaleWarmupsJumperAsset,
    nextgen3dTeeDribbleAsset => nextgen3dFemaleTeeDribbleAsset,
    _ => null,
  };
}

double generatedAvatarPreviewScale(Map<String, dynamic>? rawConfig) {
  if (!isGeneratedAvatarConfig(rawConfig)) return 1.18;
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  final presetScale = avatarLookPresetFor(
        outfit: config.outfit,
        stance: config.stance,
      )?.avatarPreviewScale ??
      1.18;
  final heightFitScale = switch (config.height) {
    'tall' => .9,
    'center' => .78,
    _ => 1.0,
  };
  return presetScale * heightFitScale;
}

double generatedAvatarHeightScale(Map<String, dynamic>? rawConfig) {
  if (!isGeneratedAvatarConfig(rawConfig)) return 1;
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  return switch (config.height) {
    'compact' => .94,
    'tall' => 1.06,
    'center' => 1.11,
    _ => 1.0,
  };
}

double generatedAvatarBodyWidthScale(Map<String, dynamic>? rawConfig) {
  if (!isGeneratedAvatarConfig(rawConfig)) return 1;
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  final bodyScale = switch (normalizeAvatarBodyType(config.bodyType)) {
    'skinny' => .94,
    'big' => 1.09,
    _ => 1.0,
  };
  final genderScale = config.gender == 'female' ? .92 : 1.0;
  return bodyScale * genderScale;
}

String generatedAvatarSkinToneHex(Map<String, dynamic>? rawConfig) {
  if (!isGeneratedAvatarConfig(rawConfig)) return '#C9895F';
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  final basePreset = avatarBasePersonPresetFor(config.baseAppearance);
  if (config.skinTone == basePreset.skinTone) return basePreset.skinHex;
  return switch (config.skinTone) {
    'fair' => '#F2C7A8',
    'golden' => '#E9B77F',
    'bronze' => '#B8754A',
    'light' => '#F1C8A6',
    'brown' => '#9B5F3A',
    'deep' => '#6F3F2A',
    'rich' => '#4B2C20',
    _ => '#C9895F',
  };
}

String generatedAvatarHairColorHex(Map<String, dynamic>? rawConfig) {
  if (!isGeneratedAvatarConfig(rawConfig)) return '#1F1713';
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  return switch (config.hairColor) {
    'brown' => '#5A3828',
    'blonde' => '#D8B56A',
    'red' => '#8E3328',
    'blue' => '#1D4ED8',
    _ => '#1F1713',
  };
}

String generatedAvatarClothesTintHex(Map<String, dynamic>? rawConfig) {
  if (!isGeneratedAvatarConfig(rawConfig)) return '#F97316';
  final config = HoopRankAvatarConfig.fromJson(rawConfig!);
  return config.primaryColor;
}

AvatarBasePersonPreset avatarBasePersonPresetFor(String? value) {
  final normalized = value?.trim();
  for (final preset in avatarBasePersonPresets) {
    if (preset.value == normalized) return preset;
  }
  return avatarBasePersonPresets.firstWhere(
    (preset) => preset.value == 'black',
  );
}

Iterable<Map<String, dynamic>> buildGeneratedAvatarVariationConfigs({
  String seedPrefix = 'avatar-variation',
  String label = 'HoopRank Player',
  String? position,
  String? gender,
  String? bodyType,
  String? baseAppearance,
  String height = 'standard',
}) sync* {
  var index = 0;
  final genderOptions = gender == null
      ? avatarGenderOptions
      : avatarGenderOptions.where((option) => option.value == gender);
  final bodyOptions = bodyType == null
      ? avatarBodyOptions
      : avatarBodyOptions
          .where((option) => option.value == normalizeAvatarBodyType(bodyType));
  final baseOptions = baseAppearance == null
      ? avatarBasePersonPresets
      : avatarBasePersonPresets
          .where((preset) => preset.value == baseAppearance);
  for (final look in avatarLookPresets) {
    for (final genderOption in genderOptions) {
      for (final body in bodyOptions) {
        for (final basePreset in baseOptions) {
          for (final hairStyle in avatarHairStyleOptions) {
            for (final hairColor in avatarHairColorOptions) {
              for (final swatch in avatarColorOptions) {
                final config = HoopRankAvatarConfig.fromJson(
                  buildGeneratedAvatarConfig(
                    seed: '$seedPrefix-$index',
                    label: label,
                    variant: index,
                    position: position,
                    gender: genderOption.value,
                    baseAppearance: basePreset.value,
                    bodyType: body.value,
                    height: height,
                    hairStyle: hairStyle.value,
                    hairColor: hairColor.value,
                    outfit: look.outfit,
                    stance: look.stance,
                    accessory: look.accessory,
                    courtVibe: look.courtVibe,
                    primaryColor: swatch.primary,
                    secondaryColor: swatch.secondary,
                    modelAssetId: look.modelAssetId,
                  ),
                );
                yield config.toJson();
                index++;
              }
            }
          }
        }
      }
    }
  }
}

String generatedAvatarVariationId(Map<String, dynamic> rawConfig) {
  final config = HoopRankAvatarConfig.fromJson(rawConfig);
  final look = avatarLookPresetFor(
    outfit: config.outfit,
    stance: config.stance,
  );
  return [
    look?.modelAssetId ?? '${config.outfit}_${config.stance}',
    'gender_${config.gender}',
    'build_${config.bodyType}',
    'base_${config.baseAppearance}',
    'hair_${config.hairStyle}_${config.hairColor}',
    'fit_${_swatchValueFor(config.primaryColor, config.secondaryColor)}',
  ].map(_fileSafePart).join('__');
}

AvatarLookPreset? avatarLookPresetFor({
  required String? outfit,
  required String? stance,
}) {
  for (final preset in avatarLookPresets) {
    if (preset.outfit == outfit && preset.stance == stance) {
      return preset;
    }
  }
  for (final preset in avatarLookPresets) {
    if (preset.stance == stance || preset.outfit == outfit) {
      return preset;
    }
  }
  return null;
}

class AvatarModelSpec {
  final String url;
  final String? assetId;
  final String? baseRigAssetId;
  final String? posterUrl;
  final String? spriteUrl;
  final String? animationName;
  final String? cameraOrbit;
  final String? cameraTarget;
  final String? fieldOfView;
  final String? scale;
  final String? source;
  final String? qualityTier;
  final String? rigContract;
  final String? topology;
  final List<String> capabilities;
  final String? license;
  final String? attribution;

  const AvatarModelSpec({
    required this.url,
    this.assetId,
    this.baseRigAssetId,
    this.posterUrl,
    this.spriteUrl,
    this.animationName,
    this.cameraOrbit,
    this.cameraTarget,
    this.fieldOfView,
    this.scale,
    this.source,
    this.qualityTier,
    this.rigContract,
    this.topology,
    this.capabilities = const [],
    this.license,
    this.attribution,
  });
}

int nextGeneratedAvatarVariant(Map<String, dynamic>? currentConfig) {
  return (_variantFromConfig(currentConfig) + 1) % generatedAvatarVariantCount;
}

List<Map<String, dynamic>> buildGeneratedAvatarVariants({
  required String seed,
  required String label,
  String? position,
  bool isNewPlayer = false,
}) {
  return List.generate(
    generatedAvatarVariantCount,
    (variant) => buildGeneratedAvatarConfig(
      seed: seed,
      label: label,
      variant: variant,
      position: position,
      isNewPlayer: isNewPlayer,
    ),
  );
}

bool isGeneratedAvatarConfig(Map<String, dynamic>? config) {
  return config?['type']?.toString() == generatedAvatarType;
}

bool isNewPlayerAvatarConfig(Map<String, dynamic>? config) {
  final raw = config?['isNewPlayer'] ?? config?['is_new_player'];
  if (raw is bool) return raw;
  if (raw is num) return raw != 0;
  if (raw is String) return raw.toLowerCase() == 'true' || raw == '1';
  return config?['label']?.toString() == newPlayerAvatarLabel;
}

int _variantFromConfig(Map<String, dynamic>? config) {
  final raw = config?['variant'];
  if (raw is num) return raw.toInt().abs() % generatedAvatarVariantCount;
  if (raw is String) {
    return (int.tryParse(raw) ?? 0).abs() % generatedAvatarVariantCount;
  }
  return 0;
}

String _optionOrDefault(
  dynamic value,
  List<AvatarOption> options,
  String fallback,
) {
  final text = value?.toString();
  if (text != null && options.any((option) => option.value == text)) {
    return text;
  }
  return fallback;
}

String _baseAppearanceFromJson(Map<String, dynamic> json) {
  final explicit = _optionOrDefault(
    json['baseAppearance'] ??
        json['base_appearance'] ??
        json['ethnicity'] ??
        json['appearance'],
    avatarBaseAppearanceOptions,
    '',
  );
  if (explicit.isNotEmpty) return explicit;
  return _baseAppearanceForLegacySkinTone(
    json['skinTone'] ?? json['skin_tone'],
  );
}

String _baseAppearanceForLegacySkinTone(dynamic rawSkinTone) {
  return switch (rawSkinTone?.toString()) {
    'fair' => 'white',
    'golden' => 'asian',
    'bronze' => 'latino',
    'tan' => 'latino',
    'light' => 'white',
    'brown' => 'latino',
    'deep' => 'black',
    'rich' => 'black',
    _ => 'black',
  };
}

String _swatchValueFor(String primaryColor, String secondaryColor) {
  for (final swatch in avatarColorOptions) {
    if (swatch.primary == primaryColor && swatch.secondary == secondaryColor) {
      return swatch.value;
    }
  }
  return primaryColor;
}

String _fileSafePart(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');
}

String _stableSpriteIdHash(String value) {
  final first = _stableHash32(value, 0x811c9dc5);
  final second = _stableHash32(value, 0x27d4eb2d);
  return '${first.toRadixString(16).padLeft(8, '0')}'
      '${second.toRadixString(16).padLeft(8, '0')}';
}

int _stableHash32(String value, int seed) {
  var hash = seed & 0xffffffff;
  for (final codeUnit in value.codeUnits) {
    hash ^= codeUnit;
    hash = (hash * 16777619) & 0xffffffff;
  }
  return hash;
}

String? _emptyToNull(dynamic value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

List<String> _stringList(dynamic value) {
  if (value is List) {
    return value
        .map((item) => item?.toString().trim())
        .whereType<String>()
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) return const [];
  return text
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
}

String _avatarShadowHex(String value) {
  final hex = value.trim().replaceFirst('#', '');
  final parsed = hex.length == 6 ? int.tryParse(hex, radix: 16) : null;
  if (parsed == null) return '#7C4A32';
  final r = (((parsed >> 16) & 0xff) * .62).round().clamp(0, 255);
  final g = (((parsed >> 8) & 0xff) * .62).round().clamp(0, 255);
  final b = ((parsed & 0xff) * .62).round().clamp(0, 255);
  return '#${r.toRadixString(16).padLeft(2, '0')}'
          '${g.toRadixString(16).padLeft(2, '0')}'
          '${b.toRadixString(16).padLeft(2, '0')}'
      .toUpperCase();
}

String _jerseyNumber(dynamic value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) return '23';
  final cleaned = text.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
  if (cleaned.isEmpty) return '23';
  final padded = cleaned.padLeft(2, '0');
  return padded.substring(0, min(2, padded.length));
}

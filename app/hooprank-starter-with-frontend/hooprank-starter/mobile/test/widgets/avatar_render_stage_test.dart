import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/utils/avatar_model_viewer_runtime.dart';
import 'package:hooprank/utils/generated_avatar.dart';
import 'package:hooprank/widgets/avatar_game_mesh_painter.dart';
import 'package:hooprank/widgets/avatar_image.dart';
import 'package:hooprank/widgets/avatar_render_stage.dart';

void main() {
  test('model-viewer runtime applies base body layers with diagnostics', () {
    final config = buildGeneratedAvatarConfig(
      seed: 'runtime-player',
      label: 'Runtime Player',
      variant: 0,
      gender: 'female',
      bodyType: 'big',
      height: 'tall',
      hairStyle: 'braids',
      outfit: 'hoodie',
      stance: 'crossedArms',
    );

    final js = buildAvatarModelViewerCustomizationJs(
      avatarConfig: config,
      modelScale: '.720 .720 .720',
    );

    expect(js, isNotNull);
    expect(js, contains('model-viewer#$hoopRankAvatarModelViewerId'));
    expect(js, contains('__hoopRankAvatarRigStatus'));
    expect(js,
        contains('"runtimeBinding":"$avatarModelRuntimeBindingBaseLayers"'));
    expect(js, contains('"baseSelectionAxes":["gender","build"]'));
    expect(js, contains('"runtimeLayerAxes":["baseAppearance","skinTone"'));
    expect(
        js, contains('"baseRigAssetId":"$avatarModelFemaleBigBaseRigAssetId"'));
    expect(js, contains('"baseBody":{"gender":"female","build":"big"}'));
    expect(js, contains('"layeredBaseRigOnly":true'));
    expect(js, contains('"selected":"avatar_hair_braids"'));
    expect(js, contains('"selected":"avatar_outfit_hoodie"'));
    expect(js, contains('"avatar_height_tall":1'));
    expect(js, contains('hoopRankNormalizeRigName'));
    expect(js, contains('hoopRankApplyMorphInfluence'));
    expect(js, contains('avatar_outfit_hoodie'));
    expect(js, isNot(contains('avatar_gender_feminine')));
    expect(js, isNot(contains('avatar_build_big')));
  });

  testWidgets('AvatarRenderStage uses production image before painter fallback',
      (tester) async {
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
      modelSource: avatarModelSourceExternalGlb,
      modelQualityTier: avatarModelQualityModernGameRig,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            height: 420,
            child: AvatarRenderStage(
              imageUrl: generatedAvatarDataUrl(config),
              avatarConfig: config,
              fallback: const Text('fallback'),
            ),
          ),
        ),
      ),
    );

    expect(find.byType(Image), findsWidgets);
    expect(find.text('fallback'), findsNothing);
  });

  testWidgets('AvatarRenderStage does not use starter sprites by default',
      (tester) async {
    final config = buildGeneratedAvatarConfig(
      seed: 'stage-player',
      label: 'Stage Player',
      variant: 1,
      gender: 'female',
      bodyType: 'big',
      baseAppearance: 'latino',
      hairStyle: 'curls',
      outfit: 'warmups',
      stance: 'jumper',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            height: 420,
            child: AvatarRenderStage(
              imageUrl: generatedAvatarDataUrl(config),
              avatarConfig: config,
              fallback: const Text('fallback'),
            ),
          ),
        ),
      ),
    );

    expect(find.byType(HoopRankAvatarImage), findsNothing);
    expect(_avatarGameMeshPainterFinder(), findsNothing);
    expect(find.text('fallback'), findsOneWidget);
  });

  testWidgets('AvatarRenderStage does not use procedural painter by default',
      (tester) async {
    final config = buildGeneratedAvatarConfig(
      seed: 'stage-placeholder-player',
      label: 'Stage Placeholder Player',
      variant: 3,
      gender: 'male',
      bodyType: 'skinny',
      baseAppearance: 'white',
      hairStyle: 'fade',
      outfit: 'jersey',
      stance: 'tripleThreat',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            height: 420,
            child: AvatarRenderStage(
              imageUrl: generatedAvatarDataUrl(config),
              avatarConfig: config,
            ),
          ),
        ),
      ),
    );

    expect(find.byType(HoopRankAvatarImage), findsNothing);
    expect(_avatarGameMeshPainterFinder(), findsNothing);
    expect(find.byIcon(Icons.view_in_ar_rounded), findsOneWidget);
  });

  testWidgets(
      'AvatarRenderStage requires bundled dev assets for starter sprites',
      (tester) async {
    final config = buildGeneratedAvatarConfig(
      seed: 'stage-dev-player',
      label: 'Stage Dev Player',
      variant: 1,
      gender: 'female',
      bodyType: 'big',
      baseAppearance: 'latino',
      hairStyle: 'curls',
      outfit: 'warmups',
      stance: 'jumper',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            height: 420,
            child: AvatarRenderStage(
              imageUrl: generatedAvatarDataUrl(config),
              avatarConfig: config,
              allowDevelopmentAvatarSprite: true,
              fallback: const Text('fallback'),
            ),
          ),
        ),
      ),
    );

    expect(find.byType(HoopRankAvatarImage), findsNothing);
    expect(_avatarGameMeshPainterFinder(), findsNothing);
    expect(find.text('fallback'), findsOneWidget);
  });
}

Finder _avatarGameMeshPainterFinder() {
  return find.byWidgetPredicate(
    (widget) =>
        widget is CustomPaint && widget.painter is AvatarGameMeshPainter,
  );
}

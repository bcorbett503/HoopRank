import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/utils/generated_avatar.dart';
import 'package:hooprank/widgets/avatar_creator_sheet.dart';
import 'package:hooprank/widgets/avatar_render_stage.dart';

void main() {
  testWidgets('AvatarCreatorSheet preserves new-player avatar identity',
      (tester) async {
    AvatarCreatorResult? result;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await AvatarCreatorSheet.show(
                  context,
                  seed: 'new-player',
                  label: 'Maya Buckets',
                  initialConfig: buildNewPlayerAvatarConfig(seed: 'new-player'),
                  isNewPlayer: true,
                  enableModelViewer: false,
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Use Avatar'));
    await tester.pumpAndSettle();

    expect(result, isNotNull);
    expect(isNewPlayerAvatarConfig(result!.config), isTrue);
    expect(result!.config['label'], newPlayerAvatarLabel);
    expect(result!.dataUrl, isEmpty);
    expect(
      generatedAvatarRenderAssetPath(
        HoopRankAvatarConfig.fromJson(result!.config),
      ),
      nextgen3dHoodieCrossedArmsAsset,
    );
  });

  testWidgets('AvatarCreatorSheet saves the selected premium look',
      (tester) async {
    AvatarCreatorResult? result;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await AvatarCreatorSheet.show(
                  context,
                  seed: 'player-1',
                  label: 'Maya Buckets',
                  initialConfig: buildGeneratedAvatarConfig(
                    seed: 'player-1',
                    label: 'Maya Buckets',
                    variant: 0,
                    outfit: 'hoodie',
                    stance: 'crossedArms',
                  ),
                  enableModelViewer: false,
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Use Avatar'));
    await tester.pumpAndSettle();

    expect(result, isNotNull);
    expect(result!.config['outfit'], 'hoodie');
    expect(result!.config['stance'], 'crossedArms');
    expect(result!.config['modelAssetId'], 'player_locked_in_01');
    expect(result!.config['modelUrl'], isNull);
    expect(result!.dataUrl, isEmpty);
    expect(
      generatedAvatarRenderAssetPath(
        HoopRankAvatarConfig.fromJson(result!.config),
      ),
      nextgen3dHoodieCrossedArmsAsset,
    );
  });

  testWidgets('AvatarCreatorSheet saves adjustable player attributes',
      (tester) async {
    AvatarCreatorResult? result;
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(430, 1200);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await AvatarCreatorSheet.show(
                  context,
                  seed: 'player-attrs',
                  label: 'Maya Buckets',
                  initialConfig: buildGeneratedAvatarConfig(
                    seed: 'player-attrs',
                    label: 'Maya Buckets',
                    variant: 0,
                    baseAppearance: 'asian',
                    gender: 'female',
                    bodyType: 'big',
                    height: 'center',
                    hairStyle: 'locs',
                    hairColor: 'blue',
                    primaryColor: '#22C55E',
                    secondaryColor: '#111827',
                  ),
                  enableModelViewer: false,
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Use Avatar'));
    await tester.pumpAndSettle();

    expect(result, isNotNull);
    expect(result!.config['baseAppearance'], 'asian');
    expect(result!.config['skinTone'], 'golden');
    expect(result!.config['gender'], 'female');
    expect(result!.config['bodyType'], 'big');
    expect(result!.config['hairStyle'], 'locs');
    expect(result!.config['hairColor'], 'blue');
    expect(result!.config['height'], 'center');
    expect(result!.config['primaryColor'], '#22C55E');
    expect(result!.config['secondaryColor'], '#111827');
  });

  testWidgets('AvatarCreatorSheet does not use development GLBs by default',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                await AvatarCreatorSheet.show(
                  context,
                  seed: 'player-model-gate',
                  label: 'Maya Buckets',
                  initialConfig: buildGeneratedAvatarConfig(
                    seed: 'player-model-gate',
                    label: 'Maya Buckets',
                    variant: 0,
                  ),
                  enableModelViewer: true,
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    final stages =
        tester.widgetList<AvatarRenderStage>(find.byType(AvatarRenderStage));
    expect(stages, isNotEmpty);
    for (final stage in stages) {
      expect(stage.preferModelViewer, isFalse);
      expect(stage.allowDevelopmentAvatarSprite, isFalse);
      expect(stage.modelUrl, isNull);
    }
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/utils/generated_avatar.dart';
import 'package:hooprank/widgets/avatar_image.dart';

void main() {
  testWidgets('HoopRankAvatarImage renders production avatar asset URLs',
      (tester) async {
    final dataUrl = generatedAvatarDataUrl(
      attachProductionAvatarModel(
        config: buildGeneratedAvatarConfig(
          seed: 'player-1',
          label: 'Maya Buckets',
          variant: 0,
        ),
        modelAssetId: 'provider-avatar-image-test',
        modelUrl:
            'https://cdn.hooprank.test/avatars/provider-avatar-image-test.glb',
        modelPosterUrl:
            'https://cdn.hooprank.test/avatars/provider-avatar-image-test.webp',
        modelSpriteUrl:
            'https://cdn.hooprank.test/avatars/provider-avatar-image-test-sprite.webp',
        modelSource: avatarModelSourceProvider,
        modelQualityTier: avatarModelQualityModernGameRig,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HoopRankAvatarImage(
            imageUrl: dataUrl,
            width: 80,
            height: 80,
            fallback: const Text('fallback'),
          ),
        ),
      ),
    );

    expect(find.byType(Image), findsOneWidget);
    expect(find.text('fallback'), findsNothing);
  });

  testWidgets('HoopRankAvatarImage rejects SVG avatar sources', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              HoopRankAvatarImage(
                imageUrl:
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                width: 80,
                height: 80,
                fallback: Text('data fallback'),
              ),
              HoopRankAvatarImage(
                imageUrl: 'https://cdn.hooprank.test/avatars/player.svg',
                width: 80,
                height: 80,
                fallback: Text('remote fallback'),
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.byType(Image), findsNothing);
    expect(find.text('data fallback'), findsOneWidget);
    expect(find.text('remote fallback'), findsOneWidget);
  });
}

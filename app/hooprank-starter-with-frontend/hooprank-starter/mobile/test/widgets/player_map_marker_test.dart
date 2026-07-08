import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/models/map_hub_models.dart';
import 'package:hooprank/utils/generated_avatar.dart';
import 'package:hooprank/widgets/avatar_game_mesh_painter.dart';
import 'package:hooprank/widgets/avatar_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:hooprank/widgets/player_map_marker.dart';

void main() {
  testWidgets('PlayerMapMarker shows new-player status', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PlayerMapMarker(
            player: MapHubPlayer(
              id: 'player-1',
              name: 'New Player',
              lat: 37.78,
              lng: -122.42,
              isNewPlayer: true,
              statusLabel: 'New to HoopRank',
            ),
          ),
        ),
      ),
    );

    expect(find.text('New to HoopRank'), findsOneWidget);
  });

  testWidgets('PlayerMapMarker highlights challenge-ready players',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PlayerMapMarker(
            player: MapHubPlayer(
              id: 'player-2',
              name: 'Maya Buckets',
              lat: 37.78,
              lng: -122.42,
              rating: 4.6,
              acceptingChallenges: true,
              statusLabel: 'Accepting challenges',
            ),
          ),
        ),
      ),
    );

    expect(find.text('Accepting challenges'), findsOneWidget);
    // Other players lead with identity: "FirstName · rating".
    expect(find.text('Maya · 4.6'), findsOneWidget);
    expect(find.byIcon(Icons.flash_on_rounded), findsOneWidget);
  });

  testWidgets('PlayerMapMarker does not use starter sprites by default',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PlayerMapMarker(
            player: MapHubPlayer(
              id: 'player-3',
              name: 'Brett Corbett',
              avatarConfig: buildGeneratedAvatarConfig(
                seed: 'player-3',
                label: 'Brett Corbett',
                variant: 2,
                position: 'G',
                gender: 'male',
                bodyType: 'big',
                baseAppearance: 'white',
                hairStyle: 'buzz',
                hairColor: 'brown',
                outfit: 'hoodie',
                primaryColor: '#22C55E',
                stance: 'dribble',
              ),
              lat: 37.78,
              lng: -122.42,
              statusLabel: 'now',
            ),
          ),
        ),
      ),
    );

    expect(
        find.byKey(const ValueKey('full_body_avatar_figure')), findsOneWidget);
    expect(find.byType(HoopRankAvatarImage), findsNothing);
    expect(_avatarGameMeshPainterFinder(), findsNothing);
    expect(find.byIcon(Icons.view_in_ar_rounded), findsOneWidget);
    expect(find.text('now'), findsOneWidget);
    expect(find.text('BC'), findsNothing);
  });

  testWidgets('PlayerMapMarker requires bundled dev assets for dev sprites',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PlayerMapMarker(
            allowDevelopmentAvatarSprite: true,
            player: MapHubPlayer(
              id: 'player-3b',
              name: 'Brett Corbett',
              avatarConfig: buildGeneratedAvatarConfig(
                seed: 'player-3b',
                label: 'Brett Corbett',
                variant: 2,
                stance: 'dribble',
              ),
              lat: 37.78,
              lng: -122.42,
              statusLabel: 'now',
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
      'PlayerMapMarker shows neutral avatar and setup nudge for current user '
      'without a flat avatar', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PlayerMapMarker(
            player: MapHubPlayer(
              id: 'me-unset',
              name: 'New Me',
              lat: 37.78,
              lng: -122.42,
              isCurrentUser: true,
              statusLabel: 'now',
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const ValueKey('flat_avatar_figure')), findsOneWidget);
    expect(find.byKey(const ValueKey('setup_nudge_badge')), findsOneWidget);
    expect(find.byIcon(Icons.view_in_ar_rounded), findsNothing);
    expect(find.text('Me'), findsOneWidget);
    expect(find.text('now'), findsOneWidget);
  });

  testWidgets('PlayerMapMarker uses production avatar sprite when available',
      (tester) async {
    final baseConfig = buildGeneratedAvatarConfig(
      seed: 'player-4',
      label: 'Maya Buckets',
      variant: 0,
    );
    final avatarConfig = attachProductionAvatarModel(
      config: baseConfig,
      modelAssetId: 'provider-avatar-456',
      modelUrl: 'https://cdn.hooprank.test/avatars/provider-avatar-456.glb',
      modelPosterUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-456.webp',
      modelSpriteUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-456-sprite.webp',
      modelSource: avatarModelSourceExternalGlb,
      modelQualityTier: avatarModelQualityModernGameRig,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PlayerMapMarker(
            player: MapHubPlayer(
              id: 'player-4',
              name: 'Maya Buckets',
              avatarConfig: avatarConfig,
              lat: 37.78,
              lng: -122.42,
              rating: 4.2,
              statusLabel: 'Locked in',
            ),
          ),
        ),
      ),
    );

    expect(
        find.byKey(const ValueKey('full_body_avatar_figure')), findsOneWidget);
    final avatarImage =
        tester.widget<HoopRankAvatarImage>(find.byType(HoopRankAvatarImage));
    expect(avatarImage.fallback, isNot(isA<Stack>()));
    expect(_avatarGameMeshPainterFinder(), findsNothing);
    expect(find.text('Maya · 4.2'), findsOneWidget);
    expect(find.text('Locked in'), findsOneWidget);
  });

  testWidgets('PlayerMapMarker does not downgrade provider GLB to painter art',
      (tester) async {
    final avatarConfig = buildGeneratedAvatarConfig(
      seed: 'player-5',
      label: 'Maya Buckets',
      variant: 0,
      modelAssetId: 'provider-avatar-no-sprite',
      modelUrl:
          'https://cdn.hooprank.test/avatars/provider-avatar-no-sprite.glb',
      modelSource: avatarModelSourceProvider,
      modelQualityTier: avatarModelQualityModernGameRig,
      modelRigContract: avatarModelRigContractBaseV1,
      modelTopology: avatarModelTopologyReusableBaseRig,
      modelCapabilities: avatarModelBaseRigCapabilities,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PlayerMapMarker(
            player: MapHubPlayer(
              id: 'player-5',
              name: 'Maya Buckets',
              avatarConfig: avatarConfig,
              lat: 37.78,
              lng: -122.42,
              rating: 4.2,
              statusLabel: 'Missing sprite',
            ),
          ),
        ),
      ),
    );

    expect(
        find.byKey(const ValueKey('full_body_avatar_figure')), findsOneWidget);
    expect(find.byType(HoopRankAvatarImage), findsNothing);
    expect(_avatarGameMeshPainterFinder(), findsNothing);
    expect(find.byIcon(Icons.view_in_ar_rounded), findsOneWidget);
    expect(find.text('Missing sprite'), findsOneWidget);
  });

  testWidgets('PlayerMapMarker renders flat Avatar Lab svg when present',
      (tester) async {
    const flatSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 560">'
        '<circle cx="210" cy="280" r="100" fill="#F4581B"/></svg>';
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PlayerMapMarker(
            player: MapHubPlayer(
              id: 'player-flat',
              name: 'Flat Avatar',
              lat: 37.78,
              lng: -122.42,
              isCurrentUser: true,
              statusLabel: 'now',
              avatarConfig: {
                'schema': 'hooprank-flat-v1',
                'svg': flatSvg,
                'gender': 'male',
              },
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const ValueKey('flat_avatar_figure')), findsOneWidget);
    expect(find.byType(SvgPicture), findsOneWidget);
    expect(find.byKey(const ValueKey('full_body_avatar_figure')), findsNothing);
    // Customized avatar: no setup nudge.
    expect(find.byKey(const ValueKey('setup_nudge_badge')), findsNothing);
    expect(find.text('Me'), findsOneWidget);
    expect(find.text('now'), findsOneWidget);
  });

  testWidgets('PlayerClusterMarker shows the consolidated player count',
      (tester) async {
    await tester.pumpWidget(const _ClusterHarness(count: 7));

    expect(find.byKey(const ValueKey('player_cluster_bubble')), findsOneWidget);
    expect(find.text('7'), findsOneWidget);
    expect(find.text('hoopers'), findsOneWidget);
    expect(find.byIcon(Icons.groups_rounded), findsOneWidget);
  });

  testWidgets('PlayerClusterMarker fires onTap', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: PlayerClusterMarker(
              count: 3,
              onTap: () => tapped = true,
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.byKey(const ValueKey('player_cluster_bubble')));
    expect(tapped, isTrue);
  });
}

Finder _avatarGameMeshPainterFinder() {
  return find.byWidgetPredicate(
    (widget) =>
        widget is CustomPaint && widget.painter is AvatarGameMeshPainter,
  );
}

// -- Cluster bubble ---------------------------------------------------------

void _noop() {}

class _ClusterHarness extends StatelessWidget {
  final int count;
  final bool accepting;
  const _ClusterHarness({required this.count, this.accepting = false});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: PlayerClusterMarker(
            count: count,
            acceptingChallenges: accepting,
            onTap: _noop,
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../models.dart';
import '../models/map_hub_models.dart';
import '../widgets/court_details_sheet.dart';
import '../widgets/court_map_widget.dart';
import '../widgets/map_quick_actions.dart';
import '../widgets/player_profile_sheet.dart';

class HomeMapHubScreen extends StatelessWidget {
  const HomeMapHubScreen({super.key});

  void _showCourtDetails(BuildContext context, Court court) {
    CourtDetailsSheet.show(context, court);
  }

  void _showPlayerDetails(BuildContext context, MapHubPlayer player) {
    PlayerProfileSheet.showById(context, player.id);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        CourtMapWidget(
          showCourtList: false,
          showPlayers: true,
          showStatusBubbles: true,
          showHubControls: false,
          enablePermissionOnboarding: true,
          initialRunsFilter: 'all',
          initialIndoorFilter: null,
          onCourtSelected: (court) => _showCourtDetails(context, court),
          onPlayerSelected: (player) => _showPlayerDetails(context, player),
          onFeedSelected: () => context.push('/play/feed'),
        ),
        // Quick actions: profile + Invite on the left, Quick Play centered.
        // Full width so the orb lines up with the Play tab beneath it.
        const Positioned(
          left: 16,
          right: 16,
          bottom: 14,
          child: MapQuickActions(),
        ),
      ],
    );
  }
}

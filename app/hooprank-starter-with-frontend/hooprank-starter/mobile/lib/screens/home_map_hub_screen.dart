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
        // Quick actions: profile / Quick Play / share. Right inset keeps the
        // row clear of the map's zoom & locate FAB column.
        const Positioned(
          left: 16,
          right: 88,
          bottom: 14,
          child: MapQuickActions(),
        ),
      ],
    );
  }
}

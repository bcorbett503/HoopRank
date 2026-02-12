import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/tutorial_state.dart';
import '../services/api_service.dart';
import 'hooprank_app_bar.dart';

class ScaffoldWithNavBar extends StatefulWidget {
  const ScaffoldWithNavBar({
    required this.navigationShell,
    Key? key,
  }) : super(key: key ?? const ValueKey<String>('ScaffoldWithNavBar'));

  final StatefulNavigationShell navigationShell;
  
  /// Static callback to refresh the badge from anywhere (e.g., after reading messages)
  static void Function()? refreshBadge;

  @override
  State<ScaffoldWithNavBar> createState() => _ScaffoldWithNavBarState();
}

class _ScaffoldWithNavBarState extends State<ScaffoldWithNavBar> {
  int _unreadCount = 0;
  int _teamInvitesCount = 0;
  int _challengeCount = 0;
  bool _hasLoadedInitially = false;

  @override
  void initState() {
    super.initState();
    _loadBadgeCounts();
    ScaffoldWithNavBar.refreshBadge = _loadBadgeCounts;
  }
  
  @override
  void dispose() {
    ScaffoldWithNavBar.refreshBadge = null;
    super.dispose();
  }

  @override
  void didUpdateWidget(ScaffoldWithNavBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Only refresh on first load, not every widget update (was causing stale data issue)
    if (!_hasLoadedInitially) {
      _loadBadgeCounts();
    }
  }

  Future<void> _loadBadgeCounts() async {
    try {
      // Load all counts in parallel
      final results = await Future.wait([
        ApiService.getUnreadMessageCount(),
        ApiService.getTeamInvites(),
        ApiService.getPendingChallenges(),
      ]);
      if (mounted) {
        setState(() {
          _unreadCount = results[0] as int;
          _teamInvitesCount = (results[1] as List).length;
          // Count incoming challenges (where user is receiver)
          final challenges = results[2] as List;
          _challengeCount = challenges.where((c) => c['direction'] == 'incoming').length;
          _hasLoadedInitially = true;
        });
      }
    } catch (e) {
      // Silently fail - badge not critical
      debugPrint('Failed to load badge counts: $e');
    }
  }

  void _onTap(BuildContext context, int index) {
    // Check for tutorial step completion for Rankings (index 0)
    if (index == 0) {
      final tutorial = Provider.of<TutorialState>(context, listen: false);
      // Only complete if we're on the specific step
      if (tutorial.isActive && tutorial.currentStep?.id == 'go_to_rankings') {
        tutorial.completeStep('go_to_rankings');
      }
    }

    // If navigating to messages tab, badge will be refreshed when they exit a chat
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Check if current screen is Feed (index 2) - Feed has its own app bar
    final isFeedScreen = widget.navigationShell.currentIndex == 2;
    
    return Scaffold(
      appBar: isFeedScreen ? null : const HoopRankAppBar(),
      body: widget.navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: widget.navigationShell.currentIndex,
        onDestinationSelected: (int index) => _onTap(context, index),
        destinations: [
          NavigationDestination(
            key: TutorialKeys.getKey(TutorialKeys.rankingsTab),
            icon: const Icon(Icons.leaderboard),
            label: 'Rankings',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _unreadCount > 0,
              label: Text(
                _unreadCount > 99 ? '99+' : _unreadCount.toString(),
                style: const TextStyle(fontSize: 10),
              ),
              child: const Icon(Icons.message),
            ),
            label: 'Messages',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _challengeCount > 0,
              label: Text(
                _challengeCount > 99 ? '99+' : _challengeCount.toString(),
                style: const TextStyle(fontSize: 10),
              ),
              child: const Icon(Icons.sports_basketball),
            ),
            label: 'Feed',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _teamInvitesCount > 0,
              label: Text(
                _teamInvitesCount > 99 ? '99+' : _teamInvitesCount.toString(),
                style: const TextStyle(fontSize: 10),
              ),
              child: const Icon(Icons.groups),
            ),
            label: 'Teams',
          ),
          const NavigationDestination(icon: Icon(Icons.place), label: 'Courts'),
        ],
      ),
    );
  }
}


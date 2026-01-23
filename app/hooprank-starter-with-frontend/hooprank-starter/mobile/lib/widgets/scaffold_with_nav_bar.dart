import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/api_service.dart';

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
  bool _hasLoadedInitially = false;

  @override
  void initState() {
    super.initState();
    _loadUnreadCount();
    ScaffoldWithNavBar.refreshBadge = _loadUnreadCount;
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
      _loadUnreadCount();
    }
  }

  Future<void> _loadUnreadCount() async {
    try {
      final count = await ApiService.getUnreadMessageCount();
      if (mounted) {
        setState(() {
          _unreadCount = count;
          _hasLoadedInitially = true;
        });
      }
    } catch (e) {
      // Silently fail - badge not critical
    }
  }

  void _onTap(BuildContext context, int index) {
    // If navigating to messages tab, badge will be refreshed when they exit a chat
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: widget.navigationShell.currentIndex,
        onDestinationSelected: (int index) => _onTap(context, index),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.leaderboard), label: 'Rankings'),
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
          const NavigationDestination(icon: Icon(Icons.sports_basketball), label: 'Play'),
          const NavigationDestination(icon: Icon(Icons.groups), label: 'Teams'),
          const NavigationDestination(icon: Icon(Icons.place), label: 'Courts'),
        ],
      ),
    );
  }
}

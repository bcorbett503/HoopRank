import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

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

  /// Static callback used by HomeScreen to force-refresh the embedded feed tab.
  static void Function()? refreshFeedTab;

  /// Static callback to force-refresh the Messages tab when switching to it.
  static void Function()? refreshMessagesTab;

  @override
  State<ScaffoldWithNavBar> createState() => _ScaffoldWithNavBarState();
}

class _ScaffoldWithNavBarState extends State<ScaffoldWithNavBar> {
  int _unreadCount = 0;
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
        ApiService.getPendingChallenges(),
      ]);
      if (mounted) {
        final myUserId = ApiService.userId ?? '';
        final challenges = results[1] as List;
        final incomingPendingCount = challenges.where((raw) {
          if (raw is! Map<String, dynamic>) return false;
          final status = (raw['status'] ?? '').toString().toLowerCase();
          if (status != 'pending') return false;

          final dynamic toUser = raw['toUser'];
          final toUserId = (raw['to_user_id'] ??
                  raw['toUserId'] ??
                  (toUser is Map ? toUser['id'] : null))
              ?.toString();
          return myUserId.isNotEmpty && toUserId == myUserId;
        }).length;

        setState(() {
          _unreadCount = results[0] as int;
          _challengeCount = incomingPendingCount;
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
    if (index == 1) {
      // Messages tab: refresh conversations so new threads appear immediately
      ScaffoldWithNavBar.refreshMessagesTab?.call();
    }

    if (index == 2) {
      // The Play branch owns the legacy feed route; keep the callback wired for
      // any feed widgets already mounted under this branch.
      ScaffoldWithNavBar.refreshFeedTab?.call();
    }

    // Reset each branch to its root when selected so tab switches never strand
    // the user inside a stale deep-link such as Scan Match or an old chat.
    widget.navigationShell.goBranch(
      index,
      initialLocation: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Play/home owns the first viewport and does not use the shared app bar.
    final isPlayScreen = widget.navigationShell.currentIndex == 2;

    return Scaffold(
      appBar: isPlayScreen ? null : const HoopRankAppBar(),
      body: widget.navigationShell,
      bottomNavigationBar: Builder(
        builder: (context) {
          final screenWidth = MediaQuery.of(context).size.width;
          // Scale: 10px on ~320pt phones, 13px on ~430pt+ phones
          final labelSize = (screenWidth / 33).clamp(10.0, 13.0);
          final iconSize = (screenWidth / 18).clamp(20.0, 24.0);
          return NavigationBarTheme(
            data: NavigationBarThemeData(
              height: 65,
              labelTextStyle: WidgetStateProperty.all(
                TextStyle(fontSize: labelSize, overflow: TextOverflow.ellipsis),
              ),
              iconTheme: WidgetStateProperty.all(
                IconThemeData(size: iconSize),
              ),
            ),
            child: NavigationBar(
              selectedIndex: widget.navigationShell.currentIndex,
              onDestinationSelected: (int index) => _onTap(context, index),
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              destinations: [
                const NavigationDestination(
                  icon: Icon(Icons.leaderboard),
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
                  label: 'Play',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.calendar_today),
                  label: 'Calendar',
                ),
                const NavigationDestination(
                    icon: Icon(Icons.place), label: 'Courts'),
              ],
            ),
          );
        },
      ),
    );
  }
}

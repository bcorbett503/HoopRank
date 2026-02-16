import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../widgets/court_map_widget.dart';
import '../widgets/player_profile_sheet.dart';
import '../widgets/rating_widgets.dart';
import '../services/messages_service.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
import '../state/tutorial_state.dart';
import 'package:url_launcher/url_launcher.dart';
import 'status_composer_screen.dart';

/// Static helper to show court details sheet from any screen
class CourtDetailsSheet {
  static void show(BuildContext context, Court court) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CourtDetailsSheet(court: court),
    ).whenComplete(() {
      if (!context.mounted) return;
      final tutorial = context.read<TutorialState>();
      // If the user closes the sheet early, make sure the tutorial can still
      // progress past the King + swipe-down steps.
      tutorial.completeStep('court_king');
      tutorial.completeStep('court_swipe_down');
    });
  }
}

/// Shared court details sheet UI (used from Map + Home, etc.)
class _CourtDetailsSheet extends StatelessWidget {
  final Court court;

  const _CourtDetailsSheet({required this.court});

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Larger (non-scrollable) drag handle zone so swipe-down is easy even when full-screen.
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Container(
                  key: TutorialKeys.getKey(TutorialKeys.courtDragHandle),
                  width: 76,
                  height: 6,
                  decoration: BoxDecoration(
                    color: Colors.grey[600],
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Court name with basketball icon and follow button
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.deepOrange.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.sports_basketball,
                              color: Colors.deepOrange,
                              size: 28,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  court.name,
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                if (court.address != null)
                                  Text(
                                    court.address!,
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey[400],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          // Follow + alert actions
                          Consumer<CheckInState>(
                            builder: (context, checkInState, _) {
                              final isFollowing =
                                  checkInState.isFollowing(court.id);
                              return Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  SizedBox(
                                    key: TutorialKeys.getKey(
                                        TutorialKeys.courtFollowButton),
                                    width: 48,
                                    height: 48,
                                    child: IconButton(
                                      onPressed: () async {
                                        final tutorial =
                                            context.read<TutorialState>();
                                        if (isFollowing) {
                                          await checkInState
                                              .unfollowCourt(court.id);
                                        } else {
                                          await checkInState
                                              .followCourt(court.id);
                                          tutorial.completeStep('court_follow');
                                          // Give the user a moment to see the followers list and
                                          // King designation, then advance to the swipe-down step.
                                          Future.delayed(
                                              const Duration(
                                                  milliseconds: 2600), () {
                                            tutorial.completeStep('court_king');
                                          });
                                        }
                                      },
                                      icon: Icon(
                                        isFollowing
                                            ? Icons.favorite
                                            : Icons.favorite_border,
                                        color: isFollowing
                                            ? Colors.red
                                            : Colors.grey[400],
                                        size: 28,
                                      ),
                                      tooltip:
                                          isFollowing ? 'Unfollow' : 'Follow',
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Follow prompt / "King" roster (followers)
                      Consumer<CheckInState>(
                        builder: (context, checkInState, _) {
                          final isFollowing =
                              checkInState.isFollowing(court.id);
                          return AnimatedSwitcher(
                            duration: const Duration(milliseconds: 240),
                            switchInCurve: Curves.easeOut,
                            switchOutCurve: Curves.easeIn,
                            transitionBuilder: (child, animation) {
                              // Some curves overshoot >1; clamp before applying any curve transforms.
                              return AnimatedBuilder(
                                animation: animation,
                                child: child,
                                builder: (context, child) {
                                  final t = animation.value.clamp(0.0, 1.0);
                                  final fadeT = Curves.easeInOut.transform(t);
                                  final scaleT =
                                      Curves.easeOutBack.transform(t);
                                  final scale = 0.97 + (1.0 - 0.97) * scaleT;
                                  return Opacity(
                                    opacity: fadeT,
                                    child: Transform.scale(
                                      scale: scale,
                                      alignment: Alignment.topCenter,
                                      child: child,
                                    ),
                                  );
                                },
                              );
                            },
                            child: isFollowing
                                ? _CourtFollowersCard(
                                    key: TutorialKeys.getKey(
                                        TutorialKeys.courtFollowersCard),
                                    courtId: court.id,
                                  )
                                : Padding(
                                    key: const ValueKey('follow_prompt'),
                                    padding: const EdgeInsets.only(
                                        right: 2, bottom: 2),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Text(
                                          'Follow court to see who else plays here',
                                          textAlign: TextAlign.right,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey[500],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                          );
                        },
                      ),

                      const SizedBox(height: 14),
                      // Schedule Run button - large green CTA (TOP PRIORITY)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => StatusComposerScreen(
                                  initialCourt: court,
                                  autoShowSchedule: true,
                                ),
                              ),
                            );
                          },
                          icon: const Icon(Icons.calendar_month, size: 24),
                          label: const Text(
                            'Schedule Run',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // ── Upcoming Runs at this Court ──
                      FutureBuilder<List<ScheduledRun>>(
                        future: ApiService.getCourtRuns(court.id),
                        builder: (context, snapshot) {
                          if (snapshot.connectionState ==
                              ConnectionState.waiting) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Center(
                                child: SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ),
                            );
                          }
                          final runs = snapshot.data ?? [];
                          if (runs.isEmpty) return const SizedBox.shrink();
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.directions_run,
                                      color: Colors.deepOrange, size: 18),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Upcoming Runs (${runs.length})',
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              ...runs.take(5).map((run) {
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.04),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                        color: Colors.white.withOpacity(0.08)),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Icon(Icons.access_time,
                                              size: 14,
                                              color: Colors.deepOrange),
                                          const SizedBox(width: 6),
                                          Text(
                                            run.timeString,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14,
                                              color: Colors.deepOrange,
                                            ),
                                          ),
                                          const Spacer(),
                                          Icon(Icons.people,
                                              size: 14,
                                              color: Colors.grey[500]),
                                          const SizedBox(width: 4),
                                          Text(
                                            '${run.attendeeCount}/${run.maxPlayers}',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: run.isFull
                                                  ? Colors.red
                                                  : Colors.grey[400],
                                              fontWeight: run.isAlmostFull
                                                  ? FontWeight.bold
                                                  : FontWeight.normal,
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (run.title != null) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          run.title!,
                                          style: TextStyle(
                                            color: Colors.grey[300],
                                            fontSize: 13,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                      const SizedBox(height: 8),
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 4,
                                        children: [
                                          _buildRunBadge(
                                            run.gameMode,
                                            Icons.sports_basketball,
                                            run.gameMode == '3v3'
                                                ? Colors.blue
                                                : Colors.purple,
                                          ),
                                          if (run.courtTypeLabel != null)
                                            _buildRunBadge(
                                              run.courtTypeLabel!,
                                              Icons.grid_view,
                                              Colors.teal,
                                            ),
                                          if (run.ageRange != null)
                                            _buildRunBadge(
                                              run.ageRange!,
                                              Icons.people_outline,
                                              Colors.amber,
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        'by ${run.creatorName}',
                                        style: TextStyle(
                                            color: Colors.grey[600],
                                            fontSize: 11),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                              const SizedBox(height: 8),
                            ],
                          );
                        },
                      ),

                      // ── Kings of the Court (compact) ──
                      if (court.hasKings)
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.amber.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: Colors.amber.withOpacity(0.2)),
                          ),
                          child: Row(
                            children: [
                              const Text('👑', style: TextStyle(fontSize: 16)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Wrap(
                                  spacing: 8,
                                  runSpacing: 4,
                                  children: [
                                    if (court.king1v1 != null)
                                      _buildCompactKingBadge(
                                        '1v1',
                                        court.king1v1!,
                                        Colors.deepOrange,
                                      ),
                                    if (court.king3v3 != null)
                                      _buildCompactKingBadge(
                                        '3v3',
                                        court.king3v3!,
                                        Colors.blue,
                                      ),
                                    if (court.king5v5 != null)
                                      _buildCompactKingBadge(
                                        '5v5',
                                        court.king5v5!,
                                        Colors.purple,
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Get Directions section
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                final appleUrl = Uri.parse(
                                  'https://maps.apple.com/?daddr=${court.lat},${court.lng}&dirflg=d',
                                );
                                try {
                                  final launched = await launchUrl(
                                    appleUrl,
                                    mode: LaunchMode.externalApplication,
                                  );
                                  if (!launched && context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content:
                                            Text('Could not open Apple Maps'),
                                      ),
                                    );
                                  }
                                } catch (e) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Error: $e')),
                                    );
                                  }
                                }
                              },
                              icon: const Icon(Icons.apple, size: 20),
                              label: const Text('Apple Maps'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.white,
                                side: BorderSide(color: Colors.grey[600]!),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                final googleUrl = Uri.parse(
                                  'https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lng}&travelmode=driving',
                                );
                                try {
                                  final launched = await launchUrl(
                                    googleUrl,
                                    mode: LaunchMode.externalApplication,
                                  );
                                  if (!launched && context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content:
                                            Text('Could not open Google Maps'),
                                      ),
                                    );
                                  }
                                } catch (e) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Error: $e')),
                                    );
                                  }
                                }
                              },
                              icon: const Icon(Icons.map, size: 20),
                              label: const Text('Google Maps'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.blue,
                                side: const BorderSide(color: Colors.blue),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            final router = GoRouter.of(context);
                            Navigator.pop(context);
                            router.go('/courts?courtId=${court.id}');
                          },
                          icon: const Icon(Icons.location_on_outlined),
                          label: const Text('View on Map'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: BorderSide(color: Colors.grey[600]!),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRunBadge(String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompactKingBadge(String mode, String name, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        '$mode: $name',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class MapScreen extends StatefulWidget {
  final String? initialCourtId;
  final double? initialLat;
  final double? initialLng;
  final String? initialCourtName;

  const MapScreen({
    super.key,
    this.initialCourtId,
    this.initialLat,
    this.initialLng,
    this.initialCourtName,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  @override
  void initState() {
    super.initState();
    // If the user reaches Courts via any path (CTA button, bottom nav, etc.)
    // while the tutorial is on the "Find Courts" step, advance automatically
    // so the tutorial can't get stuck on a missing CTA state.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<TutorialState>().completeStep('feed_find_courts');
    });
  }

  void _showCourtDetails(Court court) {
    CourtDetailsSheet.show(context, court);
  }

  void _showCheckedInPlayersSheet(Court court) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Consumer<CheckInState>(
        builder: (context, checkInState, _) {
          final players = checkInState.getCheckedInPlayers(court.id);

          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.7,
            ),
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle bar
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.grey[600],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Header
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      const Icon(Icons.people, color: Colors.green, size: 24),
                      const SizedBox(width: 10),
                      Text(
                        'Players at ${court.name}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Text(
                    '${players.length} player${players.length == 1 ? '' : 's'} checked in • Sorted by rating',
                    style: TextStyle(color: Colors.grey[400], fontSize: 13),
                  ),
                ),
                const Divider(),
                // Player list
                Flexible(
                  child: players.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(40),
                            child: Text(
                              'No players have checked in yet.',
                              style: TextStyle(color: Colors.grey[500]),
                            ),
                          ),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          itemCount: players.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final player = players[index];
                            final isTopPlayer = index == 0;

                            return Container(
                              decoration: BoxDecoration(
                                color: isTopPlayer
                                    ? Colors.green.withOpacity(0.05)
                                    : Colors.grey[900],
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                    color: isTopPlayer
                                        ? Colors.green.withOpacity(0.3)
                                        : Colors.white.withOpacity(0.05)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.2),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () {
                                    Navigator.pop(context);
                                    PlayerProfileSheet.showById(
                                        context, player.id);
                                  },
                                  borderRadius: BorderRadius.circular(16),
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Row(
                                      children: [
                                        // Rank badge
                                        Container(
                                          width: 32,
                                          height: 32,
                                          decoration: BoxDecoration(
                                            color: isTopPlayer
                                                ? Colors.green.withOpacity(0.2)
                                                : Colors.white
                                                    .withOpacity(0.05),
                                            shape: BoxShape.circle,
                                            border: isTopPlayer
                                                ? Border.all(
                                                    color: Colors.green
                                                        .withOpacity(0.5))
                                                : null,
                                          ),
                                          child: Center(
                                            child: Text(
                                              '${index + 1}',
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12,
                                                color: isTopPlayer
                                                    ? Colors.green
                                                    : Colors.white54,
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        // Avatar
                                        CircleAvatar(
                                          radius: 22,
                                          backgroundImage: player.photoUrl !=
                                                  null
                                              ? NetworkImage(player.photoUrl!)
                                              : null,
                                          backgroundColor:
                                              Colors.blue.withOpacity(0.2),
                                          child: player.photoUrl == null
                                              ? Text(
                                                  player.name.isNotEmpty
                                                      ? player.name[0]
                                                          .toUpperCase()
                                                      : '?',
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 16,
                                                    color: Colors.blue,
                                                  ),
                                                )
                                              : null,
                                        ),
                                        const SizedBox(width: 12),
                                        // Name and check-in time
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                player.name,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 16,
                                                  color: Colors.white,
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                'Checked in ${player.checkedInAgo}',
                                                style: const TextStyle(
                                                  color: Colors.white30,
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        // Rating
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 6,
                                          ),
                                          decoration: BoxDecoration(
                                            color:
                                                Colors.amber.withOpacity(0.1),
                                            borderRadius:
                                                BorderRadius.circular(8),
                                            border: Border.all(
                                                color: Colors.amber
                                                    .withOpacity(0.2)),
                                          ),
                                          child: Text(
                                            player.rating.toStringAsFixed(1),
                                            style: const TextStyle(
                                              color: Colors.amber,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        const Icon(
                                          Icons.chevron_right,
                                          color: Colors.white30,
                                          size: 20,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showChallengeKingSheet(Court court) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Text(
              '👑 Challenge a King',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Choose which King you want to challenge at ${court.name}',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            const SizedBox(height: 16),
            if (court.king1v1 != null)
              _buildChallengeOption(
                mode: '1v1',
                kingName: court.king1v1!,
                kingId: court.king1v1Id,
                rating: court.king1v1Rating,
                color: Colors.deepOrange,
                onChallenge: () {
                  Navigator.pop(context);
                  _showChallengeMessageDialog(
                      court.king1v1!, court.king1v1Id, '1v1', court);
                },
              ),
            if (court.king3v3 != null) ...[
              const SizedBox(height: 10),
              _buildChallengeOption(
                mode: '3v3',
                kingName: court.king3v3!,
                kingId: court.king3v3Id,
                rating: court.king3v3Rating,
                color: Colors.blue,
                onChallenge: () {
                  Navigator.pop(context);
                  _showChallengeMessageDialog(
                      court.king3v3!, court.king3v3Id, '3v3', court);
                },
              ),
            ],
            if (court.king5v5 != null) ...[
              const SizedBox(height: 10),
              _buildChallengeOption(
                mode: '5v5',
                kingName: court.king5v5!,
                kingId: court.king5v5Id,
                rating: court.king5v5Rating,
                color: Colors.purple,
                onChallenge: () {
                  Navigator.pop(context);
                  _showChallengeMessageDialog(
                      court.king5v5!, court.king5v5Id, '5v5', court);
                },
              ),
            ],
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildChallengeOption({
    required String mode,
    required String kingName,
    required String? kingId,
    required double? rating,
    required Color color,
    required VoidCallback onChallenge,
  }) {
    return Material(
      color: color.withOpacity(0.15),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                mode,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13),
              ),
            ),
            const SizedBox(width: 14),
            const Text('👑', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    kingName,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  if (rating != null)
                    Text(
                      '⭐ ${rating.toStringAsFixed(2)}',
                      style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                    ),
                ],
              ),
            ),
            // View Profile button
            if (kingId != null)
              IconButton(
                onPressed: () {
                  Navigator.pop(context);
                  PlayerProfileSheet.showById(context, kingId);
                },
                icon: Icon(Icons.person, color: Colors.grey[400], size: 24),
                tooltip: 'View Profile',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            const SizedBox(width: 8),
            // Challenge button
            IconButton(
              onPressed: onChallenge,
              icon: Icon(Icons.sports_basketball, color: color, size: 28),
              tooltip: 'Challenge',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
      ),
    );
  }

  void _showChallengeMessageDialog(
      String kingName, String? kingId, String mode, Court court) {
    final messageController = TextEditingController(
      text: 'I want to challenge you for the $mode crown at ${court.name}!',
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Text('👑 ', style: TextStyle(fontSize: 24)),
            Expanded(
              child: Text(
                'Challenge $kingName',
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Send a message with your $mode challenge:',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: messageController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Add a message to your challenge...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                filled: true,
                fillColor: Colors.grey[900],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _initiateKingChallenge(
                kingName,
                kingId,
                mode,
                court,
                customMessage: messageController.text,
              );
            },
            icon: const Icon(Icons.sports_basketball, size: 18),
            label: const Text('Send Challenge'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _initiateKingChallenge(
      String kingName, String? kingId, String mode, Court court,
      {String? customMessage}) async {
    if (kingId == null) {
      // No user ID - show a message that this King can't be challenged yet
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$kingName at ${court.name} cannot be challenged yet'),
          duration: const Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Get current user ID
    final userId =
        Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please log in to send challenges')),
      );
      return;
    }

    // Don't allow user to challenge themselves
    if (userId == kingId) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You are the King! Find a challenger.')),
      );
      return;
    }

    // Send the real challenge
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Sending $mode challenge to $kingName...'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );

    try {
      final messagesService = MessagesService();
      final message = customMessage ??
          'I want to challenge you for the $mode crown at ${court.name}!';
      await messagesService.sendChallenge(
        userId,
        kingId,
        message,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Challenge sent to $kingName! 🏀'),
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to send challenge: $e'),
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Widget _buildKingCard(
      String mode, String name, String? kingId, double? rating, Color color) {
    return InkWell(
      onTap: () {
        if (kingId != null) {
          _showKingActionSheet(name, kingId, mode);
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [color.withOpacity(0.3), color.withOpacity(0.1)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.5)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                mode,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 6),
            const Text('👑', style: TextStyle(fontSize: 20)),
            const SizedBox(height: 4),
            Text(
              name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (rating != null) ...[
              const SizedBox(height: 2),
              Text(
                '⭐ ${rating.toStringAsFixed(2)}',
                style: TextStyle(fontSize: 11, color: Colors.grey[400]),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showKingActionSheet(String name, String kingId, String mode) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.grey[600],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text(
              '👑 $name',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              '$mode King',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  PlayerProfileSheet.showById(context, kingId);
                },
                icon: const Icon(Icons.person),
                label: const Text('View Profile'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[700],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  // Navigate to challenge the king
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Challenge $name to a $mode match!'),
                      action: SnackBarAction(
                        label: 'Send Challenge',
                        onPressed: () {
                          // Send the challenge
                        },
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.sports_basketball),
                label: const Text('Challenge'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Use widget's initialCourtId if provided, otherwise fall back to query params
    final courtId = widget.initialCourtId ??
        GoRouterState.of(context).uri.queryParameters['courtId'];

    return Scaffold(
      body: CourtMapWidget(
        onCourtSelected: _showCourtDetails,
        initialCourtId: courtId,
        initialLat: widget.initialLat,
        initialLng: widget.initialLng,
        initialCourtName: widget.initialCourtName,
      ),
    );
  }
}

class _CourtFollowersCard extends StatefulWidget {
  final String courtId;

  const _CourtFollowersCard({
    super.key,
    required this.courtId,
  });

  @override
  State<_CourtFollowersCard> createState() => _CourtFollowersCardState();
}

class _CourtFollowersCardState extends State<_CourtFollowersCard> {
  static const int _visibleRows = 3;
  static const double _rowHeight = 72;

  late Future<List<CourtFollower>> _future;
  bool _didAutoRetry = false;

  @override
  void initState() {
    super.initState();
    _future = ApiService.getCourtFollowers(widget.courtId);
  }

  @override
  void didUpdateWidget(covariant _CourtFollowersCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.courtId != widget.courtId) {
      _future = ApiService.getCourtFollowers(widget.courtId);
      _didAutoRetry = false;
    }
  }

  void _refresh() {
    setState(() {
      _future = ApiService.getCourtFollowers(widget.courtId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CourtFollower>>(
      future: _future,
      builder: (context, snapshot) {
        final isLoading = snapshot.connectionState == ConnectionState.waiting;
        final error = snapshot.hasError ? snapshot.error?.toString() : null;

        final followers = List<CourtFollower>.from(snapshot.data ?? const []);
        followers.sort(_compareFollowers);

        // If the user just followed, the follow write may race the first fetch.
        // Best-effort: auto-retry once after a short delay when we get an empty list.
        if (!isLoading &&
            error == null &&
            followers.isEmpty &&
            !_didAutoRetry) {
          _didAutoRetry = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            Future.delayed(const Duration(milliseconds: 600), () {
              if (!mounted) return;
              _refresh();
            });
          });
        }

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.amber.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.amber.withOpacity(0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('👑', style: TextStyle(fontSize: 16)),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Who else plays here',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (isLoading)
                    SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white54,
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.deepOrange.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                            color: Colors.deepOrange.withOpacity(0.4)),
                      ),
                      child: Text(
                        '${followers.length}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              if (error != null && !isLoading)
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Could not load followers.',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey[400]),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            (error ?? '').replaceFirst('Exception: ', ''),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 11, color: Colors.grey[600]),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: _refresh,
                      child: const Text('Retry'),
                    ),
                  ],
                )
              else if (!isLoading && followers.isEmpty)
                Text(
                  'No one has followed this court yet. You can be the first King.',
                  style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                )
              else
                SizedBox(
                  height: () {
                    if (isLoading && followers.isEmpty) {
                      return (_rowHeight * _visibleRows) +
                          (8 * (_visibleRows - 1));
                    }
                    final visibleCount = followers.length < _visibleRows
                        ? followers.length
                        : _visibleRows;
                    final safeVisibleCount =
                        visibleCount < 1 ? 1 : visibleCount;
                    return (_rowHeight * safeVisibleCount) +
                        (8 * (safeVisibleCount - 1));
                  }(),
                  child: isLoading && followers.isEmpty
                      ? Center(
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white54,
                            ),
                          ),
                        )
                      : Scrollbar(
                          thumbVisibility: followers.length > _visibleRows,
                          child: ListView.separated(
                            padding: EdgeInsets.zero,
                            itemCount: followers.length,
                            physics: const BouncingScrollPhysics(),
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) => SizedBox(
                              height: _rowHeight,
                              child: _CourtFollowerRow(
                                follower: followers[index],
                                isKing: index == 0,
                              ),
                            ),
                          ),
                        ),
                ),
            ],
          ),
        );
      },
    );
  }

  int _compareFollowers(CourtFollower a, CourtFollower b) {
    final ar = a.rank;
    final br = b.rank;

    if (ar != null && br != null) return ar.compareTo(br);
    if (ar != null) return -1;
    if (br != null) return 1;

    final ratingCmp = b.rating.compareTo(a.rating);
    if (ratingCmp != 0) return ratingCmp;

    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  }
}

class _CourtFollowerRow extends StatelessWidget {
  final CourtFollower follower;
  final bool isKing;

  const _CourtFollowerRow({
    required this.follower,
    required this.isKing,
  });

  ImageProvider? _photoProvider(String? photoUrl) {
    if (photoUrl == null || photoUrl.isEmpty) return null;
    try {
      if (photoUrl.startsWith('data:image')) {
        final data = Uri.parse(photoUrl).data;
        if (data != null) return MemoryImage(data.contentAsBytes());
      }
    } catch (_) {
      // Fall back to network below.
    }
    return NetworkImage(photoUrl);
  }

  @override
  Widget build(BuildContext context) {
    final rankText = follower.rank != null ? '#${follower.rank}' : '—';
    final imageProvider = _photoProvider(follower.photoUrl);
    final ratingLabel = getRankLabel(follower.rating);

    return Container(
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isKing
              ? Colors.amber.withOpacity(0.35)
              : Colors.white.withOpacity(0.05),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: follower.id.isEmpty
              ? null
              : () => PlayerProfileSheet.showById(context, follower.id),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundImage: imageProvider,
                  backgroundColor: Colors.blue.withOpacity(0.2),
                  child: imageProvider == null
                      ? Text(
                          follower.name.isNotEmpty
                              ? follower.name[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                            color: Colors.blue,
                            fontWeight: FontWeight.bold,
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              follower.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          if (isKing) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.amber.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                    color: Colors.amber.withOpacity(0.35)),
                              ),
                              child: const Text(
                                'King',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.amber,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'HoopRank $rankText',
                        style: const TextStyle(
                            fontSize: 11, color: Colors.white30),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        follower.rating.toStringAsFixed(1),
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          color: Colors.amber,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      ratingLabel,
                      style:
                          const TextStyle(fontSize: 10, color: Colors.white30),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

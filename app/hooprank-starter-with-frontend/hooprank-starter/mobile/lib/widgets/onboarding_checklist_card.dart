import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../state/onboarding_checklist_state.dart';

/// Metadata for a single checklist row.
class _ChecklistItemConfig {
  final String key;
  final IconData icon;
  final String label;
  final Color color;
  final String route;

  const _ChecklistItemConfig({
    required this.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.route,
  });
}

const _items = [
  _ChecklistItemConfig(
    key: OnboardingItems.setupProfile,
    icon: Icons.person,
    label: 'Complete your profile',
    color: Colors.purple,
    route: '/profile/setup',
  ),
  _ChecklistItemConfig(
    key: OnboardingItems.followCourt,
    icon: Icons.location_on,
    label: 'Follow a court',
    color: Colors.blue,
    route: '/courts',
  ),
  _ChecklistItemConfig(
    key: OnboardingItems.followPlayer,
    icon: Icons.person_add,
    label: 'Follow a player',
    color: Colors.green,
    route: '/rankings?region=local',
  ),
  _ChecklistItemConfig(
    key: OnboardingItems.scheduleRun,
    icon: Icons.schedule,
    label: 'Schedule a run at a court',
    color: Colors.deepOrange,
    route: '/courts', // pick a court to schedule
  ),
  _ChecklistItemConfig(
    key: OnboardingItems.joinRun,
    icon: Icons.directions_run,
    label: 'Join a scheduled run',
    color: Colors.teal,
    route: '/courts', // Find Runs
  ),
  _ChecklistItemConfig(
    key: OnboardingItems.joinOrCreateTeam,
    icon: Icons.groups,
    label: 'Create or join a team',
    color: Colors.orange,
    route: '/teams',
  ),
  _ChecklistItemConfig(
    key: OnboardingItems.challengePlayer,
    icon: Icons.sports_basketball,
    label: 'Challenge a player',
    color: Colors.red,
    route: '/rankings?region=local',
  ),
];

/// Compact onboarding checklist card shown between the status composer and the
/// feed on the home screen. Automatically hides when all items are complete.
class OnboardingChecklistCard extends StatefulWidget {
  const OnboardingChecklistCard({super.key});

  @override
  State<OnboardingChecklistCard> createState() =>
      _OnboardingChecklistCardState();
}

class _OnboardingChecklistCardState extends State<OnboardingChecklistCard>
    with SingleTickerProviderStateMixin {
  bool _collapsed = false;
  late AnimationController _celebrationController;
  late Animation<double> _celebrationAnimation;
  bool _showCelebration = false;

  @override
  void initState() {
    super.initState();
    _celebrationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _celebrationAnimation = CurvedAnimation(
      parent: _celebrationController,
      curve: Curves.elasticOut,
    );
  }

  @override
  void dispose() {
    _celebrationController.dispose();
    super.dispose();
  }

  void _handleAllComplete(OnboardingChecklistState state) {
    setState(() => _showCelebration = true);
    _celebrationController.forward();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<OnboardingChecklistState>();

    if (!state.shouldShow) {
      // Show celebration briefly before hiding
      if (_showCelebration) {
        return ScaleTransition(
          scale: _celebrationAnimation,
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: const Color(0xFF2C3E50),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.green.withOpacity(0.5)),
            ),
            child: const Center(
              child: Text(
                '🎉 You\'re all set!',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        );
      }
      return const SizedBox.shrink();
    }

    final completed = state.completedCount;
    final total = state.totalCount;
    final progress = total > 0 ? completed / total : 0.0;

    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF2C3E50),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Colors.deepOrange.withOpacity(0.3),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Header ──
            InkWell(
              onTap: () => setState(() => _collapsed = !_collapsed),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(12),
                bottom: Radius.circular(12),
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    // Progress ring
                    SizedBox(
                      width: 28,
                      height: 28,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          CircularProgressIndicator(
                            value: progress,
                            strokeWidth: 3,
                            backgroundColor: Colors.white12,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              completed == total
                                  ? Colors.green
                                  : Colors.deepOrange,
                            ),
                          ),
                          Text(
                            '$completed',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        state.allComplete
                            ? '🎉 All done!'
                            : _collapsed
                                ? '$completed of $total complete'
                                : 'Get Started',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    // X dismiss button
                    GestureDetector(
                      onTap: () => state.dismiss(),
                      child: const Padding(
                        padding: EdgeInsets.all(4),
                        child:
                            Icon(Icons.close, color: Colors.white54, size: 18),
                      ),
                    ),
                    const SizedBox(width: 4),
                    // Collapse chevron
                    AnimatedRotation(
                      turns: _collapsed ? -0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(Icons.expand_more,
                          color: Colors.white54, size: 20),
                    ),
                  ],
                ),
              ),
            ),

            // ── Checklist items ──
            if (!_collapsed)
              Padding(
                padding: const EdgeInsets.only(left: 8, right: 8, bottom: 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: _items.map((item) {
                    final done = state.isComplete(item.key);
                    return _buildRow(context, item, done, state);
                  }).toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(BuildContext context, _ChecklistItemConfig item, bool done,
      OnboardingChecklistState state) {
    return InkWell(
      onTap: done
          ? null
          : () {
              context.go(item.route);
            },
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          children: [
            // Check circle
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done ? Colors.green : Colors.transparent,
                border: Border.all(
                  color: done ? Colors.green : Colors.white24,
                  width: 2,
                ),
              ),
              child: done
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 10),
            // Icon
            Icon(
              item.icon,
              size: 16,
              color: done ? Colors.white38 : item.color,
            ),
            const SizedBox(width: 8),
            // Label
            Expanded(
              child: Text(
                item.label,
                style: TextStyle(
                  color: done ? Colors.white38 : Colors.white,
                  fontSize: 13,
                  fontWeight: done ? FontWeight.normal : FontWeight.w500,
                  decoration: done ? TextDecoration.lineThrough : null,
                  decorationColor: Colors.white38,
                ),
              ),
            ),
            // Arrow for incomplete items
            if (!done)
              const Icon(Icons.chevron_right, size: 16, color: Colors.white24),
          ],
        ),
      ),
    );
  }
}

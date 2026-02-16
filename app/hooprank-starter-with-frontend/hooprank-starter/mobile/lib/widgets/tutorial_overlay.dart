import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../state/tutorial_state.dart';

/// Full-screen overlay that displays tutorial spotlight and tooltips
class TutorialOverlay extends StatefulWidget {
  final Widget child;

  const TutorialOverlay({super.key, required this.child});

  @override
  State<TutorialOverlay> createState() => _TutorialOverlayState();
}

class _TutorialOverlayState extends State<TutorialOverlay>
    with SingleTickerProviderStateMixin {
  // Root stack key so we can convert target widget positions into the overlay's
  // local coordinate space (works reliably across popup menus/bottom sheets).
  final GlobalKey _overlayStackKey = GlobalKey(debugLabel: 'tutorial_overlay');

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  Rect? _cachedTargetRect;
  int _settleChecksRemaining = 0;
  bool _rebuildScheduled = false;
  String? _lastStepId;

  Rect? _getTargetRect(GlobalKey targetKey) {
    final targetContext = targetKey.currentContext;
    if (targetContext == null) return null;

    final targetRenderObject = targetContext.findRenderObject();
    if (targetRenderObject is! RenderBox) return null;
    final targetBox = targetRenderObject;
    if (!targetBox.hasSize) return null;

    // Prefer overlay-local coordinates so Positioned() math matches what the user sees.
    final overlayRenderObject =
        _overlayStackKey.currentContext?.findRenderObject();
    if (overlayRenderObject is RenderBox && overlayRenderObject.hasSize) {
      try {
        final offset =
            targetBox.localToGlobal(Offset.zero, ancestor: overlayRenderObject);
        return offset & targetBox.size;
      } catch (_) {
        // If the overlay isn't actually an ancestor (rare), fall back to global.
      }
    }

    final offset = targetBox.localToGlobal(Offset.zero);
    return offset & targetBox.size;
  }

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.7, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<TutorialState>(
      builder: (context, tutorial, _) {
        if (tutorial.isActive && tutorial.currentStep != null) {
          // Try to find target, schedule retry if not found
          final stepId = tutorial.currentStep!.id;
          if (_lastStepId != stepId) {
            _lastStepId = stepId;
            _cachedTargetRect = null;
            // Targets often animate into place (bottom sheets, popup menus). Do a few
            // short re-checks so the spotlight tracks the final layout.
            _settleChecksRemaining = 10;
            _rebuildScheduled = false;
          }

          final targetKey =
              TutorialKeys.tryGetKey(tutorial.currentStep!.targetKeyName);
          Rect? targetRect;

          if (targetKey != null) {
            targetRect = _getTargetRect(targetKey);
          }

          if (targetRect != null) {
            final cached = _cachedTargetRect;
            final positionMoved = cached == null ||
                (targetRect.topLeft - cached.topLeft).distance > 1.0;
            final sizeMoved = cached == null ||
                (targetRect.size.width - cached.size.width).abs() > 1.0 ||
                (targetRect.size.height - cached.size.height).abs() > 1.0;

            if (positionMoved || sizeMoved) {
              _cachedTargetRect = targetRect;
              // If the target is still moving (e.g., animation), keep settling briefly.
              if (_settleChecksRemaining == 0) _settleChecksRemaining = 2;
            }
          }

          // If target not found, schedule a rebuild to try again
          final needsRetry = targetRect == null;
          final needsSettle = targetRect != null && _settleChecksRemaining > 0;

          if ((needsRetry || needsSettle) && !_rebuildScheduled) {
            _rebuildScheduled = true;
            if (needsSettle) _settleChecksRemaining--;
            Future.delayed(
              needsRetry
                  ? const Duration(milliseconds: 260)
                  : const Duration(milliseconds: 120),
              () {
                if (!mounted) return;
                _rebuildScheduled = false;
                setState(() {});
              },
            );
          }
        }

        return Stack(
          key: _overlayStackKey,
          clipBehavior: Clip.none,
          children: [
            widget.child,
            if (tutorial.isActive && tutorial.currentStep != null)
              _buildOverlay(context, tutorial),
          ],
        );
      },
    );
  }

  void _handleNavigation(BuildContext context, TutorialState tutorial) {
    if (!tutorial.isActive || tutorial.currentStep == null) return;

    // Safely try to get router state - may fail if context doesn't have modal route yet
    try {
      final router = GoRouter.of(context);
      final currentLocation =
          router.routerDelegate.currentConfiguration.uri.toString();
      final targetRoute = tutorial.currentStep!.route;

      // Navigate if we're not on the correct route
      if (!currentLocation.startsWith(targetRoute)) {
        context.go(targetRoute);
      }
    } catch (e) {
      // Context doesn't have router yet, ignore and let the overlay just display
      debugPrint('Tutorial nav: waiting for router context');
    }
  }

  Widget _buildOverlay(BuildContext context, TutorialState tutorial) {
    final step = tutorial.currentStep!;
    final targetKey = TutorialKeys.tryGetKey(step.targetKeyName);

    // Get target widget bounds
    Rect? targetRect;
    if (targetKey != null) {
      targetRect = _getTargetRect(targetKey);
      // Don't modify targetRect here - allow exact match for highlighting.
      // We will expand it for the mask cutout.
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Dark overlay with spotlight cutout
        // Wrapped in IgnorePointer so it doesn't block touches anywhere
        if (targetRect != null)
          _buildSpotlightMask(targetRect, step.color)
        else
          // Fallback: just show message at bottom if target not found
          IgnorePointer(
            child: Container(
              color: Colors.black45,
            ),
          ),

        // Pulsing highlight border around target
        if (targetRect != null) _buildHighlightBorder(targetRect, step.color),

        // Tooltip card (Needs Material for text/theme)
        _buildTooltip(context, tutorial, step, targetRect),

        // Skip button at top (Needs Material for button)
        _buildSkipButton(context, tutorial),

        // Progress indicator
        _buildProgressIndicator(tutorial),
      ],
    );
  }

  Widget _buildSpotlightMask(Rect targetRect, Color color) {
    // Expand target rect slightly for padding in the cutout
    final expandedRect = targetRect.inflate(8);

    return IgnorePointer(
      child: CustomPaint(
        size: Size.infinite,
        painter: _SpotlightPainter(
          spotlightRect: expandedRect,
          // Reduced opacity slightly to be less dark (was 0.75)
          overlayColor: Colors.black.withOpacity(0.45),
          borderColor: color,
        ),
      ),
    );
  }

  Widget _buildHighlightBorder(Rect targetRect, Color color) {
    final expandedRect = targetRect.inflate(8);

    return Positioned(
      left: expandedRect.left,
      top: expandedRect.top,
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: _pulseAnimation,
          builder: (context, _) {
            return Container(
              key: const ValueKey('tutorial_highlight_border'),
              width: expandedRect.width,
              height: expandedRect.height,
              decoration: BoxDecoration(
                border: Border.all(
                  color: color.withOpacity(_pulseAnimation.value),
                  width: 3,
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: color.withOpacity(0.4 * _pulseAnimation.value),
                    blurRadius: 20,
                    spreadRadius: 4,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildTooltip(BuildContext context, TutorialState tutorial,
      TutorialStep step, Rect? targetRect) {
    final media = MediaQuery.of(context);
    final screenHeight = media.size.height;
    const tooltipEstimatedHeight = 210.0;
    const verticalGap = 16.0;

    // Keep tutorial content away from the bottom nav + progress dots.
    // (NavigationBar is ~80px, plus a bit of breathing room.)
    final safeTop = media.padding.top + 12;
    final safeBottom = screenHeight - media.padding.bottom - 120;
    final maxTop = (safeBottom - tooltipEstimatedHeight) < safeTop
        ? safeTop
        : (safeBottom - tooltipEstimatedHeight);

    double top = screenHeight * 0.30; // Fallback when target is unknown.
    bool targetIsAboveTooltip = false;

    if (targetRect != null) {
      final spaceAbove = targetRect.top - safeTop;
      final spaceBelow = safeBottom - targetRect.bottom;
      final canPlaceBelow =
          spaceBelow >= (tooltipEstimatedHeight + verticalGap);
      final canPlaceAbove =
          spaceAbove >= (tooltipEstimatedHeight + verticalGap);

      // Prefer placing the tooltip in the larger available space.
      final preferBelow = spaceBelow >= spaceAbove;
      if (canPlaceBelow && (preferBelow || !canPlaceAbove)) {
        top = targetRect.bottom + verticalGap; // Tooltip below target.
      } else {
        top = targetRect.top -
            tooltipEstimatedHeight -
            verticalGap; // Above target.
      }

      top = top.clamp(safeTop, maxTop);
      targetIsAboveTooltip = targetRect.center.dy < top;
    } else {
      top = top.clamp(safeTop, maxTop);
    }

    return Positioned(
      left: 24,
      right: 24,
      top: top,
      child: Material(
        type: MaterialType.transparency,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // If the target is above this tooltip, arrow points UP and goes FIRST.
            if (targetIsAboveTooltip) ...[
              Icon(
                Icons.keyboard_arrow_up,
                color: step.color,
                size: 40,
              ),
              const SizedBox(height: 8),
            ],

            // Main instruction card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF2C3E50),
                borderRadius: BorderRadius.circular(16),
                border:
                    Border.all(color: step.color.withOpacity(0.5), width: 2),
                boxShadow: [
                  BoxShadow(
                    color: step.color.withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Icon and title
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: step.color.withOpacity(0.2),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(step.icon, color: step.color, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          step.title,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: step.color,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Description
                  Text(
                    step.description,
                    style: const TextStyle(
                      fontSize: 15,
                      color: Colors.white70,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Tap hint with dynamic arrow
                  // Tap hint or Finish button
                  if (step.showContinueButton)
                    ElevatedButton(
                      onPressed: () => tutorial.completeTutorial(),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: step.color,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 32, vertical: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20)),
                      ),
                      child: const Text('Finish',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          )),
                    )
                  else
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (targetIsAboveTooltip)
                          Icon(Icons.arrow_upward, color: step.color, size: 20)
                        else
                          Icon(Icons.arrow_downward,
                              color: step.color, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            targetIsAboveTooltip
                                ? 'Do the highlighted action above to continue'
                                : 'Do the highlighted action below to continue',
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: step.color,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (targetIsAboveTooltip)
                          Icon(Icons.arrow_upward, color: step.color, size: 20)
                        else
                          Icon(Icons.arrow_downward,
                              color: step.color, size: 20),
                      ],
                    ),
                ],
              ),
            ),

            // If the target is below this tooltip (default), arrow points DOWN and goes LAST.
            if (!targetIsAboveTooltip) ...[
              const SizedBox(height: 8),
              Icon(
                Icons.keyboard_arrow_down,
                color: step.color,
                size: 40,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSkipButton(BuildContext context, TutorialState tutorial) {
    return Positioned(
      // Keep the skip button out of the app bar action area.
      top: MediaQuery.of(context).padding.top + kToolbarHeight + 8,
      right: 16,
      child: Material(
        type: MaterialType.transparency,
        child: TextButton.icon(
          onPressed: () async {
            await tutorial.skipTutorial();
            // Use try-catch for navigation - context may not have router access
            try {
              final router = GoRouter.of(context);
              router.go('/play');
            } catch (e) {
              // Fallback - try context extension
              if (context.mounted) {
                context.go('/play');
              }
            }
          },
          icon: const Icon(Icons.skip_next, size: 18),
          label: const Text('Skip Tutorial'),
          style: TextButton.styleFrom(
            foregroundColor: Colors.white70,
            backgroundColor: Colors.black38,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          ),
        ),
      ),
    );
  }

  Widget _buildProgressIndicator(TutorialState tutorial) {
    return Positioned(
      bottom: 40,
      left: 0,
      right: 0,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(tutorial.totalSteps, (index) {
          final isActive = index == tutorial.currentStepIndex;
          final isCompleted = index < tutorial.currentStepIndex;

          return AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            margin: const EdgeInsets.symmetric(horizontal: 4),
            width: isActive ? 24 : 10,
            height: 10,
            decoration: BoxDecoration(
              color: isCompleted
                  ? Colors.green
                  : (isActive
                      ? tutorial.currentStep?.color ?? Colors.deepOrange
                      : Colors.grey[600]),
              borderRadius: BorderRadius.circular(5),
            ),
          );
        }),
      ),
    );
  }
}

/// Custom painter for the spotlight mask effect
class _SpotlightPainter extends CustomPainter {
  final Rect spotlightRect;
  final Color overlayColor;
  final Color borderColor;

  _SpotlightPainter({
    required this.spotlightRect,
    required this.overlayColor,
    required this.borderColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = overlayColor;

    // Create path for overlay with spotlight cutout
    final overlayPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));

    // Create rounded rect for spotlight
    final spotlightPath = Path()
      ..addRRect(
          RRect.fromRectAndRadius(spotlightRect, const Radius.circular(12)));

    // Combine paths to create cutout effect
    final combinedPath = Path.combine(
      PathOperation.difference,
      overlayPath,
      spotlightPath,
    );

    canvas.drawPath(combinedPath, paint);
  }

  @override
  bool shouldRepaint(covariant _SpotlightPainter oldDelegate) {
    return oldDelegate.spotlightRect != spotlightRect;
  }
}

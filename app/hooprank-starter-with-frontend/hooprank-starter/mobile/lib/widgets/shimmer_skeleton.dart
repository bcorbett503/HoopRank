import 'package:flutter/material.dart';

/// Zero-dependency shimmer effect using Flutter's built-in animation system.
/// Paints a sliding gradient highlight across child content to simulate loading.
class ShimmerEffect extends StatefulWidget {
  final Widget child;

  const ShimmerEffect({super.key, required this.child});

  @override
  State<ShimmerEffect> createState() => _ShimmerEffectState();
}

class _ShimmerEffectState extends State<ShimmerEffect>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                Colors.white.withValues(alpha: 0.04),
                Colors.white.withValues(alpha: 0.12),
                Colors.white.withValues(alpha: 0.04),
              ],
              stops: [
                (_controller.value - 0.3).clamp(0.0, 1.0),
                _controller.value,
                (_controller.value + 0.3).clamp(0.0, 1.0),
              ],
            ).createShader(bounds);
          },
          child: child!,
        );
      },
      child: widget.child,
    );
  }
}

// ---------------------------------------------------------------------------
//  Skeleton building blocks
// ---------------------------------------------------------------------------

/// A single rounded rectangle placeholder bar
class _SkeletonBar extends StatelessWidget {
  final double width;
  final double height;
  final double radius;

  const _SkeletonBar({
    required this.width,
    this.height = 12,
    this.radius = 6,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// A circular placeholder (for avatars / rank badges)
class _SkeletonCircle extends StatelessWidget {
  final double size;

  const _SkeletonCircle({this.size = 40});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        shape: BoxShape.circle,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
//  Content-specific skeleton loaders
// ---------------------------------------------------------------------------

/// Skeleton that mimics 3 social feed post cards
class FeedSkeletonLoader extends StatelessWidget {
  const FeedSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: 3,
        itemBuilder: (context, i) => _buildFeedCardSkeleton(i),
      ),
    );
  }

  Widget _buildFeedCardSkeleton(int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar row
          Row(
            children: [
              const _SkeletonCircle(size: 36),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SkeletonBar(width: 100 + (index * 20).toDouble()),
                  const SizedBox(height: 6),
                  const _SkeletonBar(width: 60, height: 10),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Text lines
          const _SkeletonBar(width: double.infinity, height: 14),
          const SizedBox(height: 8),
          _SkeletonBar(width: 200 - (index * 30).toDouble(), height: 14),
          // Image placeholder on alternating cards
          if (index == 1) ...[
            const SizedBox(height: 12),
            Container(
              height: 140,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ],
          const SizedBox(height: 14),
          // Engagement bar
          Row(
            children: [
              const _SkeletonCircle(size: 24),
              const SizedBox(width: 8),
              const _SkeletonBar(width: 24, height: 10),
              const SizedBox(width: 20),
              const _SkeletonCircle(size: 24),
              const SizedBox(width: 8),
              const _SkeletonBar(width: 24, height: 10),
            ],
          ),
        ],
      ),
    );
  }
}

/// Skeleton that mimics 5 ranking rows
class RankingSkeletonLoader extends StatelessWidget {
  const RankingSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: 5,
        itemBuilder: (context, i) => _buildRankingRowSkeleton(i),
      ),
    );
  }

  Widget _buildRankingRowSkeleton(int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          // Rank badge
          const _SkeletonCircle(size: 36),
          const SizedBox(width: 14),
          // Avatar
          const _SkeletonCircle(size: 42),
          const SizedBox(width: 14),
          // Name + stats
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SkeletonBar(width: 90 + (index * 15).toDouble()),
                const SizedBox(height: 6),
                const _SkeletonBar(width: 130, height: 10),
              ],
            ),
          ),
          // Rating chip
          const _SkeletonBar(width: 48, height: 24, radius: 12),
        ],
      ),
    );
  }
}

/// Skeleton that mimics 4 team cards
class TeamSkeletonLoader extends StatelessWidget {
  const TeamSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: 4,
        itemBuilder: (context, i) => _buildTeamCardSkeleton(i),
      ),
    );
  }

  Widget _buildTeamCardSkeleton(int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          // Team icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(width: 14),
          // Team name + members + record
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SkeletonBar(width: 110 + (index * 20).toDouble()),
                const SizedBox(height: 6),
                const _SkeletonBar(width: 80, height: 10),
                const SizedBox(height: 4),
                const _SkeletonBar(width: 100, height: 10),
              ],
            ),
          ),
          // Action button placeholder
          const _SkeletonBar(width: 70, height: 32, radius: 8),
        ],
      ),
    );
  }
}

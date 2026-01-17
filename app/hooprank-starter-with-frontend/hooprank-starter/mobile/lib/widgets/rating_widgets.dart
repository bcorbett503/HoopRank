// =============================================================================
// Rating Display Widgets
// =============================================================================
// Widgets for displaying HoopRank ratings and rank labels.
// Used in profile cards, home screen, and player lists.
// =============================================================================

import 'package:flutter/material.dart';

/// Get the rank title based on rating value
/// Matches the backend rating tier system
String getRankLabel(double rating) {
  if (rating >= 5.0) return 'Legend';
  if (rating >= 4.5) return 'Elite';
  if (rating >= 4.0) return 'Pro';
  if (rating >= 3.5) return 'All-Star';
  if (rating >= 3.0) return 'Starter';
  if (rating >= 2.5) return 'Bench';
  if (rating >= 2.0) return 'Rookie';
  return 'Newcomer';
}

/// Get the rank color based on rating value
Color getRankColor(double rating) {
  if (rating >= 5.0) return Colors.purple;
  if (rating >= 4.5) return Colors.amber;
  if (rating >= 4.0) return Colors.orange;
  if (rating >= 3.5) return Colors.blue;
  if (rating >= 3.0) return Colors.green;
  if (rating >= 2.5) return Colors.teal;
  if (rating >= 2.0) return Colors.grey;
  return Colors.blueGrey;
}

/// Compact badge showing the rank label
class RankBadge extends StatelessWidget {
  final double rating;
  final bool showEmoji;
  final double fontSize;

  const RankBadge({
    super.key,
    required this.rating,
    this.showEmoji = true,
    this.fontSize = 12,
  });

  @override
  Widget build(BuildContext context) {
    final label = getRankLabel(rating);
    final color = getRankColor(rating);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(
        showEmoji ? '🏀 $label' : label,
        style: TextStyle(
          color: color,
          fontSize: fontSize,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

/// Large rating display with rank label (for home screen hero section)
class RatingHeroCard extends StatelessWidget {
  final double rating;
  final VoidCallback? onStartMatch;

  const RatingHeroCard({
    super.key,
    required this.rating,
    this.onStartMatch,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.deepOrange.shade800, Colors.orange.shade600],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.deepOrange.withOpacity(0.3),
            blurRadius: 12,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        children: [
          const Text(
            'Your HoopRank',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            rating.toStringAsFixed(2),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 48,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '🏀 ${getRankLabel(rating)}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          if (onStartMatch != null) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onStartMatch,
              icon: const Icon(Icons.sports_basketball),
              label: const Text('Start a 1v1'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.deepOrange,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Compact rating display with star icon
class RatingChip extends StatelessWidget {
  final double rating;
  final double fontSize;

  const RatingChip({
    super.key,
    required this.rating,
    this.fontSize = 14,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star, size: fontSize + 2, color: Colors.amber),
        const SizedBox(width: 4),
        Text(
          rating.toStringAsFixed(1),
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

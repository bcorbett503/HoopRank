// =============================================================================
// Challenge Widgets
// =============================================================================
// Reusable widgets for challenge UI components used across the app.
// Extracted from home_screen.dart for consistency and reusability.
// =============================================================================

import 'package:flutter/material.dart';

/// Status indicator badge for challenges
/// Shows appropriate color and icon based on challenge direction and status
class ChallengeBadge extends StatelessWidget {
  final bool isSent;
  final String status; // 'pending', 'accepted', 'declined', 'expired'

  const ChallengeBadge({
    super.key,
    required this.isSent,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color borderColor;
    Color iconColor;
    IconData? icon;
    String? label;

    if (isSent) {
      switch (status) {
        case 'accepted':
          bgColor = Colors.green.shade100;
          borderColor = Colors.green;
          iconColor = Colors.green.shade800;
          icon = Icons.check_circle;
          break;
        case 'declined':
          bgColor = Colors.red.shade100;
          borderColor = Colors.red;
          iconColor = Colors.red.shade800;
          icon = Icons.cancel;
          break;
        case 'expired':
          bgColor = Colors.grey.shade200;
          borderColor = Colors.grey;
          iconColor = Colors.grey.shade700;
          icon = Icons.timer_off;
          break;
        default: // pending
          bgColor = Colors.blue.shade100;
          borderColor = Colors.blue;
          iconColor = Colors.blue.shade800;
          icon = Icons.hourglass_empty;
      }
    } else {
      // Received challenges
      bgColor = Colors.orange.shade100;
      borderColor = Colors.orange;
      iconColor = Colors.deepOrange;
      label = 'CHALLENGE';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: label != null
          ? Text(label,
              style: TextStyle(
                  fontSize: 10, color: iconColor, fontWeight: FontWeight.bold))
          : Icon(icon, size: 16, color: iconColor),
    );
  }
}

/// Circular or pill-shaped status indicator for challenge cards
class ChallengeStatusIndicator extends StatelessWidget {
  final bool isSent;
  final String status;

  const ChallengeStatusIndicator({
    super.key,
    required this.isSent,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    if (!isSent) {
      // Received challenge - show action needed indicator
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.deepOrange.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.deepOrange.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.sports_basketball, size: 14, color: Colors.deepOrange),
            SizedBox(width: 4),
            Text('NEW',
                style: TextStyle(
                    fontSize: 11,
                    color: Colors.deepOrange,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }

    // Sent challenge status
    IconData icon;
    Color color;

    switch (status) {
      case 'accepted':
        icon = Icons.check_circle_outline;
        color = Colors.green;
        break;
      case 'declined':
        icon = Icons.cancel_outlined;
        color = Colors.red;
        break;
      case 'expired':
        icon = Icons.timer_off_outlined;
        color = Colors.grey;
        break;
      default: // pending
        icon = Icons.schedule;
        color = Colors.blue;
    }

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 20, color: color),
    );
  }
}

/// Challenge confirmation dialog with player info
class ChallengeDialog extends StatelessWidget {
  final String playerId;
  final String playerName;
  final double playerRating;
  final String? avatarUrl;
  final String? city;
  final VoidCallback? onChallenge;

  const ChallengeDialog({
    super.key,
    required this.playerId,
    required this.playerName,
    required this.playerRating,
    this.avatarUrl,
    this.city,
    this.onChallenge,
  });

  /// Show this dialog as a modal
  static Future<void> show(
    BuildContext context, {
    required String playerId,
    required String playerName,
    required double playerRating,
    String? avatarUrl,
    String? city,
    required Future<void> Function() onChallenge,
  }) {
    return showDialog(
      context: context,
      builder: (ctx) => ChallengeDialog(
        playerId: playerId,
        playerName: playerName,
        playerRating: playerRating,
        avatarUrl: avatarUrl,
        city: city,
        onChallenge: () async {
          Navigator.pop(ctx);
          await onChallenge();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.grey[900],
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text('Challenge $playerName?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 40,
            backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
            child: avatarUrl == null
                ? Text(playerName[0].toUpperCase(),
                    style: const TextStyle(fontSize: 24))
                : null,
          ),
          const SizedBox(height: 12),
          Text('⭐ ${playerRating.toStringAsFixed(1)}',
              style: const TextStyle(color: Colors.grey)),
          if (city != null)
            Text('📍 $city',
                style: const TextStyle(color: Colors.grey, fontSize: 12)),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: onChallenge,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.deepOrange,
            foregroundColor: Colors.white,
          ),
          child: const Text('Challenge'),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';

import '../services/recommended_matchup_engine.dart';
import '../utils/image_utils.dart';

class FeaturedMatchupFeedCard extends StatelessWidget {
  static const double highConfidenceScore = 82.0;

  final RecommendedMatchup matchup;
  final bool isSubmitting;
  final VoidCallback? onChallengePressed;
  final VoidCallback? onProfilePressed;
  final VoidCallback? onVenuePressed;
  final VoidCallback? onSkipPressed;

  const FeaturedMatchupFeedCard({
    super.key,
    required this.matchup,
    required this.isSubmitting,
    this.onChallengePressed,
    this.onProfilePressed,
    this.onVenuePressed,
    this.onSkipPressed,
  });

  @override
  Widget build(BuildContext context) {
    final isHighConfidence = matchup.score >= highConfidenceScore;
    final accentColor =
        isHighConfidence ? const Color(0xFF2DD4BF) : const Color(0xFFF97316);
    final secondaryGlow = const Color(0xFFF97316);
    final player = matchup.player;
    final photoUrl = player.photoUrl;
    final subtitleParts = <String>[
      '⭐ ${player.rating.toStringAsFixed(2)}',
      if (player.city != null && player.city!.trim().isNotEmpty)
        player.city!.trim(),
    ];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFF19273A),
            Color(0xFF0F172A),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: accentColor.withValues(alpha: isHighConfidence ? 0.92 : 0.48),
          width: isHighConfidence ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: isHighConfidence ? 0.22 : 0.1),
            blurRadius: isHighConfidence ? 22 : 12,
            spreadRadius: isHighConfidence ? 0.6 : 0,
            offset: const Offset(0, 10),
          ),
          if (isHighConfidence)
            BoxShadow(
              color: secondaryGlow.withValues(alpha: 0.14),
              blurRadius: 26,
              spreadRadius: 0.2,
              offset: const Offset(0, 12),
            ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: accentColor.withValues(
                              alpha: isHighConfidence ? 0.18 : 0.12),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: accentColor.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isHighConfidence
                                  ? Icons.flash_on_rounded
                                  : Icons.recommend_rounded,
                              size: 14,
                              color: accentColor,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              isHighConfidence
                                  ? 'HOT MATCHUP'
                                  : 'SUGGESTED MATCHUP',
                              style: TextStyle(
                                color: accentColor,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.9,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(999),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.06)),
                  ),
                  child: Text(
                    '${matchup.score.toStringAsFixed(0)}% match',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (onSkipPressed != null) ...[
                  const SizedBox(width: 6),
                  IconButton(
                    onPressed: isSubmitting ? null : onSkipPressed,
                    icon: const Icon(Icons.close_rounded, size: 18),
                    padding: EdgeInsets.zero,
                    constraints:
                        const BoxConstraints.tightFor(width: 28, height: 28),
                    splashRadius: 16,
                    color: Colors.white60,
                    tooltip: 'Hide matchup',
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: onProfilePressed,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: accentColor.withValues(alpha: 0.18),
                      backgroundImage:
                          photoUrl != null && !isPlaceholderImage(photoUrl)
                              ? safeImageProvider(photoUrl)
                              : null,
                      child: (photoUrl == null || isPlaceholderImage(photoUrl))
                          ? Text(
                              player.name.isNotEmpty
                                  ? player.name[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            player.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            subtitleParts.join(' • '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (matchup.reasons.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: matchup.reasons.take(3).map((reason) {
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.08)),
                    ),
                    child: Text(
                      reason,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
            if (matchup.suggestedVenueName != null &&
                matchup.suggestedVenueName!.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              InkWell(
                onTap: matchup.suggestedVenueId != null ? onVenuePressed : null,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      const Icon(Icons.location_on_rounded,
                          size: 15, color: Colors.lightBlueAccent),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          matchup.suggestedVenueName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: matchup.suggestedVenueId != null
                                ? Colors.lightBlueAccent
                                : Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            decoration: matchup.suggestedVenueId != null
                                ? TextDecoration.underline
                                : TextDecoration.none,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (matchup.suggestedVenueRationale != null &&
                  matchup.suggestedVenueRationale!.trim().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  matchup.suggestedVenueRationale!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    height: 1.3,
                  ),
                ),
              ],
            ],
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: isSubmitting ? null : onProfilePressed,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(
                        color: Colors.white.withValues(alpha: 0.18),
                      ),
                      minimumSize: const Size.fromHeight(38),
                    ),
                    child: const Text(
                      'View Profile',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: isSubmitting ? null : onChallengePressed,
                    style: FilledButton.styleFrom(
                      backgroundColor: isHighConfidence
                          ? const Color(0xFFF97316)
                          : accentColor.withValues(alpha: 0.9),
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(38),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                    icon: isSubmitting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : Icon(
                            isHighConfidence
                                ? Icons.flash_on_rounded
                                : Icons.sports_basketball_rounded,
                            size: 15,
                          ),
                    label: Text(
                      isSubmitting
                          ? 'Sending...'
                          : isHighConfidence
                              ? 'Play Now'
                              : 'Challenge',
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../services/recommended_matchup_engine.dart';
import '../utils/image_utils.dart';

enum HomePrimaryActionState {
  loading,
  recommended,
  inviteFallback,
}

class HomePrimaryActionSection extends StatelessWidget {
  final HomePrimaryActionState state;
  final RecommendedMatchup? recommended;
  final bool isSubmitting;
  final VoidCallback onChallengePressed;
  final VoidCallback onInvitePressed;
  final VoidCallback? onProfilePressed;
  final VoidCallback? onSkipPressed;
  final VoidCallback? onVenuePressed;

  const HomePrimaryActionSection({
    super.key,
    required this.state,
    required this.recommended,
    required this.isSubmitting,
    required this.onChallengePressed,
    required this.onInvitePressed,
    this.onProfilePressed,
    this.onSkipPressed,
    this.onVenuePressed,
  });

  @override
  Widget build(BuildContext context) {
    switch (state) {
      case HomePrimaryActionState.loading:
        return _buildLoadingCard();
      case HomePrimaryActionState.recommended:
        if (recommended == null) return _buildLoadingCard();
        return _buildRecommendedCard(context, recommended!);
      case HomePrimaryActionState.inviteFallback:
        return _buildInviteCard(context);
    }
  }

  Widget _buildLoadingCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF2C3E50),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 170,
            height: 14,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.white12,
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendedCard(
      BuildContext context, RecommendedMatchup matchup) {
    final player = matchup.player;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.deepOrange.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.recommend,
                    size: 16, color: Colors.deepOrange),
              ),
              const SizedBox(width: 12),
              const Text(
                'SUGGESTED MATCHUP',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: Colors.white70,
                ),
              ),
            ],
          ),
        ),
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFF2C3E50),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.deepOrange.withOpacity(0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              InkWell(
                onTap: onProfilePressed,
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 1),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundImage: player.photoUrl != null &&
                                !isPlaceholderImage(player.photoUrl)
                            ? safeImageProvider(player.photoUrl!)
                            : null,
                        child: (player.photoUrl == null ||
                                isPlaceholderImage(player.photoUrl))
                            ? Text(
                                player.name.isNotEmpty
                                    ? player.name[0].toUpperCase()
                                    : '?',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14),
                              )
                            : null,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    player.name,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                Text(
                                  '${matchup.score.toStringAsFixed(0)}%',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 1),
                            Text(
                              '⭐ ${player.rating.toStringAsFixed(2)}'
                              '${player.city != null && player.city!.isNotEmpty ? ' • ${player.city}' : ''}',
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: isSubmitting ? null : onSkipPressed,
                        icon: const Icon(Icons.skip_next, size: 16),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints.tightFor(
                            width: 24, height: 24),
                        splashRadius: 14,
                        color: Colors.white70,
                        tooltip: 'Skip suggestion',
                      ),
                    ],
                  ),
                ),
              ),
              if (matchup.reasons.isNotEmpty) ...[
                const SizedBox(height: 6),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (var i = 0; i < matchup.reasons.length; i++) ...[
                        if (i > 0) const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white10,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: Colors.white24),
                          ),
                          child: Text(
                            matchup.reasons[i],
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              if (matchup.suggestedVenueName != null &&
                  matchup.suggestedVenueName!.isNotEmpty) ...[
                const SizedBox(height: 6),
                InkWell(
                  onTap:
                      matchup.suggestedVenueId != null ? onVenuePressed : null,
                  borderRadius: BorderRadius.circular(8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.location_on,
                              size: 12, color: Colors.lightBlueAccent),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              'Suggested venue: ${matchup.suggestedVenueName!}',
                              style: TextStyle(
                                color: matchup.suggestedVenueId != null
                                    ? Colors.lightBlueAccent
                                    : Colors.white70,
                                fontSize: 11,
                                decoration: matchup.suggestedVenueId != null
                                    ? TextDecoration.underline
                                    : TextDecoration.none,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (matchup.suggestedVenueRationale != null &&
                          matchup.suggestedVenueRationale!
                              .trim()
                              .isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Padding(
                          padding: const EdgeInsets.only(left: 15),
                          child: Text(
                            matchup.suggestedVenueRationale!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white54,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: isSubmitting ? null : onChallengePressed,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.deepOrange,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(40),
                    padding: const EdgeInsets.symmetric(vertical: 8),
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
                      : const Icon(Icons.sports_basketball, size: 14),
                  label: Text(isSubmitting ? 'Sending...' : 'Challenge'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildInviteCard(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF2C3E50),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.lightBlueAccent.withOpacity(0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.group_add, color: Colors.lightBlueAccent, size: 16),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Invite someone to play 1v1',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'No strong matchup right now.',
            style: TextStyle(
              color: Colors.white.withOpacity(0.8),
              fontSize: 11,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: isSubmitting ? null : onInvitePressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.lightBlueAccent.withOpacity(0.2),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(38),
                padding: const EdgeInsets.symmetric(vertical: 8),
              ),
              icon: isSubmitting
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Icon(Icons.share, size: 14),
              label: Text(isSubmitting ? 'Preparing...' : 'Send invite link'),
            ),
          ),
        ],
      ),
    );
  }
}

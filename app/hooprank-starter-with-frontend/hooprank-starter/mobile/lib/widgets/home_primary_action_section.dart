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
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF2C3E50),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.deepOrange.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.recommend, color: Colors.deepOrange, size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Suggested Matchup',
                  style: TextStyle(
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
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 6),
              IconButton(
                onPressed: isSubmitting ? null : onSkipPressed,
                icon: const Icon(Icons.skip_next, size: 18),
                color: Colors.white70,
                tooltip: 'Skip suggestion',
              ),
            ],
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: onProfilePressed,
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
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
                                fontWeight: FontWeight.bold),
                          )
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          player.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '⭐ ${player.rating.toStringAsFixed(2)}'
                          '${player.city != null && player.city!.isNotEmpty ? ' • ${player.city}' : ''}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.white54),
                ],
              ),
            ),
          ),
          if (matchup.reasons.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: matchup.reasons
                  .map(
                    (reason) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white10,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: Text(
                        reason,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (matchup.suggestedVenueName != null &&
              matchup.suggestedVenueName!.isNotEmpty) ...[
            const SizedBox(height: 10),
            InkWell(
              onTap: matchup.suggestedVenueId != null ? onVenuePressed : null,
              borderRadius: BorderRadius.circular(8),
              child: Row(
                children: [
                  const Icon(Icons.location_on,
                      size: 14, color: Colors.lightBlueAccent),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Suggested venue: ${matchup.suggestedVenueName!}',
                      style: TextStyle(
                        color: matchup.suggestedVenueId != null
                            ? Colors.lightBlueAccent
                            : Colors.white70,
                        fontSize: 12,
                        decoration: matchup.suggestedVenueId != null
                            ? TextDecoration.underline
                            : TextDecoration.none,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: isSubmitting ? null : onChallengePressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepOrange,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              icon: isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Icon(Icons.sports_basketball, size: 16),
              label: Text(isSubmitting ? 'Sending...' : 'Challenge'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInviteCard(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF2C3E50),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.lightBlueAccent.withOpacity(0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.group_add, color: Colors.lightBlueAccent, size: 18),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Invite someone you want to play 1v1',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'No strong matchup right now. Invite someone you want to play 1v1 on HoopRank.',
            style: TextStyle(
              color: Colors.white.withOpacity(0.8),
              fontSize: 12,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: isSubmitting ? null : onInvitePressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.lightBlueAccent.withOpacity(0.2),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              icon: isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Icon(Icons.share, size: 16),
              label: Text(isSubmitting
                  ? 'Preparing...'
                  : 'Invite someone you want to play 1v1'),
            ),
          ),
        ],
      ),
    );
  }
}

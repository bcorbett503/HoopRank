import '../models.dart';

class RecommendedMatchup {
  final User player;
  final double score;
  final List<String> reasons;
  final String? suggestedVenueId;
  final String? suggestedVenueName;
  final String? suggestedVenueRationale;

  const RecommendedMatchup({
    required this.player,
    required this.score,
    required this.reasons,
    this.suggestedVenueId,
    this.suggestedVenueName,
    this.suggestedVenueRationale,
  });

  RecommendedMatchup copyWith({
    User? player,
    double? score,
    List<String>? reasons,
    String? suggestedVenueId,
    String? suggestedVenueName,
    String? suggestedVenueRationale,
  }) {
    return RecommendedMatchup(
      player: player ?? this.player,
      score: score ?? this.score,
      reasons: reasons ?? this.reasons,
      suggestedVenueId: suggestedVenueId ?? this.suggestedVenueId,
      suggestedVenueName: suggestedVenueName ?? this.suggestedVenueName,
      suggestedVenueRationale:
          suggestedVenueRationale ?? this.suggestedVenueRationale,
    );
  }
}

class RecommendedMatchupEngine {
  static const double qualityGate = 58.0;
  static const int minAdultAge = 18;
  static const int likelyYouthHeightInches = 62; // 5'2"

  static RecommendedMatchup? pickBest({
    required User currentUser,
    required List<User> candidates,
    required String discoverMode,
    required double searchRadiusMiles,
  }) {
    final eligible = <_ScoredCandidate>[];
    final isEloScale = _isEloScale(currentUser, candidates);
    final similarityDisqualifyDiff = isEloScale ? 250.0 : 1.25;
    final scoreZeroDiff = isEloScale ? 400.0 : 2.0;
    final ratingPenaltyDiff = isEloScale ? 350.0 : 1.75;

    for (final candidate in candidates) {
      if (candidate.id == currentUser.id) {
        continue;
      }
      if (_isLikelyYouthCandidate(candidate)) {
        continue;
      }

      final ratingDiff = (candidate.rating - currentUser.rating).abs();
      if (discoverMode == 'similar' && ratingDiff > similarityDisqualifyDiff) {
        continue;
      }

      final score = _scoreCandidate(
        candidate: candidate,
        currentUser: currentUser,
        ratingDiff: ratingDiff,
        scoreZeroDiff: scoreZeroDiff,
        ratingPenaltyDiff: ratingPenaltyDiff,
        searchRadiusMiles: searchRadiusMiles,
      );

      final reasons = _buildReasons(
        candidate: candidate,
        currentUser: currentUser,
        ratingDiff: ratingDiff,
        isEloScale: isEloScale,
      );

      eligible.add(
        _ScoredCandidate(
          player: candidate,
          score: score,
          ratingDiff: ratingDiff,
          reasons: reasons,
        ),
      );
    }

    if (eligible.isEmpty) {
      return null;
    }

    eligible.sort((a, b) {
      final byScore = b.score.compareTo(a.score);
      if (byScore != 0) return byScore;
      final byDiff = a.ratingDiff.compareTo(b.ratingDiff);
      if (byDiff != 0) return byDiff;
      return b.player.gamesPlayed.compareTo(a.player.gamesPlayed);
    });

    final top = eligible.first;
    if (top.score < qualityGate) {
      return null;
    }

    return RecommendedMatchup(
      player: top.player,
      score: top.score,
      reasons: top.reasons,
    );
  }

  static bool _isEloScale(User currentUser, List<User> candidates) {
    final pool = <double>[
      currentUser.rating,
      ...candidates.map((c) => c.rating)
    ];
    final maxRating = pool.fold<double>(0.0, (acc, value) {
      return value > acc ? value : acc;
    });
    return maxRating > 100.0;
  }

  static double _scoreCandidate({
    required User candidate,
    required User currentUser,
    required double ratingDiff,
    required double scoreZeroDiff,
    required double ratingPenaltyDiff,
    required double searchRadiusMiles,
  }) {
    final ratingSimilarity = _linearScore(
      value: ratingDiff,
      maxValue: scoreZeroDiff,
      maxScore: 35.0,
      invert: true,
    );

    final proximity = candidate.distanceMi == null
        ? 12.0
        : _linearScore(
            value: candidate.distanceMi!,
            maxValue: searchRadiusMiles <= 0 ? 25 : searchRadiusMiles,
            maxScore: 25.0,
            invert: true,
          );

    final contestRate = candidate.contestRate.clamp(0.0, 1.0);
    final gamesVolume = (candidate.gamesPlayed / 20.0).clamp(0.0, 1.0);
    final reliability = ((1.0 - contestRate) * gamesVolume) * 20.0;

    final activityConfidence = gamesVolume * 10.0;
    double profileDepth = 0.0;
    if (candidate.age != null && candidate.age! >= minAdultAge) {
      profileDepth += 3.0;
    }
    if (_parseHeightInches(candidate.height) != null) {
      profileDepth += 2.0;
    }

    double positionAffinity = 0.0;
    final myPosition = currentUser.position;
    final candidatePosition = candidate.position;
    if (myPosition != null &&
        myPosition.isNotEmpty &&
        candidatePosition != null &&
        candidatePosition.isNotEmpty) {
      positionAffinity = myPosition == candidatePosition ? 10.0 : 5.0;
    }

    var total = ratingSimilarity +
        proximity +
        reliability +
        activityConfidence +
        profileDepth +
        positionAffinity;

    if (candidate.gamesPlayed == 0) {
      total -= 10.0;
    } else if (candidate.gamesPlayed < 3) {
      total -= 6.0;
    }

    if (candidate.contestRate >= 0.25 && candidate.gamesPlayed >= 5) {
      total -= 15.0;
    }

    if (ratingDiff > ratingPenaltyDiff) {
      total -= 10.0;
    }

    return total.clamp(0.0, 100.0);
  }

  static double _linearScore({
    required double value,
    required double maxValue,
    required double maxScore,
    required bool invert,
  }) {
    if (maxValue <= 0) return 0.0;
    final ratio = (value / maxValue).clamp(0.0, 1.0);
    final scaled = invert ? (1.0 - ratio) : ratio;
    return scaled * maxScore;
  }

  static List<String> _buildReasons({
    required User candidate,
    required User currentUser,
    required double ratingDiff,
    required bool isEloScale,
  }) {
    final reasons = <String>[];

    final strongSimilarity =
        isEloScale ? ratingDiff <= 120.0 : ratingDiff <= 0.5;
    if (strongSimilarity) {
      reasons.add('Close in rank');
    }

    if (candidate.distanceMi != null) {
      reasons.add('${candidate.distanceMi!.toStringAsFixed(1)} mi away');
    } else if (candidate.city != null && candidate.city!.isNotEmpty) {
      reasons.add(candidate.city!);
    }

    if (candidate.position != null && candidate.position!.isNotEmpty) {
      reasons.add('Position: ${candidate.position}');
    }

    final myHeight = _parseHeightInches(currentUser.height);
    final candidateHeight = _parseHeightInches(candidate.height);
    if (myHeight != null &&
        candidateHeight != null &&
        (myHeight - candidateHeight).abs() <= 4) {
      reasons.add('Comparable size');
    }

    if (candidate.age != null && candidate.age! >= minAdultAge) {
      reasons.add('Adult player');
    }

    if (candidate.contestRate <= 0.1 && candidate.gamesPlayed >= 5) {
      reasons.add('Reliable game reports');
    } else if (candidate.gamesPlayed >= 10) {
      reasons.add('Active player');
    }

    return reasons.take(3).toList();
  }

  static bool _isLikelyYouthCandidate(User candidate) {
    final age = candidate.age;
    if (age != null && age > 0 && age < minAdultAge) {
      return true;
    }

    final heightInches = _parseHeightInches(candidate.height);
    if (heightInches != null &&
        heightInches <= likelyYouthHeightInches &&
        (age == null || age < 21)) {
      return true;
    }

    return false;
  }

  static int? _parseHeightInches(String? rawHeight) {
    if (rawHeight == null) return null;
    var normalized = rawHeight.trim().toLowerCase();
    if (normalized.isEmpty) return null;

    normalized = normalized
        .replaceAll('’', '\'')
        .replaceAll('`', '\'')
        .replaceAll('′', '\'')
        .replaceAll('″', '"')
        .replaceAll('“', '"')
        .replaceAll('”', '"');

    final feetInchesMatch =
        RegExp(r"(\d)\s*(?:ft|feet|')\s*(\d{1,2})?").firstMatch(normalized);
    if (feetInchesMatch != null) {
      final feet = int.tryParse(feetInchesMatch.group(1) ?? '');
      final inches = int.tryParse(feetInchesMatch.group(2) ?? '0') ?? 0;
      if (feet != null) {
        final total = (feet * 12) + inches;
        if (total >= 48 && total <= 90) return total;
      }
    }

    final dashedMatch =
        RegExp(r'^(\d)\s*-\s*(\d{1,2})$').firstMatch(normalized);
    if (dashedMatch != null) {
      final feet = int.tryParse(dashedMatch.group(1) ?? '');
      final inches = int.tryParse(dashedMatch.group(2) ?? '');
      if (feet != null && inches != null) {
        final total = (feet * 12) + inches;
        if (total >= 48 && total <= 90) return total;
      }
    }

    final centimetersMatch = RegExp(r'(\d{3})\s*cm').firstMatch(normalized);
    if (centimetersMatch != null) {
      final cm = int.tryParse(centimetersMatch.group(1) ?? '');
      if (cm != null) {
        final inches = (cm / 2.54).round();
        if (inches >= 48 && inches <= 90) return inches;
      }
    }

    final inchesMatch =
        RegExp(r'^(\d{2,3})(?:\s*(?:in|inch|inches|\"))?$').firstMatch(
      normalized,
    );
    if (inchesMatch != null) {
      final inches = int.tryParse(inchesMatch.group(1) ?? '');
      if (inches != null && inches >= 48 && inches <= 90) {
        return inches;
      }
    }

    return null;
  }
}

class _ScoredCandidate {
  final User player;
  final double score;
  final double ratingDiff;
  final List<String> reasons;

  const _ScoredCandidate({
    required this.player,
    required this.score,
    required this.ratingDiff,
    required this.reasons,
  });
}

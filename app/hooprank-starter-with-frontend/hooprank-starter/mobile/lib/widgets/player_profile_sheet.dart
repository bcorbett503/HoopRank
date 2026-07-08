import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../state/check_in_state.dart';
import '../screens/chat_screen.dart';
import '../utils/default_avatar_variants.dart';
import '../utils/flat_avatar.dart';
import '../utils/image_utils.dart';

/// Shared palette for the dark profile sheet — matches the permission
/// prompts and status sheet (surface #141E28, brand orange accents).
const Color _sheetSurface = Color(0xFF141E28);
const Color _cardSurface = Color(0x10FFFFFF); // white @ ~6%
const Color _brandOrange = Color(0xFFFF6B35);
Color _ink(double alpha) => Colors.white.withValues(alpha: alpha);

/// A clickable player name that shows their profile when tapped
class ClickablePlayerName extends StatelessWidget {
  final String playerId;
  final String playerName;
  final String? photoUrl;
  final double? rating;
  final TextStyle? style;
  final bool showAvatar;

  const ClickablePlayerName({
    super.key,
    required this.playerId,
    required this.playerName,
    this.photoUrl,
    this.rating,
    this.style,
    this.showAvatar = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => PlayerProfileSheet.showById(context, playerId),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showAvatar) ...[
            CircleAvatar(
              radius: 14,
              backgroundImage:
                  photoUrl != null ? safeImageProvider(photoUrl!) : null,
              backgroundColor: Colors.deepOrange.withOpacity(0.2),
              child: photoUrl == null
                  ? Text(
                      playerName.isNotEmpty ? playerName[0].toUpperCase() : '?',
                      style: const TextStyle(
                          fontSize: 11, color: Colors.deepOrange))
                  : null,
            ),
            const SizedBox(width: 6),
          ],
          Text(
            playerName,
            style: style ??
                const TextStyle(
                  color: Colors.blue,
                  fontWeight: FontWeight.w500,
                  decoration: TextDecoration.underline,
                ),
          ),
        ],
      ),
    );
  }
}

class PlayerProfileSheet extends StatefulWidget {
  final User player;
  final VoidCallback? onChallenge;
  final VoidCallback? onMessage;
  final VoidCallback? onInviteToTeam;

  const PlayerProfileSheet({
    super.key,
    required this.player,
    this.onChallenge,
    this.onMessage,
    this.onInviteToTeam,
  });

  @override
  State<PlayerProfileSheet> createState() => _PlayerProfileSheetState();

  /// Shows the player profile as a modal bottom sheet
  static Future<void> show(
    BuildContext context,
    User player, {
    VoidCallback? onChallenge,
    VoidCallback? onMessage,
    VoidCallback? onInviteToTeam,
  }) {
    return showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => PlayerProfileSheet(
        player: player,
        onChallenge: onChallenge,
        onMessage: onMessage,
        onInviteToTeam: onInviteToTeam,
      ),
    );
  }

  /// Shows the player profile by fetching user data from their ID
  static Future<void> showById(
    BuildContext context,
    String userId, {
    VoidCallback? onChallenge,
    VoidCallback? onMessage,
    VoidCallback? onInviteToTeam,
  }) async {
    // Show bottom sheet immediately with loading state, then fetch data
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _LoadingProfileSheet(
        userId: userId,
        onChallenge: onChallenge,
        onMessage: onMessage,
        onInviteToTeam: onInviteToTeam,
      ),
    );
  }
}

/// A wrapper that shows loading then the actual profile
class _LoadingProfileSheet extends StatefulWidget {
  final String userId;
  final VoidCallback? onChallenge;
  final VoidCallback? onMessage;
  final VoidCallback? onInviteToTeam;

  const _LoadingProfileSheet({
    required this.userId,
    this.onChallenge,
    this.onMessage,
    this.onInviteToTeam,
  });

  @override
  State<_LoadingProfileSheet> createState() => _LoadingProfileSheetState();
}

class _LoadingProfileSheetState extends State<_LoadingProfileSheet> {
  User? _user;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final profileData = await ApiService.getProfile(widget.userId);

      if (!mounted) return;

      if (profileData == null) {
        setState(() {
          _error = 'Could not load player profile';
          _isLoading = false;
        });
        return;
      }

      // Create User object from profile data
      double rating = 3.0;
      final ratingValue = profileData['rating'] ??
          profileData['hoop_rank'] ??
          profileData['hoopRank'];
      if (ratingValue is num) {
        rating = ratingValue.toDouble();
      } else if (ratingValue is String) {
        rating = double.tryParse(ratingValue) ?? 3.0;
      }

      final rawAvatarConfig =
          profileData['avatarConfig'] ?? profileData['avatar_config'];
      final user = User(
        id: widget.userId,
        name: profileData['name']?.toString() ?? 'Unknown',
        photoUrl: profileData['photoUrl']?.toString() ??
            profileData['avatar_url']?.toString(),
        position: profileData['position']?.toString(),
        rating: rating,
        city: profileData['city']?.toString(),
        matchesPlayed: (profileData['matchesPlayed'] as int?) ?? 0,
        wins: (profileData['wins'] as int?) ?? 0,
        height: profileData['height']?.toString(),
        // Carry the avatar config through so the sheet can render the
        // player's flat avatar (or their deterministic default).
        avatarConfig: rawAvatarConfig is Map
            ? Map<String, dynamic>.from(rawAvatarConfig)
            : null,
      );

      setState(() {
        _user = user;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Error loading profile: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        height: 300,
        decoration: const BoxDecoration(
          color: _sheetSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: _brandOrange),
        ),
      );
    }

    if (_error != null || _user == null) {
      return Container(
        height: 200,
        decoration: const BoxDecoration(
          color: _sheetSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: _ink(0.35)),
              const SizedBox(height: 16),
              Text(_error ?? 'Player not found',
                  style: TextStyle(color: _ink(0.6))),
            ],
          ),
        ),
      );
    }

    return PlayerProfileSheet(
      player: _user!,
      onChallenge: widget.onChallenge,
      onMessage: widget.onMessage,
      onInviteToTeam: widget.onInviteToTeam,
    );
  }
}

class _PlayerProfileSheetState extends State<PlayerProfileSheet> {
  List<Map<String, dynamic>> _recentMatches = [];
  bool _isLoading = true;

  // Fresh data from API
  Map<String, dynamic>? _profileData;
  int _matchesPlayed = 0;
  int _wins = 0;
  int _losses = 0;
  int _kingCourtsCount = 0;
  String? _height;
  String? _city;
  String? _zip;
  List<String> _badges = [];

  @override
  void initState() {
    super.initState();
    _loadPlayerData();
  }

  void _dismissSheetThen(VoidCallback action) {
    Navigator.of(context).pop();
    WidgetsBinding.instance.addPostFrameCallback((_) => action());
  }

  /// Default invite-to-team flow: pick one of my teams (auto-picks when I
  /// have exactly one) and send the invite. With no team yet, routes to the
  /// Teams tab to create one.
  Future<void> _inviteToTeamFlow(User player) async {
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);
    List<Map<String, dynamic>> teams;
    try {
      teams = await ApiService.getMyTeams();
    } catch (_) {
      teams = [];
    }
    if (!mounted) return;

    if (teams.isEmpty) {
      _dismissSheetThen(() {
        router.go('/teams');
        messenger.showSnackBar(
          const SnackBar(
              content: Text('Create a team first, then invite players.')),
        );
      });
      return;
    }

    Map<String, dynamic>? team;
    if (teams.length == 1) {
      team = teams.first;
    } else {
      team = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        backgroundColor: _sheetSurface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (ctx) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: _ink(0.18),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('Invite ${player.name} to…',
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Colors.white)),
              ),
              Divider(color: _ink(0.08)),
              ...teams.map((t) => ListTile(
                    leading:
                        const Icon(Icons.groups_rounded, color: _brandOrange),
                    title: Text(t['name']?.toString() ?? 'Team',
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w700)),
                    subtitle: Text(t['teamType']?.toString() ?? '',
                        style: TextStyle(color: _ink(0.5), fontSize: 12)),
                    onTap: () => Navigator.pop(ctx, t),
                  )),
              const SizedBox(height: 16),
            ],
          ),
        ),
      );
    }
    if (team == null || !mounted) return;

    final teamId = team['id']?.toString() ?? '';
    final teamName = team['name']?.toString() ?? 'your team';
    try {
      final ok = await ApiService.inviteToTeam(teamId, player.id);
      messenger.showSnackBar(
        SnackBar(
          content: Text(ok
              ? 'Invited ${player.name} to $teamName'
              : 'Could not send the invite. Try again.'),
        ),
      );
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  /// Load fresh profile, stats, and recent matches from API
  Future<void> _loadPlayerData() async {
    try {
      // Fetch fresh profile data and recent matches in parallel
      final results = await Future.wait([
        ApiService.getProfile(widget.player.id),
        ApiService.getUserMatchHistory(widget.player.id),
        ApiService.getUserStats(widget.player.id),
      ]);

      final profileData = results[0] as Map<String, dynamic>?;
      final matches = results[1] as List<Map<String, dynamic>>?;
      final stats = results[2] as Map<String, dynamic>?;

      if (mounted) {
        setState(() {
          _profileData = profileData;
          _recentMatches = matches ?? [];

          // Parse stats from API response
          if (profileData != null) {
            _matchesPlayed = _parseInt(
                profileData['matchesPlayed'] ?? profileData['matches_played']);
            _wins = _parseInt(profileData['wins']);
            _losses = _parseInt(profileData['losses']);
            _kingCourtsCount = _parseInt(
              profileData['kingCourtsCount'] ??
                  profileData['king_courts_count'],
            );
            _height = profileData['height']?.toString();
            _city = profileData['city']?.toString();
            _zip = profileData['zip']?.toString() ??
                profileData['team']?.toString();
            _badges = (profileData['badges'] as List<dynamic>?)
                    ?.map((e) => e.toString())
                    .toList() ??
                [];
          }

          // Stats endpoint may have more accurate counts.
          // Respect explicit zero values instead of only applying positive values.
          if (stats != null) {
            if (stats.containsKey('matchesPlayed') ||
                stats.containsKey('matches_played') ||
                stats.containsKey('totalMatches') ||
                stats.containsKey('total_matches')) {
              _matchesPlayed = _parseInt(
                stats['matchesPlayed'] ??
                    stats['matches_played'] ??
                    stats['totalMatches'] ??
                    stats['total_matches'],
              );
            }
            if (stats.containsKey('wins')) {
              _wins = _parseInt(stats['wins']);
            }
            if (stats.containsKey('losses')) {
              _losses = _parseInt(stats['losses']);
            }
          }

          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final isSelf = ApiService.userId != null && ApiService.userId == player.id;

    // Use fresh data if available, fallback to User object
    final matchesPlayed =
        _matchesPlayed > 0 ? _matchesPlayed : player.matchesPlayed;
    final wins = _wins > 0 ? _wins : player.wins;
    final height = _height ?? player.height;
    final city = _city;
    final zip = _zip ?? player.team;
    final badges = _badges.isNotEmpty ? _badges : player.badges;

    final winRate = matchesPlayed > 0
        ? (wins / matchesPlayed * 100).toStringAsFixed(0)
        : '0';

    return Container(
      decoration: const BoxDecoration(
        color: _sheetSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle bar
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: _ink(0.18),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),

                  // Player header — the flat avatar is the hero (their own
                  // if customized, else their deterministic default), with
                  // the photo as a small corner badge, Snapchat-style.
                  Row(
                    children: [
                      _AvatarHero(player: player),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              player.name,
                              style: const TextStyle(
                                fontSize: 23,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                _buildInfoChip(Icons.leaderboard,
                                    player.rating.toStringAsFixed(1)),
                                const SizedBox(width: 8),
                                if (player.position != null)
                                  _buildInfoChip(Icons.sports_basketball,
                                      player.position!),
                              ],
                            ),
                            if ((city ?? _getCityName(zip)).isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(Icons.location_city,
                                      size: 14, color: _ink(0.55)),
                                  const SizedBox(width: 4),
                                  Text(
                                    city ?? _getCityName(zip),
                                    style: TextStyle(
                                        color: _ink(0.55), fontSize: 13),
                                  ),
                                ],
                              ),
                            ],
                            if (badges.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 4.0,
                                runSpacing: 4.0,
                                children: badges
                                    .map((badge) => Chip(
                                          label: Text(badge,
                                              style: const TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white)),
                                          backgroundColor: Colors.deepOrange,
                                          side: BorderSide.none,
                                          padding: EdgeInsets.zero,
                                          visualDensity: VisualDensity.compact,
                                          materialTapTargetSize:
                                              MaterialTapTargetSize.shrinkWrap,
                                        ))
                                    .toList(),
                              ),
                            ],
                          ],
                        ),
                      ),
                      // Follow heart icon
                      Consumer<CheckInState>(
                        builder: (context, checkInState, _) {
                          final isFollowing =
                              checkInState.isFollowingPlayer(player.id);
                          return IconButton(
                            onPressed: () =>
                                checkInState.toggleFollowPlayer(player.id),
                            icon: Icon(
                              isFollowing
                                  ? Icons.favorite
                                  : Icons.favorite_border,
                              color: isFollowing
                                  ? const Color(0xFFF87171)
                                  : _ink(0.45),
                              size: 28,
                            ),
                          );
                        },
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Action buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: isSelf
                              ? null
                              : () {
                                  final rootNavigator = Navigator.of(
                                    context,
                                    rootNavigator: true,
                                  );

                                  _dismissSheetThen(() {
                                    // Prefer injected behavior (Rankings),
                                    // otherwise default to ChatScreen.
                                    final handler = widget.onMessage;
                                    if (handler != null) {
                                      handler();
                                      return;
                                    }

                                    rootNavigator.push(
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            ChatScreen(userId: player.id),
                                      ),
                                    );
                                  });
                                },
                          icon: const Icon(Icons.message, size: 20),
                          label: const Text('Message'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _cardSurface,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                            side: BorderSide(color: _ink(0.14), width: 0.5),
                            textStyle: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 15),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: isSelf
                              ? null
                              : () {
                                  final rootNavigator = Navigator.of(
                                    context,
                                    rootNavigator: true,
                                  );

                                  _dismissSheetThen(() {
                                    // Prefer injected behavior (Rankings),
                                    // otherwise show a default dialog.
                                    final handler = widget.onChallenge;
                                    if (handler != null) {
                                      handler();
                                      return;
                                    }

                                    _showDefaultChallengeDialog(
                                      rootNavigator.context,
                                      player,
                                    );
                                  });
                                },
                          icon: const Icon(Icons.sports_basketball, size: 20),
                          label: const Text('Challenge'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _brandOrange,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                            textStyle: const TextStyle(
                                fontWeight: FontWeight.w900, fontSize: 15),
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Invite to Team — always available for other players.
                  // Uses the injected handler when provided (e.g. Rankings)
                  // or the default my-teams picker flow.
                  if (!isSelf || widget.onInviteToTeam != null) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          final injected = widget.onInviteToTeam;
                          if (injected != null) {
                            _dismissSheetThen(injected);
                          } else {
                            _inviteToTeamFlow(player);
                          }
                        },
                        icon: const Icon(Icons.group_add, size: 20),
                        label: const Text('Invite to Team'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF38BDF8),
                          side: const BorderSide(color: Color(0x6638BDF8)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                          textStyle: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 15),
                        ),
                      ),
                    ),
                  ],

                  // Report & Block buttons (Guideline 1.2)
                  if (!isSelf) ...[
                    const SizedBox(height: 16),
                    Divider(color: _ink(0.08)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _showReportUserDialog(player),
                            icon: const Icon(Icons.flag_outlined, size: 18),
                            label: const Text('Report'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFFBBF24),
                              side: const BorderSide(color: Color(0x66FBBF24)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _showBlockUserDialog(player),
                            icon: const Icon(Icons.block, size: 18),
                            label: const Text('Block'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFF87171),
                              side: const BorderSide(color: Color(0x66F87171)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 24),

                  // Stats grid - show loading indicator while fetching
                  const Text(
                    'Player Stats',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(color: _brandOrange))
                      : Column(
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: _buildStatCard(
                                    'Matches',
                                    '$matchesPlayed',
                                    Icons.sports,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildStatCard(
                                    'Wins',
                                    '$wins',
                                    Icons.emoji_events,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildStatCard(
                                    'Win Rate',
                                    '$winRate%',
                                    Icons.trending_up,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildStatCard(
                                    'King Courts',
                                    '$_kingCourtsCount',
                                    Icons.workspace_premium,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),

                  const SizedBox(height: 16),

                  // Player details
                  const Text(
                    'Details',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    decoration: BoxDecoration(
                      color: _cardSurface,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _buildDetailRow(
                              Icons.height, 'Height', height ?? 'Not set'),
                          Divider(color: _ink(0.08)),
                          _buildDetailRow(Icons.star, 'Position',
                              player.position ?? 'Not set'),
                          Divider(color: _ink(0.08)),
                          _buildCommunityRatingRow(player),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Recent matches
                  const Text(
                    'Recent Matches',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_isLoading)
                    const Center(
                        child: CircularProgressIndicator(color: _brandOrange))
                  else if (_recentMatches.isEmpty)
                    Container(
                      decoration: BoxDecoration(
                        color: _cardSurface,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Center(
                          child: Text(
                            'No recent matches',
                            style: TextStyle(color: _ink(0.55)),
                          ),
                        ),
                      ),
                    )
                  else
                    ..._recentMatches
                        .take(5)
                        .map((match) => _buildMatchCard(match)),

                  const SizedBox(height: 20),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showDefaultChallengeDialog(BuildContext context, User player) {
    final playerId = player.id;
    final playerName = player.name;

    final messageController = TextEditingController(text: 'Want to play?');

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.sports_basketball, color: Colors.deepOrange),
            const SizedBox(width: 8),
            Expanded(child: Text('Challenge $playerName')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: messageController,
              decoration: InputDecoration(
                labelText: 'Your message',
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              maxLines: 2,
              autofocus: true,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              final message = messageController.text.trim();
              if (message.isEmpty) return;
              Navigator.pop(dialogContext);

              try {
                await ApiService.createChallenge(
                    toUserId: playerId, message: message);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Challenge sent to $playerName!')),
                );
              } catch (e) {
                final errorText = e.toString().replaceFirst('Exception: ', '');
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed: $errorText')),
                );
              }
            },
            icon: const Icon(Icons.sports_basketball),
            label: const Text('Send Challenge'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  /// Simple zip code prefix to city lookup (using first 3 digits)
  String _getCityName(String? zipCode) {
    if (zipCode == null || zipCode.isEmpty) return 'Not set';

    // Map of common US zip code prefixes to city names
    final zipToCityMap = {
      '100': 'New York, NY',
      '101': 'New York, NY',
      '102': 'New York, NY',
      '103': 'Staten Island, NY',
      '104': 'Bronx, NY',
      '110': 'Queens, NY',
      '111': 'Long Island, NY',
      '112': 'Brooklyn, NY',
      '113': 'Brooklyn, NY',
      '900': 'Los Angeles, CA',
      '901': 'Los Angeles, CA',
      '902': 'Inglewood, CA',
      '903': 'Inglewood, CA',
      '904': 'Santa Monica, CA',
      '906': 'Long Beach, CA',
      '908': 'Long Beach, CA',
      '910': 'Pasadena, CA',
      '913': 'Van Nuys, CA',
      '917': 'Industry, CA',
      '919': 'San Diego, CA',
      '920': 'San Diego, CA',
      '921': 'San Diego, CA',
      '941': 'San Francisco, CA',
      '946': 'Oakland, CA',
      '947': 'Berkeley, CA',
      '950': 'San Jose, CA',
      '951': 'San Jose, CA',
      '606': 'Chicago, IL',
      '607': 'Chicago, IL',
      '608': 'Chicago, IL',
      '770': 'Houston, TX',
      '772': 'Houston, TX',
      '773': 'Houston, TX',
      '774': 'Houston, TX',
      '750': 'Dallas, TX',
      '751': 'Dallas, TX',
      '752': 'Dallas, TX',
      '753': 'Dallas, TX',
      '191': 'Philadelphia, PA',
      '192': 'Philadelphia, PA',
      '331': 'Miami, FL',
      '332': 'Miami, FL',
      '333': 'Fort Lauderdale, FL',
      '850': 'Phoenix, AZ',
      '852': 'Phoenix, AZ',
      '853': 'Phoenix, AZ',
      '021': 'Boston, MA',
      '022': 'Boston, MA',
      '981': 'Seattle, WA',
      '980': 'Seattle, WA',
      '802': 'Denver, CO',
      '803': 'Denver, CO',
      '303': 'Atlanta, GA',
      '304': 'Atlanta, GA',
    };

    // Get first 3 digits of zip code
    final prefix = zipCode.length >= 3 ? zipCode.substring(0, 3) : zipCode;

    // Return city name or the original zip if not found
    return zipToCityMap[prefix] ?? zipCode;
  }

  Widget _buildInfoChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _cardSurface,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: _brandOrange),
          const SizedBox(width: 4),
          Text(text,
              style: TextStyle(color: _ink(0.85), fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon) {
    return Container(
      decoration: BoxDecoration(
        color: _cardSurface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, size: 24, color: _brandOrange),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: Colors.white,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: _ink(0.55),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: _ink(0.5)),
          const SizedBox(width: 12),
          Text(
            label,
            style: TextStyle(
              color: _ink(0.55),
              fontSize: 14,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  /// Build matches contested row showing contest count
  Widget _buildCommunityRatingRow(User player) {
    final contestedCount = player.gamesContested;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(Icons.gavel, size: 20, color: _ink(0.5)),
          const SizedBox(width: 12),
          Text(
            'Matches Contested',
            style: TextStyle(color: _ink(0.55), fontSize: 14),
          ),
          const Spacer(),
          Text(
            contestedCount.toString(),
            style: TextStyle(
              color: contestedCount > 0 ? _brandOrange : _ink(0.45),
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMatchCard(Map<String, dynamic> match) {
    final playerId = widget.player.id;
    final creatorId = match['creator_id']?.toString();
    final opponentId = match['opponent_id']?.toString();
    final creatorName = match['creator_name']?.toString();
    final opponentName = match['opponent_name']?.toString();
    final winnerId = match['winner_id']?.toString();
    final status = match['status']?.toString() ?? '';
    final normalizedStatus = status.toLowerCase();

    // Determine who is the opponent relative to this player
    final isCreator = creatorId == playerId;
    final oppName = isCreator ? opponentName : creatorName;
    final oppId = isCreator ? opponentId : creatorId;
    final opponentDisplay = oppName ??
        (oppId != null && oppId.length > 8
            ? '${oppId.substring(0, 8)}...'
            : oppId ?? 'Unknown');

    // Parse scores from flat fields
    final scoreCreator = match['score_creator'];
    final scoreOpponent = match['score_opponent'];
    final hasScores = scoreCreator != null && scoreOpponent != null;

    String scoreStr;
    bool? isWin;

    if (hasScores) {
      final myScore = isCreator ? scoreCreator : scoreOpponent;
      final theirScore = isCreator ? scoreOpponent : scoreCreator;
      scoreStr = '$myScore - $theirScore';

      if (winnerId != null) {
        isWin = winnerId == playerId;
      } else {
        final ms =
            (myScore is num ? myScore : int.tryParse(myScore.toString()) ?? 0);
        final ts = (theirScore is num
            ? theirScore
            : int.tryParse(theirScore.toString()) ?? 0);
        if (ms != ts) isWin = ms > ts;
      }
    } else {
      scoreStr =
          (normalizedStatus == 'completed' || normalizedStatus == 'ended')
              ? 'N/A'
              : '';
    }

    // Status display
    String statusDisplay = status;
    if ((normalizedStatus == 'completed' || normalizedStatus == 'ended') &&
        isWin != null) {
      statusDisplay = isWin ? 'Victory' : 'Defeat';
    }

    const winColor = Color(0xFF4ADE80);
    const lossColor = Color(0xFFF87171);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: _cardSurface,
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isWin == true
              ? winColor.withValues(alpha: 0.16)
              : (isWin == false
                  ? lossColor.withValues(alpha: 0.16)
                  : _cardSurface),
          child: Icon(
            isWin == true
                ? Icons.check
                : (isWin == false ? Icons.close : Icons.remove),
            color: isWin == true
                ? winColor
                : (isWin == false ? lossColor : _ink(0.5)),
          ),
        ),
        title: Text('vs $opponentDisplay',
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w700)),
        subtitle: Text(statusDisplay, style: TextStyle(color: _ink(0.55))),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (hasScores)
              Text(
                scoreStr,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: Colors.white,
                ),
              ),
            if (isWin != null)
              Text(
                isWin ? 'WIN' : 'LOSS',
                style: TextStyle(
                  color: isWin ? winColor : lossColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ========== Report & Block (Guideline 1.2) ==========

  void _showReportUserDialog(User player) {
    final reasons = [
      'Spam or misleading',
      'Harassment or bullying',
      'Hate speech',
      'Inappropriate behavior',
      'Cheating / fake account',
      'Other',
    ];
    showModalBottomSheet(
      context: context,
      backgroundColor: _sheetSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: _ink(0.18),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text('Report ${player.name}',
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: Colors.white)),
            ),
            Divider(color: _ink(0.08)),
            ...reasons.map((reason) => ListTile(
                  leading:
                      const Icon(Icons.flag_outlined, color: Color(0xFFFBBF24)),
                  title:
                      Text(reason, style: const TextStyle(color: Colors.white)),
                  onTap: () async {
                    Navigator.pop(ctx);
                    try {
                      await ApiService.reportUser(player.id, reason);
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Report submitted. Thank you.'),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Failed to report: $e'),
                            backgroundColor: Colors.red,
                          ),
                        );
                      }
                    }
                  },
                )),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _showBlockUserDialog(User player) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Block User'),
        content: Text(
            'Are you sure you want to block ${player.name}? You will no longer see their content.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ApiService.blockUser(player.id);
                if (mounted) {
                  Navigator.pop(context); // Close profile sheet
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('${player.name} has been blocked.'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Failed to block: $e'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text('Block',
                style:
                    TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

/// The header hero: the player's flat avatar (their own if customized, else
/// their deterministic default) over a soft brand glow, with the photo as a
/// small corner badge — same doctrine as the map and profile setup: the
/// avatar is the main thing, the photo is optional.
class _AvatarHero extends StatelessWidget {
  final User player;

  const _AvatarHero({required this.player});

  @override
  Widget build(BuildContext context) {
    final avatarSvg =
        flatAvatarSvg(player.avatarConfig) ?? defaultAvatarSvgForId(player.id);
    return SizedBox(
      width: 104,
      height: 126,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  _brandOrange.withValues(alpha: 0.22),
                  _brandOrange.withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
          SvgPicture.string(
            avatarSvg,
            width: 96,
            height: 122,
            fit: BoxFit.contain,
          ),
          if (player.photoUrl != null)
            Positioned(
              right: -2,
              bottom: 4,
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: _brandOrange, width: 2),
                  image: DecorationImage(
                    image: safeImageProvider(player.photoUrl!),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

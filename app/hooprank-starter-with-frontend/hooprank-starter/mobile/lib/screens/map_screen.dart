import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../widgets/court_map_widget.dart';
import '../widgets/player_profile_sheet.dart';
import '../services/messages_service.dart';
import '../state/app_state.dart';
import '../state/check_in_state.dart';
import 'package:url_launcher/url_launcher.dart';

/// Static helper to show court details sheet from any screen
class CourtDetailsSheet {
  static void show(BuildContext context, Court court) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CourtDetailsContent(court: court),
    );
  }
}

/// Content widget for the court details sheet
class _CourtDetailsContent extends StatelessWidget {
  final Court court;
  
  const _CourtDetailsContent({required this.court});
  
  @override
  Widget build(BuildContext context) {
    return Consumer2<CheckInState, AuthState>(
      builder: (context, checkInState, authState, _) {
        final checkInCount = checkInState.getCheckInCount(court.id);
        final isCheckedIn = checkInState.isUserCheckedIn(court.id);

        
        return Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle bar
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey[600],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              // Court name with basketball icon and follow button
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.deepOrange.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.sports_basketball, color: Colors.deepOrange, size: 28),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          court.name,
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        if (court.address != null)
                          Text(
                            court.address!,
                            style: TextStyle(fontSize: 14, color: Colors.grey[400]),
                          ),
                      ],
                    ),
                  ),
                  // Follow button (heart)
                  IconButton(
                    onPressed: () async {
                      final isFollowing = checkInState.isFollowing(court.id);
                      if (isFollowing) {
                        await checkInState.unfollowCourt(court.id);
                      } else {
                        await checkInState.followCourt(court.id);
                      }
                    },
                    icon: Icon(
                      checkInState.isFollowing(court.id) ? Icons.favorite : Icons.favorite_border,
                      color: checkInState.isFollowing(court.id) ? Colors.red : Colors.grey[400],
                      size: 28,
                    ),
                    tooltip: checkInState.isFollowing(court.id) ? 'Unfollow' : 'Follow',
                  ),
                  // Alert bell (push notifications)
                  IconButton(
                    onPressed: () async {
                      await checkInState.toggleAlert(court.id);
                      if (checkInState.isAlertEnabled(court.id)) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('🔔 You\'ll be notified when players check in at ${court.name}'),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      }
                    },
                    icon: Icon(
                      checkInState.isAlertEnabled(court.id) ? Icons.notifications_active : Icons.notifications_none,
                      color: checkInState.isAlertEnabled(court.id) ? Colors.orange : Colors.grey[400],
                      size: 26,
                    ),
                    tooltip: checkInState.isAlertEnabled(court.id) ? 'Disable alerts' : 'Get alerts',
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Kings section (simplified)
              if (court.hasKings) ...[
                const Text(
                  '👑 Kings of the Court',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.amber),
                ),
                const SizedBox(height: 10),
                if (court.king1v1 != null)
                  _buildKingRow('1v1', court.king1v1!, court.king1v1Rating ?? 0, Colors.orange),
                if (court.king3v3 != null)
                  _buildKingRow('3v3', court.king3v3!, court.king3v3Rating ?? 0, Colors.green),
                if (court.king5v5 != null)
                  _buildKingRow('5v5', court.king5v5!, court.king5v5Rating ?? 0, Colors.blue),
                const SizedBox(height: 16),
              ],
              // Check-in status
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.green.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(isCheckedIn ? Icons.check_circle : Icons.location_on,
                        color: Colors.green, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      isCheckedIn ? 'You play here!' : 'Check in to play',
                      style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w500),
                    ),
                    const Spacer(),
                    Text(
                      '$checkInCount players',
                      style: TextStyle(color: Colors.grey[400], fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: isCheckedIn
                        ? ElevatedButton.icon(
                            onPressed: () async {
                              await checkInState.checkOut(court.id);
                            },
                            icon: const Icon(Icons.check_circle),
                            label: const Text('Checked In'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          )
                        : OutlinedButton.icon(
                            onPressed: () async {
                              final user = authState.currentUser;
                              if (user != null) {
                                await checkInState.checkIn(
                                  court.id,
                                  userName: user.name,
                                  userRating: user.rating,
                                  userPhotoUrl: user.photoUrl,
                                );
                              }
                            },
                            icon: const Icon(Icons.add_location_alt),
                            label: const Text('Check In'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: BorderSide(color: Colors.grey[600]!),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        context.go('/courts?courtId=${court.id}');
                      },
                      icon: const Icon(Icons.map),
                      label: const Text('View on Map'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.blue,
                        side: const BorderSide(color: Colors.blue),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
  
  Widget _buildKingRow(String mode, String name, double rating, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withOpacity(0.2), color.withOpacity(0.05)],
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(mode, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 10),
          const Text('👑', style: TextStyle(fontSize: 16)),
          const SizedBox(width: 6),
          Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
          const Spacer(),
          Text('⭐ ${rating.toStringAsFixed(2)}', style: TextStyle(color: Colors.grey[400], fontSize: 13)),
        ],
      ),
    );
  }
}

class MapScreen extends StatefulWidget {
  final String? initialCourtId;
  final double? initialLat;
  final double? initialLng;
  final String? initialCourtName;

  const MapScreen({
    super.key, 
    this.initialCourtId,
    this.initialLat,
    this.initialLng,
    this.initialCourtName,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  void _showCourtDetails(Court court) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Court name with basketball icon and follow button
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.deepOrange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.sports_basketball, color: Colors.deepOrange, size: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        court.name,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      if (court.address != null)
                        Text(
                          court.address!,
                          style: TextStyle(fontSize: 14, color: Colors.grey[400]),
                        ),
                    ],
                  ),
                ),
                // Follow button (heart) and Alert bell
                Consumer<CheckInState>(
                  builder: (context, checkInState, _) {
                    final isFollowing = checkInState.isFollowing(court.id);
                    final hasAlert = checkInState.isAlertEnabled(court.id);
                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Heart for follow
                        IconButton(
                          onPressed: () async {
                            if (isFollowing) {
                              await checkInState.unfollowCourt(court.id);
                            } else {
                              await checkInState.followCourt(court.id);
                            }
                          },
                          icon: Icon(
                            isFollowing ? Icons.favorite : Icons.favorite_border,
                            color: isFollowing ? Colors.red : Colors.grey[400],
                            size: 28,
                          ),
                          tooltip: isFollowing ? 'Unfollow' : 'Follow',
                        ),
                        // Bell for alerts
                        IconButton(
                          onPressed: () async {
                            await checkInState.toggleAlert(court.id);
                            if (checkInState.isAlertEnabled(court.id)) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('🔔 You\'ll be notified when players check in at ${court.name}'),
                                  duration: const Duration(seconds: 2),
                                ),
                              );
                            }
                          },
                          icon: Icon(
                            hasAlert ? Icons.notifications_active : Icons.notifications_none,
                            color: hasAlert ? Colors.orange : Colors.grey[400],
                            size: 26,
                          ),
                          tooltip: hasAlert ? 'Disable alerts' : 'Get alerts',
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Kings section
            if (court.hasKings) ...[
              const Text(
                '👑 Kings of the Court',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.amber,
                ),
              ),
              const SizedBox(height: 12),
              // Mode Kings row
              Row(
                children: [
                  if (court.king1v1 != null)
                    Expanded(child: _buildKingCard('1v1', court.king1v1!, court.king1v1Id, court.king1v1Rating, Colors.deepOrange)),
                  if (court.king1v1 != null && (court.king3v3 != null || court.king5v5 != null))
                    const SizedBox(width: 8),
                  if (court.king3v3 != null)
                    Expanded(child: _buildKingCard('3v3', court.king3v3!, court.king3v3Id, court.king3v3Rating, Colors.blue)),
                  if (court.king3v3 != null && court.king5v5 != null)
                    const SizedBox(width: 8),
                  if (court.king5v5 != null)
                    Expanded(child: _buildKingCard('5v5', court.king5v5!, court.king5v5Id, court.king5v5Rating, Colors.purple)),
                ],
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey[800]?.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[700]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.emoji_events_outlined, color: Colors.grey[500], size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'No Kings yet! Play here to claim the throne.',
                        style: TextStyle(color: Colors.grey[400], fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            // Check-in section
            Consumer2<CheckInState, AuthState>(
              builder: (context, checkInState, authState, _) {
                final isCheckedIn = checkInState.isUserCheckedIn(court.id);
                final checkInCount = checkInState.getCheckInCount(court.id);
                
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isCheckedIn 
                        ? Colors.green.withOpacity(0.15)
                        : Colors.grey[800]?.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isCheckedIn ? Colors.green : Colors.grey[700]!,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isCheckedIn ? Icons.check_circle : Icons.location_on,
                            color: isCheckedIn ? Colors.green : Colors.grey[400],
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isCheckedIn ? 'You play here!' : 'Check in to show interest',
                            style: TextStyle(
                              color: isCheckedIn ? Colors.green : Colors.grey[300],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const Spacer(),
                          if (checkInCount > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.green.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '$checkInCount player${checkInCount > 1 ? 's' : ''}',
                                style: const TextStyle(
                                  color: Colors.green,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: isCheckedIn
                                ? ElevatedButton.icon(
                                    onPressed: () async {
                                      await checkInState.checkOut(court.id);
                                    },
                                    icon: const Icon(Icons.check_circle),
                                    label: const Text('Checked In'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.green,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  )
                                : OutlinedButton.icon(
                                    onPressed: () async {
                                      final user = authState.currentUser;
                                      if (user != null) {
                                        await checkInState.checkIn(
                                          court.id,
                                          userName: user.name,
                                          userRating: user.rating,
                                          userPhotoUrl: user.photoUrl,
                                        );
                                      }
                                    },
                                    icon: const Icon(Icons.add_location_alt),
                                    label: const Text('Check In'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.white,
                                      side: BorderSide(color: Colors.grey[600]!),
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: checkInCount > 0
                                  ? () {
                                      Navigator.pop(context);
                                      _showCheckedInPlayersSheet(court);
                                    }
                                  : null,
                              icon: const Icon(Icons.people),
                              label: const Text('View Players'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.green,
                                side: BorderSide(
                                  color: checkInCount > 0 
                                      ? Colors.green 
                                      : Colors.grey[600]!,
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 16),
            
            // Get Directions section
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      // Apple Maps URL scheme
                      final appleUrl = Uri.parse(
                        'https://maps.apple.com/?daddr=${court.lat},${court.lng}&dirflg=d'
                      );
                      debugPrint('Launching Apple Maps: $appleUrl');
                      try {
                        final launched = await launchUrl(
                          appleUrl, 
                          mode: LaunchMode.externalApplication,
                        );
                        if (!launched && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Could not open Apple Maps')),
                          );
                        }
                      } catch (e) {
                        debugPrint('Error launching Apple Maps: $e');
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Error: $e')),
                          );
                        }
                      }
                    },
                    icon: const Icon(Icons.apple, size: 20),
                    label: const Text('Apple Maps'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(color: Colors.grey[600]!),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      // Google Maps URL - use universal link that works on web too
                      final googleUrl = Uri.parse(
                        'https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lng}&travelmode=driving'
                      );
                      debugPrint('Launching Google Maps: $googleUrl');
                      try {
                        final launched = await launchUrl(
                          googleUrl, 
                          mode: LaunchMode.externalApplication,
                        );
                        if (!launched && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Could not open Google Maps')),
                          );
                        }
                      } catch (e) {
                        debugPrint('Error launching Google Maps: $e');
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Error: $e')),
                          );
                        }
                      }
                    },
                    icon: const Icon(Icons.map, size: 20),
                    label: const Text('Google Maps'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.blue,
                      side: const BorderSide(color: Colors.blue),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showCheckedInPlayersSheet(Court court) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Consumer<CheckInState>(
        builder: (context, checkInState, _) {
          final players = checkInState.getCheckedInPlayers(court.id);
          
          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.7,
            ),
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle bar
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.grey[600],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Header
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      const Icon(Icons.people, color: Colors.green, size: 24),
                      const SizedBox(width: 10),
                      Text(
                        'Players at ${court.name}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Text(
                    '${players.length} player${players.length == 1 ? '' : 's'} checked in • Sorted by rating',
                    style: TextStyle(color: Colors.grey[400], fontSize: 13),
                  ),
                ),
                const Divider(),
                // Player list
                Flexible(
                  child: players.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(40),
                            child: Text(
                              'No players have checked in yet.',
                              style: TextStyle(color: Colors.grey[500]),
                            ),
                          ),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: players.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final player = players[index];
                            final isTopPlayer = index == 0;
                            
                            return Container(
                              decoration: BoxDecoration(
                                color: isTopPlayer ? Colors.green.withOpacity(0.05) : Colors.grey[900],
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isTopPlayer ? Colors.green.withOpacity(0.3) : Colors.white.withOpacity(0.05)
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.2),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () {
                                    Navigator.pop(context);
                                    PlayerProfileSheet.showById(context, player.id);
                                  },
                                  borderRadius: BorderRadius.circular(16),
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Row(
                                      children: [
                                        // Rank badge
                                        Container(
                                          width: 32,
                                          height: 32,
                                          decoration: BoxDecoration(
                                            color: isTopPlayer 
                                                ? Colors.green.withOpacity(0.2) 
                                                : Colors.white.withOpacity(0.05),
                                            shape: BoxShape.circle,
                                            border: isTopPlayer ? Border.all(color: Colors.green.withOpacity(0.5)) : null,
                                          ),
                                          child: Center(
                                            child: Text(
                                              '${index + 1}',
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12,
                                                color: isTopPlayer ? Colors.green : Colors.white54,
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        // Avatar
                                        CircleAvatar(
                                          radius: 22,
                                          backgroundImage: player.photoUrl != null
                                              ? NetworkImage(player.photoUrl!)
                                              : null,
                                          backgroundColor: Colors.blue.withOpacity(0.2),
                                          child: player.photoUrl == null
                                              ? Text(
                                                  player.name.isNotEmpty 
                                                      ? player.name[0].toUpperCase() 
                                                      : '?',
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 16,
                                                    color: Colors.blue,
                                                  ),
                                                )
                                              : null,
                                        ),
                                        const SizedBox(width: 12),
                                        // Name and check-in time
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                player.name,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 16,
                                                  color: Colors.white,
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                'Checked in ${player.checkedInAgo}',
                                                style: const TextStyle(
                                                  color: Colors.white30,
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        // Rating
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 6,
                                          ),
                                          decoration: BoxDecoration(
                                            color: Colors.amber.withOpacity(0.1),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: Colors.amber.withOpacity(0.2)),
                                          ),
                                          child: Text(
                                            player.rating.toStringAsFixed(1),
                                            style: const TextStyle(
                                              color: Colors.amber,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        const Icon(
                                          Icons.chevron_right,
                                          color: Colors.white30,
                                          size: 20,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showChallengeKingSheet(Court court) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Text(
              '👑 Challenge a King',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Choose which King you want to challenge at ${court.name}',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            const SizedBox(height: 16),
            if (court.king1v1 != null)
              _buildChallengeOption(
                mode: '1v1',
                kingName: court.king1v1!,
                kingId: court.king1v1Id,
                rating: court.king1v1Rating,
                color: Colors.deepOrange,
                onChallenge: () {
                  Navigator.pop(context);
                  _showChallengeMessageDialog(court.king1v1!, court.king1v1Id, '1v1', court);
                },
              ),
            if (court.king3v3 != null) ...[
              const SizedBox(height: 10),
              _buildChallengeOption(
                mode: '3v3',
                kingName: court.king3v3!,
                kingId: court.king3v3Id,
                rating: court.king3v3Rating,
                color: Colors.blue,
                onChallenge: () {
                  Navigator.pop(context);
                  _showChallengeMessageDialog(court.king3v3!, court.king3v3Id, '3v3', court);
                },
              ),
            ],
            if (court.king5v5 != null) ...[
              const SizedBox(height: 10),
              _buildChallengeOption(
                mode: '5v5',
                kingName: court.king5v5!,
                kingId: court.king5v5Id,
                rating: court.king5v5Rating,
                color: Colors.purple,
                onChallenge: () {
                  Navigator.pop(context);
                  _showChallengeMessageDialog(court.king5v5!, court.king5v5Id, '5v5', court);
                },
              ),
            ],
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildChallengeOption({
    required String mode,
    required String kingName,
    required String? kingId,
    required double? rating,
    required Color color,
    required VoidCallback onChallenge,
  }) {
    return Material(
      color: color.withOpacity(0.15),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                mode,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ),
            const SizedBox(width: 14),
            const Text('👑', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    kingName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  if (rating != null)
                    Text(
                      '⭐ ${rating.toStringAsFixed(2)}',
                      style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                    ),
                ],
              ),
            ),
            // View Profile button
            if (kingId != null)
              IconButton(
                onPressed: () {
                  Navigator.pop(context);
                  PlayerProfileSheet.showById(context, kingId);
                },
                icon: Icon(Icons.person, color: Colors.grey[400], size: 24),
                tooltip: 'View Profile',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            const SizedBox(width: 8),
            // Challenge button
            IconButton(
              onPressed: onChallenge,
              icon: Icon(Icons.sports_basketball, color: color, size: 28),
              tooltip: 'Challenge',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
      ),
    );
  }

  void _showChallengeMessageDialog(String kingName, String? kingId, String mode, Court court) {
    final messageController = TextEditingController(
      text: 'I want to challenge you for the $mode crown at ${court.name}!',
    );
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Text('👑 ', style: TextStyle(fontSize: 24)),
            Expanded(
              child: Text(
                'Challenge $kingName',
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Send a message with your $mode challenge:',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: messageController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Add a message to your challenge...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                filled: true,
                fillColor: Colors.grey[900],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _initiateKingChallenge(
                kingName,
                kingId,
                mode,
                court,
                customMessage: messageController.text,
              );
            },
            icon: const Icon(Icons.sports_basketball, size: 18),
            label: const Text('Send Challenge'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _initiateKingChallenge(String kingName, String? kingId, String mode, Court court, {String? customMessage}) async {
    if (kingId == null) {
      // No user ID - show a message that this King can't be challenged yet
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$kingName at ${court.name} cannot be challenged yet'),
          duration: const Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Get current user ID
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please log in to send challenges')),
      );
      return;
    }

    // Don't allow user to challenge themselves
    if (userId == kingId) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You are the King! Find a challenger.')),
      );
      return;
    }

    // Send the real challenge
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Sending $mode challenge to $kingName...'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );

    try {
      final messagesService = MessagesService();
      final message = customMessage ?? 'I want to challenge you for the $mode crown at ${court.name}!';
      await messagesService.sendChallenge(
        userId,
        kingId,
        message,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Challenge sent to $kingName! 🏀'),
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to send challenge: $e'),
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Widget _buildKingCard(String mode, String name, String? kingId, double? rating, Color color) {
    return InkWell(
      onTap: () {
        if (kingId != null) {
          _showKingActionSheet(name, kingId, mode);
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [color.withOpacity(0.3), color.withOpacity(0.1)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.5)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                mode,
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 6),
            const Text('👑', style: TextStyle(fontSize: 20)),
            const SizedBox(height: 4),
            Text(
              name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (rating != null) ...[
              const SizedBox(height: 2),
              Text(
                '⭐ ${rating.toStringAsFixed(2)}',
                style: TextStyle(fontSize: 11, color: Colors.grey[400]),
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  void _showKingActionSheet(String name, String kingId, String mode) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.grey[600],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text(
              '👑 $name',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              '$mode King',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  PlayerProfileSheet.showById(context, kingId);
                },
                icon: const Icon(Icons.person),
                label: const Text('View Profile'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[700],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  // Navigate to challenge the king
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Challenge $name to a $mode match!'),
                      action: SnackBarAction(
                        label: 'Send Challenge',
                        onPressed: () {
                          // Send the challenge
                        },
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.sports_basketball),
                label: const Text('Challenge'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Use widget's initialCourtId if provided, otherwise fall back to query params
    final courtId = widget.initialCourtId ?? 
        GoRouterState.of(context).uri.queryParameters['courtId'];
    
    return Scaffold(
      body: CourtMapWidget(
        onCourtSelected: _showCourtDetails,
        initialCourtId: courtId,
        initialLat: widget.initialLat,
        initialLng: widget.initialLng,
        initialCourtName: widget.initialCourtName,
      ),
    );
  }
}

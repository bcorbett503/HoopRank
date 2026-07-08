import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/court_service.dart';
import '../services/location_service.dart';
import '../services/messages_service.dart';
import '../services/notification_service.dart';
import '../state/app_state.dart';
import '../utils/scheduled_run_share.dart';
import 'status_composer_screen.dart';
import '../widgets/calendar_event_card.dart';

typedef CalendarEventsLoader = Future<List<CalendarEvent>> Function({
  required String scope,
  required DateTime start,
  required DateTime end,
  double? lat,
  double? lng,
});

typedef CalendarPlayersLoader = Future<List<User>> Function();
typedef CalendarFollowsLoader = Future<Map<String, dynamic>> Function();
typedef CalendarLocationLoader = Future<Position?> Function();

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({
    super.key,
    this.eventsLoader,
    this.playersLoader,
    this.followsLoader,
    this.locationLoader,
    this.nowProvider,
  });

  final CalendarEventsLoader? eventsLoader;
  final CalendarPlayersLoader? playersLoader;
  final CalendarFollowsLoader? followsLoader;
  final CalendarLocationLoader? locationLoader;
  final DateTime Function()? nowProvider;

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen>
    with WidgetsBindingObserver {
  static const _horizonDays = 42;

  MessagesService? _messagesServiceInstance;
  NotificationService? _notificationServiceInstance;
  Timer? _clockTimer;
  String _scope = 'for_you';
  late DateTime _now;
  late DateTime _selectedDay;
  late DateTime _weekStart;
  double? _lat;
  double? _lng;
  bool _isLoading = true;
  String? _error;
  final Set<String> _pendingRunAttendanceKeys = <String>{};
  final Map<String, List<CalendarEvent>> _eventsByScope = {
    'for_you': const [],
    'mine': const [],
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _now = _readNow();
    final today = _startOfDay(_now);
    _selectedDay = today;
    _weekStart = today;
    _startClockTicker();
    _bootstrap();
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startClockTicker();
      _syncCalendarClock();
      unawaited(_refreshLocationAndEvents(showLoading: false));
      return;
    }

    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _clockTimer?.cancel();
    }
  }

  DateTime _readNow() =>
      (widget.nowProvider?.call() ?? DateTime.now()).toLocal();

  void _startClockTicker() {
    _clockTimer?.cancel();
    final now = _readNow();
    final nextMinute = DateTime(
      now.year,
      now.month,
      now.day,
      now.hour,
      now.minute,
    ).add(const Duration(minutes: 1));
    _clockTimer = Timer(nextMinute.difference(now), () {
      _syncCalendarClock();
      _clockTimer = Timer.periodic(
        const Duration(minutes: 1),
        (_) => _syncCalendarClock(),
      );
    });
  }

  void _syncCalendarClock() {
    final nextNow = _readNow();
    final previousDay = _startOfDay(_now);
    final nextDay = _startOfDay(nextNow);
    final dayChanged = !_sameDay(previousDay, nextDay);

    if (!mounted) {
      return;
    }

    setState(() {
      _now = nextNow;
      if (dayChanged) {
        _selectedDay = nextDay;
        _weekStart = nextDay;
      }
    });
  }

  DateTime get _horizonStart => _startOfDay(_now);

  DateTime get _horizonEnd =>
      _horizonStart.add(const Duration(days: _horizonDays - 1));

  MessagesService get _messagesService =>
      _messagesServiceInstance ??= MessagesService();

  NotificationService get _notificationService =>
      _notificationServiceInstance ??= NotificationService();

  Future<void> _bootstrap() async {
    await _refreshLocationAndEvents();
  }

  Future<void> _refreshLocationAndEvents({bool showLoading = true}) async {
    await _loadLocation();
    await _refreshAll(showLoading: showLoading);
  }

  Future<void> _loadLocation() async {
    try {
      final position =
          await (widget.locationLoader ?? LocationService.getCurrentLocation)();
      if (!mounted || position == null) return;
      setState(() {
        _lat = position.latitude;
        _lng = position.longitude;
      });
    } catch (_) {
      // Discovery gracefully falls back without location.
    }
  }

  Future<void> _refreshAll({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }

    try {
      final results = await Future.wait([
        _loadScopeEvents('for_you'),
        _loadScopeEvents('mine'),
      ]);
      if (!mounted) return;

      setState(() {
        _eventsByScope['for_you'] = results[0];
        _eventsByScope['mine'] = results[1];
        if (showLoading) {
          _isLoading = false;
        }
      });
      await _syncMineReminders(results[1]);
    } catch (e) {
      if (!mounted) return;
      if (!showLoading) {
        debugPrint('Calendar background refresh failed: $e');
        return;
      }
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<List<CalendarEvent>> _loadScopeEvents(String scope) {
    final loader = widget.eventsLoader ??
        ({
          required String scope,
          required DateTime start,
          required DateTime end,
          double? lat,
          double? lng,
        }) {
          return ApiService.getCalendarEvents(
            scope: scope,
            start: start,
            end: end,
            lat: lat,
            lng: lng,
          );
        };

    return loader(
      scope: scope,
      start: _horizonStart,
      end: _horizonEnd.add(const Duration(hours: 23, minutes: 59)),
      lat: _lat,
      lng: _lng,
    ).then(_sanitizeCalendarEvents).catchError((_) async {
      final fallbackEvents = await _loadScopeEventsFromExistingData(
        scope: scope,
        start: _horizonStart,
        end: _horizonEnd.add(const Duration(hours: 23, minutes: 59)),
      );
      return _sanitizeCalendarEvents(fallbackEvents);
    });
  }

  List<CalendarEvent> _sanitizeCalendarEvents(List<CalendarEvent> events) {
    return events.where(_shouldKeepCalendarEvent).toList();
  }

  bool _shouldKeepCalendarEvent(CalendarEvent event) {
    if (!event.isRun) {
      return true;
    }

    final courtId = event.court.id?.trim() ?? '';
    final courtName = event.court.name?.trim() ?? '';
    return courtId.isNotEmpty && courtName.isNotEmpty;
  }

  Future<List<CalendarEvent>> _loadScopeEventsFromExistingData({
    required String scope,
    required DateTime start,
    required DateTime end,
  }) async {
    final userId =
        context.read<AuthState>().currentUser?.id ?? ApiService.userId;
    final currentUser = context.read<AuthState>().currentUser;
    final feed = await ApiService.getUnifiedFeed(
      filter: 'foryou',
      lat: _lat,
      lng: _lng,
    );

    final events = <CalendarEvent>[
      ..._mapFeedItemsToCalendarEvents(
        feed,
        scope: scope,
        userId: userId,
        start: start,
        end: end,
      ),
    ];

    if (scope == 'mine' && userId != null && userId.isNotEmpty) {
      try {
        final challenges = await _messagesService.getPendingChallenges(userId);
        events.addAll(
          _mapChallengesToCalendarEvents(
            challenges,
            userId: userId,
            currentUser: currentUser,
            start: start,
            end: end,
          ),
        );
      } catch (_) {
        // Leave fallback with whatever feed-backed runs we were able to load.
      }
    }

    final deduped = <String, CalendarEvent>{};
    for (final event in events) {
      deduped[event.id] = event;
    }

    return deduped.values.toList()
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
  }

  Future<void> _syncMineReminders(List<CalendarEvent> events) async {
    for (final event in events.where((e) => e.isConfirmedByMe)) {
      await _notificationService.scheduleCalendarReminderForEvent(event);
    }
  }

  bool _isCurrentDayEventStillUpcoming(CalendarEvent event) {
    final local = event.scheduledAt.toLocal();
    return !_sameDay(local, _now) || !local.isBefore(_now);
  }

  List<CalendarEvent> get _visibleEvents {
    return (_eventsByScope[_scope] ?? const [])
        .where((event) => _sameDay(event.scheduledAt.toLocal(), _selectedDay))
        .where(_isCurrentDayEventStillUpcoming)
        .toList()
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
  }

  List<_CalendarEventSlot> get _visibleEventSlots {
    final grouped = <String, List<CalendarEvent>>{};

    for (final event in _visibleEvents) {
      final local = event.scheduledAt.toLocal();
      final key =
          '${local.year}-${local.month}-${local.day}-${local.hour}-${local.minute}';
      grouped.putIfAbsent(key, () => <CalendarEvent>[]).add(event);
    }

    final slots = grouped.entries.map((entry) {
      final events = [...entry.value]..sort((a, b) {
          if (a.isConfirmedByMe != b.isConfirmedByMe) {
            return a.isConfirmedByMe ? -1 : 1;
          }
          final distanceA = a.distanceMiles ?? double.infinity;
          final distanceB = b.distanceMiles ?? double.infinity;
          if (distanceA != distanceB) {
            return distanceA.compareTo(distanceB);
          }
          return a.title.compareTo(b.title);
        });
      return _CalendarEventSlot(
        scheduledAt: events.first.scheduledAt,
        events: events,
      );
    }).toList()
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

    return slots;
  }

  Map<String, int> get _visibleWindowEventCounts {
    final counts = <String, int>{};
    final windowEnd = _weekStart.add(const Duration(days: 6));

    for (final event in _eventsByScope[_scope] ?? const <CalendarEvent>[]) {
      final localDay = _startOfDay(event.scheduledAt.toLocal());
      if (localDay.isBefore(_weekStart) || localDay.isAfter(windowEnd)) {
        continue;
      }
      if (!_isCurrentDayEventStillUpcoming(event)) {
        continue;
      }
      final key = _dayKey(localDay);
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return counts;
  }

  bool get _canGoBackWeek => _weekStart.isAfter(_horizonStart);

  bool get _canGoForwardWeek {
    final nextWeek = _weekStart.add(const Duration(days: 7));
    return !nextWeek.isAfter(_horizonEnd);
  }

  String _runAttendanceKey(CalendarEvent event) {
    final run = event.run;
    if (run == null) return event.id;
    final runId = run.runId.trim();
    if (runId.isNotEmpty) {
      return 'run:$runId';
    }
    if (run.statusId != null) {
      return 'status:${run.statusId}';
    }
    return event.id;
  }

  Future<void> _toggleRunAttendance(CalendarEvent event) async {
    if (!event.isRun || event.isOwnedByMe) return;
    if (!event.isConfirmedByMe && event.run!.isFull) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This run is full right now.')),
      );
      return;
    }
    final pendingKey = _runAttendanceKey(event);
    if (_pendingRunAttendanceKeys.contains(pendingKey)) return;

    setState(() => _pendingRunAttendanceKeys.add(pendingKey));
    final runId = event.run!.runId.trim();
    final statusId = event.run!.statusId;
    final wasIn = event.isConfirmedByMe;
    try {
      final success = runId.isNotEmpty
          ? wasIn
              ? await ApiService.leaveRun(runId)
              : await ApiService.joinRun(runId)
          : statusId != null
              ? wasIn
                  ? await ApiService.removeAttending(statusId)
                  : await ApiService.markAttending(statusId)
              : false;

      if (!mounted) return;

      if (!success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(wasIn ? 'Could not leave run' : 'Could not join run'),
          ),
        );
        return;
      }

      if (wasIn) {
        await _notificationService.cancelCalendarReminder(event.reminderKey);
      } else {
        await _notificationService.scheduleCalendarReminderForEvent(
          event.copyWith(isConfirmedByMe: true),
        );
      }

      _applyRunAttendanceLocally(event, isConfirmed: !wasIn);
      unawaited(_refreshAll(showLoading: false));
    } finally {
      if (mounted) {
        setState(() => _pendingRunAttendanceKeys.remove(pendingKey));
      }
    }
  }

  void _applyRunAttendanceLocally(
    CalendarEvent sourceEvent, {
    required bool isConfirmed,
  }) {
    setState(() {
      for (final scope in _eventsByScope.keys) {
        final updated = <CalendarEvent>[];
        for (final event in _eventsByScope[scope] ?? const <CalendarEvent>[]) {
          if (!_isSameRunEvent(event, sourceEvent)) {
            updated.add(event);
            continue;
          }

          final nextCount =
              (event.run!.attendeeCount + (isConfirmed ? 1 : -1)).clamp(0, 999);
          final updatedEvent = event.copyWith(
            isConfirmedByMe: isConfirmed,
            run: event.run!.copyWith(attendeeCount: nextCount),
          );

          if (scope == 'mine' && !isConfirmed && !event.isOwnedByMe) {
            continue;
          }
          updated.add(updatedEvent);
        }

        if (scope == 'mine' && isConfirmed) {
          final sourceEvents = _eventsByScope['for_you'] ?? const [];
          for (final source in sourceEvents) {
            if (_isSameRunEvent(source, sourceEvent)) {
              final exists = updated.any((event) => event.id == source.id);
              if (!exists) {
                updated.add(source.copyWith(
                  isConfirmedByMe: true,
                  run: source.run!.copyWith(
                    attendeeCount: source.run!.attendeeCount + 1,
                  ),
                ));
              }
            }
          }
        }

        _eventsByScope[scope] = updated;
      }
    });
  }

  Future<void> _cancelScheduledMatch(CalendarEvent event) async {
    if (!event.isScheduledMatch) return;
    final challengeId = event.scheduledMatch!.challengeId;
    final userId = context.read<AuthState>().currentUser?.id;
    if (userId == null) return;

    await _messagesService.cancelChallenge(userId, challengeId);
    await _notificationService.cancelCalendarReminder(event.reminderKey);
    _removeEventLocally(event.id);
    unawaited(_refreshAll(showLoading: false));
  }

  Future<void> _declineScheduledMatch(CalendarEvent event) async {
    if (!event.isScheduledMatch) return;
    final challengeId = event.scheduledMatch!.challengeId;
    final userId = context.read<AuthState>().currentUser?.id;
    if (userId == null) return;

    await _messagesService.declineChallenge(userId, challengeId);
    await _notificationService.cancelCalendarReminder(event.reminderKey);
    _removeEventLocally(event.id);
    unawaited(_refreshAll(showLoading: false));
  }

  void _removeEventLocally(String eventId) {
    setState(() {
      for (final scope in _eventsByScope.keys) {
        _eventsByScope[scope] = (_eventsByScope[scope] ?? const [])
            .where((event) => event.id != eventId)
            .toList();
      }
    });
  }

  bool _isSameRunEvent(CalendarEvent candidate, CalendarEvent source) {
    if (!candidate.isRun || !source.isRun) return false;

    final candidateRun = candidate.run!;
    final sourceRun = source.run!;

    final candidateRunId = candidateRun.runId.trim();
    final sourceRunId = sourceRun.runId.trim();
    if (candidateRunId.isNotEmpty &&
        sourceRunId.isNotEmpty &&
        candidateRunId == sourceRunId) {
      return true;
    }

    if (candidateRun.statusId != null &&
        sourceRun.statusId != null &&
        candidateRun.statusId == sourceRun.statusId) {
      return true;
    }

    return candidate.id == source.id;
  }

  List<CalendarEvent> _mapFeedItemsToCalendarEvents(
    List<Map<String, dynamic>> feed, {
    required String scope,
    required String? userId,
    required DateTime start,
    required DateTime end,
  }) {
    return feed.where((item) {
      final scheduledAt = _parseCalendarDate(item['scheduledAt']);
      if (scheduledAt == null) return false;
      if (scheduledAt.isBefore(start) || scheduledAt.isAfter(end)) {
        return false;
      }

      final type = item['type']?.toString() ?? '';
      if (type == 'recommended_court' || type == 'suggested_matchup') {
        return false;
      }

      if (scope != 'mine') {
        return true;
      }

      final itemUserId = item['userId']?.toString() ?? '';
      final isAttending =
          item['isAttendingByMe'] == true || item['isAttendingByMe'] == 1;
      return userId != null && userId.isNotEmpty
          ? itemUserId == userId || isAttending
          : isAttending;
    }).map((item) {
      final scheduledAt = _parseCalendarDate(item['scheduledAt'])!;
      final statusId = _parseNullableInt(item['statusId']);
      final itemUserId = item['userId']?.toString() ?? '';
      final itemUserName = item['userName']?.toString() ?? 'Unknown';
      final itemUserPhoto = _firstNonEmptyText([
        item['userPhotoUrl'],
        item['user_photo_url'],
      ]);
      final courtName = _firstNonEmptyText([item['courtName']]);
      final gameMode = _firstNonEmptyText([item['gameMode']]) ?? 'Run';
      final title = _firstNonEmptyText([
            item['content'],
            item['title'],
          ]) ??
          '$gameMode at ${courtName ?? 'Court'}';
      final attendeeCount = _parseNullableInt(item['attendeeCount']) ?? 0;
      final attendeePreview = _parseRunAttendeePreview(
        item['attendeePreview'] ?? item['attendees'],
      );
      final distanceMiles = _parseNullableDouble(
        item['distanceMiles'] ?? item['distance_miles'],
      );
      final isConfirmedByMe =
          item['isAttendingByMe'] == true || item['isAttendingByMe'] == 1;
      final isOwnedByMe = userId != null && itemUserId == userId;

      return CalendarEvent(
        id: 'fallback_run:${statusId ?? item['id']?.toString() ?? title}',
        type: 'run',
        scheduledAt: scheduledAt,
        title: title,
        distanceMiles: distanceMiles,
        isConfirmedByMe: isConfirmedByMe || isOwnedByMe,
        isOwnedByMe: isOwnedByMe,
        court: CalendarCourtInfo(
          id: item['courtId']?.toString(),
          name: courtName,
          lat: _parseNullableDouble(item['courtLat']),
          lng: _parseNullableDouble(item['courtLng']),
        ),
        run: CalendarRunDetails(
          runId: '',
          statusId: statusId,
          gameMode: gameMode,
          courtType: _firstNonEmptyText([item['courtType']]),
          ageRange: _firstNonEmptyText([item['ageRange']]),
          durationMinutes: 120,
          maxPlayers: 15,
          attendeeCount: attendeeCount,
          isRecurring: false,
          notes: null,
          creator: CalendarParticipantInfo(
            id: itemUserId,
            name: itemUserName,
            photoUrl: itemUserPhoto,
          ),
          attendeePreview: attendeePreview,
          occurrenceKey: scheduledAt.toUtc().toIso8601String(),
        ),
      );
    }).toList();
  }

  List<CalendarEvent> _mapChallengesToCalendarEvents(
    List<ChallengeRequest> challenges, {
    required String userId,
    required User? currentUser,
    required DateTime start,
    required DateTime end,
  }) {
    return challenges.where((challenge) {
      final scheduledAt = challenge.scheduledAt;
      if (scheduledAt == null) return false;
      if (scheduledAt.isBefore(start) || scheduledAt.isAfter(end)) {
        return false;
      }

      final challengeStatus =
          (challenge.message.challengeStatus ?? challenge.matchStatus ?? '')
              .toLowerCase();
      return challengeStatus == 'accepted';
    }).map((challenge) {
      final isCreator = challenge.isSent;
      final creator = isCreator
          ? CalendarParticipantInfo(
              id: userId,
              name: currentUser?.name ?? 'You',
              photoUrl: currentUser?.photoUrl,
            )
          : CalendarParticipantInfo(
              id: challenge.otherUser.id,
              name: challenge.otherUser.name,
              photoUrl: challenge.otherUser.photoUrl,
            );
      final opponent = isCreator
          ? CalendarParticipantInfo(
              id: challenge.otherUser.id,
              name: challenge.otherUser.name,
              photoUrl: challenge.otherUser.photoUrl,
            )
          : CalendarParticipantInfo(
              id: userId,
              name: currentUser?.name ?? 'You',
              photoUrl: currentUser?.photoUrl,
            );

      return CalendarEvent(
        id: 'scheduled_match:${challenge.message.id}',
        type: 'scheduled_match',
        scheduledAt: challenge.scheduledAt!,
        title: '${creator.name} vs ${opponent.name}',
        isConfirmedByMe: true,
        isOwnedByMe: isCreator,
        court: CalendarCourtInfo(
          id: challenge.court?['id']?.toString(),
          name: challenge.courtName,
          city: challenge.courtCity,
          address: _firstNonEmptyText([
            challenge.court?['address'],
            challenge.courtCity,
          ]),
          lat: _parseNullableDouble(challenge.court?['lat']),
          lng: _parseNullableDouble(challenge.court?['lng']),
        ),
        scheduledMatch: CalendarScheduledMatchDetails(
          matchId: challenge.message.matchId ?? '',
          challengeId: challenge.message.id,
          viewerRole: isCreator ? 'creator' : 'opponent',
          visibility: 'participants_only',
          message: challenge.message.content,
          creator: creator,
          opponent: opponent,
        ),
      );
    }).toList();
  }

  DateTime? _parseCalendarDate(dynamic raw) {
    final text = raw?.toString().trim() ?? '';
    if (text.isEmpty) return null;
    final normalized =
        text.endsWith('Z') || !text.contains('T') ? text : '${text}Z';
    return DateTime.tryParse(normalized);
  }

  int? _parseNullableInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '');
  }

  double? _parseNullableDouble(dynamic value) {
    if (value is double) return value;
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }

  List<RunAttendee> _parseRunAttendeePreview(dynamic raw) {
    if (raw is! List) return const [];

    return raw.whereType<Map>().map((entry) {
      final json = Map<String, dynamic>.from(entry);
      return RunAttendee(
        id: _firstNonEmptyText([
              json['id'],
              json['userId'],
              json['user_id'],
            ]) ??
            '',
        name: _firstNonEmptyText([
              json['name'],
              json['userName'],
              json['user_name'],
            ]) ??
            'Unknown',
        photoUrl: _firstNonEmptyText([
          json['photoUrl'],
          json['photo_url'],
          json['avatarUrl'],
          json['avatar_url'],
          json['userPhotoUrl'],
          json['user_photo_url'],
        ]),
      );
    }).toList();
  }

  String? _firstNonEmptyText(List<dynamic> values) {
    for (final value in values) {
      final text = value?.toString().trim();
      if (text == null || text.isEmpty || text.toLowerCase() == 'null') {
        continue;
      }
      return text;
    }
    return null;
  }

  void _openCourt(CalendarEvent event) {
    final courtId = event.court.id;
    final courtName = event.court.name;
    final params = <String, String>{};
    if ((courtId ?? '').isNotEmpty) {
      params['courtId'] = courtId!;
    }
    if ((courtName ?? '').isNotEmpty) {
      params['courtName'] = Uri.encodeComponent(courtName!);
    }
    final query = params.entries.map((e) => '${e.key}=${e.value}').join('&');
    context.go(query.isEmpty ? '/courts' : '/courts?$query');
  }

  void _openMessage(CalendarEvent event) {
    if (!event.isScheduledMatch) return;
    final userId = context.read<AuthState>().currentUser?.id;
    final match = event.scheduledMatch!;
    if (userId == null) return;

    final otherUserId =
        match.creator.id == userId ? match.opponent.id : match.creator.id;
    if (otherUserId.isNotEmpty) {
      context.go('/messages/chat/$otherUserId');
    }
  }

  void _shareRun(CalendarEvent event) {
    if (!event.isRun || event.run == null) return;

    final text = buildScheduledRunShareText(
      runId: event.run!.runId,
      statusId: event.run!.statusId,
      courtId: event.court.id,
      courtName: event.court.name,
      title: event.title,
      scheduledAt: event.scheduledAt,
      hostName: event.run!.creator.name,
      gameMode: event.run!.gameMode,
      ageRange: event.run!.ageRange,
    );

    SharePlus.instance.share(ShareParams(text: text));
  }

  void _showCreateMenu() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 18),
              _createOption(
                icon: Icons.calendar_month,
                title: 'Schedule Run',
                subtitle: 'Create an upcoming pickup run at any court',
                onTap: () {
                  Navigator.pop(sheetContext);
                  Future<void>.delayed(
                    Duration.zero,
                    _openScheduleRunComposer,
                  );
                },
              ),
              const SizedBox(height: 10),
              _createOption(
                icon: Icons.sports_basketball,
                title: 'Schedule Challenge',
                subtitle: 'Pick an opponent, court, and time',
                onTap: () {
                  Navigator.pop(sheetContext);
                  Future<void>.delayed(
                    Duration.zero,
                    _openScheduleMatchComposer,
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _createOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6B35).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: const Color(0xFFFF6B35)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.62),
                        fontSize: 13,
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
    );
  }

  Future<void> _openScheduleRunComposer() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => const StatusComposerScreen(autoShowSchedule: true),
      ),
    );

    if (!mounted || created != true) return;
    await _refreshAll();
  }

  Future<void> _openScheduleMatchComposer() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _ScheduleMatchScreen(
          playersLoader: widget.playersLoader ?? ApiService.getPlayers,
          followsLoader: widget.followsLoader ?? ApiService.getFollows,
        ),
      ),
    );

    if (!mounted || created != true) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content:
            Text('Scheduled challenge sent. It will appear after acceptance.'),
      ),
    );
    await _refreshAll();
  }

  @override
  Widget build(BuildContext context) {
    final visibleEvents = _visibleEvents;
    final visibleSlots = _visibleEventSlots;
    final visibleWindowEventCounts = _visibleWindowEventCounts;

    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: _refreshAll,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 120),
            children: [
              _ScopeSwitcher(
                scope: _scope,
                onChanged: (value) => setState(() => _scope = value),
              ),
              const SizedBox(height: 18),
              _WeekHeader(
                weekStart: _weekStart,
                canGoBack: _canGoBackWeek,
                canGoForward: _canGoForwardWeek,
                onPrevious: () {
                  if (!_canGoBackWeek) return;
                  setState(() {
                    _weekStart = _weekStart.subtract(const Duration(days: 7));
                    _selectedDay = _weekStart;
                  });
                },
                onNext: () {
                  if (!_canGoForwardWeek) return;
                  setState(() {
                    _weekStart = _weekStart.add(const Duration(days: 7));
                    _selectedDay = _weekStart;
                  });
                },
              ),
              const SizedBox(height: 14),
              _WeekStrip(
                weekStart: _weekStart,
                selectedDay: _selectedDay,
                currentDay: _startOfDay(_now),
                eventCountsByDay: visibleWindowEventCounts,
                onSelected: (day) => setState(() => _selectedDay = day),
              ),
              const SizedBox(height: 18),
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.only(top: 40),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                _EmptyState(
                  icon: Icons.error_outline,
                  title: 'Could not load Calendar',
                  subtitle: _error!,
                )
              else if (visibleEvents.isEmpty)
                _EmptyState(
                  icon: _scope == 'mine'
                      ? Icons.event_busy
                      : Icons.calendar_view_week,
                  title: _scope == 'mine'
                      ? 'Nothing on this day'
                      : 'Nothing nearby yet',
                  subtitle: _scope == 'mine'
                      ? 'Join a run or accept a scheduled match to see it here.'
                      : _lat != null && _lng != null
                          ? 'Try another day within your local radius or schedule something new.'
                          : 'Turn on location for nearby runs or schedule something new.',
                )
              else
                ...visibleSlots.map(
                  (slot) => _CalendarAgendaSlot(
                    slot: slot,
                    emphasize: _scope == 'mine',
                    isRunAttendancePending: (event) => _pendingRunAttendanceKeys
                        .contains(_runAttendanceKey(event)),
                    onOpenCourt: _openCourt,
                    onShareRun: _shareRun,
                    onOpenMessage: _openMessage,
                    onToggleRunAttendance: _toggleRunAttendance,
                    onCancelScheduledMatch: _cancelScheduledMatch,
                    onDeclineScheduledMatch: _declineScheduledMatch,
                  ),
                ),
            ],
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 18,
          child: SafeArea(
            top: false,
            child: FloatingActionButton.extended(
              onPressed: _showCreateMenu,
              backgroundColor: const Color(0xFFFF6B35),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text(
                'Schedule a Run or Challenge',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ScopeSwitcher extends StatelessWidget {
  const _ScopeSwitcher({required this.scope, required this.onChanged});

  final String scope;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          _ScopeTab(
            label: 'For You',
            selected: scope == 'for_you',
            onTap: () => onChanged('for_you'),
          ),
          _ScopeTab(
            label: 'My Calendar',
            selected: scope == 'mine',
            onTap: () => onChanged('mine'),
          ),
        ],
      ),
    );
  }
}

class _ScopeTab extends StatelessWidget {
  const _ScopeTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFFFF6B35) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: Colors.white,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _WeekHeader extends StatelessWidget {
  const _WeekHeader({
    required this.weekStart,
    required this.canGoBack,
    required this.canGoForward,
    required this.onPrevious,
    required this.onNext,
  });

  final DateTime weekStart;
  final bool canGoBack;
  final bool canGoForward;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final weekEnd = weekStart.add(const Duration(days: 6));
    return Row(
      children: [
        IconButton(
          onPressed: canGoBack ? onPrevious : null,
          icon: const Icon(Icons.chevron_left),
        ),
        Expanded(
          child: Text(
            '${weekStart.month}/${weekStart.day} - ${weekEnd.month}/${weekEnd.day}',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        IconButton(
          onPressed: canGoForward ? onNext : null,
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    );
  }
}

class _WeekStrip extends StatelessWidget {
  const _WeekStrip({
    required this.weekStart,
    required this.selectedDay,
    required this.currentDay,
    required this.eventCountsByDay,
    required this.onSelected,
  });

  final DateTime weekStart;
  final DateTime selectedDay;
  final DateTime currentDay;
  final Map<String, int> eventCountsByDay;
  final ValueChanged<DateTime> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(7, (index) {
        final day = weekStart.add(Duration(days: index));
        final isSelected = _sameDay(day, selectedDay);
        final isToday = _sameDay(day, currentDay);
        final eventCount = eventCountsByDay[_dayKey(day)] ?? 0;
        final hasEvents = eventCount > 0;
        return Expanded(
          child: GestureDetector(
            onTap: () => onSelected(day),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              margin: EdgeInsets.only(right: index == 6 ? 0 : 8),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFFFF6B35)
                    : hasEvents
                        ? const Color(0xFFFF6B35).withValues(alpha: 0.08)
                        : Colors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected
                      ? const Color(0xFFFF6B35)
                      : hasEvents
                          ? const Color(0xFFFF6B35).withValues(alpha: 0.52)
                          : isToday
                              ? Colors.white.withValues(alpha: 0.26)
                              : Colors.white.withValues(alpha: 0.08),
                ),
                boxShadow: hasEvents && !isSelected
                    ? [
                        BoxShadow(
                          color:
                              const Color(0xFFFF6B35).withValues(alpha: 0.08),
                          blurRadius: 14,
                          offset: const Offset(0, 6),
                        ),
                      ]
                    : null,
              ),
              child: Column(
                children: [
                  Text(
                    _weekdayLetter(day),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.72),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${day.day}',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight:
                          isSelected ? FontWeight.w800 : FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (hasEvents)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? Colors.white.withValues(alpha: 0.16)
                            : const Color(0xFFFF6B35).withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: isSelected
                              ? Colors.white.withValues(alpha: 0.32)
                              : const Color(0xFFFF6B35).withValues(alpha: 0.38),
                        ),
                      ),
                      child: Text(
                        '$eventCount',
                        style: TextStyle(
                          color: isSelected
                              ? Colors.white
                              : const Color(0xFFFF6B35),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    )
                  else
                    const SizedBox(height: 18),
                ],
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _CalendarAgendaSlot extends StatelessWidget {
  const _CalendarAgendaSlot({
    required this.slot,
    required this.emphasize,
    required this.isRunAttendancePending,
    required this.onOpenCourt,
    required this.onShareRun,
    required this.onOpenMessage,
    required this.onToggleRunAttendance,
    required this.onCancelScheduledMatch,
    required this.onDeclineScheduledMatch,
  });

  final _CalendarEventSlot slot;
  final bool emphasize;
  final bool Function(CalendarEvent event) isRunAttendancePending;
  final ValueChanged<CalendarEvent> onOpenCourt;
  final ValueChanged<CalendarEvent> onShareRun;
  final ValueChanged<CalendarEvent> onOpenMessage;
  final ValueChanged<CalendarEvent> onToggleRunAttendance;
  final ValueChanged<CalendarEvent> onCancelScheduledMatch;
  final ValueChanged<CalendarEvent> onDeclineScheduledMatch;

  @override
  Widget build(BuildContext context) {
    final accent = slot.events.any((event) => event.isConfirmedByMe)
        ? const Color(0xFF00C853)
        : const Color(0xFFFF6B35);

    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: accent,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.32),
                      blurRadius: 12,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  slot.timeHeaderLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 1,
                  color: accent.withValues(alpha: 0.18),
                ),
              ),
              if (slot.hasOverlap) ...[
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: accent.withValues(alpha: 0.24)),
                  ),
                  child: Text(
                    slot.overlapLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          if (slot.hasOverlap) ...[
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.07),
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.layers, size: 16, color: accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Multiple events stack in this time block nearby.',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.82),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          ...slot.events.asMap().entries.map((entry) {
            final event = entry.value;
            return Padding(
              padding: EdgeInsets.only(
                bottom: entry.key == slot.events.length - 1 ? 0 : 10,
              ),
              child: CalendarEventCard(
                event: event,
                emphasize: emphasize,
                bottomMargin: 0,
                isRunAttendancePending:
                    event.isRun && isRunAttendancePending(event),
                onOpenCourt: () => onOpenCourt(event),
                onShareRun: event.isRun ? () => onShareRun(event) : null,
                onOpenMessage: event.isScheduledMatch &&
                        event.scheduledMatch!.isParticipant
                    ? () => onOpenMessage(event)
                    : null,
                onToggleRunAttendance:
                    event.isRun ? () => onToggleRunAttendance(event) : null,
                onCancelScheduledMatch:
                    event.isScheduledMatch && event.scheduledMatch!.isCreator
                        ? () => onCancelScheduledMatch(event)
                        : null,
                onDeclineScheduledMatch:
                    event.isScheduledMatch && event.scheduledMatch!.isOpponent
                        ? () => onDeclineScheduledMatch(event)
                        : null,
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _CalendarEventSlot {
  const _CalendarEventSlot({
    required this.scheduledAt,
    required this.events,
  });

  final DateTime scheduledAt;
  final List<CalendarEvent> events;

  bool get hasOverlap => events.length > 1;

  String get timeLabel {
    final local = scheduledAt.toLocal();
    final hour =
        local.hour > 12 ? local.hour - 12 : (local.hour == 0 ? 12 : local.hour);
    return '$hour:${local.minute.toString().padLeft(2, '0')}';
  }

  String get periodLabel => scheduledAt.toLocal().hour >= 12 ? 'PM' : 'AM';

  String get timeHeaderLabel => '$timeLabel $periodLabel';

  String get overlapLabel {
    final runCount = events.where((event) => event.isRun).length;
    final matchCount = events.where((event) => event.isScheduledMatch).length;
    final total = events.length;

    if (runCount == total) {
      return '$runCount RUN${runCount == 1 ? '' : 'S'}';
    }
    if (matchCount == total) {
      return '$matchCount MATCH${matchCount == 1 ? '' : 'ES'}';
    }
    return '$total EVENTS';
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 42),
      child: Column(
        children: [
          Icon(icon, size: 48, color: Colors.white38),
          const SizedBox(height: 14),
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.62),
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleMatchScreen extends StatefulWidget {
  const _ScheduleMatchScreen({
    required this.playersLoader,
    required this.followsLoader,
  });

  final CalendarPlayersLoader playersLoader;
  final CalendarFollowsLoader followsLoader;

  @override
  State<_ScheduleMatchScreen> createState() => _ScheduleMatchScreenState();
}

class _ScheduleMatchScreenState extends State<_ScheduleMatchScreen> {
  final _noteController = TextEditingController();
  final _searchController = TextEditingController();
  User? _selectedOpponent;
  Court? _selectedCourt;
  DateTime _scheduledAt = DateTime.now().add(const Duration(days: 1, hours: 2));
  bool _isLoading = true;
  bool _isSubmitting = false;
  List<User> _players = [];
  List<Court> _followedCourts = [];
  Set<String> _followedPlayerIds = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _noteController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      await CourtService().loadCourts();
      final results = await Future.wait([
        widget.playersLoader(),
        widget.followsLoader(),
      ]);
      if (!mounted) return;

      final loadedPlayers = results[0] as List<User>;
      final follows = results[1] as Map<String, dynamic>;
      final rawFollows = follows['players'] as List<dynamic>? ?? const [];
      final rawCourtFollows = follows['courts'] as List<dynamic>? ?? const [];
      final followedCourts = rawCourtFollows
          .map(
              (entry) => (entry as Map<String, dynamic>)['courtId']?.toString())
          .whereType<String>()
          .map((courtId) => CourtService().getCourtById(courtId))
          .whereType<Court>()
          .toList()
        ..sort((a, b) => a.name.compareTo(b.name));
      setState(() {
        _players = loadedPlayers;
        _followedCourts = followedCourts;
        _followedPlayerIds = rawFollows
            .map((entry) =>
                (entry as Map<String, dynamic>)['playerId']?.toString() ?? '')
            .where((id) => id.isNotEmpty)
            .toSet();
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not load players: $e')),
      );
    }
  }

  List<User> get _filteredPlayers {
    final currentUserId = ApiService.userId;
    final query = _searchController.text.trim().toLowerCase();
    final players = _players
        .where((player) => player.id != currentUserId)
        .where((player) =>
            query.isEmpty || player.name.toLowerCase().contains(query))
        .toList()
      ..sort((a, b) {
        final aFollowed = _followedPlayerIds.contains(a.id);
        final bFollowed = _followedPlayerIds.contains(b.id);
        if (aFollowed != bFollowed) return aFollowed ? -1 : 1;
        return a.name.compareTo(b.name);
      });
    return players;
  }

  List<User> get _visiblePlayers {
    final query = _searchController.text.trim();
    final maxVisible = query.isEmpty ? 4 : 6;
    final players = _filteredPlayers;

    if (query.isEmpty &&
        _selectedOpponent != null &&
        players.any((player) => player.id == _selectedOpponent!.id)) {
      final selected = players.firstWhere(
        (player) => player.id == _selectedOpponent!.id,
      );
      final remaining = players.where((player) => player.id != selected.id);
      return [selected, ...remaining.take(maxVisible - 1)];
    }

    return players.take(maxVisible).toList();
  }

  Future<void> _pickCourt() async {
    String searchText = '';
    final courts = CourtService().courts;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final filteredCourts = searchText.trim().isEmpty
                ? courts
                : CourtService().searchCourts(searchText.trim());
            return DraggableScrollableSheet(
              initialChildSize: 0.75,
              minChildSize: 0.55,
              maxChildSize: 0.95,
              expand: false,
              builder: (context, scrollController) => Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                    child: Column(
                      children: [
                        Container(
                          width: 42,
                          height: 4,
                          decoration: BoxDecoration(
                            color: Colors.white24,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          decoration: InputDecoration(
                            hintText: 'Search courts',
                            prefixIcon:
                                const Icon(Icons.search, color: Colors.white70),
                            filled: true,
                            fillColor: Colors.white.withValues(alpha: 0.06),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          style: const TextStyle(color: Colors.white),
                          onChanged: (value) =>
                              setSheetState(() => searchText = value),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      controller: scrollController,
                      itemCount: filteredCourts.length,
                      itemBuilder: (context, index) {
                        final court = filteredCourts[index];
                        final isSelected = court.id == _selectedCourt?.id;
                        return ListTile(
                          title: Text(
                            court.name,
                            style: const TextStyle(color: Colors.white),
                          ),
                          subtitle: court.address != null
                              ? Text(
                                  court.address!,
                                  style: TextStyle(color: Colors.grey[500]),
                                )
                              : null,
                          trailing: isSelected
                              ? const Icon(Icons.check_circle,
                                  color: Color(0xFFFF6B35))
                              : null,
                          onTap: () {
                            setState(() => _selectedCourt = court);
                            Navigator.pop(sheetContext);
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _pickDateTime() async {
    final today = _startOfDay(DateTime.now());
    final initialDate = _scheduledAt.isBefore(today) ? today : _scheduledAt;
    final date = await showModalBottomSheet<DateTime>(
      context: context,
      backgroundColor: const Color(0xFF1E2128),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Theme(
          data: Theme.of(ctx).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Colors.deepOrange,
              onPrimary: Colors.white,
              surface: Color(0xFF1E2128),
              onSurface: Colors.white,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.grey[600],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Pick a date',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                CalendarDatePicker(
                  initialDate: initialDate,
                  firstDate: today,
                  lastDate: today.add(const Duration(days: 42)),
                  onDateChanged: (selectedDate) {
                    Navigator.pop(ctx, selectedDate);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );

    if (date == null || !mounted) return;

    final time = await _showDigitalTimePicker(date);
    if (time == null || !mounted) return;

    setState(() {
      _scheduledAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  Future<TimeOfDay?> _showDigitalTimePicker(DateTime selectedDate) async {
    final now = DateTime.now();
    final isToday = _sameDay(selectedDate, now);
    final timeSlots = <TimeOfDay>[];

    for (var hour = 6; hour <= 23; hour++) {
      for (var minute = 0; minute <= 30; minute += 30) {
        final slot = TimeOfDay(hour: hour, minute: minute);
        if (isToday) {
          final slotDateTime = DateTime(
            selectedDate.year,
            selectedDate.month,
            selectedDate.day,
            hour,
            minute,
          );
          if (!slotDateTime.isAfter(now)) {
            continue;
          }
        }
        timeSlots.add(slot);
      }
    }

    return showModalBottomSheet<TimeOfDay>(
      context: context,
      backgroundColor: const Color(0xFF1E2128),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.access_time, color: Colors.deepOrange),
                  const SizedBox(width: 12),
                  Text(
                    'Pick a time for ${_formatPickerDate(selectedDate)}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 200,
                child: GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 2.0,
                  ),
                  itemCount: timeSlots.length,
                  itemBuilder: (context, index) {
                    final slot = timeSlots[index];
                    final label = _formatPickerTimeOfDay(slot);
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => Navigator.pop(ctx, slot),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.deepOrange.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: Colors.deepOrange.withValues(alpha: 0.3),
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            label,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w500,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatPickerDate(DateTime value) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[value.month - 1]} ${value.day}';
  }

  String _formatPickerTimeOfDay(TimeOfDay time) {
    final hour = time.hourOfPeriod == 0 ? 12 : time.hourOfPeriod;
    final minute = time.minute.toString().padLeft(2, '0');
    final period = time.period == DayPeriod.am ? 'AM' : 'PM';
    return '$hour:$minute $period';
  }

  Future<void> _submit() async {
    final userId = ApiService.userId;
    if (userId == null || _selectedOpponent == null || _selectedCourt == null) {
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final note = _noteController.text.trim();
      final message = note.isEmpty ? 'Want to play?' : note;
      await MessagesService().sendChallenge(
        userId,
        _selectedOpponent!.id,
        message,
        courtId: _selectedCourt!.id,
        scheduledAt: _scheduledAt,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not schedule challenge: $e')),
      );
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final players = _visiblePlayers;
    final canSubmit =
        !_isSubmitting && _selectedOpponent != null && _selectedCourt != null;
    return Scaffold(
      backgroundColor: Colors.grey[900],
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.close, color: Colors.white),
        ),
        title: const Text(
          'Schedule Challenge',
          style: TextStyle(color: Colors.white, fontSize: 16),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton(
              onPressed: canSubmit ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF6B35),
                disabledBackgroundColor: Colors.grey[700],
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Send'),
            ),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            16,
            8,
            16,
            MediaQuery.of(context).viewInsets.bottom + 32,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Pick an opponent, court, and time.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.68),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 18),
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(16),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Opponent',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.72),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: 'Search player',
                          prefixIcon:
                              const Icon(Icons.search, color: Colors.white70),
                          filled: true,
                          fillColor: Colors.white.withValues(alpha: 0.06),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                        style: const TextStyle(color: Colors.white),
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 12),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 176),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: players.length,
                          itemBuilder: (context, index) {
                            final player = players[index];
                            final isSelected =
                                _selectedOpponent?.id == player.id;
                            final isFollowed =
                                _followedPlayerIds.contains(player.id);
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                player.name,
                                style: const TextStyle(color: Colors.white),
                              ),
                              subtitle: Text(
                                isFollowed ? 'Following' : 'Player',
                                style: TextStyle(color: Colors.grey[500]),
                              ),
                              trailing: isSelected
                                  ? const Icon(
                                      Icons.check_circle,
                                      color: Color(0xFFFF6B35),
                                    )
                                  : null,
                              onTap: () =>
                                  setState(() => _selectedOpponent = player),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _SelectionRow(
                  icon: Icons.place,
                  label: _selectedCourt?.name ?? 'Select court',
                  onTap: _pickCourt,
                ),
                if (_followedCourts.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Your courts',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.72),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: _followedCourts.take(5).map((court) {
                        final isSelected = _selectedCourt?.id == court.id;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ActionChip(
                            avatar: Icon(
                              isSelected ? Icons.check_circle : Icons.place,
                              size: 16,
                              color: isSelected
                                  ? const Color(0xFFFF6B35)
                                  : Colors.white70,
                            ),
                            label: Text(
                              court.name,
                              style: TextStyle(
                                color: isSelected
                                    ? const Color(0xFFFF6B35)
                                    : Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            backgroundColor: isSelected
                                ? const Color(0xFFFF6B35)
                                    .withValues(alpha: 0.14)
                                : Colors.white.withValues(alpha: 0.06),
                            side: BorderSide(
                              color: isSelected
                                  ? const Color(0xFFFF6B35)
                                      .withValues(alpha: 0.42)
                                  : Colors.white.withValues(alpha: 0.1),
                            ),
                            onPressed: () =>
                                setState(() => _selectedCourt = court),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                _SelectionRow(
                  icon: Icons.schedule,
                  label: _formatDateTime(_scheduledAt),
                  onTap: _pickDateTime,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _noteController,
                  decoration: InputDecoration(
                    labelText: 'Message to opponent',
                    hintText: _selectedOpponent == null
                        ? 'Send a message with this challenge'
                        : 'Send ${_selectedOpponent!.name} a message',
                    filled: true,
                    fillColor: Colors.white.withValues(alpha: 0.06),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  style: const TextStyle(color: Colors.white),
                  minLines: 2,
                  maxLines: 3,
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: canSubmit ? _submit : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFF6B35),
                      disabledBackgroundColor: Colors.grey[700],
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text(
                            'Send Challenge',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectionRow extends StatelessWidget {
  const _SelectionRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFFFF6B35)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white54),
          ],
        ),
      ),
    );
  }
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  final hour =
      local.hour > 12 ? local.hour - 12 : (local.hour == 0 ? 12 : local.hour);
  final period = local.hour >= 12 ? 'PM' : 'AM';
  return '${local.month}/${local.day} at $hour:${local.minute.toString().padLeft(2, '0')} $period';
}

DateTime _startOfDay(DateTime value) =>
    DateTime(value.year, value.month, value.day);

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

String _dayKey(DateTime value) => '${value.year}-${value.month}-${value.day}';

String _weekdayLetter(DateTime value) {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return labels[value.weekday - 1];
}

extension on CalendarEvent {
  CalendarEvent copyWith({
    bool? isConfirmedByMe,
    CalendarRunDetails? run,
  }) {
    return CalendarEvent(
      id: id,
      type: type,
      scheduledAt: scheduledAt,
      title: title,
      distanceMiles: distanceMiles,
      isConfirmedByMe: isConfirmedByMe ?? this.isConfirmedByMe,
      isOwnedByMe: isOwnedByMe,
      court: court,
      run: run ?? this.run,
      scheduledMatch: scheduledMatch,
      courtEvent: courtEvent,
    );
  }
}

extension on CalendarRunDetails {
  CalendarRunDetails copyWith({
    int? attendeeCount,
  }) {
    return CalendarRunDetails(
      runId: runId,
      statusId: statusId,
      gameMode: gameMode,
      courtType: courtType,
      ageRange: ageRange,
      durationMinutes: durationMinutes,
      maxPlayers: maxPlayers,
      attendeeCount: attendeeCount ?? this.attendeeCount,
      isRecurring: isRecurring,
      recurrenceRule: recurrenceRule,
      notes: notes,
      creator: creator,
      attendeePreview: attendeePreview,
      occurrenceKey: occurrenceKey,
    );
  }
}

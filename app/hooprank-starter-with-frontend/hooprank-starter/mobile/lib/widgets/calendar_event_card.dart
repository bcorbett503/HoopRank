import 'package:flutter/material.dart';

import '../models.dart';
import '../utils/image_utils.dart';

class CalendarEventCard extends StatelessWidget {
  final CalendarEvent event;
  final bool emphasize;
  final bool isRunAttendancePending;
  final double bottomMargin;
  final VoidCallback? onOpenCourt;
  final VoidCallback? onOpenMessage;
  final VoidCallback? onToggleRunAttendance;
  final VoidCallback? onShareRun;
  final VoidCallback? onCancelScheduledMatch;
  final VoidCallback? onDeclineScheduledMatch;

  const CalendarEventCard({
    super.key,
    required this.event,
    this.emphasize = false,
    this.isRunAttendancePending = false,
    this.bottomMargin = 14,
    this.onOpenCourt,
    this.onOpenMessage,
    this.onToggleRunAttendance,
    this.onShareRun,
    this.onCancelScheduledMatch,
    this.onDeclineScheduledMatch,
  });

  @override
  Widget build(BuildContext context) {
    final highlighted = emphasize || event.isConfirmedByMe;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      margin: EdgeInsets.only(bottom: bottomMargin),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: highlighted
              ? [
                  const Color(0xFF283632),
                  const Color(0xFF171C1C),
                ]
              : [
                  const Color(0xFF24282D),
                  const Color(0xFF171A1E),
                ],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: highlighted
              ? const Color(0xFF00C853).withValues(alpha: 0.45)
              : Colors.white.withValues(alpha: 0.08),
          width: highlighted ? 1.4 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: highlighted
                ? const Color(0xFF00C853).withValues(alpha: 0.07)
                : Colors.black.withValues(alpha: 0.16),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: event.isRun
            ? _RunCardBody(
                event: event,
                highlighted: highlighted,
                isRunAttendancePending: isRunAttendancePending,
                onOpenCourt: onOpenCourt,
                onToggleRunAttendance: onToggleRunAttendance,
                onShareRun: onShareRun,
              )
            : event.isCourtEvent
                ? _CourtEventCardBody(
                    event: event,
                    highlighted: highlighted,
                    onOpenCourt: onOpenCourt,
                  )
                : event.isScheduledMatch
                    ? _ScheduledMatchCardBody(
                        event: event,
                        highlighted: highlighted,
                        onOpenCourt: onOpenCourt,
                        onOpenMessage: onOpenMessage,
                        onCancelScheduledMatch: onCancelScheduledMatch,
                        onDeclineScheduledMatch: onDeclineScheduledMatch,
                      )
                    : _GenericEventCardBody(
                        event: event,
                        highlighted: highlighted,
                        onOpenCourt: onOpenCourt,
                      ),
      ),
    );
  }
}

class _RunCardBody extends StatelessWidget {
  final CalendarEvent event;
  final bool highlighted;
  final bool isRunAttendancePending;
  final VoidCallback? onOpenCourt;
  final VoidCallback? onToggleRunAttendance;
  final VoidCallback? onShareRun;

  const _RunCardBody({
    required this.event,
    required this.highlighted,
    required this.isRunAttendancePending,
    this.onOpenCourt,
    this.onToggleRunAttendance,
    this.onShareRun,
  });

  @override
  Widget build(BuildContext context) {
    final run = event.run!;
    final isWaitlistOnly =
        !event.isOwnedByMe && !event.isConfirmedByMe && run.isFull;
    final joinLabel = event.isOwnedByMe
        ? 'HOSTING'
        : event.isConfirmedByMe
            ? 'IN'
            : isWaitlistOnly
                ? 'WAITLIST'
                : 'JOIN';
    final buttonTextColor = event.isOwnedByMe || isWaitlistOnly
        ? Colors.orange
        : event.isConfirmedByMe
            ? const Color(0xFF00C853)
            : Colors.black;
    final canToggleAttendance = !event.isOwnedByMe &&
        !isRunAttendancePending &&
        !isWaitlistOnly &&
        onToggleRunAttendance != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _Pill(
                    icon: Icons.sports_basketball,
                    text: run.gameMode,
                    color: run.gameMode == '3v3'
                        ? Colors.blue
                        : run.gameMode == '5v5'
                            ? Colors.deepPurpleAccent
                            : Colors.deepOrange,
                  ),
                  if (run.courtTypeLabel != null)
                    _Pill(
                      icon: Icons.crop_square,
                      text: run.courtTypeLabel!,
                      color: Colors.teal,
                    ),
                  if (run.ageRange != null && run.ageRange!.isNotEmpty)
                    _Pill(
                      icon: Icons.people_outline,
                      text: run.ageRange!,
                      color: Colors.amber,
                    ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            if (onToggleRunAttendance != null || event.isOwnedByMe)
              GestureDetector(
                onTap: canToggleAttendance ? onToggleRunAttendance : null,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                  decoration: BoxDecoration(
                    color: event.isOwnedByMe || isWaitlistOnly
                        ? Colors.orange.withValues(alpha: 0.14)
                        : event.isConfirmedByMe
                            ? const Color(0xFF00C853).withValues(alpha: 0.14)
                            : const Color(0xFF00C853),
                    borderRadius: BorderRadius.circular(999),
                    border: event.isConfirmedByMe ||
                            event.isOwnedByMe ||
                            isWaitlistOnly
                        ? Border.all(
                            color: event.isOwnedByMe || isWaitlistOnly
                                ? Colors.orange
                                : const Color(0xFF00C853),
                          )
                        : null,
                  ),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 160),
                    child: isRunAttendancePending
                        ? Row(
                            key: const ValueKey('run-attendance-pending'),
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(
                                width: 12,
                                height: 12,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    buttonTextColor,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                joinLabel,
                                style: TextStyle(
                                  color: buttonTextColor,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          )
                        : Text(
                            joinLabel,
                            key: ValueKey(joinLabel),
                            style: TextStyle(
                              color: buttonTextColor,
                              fontWeight: FontWeight.w800,
                              fontSize: 11,
                            ),
                          ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          event.title,
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: highlighted ? FontWeight.w800 : FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${event.dayLabel} • ${event.timeLabel}',
          style: TextStyle(
            color: highlighted
                ? Colors.white.withValues(alpha: 0.92)
                : Colors.white.withValues(alpha: 0.72),
            fontSize: 14,
            fontWeight: highlighted ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        if (event.court.name != null) ...[
          const SizedBox(height: 12),
          InkWell(
            onTap: onOpenCourt,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.place, color: Color(0xFF00C853), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      event.court.name!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.white54),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        _RunAttendanceSection(
          event: event,
          run: run,
          onShareRun: onShareRun,
        ),
      ],
    );
  }
}

class _RunAttendanceSection extends StatelessWidget {
  final CalendarEvent event;
  final CalendarRunDetails run;
  final VoidCallback? onShareRun;

  const _RunAttendanceSection({
    required this.event,
    required this.run,
    this.onShareRun,
  });

  @override
  Widget build(BuildContext context) {
    final showExpandedAttendees = event.isOwnedByMe || event.isConfirmedByMe;
    final normalizedAttendees = _normalizedAttendees();

    if (showExpandedAttendees) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _AttendanceCountBadge(
                      count: run.attendeeCount,
                      maxPlayers: run.maxPlayers,
                    ),
                    if (onShareRun != null)
                      _InlineActionPill(
                        icon: Icons.share_outlined,
                        label: 'Share',
                        onTap: onShareRun!,
                      ),
                  ],
                ),
              ),
              if (event.distanceMiles != null) ...[
                Text(
                  '${event.distanceMiles!.toStringAsFixed(1)} mi',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Text(
            "Who's IN",
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.76),
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 8),
          if (normalizedAttendees.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Text(
                'No one is confirmed yet.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.62),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            )
          else
            Column(
              children: [
                for (var i = 0; i < normalizedAttendees.length; i++) ...[
                  _HostedAttendeeRow(attendee: normalizedAttendees[i]),
                  if (i < normalizedAttendees.length - 1)
                    const SizedBox(height: 8),
                ],
              ],
            ),
        ],
      );
    }

    return Row(
      children: [
        Expanded(
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _AttendanceCountBadge(
                count: run.attendeeCount,
                maxPlayers: run.maxPlayers,
              ),
              if (onShareRun != null)
                _InlineActionPill(
                  icon: Icons.share_outlined,
                  label: 'Share',
                  onTap: onShareRun!,
                ),
              if (normalizedAttendees.isNotEmpty) ...[
                _AttendeeAvatarStack(attendees: normalizedAttendees),
              ],
            ],
          ),
        ),
        if (event.distanceMiles != null)
          Text(
            '${event.distanceMiles!.toStringAsFixed(1)} mi',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 12,
            ),
          ),
      ],
    );
  }

  List<RunAttendee> _normalizedAttendees() {
    final attendees = List<RunAttendee>.from(run.attendeePreview);
    final creator = run.creator;
    final hasCreator = attendees.any((attendee) => attendee.id == creator.id);
    if (event.isOwnedByMe &&
        creator.id.isNotEmpty &&
        creator.name.isNotEmpty &&
        !hasCreator) {
      attendees.insert(
        0,
        RunAttendee(
          id: creator.id,
          name: creator.name,
          photoUrl: creator.photoUrl,
        ),
      );
    }
    return attendees;
  }
}

class _AttendanceCountBadge extends StatelessWidget {
  final int count;
  final int maxPlayers;

  const _AttendanceCountBadge({
    required this.count,
    required this.maxPlayers,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final safeCapacity = maxPlayers <= 0 ? 15 : maxPlayers;
        final compact =
            constraints.maxWidth.isFinite && constraints.maxWidth < 180;
        final label = compact
            ? '$count/$safeCapacity IN'
            : _confirmedCountLabel(count, maxPlayers);

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: const Color(0xFF00C853).withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: const Color(0xFF00C853).withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.how_to_reg,
                color: Color(0xFF00C853),
                size: 14,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF00C853),
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _InlineActionPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _InlineActionPill({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFF00C853).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: const Color(0xFF00C853).withValues(alpha: 0.35),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: const Color(0xFF00C853),
              size: 14,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                color: Color(0xFF00C853),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttendeeAvatarStack extends StatelessWidget {
  final List<RunAttendee> attendees;

  const _AttendeeAvatarStack({required this.attendees});

  @override
  Widget build(BuildContext context) {
    final visibleAttendees = attendees.take(4).toList();
    final width = (visibleAttendees.length * 20) + 12;

    return SizedBox(
      width: width.toDouble(),
      height: 28,
      child: Stack(
        children: [
          for (var i = 0; i < visibleAttendees.length; i++)
            Positioned(
              left: i * 20,
              child: _RunAttendeeAvatar(
                attendee: visibleAttendees[i],
                radius: 14,
                fontSize: 11,
              ),
            ),
        ],
      ),
    );
  }
}

class _HostedAttendeeRow extends StatelessWidget {
  final RunAttendee attendee;

  const _HostedAttendeeRow({required this.attendee});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          _RunAttendeeAvatar(
            attendee: attendee,
            radius: 14,
            fontSize: 11,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              attendee.name,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _RunAttendeeAvatar extends StatelessWidget {
  final RunAttendee attendee;
  final double radius;
  final double fontSize;

  const _RunAttendeeAvatar({
    required this.attendee,
    required this.radius,
    required this.fontSize,
  });

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: Colors.grey[900],
      backgroundImage: attendee.photoUrl != null
          ? safeImageProvider(attendee.photoUrl!)
          : null,
      child: attendee.photoUrl == null
          ? Text(
              attendee.name.isNotEmpty ? attendee.name[0].toUpperCase() : '?',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: fontSize,
              ),
            )
          : null,
    );
  }
}

class _CourtEventCardBody extends StatelessWidget {
  final CalendarEvent event;
  final bool highlighted;
  final VoidCallback? onOpenCourt;

  const _CourtEventCardBody({
    required this.event,
    required this.highlighted,
    this.onOpenCourt,
  });

  @override
  Widget build(BuildContext context) {
    final courtEvent = event.courtEvent!;
    final detailChips = <Widget>[
      _Pill(
        icon: Icons.event,
        text: courtEvent.typeLabel,
        color: Colors.lightBlueAccent,
      ),
      if ((courtEvent.format ?? '').isNotEmpty)
        _Pill(
          icon: Icons.sports_basketball,
          text: courtEvent.format!,
          color: Colors.deepOrangeAccent,
        ),
      if ((courtEvent.ageRange ?? '').isNotEmpty)
        _Pill(
          icon: Icons.people_outline,
          text: courtEvent.ageRange!,
          color: Colors.amber,
        ),
      if ((courtEvent.costText ?? '').isNotEmpty)
        _Pill(
          icon: Icons.sell_outlined,
          text: courtEvent.costText!,
          color: Colors.tealAccent,
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(spacing: 6, runSpacing: 6, children: detailChips),
        const SizedBox(height: 12),
        Text(
          event.title,
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: highlighted ? FontWeight.w800 : FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${event.dayLabel} • ${event.timeLabel}',
          style: TextStyle(
            color: highlighted
                ? Colors.white.withValues(alpha: 0.92)
                : Colors.white.withValues(alpha: 0.72),
            fontSize: 14,
            fontWeight: highlighted ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        if ((courtEvent.organizerName ?? '').isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            courtEvent.organizerName!,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
        if ((courtEvent.notes ?? '').isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            courtEvent.notes!,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.72),
              fontSize: 13,
              height: 1.35,
            ),
          ),
        ],
        if (event.court.name != null) ...[
          const SizedBox(height: 12),
          InkWell(
            onTap: onOpenCourt,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.place,
                      color: Colors.lightBlueAccent, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      event.court.name!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.white54),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        if (onOpenCourt != null)
          _ActionButton(
            icon: Icons.place_outlined,
            label: 'Court',
            onTap: onOpenCourt!,
            color: Colors.lightBlueAccent,
          ),
      ],
    );
  }
}

class _ScheduledMatchCardBody extends StatelessWidget {
  final CalendarEvent event;
  final bool highlighted;
  final VoidCallback? onOpenCourt;
  final VoidCallback? onOpenMessage;
  final VoidCallback? onCancelScheduledMatch;
  final VoidCallback? onDeclineScheduledMatch;

  const _ScheduledMatchCardBody({
    required this.event,
    required this.highlighted,
    this.onOpenCourt,
    this.onOpenMessage,
    this.onCancelScheduledMatch,
    this.onDeclineScheduledMatch,
  });

  @override
  Widget build(BuildContext context) {
    final match = event.scheduledMatch!;
    final canCancel = match.isCreator && onCancelScheduledMatch != null;
    final canDecline = match.isOpponent && onDeclineScheduledMatch != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _Pill(
              icon: Icons.event_available,
              text: 'SCHEDULED MATCH',
              color: Color(0xFFFFB74D),
            ),
            if (match.viewerRole != 'observer') ...[
              const SizedBox(width: 6),
              _Pill(
                icon: Icons.check_circle,
                text: match.isCreator ? 'HOST' : 'CONFIRMED',
                color:
                    match.isCreator ? Colors.orange : const Color(0xFF00C853),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _ParticipantAvatar(participant: match.creator),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '${match.creator.name} vs ${match.opponent.name}',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: highlighted ? FontWeight.w800 : FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 10),
            _ParticipantAvatar(participant: match.opponent),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          '${event.dayLabel} • ${event.timeLabel}',
          style: TextStyle(
            color: highlighted
                ? Colors.white.withValues(alpha: 0.92)
                : Colors.white.withValues(alpha: 0.72),
            fontSize: 14,
            fontWeight: highlighted ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        if ((match.message ?? '').trim().isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            match.message!.trim(),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.72),
              fontSize: 13,
              height: 1.35,
            ),
          ),
        ],
        if (event.court.name != null) ...[
          const SizedBox(height: 12),
          InkWell(
            onTap: onOpenCourt,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.place, color: Colors.orange, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      event.court.name!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.white54),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            if (onOpenMessage != null && match.isParticipant)
              _ActionButton(
                icon: Icons.chat_bubble_outline,
                label: 'Message',
                onTap: onOpenMessage!,
              ),
            if (onOpenCourt != null)
              _ActionButton(
                icon: Icons.place_outlined,
                label: 'Court',
                onTap: onOpenCourt!,
              ),
            if (canCancel)
              _ActionButton(
                icon: Icons.close,
                label: 'Cancel',
                onTap: onCancelScheduledMatch!,
                color: Colors.orange,
              ),
            if (canDecline)
              _ActionButton(
                icon: Icons.remove_circle_outline,
                label: 'Decline',
                onTap: onDeclineScheduledMatch!,
                color: Colors.redAccent,
              ),
          ],
        ),
      ],
    );
  }
}

class _GenericEventCardBody extends StatelessWidget {
  final CalendarEvent event;
  final bool highlighted;
  final VoidCallback? onOpenCourt;

  const _GenericEventCardBody({
    required this.event,
    required this.highlighted,
    this.onOpenCourt,
  });

  @override
  Widget build(BuildContext context) {
    final typeLabel = event.type.trim().isEmpty
        ? 'EVENT'
        : event.type.replaceAll('_', ' ').toUpperCase();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Pill(
          icon: Icons.event_note,
          text: typeLabel,
          color: Colors.white70,
        ),
        const SizedBox(height: 12),
        Text(
          event.title,
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: highlighted ? FontWeight.w800 : FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${event.dayLabel} • ${event.timeLabel}',
          style: TextStyle(
            color: highlighted
                ? Colors.white.withValues(alpha: 0.92)
                : Colors.white.withValues(alpha: 0.72),
            fontSize: 14,
            fontWeight: highlighted ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        if (event.court.name != null) ...[
          const SizedBox(height: 12),
          InkWell(
            onTap: onOpenCourt,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.place, color: Colors.white70, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      event.court.name!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.white54),
                ],
              ),
            ),
          ),
        ],
        if (onOpenCourt != null) ...[
          const SizedBox(height: 14),
          _ActionButton(
            icon: Icons.place_outlined,
            label: 'Court',
            onTap: onOpenCourt!,
            color: Colors.white70,
          ),
        ],
      ],
    );
  }
}

class _ParticipantAvatar extends StatelessWidget {
  final CalendarParticipantInfo participant;

  const _ParticipantAvatar({required this.participant});

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 18,
      backgroundColor: Colors.grey[900],
      backgroundImage: participant.photoUrl != null
          ? safeImageProvider(participant.photoUrl!)
          : null,
      child: participant.photoUrl == null
          ? Text(
              participant.name.isNotEmpty
                  ? participant.name[0].toUpperCase()
                  : '?',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            )
          : null,
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = const Color(0xFF00C853),
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;

  const _Pill({
    required this.icon,
    required this.text,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 5),
          Text(
            text,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w800,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

String _confirmedCountLabel(int count, int maxPlayers) {
  final safeCapacity = maxPlayers <= 0 ? 15 : maxPlayers;
  final confirmedLabel = count == 1 ? '1 confirmed IN' : '$count confirmed IN';
  return '$confirmedLabel • $count/$safeCapacity';
}

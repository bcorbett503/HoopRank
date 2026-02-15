import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'package:hooprank/firebase_options.dart';
import 'package:hooprank/services/api_service.dart';

/// One-off end-to-end smoke checks that exercise:
/// - Firebase auth token usage (Bearer token)
/// - Court followers endpoint (/courts/:id/followers)
/// - User profile includes kingCourtsCount (computed on backend)
///
/// Run (simulator):
///   flutter run -d "iPhone 17 Pro" -t tool/e2e_smoke.dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(const _E2ESmokeApp());
}

class _E2ESmokeApp extends StatelessWidget {
  const _E2ESmokeApp();

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: _E2ESmokeScreen(),
    );
  }
}

class _E2ESmokeScreen extends StatefulWidget {
  const _E2ESmokeScreen();

  @override
  State<_E2ESmokeScreen> createState() => _E2ESmokeScreenState();
}

class _E2ESmokeScreenState extends State<_E2ESmokeScreen> {
  String _status = 'Starting…';

  @override
  void initState() {
    super.initState();
    unawaited(_run());
  }

  Future<void> _run() async {
    final startedAt = DateTime.now();
    final failures = <String>[];

    void pass(String name, [String detail = '']) {
      debugPrint('✅ E2E_SMOKE: $name${detail.isEmpty ? '' : ' — $detail'}');
    }

    void fail(String name, [String detail = '']) {
      final msg = '❌ E2E_SMOKE: $name${detail.isEmpty ? '' : ' — $detail'}';
      debugPrint(msg);
      failures.add(msg);
    }

    void setStatus(String s) {
      debugPrint('ℹ️  E2E_SMOKE: $s');
      if (!mounted) return;
      setState(() => _status = s);
    }

    try {
      setStatus('Checking Firebase session…');
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        fail(
          'FirebaseAuth.currentUser',
          'null (login required). Open the main app, log in, then rerun.',
        );
        setStatus('FAILED: not logged in.');
        return;
      }
      ApiService.setUserId(user.uid);
      pass('FirebaseAuth.currentUser', user.uid);

      // Ensure follow state doesn't permanently change.
      const courtId = 'site-1'; // Equinox (exists in prod DB + local fixtures)

      setStatus('Fetching follows…');
      final follows = await ApiService.getFollows();
      final courts = (follows['courts'] is List) ? follows['courts'] as List : [];
      final wasFollowing = courts.any((c) {
        if (c is Map) {
          final cid = (c['courtId'] ?? c['court_id'])?.toString();
          return cid == courtId;
        }
        return false;
      });
      pass('GET /users/me/follows', 'wasFollowing=$wasFollowing');

      var followedForTest = false;
      if (!wasFollowing) {
        setStatus('Following court $courtId…');
        final ok = await ApiService.followCourt(courtId);
        if (ok) {
          followedForTest = true;
          pass('POST /users/me/follows/courts', courtId);
        } else {
          fail('POST /users/me/follows/courts', 'returned false');
        }
      }

      setStatus('Fetching court followers…');
      final followers = await ApiService.getCourtFollowers(courtId, limit: 20);
      pass('GET /courts/:id/followers', '${followers.length} followers');

      if (followers.isEmpty) {
        fail('followers non-empty', 'no followers returned for $courtId');
      } else {
        // Validate ordering by HoopRank # (rank ascending = better).
        var okOrder = true;
        for (var i = 1; i < followers.length; i++) {
          final a = followers[i - 1].rank;
          final b = followers[i].rank;
          if (a != null && b != null && a > b) {
            okOrder = false;
            break;
          }
        }
        if (okOrder) {
          pass('followers sort', 'by rank asc');
        } else {
          fail('followers sort', 'not sorted by rank asc');
        }

        final king = followers.first;
        pass(
          'king candidate',
          '${king.name} (rank=${king.rank?.toString() ?? '—'}, rating=${king.rating.toStringAsFixed(2)})',
        );

        setStatus('Fetching king profile…');
        final profile = await ApiService.getProfile(king.id);
        if (profile == null) {
          fail('GET /users/:id', 'profile null for ${king.id}');
        } else {
          final rawCount = profile['kingCourtsCount'] ?? profile['king_courts_count'];
          final parsedCount = rawCount is num
              ? rawCount.toInt()
              : int.tryParse(rawCount?.toString() ?? '');
          if (parsedCount == null) {
            fail('kingCourtsCount', 'missing/unparseable (raw=$rawCount)');
          } else {
            pass('kingCourtsCount', parsedCount.toString());
          }
        }
      }

      // Cleanup: revert follow if we only followed for this smoke test.
      if (followedForTest) {
        setStatus('Unfollowing court $courtId (cleanup)…');
        final ok = await ApiService.unfollowCourt(courtId);
        if (ok) {
          pass('DELETE /users/me/follows/courts/:id', courtId);
        } else {
          fail('DELETE /users/me/follows/courts/:id', 'returned false');
        }
      }
    } catch (e, st) {
      debugPrint('❌ E2E_SMOKE: Unhandled exception: $e');
      if (kDebugMode) debugPrint(st.toString());
      failures.add('Unhandled exception: $e');
    } finally {
      final elapsed = DateTime.now().difference(startedAt);
      if (failures.isEmpty) {
        setStatus('PASS (${elapsed.inSeconds}s)');
        debugPrint('✅ E2E_SMOKE: PASS (${elapsed.inSeconds}s)');
      } else {
        setStatus('FAIL (${failures.length} failures)');
        debugPrint('❌ E2E_SMOKE: FAIL (${failures.length} failures)');
        for (final f in failures) {
          debugPrint('   $f');
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              _status,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
          ),
        ),
      ),
    );
  }
}

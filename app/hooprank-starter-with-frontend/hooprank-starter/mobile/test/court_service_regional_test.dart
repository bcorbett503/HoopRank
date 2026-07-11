import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/models.dart';
import 'package:hooprank/services/court_service.dart';

Court _court(String id,
    {String? name, double lat = 37.7, double lng = -122.4}) {
  return Court(id: id, name: name ?? 'Court $id', lat: lat, lng: lng);
}

void main() {
  final service = CourtService();

  setUp(() {
    service.resetForTesting();
  });

  tearDown(() {
    service.resetForTesting();
  });

  test('region fetch merges server courts and dedupes covered cells', () async {
    var fetchCount = 0;
    service.bboxLoaderOverride = ({
      required double south,
      required double west,
      required double north,
      required double east,
      int limit = 1000,
    }) async {
      fetchCount++;
      return [_court('uuid-1'), _court('uuid-2')];
    };

    await service.ensureRegionLoaded(37.6, -122.5, 37.8, -122.3);
    expect(service.getCourtById('uuid-1'), isNotNull);
    expect(service.getCourts().length, 2);
    expect(fetchCount, 1);

    // Same viewport again: all cells fresh, no refetch.
    await service.ensureRegionLoaded(37.6, -122.5, 37.8, -122.3);
    expect(fetchCount, 1);
  });

  test('server rows overwrite earlier rows; merge notifies listeners',
      () async {
    var notifications = 0;
    service.addListener(() => notifications++);
    service.bboxLoaderOverride = ({
      required double south,
      required double west,
      required double north,
      required double east,
      int limit = 1000,
    }) async {
      return [_court('uuid-1', name: 'Fresh Name')];
    };

    await service.ensureRegionLoaded(37.6, -122.5, 37.8, -122.3);
    expect(service.getCourtById('uuid-1')!.name, 'Fresh Name');
    expect(notifications, greaterThan(0));
  });

  test('refetching identical rows does not notify (no fetch/notify loop)',
      () async {
    service.bboxLoaderOverride = ({
      required double south,
      required double west,
      required double north,
      required double east,
      int limit = 1000,
    }) async {
      return [_court('uuid-1'), _court('uuid-2')];
    };

    await service.ensureRegionLoaded(37.6, -122.5, 37.8, -122.3);
    var notifications = 0;
    service.addListener(() => notifications++);

    // Different bbox, same rows — merge must detect nothing changed.
    await service.ensureRegionLoaded(38.6, -121.5, 38.8, -121.3);
    expect(notifications, 0);
  });

  test('country-scale bboxes are not fetched', () async {
    var fetchCount = 0;
    service.bboxLoaderOverride = ({
      required double south,
      required double west,
      required double north,
      required double east,
      int limit = 1000,
    }) async {
      fetchCount++;
      return [];
    };

    await service.ensureRegionLoaded(25.0, -125.0, 49.0, -66.0);
    expect(fetchCount, 0);
  });

  test('empty-cache lookups stay null (deep-link contract)', () {
    expect(service.getCourtById('missing'), isNull);
    expect(service.findCourt(id: 'missing'), isNull);
    expect(service.findCourt(lat: 1.0, lng: 1.0), isNull);
  });
}

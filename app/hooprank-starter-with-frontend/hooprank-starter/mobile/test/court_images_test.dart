import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/models.dart';
import 'package:hooprank/utils/court_images.dart';

void main() {
  test('court marker image prefers sourced court photos', () {
    final court = Court(
      id: 'court-1',
      name: 'Photo Court',
      lat: 37.78,
      lng: -122.42,
      imageUrl: 'https://cdn.example.com/court.jpg',
    );

    expect(
      courtMarkerImageUrlFor(court),
      'https://cdn.example.com/court.jpg',
    );
  });

  test('court marker image falls back to bundled court assets', () {
    final regular = Court(
      id: 'court-2',
      name: 'Regular Court',
      lat: 37.78,
      lng: -122.42,
    );
    final signature = Court(
      id: 'court-3',
      name: 'Signature Court',
      lat: 37.78,
      lng: -122.42,
      isSignature: true,
    );
    final king = Court(
      id: 'court-4',
      name: 'King Court',
      lat: 37.78,
      lng: -122.42,
      king5v5: 'Maya Buckets',
    );

    expect(courtMarkerImageUrlFor(regular), 'assets/court_marker.png');
    expect(
      courtMarkerImageUrlFor(signature),
      'assets/court_marker_signature_crown.jpg',
    );
    expect(courtMarkerImageUrlFor(king), 'assets/court_marker_king.png');
  });
}

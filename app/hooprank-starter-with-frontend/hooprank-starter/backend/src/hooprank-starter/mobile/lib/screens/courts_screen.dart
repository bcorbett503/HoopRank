import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../state/store.dart';

class CourtsScreen extends StatelessWidget {
  const CourtsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<HoopRankStore>();

    return Scaffold(
      appBar: AppBar(title: const Text('Courts')),
      body: Column(
        children: [
          Expanded(
            flex: 1,
            child: FlutterMap(
              options: const MapOptions(
                initialCenter: LatLng(34.0522, -118.2437), // LA
                initialZoom: 10,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                ),
                MarkerLayer(
                  markers: store.courts.map((c) => Marker(
                    point: LatLng(c.lat, c.lng),
                    width: 40,
                    height: 40,
                    child: const Icon(Icons.sports_basketball, color: Colors.orange, size: 30),
                  )).toList(),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 1,
            child: ListView.builder(
              itemCount: store.courts.length,
              itemBuilder: (context, index) {
                final court = store.courts[index];
                return ListTile(
                  leading: const Icon(Icons.place),
                  title: Text(court.name),
                  subtitle: Text(court.address ?? 'No address'),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

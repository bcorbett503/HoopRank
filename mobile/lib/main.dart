import 'package:flutter/material.dart';

/// These are injected by the GitHub Actions build step via --dart-define.
/// Defaults are safe for local/dev runs.
const appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '0.1.0');
const buildSha   = String.fromEnvironment('BUILD_SHA',   defaultValue: 'dev');
const buildTime  = String.fromEnvironment('BUILD_TIME',  defaultValue: '');

void main() => runApp(const HoopRankApp());

class HoopRankApp extends StatelessWidget {
  const HoopRankApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HoopRank',
      theme: ThemeData(useMaterial3: true),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _index = 0;

  final _pages = const <Widget>[
    Center(child: Text('Play')),
    Center(child: Text('Discover Players')),
    Center(child: Text('Discover Courts')),
  ];

  @override
  Widget build(BuildContext context) {
    final header = 'HoopRank • $appVersion • $buildSha';

    return Scaffold(
      appBar: AppBar(title: Text(header)),
      body: _pages[_index],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.sports_basketball),
            label: 'Play',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people),
            label: 'Discover Players',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.map),
            label: 'Discover Courts',
          ),
        ],
      ),
    );
  }
}

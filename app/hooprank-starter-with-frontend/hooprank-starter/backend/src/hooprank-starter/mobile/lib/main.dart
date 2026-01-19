import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'state/store.dart';
import 'screens/auth_screen.dart';
import 'screens/shell.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => HoopRankStore()..init(),
      child: const HoopRankApp(),
    ),
  );
}

class HoopRankApp extends StatelessWidget {
  const HoopRankApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HoopRank',
      theme: ThemeData(
        primarySwatch: Colors.orange,
        useMaterial3: true,
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<HoopRankStore>();
    
    if (store.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    
    return store.me != null ? const Shell() : const AuthScreen();
  }
}

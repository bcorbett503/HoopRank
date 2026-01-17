import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../services/api_service.dart';
import '../models.dart';

class MatchSetupScreen extends StatefulWidget {
  const MatchSetupScreen({super.key});

  @override
  State<MatchSetupScreen> createState() => _MatchSetupScreenState();
}

class _MatchSetupScreenState extends State<MatchSetupScreen> {
  String _search = '';
  List<User> _players = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPlayers();
  }

  Future<void> _loadPlayers() async {
    try {
      final players = await ApiService.getPlayers();
      final me = Provider.of<AuthState>(context, listen: false).currentUser;
      if (mounted) {
        setState(() {
          // Filter out current user
          _players = players.where((p) => p.id != me?.id).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading players: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final match = context.watch<MatchState>();
    final me = auth.currentUser;
    
    final filteredPlayers = _players.where((p) => 
      p.name.toLowerCase().contains(_search.toLowerCase())
    ).toList();

    final canStart = match.opponent != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Set up your match')),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Mode: 1 v 1', style: TextStyle(color: Colors.grey)),
                  const Divider(),
                  // Only show player picker if opponent not already set
                  if (match.opponent == null) ...[
                    const Text('Choose opponent', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextField(
                      decoration: const InputDecoration(
                        hintText: 'Search players...',
                        prefixIcon: Icon(Icons.search),
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 16),
                      ),
                      onChanged: (val) => setState(() => _search = val),
                    ),
                    const SizedBox(height: 16),
                    if (_isLoading)
                      const Center(child: CircularProgressIndicator())
                    else if (filteredPlayers.isEmpty)
                      Center(
                        child: Column(
                          children: [
                            Icon(Icons.person_search, size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 8),
                            Text(
                              _search.isEmpty ? 'No players found' : 'No players match "$_search"',
                              style: TextStyle(color: Colors.grey[500]),
                            ),
                          ],
                        ),
                      )
                    else
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 2.5,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                        ),
                        itemCount: filteredPlayers.length,
                        itemBuilder: (context, index) {
                          final p = filteredPlayers[index];
                          final isSelected = match.opponent?.id == p.id;
                          return InkWell(
                            onTap: () => match.setOpponent(p.toPlayer()),
                            child: Container(
                              decoration: BoxDecoration(
                                color: isSelected ? Colors.deepOrange.withOpacity(0.1) : Colors.white,
                                border: Border.all(color: isSelected ? Colors.deepOrange : Colors.grey.shade300),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              padding: const EdgeInsets.all(8),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  Text('Rating: ${p.rating.toStringAsFixed(1)}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                  ] else ...[
                    // Show matchup when opponent is already set
                    const SizedBox(height: 32),
                    Center(
                      child: Column(
                        children: [
                          const Text('Match Ready!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 16),
                          Text(
                            'You accepted a challenge from ${match.opponent?.name ?? "opponent"}',
                            style: const TextStyle(color: Colors.grey, fontSize: 14),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 32),
                          const Icon(Icons.sports_basketball, size: 80, color: Colors.deepOrange),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4, offset: const Offset(0, -2))],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('You', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(me?.name ?? 'Me', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const Text('VS', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Opponent', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(match.opponent?.name ?? '—', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: canStart
                        ? () {
                            match.startMatch();
                            context.go('/match/live');
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.deepOrange,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: const Text('Start Game'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

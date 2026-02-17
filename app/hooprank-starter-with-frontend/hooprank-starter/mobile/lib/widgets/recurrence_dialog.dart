import 'package:flutter/material.dart';

// Recurrence options dialog for game scheduling
class RecurrenceDialog extends StatefulWidget {
  final bool isRecurring;
  final String recurrenceType;

  const RecurrenceDialog({
    super.key,
    required this.isRecurring,
    required this.recurrenceType,
  });

  @override
  State<RecurrenceDialog> createState() => _RecurrenceDialogState();
}

class _RecurrenceDialogState extends State<RecurrenceDialog> {
  late bool _isRecurring;
  late String _recurrenceType;

  @override
  void initState() {
    super.initState();
    _isRecurring = widget.isRecurring;
    _recurrenceType = widget.recurrenceType;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.grey[900],
      title:
          const Text('Schedule Options', style: TextStyle(color: Colors.white)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SwitchListTile(
            title: const Text('Recurring Event',
                style: TextStyle(color: Colors.white)),
            subtitle: Text(
              _isRecurring ? 'Creates 10 scheduled games' : 'One-time event',
              style: TextStyle(color: Colors.grey[400], fontSize: 12),
            ),
            value: _isRecurring,
            activeColor: Colors.deepOrange,
            onChanged: (value) => setState(() => _isRecurring = value),
          ),
          if (_isRecurring) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _recurrenceType = 'weekly'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _recurrenceType == 'weekly'
                            ? Colors.deepOrange
                            : Colors.grey[800],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Center(
                        child: Text('Weekly',
                            style: TextStyle(color: Colors.white)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _recurrenceType = 'daily'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _recurrenceType == 'daily'
                            ? Colors.deepOrange
                            : Colors.grey[800],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Center(
                        child: Text('Daily',
                            style: TextStyle(color: Colors.white)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(context, {
            'isRecurring': _isRecurring,
            'recurrenceType': _recurrenceType,
          }),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange),
          child: const Text('Confirm'),
        ),
      ],
    );
  }
}

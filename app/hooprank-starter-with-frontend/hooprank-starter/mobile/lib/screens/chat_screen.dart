import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../models.dart';
import '../services/messages_service.dart';
import '../services/api_service.dart';

class ChatScreen extends StatefulWidget {
  final User? otherUser;
  final String? userId; // Can pass userId instead of User object

  const ChatScreen({super.key, this.otherUser, this.userId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final MessagesService _messagesService = MessagesService();
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode(); // For keyboard auto-focus
  List<Message> _messages = [];
  bool _isLoading = true;
  User? _otherUser;

  @override
  void initState() {
    super.initState();
    debugPrint('>>> ChatScreen initState - userId: ${widget.userId}, otherUser: ${widget.otherUser}');
    _initChat();
  }

  Future<void> _initChat() async {
    debugPrint('>>> ChatScreen _initChat starting');
    // Use provided User or fetch by userId
    if (widget.otherUser != null) {
      debugPrint('>>> ChatScreen: using provided otherUser');
      _otherUser = widget.otherUser;
    } else if (widget.userId != null && widget.userId!.isNotEmpty) {
      debugPrint('>>> ChatScreen: fetching user by id: ${widget.userId}');
      try {
        final userData = await ApiService.getProfile(widget.userId!);
        debugPrint('>>> ChatScreen: getProfile returned: $userData');
        if (userData != null) {
          _otherUser = User.fromJson(userData);
          debugPrint('>>> ChatScreen: parsed user: $_otherUser');
        } else {
          debugPrint('>>> ChatScreen: getProfile returned null');
        }
      } catch (e, stack) {
        debugPrint('>>> ChatScreen: Error fetching user: $e');
        debugPrint('>>> Stack: $stack');
      }
    } else {
      debugPrint('>>> ChatScreen: no userId or otherUser provided');
    }
    
    if (_otherUser != null) {
      debugPrint('>>> ChatScreen: loading messages');
      await _loadMessages();
    } else {
      debugPrint('>>> ChatScreen: _otherUser is null, setting isLoading=false');
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMessages() async {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    if (userId == null || _otherUser == null) return;

    try {
      final messages = await _messagesService.getMessages(userId, _otherUser!.id);
      // Mark all messages from the other user as read
      await _messagesService.markConversationAsRead(userId, _otherUser!.id);
      setState(() {
        _messages = messages;
        _isLoading = false;
      });
      _scrollToBottom();
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading messages: $e')),
      );
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
      }
    });
  }

  Future<void> _sendMessage() async {
    if (_controller.text.trim().isEmpty) return;

    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;
    
    // Debug logging
    debugPrint('=== SEND MESSAGE DEBUG ===');
    debugPrint('userId (sender): $userId');
    debugPrint('_otherUser: $_otherUser');
    debugPrint('_otherUser?.id: ${_otherUser?.id}');
    debugPrint('content: ${_controller.text.trim()}');
    
    if (userId == null || _otherUser == null) {
      // Show visible error so user can see what's null
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('DEBUG: userId=$userId, otherUser=${_otherUser?.id ?? "NULL"}')),
      );
      return;
    }

    final content = _controller.text.trim();
    _controller.clear();

    try {
      final message = await _messagesService.sendMessage(userId, _otherUser!.id, content);
      setState(() {
        _messages.add(message);
      });
      _scrollToBottom();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error sending message: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId = Provider.of<AuthState>(context, listen: false).currentUser?.id;

    return Scaffold(
      appBar: AppBar(
        title: Text(_otherUser?.name ?? 'Chat'),
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final message = _messages[index];
                      final isMe = message.senderId == userId;
                      return Align(
                        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                          decoration: BoxDecoration(
                            color: message.isChallenge
                                ? Colors.orange.shade100
                                : (isMe ? Colors.blue : Colors.grey[300]),
                            borderRadius: BorderRadius.circular(12),
                            border: message.isChallenge
                                ? Border.all(color: Colors.orange, width: 2)
                                : null,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (message.isChallenge)
                                const Padding(
                                  padding: EdgeInsets.only(bottom: 4),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.sports_basketball, size: 16, color: Colors.orange),
                                      SizedBox(width: 4),
                                      Text(
                                        'CHALLENGE',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.orange,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              Text(
                                message.content,
                                style: TextStyle(
                                  color: message.isChallenge
                                      ? Colors.black87
                                      : (isMe ? Colors.white : Colors.black),
                                  fontWeight: message.isChallenge ? FontWeight.w500 : FontWeight.normal,
                                ),
                              ),
                              if (message.matchId != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(
                                    'Match ID: ${message.matchId}',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontStyle: FontStyle.italic,
                                      color: isMe ? Colors.white70 : Colors.black54,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    autofocus: true, // Auto-focus when screen opens
                    style: const TextStyle(color: Colors.black),
                    decoration: InputDecoration(
                      hintText: 'Type a message...',
                      hintStyle: TextStyle(color: Colors.grey.shade600),
                      filled: true,
                      fillColor: Colors.grey.shade100,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                CircleAvatar(
                  backgroundColor: Colors.blue,
                  child: IconButton(
                    icon: const Icon(Icons.send, color: Colors.white),
                    onPressed: _sendMessage,
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

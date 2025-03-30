import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useChat } from '../../hooks/useChat';
import { COLORS } from '../../utils/constants';
import useUser from '../../hooks/useUser';
import { formatTimestamp } from '../../utils/helpers';

// Message component to render each chat message
const MessageItem = ({ message, isOwnMessage }: any) => {
  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
    ]}>
      {!isOwnMessage && (
        <Text style={styles.messageSender}>{message.sender}</Text>
      )}

      <View style={[
        styles.messageContent,
        isOwnMessage ? styles.ownMessageContent : styles.otherMessageContent
      ]}>
        <Text style={styles.messageText}>{message.content}</Text>
      </View>

      <Text style={[
        styles.messageTimestamp,
        isOwnMessage ? styles.ownMessageTimestamp : styles.otherMessageTimestamp
      ]}>
        {formatTimestamp(message.timestamp)}
      </Text>
    </View>
  );
};

// System message component
const SystemMessage = ({ message }: any) => {
  return (
    <View style={styles.systemMessageContainer}>
      <Text style={styles.systemMessageText}>{message.content}</Text>
      <Text style={styles.systemMessageTimestamp}>
        {formatTimestamp(message.timestamp)}
      </Text>
    </View>
  );
};

// Date header component to show date separators
const DateHeader = ({ date }: any) => {
  return (
    <View style={styles.dateHeaderContainer}>
      <View style={styles.dateHeaderLine} />
      <Text style={styles.dateHeaderText}>{date}</Text>
      <View style={styles.dateHeaderLine} />
    </View>
  );
};

const EnhancedChatRoom = () => {
  const { currentRoom, messages, sendMessage, loadMoreMessages } = useChat();
  const { user } = useUser();
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);


  useEffect(() => {
    console.log("Messages in Room component:", messages, currentRoom);
  }, [messages]);
  // Set room name in header
  useEffect(() => {
    if (currentRoom) {
      navigation.setOptions({
        title: `#${currentRoom.name}`,
      });
    }
  }, [currentRoom, navigation]);

  // Simulate loading state
  useEffect(() => {
    // Set loading to false after messages are loaded or after 2 seconds
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Function to handle sending a message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      await sendMessage(messageText.trim());
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Function to render each message
  const renderItem = ({ item }: any) => {
    // If the message is a system message
    if (item.system) {
      return <SystemMessage message={item} />;
    }

    // Check if the message is from the current user
    const isOwnMessage = user && item.sender === user.name;

    return (
      <MessageItem
        message={item}
        isOwnMessage={isOwnMessage}
      />
    );
  };

  // Function to load more messages (previous/older messages)
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !loadMoreMessages) return;

    loadMoreMessages().catch(err => {
      console.error('Error loading more messages:', err);
    });
  }, [isLoadingMore, loadMoreMessages]);

  // Render the loading indicator for older messages
  const renderFooter = () => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingMoreText}>Loading older messages...</Text>
      </View>
    );
  };

  // Show loading state if messages are still loading
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={true} // Display newest messages at the bottom
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="forum" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No messages yet. Be the first to send a message!</Text>
          </View>
        }
      />

      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !messageText.trim() && styles.disabledButton
          ]}
          onPress={handleSendMessage}
          disabled={!messageText.trim()}
        >
          <MaterialIcons
            name="send"
            size={24}
            color={messageText.trim() ? COLORS.textPrimary : COLORS.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  messagesList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  messageContainer: {
    marginVertical: 6,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  messageContent: {
    padding: 10,
    borderRadius: 16,
  },
  ownMessageContent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageContent: {
    backgroundColor: COLORS.secondaryBackground,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  messageTimestamp: {
    fontSize: 10,
    marginTop: 2,
    alignSelf: 'flex-end',
    color: COLORS.textMuted,
  },
  ownMessageTimestamp: {
    color: COLORS.textSecondary,
  },
  otherMessageTimestamp: {
    color: COLORS.textMuted,
  },
  systemMessageContainer: {
    alignSelf: 'center',
    marginVertical: 10,
    backgroundColor: 'rgba(114, 137, 218, 0.1)',
    padding: 8,
    borderRadius: 12,
    marginHorizontal: 40,
  },
  systemMessageText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  systemMessageTimestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  dateHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.separator,
  },
  dateHeaderText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: COLORS.secondaryBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.input,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  sendButton: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.tertiaryBackground,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
});

export default EnhancedChatRoom;

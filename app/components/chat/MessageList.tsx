import React, { useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text
} from 'react-native';
import { Message } from '../../types';
import MessageItem from './Message';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
}

const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId }) => {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubText}>Start a conversation!</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MessageItem message={item} isOwnMessage={item.userId === currentUserId} />
      )}
      contentContainerStyle={styles.container}
      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#72767d',
    fontWeight: 'bold',
  },
  emptySubText: {
    fontSize: 14,
    color: '#72767d',
    marginTop: 8,
  },
});

export default MessageList;

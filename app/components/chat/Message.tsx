import React from 'react';
import {
  View,
  Text,
  StyleSheet
} from 'react-native';
import { Message } from '../../types';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isOwnMessage }) => {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (message.isSystem) {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>{message.text}</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isOwnMessage ? styles.ownMessageContainer : null
    ]}>
      <Text style={styles.username}>{message.username}</Text>
      <View style={styles.messageContent}>
        <Text style={styles.messageText}>{message.text}</Text>
        <Text style={styles.timestamp}>{formatTimestamp(message.timestamp)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    flexDirection: 'column',
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  username: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  messageContent: {
    backgroundColor: '#40444b',
    borderRadius: 4,
    padding: 10,
    maxWidth: '85%',
  },
  messageText: {
    color: '#dcddde',
    fontSize: 16,
  },
  timestamp: {
    color: '#72767d',
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    color: '#72767d',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default MessageItem;

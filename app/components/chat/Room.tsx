import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Room as RoomType, Message, User } from '../../types';
import RoomHeader from './RoomHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

interface RoomProps {
  room: RoomType;
  messages: Message[];
  onlineUsers: User[];
  currentUserId: string;
  onBackPress: () => void;
  onSendMessage: (text: string) => void;
}

const Room: React.FC<RoomProps> = ({
  room,
  messages,
  onlineUsers,
  currentUserId,
  onBackPress,
  onSendMessage
}) => {
  return (
    <View style={styles.container}>
      <RoomHeader room={room} onBackPress={onBackPress} />

      <View style={styles.content}>
        <View style={styles.chatArea}>
          <MessageList messages={messages} currentUserId={currentUserId} />
          <MessageInput onSendMessage={onSendMessage} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#36393f',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  chatArea: {
    flex: 1,
    flexDirection: 'column',
  },
});

export default Room;

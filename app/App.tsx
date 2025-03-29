import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';

import Login from './components/auth/Login';
import Register from './components/auth/Register';
import RoomList from './components/chat/RoomList';
import Room from './components/chat/Room';
import { COLORS } from './utils/constants';

const App: React.FC = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { rooms, currentRoom, messages, onlineUsers, selectRoom, leaveRoom, sendMessage } = useChat();
  const [showRegister, setShowRegister] = useState(false);

  // Handle back button press
  const handleBackToRooms = () => {
    leaveRoom();
  };

  // Handle message send
  const handleSendMessage = (text: string) => {
    sendMessage(text);
  };

  // Not authenticated - show login/register
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        {showRegister ? (
          <Register onLoginPress={() => setShowRegister(false)} />
        ) : (
          <Login
            onRegisterPress={() => setShowRegister(true)}
          />
        )}
      </View>
    );
  }

  // Authenticated but no room selected - show room list
  if (!currentRoom) {
    return (
      <View style={styles.container}>
        <RoomList
          rooms={rooms}
          onSelectRoom={selectRoom}
          currentRoomId={null}
        />
      </View>
    );
  }

  // Room selected - show room
  return (
    <View style={styles.container}>
      <Room
        room={currentRoom}
        messages={messages.filter(m => m.roomId === currentRoom.id)}
        onlineUsers={onlineUsers}
        currentUserId={user?.id || ''}
        onBackPress={handleBackToRooms}
        onSendMessage={handleSendMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

export default App;

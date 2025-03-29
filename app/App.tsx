import React, { useState } from 'react';
import { StyleSheet, View, SafeAreaView, Text } from 'react-native';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';

import Login from './components/auth/Login';
import Register from './components/auth/Register';
import RoomList from './components/chat/RoomList';
import Room from './components/chat/Room';
import UserList from './components/chat/UserList';
import { SwipeableDrawerLayout } from './components';
import { COLORS } from './utils/constants';

const App: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
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

  // Create the left drawer content - room list
  const leftDrawer = (
    <RoomList
      rooms={rooms}
      onSelectRoom={selectRoom}
      currentRoomId={currentRoom?.id || null}
    />
  );

  // Create the right drawer content - user list (only if a room is selected)
  const rightDrawer = currentRoom && (
    <UserList
      users={onlineUsers}
      currentUserId={user?.id || ''}
    />
  );

  // Main content - room or empty state
  const mainContent = currentRoom ? (
    <Room
      room={currentRoom}
      messages={messages.filter(m => m.roomId === currentRoom.id)}
      onlineUsers={onlineUsers}
      currentUserId={user?.id || ''}
      onBackPress={handleBackToRooms}
      onSendMessage={handleSendMessage}
    />
  ) : (
    <View style={styles.emptyContainer}>
      {/* Empty state / welcome screen when no room selected */}
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeTitle}>Welcome to Chat App</Text>
          <Text style={styles.welcomeDesc}>Select a channel to start chatting</Text>
          <Text style={styles.welcomeTip}>Swipe from left to see channels</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <SwipeableDrawerLayout
        leftDrawer={leftDrawer}
        rightDrawer={rightDrawer}
        showRightDrawer={!!currentRoom}
      >
        {mainContent}
      </SwipeableDrawerLayout>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  welcomeContainer: {
    padding: 20,
    alignItems: 'center',
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  welcomeDesc: {
    fontSize: 16,
    color: '#b9bbbe',
    marginBottom: 24,
  },
  welcomeTip: {
    fontSize: 14,
    color: '#7289da',
    fontStyle: 'italic',
  },
});

export default App;

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../../hooks/useChat';
import { Room, Message } from '../../types';
import { COLORS } from '../../utils/constants';
import { filterRooms, formatTimestamp } from '../../utils/helpers';
import CreateRoomModal from './CreateRoomModal';
import JoinRoomModal from './JoinRoomModal';
import useWorklet from '../../hooks/useWorklet';

// Helper function to truncate message text
const truncateMessage = (text: string, maxLength: number = 30): string => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

const RoomListScreen = () => {
  const { rooms, messagesByRoom, selectRoom, refreshRooms, createRoom } = useChat();
  const { rpcClient, setCallbacks } = useWorklet();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Sort rooms by most recent message
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aMessages = messagesByRoom[a.id] || [];
      const bMessages = messagesByRoom[b.id] || [];

      const aLatestTime = aMessages.length > 0 ? aMessages[0]?.timestamp || 0 : (a.createdAt || 0);
      const bLatestTime = bMessages.length > 0 ? bMessages[0]?.timestamp || 0 : (b.createdAt || 0);

      // Sort in descending order (newest first)
      return bLatestTime - aLatestTime;
    });
  }, [rooms, messagesByRoom]);

  useEffect(() => {
    // Load rooms when component mounts
    setIsLoading(true);
    refreshRooms().finally(() => setIsLoading(false));

    // Set up callback for room join results
    setCallbacks({
      onRoomJoined: handleRoomJoined
    });

    return () => {
      // Reset callbacks when component unmounts to avoid memory leaks
      setCallbacks({
        onRoomJoined: undefined
      });
    };
  }, []);

  // Filter rooms when search query or sorted rooms list changes
  useEffect(() => {
    setFilteredRooms(filterRooms(sortedRooms, searchQuery));
  }, [sortedRooms, searchQuery]);

  const handleSelectRoom = async (room: Room) => {
    await selectRoom(room);
    // @ts-ignore
    navigation.navigate('Chat', { roomName: room.name });
  };

  const handleCreateRoom = () => {
    setCreateModalVisible(true);
  };

  const handleJoinRoom = () => {
    setJoinModalVisible(true);
  };

  const handleRoomJoined = (room: Room) => {
    console.log('Room joined successfully:', room);
    refreshRooms();
    Alert.alert('Success', `You've joined the room: ${room.name}`);
  };

  const handleRoomCreated = async (roomName: string, roomDescription: string) => {
    setIsLoading(true);
    try {
      const result = await createRoom(roomName, roomDescription);
      if (!result.success) {
        Alert.alert('Error', 'Failed to create room. Please try again.');
      } else {
        console.log('Room created successfully, awaiting refresh');
        // Refresh rooms to get the new room in the list
        await refreshRooms();
      }
    } catch (error) {
      console.error('Error creating room:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  // Get the latest message for a room
  const getLatestMessage = (roomId: string): Message | null => {
    const messages = messagesByRoom[roomId] || [];
    return messages.length > 0 ? messages[0] : null;
  };

  const renderRoomItem = ({ item }: { item: Room }) => {
    const latestMessage = getLatestMessage(item.id);

    return (
      <TouchableOpacity style={styles.roomItem} onPress={() => handleSelectRoom(item)}>
        <View style={styles.roomIcon}>
          <Text style={styles.roomInitial}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>#{item.name}</Text>

          {latestMessage ? (
            <View style={styles.messagePreviewContainer}>
              <Text style={styles.messageSender}>
                {latestMessage.system ? 'System' : latestMessage.sender}:
              </Text>
              <Text style={styles.messagePreview} numberOfLines={1}>
                {truncateMessage(latestMessage.content)}
              </Text>
              <Text style={styles.messageTime}>
                {formatTimestamp(latestMessage.timestamp)}
              </Text>
            </View>
          ) : (
            <Text style={styles.roomDescription}>{item.description}</Text>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Rooms</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.joinButton} onPress={handleJoinRoom}>
            <MaterialIcons name="group-add" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateRoom}>
            <MaterialIcons name="add" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search rooms..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={handleSearchChange}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading rooms...</Text>
        </View>
      ) : filteredRooms.length > 0 ? (
        <FlatList
          data={filteredRooms}
          renderItem={renderRoomItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.roomList}
          onRefresh={refreshRooms}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="forum" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>No rooms found</Text>
          <View style={styles.emptyStateButtons}>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={handleCreateRoom}
            >
              <MaterialIcons name="add" size={20} color={COLORS.textPrimary} />
              <Text style={styles.emptyStateButtonText}>Create a Room</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emptyStateButton, styles.joinEmptyButton]}
              onPress={handleJoinRoom}
            >
              <MaterialIcons name="group-add" size={20} color={COLORS.textPrimary} />
              <Text style={styles.emptyStateButtonText}>Join a Room</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <CreateRoomModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onRoomCreated={handleRoomCreated}
      />

      <JoinRoomModal
        visible={joinModalVisible}
        onClose={() => setJoinModalVisible(false)}
        onRoomJoined={handleRoomJoined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  joinButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  roomList: {
    paddingHorizontal: 16,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  roomIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roomInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  roomDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  messagePreview: {
    fontSize: 14,
    color: COLORS.textMuted,
    flex: 1,
  },
  messageTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  emptyStateButtons: {
    flexDirection: 'column',
    width: '80%',
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  joinEmptyButton: {
    backgroundColor: COLORS.primaryDark,
  },
  emptyStateButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default RoomListScreen;

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../../hooks/useChat';
import { Room } from '../../types';
import { COLORS } from '../../utils/constants';
import { filterRooms } from '../../utils/helpers';
import CreateRoomModal from './CreateRoomModal';

const RoomListScreen = () => {
  const { rooms, selectRoom, refreshRooms, createRoom } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRooms, setFilteredRooms] = useState<Room[]>(rooms);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Load rooms when component mounts
    setIsLoading(true);
    refreshRooms().finally(() => setIsLoading(false));
  }, []);

  // Filter rooms when search query or rooms list changes
  useEffect(() => {
    setFilteredRooms(filterRooms(rooms, searchQuery));
  }, [rooms, searchQuery]);

  const handleSelectRoom = async (room: Room) => {
    await selectRoom(room);
    // @ts-ignore
    navigation.navigate('Chat', { roomName: room.name });
  };

  const handleCreateRoom = () => {
    setCreateModalVisible(true);
  };

  const handleRoomCreated = async (roomName: string, roomDescription: string) => {
    setIsLoading(true);
    try {
      const result = await createRoom(roomName, roomDescription);

      if (result.success) {
        // Wait a moment for backend to update, then refresh the list
        setTimeout(() => {
          refreshRooms().finally(() => setIsLoading(false));
        }, 500);
      } else {
        Alert.alert('Error', 'Failed to create room. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const renderRoomItem = ({ item }: { item: Room }) => (
    <TouchableOpacity style={styles.roomItem} onPress={() => handleSelectRoom(item)}>
      <View style={styles.roomIcon}>
        <Text style={styles.roomInitial}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.roomInfo}>
        <Text style={styles.roomName}>#{item.name}</Text>
        <Text style={styles.roomDescription}>{item.description}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Rooms</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateRoom}>
          <MaterialIcons name="add" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.createEmptyButton}
            onPress={handleCreateRoom}
          >
            <MaterialIcons name="add" size={20} color={COLORS.textPrimary} />
            <Text style={styles.createEmptyButtonText}>Create a Room</Text>
          </TouchableOpacity>
        </View>
      )}

      <CreateRoomModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onRoomCreated={handleRoomCreated}
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
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
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
  createEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createEmptyButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default RoomListScreen;

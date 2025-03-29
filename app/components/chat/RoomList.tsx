import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { Room } from '../../types';
import { Ionicons } from '@expo/vector-icons';

interface RoomListProps {
  rooms: Room[];
  onSelectRoom: (room: Room) => void;
  currentRoomId?: string | null;
}

const RoomList: React.FC<RoomListProps> = ({ rooms, onSelectRoom, currentRoomId }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat App</Text>
      </View>

      <Text style={styles.sectionHeader}>Channels</Text>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.roomItem,
              currentRoomId === item.id ? styles.activeRoom : null
            ]}
            onPress={() => onSelectRoom(item)}
          >
            <Ionicons
              name="chatbubble-outline"
              size={18}
              color={currentRoomId === item.id ? "#fff" : "#8e9297"}
              style={styles.roomIcon}
            />
            <Text
              style={[
                styles.roomName,
                currentRoomId === item.id ? styles.activeRoomText : null
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2f3136',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#202225',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionHeader: {
    fontSize: 14,
    color: '#8e9297',
    padding: 16,
    paddingBottom: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  list: {
    flex: 1,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 4,
    marginLeft: 8,
    marginRight: 8,
    marginBottom: 2,
  },
  roomIcon: {
    marginRight: 8,
  },
  activeRoom: {
    backgroundColor: '#393c43',
  },
  roomName: {
    color: '#8e9297',
    fontSize: 16,
  },
  activeRoomText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default RoomList;

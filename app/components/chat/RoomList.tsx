import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { Room } from '../../types';

interface RoomListProps {
  rooms: Room[];
  onSelectRoom: (room: Room) => void;
  currentRoomId?: string | null;
}

const RoomList: React.FC<RoomListProps> = ({ rooms, onSelectRoom, currentRoomId }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Channels</Text>
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
            <Text
              style={[
                styles.roomName,
                currentRoomId === item.id ? styles.activeRoomText : null
              ]}
            >
              # {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2f3136',
    width: '100%',
    maxWidth: 240,
  },
  header: {
    fontSize: 16,
    color: '#8e9297',
    padding: 16,
    paddingBottom: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  roomItem: {
    padding: 10,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 4,
    marginLeft: 8,
    marginRight: 8,
    marginBottom: 2,
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

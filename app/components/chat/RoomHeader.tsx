import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Room } from '../../types';

interface RoomHeaderProps {
  room: Room;
  onBackPress: () => void;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({ room, onBackPress }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>#{room.name}</Text>
        <Text style={styles.description}>{room.description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#36393f',
    borderBottomWidth: 1,
    borderBottomColor: '#2f3136',
    padding: 16,
    height: 60,
  },
  backButton: {
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    color: '#b9bbbe',
    fontSize: 14,
  },
});

export default RoomHeader;

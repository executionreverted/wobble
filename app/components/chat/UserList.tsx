import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet
} from 'react-native';
import { User } from '../../types';
import StatusIndicator from '../common/StatusIndicator';

interface UserListProps {
  users: User[];
  currentUserId: string;
}

const UserList: React.FC<UserListProps> = ({ users, currentUserId }) => {
  // Sort users: online first, then alphabetically
  const sortedUsers = [...users].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Online - {users.filter(user => user.isOnline).length}
      </Text>
      <FlatList
        data={sortedUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <StatusIndicator isOnline={item.isOnline} />
            <Text
              style={[
                styles.username,
                item.id === currentUserId ? styles.currentUser : null,
                !item.isOnline ? styles.offlineUser : null
              ]}
            >
              {item.username} {item.id === currentUserId ? '(you)' : ''}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2f3136',
    minWidth: 200,
    maxWidth: 240,
  },
  header: {
    fontSize: 14,
    color: '#8e9297',
    padding: 16,
    paddingBottom: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  currentUser: {
    fontWeight: 'bold',
  },
  offlineUser: {
    color: '#72767d',
  },
});

export default UserList;

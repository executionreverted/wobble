import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView
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

  // Count online users
  const onlineCount = users.filter(user => user.isOnline).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Members</Text>
      </View>

      <Text style={styles.sectionHeader}>
        Online - {onlineCount}
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
  headerContainer: {
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
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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

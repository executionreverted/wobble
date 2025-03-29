import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../hooks/useChat';
import { COLORS } from '../utils/constants';
import useUser from '../hooks/useUser';

const Home = () => {
  const { user } = useUser();
  const { rooms } = useChat();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const activeRooms = rooms.slice(0, 3); // Just show first 3 rooms for quick access

  const handleViewAllRooms = () => {
    // Navigate to the Rooms tab
    // @ts-ignore
    navigation.navigate('MainTabs', { screen: 'Rooms' });
  };

  const handleJoinRoom = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (room) {

      // @ts-ignore
      navigation.navigate('Chat');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Header with user greeting */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.username || 'User'}</Text>
          <Text style={styles.subGreeting}>Welcome to roombase</Text>
        </View>
        <View style={styles.userAvatar}>
          <Text style={styles.userInitial}>{user?.username?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
      </View>

      {/* Stats summary */}
      <View style={styles.statsContainer}>
        <StatCard
          icon="forum"
          label="Active Rooms"
          value={rooms.length.toString()}
        />
        <StatCard
          icon="people"
          label="Online Users"
          value="5"
          color={COLORS.online}
        />
      </View>

      {/* Quick access to rooms */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Rooms</Text>
        <TouchableOpacity onPress={handleViewAllRooms}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {activeRooms.length > 0 ? (
        <View style={styles.roomsContainer}>
          {activeRooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={styles.roomCard}
              onPress={() => handleJoinRoom(room.id)}
            >
              <View style={styles.roomIcon}>
                <Text style={styles.roomInitial}>{room.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.roomName}>#{room.name}</Text>
              <Text style={styles.roomDesc} numberOfLines={2}>{room.description}</Text>
              <View style={styles.roomFooter}>
                <MaterialIcons name="chevron-right" size={20} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="forum" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No rooms joined yet</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleViewAllRooms}>
            <Text style={styles.emptyButtonText}>Find Rooms</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Features section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Features</Text>
      </View>

      <View style={styles.featuresContainer}>
        <FeatureCard
          icon="lock"
          title="End-to-End Encryption"
          description="All your messages are encrypted and can only be read by participants"
        />
        <FeatureCard
          icon="wifi-off"
          title="Offline Support"
          description="Continue chatting even when offline"
        />
        <FeatureCard
          icon="devices"
          title="Cross-Device Sync"
          description="Your messages sync across all your devices"
        />
      </View>
    </ScrollView>
  );
};

// Stat card component
const StatCard = ({ icon, label, value, color = COLORS.primary }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: color }]}>
      <MaterialIcons name={icon} size={24} color="#fff" />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// Feature card component
const FeatureCard = ({ icon, title, description }: any) => (
  <View style={styles.featureCard}>
    <View style={styles.featureIcon}>
      <MaterialIcons name={icon} size={24} color={COLORS.primary} />
    </View>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDesc}>{description}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  subGreeting: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  viewAll: {
    fontSize: 14,
    color: COLORS.primary,
  },
  roomsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  roomCard: {
    width: '48%',
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  roomIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  roomInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  roomDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  emptyState: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  emptyButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureCard: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(114, 137, 218, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  featureDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default Home;

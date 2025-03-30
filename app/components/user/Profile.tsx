import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/constants';
import useUser from '../../hooks/useUser';
import useWorklet from '../../hooks/useWorklet';

const Profile = () => {
  const { user, updateUser } = useUser();
  const { rpcClient, isInitialized } = useWorklet();
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    status: ''
  });

  // Initialize form data with user data
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        status: user.status || 'Available'
      });
    }
  }, [user]);

  // Handle profile update
  const handleUpdate = async () => {
    if (!user || !rpcClient) return;

    setIsLoading(true);
    try {
      // Call the RPC method to update user profile
      const request = rpcClient.request('updateUserProfile');
      await request.send(JSON.stringify(formData));

      // After successful update, exit edit mode
      setIsEditing(false);

      // Show success message
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form to original data
  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name || '',
        status: user.status || 'Available'
      });
    }
    setIsEditing(false);
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.noUserText}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        {!isEditing && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(true)}
          >
            <MaterialIcons name="edit" size={20} color={COLORS.textPrimary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>User ID</Text>
          <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
            {user.id}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Name</Text>
          {isEditing ? (
            <TextInput
              style={[styles.value, styles.input]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textMuted}
            />
          ) : (
            <Text style={styles.value}>{user.name}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Status</Text>
          {isEditing ? (
            <TextInput
              style={[styles.value, styles.input]}
              value={formData.status}
              onChangeText={(text) => setFormData({ ...formData, status: text })}
              placeholder="Set your status"
              placeholderTextColor={COLORS.textMuted}
            />
          ) : (
            <Text style={styles.value}>{user.status}</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.rooms?.length || 0}</Text>
            <Text style={styles.statLabel}>Rooms</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.contacts?.length || 0}</Text>
            <Text style={styles.statLabel}>Contacts</Text>
          </View>
        </View>
      </View>

      <View style={styles.seedSection}>
        <Text style={styles.sectionTitle}>Recovery Seed Phrase</Text>
        <Text style={styles.seedInfo}>
          Your seed phrase is used to recover your account. Never share it with anyone.
        </Text>
        <TouchableOpacity style={styles.seedButton}>
          <MaterialIcons name="visibility" size={20} color={COLORS.textPrimary} />
          <Text style={styles.seedButtonText}>View Seed Phrase</Text>
        </TouchableOpacity>
      </View>

      {isEditing && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleUpdate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondaryBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    color: COLORS.textPrimary,
    marginLeft: 6,
    fontWeight: '500',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  infoSection: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  input: {
    backgroundColor: COLORS.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  seedSection: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  seedInfo: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.tertiaryBackground,
    paddingVertical: 12,
    borderRadius: 8,
  },
  seedButtonText: {
    color: COLORS.textPrimary,
    marginLeft: 8,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.separator,
    marginRight: 8,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  saveButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  noUserText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
});

export default Profile;

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  Share,
  StatusBar,
  SafeAreaView,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { useChat } from '../../hooks/useChat';
import useUser from '../../hooks/useUser';
import useRoomDetails from '../../hooks/useRoomDetails';

interface RoomDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
}

const RoomDetailsModal: React.FC<RoomDetailsModalProps> = ({
  visible,
  onClose,
  roomId,
}) => {
  const { height } = useWindowDimensions();
  const { user } = useUser();
  const {
    currentRoom,
    sharedMedia,
    sharedFiles,
    roomMembers,
    isLoading,
    isAdmin,
    loadRoomDetails,
    handleLeaveRoom,
    getInviteCode,
    onlineUsers
  } = useRoomDetails(roomId);

  const [tab, setTab] = useState('members'); // 'members', 'media', 'files', 'settings'

  // Fetch room details on mount
  useEffect(() => {
    if (visible && roomId) {
      loadRoomDetails();
    }
  }, [visible, roomId, loadRoomDetails]);

  // Handle sharing room invite
  const handleShareRoom = async () => {
    try {
      const inviteCode = await getInviteCode();

      if (!inviteCode) {
        Alert.alert('Error', 'Could not generate invite code. Please try again.');
        return;
      }

      await Share.share({
        message: `Join my Roombase chat room "${currentRoom?.name}" with this invite code: ${inviteCode}`,
        title: `Join ${currentRoom?.name} on Roombase`
      });

    } catch (error) {
      console.error('Error sharing room invite:', error);
      Alert.alert('Error', 'Failed to share room invite.');
    }
  };

  // Handle leaving room with confirmation
  const confirmLeaveRoom = () => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this room? You will no longer receive messages from this room.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const success = await handleLeaveRoom();
            if (success) {
              onClose();
            }
          }
        }
      ]
    );
  };

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render a member item
  const renderMemberItem = ({ item }) => (
    <View style={styles.memberItem}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberInitial}>
          {item.username?.[0]?.toUpperCase() || 'U'}
        </Text>
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {item.username}
          {user?.id === item.id && ' (You)'}
        </Text>
        <Text style={styles.memberStatus}>
          {item.isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
    </View>
  );

  // Render a media item
  const renderMediaItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mediaItem}
      onPress={() => {
        // In a real app, you would open the image/video viewer here
        Alert.alert('View Media', 'Media viewer would open here');
      }}
    >
      <View style={styles.mediaThumbnail}>
        <MaterialIcons
          name={item.type === 'image' ? 'image' : 'videocam'}
          size={24}
          color={COLORS.primary}
        />
      </View>
      <Text style={styles.mediaName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.mediaSender} numberOfLines={1}>
        Shared by {item.sender}
      </Text>
    </TouchableOpacity>
  );

  // Render a file item
  const renderFileItem = ({ item }) => (
    <TouchableOpacity
      style={styles.fileItem}
      onPress={() => {
        // In a real app, you would open/download the file here
        Alert.alert('Download File', 'File download would start here');
      }}
    >
      <View style={styles.fileIconContainer}>
        <MaterialIcons name="insert-drive-file" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.fileDetails}>
          {formatFileSize(item.size)} • Shared by {item.sender}
        </Text>
      </View>
      <MaterialIcons name="download" size={24} color={COLORS.primary} />
    </TouchableOpacity>
  );

  if (!currentRoom) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar
        backgroundColor={COLORS.background}
        barStyle="light-content"
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Room Details</Text>
            <View style={styles.placeholderButton} />
          </View>

          {/* Room Info */}
          <View style={styles.roomInfoContainer}>
            <View style={styles.roomIcon}>
              <Text style={styles.roomIconText}>
                {currentRoom.name?.[0]?.toUpperCase() || '#'}
              </Text>
            </View>
            <Text style={styles.roomName}>#{currentRoom.name}</Text>
            <Text style={styles.roomDescription}>
              {currentRoom.description || 'No description provided'}
            </Text>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'members' && styles.activeTab]}
              onPress={() => setTab('members')}
            >
              <MaterialIcons
                name="people"
                size={22}
                color={tab === 'members' ? COLORS.primary : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'members' && styles.activeTabText
                ]}
              >
                Members
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, tab === 'media' && styles.activeTab]}
              onPress={() => setTab('media')}
            >
              <MaterialIcons
                name="photo-library"
                size={22}
                color={tab === 'media' ? COLORS.primary : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'media' && styles.activeTabText
                ]}
              >
                Media
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, tab === 'files' && styles.activeTab]}
              onPress={() => setTab('files')}
            >
              <MaterialIcons
                name="folder"
                size={22}
                color={tab === 'files' ? COLORS.primary : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'files' && styles.activeTabText
                ]}
              >
                Files
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, tab === 'settings' && styles.activeTab]}
              onPress={() => setTab('settings')}
            >
              <MaterialIcons
                name="settings"
                size={22}
                color={tab === 'settings' ? COLORS.primary : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'settings' && styles.activeTabText
                ]}
              >
                Settings
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <View style={styles.contentContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : (
              <>
                {/* Members Tab */}
                {tab === 'members' && (
                  <View style={styles.tabContent}>
                    <Text style={styles.sectionTitle}>
                      Members ({onlineUsers.length})
                    </Text>
                    {roomMembers.length === 0 ? (
                      <View style={styles.emptyState}>
                        <MaterialIcons name="people" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyStateText}>No members</Text>
                      </View>
                    ) : (
                      <FlatList
                        data={roomMembers}
                        renderItem={renderMemberItem}
                        keyExtractor={(item) => item.id}
                      />
                    )}
                  </View>
                )}

                {/* Media Tab */}
                {tab === 'media' && (
                  <View style={styles.tabContent}>
                    <Text style={styles.sectionTitle}>
                      Shared Media ({sharedMedia.length})
                    </Text>
                    {sharedMedia.length === 0 ? (
                      <View style={styles.emptyState}>
                        <MaterialIcons name="photo-library" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyStateText}>No media shared yet</Text>
                      </View>
                    ) : (
                      <FlatList
                        data={sharedMedia}
                        renderItem={renderMediaItem}
                        keyExtractor={(item) => item.messageId + item.name}
                        numColumns={3}
                        columnWrapperStyle={styles.mediaGrid}
                      />
                    )}
                  </View>
                )}

                {/* Files Tab */}
                {tab === 'files' && (
                  <View style={styles.tabContent}>
                    <Text style={styles.sectionTitle}>
                      Shared Files ({sharedFiles.length})
                    </Text>
                    {sharedFiles.length === 0 ? (
                      <View style={styles.emptyState}>
                        <MaterialIcons name="folder" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyStateText}>No files shared yet</Text>
                      </View>
                    ) : (
                      <FlatList
                        data={sharedFiles}
                        renderItem={renderFileItem}
                        keyExtractor={(item) => item.messageId + item.name}
                      />
                    )}
                  </View>
                )}

                {/* Settings Tab */}
                {tab === 'settings' && (
                  <ScrollView style={styles.tabContent}>
                    <Text style={styles.sectionTitle}>Room Settings</Text>

                    {/* Room Info Section */}
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsSectionTitle}>Room Information</Text>

                      <View style={styles.settingItem}>
                        <Text style={styles.settingLabel}>Room ID</Text>
                        <Text style={styles.settingValue} numberOfLines={1}>
                          {currentRoom.id}
                        </Text>
                      </View>

                      <View style={styles.settingItem}>
                        <Text style={styles.settingLabel}>Created</Text>
                        <Text style={styles.settingValue}>
                          {new Date(currentRoom.createdAt || Date.now()).toLocaleDateString()}
                        </Text>
                      </View>

                      {currentRoom.messageCount !== undefined && (
                        <View style={styles.settingItem}>
                          <Text style={styles.settingLabel}>Messages</Text>
                          <Text style={styles.settingValue}>
                            {currentRoom.messageCount}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Invite Section */}
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsSectionTitle}>Share Room</Text>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleShareRoom}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color={COLORS.textPrimary} />
                        ) : (
                          <>
                            <MaterialIcons name="share" size={20} color={COLORS.textPrimary} />
                            <Text style={styles.actionButtonText}>Share Invite Code</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Danger Zone */}
                    <View style={styles.dangerZone}>
                      <Text style={styles.dangerZoneTitle}>Danger Zone</Text>

                      <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={confirmLeaveRoom}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <MaterialIcons name="exit-to-app" size={20} color="#FFF" />
                            <Text style={styles.dangerButtonText}>Leave Room</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      {isAdmin && (
                        <TouchableOpacity
                          style={[styles.dangerButton, styles.deleteButton]}
                          onPress={() => {
                            Alert.alert(
                              'Delete Room',
                              'Are you sure you want to delete this room? This action cannot be undone.',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => {
                                    // Implement room deletion logic here
                                    Alert.alert('Not Implemented', 'Room deletion is not yet implemented');
                                  }
                                }
                              ]
                            );
                          }}
                        >
                          <MaterialIcons name="delete-forever" size={20} color="#FFF" />
                          <Text style={styles.dangerButtonText}>Delete Room</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  placeholderButton: {
    width: 32,
  },
  roomInfoContainer: {
    alignItems: 'center',
    padding: 20,
  },
  roomIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  roomIconText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  roomName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  roomDescription: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
    backgroundColor: COLORS.secondaryBackground,
    paddingTop: 4,
    paddingBottom: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    marginLeft: 4,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  memberInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  onlineIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.online,
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  memberStatus: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  mediaGrid: {
    justifyContent: 'space-between',
  },
  mediaItem: {
    width: '31%',
    marginBottom: 16,
    alignItems: 'center',
  },
  mediaThumbnail: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.secondaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 8,
  },
  mediaName: {
    fontSize: 12,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  mediaSender: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(114, 137, 218, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  fileDetails: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
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
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  settingsSection: {
    marginBottom: 24,
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  settingLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  settingValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dangerZone: {
    marginBottom: 24,
    backgroundColor: 'rgba(237, 66, 69, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
  },
  dangerButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default RoomDetailsModal;

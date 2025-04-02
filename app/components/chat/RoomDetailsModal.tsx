import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';
import useUser from '../../hooks/useUser';
import { MaterialIcons } from '@expo/vector-icons';
import { FileAttachment } from '@/app/types';

const RoomDetailsModal = ({
  visible,
  room,
  onClose
}: any) => {
  const { setCallbacks, rpcClient, getRoomFiles } = useWorklet();
  const { user } = useUser();
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeSection, setActiveSection] = useState('info');
  // Fetch files when modal opens
  useEffect(() => {
    if (visible && room && activeSection === 'files') {
      setCallbacks({
        onRoomFiles: (data: any) => {
          console.log('Room files received:', data);

          if (data.success) {
            setFiles(prev =>
              prev.length && data.before
                ? [...prev, ...data.files]
                : data.files
            );
            setHasMore(data.hasMore);
          } else {
            console.error('Failed to fetch room files:', data.error);
          }
        }
      });
      fetchFiles();
    }
    if (!visible) {
      setActiveSection('info');
      setFiles([]);
    }
  }, [visible, room, activeSection]);

  const fetchFiles = async (before?: number) => {
    if (isLoading || !room) return;

    setIsLoading(true);

    try {
      // Use a promise to handle the RPC callback
      const filePromise = new Promise<{ files: FileAttachment[], hasMore: boolean }>((resolve, reject) => {
        const request = rpcClient.request('getRoomFiles');
        request.send(JSON.stringify({
          roomId: room.id,
          limit: 20,
          before
        }));
      });

      // Wait for the promise to resolve
      const result = await filePromise;

      setFiles(prev =>
        before
          ? [...prev, ...result.files]
          : result.files
      );
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error fetching room files:', error);
      // Optionally show an error to the user
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreFiles = () => {
    if (!hasMore || isLoading) return;
    const oldestFile = files[files.length - 1];
    if (oldestFile) {
      fetchFiles(oldestFile.timestamp);
    }
  };
  const getFileIcon = (fileName: string | undefined) => {
    const ext = fileName?.split('.').pop()?.toLowerCase() || '';
    const iconMap = {
      'jpg': <MaterialIcons name="image" size={14} color={COLORS.primary} />,
      'jpeg': <MaterialIcons name="image" size={14} color={COLORS.primary} />,
      'png': <MaterialIcons name="image" size={14} color={COLORS.primary} />,
      'gif': <MaterialIcons name="image" size={14} color={COLORS.primary} />,
      'pdf': <MaterialIcons name="attachment" size={14} color={COLORS.primary} />,
      'doc': <MaterialIcons name="attachment" size={14} color={COLORS.primary} />,
      'docx': <MaterialIcons name="attachment" size={14} color={COLORS.primary} />,
      'txt': <MaterialIcons name="attachment" size={14} color={COLORS.primary} />,
      'mp3': <MaterialIcons name="audio-file" size={14} color={COLORS.primary} />,
      'wav': <MaterialIcons name="audio-file" size={14} color={COLORS.primary} />,
      'mp4': <MaterialIcons name="audio-file" size={14} color={COLORS.primary} />,
      'mov': <MaterialIcons name="video-file" size={14} color={COLORS.primary} />
    };
    // @ts-ignore
    return iconMap[ext] || <MaterialIcons name="attachment" size={14} color={COLORS.primary} /> as any;
  };

  const formatFileSize = (bytes: any) => {
    if (bytes < 1024) return `${bytes || "0"} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (timestamp: any) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderFileItem = ({ item }: any) => {
    // Add additional type checking and default values
    const fileName = item.name || 'Unknown File';
    const fileSize = item.size || 0;
    const isOwnFile = user && item.sender === user.name;

    console.log('Rendering file item:', item); // Debug log

    const FileIcon = getFileIcon(fileName);

    return (
      <TouchableOpacity
        style={[
          styles.fileItem,
          { backgroundColor: COLORS.secondaryBackground }
        ]}
      >
        <View style={styles.fileIconContainer}>
          {FileIcon}
          {isOwnFile && (
            <View style={styles.ownFileBadge}>
              <MaterialIcons name="person" size={14} color={COLORS.primary} />
            </View>
          )}
        </View>
        <View style={styles.fileDetails}>
          <Text
            style={styles.fileName}
            numberOfLines={1}
          >
            {fileName}
          </Text>
          <View style={styles.fileMetadata}>
            <Text style={styles.fileMetadataText}>
              {formatFileSize(fileSize)}
            </Text>
            <Text style={styles.fileMetadataText}>
              {formatTimestamp(item.timestamp)}
            </Text>
            <Text style={styles.fileMetadataText}>
              {item.sender === user?.name ? 'You' : item.sender}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="attachment" size={32} color={COLORS.primary} />
      <Text style={styles.emptyText}>
        No files shared in this room yet
      </Text>
    </View>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'info':
        return (
          <ScrollView style={styles.contentContainer}>
            {/* Room Description */}
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>
                {
                  room?.name
                }
              </Text>
              <Text style={styles.descriptionText}>
                {room?.description || 'Room has no description'}
              </Text>
            </View>

            {/* Room Details */}
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="info-outline" size={16} color={COLORS.textSecondary} /> Room Details
              </Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {room?.createdAt
                    ? new Date(room.createdAt).toLocaleDateString()
                    : 'Unknown'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Messages</Text>
                <Text style={styles.detailValue}>
                  {room?.messageCount || '0'}
                </Text>
              </View>
            </View>
          </ScrollView>
        );
      case 'files':
        return (
          <FlatList
            data={files}
            renderItem={renderFileItem}
            keyExtractor={(item, idx) => (`${item.coreKey}-${item.size}-${item.name}`)}
            ListEmptyComponent={EmptyState}
            ListFooterComponent={() =>
              hasMore && isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={styles.loadingIndicator}
                />
              ) : null
            }
            onEndReached={loadMoreFiles}
            onEndReachedThreshold={0.5}
            contentContainerStyle={styles.fileListContainer}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              #{room?.name} Details
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Section Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeSection === 'info' && styles.activeTabButton
              ]}
              onPress={() => setActiveSection('info')}
            >
              <MaterialIcons
                name="info"
                size={16}
                color={activeSection === 'info'
                  ? COLORS.primary
                  : COLORS.textSecondary
                }
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeSection === 'info' && styles.activeTabButtonText
                ]}
              >
                Info
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeSection === 'files' && styles.activeTabButton
              ]}
              onPress={() => {
                setActiveSection('files');
                fetchFiles(null); // Trigger initial fetch
              }}
            >
              <MaterialIcons
                name='attachment'
                size={16}
                color={activeSection === 'files'
                  ? COLORS.primary
                  : COLORS.textSecondary
                }
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeSection === 'files' && styles.activeTabButtonText
                ]}
              >
                Files
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Content */}
          <View style={styles.contentWrapper}>
            {renderContent()}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    height: "100%"
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    flex: 1,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabButtonText: {
    marginLeft: 8,
    color: COLORS.textSecondary,
  },
  activeTabButtonText: {
    color: COLORS.primary,
  },
  contentWrapper: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  infoSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 10,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  detailValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  fileListContainer: {
    padding: 16,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  fileIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(114, 137, 218, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ownFileBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.info,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  fileMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileMetadataText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  downloadButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  loadingIndicator: {
    marginVertical: 16,
  },
});

export default RoomDetailsModal;

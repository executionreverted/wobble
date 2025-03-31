import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';
import { FileCacheManager } from '../../utils/FileCacheManager';

// Updated File Attachment Component
export const EnhancedFileAttachment = ({
  handleAttachmentPress,
  attachment,
  roomId
}: {
  attachment: any;
  roomId: string;
  handleAttachmentPress?: (attachment: any) => void;
}) => {
  const { fileDownloads, downloadFile, saveFileToDevice } = useWorklet();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);

  // Create a unique key for this attachment
  const attachmentKey = FileCacheManager.createCacheKey(roomId, attachment.blobId);

  // Get download status for this attachment using the unique key
  const downloadStatus = fileDownloads[attachmentKey];

  // Detect if file is large
  const isLargeFile = (attachment.size || 0) > 10 * 1024 * 1024; // 10MB threshold

  useEffect(() => {
    if (downloadStatus) {
      // Update downloading state
      setIsDownloading(downloadStatus.progress > 1 && downloadStatus.progress < 100);

      // Immediately set download complete when progress reaches 100
      if (downloadStatus.progress >= 100) {
        setIsDownloadComplete(true);
      } else {
        setIsDownloadComplete(false);
      }
    } else {
      setIsDownloading(false);
      setIsDownloadComplete(false);
    }
  }, [downloadStatus]);

  const handleDownload = async () => {
    if (isDownloading) return;

    if (!roomId || !attachment || !attachment.blobId) {
      Alert.alert('Error', 'Invalid attachment data');
      return;
    }

    // Customize alert for large files
    const confirmationMessage = isLargeFile
      ? `This is a large file (${formatFileSize(attachment.size || 0)}). Download may take some time.`
      : `Do you want to download "${attachment.name}"?`;

    Alert.alert(
      'Download File',
      confirmationMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            setIsDownloading(true);
            await downloadFile(roomId, attachment, false, attachmentKey);
          }
        }
      ]
    );
  };

  const handleSaveFile = async () => {
    if (!isDownloadComplete || !downloadStatus?.data) return;

    try {
      const success = await saveFileToDevice(attachmentKey);

      if (success) {
        Alert.alert('Success', 'File saved to device');
      } else {
        Alert.alert('Error', 'Failed to save file to device');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      Alert.alert('Error', 'An error occurred while saving the file');
    }
  };

  // Format file size with more robust handling
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    else if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    else if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    else return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName?.split('.')?.pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'picture-as-pdf';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['xls', 'xlsx'].includes(ext)) return 'table-chart';
    if (['ppt', 'pptx'].includes(ext)) return 'slideshow';
    if (['zip', 'rar', '7z'].includes(ext)) return 'folder-zip';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audiotrack';
    if (['mp4', 'mov', 'avi'].includes(ext)) return 'videocam';
    return 'insert-drive-file';
  };

  return (
    <TouchableOpacity
      style={styles.attachmentContainer}
      onPress={isDownloadComplete ? handleSaveFile : handleDownload}
      disabled={isDownloading}
    >
      <View style={styles.attachmentIconContainer}>
        <MaterialIcons
          name={isDownloadComplete ? 'check-circle' : getFileIcon(attachment.name)}
          size={25}
          color={isDownloadComplete ? COLORS.success : COLORS.primary}
        />
      </View>
      <View style={styles.attachmentDetails}>
        <TouchableOpacity>
          <Text
            onPress={handleAttachmentPress}
            style={styles.attachmentName}
            numberOfLines={2}
          >
            {attachment.name}
          </Text>
        </TouchableOpacity>
        <Text style={styles.attachmentSize}>
          {formatFileSize(attachment.size || 1)}
          {isLargeFile && <Text style={{ color: COLORS.warning }}> (Large File)</Text>}
        </Text>

        {downloadStatus && downloadStatus.progress > 1 && downloadStatus.progress < 100 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${downloadStatus.progress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {downloadStatus.progress}% - {downloadStatus.message || 'Downloading...'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.downloadIconContainer}>
        {isDownloading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : isDownloadComplete ? (
          <MaterialIcons name="save-alt" size={25} color={COLORS.success} />
        ) : (
          <MaterialIcons name="download" size={25} color={COLORS.primary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

// Updated Image Attachment Component
export const EnhancedImageAttachment = ({
  handleAttachmentPress,
  attachment,
  roomId
}: {
  attachment: any;
  roomId: string;
  handleAttachmentPress?: (attachment: any) => void;
}) => {
  const { fileDownloads, downloadFile, saveFileToDevice } = useWorklet();
  const [isDownloading, setIsDownloading] = useState(false);
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);
  const [autoDownloadInitiated, setAutoDownloadInitiated] = useState(false);

  // Create a unique key for this attachment
  const attachmentKey = FileCacheManager.createCacheKey(roomId, attachment.blobId);

  // Get download status for this attachment
  const downloadStatus = fileDownloads[attachmentKey];

  // Determine if we have a preview or full data
  const hasPreview = Boolean(downloadStatus?.data);
  const hasFullData = Boolean(downloadStatus?.data && !downloadStatus?.preview);

  // Update local URI when download status changes
  useEffect(() => {
    if (downloadStatus?.data) {
      // Create a proper data URI with the correct mime type
      const mimeType = downloadStatus.mimeType || getMimeTypeFromFilename(attachment.name) || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${downloadStatus.data}`;
      setLocalPreviewUri(dataUri);
    } else {
      setLocalPreviewUri(null);
    }
  }, [downloadStatus?.data, downloadStatus?.timestamp, attachment.name]);

  // Update downloading state based on progress
  useEffect(() => {
    if (downloadStatus) {
      setIsDownloading(downloadStatus.progress > 1 && downloadStatus.progress < 100);
    } else {
      setIsDownloading(false);
    }
  }, [downloadStatus]);

  // Auto-download preview only once when component mounts
  useEffect(() => {
    const shouldAutoDownload =
      !autoDownloadInitiated &&
      !isDownloading &&
      !hasPreview &&
      FileCacheManager.isImageFile(attachment.name);

    if (shouldAutoDownload) {
      setAutoDownloadInitiated(true);
      downloadPreview();
    }
  }, [autoDownloadInitiated, hasPreview, attachment.name, isDownloading]);

  // Determine MIME type from filename
  const getMimeTypeFromFilename = (filename: string) => {
    const ext = filename?.split('.')?.pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml'
    };
    return ext ? mimeTypes[ext] : null;
  };

  const downloadPreview = async () => {
    if (!roomId || !attachment || !attachment.blobId) return;

    setIsDownloading(true);
    await downloadFile(roomId, attachment, true, attachmentKey);
  };

  const handleFullDownload = async () => {
    if (!roomId || !attachment || !attachment.blobId) {
      Alert.alert('Error', 'Invalid attachment data');
      return;
    }

    if (hasPreview && !hasFullData) {
      Alert.alert(
        'Download Full Image',
        `Do you want to download the full-quality version of "${attachment.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download',
            onPress: async () => {
              setIsDownloading(true);
              await downloadFile(roomId, attachment, false, attachmentKey);
            }
          }
        ]
      );
    } else if (!hasPreview) {
      // If no preview yet, download preview first
      downloadPreview();
    } else {
      // If full data already available, save to device
      handleSaveToDevice();
    }
  };

  const handleSaveToDevice = async () => {
    if (!downloadStatus?.data) return;

    try {
      const success = await saveFileToDevice(attachmentKey);

      if (success) {
        Alert.alert('Success', 'Image saved to device');
      } else {
        Alert.alert('Error', 'Failed to save image to device');
      }
    } catch (error) {
      console.error('Error saving image to device:', error);
      Alert.alert('Error', 'An error occurred while saving the image');
    }
  };

  return (
    <TouchableOpacity
      style={styles.imageAttachmentContainer}
      onPress={hasFullData ? handleSaveToDevice : handleFullDownload}
      disabled={isDownloading}
    >
      <View style={styles.imageAttachmentPlaceholder}>
        {localPreviewUri ? (
          <Image
            source={{ uri: localPreviewUri }}
            style={styles.imagePreview}
            resizeMode="contain"
            // Add a key with timestamp to force re-render when image changes
            key={`preview-${attachmentKey}-${downloadStatus?.timestamp || Date.now()}`}
          />
        ) : (
          <>
            <MaterialIcons name="image" size={49} color={COLORS.primary} />
            <TouchableOpacity onPress={() => handleAttachmentPress && handleAttachmentPress(attachment)}>
              <Text style={styles.attachmentName} numberOfLines={2}>{attachment.name}</Text>
            </TouchableOpacity>
          </>
        )}

        {isDownloading && (
          <View style={styles.imageProgressContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.progressText}>
              {downloadStatus?.progress || 1}% - {downloadStatus?.message || 'Loading preview...'}
            </Text>
          </View>
        )}

        {(hasPreview || hasFullData) && !isDownloading && (
          <View style={styles.imageActionContainer}>
            {hasFullData ? (
              <TouchableOpacity
                style={styles.imageAction}
                onPress={handleSaveToDevice}
              >
                <MaterialIcons name="save-alt" size={25} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.imageAction}
                onPress={handleFullDownload}
              >
                <MaterialIcons name="download" size={25} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  attachmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(1,0,0,0.1)',
    borderRadius: 9,
    padding: 9,
    marginVertical: 5,
    alignItems: 'center',
  },
  attachmentIconContainer: {
    width: 41,
    height: 41,
    borderRadius: 21,
    backgroundColor: 'rgba(1,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
  },
  attachmentDetails: {
    flex: 2,
  },
  attachmentName: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  attachmentSize: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  downloadIconContainer: {
    marginLeft: 9,
    width: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    marginTop: 5,
  },
  progressBar: {
    height: 5,
    backgroundColor: 'rgba(1,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '101%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  imageAttachmentContainer: {
    marginVertical: 5,
  },
  imageAttachmentPlaceholder: {
    width: '101%',
    height: 151,
    backgroundColor: 'rgba(1,0,0,0.1)',
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '101%',
    height: '101%',
    borderRadius: 9,
  },
  imageProgressContainer: {
    position: 'absolute',
    bottom: 1,
    left: 1,
    right: 1,
    backgroundColor: 'rgba(1,0,0,0.5)',
    padding: 5,
    alignItems: 'center',
  },
  imageActionContainer: {
    position: 'absolute',
    top: 9,
    right: 9,
    flexDirection: 'row',
  },
  imageAction: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: 'rgba(1,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 9,
  }
});

export default {
  EnhancedFileAttachment,
  EnhancedImageAttachment
};

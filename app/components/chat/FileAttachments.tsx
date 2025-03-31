import React, { useRef, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { createStableBlobId } from '@/app/utils/helpers';

// Determine if file is an image
const isImageFile = (fileName: string) => {
  const ext = fileName?.split('.')?.pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
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

// Format file size with more robust handling
const formatFileSize = (bytes: number) => {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  else if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  else if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  else return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Determine MIME type from filename
const getMimeTypeFromFilename = (filename: string) => {
  const ext = filename?.split('.')?.pop()?.toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml'
  };
  return ext ? mimeTypes[ext] as any : null;
};

// Constants for large file handling
const MAX_PREVIEW_SIZE = 5 * 1024 * 1024; // 5MB
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

// File Attachment Component
export const EnhancedFileAttachment = ({
  handleAttachmentPress,
  attachment,
  roomId
}: {
  attachment: any;
  roomId: string;
  handleAttachmentPress?: (attachment: any) => void;
}) => {
  const { fileDownloads, downloadFile } = useWorklet();
  const [isDownloading, setIsDownloading] = useState(false);

  const [isDownloadComplete, setIsDownloadComplete] = useState(false);
  // Create a unique key for this attachment
  const blobId = createStableBlobId(attachment.blobId);
  const attachmentKey = `${roomId}_${blobId}`;

  // Get download status for this attachment using the unique key
  const downloadStatus = fileDownloads[attachmentKey];

  // Detect if file is large
  const isLargeFile = (attachment.size || 0) > LARGE_FILE_THRESHOLD;

  useEffect(() => {
    if (downloadStatus) {
      // Update downloading state
      setIsDownloading(downloadStatus.progress > 1 && downloadStatus.progress < 100);

      // Immediately set download complete when progress reaches 100
      if (downloadStatus.progress === 100 || downloadStatus.progress === 101) {
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
    if (isDownloading || isDownloadComplete) return
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

  // Consider download complete when progress reaches 101 (matching original code)
  const isComplete = downloadStatus?.progress === 101 && downloadStatus?.data;

  const handleShareFile = async () => {
    if (!isComplete || !downloadStatus.data) return;

    if (Platform.OS === 'web') {
      Alert.alert('Cannot Share', 'File sharing is not available on web');
      return;
    }

    try {
      // Save file to temp location
      const fileUri = FileSystem.cacheDirectory + downloadStatus.fileName;
      await FileSystem.writeAsStringAsync(fileUri, downloadStatus.data, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Sharing not available', 'File sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  };

  return (
    <TouchableOpacity
      style={styles.attachmentContainer}
      onPress={isComplete ? handleShareFile : handleDownload}
      disabled={isDownloading}
    >
      <View style={styles.attachmentIconContainer}>
        <MaterialIcons
          name={isComplete ? 'check-circle' : getFileIcon(attachment.name)}
          size={25}
          color={isComplete ? COLORS.success : COLORS.primary}
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

        {downloadStatus && downloadStatus.progress > 1 && !isComplete && (
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
        ) : isComplete ? (
          <MaterialIcons name="share" size={25} color={COLORS.success} />
        ) : (
          <MaterialIcons name="download" size={25} color={COLORS.primary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

export const EnhancedImageAttachment = ({ handleAttachmentPress, attachment, roomId }: any) => {
  const { fileDownloads, downloadFile, isCacheInitialized, cacheInitPromise } = useWorklet();
  const [isDownloading, setIsDownloading] = useState(false);
  const [localPreviewUri, setLocalPreviewUri] = useState(null);
  const [autoDownloadInitiated, setAutoDownloadInitiated] = useState(false);

  // Create a unique key for this attachment
  const blobId = createStableBlobId(attachment.blobId);
  const attachmentKey = `${roomId}_${blobId}`;

  // Get download status for this attachment using the unique key
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
      setLocalPreviewUri(dataUri as any);
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
      isImageFile(attachment.name) && isCacheInitialized;

    if (shouldAutoDownload) {
      console.log(`Auto-downloading preview for ${attachment.name}`);
      setAutoDownloadInitiated(true);
      downloadPreview();
    }
  }, [autoDownloadInitiated, hasPreview, attachment.name]);

  const downloadPreview = async () => {
    if (!roomId || !attachment || !attachment.blobId) return;

    console.log(`Downloading preview for ${attachment.name} with key ${attachmentKey}`);
    setIsDownloading(true);
    await downloadFile(roomId, attachment, true, attachmentKey);
  };

  const handleFullDownload = async () => {
    if (!roomId || !attachment || !attachment.blobId) {
      Alert.alert('Error', 'Invalid attachment data');
      return;
    }

    if (hasPreview || hasFullData) {
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
    } else {
      // If no preview yet, download preview first
      downloadPreview();
    }
  };

  const handleSaveToGallery = async () => {
    if (!downloadStatus?.data) return;

    if (Platform.OS === 'web') {
      // Web download implementation
      try {
        const blob = base64ToBlob(downloadStatus.data, downloadStatus.mimeType || 'image/jpeg');
        const url = URL.createObjectURL(blob as any);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading on web:', error);
        Alert.alert('Error', 'Failed to download image');
      }
      return;
    }

    try {
      // Request permissions first
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access media library is required to save images');
        return;
      }

      // Save the image to a temp file
      const fileUri = FileSystem.cacheDirectory + attachment.name;
      await FileSystem.writeAsStringAsync(fileUri, downloadStatus.data, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('Roombase', asset, false);

      Alert.alert('Success', 'Image saved to gallery');
    } catch (error) {
      console.error('Error saving to gallery:', error);
      Alert.alert('Error', 'Failed to save image to gallery');
    }
  };

  return (
    <TouchableOpacity
      style={styles.imageAttachmentContainer}
      onPress={hasPreview || hasFullData ? handleSaveToGallery : handleFullDownload}
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

        {(hasPreview || hasFullData) && (
          <View style={styles.imageActionContainer}>
            <TouchableOpacity
              style={styles.imageAction}
              onPress={handleSaveToGallery}
            >
              <MaterialIcons name="save-alt" size={25} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Utility function to convert base64 to Blob for web
const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

// Styles remain the same as in the original implementation
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

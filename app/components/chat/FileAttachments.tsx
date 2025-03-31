import React, { useRef, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { createStableBlobId } from '@/app/utils/helpers';


const useAutoDownloadPreview = (
  attachment,
  roomId,
  downloadFile,
  fileDownloads,
  isDownloading,
  setIsDownloading
) => {
  const attemptCount = useRef(0);
  const maxAttempts = 3;

  // Create stable identifiers
  const blobId = createStableBlobId(attachment.blobId);
  const attachmentKey = `${roomId}_${blobId}`;

  // Get current download status
  const downloadStatus = fileDownloads[attachmentKey];
  const hasPreview = Boolean(downloadStatus?.data);

  // Function to trigger download
  const attemptDownload = useCallback(async () => {
    if (isDownloading || hasPreview || attemptCount.current >= maxAttempts) return;

    attemptCount.current += 1;
    console.log(`Attempting preview download for ${attachment.name} (attempt ${attemptCount.current}/${maxAttempts})`);

    setIsDownloading(true);
    await downloadFile(roomId, attachment, true, attachmentKey);
  }, [attachment, roomId, downloadFile, attachmentKey, isDownloading, hasPreview]);

  // Start download on mount with a small delay
  useEffect(() => {
    if (!hasPreview && !isDownloading && isImageFile(attachment.name)) {
      const timer = setTimeout(() => {
        attemptDownload();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, []);

  // If download completes or fails, check status and retry if needed
  useEffect(() => {
    if (downloadStatus) {
      // If complete, reset attempting flag
      if (downloadStatus.progress === 100 && downloadStatus.data) {
        console.log(`Preview download complete for ${attachment.name}`);
        attemptCount.current = maxAttempts; // Stop retrying
      }
      // If failed or stalled, retry after delay
      else if (downloadStatus.error ||
        (downloadStatus.progress === 0 && !isDownloading && attemptCount.current < maxAttempts)) {
        const timer = setTimeout(() => {
          attemptDownload();
        }, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [downloadStatus, isDownloading]);

  return { hasPreview, downloadStatus, attachmentKey };
};






// File attachment component with download progress
export const EnhancedFileAttachment = ({ handleAttachmentPress, attachment, roomId }: { attachment: any; roomId: string }) => {
  const { fileDownloads, downloadFile } = useWorklet();
  const [isDownloading, setIsDownloading] = useState(false);

  // Create a unique key for this attachment
  const blobId = createStableBlobId(attachment.blobId);
  const attachmentKey = `${roomId}_${blobId}`;

  // Get download status for this attachment using the unique key
  const downloadStatus = fileDownloads[attachmentKey];

  useEffect(() => {
    // Update downloading state based on progress
    if (downloadStatus) {
      setIsDownloading(downloadStatus.progress > 0 && downloadStatus.progress < 100);
    } else {
      setIsDownloading(false);
    }
  }, [downloadStatus]);

  const handleDownload = async () => {
    if (!roomId || !attachment || !attachment.blobId) {
      Alert.alert('Error', 'Invalid attachment data');
      return;
    }

    Alert.alert(
      'Download File',
      `Do you want to download "${attachment.name}"?`,
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

  const isComplete = downloadStatus?.progress === 100 && downloadStatus?.data;

  // If download is complete and we have sharing capabilities, add share option
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
          size={24}
          color={isComplete ? COLORS.success : COLORS.primary}
        />
      </View>
      <View style={styles.attachmentDetails}>

        <TouchableOpacity>
          <Text onPress={handleAttachmentPress} style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
        </TouchableOpacity>
        <Text style={styles.attachmentSize}>{formatFileSize(attachment.size || 0)}</Text>

        {downloadStatus && downloadStatus.progress > 0 && !isComplete && (
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
          <MaterialIcons name="share" size={24} color={COLORS.success} />
        ) : (
          <MaterialIcons name="download" size={24} color={COLORS.primary} />
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

  // Update local URI when download status changes - with stable dependencies
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
      setIsDownloading(downloadStatus.progress > 0 && downloadStatus.progress < 100);
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
        const blob = b64toBlob(downloadStatus.data, downloadStatus.mimeType || 'image/jpeg');
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
            <MaterialIcons name="image" size={48} color={COLORS.primary} />
            <TouchableOpacity onPress={() => handleAttachmentPress && handleAttachmentPress(attachment)}>
              <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
            </TouchableOpacity>
          </>
        )}

        {isDownloading && (
          <View style={styles.imageProgressContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.progressText}>
              {downloadStatus?.progress || 0}% - {downloadStatus?.message || 'Loading preview...'}
            </Text>
          </View>
        )}

        {(hasPreview || hasFullData) && (
          <View style={styles.imageActionContainer}>
            <TouchableOpacity
              style={styles.imageAction}
              onPress={handleSaveToGallery}
            >
              <MaterialIcons name="save-alt" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Helper function to get MIME type from filename
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
// Helper function to check if file is an image
const isImageFile = (fileName: string) => {
  const ext = fileName?.split('.')?.pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
};

// Helper function to get icon based on file extension
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

// Format file size
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};

const styles = StyleSheet.create({
  attachmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  attachmentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachmentDetails: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  attachmentSize: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  downloadIconContainer: {
    marginLeft: 8,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  imageAttachmentContainer: {
    marginVertical: 4,
  },
  imageAttachmentPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageProgressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    alignItems: 'center',
  },
  imageActionContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
  },
  imageAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  }
});

export default {
  EnhancedFileAttachment,
  EnhancedImageAttachment
};

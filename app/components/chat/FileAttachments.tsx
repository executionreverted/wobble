// app/components/chat/FileAttachments.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';
import fileCacheManager, { FileCacheManager } from '../../utils/FileCacheManager';
import useCachedFile from '../../hooks/useCachedFile';

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
  const { saveFileToDevice } = useWorklet();

  // Use the cached file hook
  const {
    attachmentKey,
    downloadStatus,
    isDownloading,
    isCached,
    handleDownload
  } = useCachedFile(roomId, attachment);

  // Detect if file is large
  const isLargeFile = (attachment.size || 0) > 10 * 1024 * 1024; // 10MB threshold

  // Determine if download is complete
  const isDownloadComplete = downloadStatus?.progress >= 100 || isCached;

  const handleDownloadOrOpen = async () => {
    if (isDownloading) return;

    if (isDownloadComplete) {
      // If already downloaded, open or save it
      handleSaveFile();
    } else {
      // Ask for confirmation before downloading large files
      if (isLargeFile) {
        Alert.alert(
          'Download Large File',
          `This is a large file (${formatFileSize(attachment.size || 0)}). Download may take some time.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Download',
              onPress: () => handleDownload(false)
            }
          ]
        );
      } else {
        // Start download for smaller files
        handleDownload(false);
      }
    }
  };

  const handleSaveFile = async () => {
    if (!isDownloadComplete || !attachmentKey) return;

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

  // Format file size
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
      onPress={handleDownloadOrOpen}
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
        <Text
          style={styles.attachmentName}
          numberOfLines={2}
          onPress={() => handleAttachmentPress && handleAttachmentPress(attachment)}
        >
          {attachment.name}
        </Text>
        <Text style={styles.attachmentSize}>
          {formatFileSize(attachment.size || 1)}
          {isLargeFile && <Text style={{ color: COLORS.warning }}> (Large File)</Text>}
        </Text>

        {isDownloading && downloadStatus && (
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

// Image Attachment Component
export const EnhancedImageAttachment = ({
  handleAttachmentPress,
  attachment,
  roomId
}: {
  attachment: any;
  roomId: string;
  handleAttachmentPress?: (attachment: any) => void;
}) => {
  const { saveFileToDevice } = useWorklet();
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [autoDownloadInitiated, setAutoDownloadInitiated] = useState(false);

  // Use the cached file hook
  const {
    attachmentKey,
    downloadStatus,
    isDownloading,
    isCached,
    handleDownload
  } = useCachedFile(roomId, attachment);

  // Determine if download is complete
  const isDownloadComplete = downloadStatus?.progress >= 100 || isCached;

  // Check if we have a path to the file but haven't loaded the data yet
  const hasPath = downloadStatus?.path;
  const needsDataLoading = hasPath && !localPreviewUri && !isLoadingPreview;

  // Convert data to URI format for display
  useEffect(() => {
    if (downloadStatus?.data) {
      // Convert data directly to URI
      const mimeType = downloadStatus.mimeType || getMimeTypeFromFilename(attachment.name) || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${downloadStatus.data}`;
      setLocalPreviewUri(dataUri);
    }
  }, [downloadStatus?.data, attachment.name]);

  // Load image data lazily when needed
  useEffect(() => {
    const loadImageData = async () => {
      if (!needsDataLoading || !attachmentKey) return;

      setIsLoadingPreview(true);
      try {
        console.log(`Lazy loading image data for ${attachment.name}`);

        // Load file data on demand
        const fileData = await fileCacheManager.getFileData(attachmentKey);

        if (fileData) {
          // Create a data URI
          const mimeType = downloadStatus?.mimeType || getMimeTypeFromFilename(attachment.name) || 'image/jpeg';
          const dataUri = `data:${mimeType};base64,${fileData}`;
          setLocalPreviewUri(dataUri);
        }
      } catch (error) {
        console.error('Error lazy loading image:', error);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadImageData();
  }, [needsDataLoading, attachmentKey, attachment.name, downloadStatus?.mimeType]);

  // Auto-download image previews once
  useEffect(() => {
    const checkAndAutoDownload = async () => {
      if (autoDownloadInitiated || isDownloading || localPreviewUri || !FileCacheManager.isImageFile(attachment.name)) {
        return;
      }

      setAutoDownloadInitiated(true);

      // If not cached or downloading, start preview download
      if (!isCached && !isDownloading) {
        console.log(`Auto-downloading preview for ${attachment.name}`);
        handleDownload(true); // true = preview
      }
    };

    checkAndAutoDownload();
  }, [autoDownloadInitiated, isDownloading, localPreviewUri, isCached, attachment.name, handleDownload]);

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

  const handleImagePress = () => {
    if (isDownloading || isLoadingPreview) return;

    if (isDownloadComplete || localPreviewUri) {
      // We have the image, open/save it
      handleSaveToDevice();
    } else {
      // Start downloading
      handleDownload(false); // false = full quality
    }
  };

  const handleSaveToDevice = async () => {
    if ((!downloadStatus?.data && !downloadStatus?.path) || !attachmentKey) return;

    try {
      let success = false;

      if (downloadStatus.path) {
        success = await fileCacheManager.openFile(
          downloadStatus.path,
          downloadStatus.mimeType || 'image/jpeg'
        );
      } else {
        success = await saveFileToDevice(attachmentKey);
      }

      if (success) {
        Alert.alert('Success', 'Image opened/saved successfully');
      } else {
        Alert.alert('Error', 'Failed to open/save image');
      }
    } catch (error) {
      console.error('Error handling image:', error);
      Alert.alert('Error', 'An error occurred');
    }
  };

  return (
    <TouchableOpacity
      style={styles.imageAttachmentContainer}
      onPress={handleImagePress}
      disabled={isDownloading || isLoadingPreview}
    >
      <View style={styles.imageAttachmentPlaceholder}>
        {localPreviewUri ? (
          <Image
            source={{ uri: localPreviewUri }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
        ) : (
          <>
            <MaterialIcons name="image" size={49} color={COLORS.primary} />
            <Text
              style={styles.attachmentName}
              numberOfLines={2}
              onPress={() => handleAttachmentPress && handleAttachmentPress(attachment)}
            >
              {attachment.name}
            </Text>
          </>
        )}

        {(isDownloading || isLoadingPreview) && (
          <View style={styles.imageProgressContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.progressText}>
              {isLoadingPreview ? 'Loading image...' : `${downloadStatus?.progress || 0}% - ${downloadStatus?.message || 'Downloading...'}`}
            </Text>
          </View>
        )}

        {(isDownloadComplete || localPreviewUri) && !isDownloading && !isLoadingPreview && (
          <View style={styles.imageActionContainer}>
            <TouchableOpacity
              style={styles.imageAction}
              onPress={handleSaveToDevice}
            >
              <MaterialIcons name="save-alt" size={25} color="#FFF" />
            </TouchableOpacity>
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

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';
import fileCacheManager, { FileCacheManager } from '../../utils/FileCacheManager';
import useCachedFile from '../../hooks/useCachedFile';
import Svg, { Circle } from 'react-native-svg';
import MediaPlayerModal from './MediaPlayerModal';

interface AttachmentProps {
  attachment: any;
  roomId: string;
  isOwnFile: boolean;  // Receive this directly instead of computing it
  handleAttachmentPress?: (attachment: any) => void;
}

const DownloadButton = ({
  isDownloading,
  progress,
  onDownload,
  onCancel
}: {
  isDownloading: boolean;
  progress: number;
  onDownload: () => void;
  onCancel: () => void;
}) => {
  // Calculate progress for the circle
  const strokeWidth = 2;
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (progress / 100) * circumference;

  return (
    <TouchableOpacity
      style={styles.downloadButtonContainer}
      onPress={isDownloading ? onCancel : onDownload}
      activeOpacity={0.7}
    >
      {isDownloading ? (
        <View style={styles.progressCircleContainer}>
          {/* Background circle */}
          <View style={styles.progressCircleBackground}>
            {/* SVG for progress circle */}
            <Svg width={24} height={24}>
              {/* Background circle */}
              <Circle
                cx="12"
                cy="12"
                r={radius}
                stroke={COLORS.primary}
                strokeWidth={strokeWidth}
                fill="transparent"
                opacity={0.3}
              />

              {/* Progress circle */}
              <Circle
                cx="12"
                cy="12"
                r={radius}
                stroke={COLORS.primary}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                strokeLinecap="round"
                // Start from top (rotate -90 degrees)
                transform={`rotate(-90, 12, 12)`}
              />
            </Svg>

            {/* Cancel icon in the middle */}
            <View style={styles.cancelIconContainer}>
              <MaterialIcons name="close" size={14} color={COLORS.error} />
            </View>
          </View>
        </View>
      ) : (
        <MaterialIcons name="download" size={24} color={COLORS.primary} />
      )}
    </TouchableOpacity>
  );
};

// EnhancedImageAttachment component with improved single-step download
export const EnhancedImageAttachment = ({
  handleAttachmentPress,
  attachment,
  roomId,
  isOwnFile
}: AttachmentProps) => {
  const { saveFileToDevice, activeDownloadsRef, cancelDownload } = useWorklet();
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [mediaPlayerVisible, setMediaPlayerVisible] = useState(false);

  // Use the cached file hook
  const {
    attachmentKey,
    downloadStatus,
    isDownloading,
    isCached,
    hasPreview,
    handleDownload
  } = useCachedFile(roomId, attachment);

  // Check if download is pending using ref for reliable synchronous check
  const isDownloadPending = attachmentKey &&
    activeDownloadsRef?.current?.has(attachmentKey);

  // Check if there was an error or timeout
  const hasError = downloadStatus?.error || downloadStatus?.timedOut || false;

  // Combined state that handles all download states
  const isDownloadActive = (isDownloading || isDownloadPending || isLoadingPreview) && !hasError;

  // Determine if download is complete
  const isDownloadComplete = downloadStatus?.progress >= 100 || isCached;

  // Check if we have a path to the file but haven't loaded the data yet
  const hasPath = downloadStatus?.path;
  const needsDataLoading = hasPath && !localPreviewUri && !isLoadingPreview;

  // Auto-preview our own images when component mounts
  useEffect(() => {
    if (isOwnFile && !isDownloadActive && !isDownloadComplete && !hasError && !localPreviewUri) {
      console.log(`Auto-downloading own image: ${attachment.name}`);
      handleDownload(false); // Download full image since it's our own
    }
  }, [isOwnFile, isDownloadActive, isDownloadComplete, hasError, localPreviewUri, attachment.name]);

  // Convert data to URI format for display
  useEffect(() => {
    if (downloadStatus?.data) {
      // Convert data directly to URI
      const mimeType = downloadStatus.mimeType || getMimeTypeFromFilename(attachment.name) || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${downloadStatus.data}`;
      setLocalPreviewUri(dataUri);
      setShowPlaceholder(false);
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
          setShowPlaceholder(false);
        }
      } catch (error) {
        console.error('Error lazy loading image:', error);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadImageData();
  }, [needsDataLoading, attachmentKey, attachment.name, downloadStatus?.mimeType]);

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

  // Handle cancellation
  const handleCancelDownload = () => {
    if (attachmentKey) {
      cancelDownload(roomId, attachment.blobId, attachmentKey);
    }
  };

  const handleImagePress = () => {
    // If the image is downloaded and we have a path or data, open the media player
    if ((isDownloadComplete || localPreviewUri) && !isDownloadActive) {
      // Get the appropriate path for the media player
      const mediaPath = downloadStatus?.path || localPreviewUri;

      if (mediaPath) {
        setMediaPlayerVisible(true);
        return;
      }
    }

    // Allow retrying if there was an error
    if (hasError && !isDownloadActive) {
      // Start a fresh download
      handleDownload(false); // Always download full quality on retry
      return;
    }

    if (isDownloadActive) {
      // If already downloading, show cancel option
      Alert.alert(
        'Download in Progress',
        'Do you want to cancel this download?',
        [
          { text: 'Continue', style: 'cancel' },
          { text: 'Cancel Download', style: 'destructive', onPress: handleCancelDownload }
        ]
      );
      return;
    }

    // If not downloaded yet, start downloading the full quality image directly
    if (!isDownloadComplete && !localPreviewUri) {
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

      if (!success) {
        Alert.alert('Error', 'Failed to open/save image');
      }
    } catch (error) {
      console.error('Error handling image:', error);
      Alert.alert('Error', 'An error occurred');
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.imageAttachmentContainer}
        onPress={handleImagePress}
        disabled={isDownloadActive}
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
              <MaterialIcons
                name={hasError ? "broken-image" : "image"}
                size={49}
                color={hasError ? COLORS.error : (isOwnFile ? COLORS.info : COLORS.primary)}
              />

              {isOwnFile && !isDownloadComplete && !isDownloadActive && !hasError && (
                <View style={styles.ownImageBadge}>
                  <MaterialIcons name="person" size={12} color="#FFF" />
                </View>
              )}

              <Text
                style={styles.attachmentName}
                numberOfLines={2}
                onPress={() => handleAttachmentPress && handleAttachmentPress(attachment)}
              >
                {attachment.name}
                {isOwnFile && <Text style={{ color: COLORS.info }}> (Your image)</Text>}
              </Text>

              {/* Show error message if applicable */}
              {hasError && (
                <Text style={styles.errorText}>
                  {downloadStatus?.message || 'Download failed. Tap to retry.'}
                </Text>
              )}

              {/* Show a single download button - always download full quality */}
              {!isDownloadActive && !hasError && (
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => handleDownload(false)} // Always get full quality
                >
                  <MaterialIcons name="download" size={24} color="#FFF" />
                  <Text style={styles.downloadButtonText}>
                    Download Image
                  </Text>
                </TouchableOpacity>
              )}

              {/* Show retry button for images with errors */}
              {hasError && (
                <TouchableOpacity
                  style={[styles.downloadButton, styles.retryButton]}
                  onPress={() => handleDownload(false)} // Full quality on retry
                >
                  <MaterialIcons name="refresh" size={24} color="#FFF" />
                  <Text style={styles.downloadButtonText}>
                    Retry Download
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {isDownloadActive && (
            <View style={styles.imageProgressContainer}>
              {/* Add cancel button */}
              <TouchableOpacity
                style={styles.imageCancel}
                onPress={handleCancelDownload}
              >
                <MaterialIcons name="cancel" size={20} color={COLORS.error} />
              </TouchableOpacity>

              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.progressText}>
                {isLoadingPreview ? 'Loading image...' : `${downloadStatus?.progress || 0}% - ${downloadStatus?.message || 'Downloading...'}`}
              </Text>
            </View>
          )}

          {(isDownloadComplete || localPreviewUri) && !isDownloadActive && (
            <View style={styles.imageActionContainer}>
              <TouchableOpacity
                style={styles.imageAction}
                onPress={handleSaveToDevice}
              >
                <MaterialIcons name="save-alt" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Add the MediaPlayerModal */}
      <MediaPlayerModal
        visible={mediaPlayerVisible}
        onClose={() => setMediaPlayerVisible(false)}
        filePath={downloadStatus?.path || localPreviewUri}
        fileType={downloadStatus?.mimeType || 'image/jpeg'}
        fileName={attachment.name}
        onSave={() => saveFileToDevice(attachmentKey)}
      />
    </>
  );
};

// Enhanced FileAttachment component that integrates with the Media Player
export const EnhancedFileAttachment = ({
  handleAttachmentPress,
  attachment,
  roomId,
  isOwnFile
}: AttachmentProps) => {
  const { saveFileToDevice, activeDownloadsRef, cancelDownload } = useWorklet();
  const [mediaPlayerVisible, setMediaPlayerVisible] = useState(false);

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

  // Check if download is pending in the active downloads list using ref for reliable check
  const isDownloadPending = attachmentKey &&
    activeDownloadsRef?.current?.has(attachmentKey);

  // Check if there was an error or timeout
  const hasError = downloadStatus?.error || downloadStatus?.timedOut || false;

  // Combined state that handles all download states
  const isDownloadActive = (isDownloading || isDownloadPending) && !hasError;

  // Auto-preview our own files when component mounts
  useEffect(() => {
    if (isOwnFile && !isDownloadActive && !isDownloadComplete && !hasError) {
      console.log(`Auto-downloading own file: ${attachment.name}`);
      handleDownload(false); // Download full file since it's our own
    }
  }, [isOwnFile, isDownloadActive, isDownloadComplete, hasError, attachment.name]);

  // Handle cancellation
  const handleCancelDownload = () => {
    if (attachmentKey) {
      cancelDownload(roomId, attachment.blobId, attachmentKey);
    }
  };

  // Check if this is a media file that can be previewed
  const isMediaFile = () => {
    const fileName = attachment.name.toLowerCase();
    return (
      fileName.endsWith('.mp4') ||
      fileName.endsWith('.mp3') ||
      fileName.endsWith('.wav') ||
      fileName.endsWith('.mov') ||
      fileName.endsWith('.m4a')
    );
  };

  const handleDownloadOrOpen = async () => {
    // For media files that are already downloaded, open the media player
    if (isDownloadComplete && isMediaFile() && downloadStatus?.path) {
      setMediaPlayerVisible(true);
      return;
    }

    // For other cases, use the existing logic
    if (hasError && !isDownloadActive) {
      // Start a fresh download
      handleDownload(false);
      return;
    }

    if (isDownloadActive) {
      // If already downloading, show cancel option
      Alert.alert(
        'Download in Progress',
        'Do you want to cancel this download?',
        [
          { text: 'Continue', style: 'cancel' },
          { text: 'Cancel Download', style: 'destructive', onPress: handleCancelDownload }
        ]
      );
      return;
    }

    if (isDownloadComplete) {
      // If it's a media file, show the player, otherwise save it
      if (isMediaFile() && downloadStatus?.path) {
        setMediaPlayerVisible(true);
      } else {
        // If already downloaded, open or save it
        handleSaveFile();
      }
    } else {
      // Start download - no confirmation needed since this is manual now
      handleDownload(false);
    }
  };

  const handleSaveFile = async () => {
    if (!isDownloadComplete || !attachmentKey) return;

    try {
      const success = await saveFileToDevice(attachmentKey);
      if (!success) {
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

  // Get appropriate icon for error type
  const getErrorIcon = (errorType: string = 'unknown') => {
    switch (errorType) {
      case 'peer_connection':
        return 'wifi-off';
      case 'block_not_found':
        return 'block';
      case 'timeout':
        return 'timer-off';
      case 'corrupt_data':
        return 'error';
      case 'network':
        return 'signal-wifi-off';
      default:
        return 'error-outline';
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.attachmentContainer}
        onPress={handleDownloadOrOpen}
        disabled={isDownloadActive}
      >
        <View style={styles.attachmentIconContainer}>
          <MaterialIcons
            name={
              hasError ? getErrorIcon(downloadStatus?.errorType) :
                isDownloadComplete ? 'check-circle' :
                  getFileIcon(attachment.name)
            }
            size={25}
            color={
              hasError ? COLORS.error :
                isDownloadComplete ? COLORS.success :
                  isOwnFile ? COLORS.info : COLORS.primary
            }
          />

          {isOwnFile && !isDownloadComplete && !isDownloadActive && !hasError && (
            <View style={styles.ownFileBadge}>
              <MaterialIcons name="person" size={10} color="#FFF" />
            </View>
          )}
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
            {isLargeFile && <Text style={{ color: COLORS.warning }}> (Large)</Text>}
            {isOwnFile && <Text style={{ color: COLORS.info }}> (Your file)</Text>}
          </Text>

          {isDownloadActive && downloadStatus && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${downloadStatus.progress}%` }]}
                  />
                </View>

                {/* Cancel button */}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelDownload}
                >
                  <MaterialIcons name="cancel" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
              <Text style={styles.progressText}>
                {downloadStatus.progress}% - {downloadStatus.message || 'Downloading...'}
              </Text>
            </View>
          )}

          {hasError && downloadStatus && (
            <View style={styles.errorContainer}>
              <MaterialIcons
                name={getErrorIcon(downloadStatus.errorType)}
                size={18}
                color={COLORS.error}
              />
              <Text style={styles.errorText}>
                {downloadStatus.userMessage || downloadStatus.message || 'Download failed. Tap to retry.'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.downloadIconContainer}>
          {isDownloadActive ? (
            <DownloadButton
              isDownloading={true}
              progress={downloadStatus?.progress || 0}
              onDownload={() => { }}
              onCancel={handleCancelDownload}
            />
          ) : hasError ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => handleDownload(false)}
            >
              <MaterialIcons name="refresh" size={22} color="#FFF" />
            </TouchableOpacity>
          ) : isDownloadComplete ? (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveFile}
            >
              <MaterialIcons name="save-alt" size={22} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <DownloadButton
              isDownloading={false}
              progress={0}
              onDownload={() => handleDownload(false)}
              onCancel={() => { }}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Media Player Modal for the file */}
      <MediaPlayerModal
        visible={mediaPlayerVisible}
        onClose={() => setMediaPlayerVisible(false)}
        filePath={downloadStatus?.path}
        fileType={downloadStatus?.mimeType || getMimeTypeFromFilename(attachment.name)}
        fileName={attachment.name}
        onSave={() => saveFileToDevice(attachmentKey)}
      />
    </>
  );
};

// Helper function to determine MIME type from filename
const getMimeTypeFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'pdf': 'application/pdf',
    'txt': 'text/plain'
  };

  return mimeTypes[ext] || 'application/octet-stream';
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
  progressText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  imageAttachmentContainer: {
    marginVertical: 5,
  },
  imageAttachmentPlaceholder: {
    width: '100%',
    height: 151,
    backgroundColor: 'rgba(1,0,0,0.1)',
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
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
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 12,
  },
  downloadButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBar: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(1,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  cancelButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(237, 66, 69, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginLeft: 4,
    flex: 1,
  },
  retryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 10,
    color: COLORS.error,
    fontWeight: 'bold',
  },
  downloadButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(114, 137, 218, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleBackground: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelIconContainer: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownFileBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.info,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  ownImageBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.info,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },

  // Styles for action buttons
  saveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Image attachment cancel button
  imageCancel: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

export default {
  EnhancedFileAttachment,
  EnhancedImageAttachment
};

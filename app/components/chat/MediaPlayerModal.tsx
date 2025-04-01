import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { COLORS } from '../../utils/constants';
import FileCacheManager from '../../utils/FileCacheManager';

interface MediaPlayerModalProps {
  visible: boolean;
  onClose: () => void;
  filePath?: string;
  fileType?: string;
  fileName?: string;
  onSave?: () => void;
}

const MediaPlayerModal: React.FC<MediaPlayerModalProps> = ({
  visible,
  onClose,
  filePath = "",
  fileType = 'unknown',
  fileName = 'File',
  onSave
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<Video>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  // Clean up when modal closes
  useEffect(() => {
    if (!visible) {
      // If audio is playing, stop it
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(err =>
          console.log('Error stopping audio:', err)
        );
      }

      // Reset orientation when modal closes
      if (isLandscape) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
          .catch(err => console.log('Error locking orientation:', err));
        setIsLandscape(false);
      }

      // Reset other state
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
    }
  }, [visible]);

  // Clean up sound when component unmounts
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(err =>
          console.log('Error unloading sound:', err)
        );
      }
    };
  }, []);

  useEffect(() => {
    // Reset loading state when filePath changes or becomes available
    if (filePath) {
      const mediaType = getMediaType();

      // Images and videos should only show loading initially, then onLoad will handle it
      if (mediaType === 'video') {
        // Start with loading true, the onLoad handlers will set it to false
        setIsLoading(true);
      }

      // For other types, we can set loading to false immediately
      if (mediaType === 'other') {
        setIsLoading(false);
      }

      // Audio is handled separately in the loadAudio function

      // Reset error state when path changes
      setError(null);
    }
  }, [filePath]);

  useEffect(() => {
    if (visible) {
      console.log('MediaPlayerModal opened with:', {
        filePath,
        fileType,
        mediaType: getMediaType(),
        isDataUri: filePath?.startsWith('data:')
      });
    }
  }, [visible, filePath, fileType]);

  const handleToggleFullscreen = async () => {
    try {
      if (isFullscreen) {
        // Return to portrait
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
      } else {
        // Go to landscape
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsLandscape(true);
      }
      setIsFullscreen(!isFullscreen);
    } catch (error) {
      console.log('Error toggling fullscreen:', error);
    }
  };

  const handleOrientationChange = (orientation: any) => {
    const isLandscapeOrientation =
      orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
      orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

    setIsLandscape(isLandscapeOrientation);
  };

  // Load and play audio
  const loadAudio = async () => {
    try {
      setIsLoading(true);

      // Create and load the sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: filePath },
        { shouldPlay: false },
        onAudioPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setIsLoading(false);
    } catch (error) {
      console.log('Error loading audio:', error);
      setError('Failed to load audio file');
      setIsLoading(false);
    }
  };

  // Handle audio playback status updates
  const onAudioPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);
    } else if (status.error) {
      console.log('Audio playback error:', status.error);
      setError(`Playback error: ${status.error}`);
    }
  };

  // Toggle audio playback
  const toggleAudioPlayback = async () => {
    try {
      if (!soundRef.current) return;

      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.log('Error toggling audio playback:', error);
      setError('Failed to control playback');
    }
  };

  // Format time for audio player
  const formatTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Determine media type
  const getMediaType = (): 'video' | 'image' | 'audio' | 'other' => {
    if (!filePath) return 'other';

    if (fileType) {
      if (fileType.startsWith('video/')) return 'video';
      if (fileType.startsWith('image/')) return 'image';
      if (fileType.startsWith('audio/')) return 'audio';
    }

    // Fallback to file extension check
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';

    return 'other';
  };

  // Load audio if this is an audio file and modal is visible
  useEffect(() => {
    if (visible && getMediaType() === 'audio') {
      loadAudio();
    }
  }, [visible, filePath]);

  // Listen for orientation changes
  useEffect(() => {
    const subscription = ScreenOrientation.addOrientationChangeListener(
      ({ orientationInfo }) => handleOrientationChange(orientationInfo.orientation)
    );

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

  // Render different content based on media type
  const renderMediaContent = () => {
    const mediaType = getMediaType();

    if (!filePath) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>No file path provided</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )
    }

    switch (mediaType) {
      case 'video':
        return (
          <View style={[styles.videoContainer, isLandscape && styles.fullscreenVideo]}>
            <Video
              ref={videoRef}
              source={{ uri: filePath }}
              style={styles.video}
              resizeMode={isFullscreen ? ResizeMode.CONTAIN : ResizeMode.CONTAIN}
              useNativeControls

              isLooping
              onLoad={() => setIsLoading(false)}
              onError={(error) => {
                console.log('Video error:', error);
                setError('Failed to load video');
                setIsLoading(false);
              }}
            />

            {!isFullscreen && (
              <TouchableOpacity
                style={styles.fullscreenButton}
                onPress={handleToggleFullscreen}
              >
                <MaterialIcons name="fullscreen" size={24} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        );

      case 'image':
        console.log('IMAGEEGEGE')
        return (
          <View style={styles.imageContainer}>
            {isLoading && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            )}
            <Image
              source={{ uri: filePath }}
              style={styles.image}
              contentFit="contain"
              transition={300}
              onLoad={() => {
                console.log('Image loaded successfully');
                setIsLoading(false);
              }}
              onError={(error) => {
                console.log('Image load error:', error);
                setError('Failed to load image');
                setIsLoading(false);
              }}
            />
          </View>
        );
      case 'audio':
        return (
          <View style={styles.audioContainer}>
            <View style={styles.audioPlayer}>
              <View style={styles.audioIconContainer}>
                <MaterialIcons name="audiotrack" size={64} color={COLORS.primary} />
              </View>

              <Text style={styles.audioTitle} numberOfLines={2}>
                {fileName || 'Audio File'}
              </Text>

              <View style={styles.audioControls}>
                <Text style={styles.audioTime}>{formatTime(position)}</Text>

                <TouchableOpacity
                  style={styles.playPauseButton}
                  onPress={toggleAudioPlayback}
                  disabled={isLoading}
                >
                  <MaterialIcons
                    name={isPlaying ? "pause" : "play-arrow"}
                    size={36}
                    color={COLORS.textPrimary}
                  />
                </TouchableOpacity>

                <Text style={styles.audioTime}>{formatTime(duration)}</Text>
              </View>
            </View>
          </View>
        );

      default:
        return (
          <View style={styles.unsupportedContainer}>
            <MaterialIcons name="insert-drive-file" size={64} color={COLORS.primary} />
            <Text style={styles.unsupportedText}>
              This file type cannot be previewed
            </Text>
            <Text style={styles.fileNameText}>{fileName}</Text>
          </View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={[
        styles.container,
        isLandscape && styles.landscapeContainer
      ]}>
        {/* Header */}
        {(!isLandscape || !isFullscreen) && (
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.headerTitle} numberOfLines={1}>
              {fileName || 'Media Preview'}
            </Text>

            {onSave && (
              <TouchableOpacity onPress={onSave} style={styles.saveButton}>
                <MaterialIcons name="save-alt" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Content */}
        <View style={[
          styles.content,
          isLandscape && styles.landscapeContent
        ]}>
          {
            renderMediaContent()
          }

        </View>

        {/* Footer (only in portrait mode) */}
        {(!isLandscape || !isFullscreen) && getMediaType() !== 'audio' && (
          <View style={styles.footer}>
            {onSave && (
              <TouchableOpacity
                style={styles.footerButton}
                onPress={onSave}
              >
                <MaterialIcons name="save-alt" size={20} color={COLORS.textPrimary} />
                <Text style={styles.footerButtonText}>Save to Device</Text>
              </TouchableOpacity>
            )}

            {getMediaType() === 'video' && (
              <TouchableOpacity
                style={styles.footerButton}
                onPress={handleToggleFullscreen}
              >
                <MaterialIcons name="fullscreen" size={20} color={COLORS.textPrimary} />
                <Text style={styles.footerButtonText}>Fullscreen</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  landscapeContainer: {
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginHorizontal: 16,
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeContent: {
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
    aspectRatio: undefined,
  },
  video: {
    flex: 1,
  },
  fullscreenButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  unsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unsupportedText: {
    marginTop: 16,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  fileNameText: {
    marginTop: 8,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 150,
  },
  footerButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 20,
  },
  audioPlayer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  audioIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(114, 137, 218, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  audioTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 24,
    textAlign: 'center',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  audioTime: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 10,
  },
});

export default MediaPlayerModal;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert
} from 'react-native';
import Message, { SystemMessage } from './Message';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as MediaLibrary from "expo-media-library"
import * as FileSystem from "expo-file-system"
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useChat } from '../../hooks/useChat';
import { COLORS } from '../../utils/constants';
import useUser from '../../hooks/useUser';
import useWorklet from '../../hooks/useWorklet';
import RoomHeader from './RoomHeader';

// Date header component to show date separators

const EnhancedChatRoom = () => {
  const { currentRoom, messages, sendMessage, loadMoreMessages } = useChat();
  const { user } = useUser();
  const { rpcClient } = useWorklet();
  const [messageText, setMessageText] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(44); // Default single line height
  const [isUploading, setIsUploading] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  // Handle text input content size change
  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    // Constrain height between min and max values
    const newHeight = Math.min(Math.max(44, height), 120); // min: ~1 line, max: ~4 lines
    setInputHeight(newHeight);
  };

  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);

  // Toggle attachment options
  const toggleAttachmentOptions = () => {
    setShowAttachmentOptions(prev => !prev);
  };

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        // Request media library permissions for saving images
        const mediaPermission = await MediaLibrary.requestPermissionsAsync();
        if (mediaPermission.status !== 'granted') {
          console.log('Media library permission not granted');
        }

        // Request file system permissions for saving files
        // const filePermission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        // if (!filePermission.granted) {
        //   console.log('File system permission not granted');
        // }
        if (Platform.OS !== 'web' as any) {
          // Request media library permissions
          const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (mediaLibraryPermission.status !== 'granted') {
            console.log('Media library permission not granted');
          }

          // Request camera permissions
          const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
          if (cameraPermission.status !== 'granted') {
            console.log('Camera permission not granted');
          }
        }
      }
    })();
  }, []);


  // Add keyboard listeners to track keyboard visibility
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Set room header with sharing functionality
  useEffect(() => {
    if (currentRoom) {
      // Add the RoomHeader component to provide share functionality
      navigation.setOptions({
        headerTitle: () => (
          <RoomHeader roomId={currentRoom.id} roomName={currentRoom.name} />
        )
      });
    }
  }, [currentRoom, navigation]);

  // Function to handle sending a message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      await sendMessage(messageText.trim());
      setMessageText('');
      setInputHeight(44); // Reset input height to single line
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // For photo selection
  const handleSelectPhoto = async () => {
    if (!currentRoom?.id) return;
    setShowAttachmentOptions(false);

    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        // Extract file name from URI or use a default
        const fileName = selectedAsset.fileName ||
          `image_${Date.now()}.${selectedAsset.uri.split('.').pop() || 'jpg'}`;

        // Upload the file using path
        if (rpcClient) {
          setIsUploading(true);

          try {
            // Create upload request
            const request = rpcClient.request('uploadFile');

            // Construct file info with path
            const fileInfo = {
              roomId: currentRoom?.id,
              name: fileName,
              type: selectedAsset.mimeType || 'image/jpeg',
              path: selectedAsset.uri,
              size: selectedAsset.fileSize || 0
            };

            // Send upload request
            await request.send(JSON.stringify(fileInfo));
          } finally {
            setIsUploading(false);
          }
        }
      }
    } catch (error: any) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo: ' + error.message);
      setIsUploading(false);
    }
  };

  // For camera capture
  const handleCameraCapture = async () => {
    if (!currentRoom || !currentRoom.id) return;
    setShowAttachmentOptions(false);

    try {
      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        // Generate file name
        const fileName = `camera_${Date.now()}.jpg`;

        // Upload the file using path
        if (rpcClient) {
          setIsUploading(true);

          try {
            // Create upload request
            const request = rpcClient.request('uploadFile');

            // Construct file info with path
            const fileInfo = {
              roomId: currentRoom?.id,
              name: fileName,
              type: 'image/jpeg',
              path: selectedAsset.uri,
              size: selectedAsset.fileSize || 0
            };

            // Send upload request
            await request.send(JSON.stringify(fileInfo));
          } finally {
            setIsUploading(false);
          }
        }
      }
    } catch (error: any) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo: ' + error.message);
      setIsUploading(false);
    }
  };

  // For document selection
  const handleSelectDocument = async () => {

    if (!currentRoom || !currentRoom.id) return;
    setShowAttachmentOptions(false);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        if (rpcClient) {
          setIsUploading(true);

          try {
            // Create upload request
            const request = rpcClient.request('uploadFile');

            // Construct file info with path
            const fileInfo = {
              roomId: currentRoom.id,
              name: file.name,
              type: file.mimeType,
              path: file.uri,
              size: file.size
            };

            // Send upload request
            await request.send(JSON.stringify(fileInfo));
          } finally {
            setIsUploading(false);
          }
        }
      }
    } catch (error: any) {
      console.error('Error selecting document:', error);
      Alert.alert('Error', 'Failed to select document: ' + error.message);
      setIsUploading(false);
    }
  };

  // Function to handle attachment press/download
  const handleAttachmentPress = async (attachment: any) => {
    console.log(attachment)
    if (!currentRoom || !currentRoom.id) return;
    if (!attachment || !attachment.blobId) {
      Alert.alert('Error', 'Invalid attachment data');
      return;
    }

    try {
      Alert.alert(
        'Download File',
        `Do you want to download "${attachment.name}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Download',
            onPress: async () => {
              try {
                setIsUploading(true); // Reuse uploading state for download

                // Request file download from backend
                const request = rpcClient.request('downloadFile');
                await request.send(JSON.stringify({
                  roomId: currentRoom.id,
                  attachment: attachment
                }));

                // Show success message (actual download will be handled by the operating system)
                Alert.alert('Download Started', 'Your file download has started');
              } catch (err) {
                console.error('Error downloading file:', err);
                Alert.alert('Download Failed', 'Could not download the file');
              } finally {
                setIsUploading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error handling attachment:', error);
      Alert.alert('Error', 'Failed to handle attachment');
    }
  };

  // Function to render each message
  const renderItem = ({ item }: any) => {
    if (!item) {
      return null;
    }

    // If the message is a system message
    if (item.system) {
      return <SystemMessage message={item} />;
    }

    // Check if the message is from the current user
    const isOwnMessage = user && user.name && item.sender === user.name;
    const attachment = item.hasAttachments ? JSON.parse(item.attachments) : []

    // Use our enhanced message component with proper room ID
    return (
      <Message
        handleAttachmentPress={handleAttachmentPress}
        message={item}
        isOwnMessage={isOwnMessage as boolean}
        roomId={currentRoom?.id as any}
      />
    );
  };

  // Define the empty component with debug info
  const EmptyMessagesList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="forum" size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyText}>
        {currentRoom
          ? `No messages yet in ${currentRoom.name}. Be the first to send a message!`
          : 'No room selected'}
      </Text>
    </View>
  );

  // Function to load more messages (previous/older messages)
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !loadMoreMessages) return;

    setIsLoadingMore(true);
    loadMoreMessages()
      .then(() => {
        setIsLoadingMore(false);
      })
      .catch(err => {
        console.error('Error loading more messages:', err);
        setIsLoadingMore(false);
      });
  }, [isLoadingMore, loadMoreMessages]);

  // Render the loading indicator for older messages
  const renderFooter = () => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingMoreText}>Loading older messages...</Text>
      </View>
    );
  };

  console.log({ messages })

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isUploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.uploadingText}>Processing file...</Text>
          </View>
        </View>
      )}

      <View style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item?.id || `fallback-${Math.random()}`}
          contentContainerStyle={[
            styles.messagesList,
            { paddingBottom: keyboardVisible ? 80 : 10 }
          ]}
          inverted={true} // Display newest messages at the bottom
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={EmptyMessagesList}
        />

        {showAttachmentOptions && (
          <>
            <TouchableOpacity
              style={styles.overlay}
              activeOpacity={0}
              onPress={toggleAttachmentOptions}
            />
            <View style={styles.attachmentOptions}>
              <TouchableOpacity style={styles.attachmentOption} onPress={handleSelectPhoto}>
                <View style={[styles.attachmentIconWrapper, { backgroundColor: '#4caf50' }]}>
                  <MaterialIcons name="photo" size={24} color="#fff" />
                </View>
                <Text style={styles.attachmentText}>Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={handleCameraCapture}>
                <View style={[styles.attachmentIconWrapper, { backgroundColor: '#2196f3' }]}>
                  <MaterialIcons name="camera-alt" size={24} color="#fff" />
                </View>
                <Text style={styles.attachmentText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={handleSelectDocument}>
                <View style={[styles.attachmentIconWrapper, { backgroundColor: '#ff9800' }]}>
                  <MaterialIcons name="insert-drive-file" size={24} color="#fff" />
                </View>
                <Text style={styles.attachmentText}>Document</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity style={styles.attachmentButton} onPress={toggleAttachmentOptions}>
            <MaterialIcons name="attach-file" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { height: inputHeight }]}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={1000}
            onContentSizeChange={handleContentSizeChange}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !messageText.trim() && styles.disabledButton
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim()}
          >
            <MaterialIcons
              name="send"
              size={24}
              color={messageText.trim() ? COLORS.textPrimary : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  chatContainer: {
    flex: 1,
    position: 'relative',
  },
  messagesList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  messageContainer: {
    marginVertical: 6,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  messageContent: {
    padding: 10,
    borderRadius: 16,
  },
  ownMessageContent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageContent: {
    backgroundColor: COLORS.secondaryBackground,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  messageTimestamp: {
    fontSize: 10,
    marginTop: 2,
    alignSelf: 'flex-end',
    color: COLORS.textMuted,
  },
  ownMessageTimestamp: {
    color: COLORS.textSecondary,
  },
  otherMessageTimestamp: {
    color: COLORS.textMuted,
  },
  systemMessageContainer: {
    alignSelf: 'center',
    marginVertical: 10,
    backgroundColor: 'rgba(114, 137, 218, 0.1)',
    padding: 8,
    borderRadius: 12,
    marginHorizontal: 40,
  },
  systemMessageText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  systemMessageTimestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  dateHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.separator,
  },
  dateHeaderText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: COLORS.secondaryBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
    alignItems: 'center',
    width: '100%',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.input,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  sendButton: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.tertiaryBackground,
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  attachmentOptions: {
    position: 'absolute',
    bottom: 70, // Position above input
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.secondaryBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
    justifyContent: 'space-around',
    zIndex: 2,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1,
  },
  attachmentOption: {
    alignItems: 'center',
    width: 80,
  },
  attachmentIconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  // Attachment styles
  attachmentsContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
  },
  attachmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
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
  downloadIcon: {
    marginLeft: 8,
  },
  imageAttachmentContainer: {
    marginBottom: 8,
  },
  imageAttachmentPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '80%',
  },
  uploadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textPrimary
  }
})

export default EnhancedChatRoom

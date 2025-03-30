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
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useChat } from '../../hooks/useChat';
import { COLORS } from '../../utils/constants';
import useUser from '../../hooks/useUser';
import useWorklet from '../../hooks/useWorklet';
import RoomHeader from './RoomHeader';
import { selectImage, takePhoto } from '../../utils/permissionHelpers';

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
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);

  // Handle text input content size change
  const handleContentSizeChange = (event) => {
    const { height } = event.nativeEvent.contentSize;
    // Constrain height between min and max values
    const newHeight = Math.min(Math.max(44, height), 120); // min: ~1 line, max: ~4 lines
    setInputHeight(newHeight);
  };

  // Toggle attachment options
  const toggleAttachmentOptions = () => {
    setShowAttachmentOptions(prev => !prev);
  };

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
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Upload a file to the current room
  const uploadFile = async (fileInfo) => {
    if (!currentRoom?.id || !rpcClient) return;

    try {
      setIsUploading(true);
      const request = rpcClient.request('uploadFile');
      await request.send(JSON.stringify({
        roomId: currentRoom.id,
        ...fileInfo
      }));
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to upload file: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // For photo selection from gallery
  const handleSelectPhoto = async () => {
    setShowAttachmentOptions(false);

    try {
      const result = await selectImage({
        allowsMultipleSelection: false,
        quality: 0.8
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        // Extract file name from URI or use a default
        const fileName = selectedAsset.fileName ||
          `image_${Date.now()}.${selectedAsset.uri.split('.').pop() || 'jpg'}`;

        await uploadFile({
          name: fileName,
          type: selectedAsset.mimeType || 'image/jpeg',
          path: selectedAsset.uri,
          size: selectedAsset.fileSize || 0
        });
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo: ' + error.message);
    }
  };

  // For camera capture
  const handleCameraCapture = async () => {
    setShowAttachmentOptions(false);

    try {
      const result = await takePhoto({
        quality: 0.8
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        // Generate file name
        const fileName = `camera_${Date.now()}.jpg`;

        await uploadFile({
          name: fileName,
          type: 'image/jpeg',
          path: selectedAsset.uri,
          size: selectedAsset.fileSize || 0
        });
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo: ' + error.message);
    }
  };

  // For document selection
  const handleSelectDocument = async () => {
    setShowAttachmentOptions(false);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        await uploadFile({
          name: file.name,
          type: file.mimeType,
          path: file.uri,
          size: file.size
        });
      }
    } catch (error) {
      console.error('Error selecting document:', error);
      Alert.alert('Error', 'Failed to select document: ' + error.message);
    }
  };

  // Function to handle attachment press/download
  const handleAttachmentPress = async (attachment) => {
    if (!currentRoom?.id || !attachment?.blobId) {
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
            try {
              setIsUploading(true); // Reuse uploading state for download indicator

              // Request file download from backend
              const request = rpcClient.request('downloadFile');
              await request.send(JSON.stringify({
                roomId: currentRoom.id,
                attachment: attachment
              }));

              // Success message (actual download will be handled by the WorkletContext callbacks)
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
  };

  // Function to render each message
  const renderItem = ({ item }) => {
    if (!item) return null;

    // If the message is a system message
    if (item.system) {
      return <SystemMessage message={item} />;
    }

    // Check if the message is from the current user
    const isOwnMessage = user && user.name && item.sender === user.name;

    return (
      <Message
        handleAttachmentPress={handleAttachmentPress}
        message={item}
        isOwnMessage={isOwnMessage}
        roomId={currentRoom?.id}
      />
    );
  };

  // Define the empty component
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
});

export default EnhancedChatRoom;

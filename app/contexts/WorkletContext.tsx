import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Worklet } from 'react-native-bare-kit';
import * as FileSystem from "expo-file-system"
import { Alert, Platform } from 'react-native';
import RPC from 'bare-rpc';
// @ts-ignore
import bundle from '../app.bundle';
import b4a from "b4a"
import useUser from '../hooks/useUser';
import { Room, Message } from '../types';
import resetRegistry from './resetSystem';
import * as MediaLibrary from "expo-media-library"
// Use variables instead of state for callbacks
let updateRooms: ((rooms: Room[]) => void) | undefined = undefined;
let updateMessages: ((messages: Message[], replace: boolean) => void) | undefined = undefined;
let onRoomCreated: ((room: Room) => void) | undefined = undefined;
let onRoomJoined: ((room: Room) => void) | undefined = undefined;
let onInviteGenerated: ((roomId: string, inviteCode: string) => void) | undefined = undefined;

export interface WorkletContextType {
  worklet: Worklet | null;
  rpcClient: any;
  isInitialized: boolean;
  isBackendReady: boolean;
  isLoading: boolean;
  error: Error | null;
  generateSeedPhrase: () => Promise<string[]>;
  confirmSeedPhrase: (seed: string) => any;
  checkExistingUser: () => Promise<{ exists: boolean, user?: any, error?: string }>;
  updateRooms?: (rooms: Room[]) => void;
  updateMessages?: (messages: Message[]) => void;
  onRoomCreated?: (room: Room) => void;
  setCallbacks: (callbacks: {
    updateRooms?: (rooms: Room[]) => void,
    updateMessages?: (messages: Message[], replace: boolean) => void,
    onRoomCreated?: (room: Room) => void,
    onRoomJoined?: (room: Room) => void
  }) => void;
  reinitializeBackend: () => Promise<boolean>;
  onInviteGenerated?: (roomId: string, inviteCode: string) => void;
  setInviteCallbacks: (callbacks: {
    onInviteGenerated?: (roomId: string, inviteCode: string) => void
  }) => void;
  fileDownloads: any,
  downloadFile: any
}

export const WorkletContext = createContext<WorkletContextType>(undefined as any);

export interface WorkletProviderProps {
  children: ReactNode;
}

export const WorkletProvider: React.FC<WorkletProviderProps> = ({ children }) => {
  const { updateUser, storeSeedPhrase } = useUser();
  const [worklet, setWorklet] = useState<Worklet | null>(null);
  const [rpcClient, setRpcClient] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [fileDownloads, setFileDownloads] = useState<{
    [key: string]: {
      progress: number;
      message: string;
      preview: boolean;
      data?: string;
      mimeType?: string;
      fileName?: string;
    }
  }>({});

  const reset = useCallback(() => {
    // Reset callback references
    updateRooms = undefined;
    updateMessages = undefined;
    onRoomCreated = undefined;
    onRoomJoined = undefined;
    onInviteGenerated = undefined;

    // Don't reset worklet or RPC client as they are needed for communication
    // Just reset state
    setIsBackendReady(false);
    setError(null);

    console.log('WorkletContext reset complete');
  }, []);

  // Register with the reset registry on mount
  useEffect(() => {
    resetRegistry.register('WorkletContext', { reset });

    return () => {
      resetRegistry.unregister('WorkletContext');
    };
  }, [reset]);


  // Initialize worklet on component mount
  useEffect(() => {
    const initWorklet = async () => {
      try {
        console.log('Init worklet');
        setIsLoading(true);
        const newWorklet = new Worklet();
        newWorklet.start('/app.bundle', bundle, [Platform.OS]);

        // Initialize RPC client
        const { IPC } = newWorklet;
        const client = new RPC(
          IPC,
          (req: any) => {
            if (req.command === 'backendInitialized') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);

                if (parsedData.success) {
                  console.log('Backend initialized successfully');
                  setIsBackendReady(true);
                }
              } catch (e) {
                console.error('Error handling backendInitialized:', e);
              }
            }

            if (req.command === 'seedGenerated') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Seed generated, length:', parsedData.length);

                if (Array.isArray(parsedData) && parsedData.length > 0) {
                  storeSeedPhrase(parsedData);
                } else {
                  console.error('Received invalid seed data:', parsedData);
                }
              }
              catch (e) {
                console.error('Error handling seedGenerated:', e);
              }
            }

            if (req.command === 'userInfo') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('User info received:', parsedData);

                // This will trigger navigation via the useEffect hook in Login.tsx
                updateUser(parsedData);
              } catch (e) {
                console.error('Error handling userInfo:', e);
              }
            }

            if (req.command === 'userCheckResult') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('User check result:', parsedData);

                if (parsedData.exists && parsedData.user) {
                  updateUser(parsedData.user);
                }
              } catch (e) {
                console.error('Error handling userCheckResult:', e);
              }
            }

            if (req.command === 'profileUpdated') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Profile update result:', parsedData);

                if (parsedData.success && parsedData.user) {
                  updateUser(parsedData.user);
                }
              } catch (e) {
                console.error('Error handling profileUpdated:', e);
              }
            }

            if (req.command === 'roomInviteGenerated') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Room invite generated:', parsedData);

                if (parsedData.success && parsedData.roomId && parsedData.inviteCode) {
                  // Call the callback with room ID and invite code
                  if (onInviteGenerated) {
                    console.log('Calling onInviteGenerated with:', parsedData.roomId, parsedData.inviteCode);
                    onInviteGenerated(parsedData.roomId, parsedData.inviteCode);
                  } else {
                    console.log('No onInviteGenerated callback registered');
                  }
                } else {
                  console.error('Invalid invite response:', parsedData);
                }
              } catch (e) {
                console.error('Error handling roomInviteGenerated:', e);
              }
            }


            if (req.command === 'roomCreated') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Room created response received:', parsedData);

                if (parsedData.success && parsedData.room) {
                  // If the room was successfully created
                  if (onRoomCreated) {
                    console.log('Calling onRoomCreated callback with room data');
                    onRoomCreated(parsedData.room);
                  } else {
                    console.log('No onRoomCreated callback registered, requesting updated user info');
                  }

                  // Request updated user info to make sure rooms are updated
                  console.log('Requesting updated user info after room creation');
                  const userCheckRequest = client.request('checkUserExists');
                  userCheckRequest.send("");

                  // Also request updated room list
                  console.log('Requesting updated room list');
                  const roomsRequest = client.request('getRooms');
                  roomsRequest.send("");
                } else {
                  console.error('Room creation failed:', parsedData.error || 'Unknown error');
                }
              } catch (e) {
                console.error('Error handling roomCreated:', e);
              }
            }

            if (req.command === 'roomsList') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Rooms list received:', parsedData);

                if (updateRooms && Array.isArray(parsedData.rooms)) {
                  console.log('Updating rooms with:', parsedData.rooms.length, 'rooms');
                  updateRooms(parsedData.rooms);
                } else {
                  console.log('Cannot update rooms:', {
                    hasUpdateFn: !!updateRooms,
                    isArray: Array.isArray(parsedData.rooms),
                    rooms: parsedData.rooms
                  });
                }
              } catch (e) {
                console.error('Error handling roomsList:', e);
              }
            }


            if (req.command === 'roomJoinResult') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Room join result:', parsedData);

                if (parsedData.success && parsedData.room) {
                  // If the room was successfully joined, call the appropriate callback
                  if (onRoomJoined) {
                    onRoomJoined(parsedData.room);
                  } else {
                    console.log('No onRoomJoined callback registered');

                    // Request updated user data to make sure rooms are updated
                    const userCheckRequest = client.request('checkUserExists');
                    userCheckRequest.send("");
                  }
                }
              } catch (e) {
                console.error('Error handling roomJoinResult:', e);
              }
            }


            if (req.command === 'roomMessages') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log(`Room messages received: ${parsedData.messages?.length || 0} messages for room ${parsedData.roomId}`);

                // Debug whether callback exists
                console.log('updateMessages callback exists:', !!updateMessages);

                if (updateMessages && parsedData.success && Array.isArray(parsedData.messages)) {
                  console.log('Calling updateMessages with messages');

                  // Ensure all messages have roomId
                  const messagesWithRoomId = parsedData.messages.map((msg: Message) => ({
                    ...msg,
                    roomId: msg.roomId || parsedData.roomId || 'unknown'
                  }));

                  // Call the callback directly
                  updateMessages(messagesWithRoomId, true);
                } else {
                  console.log('Could not update messages:', {
                    hasUpdateFn: !!updateMessages,
                    success: parsedData.success,
                    isArray: Array.isArray(parsedData.messages)
                  });
                }
              } catch (e) {
                console.error('Error handling roomMessages:', e);
              }
            }

            if (req.command === 'newMessage') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('New message from backend:', parsedData);

                if (updateMessages && parsedData.success && parsedData.message) {
                  // Ensure message has roomId
                  const message = parsedData.message;
                  if (!message.roomId) {
                    console.warn('Message missing roomId, cannot process properly');
                  }

                  // Ensure message has all required fields correctly formatted
                  const formattedMessage = {
                    ...message,
                    id: message.id || `msg_${Date.now()}`,
                    timestamp: message.timestamp || Date.now(),
                    system: Boolean(message.system), // Ensure boolean
                  };

                  console.log('Formatted message for UI:', formattedMessage);
                  updateMessages([formattedMessage], false);
                }
              } catch (e) {
                console.error('Error handling newMessage:', e);
              }
            }

            if (req.command === 'olderMessages') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Older messages received:', parsedData);

                if (updateMessages && parsedData.success && Array.isArray(parsedData.messages)) {
                  // Ensure all messages have roomId
                  const messagesWithRoomId = parsedData.messages.map((msg: Message) => ({
                    ...msg,
                    roomId: msg.roomId || parsedData.roomId || 'unknown'
                  }));

                  // These are older messages to append
                  updateMessages(messagesWithRoomId, false);
                }
              } catch (e) {
                console.error('Error handling olderMessages:', e);
              }
            }
            if (req.command === 'fileUploaded') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('File uploaded response:', parsedData);

                if (parsedData.success && parsedData.message) {
                  // The server already sent a message with the attachment, no need to do anything more
                  console.log('Message with attachment has been added successfully');
                } else {
                  console.error('File upload failed:', parsedData.error || 'Unknown error');
                }
              } catch (e) {
                console.error('Error handling fileUploaded:', e);
              }
            }

            // In your RPC handler, add these event handlers:
            if (req.command === 'fileDownloadProgress') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('File download progress:', parsedData);

                onFileDownloadProgress(parsedData);
              } catch (e) {
                console.error('Error handling fileDownloadProgress:', e);
              }
            }

            if (req.command === 'fileDownloaded') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('File downloaded:', parsedData.fileName);

                onFileDownloaded(parsedData);
              } catch (e) {
                console.error('Error handling fileDownloaded:', e);
              }
            }



          }
        );
        const r = client.request("reinitialize")
        await r.send("")

        setWorklet(newWorklet);
        setRpcClient(client);
        setIsInitialized(true);
        setError(null);

        setTimeout(() => {
          const checkUserRequest = client.request('checkUserExists');
          checkUserRequest.send("");
          setIsLoading(false);
        }, 500);
      } catch (err) {
        console.error('Failed to initialize worklet:', err);
        setError(err instanceof Error ? err : new Error('Unknown error initializing worklet'));
        setIsLoading(false);
      }
    };

    initWorklet();

    // Clean up on unmount
    return () => {
      if (worklet) {
        if (rpcClient) {
          const req = rpcClient.request('teardown');
          req.send("");
        }
        worklet.terminate();
      }
    };
  }, []);

  const generateSeedPhrase = useCallback(async (): Promise<any> => {
    if (!rpcClient) {
      console.error('Cannot generate seed: RPC client not initialized');
      return [];
    }
    try {
      console.log('Requesting seed phrase from backend');
      const request = rpcClient.request('generateSeed');
      await request.send();
      console.log('Seed phrase request sent');
      // The actual seed will be returned via the RPC callback
      // and stored through the storeSeedPhrase callback
      return true;
    } catch (err) {
      console.error('Failed to generate seed phrase:', err);
      throw err instanceof Error ? err : new Error('Failed to generate seed phrase');
    }
  }, [rpcClient]);

  const confirmSeedPhrase = useCallback(async (seedPhrase: string[]): Promise<{ success: boolean, userId?: string, error?: string }> => {
    if (!rpcClient) {
      console.error('Cannot confirm seed: RPC client not initialized');
      return { success: false, error: 'RPC client not initialized' };
    }

    try {
      console.log('Confirming seed phrase, length:', seedPhrase.length);

      // Ensure seed is properly formatted
      if (!Array.isArray(seedPhrase) || seedPhrase.length === 0) {
        console.error('Invalid seed format:', typeof seedPhrase);
        return {
          success: false,
          error: 'Invalid seed format'
        };
      }

      // Log seed for debugging (in production, would be removed for security)
      console.log('Using seed:', seedPhrase);

      const request = rpcClient.request('confirmSeed');
      await request.send(JSON.stringify(seedPhrase));
      console.log('Seed confirmation request sent');

      return { success: true };
    } catch (err) {
      console.error('Failed to confirm seed phrase:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to confirm seed phrase'
      };
    }
  }, [rpcClient]);


  const checkExistingUser = useCallback(async (): Promise<{ exists: boolean, user?: any, error?: string }> => {
    if (!rpcClient) {
      console.error('RPC client not initialized');
      return { exists: false, error: 'RPC client not initialized' };
    }

    try {
      const request = rpcClient.request('checkUserExists');
      await request.send();

      // The actual result will be processed in the RPC event handler
      // and will update the user state through updateUser

      return { exists: true };
    } catch (err) {
      console.error('Failed to check existing user:', err);
      return {
        exists: false,
        error: err instanceof Error ? err.message : 'Failed to check existing user'
      };
    }
  }, [rpcClient]);

  // Set callback functions from ChatContext
  const setCallbacks = useCallback((callbacks: {
    updateRooms?: (rooms: Room[]) => void,
    updateMessages?: (messages: Message[], replace: boolean) => void,
    onRoomCreated?: (room: Room) => void,
    onRoomJoined?: (room: Room) => void,
    onInviteGenerated?: (roomId: string, inviteCode: string) => void // Add this
  }) => {
    console.log('Setting callbacks in WorkletContext:', callbacks);

    // Store existing references
    if (callbacks.updateRooms) {
      updateRooms = callbacks.updateRooms;
      console.log('updateRooms callback set successfully');
    }

    if (callbacks.updateMessages) {
      updateMessages = callbacks.updateMessages;
      console.log('updateMessages callback set successfully');
    }

    if (callbacks.onRoomCreated) {
      onRoomCreated = callbacks.onRoomCreated;
      console.log('onRoomCreated callback set successfully');
    }

    if (callbacks.onRoomJoined) {
      onRoomJoined = callbacks.onRoomJoined;
      console.log('onRoomJoined callback set successfully');
    }

    // Store the new invite callback reference
    if (callbacks.onInviteGenerated) {
      onInviteGenerated = callbacks.onInviteGenerated;
      console.log('onInviteGenerated callback set successfully');
    }
  }, []);

  const setInviteCallbacks = useCallback((callbacks: {
    onInviteGenerated?: (roomId: string, inviteCode: string) => void
  }) => {
    console.log('Setting invite callbacks in WorkletContext:', callbacks);

    if (callbacks.onInviteGenerated) {
      onInviteGenerated = callbacks.onInviteGenerated;
      console.log('onInviteGenerated callback set successfully');
    }
  }, []);



  const reinitializeBackend = useCallback(async (): Promise<boolean> => {
    if (!rpcClient) {
      console.error('Cannot reinitialize - RPC client not initialized');
      return false;
    }

    try {
      setIsLoading(true);
      console.log('Requesting backend reinitialization...');

      const request = rpcClient.request('reinitialize');
      await request.send();

      // The result will be processed in the RPC event handler
      // and will update the backend state through the 'backendInitialized' event
      setIsBackendReady(false);

    } catch (err) {
      console.error('Failed to reinitialize backend:', err);
      setIsLoading(false);
      return false;
    }

    return false
  }, [rpcClient]);


  // Add this to your callbacks
  const onFileDownloadProgress = (data: any) => {
    const { attachmentId, progress, message, preview } = data;

    if (!attachmentId) return;

    // Update the download progress for this file
    setFileDownloads(prev => ({
      ...prev,
      [attachmentId]: {
        ...prev[attachmentId],
        progress,
        message,
        preview
      }
    }));
  };

  const onFileDownloaded = (data: any) => {
    const { success, error, attachmentId, data: fileData, mimeType, fileName, preview } = data;

    if (!attachmentId) return;

    if (success) {
      // Update the file download with completed data
      setFileDownloads(prev => ({
        ...prev,
        [attachmentId]: {
          ...prev[attachmentId],
          progress: 100,
          message: 'Download complete',
          data: fileData,
          mimeType,
          fileName,
          preview
        }
      }));

      // Handle the downloaded file based on platform
      if (Platform.OS !== 'web') {
        // For mobile, save the file to the filesystem
        if (!preview) {
          saveFileToDevice(fileData, fileName, mimeType);
        }
      } else {

      }
    } else {
      // Update state with error
      setFileDownloads(prev => ({
        ...prev,
        [attachmentId]: {
          ...prev[attachmentId],
          progress: 0,
          message: error || 'Download failed',
          error: true
        }
      }));

      // Show error alert
      Alert.alert('Download Failed', error || 'Failed to download file');
    }
  };

  // Helper function to save file on mobile
  const saveFileToDevice = async (base64Data, fileName, mimeType) => {
    try {
      if (Platform.OS === 'android') {
        // First try using MediaLibrary for common media types
        if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            // Save to temporary cache first
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64
            });

            // Then save to media library
            await MediaLibrary.saveToLibraryAsync(fileUri);
            Alert.alert('Success', 'File saved to gallery');
            return;
          }
        }

        // For other file types or if gallery permission denied, use SAF
        try {
          // Get permission and directory uri
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

          if (permissions.granted) {
            // Save to cache first
            const cacheFileUri = `${FileSystem.cacheDirectory}${fileName}`;
            await FileSystem.writeAsStringAsync(cacheFileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64
            });

            // Save file to selected directory
            const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              mimeType
            );

            // Copy from cache to destination
            const fileContent = await FileSystem.readAsStringAsync(cacheFileUri, {
              encoding: FileSystem.EncodingType.Base64
            });

            await FileSystem.StorageAccessFramework.writeAsStringAsync(
              destinationUri,
              fileContent,
              { encoding: FileSystem.EncodingType.Base64 }
            );

            Alert.alert('Success', 'File saved successfully');
            return;
          }
        } catch (safError) {
          console.error('SAF error:', safError);
        }
      }

      // For iOS or as fallback, use sharing
      if (await Sharing.isAvailableAsync()) {
        // Save to temp location
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64
        });

        // Share the file
        await Sharing.shareAsync(fileUri);
      } else {
        // Last resort - just save to cache
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64
        });

        Alert.alert('File Saved', `File saved to app cache: ${fileName}`);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      Alert.alert('Error', 'Failed to save file');
    }
  };


  const value = {
    worklet,
    isInitialized,
    isLoading,
    isBackendReady,
    error,
    generateSeedPhrase,
    confirmSeedPhrase,
    checkExistingUser,
    rpcClient,
    updateRooms,
    updateMessages,
    onRoomCreated,
    setCallbacks,
    reinitializeBackend,
    onInviteGenerated,
    setInviteCallbacks,
    fileDownloads,
    downloadFile: async (roomId: string, attachment: any, preview = false) => {
      if (!rpcClient) return false;

      try {
        // Reset progress for this attachment
        setFileDownloads(prev => ({
          ...prev,
          [attachment.blobId]: {
            progress: 0,
            message: 'Preparing download...',
            preview
          }
        }));

        const request = rpcClient.request('downloadFile');
        await request.send(JSON.stringify({
          roomId,
          attachment,
          requestProgress: true,
          preview
        }));

        return true;
      } catch (err) {
        console.error('Error requesting file download:', err);
        return false;
      }
    }
  };

  return (
    <WorkletContext.Provider value={value as any}>
      {children}
    </WorkletContext.Provider>
  );
}

export default WorkletContext

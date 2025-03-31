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
import * as Sharing from "expo-sharing"
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStableBlobId, getUTIForMimeType } from '../utils/helpers';
// Use variables instead of state for callbacks
let updateRooms: ((rooms: Room[]) => void) | undefined = undefined;
let updateMessages: ((messages: Message[], replace: boolean) => void) | undefined = undefined;
let onRoomCreated: ((room: Room) => void) | undefined = undefined;
let onRoomJoined: ((room: Room) => void) | undefined = undefined;
let onInviteGenerated: ((roomId: string, inviteCode: string) => void) | undefined = undefined;




const CACHE_METADATA_KEY = '@roombase:fileCache';
const CACHE_MAX_SIZE = 200 * 1024 * 1024; // 200MB max cache size
const CACHE_FILE_DIR = `${FileSystem.cacheDirectory}roombase_files/`;





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
  fileDownloads: {
    [key: string]: {
      progress: number;
      message: string;
      preview: boolean;
      data?: string;
      mimeType?: string;
      fileName?: string;
    }
  };

  downloadFile: (roomId: string, attachment: any, preview?: boolean, attachmentKey?: string) => Promise<boolean>;
  cacheSize: number;
  clearCache: () => Promise<void>;
  getCacheInfo: () => { size: number, files: number };
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
  const [cacheMetadata, setCacheMetadata] = useState<{
    [key: string]: {
      fileName: string,
      filePath: string,
      size: number,
      timestamp: number,
      mimeType: string
    }
  }>({});
  const [cacheSize, setCacheSize] = useState(0);

  const initializeCache = useCallback(async () => {
    try {
      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(CACHE_FILE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_FILE_DIR, { intermediates: true });
      }

      // Load cache metadata from AsyncStorage
      const metadataString = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (metadataString) {
        const metadata = JSON.parse(metadataString);
        setCacheMetadata(metadata);

        // Calculate current cache size
        const totalSize = Object.values(metadata).reduce((sum, item) => sum + (item.size || 0), 0);
        setCacheSize(totalSize as any);

        console.log(`Cache initialized: ${Object.keys(metadata).length} files, ${(totalSize / (1024 * 1024)).toFixed(2)}MB`);
      }
    } catch (error) {
      console.error('Error initializing file cache:', error);
    }
  }, []);

  const saveCacheMetadata = useCallback(async (metadata: any) => {
    try {
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error saving cache metadata:', error);
    }
  }, []);

  const addToCache = useCallback(async (cacheKey, fileData, fileName, mimeType, fileSize) => {
    try {
      // Create a unique filename to prevent collisions
      const timestamp = Date.now();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9\._]/g, '_');
      const filePath = `${CACHE_FILE_DIR}${timestamp}_${safeFileName}`;

      // Save file to cache directory
      await FileSystem.writeAsStringAsync(filePath, fileData, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Get actual file size if not provided
      let actualSize = fileSize;
      if (!actualSize) {
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        actualSize = fileInfo.size || fileData.length * 0.75; // Approximation for base64
      }

      // Update cache metadata
      const newMetadata = {
        ...cacheMetadata,
        [cacheKey]: {
          fileName,
          filePath,
          size: actualSize,
          timestamp,
          mimeType
        }
      };

      setCacheMetadata(newMetadata);
      setCacheSize(prev => prev + actualSize);
      await saveCacheMetadata(newMetadata);

      // Check if we need to clean up cache
      if (cacheSize + actualSize > CACHE_MAX_SIZE) {
        cleanCache();
      }

      return filePath;
    } catch (error) {
      console.error('Error adding file to cache:', error);
      return null;
    }
  }, [cacheMetadata, cacheSize, saveCacheMetadata]);


  const getFromCache = useCallback(async (cacheKey) => {
    try {
      const cachedItem = cacheMetadata[cacheKey];
      if (!cachedItem) return null;

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(cachedItem.filePath);
      if (!fileInfo.exists) {
        // File was deleted, remove from metadata
        const newMetadata = { ...cacheMetadata };
        delete newMetadata[cacheKey];
        setCacheMetadata(newMetadata);
        setCacheSize(prev => prev - (cachedItem.size || 0));
        await saveCacheMetadata(newMetadata);
        return null;
      }

      // Read file from cache
      const fileData = await FileSystem.readAsStringAsync(cachedItem.filePath, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Update timestamp to mark as recently used
      const newMetadata = {
        ...cacheMetadata,
        [cacheKey]: {
          ...cachedItem,
          timestamp: Date.now()
        }
      };
      setCacheMetadata(newMetadata);
      await saveCacheMetadata(newMetadata);

      return {
        data: fileData,
        mimeType: cachedItem.mimeType,
        fileName: cachedItem.fileName,
        path: cachedItem.filePath
      };
    } catch (error) {
      console.error('Error retrieving file from cache:', error);
      return null;
    }
  }, [cacheMetadata, saveCacheMetadata]);

  const cleanCache = useCallback(async () => {
    try {
      // Get all cached items sorted by timestamp (oldest first)
      const items = Object.entries(cacheMetadata)
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => a.timestamp - b.timestamp);

      let newSize = cacheSize;
      const newMetadata = { ...cacheMetadata };

      // Remove oldest files until we're under the limit
      for (const item of items) {
        if (newSize <= CACHE_MAX_SIZE * 0.8) break; // Stop when we've freed up 20%

        try {
          // Delete the file
          await FileSystem.deleteAsync(item.filePath, { idempotent: true });

          // Update metadata
          delete newMetadata[item.key];
          newSize -= item.size || 0;

          console.log(`Removed ${item.fileName} from cache (${(item.size / (1024 * 1024)).toFixed(2)}MB)`);
        } catch (err) {
          console.error('Error removing file from cache:', err);
        }
      }

      setCacheMetadata(newMetadata);
      setCacheSize(newSize);
      await saveCacheMetadata(newMetadata);

      console.log(`Cache cleaned: ${(newSize / (1024 * 1024)).toFixed(2)}MB remaining`);
    } catch (error) {
      console.error('Error cleaning cache:', error);
    }
  }, [cacheMetadata, cacheSize, saveCacheMetadata]);

  const clearCache = useCallback(async () => {
    try {
      // Delete all files
      await FileSystem.deleteAsync(CACHE_FILE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_FILE_DIR, { intermediates: true });

      // Reset metadata
      setCacheMetadata({});
      setCacheSize(0);
      await AsyncStorage.removeItem(CACHE_METADATA_KEY);

      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, []);



  useEffect(() => {
    initializeCache();
  }, []);


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

                  console.log('Formatted message for UI:', formattedMessage, message);
                  updateMessages([formattedMessage], false);

                  // Auto-download previews for image attachments in new messages
                  if (message.hasAttachments && message.attachments) {
                    try {
                      let attachmentsArray = [];

                      // Parse attachments if needed
                      if (typeof message.attachments === 'string') {
                        attachmentsArray = JSON.parse(message.attachments);
                      } else if (Array.isArray(message.attachments)) {
                        attachmentsArray = message.attachments;
                      }
                      if (!Array.isArray(attachmentsArray)) {
                        attachmentsArray = JSON.parse(attachmentsArray)
                      }
                      // Process each attachment
                      if (Array.isArray(attachmentsArray)) {
                        for (const attachment of attachmentsArray) {
                          // Check if it's an image
                          if (attachment && attachment.name) {
                            const fileExt = attachment.name.split('.').pop().toLowerCase();
                            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);

                            if (isImage && attachment.blobId) {
                              console.log(`Auto-downloading preview for new image: ${attachment.name}`);
                              // Use a small timeout to avoid overwhelming the backend with requests
                              setTimeout(() => {
                                const blobId = createStableBlobId(attachment.blobId);
                                const attachmentKey = `${message.roomId}_${blobId}`;

                                // Download the preview
                                const downloadRequest = client.request('downloadFile');
                                downloadRequest.send(JSON.stringify({
                                  roomId: message.roomId,
                                  attachment,
                                  requestProgress: true,
                                  preview: true,
                                  attachmentKey
                                }));
                              }, 500); // Short delay to let the message appear first
                            }
                          }
                        }
                      }
                    } catch (parseError) {
                      console.error('Error processing attachments for auto-preview:', parseError);
                    }
                  }
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


  const onFileDownloadProgress = (data: any) => {
    const { attachmentId, progress, message, preview, attachmentKey } = data;

    // Use the attachmentKey if provided, otherwise fall back to just the attachmentId
    const downloadKey = attachmentKey || attachmentId;

    if (!downloadKey) return;

    // Update the download progress for this file
    setFileDownloads(prev => ({
      ...prev,
      [downloadKey]: {
        ...prev[downloadKey],
        progress,
        message,
        preview
      }
    }));
  };

  const onFileDownloaded = async (data: any) => {
    try {
      const { success, error, attachmentId, data: fileData, mimeType, fileName, preview, roomId, attachmentKey } = data;

      // Generate a unique key for this download
      const processedAttachmentId = createStableBlobId(attachmentId);
      const uniqueDownloadKey = attachmentKey ||
        (roomId && processedAttachmentId ?
          `${roomId}_${processedAttachmentId}` :
          `download_${Date.now()}`);

      if (!uniqueDownloadKey) {
        console.error('Missing attachment identifier in downloaded file data');
        return;
      }

      console.log(`File download complete for ${uniqueDownloadKey}, preview: ${preview}, size: ${fileData ? (fileData.length / 1024).toFixed(2) : 0}KB`);

      if (success && fileData) {
        // Cache the file (except tiny previews to save space)
        if (!preview || fileData.length > 10000) {
          try {
            console.log(`Caching file: ${fileName || 'unknown'}, size: ${(fileData.length / 1024).toFixed(2)}KB`);
            await addToCache(
              uniqueDownloadKey,
              fileData,
              fileName || 'unknown_file',
              mimeType || 'application/octet-stream',
              Math.ceil(fileData.length * 0.75) // Estimate size based on base64 length
            );
          } catch (cacheError) {
            console.error('Error caching downloaded file:', cacheError);
            // Continue anyway since caching is optional
          }
        }

        // Update the file download with completed data
        setFileDownloads(prev => {
          // Create a new state object to ensure React detects the change
          const newState = { ...prev };

          // Update the specific download entry
          newState[uniqueDownloadKey] = {
            ...prev[uniqueDownloadKey],
            progress: 100,
            message: 'Download complete',
            data: fileData,
            mimeType,
            fileName,
            preview,
            timestamp: Date.now() // Add timestamp to ensure updates are detected
          };

          return newState;
        });

        // Handle the downloaded file based on platform
        if (Platform.OS !== 'web' && !preview) {
          // For mobile, save the file to the filesystem
          await saveFileToDevice(fileData, fileName, mimeType);
        }
      } else {
        // Update state with error
        setFileDownloads(prev => ({
          ...prev,
          [uniqueDownloadKey]: {
            ...prev[uniqueDownloadKey],
            progress: 0,
            message: error || 'Download failed',
            error: true
          }
        }));

        // Show error alert
        Alert.alert('Download Failed', error || 'Failed to download file');
      }
    } catch (error) {
      console.error('Error processing downloaded file:', error);
    }
  };





  // Helper function to save file on mobile
  const saveFileToDevice = async (base64Data, fileName, mimeType) => {
    try {
      const isLargeFile = base64Data.length > 5 * 1024 * 1024; // 5MB threshold
      console.log(`Saving file ${fileName} (${(base64Data.length / (1024 * 1024)).toFixed(2)}MB)`);

      // Create a safe filename
      const safeFileName = fileName.replace(/[^a-zA-Z0-9\._]/g, '_');

      // Create a downloads directory if necessary
      const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
      const downloadsDirInfo = await FileSystem.getInfoAsync(downloadsDir);
      if (!downloadsDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
      }

      // Temporary file path in the app's cache
      const tempFilePath = `${FileSystem.cacheDirectory}${safeFileName}`;

      // For large files, write in chunks to avoid memory issues
      if (isLargeFile) {
        console.log(`Large file detected (${safeFileName}), writing in chunks`);

        // Create empty file
        await FileSystem.writeAsStringAsync(tempFilePath, "", { encoding: FileSystem.EncodingType.UTF8 });

        // Write in chunks of 1MB
        const chunkSize = 1024 * 1024; // 1MB
        const totalChunks = Math.ceil(base64Data.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, base64Data.length);
          const chunk = base64Data.substring(start, end);

          // Write chunk to file
          await FileSystem.writeAsStringAsync(
            tempFilePath,
            chunk,
            {
              encoding: FileSystem.EncodingType.Base64,
              append: i > 0 // Append for all chunks after the first
            }
          );

          console.log(`Wrote chunk ${i + 1}/${totalChunks}`);
        }

        console.log(`Finished writing file in ${totalChunks} chunks`);
      } else {
        // For smaller files, write in one go
        await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
          encoding: FileSystem.EncodingType.Base64
        });
      }

      // Now use platform-specific approaches to save/share the file
      if (Platform.OS === 'android') {
        // Check file exists and get size
        const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
        if (!fileInfo.exists) {
          throw new Error('File not written correctly');
        }
        console.log(`File written to temp: ${fileInfo.size} bytes`);

        // For media files, try MediaLibrary first
        if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              // Save to media library
              const asset = await MediaLibrary.createAssetAsync(tempFilePath);
              await MediaLibrary.createAlbumAsync('Roombase', asset, false);
              Alert.alert('Success', 'Media saved to gallery');
              return;
            }
          } catch (mediaError) {
            console.error('Error saving to media library:', mediaError);
            // Continue to other methods if this fails
          }
        }

        // For other file types or if media library failed, use SAF
        try {
          // Get permission to a directory
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

          if (permissions.granted) {
            // Get a safe destination file name (handle duplicate file names)
            const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              safeFileName,
              mimeType
            );

            // For large files, read and write in chunks
            if (isLargeFile) {
              const fileUri = tempFilePath;
              const fileSize = (await FileSystem.getInfoAsync(fileUri)).size || 0;
              const chunkSize = 2 * 1024 * 1024; // 2MB chunks for reading
              const totalChunks = Math.ceil(fileSize / chunkSize);

              for (let i = 0; i < totalChunks; i++) {
                const options: any = {
                  encoding: FileSystem.EncodingType.Base64,
                  position: i * chunkSize,
                  length: Math.min(chunkSize, fileSize - (i * chunkSize))
                };

                // Read chunk from the temp file
                const chunk = await FileSystem.readAsStringAsync(fileUri, options);

                // Write chunk to the destination
                await FileSystem.StorageAccessFramework.writeAsStringAsync(
                  destinationUri,
                  chunk,
                  {
                    encoding: FileSystem.EncodingType.Base64,
                    append: i > 0 // Append for all chunks after the first
                  }
                );

                console.log(`Wrote SAF chunk ${i + 1}/${totalChunks}`);
              }
            } else {
              // For smaller files, read and write in one go
              const fileContent = await FileSystem.readAsStringAsync(tempFilePath, {
                encoding: FileSystem.EncodingType.Base64
              });

              await FileSystem.StorageAccessFramework.writeAsStringAsync(
                destinationUri,
                fileContent,
                { encoding: FileSystem.EncodingType.Base64 }
              );
            }

            Alert.alert('Success', 'File saved successfully');
            return;
          }
        } catch (safError) {
          console.error('SAF error:', safError);
          // Continue to next methods if this fails
        }

        // Last resort - save to downloads folder and notify user
        try {
          const finalPath = `${downloadsDir}${safeFileName}`;
          await FileSystem.moveAsync({
            from: tempFilePath,
            to: finalPath
          });

          Alert.alert(
            'File Saved',
            `File saved to app's storage: ${finalPath}\n\nYou can access it from File Manager > Internal Storage > Android > data > [app] > files > downloads`,
            [{ text: 'OK' }]
          );
          return;
        } catch (moveError) {
          console.error('Error moving file to downloads:', moveError);
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, use sharing
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tempFilePath, {
            mimeType,
            dialogTitle: `Share ${fileName}`,
            UTI: getUTIForMimeType(mimeType)
          });
        } else {
          // If sharing is unavailable, save to app's documents directory
          const finalPath = `${downloadsDir}${safeFileName}`;
          await FileSystem.moveAsync({
            from: tempFilePath,
            to: finalPath
          });

          Alert.alert('File Saved', `File saved to app documents: ${finalPath}`);
        }
      }
    } catch (error) {
      console.error('Error saving file to device:', error);
      Alert.alert(
        'Error Saving File',
        `There was a problem saving the file: ${error.message}`
      );
    }
  };



  const downloadFile = async (roomId: string, attachment: any, preview = false, attachmentKey?: string) => {
    if (!rpcClient) return false;

    try {
      // Generate a unique key for this download if not provided
      const blobId = createStableBlobId(attachment.blobId);
      const downloadKey = attachmentKey || `${roomId}_${blobId}`;

      // For previews or regular downloads, check cache first
      if (preview || !attachment.skipCache) {
        const cachedFile = await getFromCache(downloadKey);
        if (cachedFile) {
          console.log(`Loading ${attachment.name} from cache`);

          // Update the download progress immediately to 100%
          setFileDownloads(prev => ({
            ...prev,
            [downloadKey]: {
              progress: 100,
              message: 'Loaded from cache',
              preview,
              data: cachedFile.data,
              mimeType: cachedFile.mimeType,
              fileName: cachedFile.fileName,
              timestamp: Date.now(),
              fromCache: true
            }
          }));

          return true;
        }
      }

      // Reset progress for this attachment using the unique key
      setFileDownloads(prev => ({
        ...prev,
        [downloadKey]: {
          progress: 0,
          message: 'Preparing download...',
          preview
        }
      }));

      // Include the attachmentKey in the request
      const request = rpcClient.request('downloadFile');
      await request.send(JSON.stringify({
        roomId,
        attachment,
        requestProgress: true,
        preview,
        attachmentKey: downloadKey
      }));

      return true;
    } catch (err) {
      console.error('Error requesting file download:', err);
      return false;
    }
  }





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
    downloadFile,
    cacheSize,
    clearCache,
    getCacheInfo: () => ({
      size: cacheSize,
      files: Object.keys(cacheMetadata).length
    }),
  };

  return (
    <WorkletContext.Provider value={value as any}>
      {children}
    </WorkletContext.Provider>
  );
}

export default WorkletContext

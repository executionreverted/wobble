import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Worklet } from 'react-native-bare-kit';
import * as FileSystem from "expo-file-system"
import { Alert, Platform } from 'react-native';
import RPC from 'bare-rpc';
// @ts-ignore
import bundle from '../app.bundle';
import b4a from "b4a"
import useUser from '../hooks/useUser';
import { FileAttachment, Room, Message } from '../types';
import resetRegistry from './resetSystem';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStableBlobId, getUTIForMimeType } from '../utils/helpers';
import fileCacheManager, { FileCacheManager } from '../utils/FileCacheManager';

const DOWNLOAD_TIMEOUT_MS = 45000; // 45 seconds timeout
// Use variables instead of state for callbacks
let updateRooms: ((rooms: Room[]) => void) | undefined = undefined;
let updateMessages: ((messages: Message[], replace: boolean) => void) | undefined = undefined;
let onRoomCreated: ((room: Room) => void) | undefined = undefined;
let onRoomJoined: ((room: Room) => void) | undefined = undefined;
let onInviteGenerated: ((roomId: string, inviteCode: string) => void) | undefined = undefined;
let onRoomFiles: ((room: any) => void) | undefined = undefined;
interface FileDownloadState {
  progress: number;
  message: string;
  preview?: boolean;
  data?: string;
  mimeType?: string;
  fileName?: string;
  path?: string;
  error?: boolean;
  timestamp?: number;
}

interface FileProgressData {
  attachmentId?: string;
  progress: number;
  message?: string;
  preview?: boolean;
  attachmentKey?: string;
  roomId?: string;
}



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
  activeDownloadsRef: any,
  saveFileToDevice: any;
  downloadFile: (roomId: string, attachment: any, preview?: boolean, attachmentKey?: string) => Promise<boolean>;
  cancelDownload: any
  cacheSize: number;
  clearCache: () => Promise<void>;
  getCacheInfo: () => { size: number, files: number };
  isCacheInitialized: boolean;
  cacheInitPromise: Promise<void>;
  getRoomFiles: (roomId: string, options?: {
    limit?: number,
    before?: number
  }) => Promise<{
    files: FileAttachment[],
    hasMore: boolean
  }>;
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
  const [isCacheInitialized, setIsCacheInitialized] = useState(false);
  const cacheInitPromise = useRef<Promise<void> | null>(null);
  const activeDownloadsRef = useRef<Set<string>>(new Set());

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
      console.log('Initialize CacheStorage')
      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(CACHE_FILE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_FILE_DIR, { intermediates: true });
      }

      // Load cache metadata from AsyncStorage
      const metadataString = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (metadataString) {
        const metadata = JSON.parse(metadataString);
        console.log('Found cache: ', metadataString)
        setCacheMetadata(metadata);

        // Calculate current cache size
        const totalSize = Object.values(metadata).reduce((sum, item) => sum + (item.size || 0), 0);
        setCacheSize(totalSize as any);

        console.log(`Cache initialized: ${Object.keys(metadata).length} files, ${(totalSize / (1024 * 1024)).toFixed(2)}MB`);
      }

      // Set initialization flag
      setIsCacheInitialized(true);
      return true
    } catch (error) {
      console.error('Error initializing file cache:', error);
      // Even on error, mark as initialized to prevent hanging
      setIsCacheInitialized(true);
    }
  }, []);

  // Then update the useEffect
  useEffect(() => {
    // Create a promise that resolves when cache is initialized
    cacheInitPromise.current = initializeCache() as any;
  }, []);

  const saveCacheMetadata = useCallback(async (metadata: any) => {
    try {
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error saving cache metadata:', error);
    }
  }, []);


  const reconcileCacheMetadata = useCallback(async () => {
    try {
      const metadataString = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (metadataString) {
        const metadata = JSON.parse(metadataString);

        // Validate and clean up metadata
        const validMetadata = {};
        let totalValidSize = 0;

        for (const [key, value] of Object.entries(metadata)) {
          // Comprehensive null/undefined checks
          if (!value || !value.filePath) {
            console.log(`Removing invalid cache entry: ${key} - missing file path`);
            continue;
          }

          try {
            // Additional null check and trim
            const cleanFilePath = (value.filePath || '').trim();
            if (!cleanFilePath) {
              console.log(`Skipping entry with empty file path: ${key}`);
              continue;
            }

            // Ensure file path is a valid string
            const fileInfo = await FileSystem.getInfoAsync(cleanFilePath);

            if (fileInfo.exists && fileInfo.size > 0) {
              validMetadata[key] = {
                ...value,
                filePath: cleanFilePath, // Ensure clean path
                size: fileInfo.size
              };
              totalValidSize += fileInfo.size;
            } else {
              console.log(`Removing non-existent or empty file: ${cleanFilePath}`);
            }
          } catch (fileCheckError) {
            console.error(`Error checking file for ${key}:`, {
              filePath: value.filePath,
              error: fileCheckError
            });
            // Optionally log the full error details
            console.log('Full error details:', JSON.stringify(fileCheckError, null, 2));
          }
        }

        // Only update if we have valid metadata
        if (Object.keys(validMetadata).length > 0) {
          setCacheMetadata(validMetadata);
          setCacheSize(totalValidSize);

          await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(validMetadata));

          console.log('Cache reconciliation complete', {
            totalValidEntries: Object.keys(validMetadata).length,
            totalSize: totalValidSize
          });
        } else {
          // If no valid entries, completely clear the cache
          await AsyncStorage.removeItem(CACHE_METADATA_KEY);
          setCacheMetadata({});
          setCacheSize(0);

          console.log('No valid cache entries found. Cache cleared.');
        }
      }
    } catch (error) {
      console.error('Comprehensive error in reconcileCacheMetadata:', {
        errorMessage: error.message,
        errorStack: error.stack
      });

      // Fallback: completely reset cache if reconciliation fails
      try {
        await AsyncStorage.removeItem(CACHE_METADATA_KEY);
        setCacheMetadata({});
        setCacheSize(0);

        console.log('Cache reset due to reconciliation failure');
      } catch (resetError) {
        console.error('Error during cache reset:', resetError);
      }
    }
  }, []);

  // Call this method occasionally or on app startup
  useEffect(() => {
    reconcileCacheMetadata();
  }, []);



  const cancelDownload = useCallback(async (roomId: string, attachmentId: string, attachmentKey?: string) => {
    if (!rpcClient) return false;

    try {
      // Determine the key for tracking this download
      const downloadKey = attachmentKey ||
        (roomId && attachmentId ? FileCacheManager.createCacheKey(roomId, attachmentId) : null);

      if (!downloadKey) {
        console.error('Cannot cancel download: missing key information');
        return false;
      }

      // If it's in the active downloads list, send a cancellation request to the backend
      if (activeDownloadsRef.current.has(downloadKey)) {
        console.log(`Cancelling download for ${downloadKey}`);

        // Send cancellation request to backend
        const request = rpcClient.request('cancelDownload');
        await request.send(JSON.stringify({
          roomId,
          attachmentId,
          attachmentKey: downloadKey
        }));

        // Remove from active downloads list immediately
        activeDownloadsRef.current.delete(downloadKey);

        // Update UI state to reflect cancellation
        setFileDownloads(prev => ({
          ...prev,
          [downloadKey]: {
            ...prev[downloadKey],
            progress: 0,
            message: 'Download cancelled',
            error: true,
            cancelled: true
          }
        }));

        return true;
      } else {
        console.log(`Download ${downloadKey} not active, nothing to cancel`);
        return false;
      }
    } catch (err) {
      console.error('Error cancelling download:', err);
      return false;
    }
  }, [rpcClient]);

  const getRoomFiles = useCallback(async (roomId: string, options: any = {}) => {
    if (!rpcClient) throw new Error('RPC client not initialized');

    const { limit = 50, before } = options;

    return new Promise((resolve, reject) => {
      try {
        const request = rpcClient.request('getRoomFiles');
        request.send(JSON.stringify({ roomId, limit, before }));

        // Set up a temporary callback
        setCallbacks({
          onRoomFiles: (data) => {
            if (data.success) {
              resolve({
                files: data.files,
                hasMore: data.hasMore
              });
            } else {
              reject(new Error(data.error));
            }
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }, [rpcClient]);

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
                console.log('Room join result received:', parsedData);

                if (parsedData.success && parsedData.room) {
                  // If the room was successfully joined, call the appropriate callback
                  if (onRoomJoined) {
                    console.log('Calling onRoomJoined callback with room data');
                    onRoomJoined(parsedData.room);
                  } else {
                    console.log('No onRoomJoined callback registered, will send user update');

                    // Request updated user data to make sure rooms are updated
                    try {
                      const userCheckRequest = client.request('checkUserExists');
                      userCheckRequest.send("");

                      // Also refresh room list
                      const roomsRequest = client.request('getRooms');
                      roomsRequest.send("");
                    } catch (requestError) {
                      console.error('Error requesting updated data after room join:', requestError);
                    }
                  }

                  // Also request rooms list to ensure UI is updated
                  try {
                    const roomsRequest = client.request('getRooms');
                    roomsRequest.send("");
                  } catch (roomsError) {
                    console.error('Error requesting rooms list after join:', roomsError);
                  }
                } else if (!parsedData.success) {
                  // Handle join failure - send an error notification
                  console.error('Room join failed:', parsedData.error || 'Unknown error');

                  // Create a custom notification to show the error
                  const errorNotification = {
                    id: `join-error-${Date.now()}`,
                    content: `Failed to join room: ${parsedData.error || 'Unknown error'}`,
                    timestamp: Date.now(),
                    system: true
                  };

                  // Send this as a system message to the user through the notification channel
                  const notificationReq = rpcClient.request('systemNotification');
                  notificationReq.send(JSON.stringify(errorNotification));
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

                            // if (isImage && attachment.blobId) {
                            //   console.log(`Auto-downloading preview for new image: ${attachment.name}`);
                            //   // Use a small timeout to avoid overwhelming the backend with requests
                            //   setTimeout(() => {
                            //     // const blobId = createStableBlobId(attachment.blobId);
                            //     // const attachmentKey = `${message.roomId}_${blobId}`;
                            //     //
                            //     // Download the preview
                            //     // const downloadRequest = client.request('downloadFile');
                            //     // downloadRequest.send(JSON.stringify({
                            //     //   roomId: message.roomId,
                            //     //   attachment,
                            //     //   requestProgress: true,
                            //     //   preview: true,
                            //     //   attachmentKey
                            //     // }));
                            //   }, 500); // Short delay to let the message appear first
                            // }
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
    onInviteGenerated?: (roomId: string, inviteCode: string) => void,
    onRoomFiles?: (roomId: string) => void
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

    if (callbacks.onRoomFiles) {
      onRoomFiles = callbacks.onRoomFiles;
      console.log('onRoomFiles callback set successfully');
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

  const updateFileDownload = useCallback((key: string, update: Partial<FileDownloadState>) => {
    setFileDownloads(prev => {
      // Only update if there's a meaningful change
      const currentState = prev[key] || {};
      const newState = { ...currentState, ...update };

      const hasChanged = Object.keys(update).some(
        k => currentState[k] !== newState[k]
      );

      return hasChanged
        ? { ...prev, [key]: newState }
        : prev;
    });
  }, []);

  const onFileDownloaded = useCallback(async (data: any) => {
    const {
      success,
      error,
      attachmentId,
      filePath,
      publicFilePath, // Add support for the public path
      mimeType,
      fileName,
      preview,
      roomId,
      attachmentKey,
      fileSize
    } = data;

    const downloadKey = FileCacheManager.createCacheKey(roomId, attachmentId);

    if (!downloadKey) {
      console.error('Missing attachment identifier');
      return;
    }
    if (activeDownloadsRef.current.has(downloadKey)) {
      activeDownloadsRef.current.delete(downloadKey);
      console.log(`Removed ${downloadKey} from active downloads, remaining: ${activeDownloadsRef.current.size}`);
    }

    if (success && (filePath || publicFilePath)) {
      try {
        // Update file download state with the path information
        updateFileDownload(downloadKey, {
          progress: 100,
          message: 'Download complete',
          path: Platform.OS === 'android' && publicFilePath ? publicFilePath : filePath,
          mimeType,
          fileName,
          preview,
          timestamp: Date.now(),
          fileSize
        });

        // Register file with cache manager with enhanced Android support
        await fileCacheManager.registerDownloadedFile({
          attachmentKey: downloadKey,
          filePath,
          publicFilePath,
          fileName,
          mimeType,
          fileSize,
          preview
        });

      } catch (storeError) {
        console.error('Error registering downloaded file:', storeError);
        updateFileDownload(downloadKey, {
          progress: 0,
          message: 'Error registering file',
          error: true
        });
      }
    } else {
      updateFileDownload(downloadKey, {
        progress: 0,
        message: error || 'Download failed',
        error: true
      });
    }
  }, [updateFileDownload]);




  const onFileDownloadProgress = useCallback((data: FileProgressData) => {
    const {
      attachmentId,
      progress,
      message,
      preview,
      attachmentKey,
      roomId
    } = data;

    // Create a cache key if attachmentKey is not provided
    const downloadKey = (roomId && attachmentId ? FileCacheManager.createCacheKey(roomId, attachmentId) : undefined);

    if (!downloadKey) {
      console.warn('No download key available for progress update');
      return;
    }

    // Ensure progress is a valid number between 0 and 100
    const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));

    // Update the file download state
    updateFileDownload(downloadKey, {
      progress: safeProgress,
      message: message || 'Downloading...',
      preview: preview || false
    });

    if (safeProgress >= 100 || (message && message.toLowerCase().includes('error'))) {
      if (activeDownloadsRef.current.has(downloadKey)) {
        activeDownloadsRef.current.delete(downloadKey);
        console.log(`Removed ${downloadKey} from active downloads on progress complete, remaining: ${activeDownloadsRef.current.size}`);
      }
    }
  }, [updateFileDownload]);



  const saveFileToDevice = async (downloadKey: string): Promise<boolean> => {
    const downloadData = fileDownloads[downloadKey];

    if (!downloadData) {
      console.error('Missing download data for saving to device');
      return false;
    }

    try {
      // If we have a path, validate it thoroughly before proceeding
      if (downloadData.path) {
        console.log(`Using file path: ${downloadData.path}`);

        // Check file validity with multiple path formats
        let validPath = downloadData.path;
        let isValid = false;

        const pathsToCheck = [
          downloadData.path,
          downloadData.path.startsWith('file://') ?
            downloadData.path : `file://${downloadData.path}`,
          // For Android, try without file:// if it has it
          downloadData.path.startsWith('file://') ?
            downloadData.path.substring(7) : downloadData.path
        ];

        for (const testPath of pathsToCheck) {
          try {
            const info = await FileSystem.getInfoAsync(testPath);
            if (info.exists && info.size > 0) {
              validPath = testPath;
              isValid = true;
              console.log(`Validated file at ${validPath} with size ${info.size}`);
              break;
            } else {
              console.log(`Path exists but invalid: ${testPath}`);
            }
          } catch (e) {
            console.log(`Path check failed for ${testPath}:`, e.message);
          }
        }

        if (!isValid) {
          console.error('File is invalid or cannot be accessed');

          // Try to get from cache as fallback
          const cacheData = await fileCacheManager.getFile(downloadKey);
          if (cacheData && cacheData.path) {
            return await fileCacheManager.saveToDevice(
              cacheData.path,
              downloadData.fileName || 'download.file',
              downloadData.mimeType || 'application/octet-stream'
            );
          }

          return false;
        }

        // Handle videos, images, and audio files differently on Android
        const isVideo = (downloadData.fileName || '').match(/\.(mp4|mov|avi|mkv|webm)$/i);
        const isImage = FileCacheManager.isImageFile(downloadData.fileName || '');
        const isAudio = (downloadData.fileName || '').match(/\.(mp3|wav|ogg|m4a)$/i);

        if (Platform.OS === 'android' && (isVideo || isImage || isAudio)) {
          try {
            // Get MediaLibrary permission
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              // Ensure the path is in the correct format for MediaLibrary
              const assetPath = validPath.startsWith('file://') ? validPath : `file://${validPath}`;

              console.log(`Creating media library asset at: ${assetPath}`);
              const asset = await MediaLibrary.createAssetAsync(assetPath);

              if (!asset) {
                throw new Error('Failed to create asset');
              }

              // Save to appropriate album
              let album = await MediaLibrary.getAlbumAsync('Roombase');
              if (!album) {
                album = await MediaLibrary.createAlbumAsync('Roombase', asset, false);
              } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              }

              // Show success message
              const mediaType = isVideo ? 'video' : isImage ? 'image' : 'audio';
              Alert.alert(
                "File Saved",
                `${downloadData.fileName} has been saved to your Media Library in the Roombase album. You can access it from your Gallery app.`
              );
              return true;
            }
          } catch (mediaError) {
            console.error('Media library error:', mediaError);
            // Fall through to other methods
          }
        }

        // For all other files or if media library fails, use generic save
        return await fileCacheManager.saveToDevice(
          validPath,
          downloadData.fileName || 'download.file',
          downloadData.mimeType || 'application/octet-stream'
        );
      } else if (downloadData.data) {
        // If we have data in memory
        console.log(`Using in-memory data for file: ${downloadData.fileName}`);
        const { path } = await fileCacheManager.storeFile(
          downloadKey,
          downloadData.data,
          downloadData.fileName || 'download.file',
          downloadData.mimeType || 'application/octet-stream',
          false
        );

        return await fileCacheManager.saveToDevice(
          path,
          downloadData.fileName || 'download.file',
          downloadData.mimeType || 'application/octet-stream'
        );
      } else {
        // Neither path nor data available - try to load from cache
        console.log('Attempting to load file data from cache');
        const cacheData = await fileCacheManager.getFile(downloadKey);

        if (cacheData && cacheData.path) {
          return await fileCacheManager.saveToDevice(
            cacheData.path,
            cacheData.fileName || 'download.file',
            cacheData.mimeType || 'application/octet-stream'
          );
        }

        console.error('Could not find file data in memory or cache');
        return false;
      }
    } catch (error) {
      console.error('Error saving file to device:', error);
      return false;
    }
  };






  // Modify the clearCache function 
  const clearCache = useCallback(async () => {
    await fileCacheManager.clearCache();
  }, []);

  // Replace the getCacheInfo function
  const getCacheInfo = useCallback(() => {
    return fileCacheManager.getCacheInfo();
  }, []);


  // Updated downloadFile method for WorkletContext

  const downloadFile = async (roomId: string, attachment: any, preview = false, attachmentKey?: string): Promise<boolean> => {
    if (!rpcClient) return false;

    try {
      // Generate a unique key for this download if not provided
      const downloadKey = attachmentKey || FileCacheManager.createCacheKey(roomId, attachment.blobId);
      if (activeDownloadsRef.current.has(downloadKey)) {
        console.log(`Download already in progress for ${attachment.name}`);
        return true;
      }
      // Check existing status in fileDownloads state
      const existingStatus = fileDownloads[downloadKey];
      if (existingStatus && existingStatus.progress >= 100) {
        console.log(`File ${attachment.name} already in state as downloaded`);
        return true;
      }

      // Check if in cache but not in state
      let loadFromCache = false;

      try {
        const exists = await fileCacheManager.fileExists(downloadKey);
        if (exists) {
          loadFromCache = true;
          console.log(`File ${attachment.name} found in cache, updating state`);

          // Get metadata
          const metadata = await fileCacheManager.getMetadata(downloadKey);
          if (metadata) {
            // Update fileDownloads state with cache metadata WITHOUT loading the content
            setFileDownloads(prev => ({
              ...prev,
              [downloadKey]: {
                progress: 100, // Mark as complete
                message: 'Available from cache',
                preview: metadata.isPreview,
                fileName: metadata.fileName,
                mimeType: metadata.mimeType,
                path: metadata.filePath,
                // Don't include the data until needed - saves memory
                fromCache: true
              }
            }));

            return true;
          }
        }
      } catch (cacheError) {
        console.error('Error checking cache:', cacheError);
        // Continue with normal download if cache check fails
      }

      // If not in cache, start a new download
      if (!loadFromCache) {

        activeDownloadsRef.current.add(downloadKey);
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
      }

      return true;
    } catch (err) {
      console.error('Error requesting file download:', err);
      if (attachmentKey) {
        activeDownloadsRef.current.delete(attachmentKey);
      }
      return false;
    }
  };


  const value = useMemo(() => (
    {
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
      cancelDownload,
      cacheSize,
      clearCache,
      getCacheInfo,
      isCacheInitialized,
      cacheInitPromise: cacheInitPromise.current,
      saveFileToDevice,
      getRoomFiles
    }
  ), [
    worklet,
    rpcClient,
    isInitialized,
    isLoading,
    isBackendReady,
    error,
    fileDownloads,
    updateFileDownload,
    cancelDownload
  ])

  return (
    <WorkletContext.Provider value={value as any}>
      {children}
    </WorkletContext.Provider>
  );
}

export default WorkletContext

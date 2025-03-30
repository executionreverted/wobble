import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Worklet } from 'react-native-bare-kit';
import { Platform } from 'react-native';
import RPC from 'bare-rpc';
// @ts-ignore
import bundle from '../app.bundle';
import b4a from "b4a"
import useUser from '../hooks/useUser';
import { Room, Message } from '../types';

// Use variables instead of state for callbacks
let updateRooms: ((rooms: Room[]) => void) | undefined = undefined;
let updateMessages: ((messages: Message[], replace: boolean) => void) | undefined = undefined;
let onRoomCreated: ((room: Room) => void) | undefined = undefined;
let onRoomJoined: ((room: Room) => void) | undefined = undefined;

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
                console.log('Seed generated:', parsedData);
                storeSeedPhrase(parsedData);
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

            // Handle room-related RPC responses
            if (req.command === 'roomsList') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Rooms list received:', parsedData);

                if (updateRooms && Array.isArray(parsedData.rooms)) {
                  updateRooms(parsedData.rooms);
                } else {
                  console.log('Cannot update rooms: updateRooms callback missing or invalid data');
                }
              } catch (e) {
                console.error('Error handling roomsList:', e);
              }
            }

            if (req.command === 'roomCreated') {
              try {
                const data = b4a.toString(req.data);
                const parsedData = JSON.parse(data);
                console.log('Room created:', parsedData);

                if (parsedData.success && parsedData.room) {
                  // Instead of calling a separate handler, request updated user info
                  const userCheckRequest = client.request('checkUserExists');
                  userCheckRequest.send("");
                }
              } catch (e) {
                console.error('Error handling roomCreated:', e);
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
      console.error('NO RPC');
      return [];
    }
    try {
      const request = rpcClient.request('generateSeed');
      await request.send();
    } catch (err) {
      console.error('Failed to generate seed phrase:', err);
      throw err instanceof Error ? err : new Error('Failed to generate seed phrase');
    }
  }, [rpcClient]);

  const confirmSeedPhrase = useCallback(async (seedPhrase: string[]): Promise<{ success: boolean, userId?: string, error?: string }> => {
    if (!rpcClient) {
      console.error('NO RPC');
      return { success: false, error: 'RPC client not initialized' };
    }

    try {
      const request = rpcClient.request('confirmSeed');
      await request.send(JSON.stringify(seedPhrase));
      return { success: true, error: "" }
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
    onRoomJoined?: (room: Room) => void
  }) => {
    console.log('Setting callbacks in WorkletContext:', callbacks);

    // Store references directly
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
    reinitializeBackend
  };

  return (
    <WorkletContext.Provider value={value as any}>
      {children}
    </WorkletContext.Provider>
  );
}

export default WorkletContext

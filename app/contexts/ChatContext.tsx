import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { Room, Message, User, ChatContextType } from '../types';
import useUser from '../hooks/useUser';
import useWorklet from '../hooks/useWorklet';

interface MessagesByRoom {
  [roomId: string]: Message[];
}

// Default context values
const defaultChatContext: ChatContextType = {
  rooms: [],
  currentRoom: null,
  messages: [],
  onlineUsers: [],
  selectRoom: async () => { },
  leaveRoom: () => { },
  sendMessage: async () => { },
  refreshRooms: async () => { },
  createRoom: async () => { return { success: false, roomId: '' } },
  loadMoreMessages: async () => false
};

export const ChatContext = createContext<ChatContextType>(defaultChatContext);

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useUser();
  const { rpcClient, isInitialized, setCallbacks } = useWorklet();

  // State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<{ [roomId: string]: Message[] }>({});
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [hasMoreMessagesByRoom, setHasMoreMessagesByRoom] = useState<{ [roomId: string]: boolean }>({});
  const [isLoadingByRoom, setIsLoadingByRoom] = useState<{ [roomId: string]: boolean }>({});

  // Keep track of which rooms have been initialized
  const initializedRooms = useRef<Set<string>>(new Set());

  // Get current room's messages
  const getCurrentMessages = useCallback(() => {
    return currentRoom ? (messagesByRoom[currentRoom.id] || []) : [];
  }, [currentRoom, messagesByRoom]);

  // Initialize callbacks for real-time updates
  useEffect(() => {
    if (isInitialized && rpcClient) {
      console.log('ChatContext: Registering callbacks with WorkletContext');

      // Define the callback functions
      const updateRoomsCallback = (updatedRooms: Room[]) => {
        console.log('ChatContext: Received rooms update', updatedRooms.length);
        setRooms(updatedRooms);

        // Pre-initialize message containers for each room
        updatedRooms.forEach(room => {
          setMessagesByRoom(prev => {
            if (!prev[room.id]) {
              return {
                ...prev,
                [room.id]: []
              };
            }
            return prev;
          });

          // Set default values for each room
          setHasMoreMessagesByRoom(prev => ({
            ...prev,
            [room.id]: true
          }));

          setIsLoadingByRoom(prev => ({
            ...prev,
            [room.id]: false
          }));
        });

        // Request messages for all rooms to preload
        updatedRooms.forEach(room => {
          if (!initializedRooms.current.has(room.id)) {
            // Only initialize rooms we haven't initialized yet
            initializedRooms.current.add(room.id);

            // Request messages in background
            if (rpcClient) {
              try {
                const request = rpcClient.request('joinRoom');
                request.send(JSON.stringify({ roomId: room.id }));
              } catch (error) {
                console.error(`Error pre-initializing room ${room.id}:`, error);
              }
            }
          }
        });
      };

      const updateMessagesCallback = (newMessages: Message[], replace = false) => {
        console.log('ChatContext: Received messages update', newMessages.length, 'replace:', replace);

        if (!newMessages || newMessages.length === 0) return;

        // Get roomId from the first message
        const roomId = newMessages[0]?.roomId;

        if (!roomId) {
          console.error('Cannot determine roomId for messages');
          return;
        }

        setMessagesByRoom(prevByRoom => {
          const existingMessages = prevByRoom[roomId] || [];

          let updatedMessages: Message[];
          if (replace) {
            // Replace entire message list for this room
            updatedMessages = [...newMessages].sort((a, b) => b.timestamp - a.timestamp);
            console.log(`Replacing with ${updatedMessages.length} messages for room ${roomId}`);
          } else {
            // Merge existing and new messages without duplicates
            const messageMap = new Map();

            // Add existing messages to map
            existingMessages.forEach(msg => messageMap.set(msg.id, msg));

            // Add new messages to map
            newMessages.forEach(msg => messageMap.set(msg.id, msg));

            // Convert back to array and sort
            updatedMessages = Array.from(messageMap.values())
              .sort((a, b) => b.timestamp - a.timestamp);
            console.log(`Updated messages count: ${updatedMessages.length} for room ${roomId}`);
          }

          // Update loading status for this room
          setIsLoadingByRoom(prev => ({
            ...prev,
            [roomId]: false
          }));

          // Update hasMore flag for this room
          if (newMessages.length < 20 && !replace) {
            setHasMoreMessagesByRoom(prev => ({
              ...prev,
              [roomId]: false
            }));
          }

          // Return updated messagesByRoom
          return {
            ...prevByRoom,
            [roomId]: updatedMessages
          };
        });
      };

      const roomCreatedCallback = (room: Room) => {
        console.log('ChatContext: Room created callback', room.id);
        setRooms(prev => {
          // Check if the room already exists
          const exists = prev.some(r => r.id === room.id);
          if (exists) {
            // Update existing room
            return prev.map(r => r.id === room.id ? room : r);
          } else {
            // Add new room
            return [...prev, room];
          }
        });

        // Initialize the room's message containers
        setMessagesByRoom(prev => ({
          ...prev,
          [room.id]: []
        }));

        setHasMoreMessagesByRoom(prev => ({
          ...prev,
          [room.id]: true
        }));

        setIsLoadingByRoom(prev => ({
          ...prev,
          [room.id]: false
        }));

        initializedRooms.current.add(room.id);
      };

      // Register the callbacks with WorkletContext
      setCallbacks({
        updateRooms: updateRoomsCallback,
        updateMessages: updateMessagesCallback,
        onRoomCreated: roomCreatedCallback
      });

      // Fetch rooms when the component mounts or worklet is initialized
      refreshRooms();
    }
  }, [isInitialized, rpcClient]);

  // Update rooms when user data changes
  useEffect(() => {
    if (user && user.rooms) {
      setRooms(user.rooms);

      // Initialize message containers for user's rooms
      user.rooms.forEach(room => {
        setMessagesByRoom(prev => {
          if (!prev[room.id]) {
            return {
              ...prev,
              [room.id]: []
            };
          }
          return prev;
        });

        setHasMoreMessagesByRoom(prev => ({
          ...prev,
          [room.id]: true
        }));

        setIsLoadingByRoom(prev => ({
          ...prev,
          [room.id]: false
        }));
      });
    }
  }, [user]);

  // Refresh rooms list from backend
  const refreshRooms = async () => {
    if (!rpcClient || !isInitialized) return;

    try {
      const request = rpcClient.request('getRooms');
      await request.send();
      // The response will be handled by the RPC event handler in WorkletContext
    } catch (error) {
      console.error('Error refreshing rooms:', error);
    }
  };

  // Create a new room
  const createRoom = async (name: string, description: string): Promise<{ success: boolean, roomId: string }> => {
    if (!rpcClient || !isInitialized || !user) {
      return { success: false, roomId: '' };
    }

    try {
      const roomData = {
        name,
        description: description || `A room for ${name}`
      };

      const request = rpcClient.request('createRoom');
      await request.send(JSON.stringify(roomData));
      return { success: true, roomId: 'pending' };
    } catch (error) {
      console.error('Error creating room:', error);
      return { success: false, roomId: '' };
    }
  };

  const selectRoom = async (room: Room) => {
    console.log('ChatContext: Selecting room', room.id);
    setCurrentRoom(room);

    // If we don't have messages for this room or they're not populated yet
    if (!messagesByRoom[room.id] || messagesByRoom[room.id].length === 0) {
      if (!initializedRooms.current.has(room.id)) {
        initializedRooms.current.add(room.id);

        // Set loading state for this room
        setIsLoadingByRoom(prev => ({
          ...prev,
          [room.id]: true
        }));

        // Request messages
        if (rpcClient && isInitialized) {
          try {
            console.log('ChatContext: Sending joinRoom request to backend', room.id);
            const request = rpcClient.request('joinRoom');
            await request.send(JSON.stringify({ roomId: room.id }));
          } catch (error) {
            console.error('Error joining room:', error);

            // Reset loading state on error
            setIsLoadingByRoom(prev => ({
              ...prev,
              [room.id]: false
            }));
          }
        }
      }
    }

    // Add user to online users if not already present
    if (user && !onlineUsers.find(u => u.id === user.id)) {
      setOnlineUsers(prev => [
        ...prev,
        {
          id: user.id,
          username: user.name,
          isOnline: true
        }
      ]);
    }
  };

  const leaveRoom = () => {
    if (currentRoom && rpcClient && isInitialized) {
      try {
        const request = rpcClient.request('leaveRoom');
        request.send(JSON.stringify({ roomId: currentRoom.id }));
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    }
    setCurrentRoom(null);
  };

  const sendMessage = async (text: string) => {
    if (!currentRoom || !user || !rpcClient || !isInitialized) return;

    try {
      const messageData = {
        roomId: currentRoom.id,
        content: text,
        sender: user.name,
        timestamp: Date.now()
      };

      const request = rpcClient.request('sendMessage');
      await request.send(JSON.stringify(messageData));
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Load older messages (for pagination)
  const loadMoreMessages = async (): Promise<boolean> => {
    if (!currentRoom || !rpcClient || !isInitialized) {
      return false;
    }

    // Check if we are already loading or have no more messages
    const isLoading = isLoadingByRoom[currentRoom.id] || false;
    const hasMore = hasMoreMessagesByRoom[currentRoom.id] || false;

    if (isLoading || !hasMore) {
      return false;
    }

    const messages = getCurrentMessages();
    if (messages.length === 0) {
      return false;
    }

    // Get the oldest message timestamp
    const oldestMessage = messages[messages.length - 1];

    try {
      // Set loading state for this room
      setIsLoadingByRoom(prev => ({
        ...prev,
        [currentRoom.id]: true
      }));

      // Create request with oldest message timestamp as a reference point
      const request = rpcClient.request('loadMoreMessages');
      await request.send(JSON.stringify({
        roomId: currentRoom.id,
        before: oldestMessage.timestamp,
        limit: 20 // Number of messages to load
      }));

      return true;
    } catch (error) {
      console.error('Error loading more messages:', error);

      // Reset loading state on error
      setIsLoadingByRoom(prev => ({
        ...prev,
        [currentRoom.id]: false
      }));

      return false;
    }
  };

  // Append current room's loading state to messages
  const messagesWithLoadingState = getCurrentMessages();
  const isCurrentRoomLoading = currentRoom ? (isLoadingByRoom[currentRoom.id] || false) : false;

  return (
    <ChatContext.Provider
      value={{
        rooms,
        currentRoom,
        messages: messagesWithLoadingState,
        onlineUsers,
        selectRoom,
        leaveRoom,
        sendMessage,
        refreshRooms,
        createRoom,
        loadMoreMessages,
        isLoading: isCurrentRoomLoading
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProvider;

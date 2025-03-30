import React, { createContext, useState, useEffect, useCallback } from 'react';
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
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Get current room's messages
  const getCurrentMessages = useCallback(() => {
    return currentRoom ? (messagesByRoom[currentRoom.id] || []) : [];
  }, [currentRoom, messagesByRoom]);


  // Initialize rooms from backend when worklet is ready
  useEffect(() => {
    if (isInitialized && rpcClient) {
      refreshRooms();

      // Set up callbacks for WorkletContext
      setCallbacks({
        updateRooms: handleUpdateRooms,
        updateMessages: handleUpdateMessages,
        onRoomCreated: handleRoomCreated
      });
    }
  }, [isInitialized, rpcClient]);

  useEffect(() => {
    if (user && user.rooms) {
      setRooms(user.rooms);
    }
  }, [user]);


  // Callback handlers for WorkletContext
  const handleUpdateRooms = useCallback((updatedRooms: Room[]) => {
    setRooms(updatedRooms);
  }, []);


  useEffect(() => {
    if (isInitialized && rpcClient) {
      refreshRooms();

      // Set up callbacks for WorkletContext
      setCallbacks({
        updateRooms: handleUpdateRooms,
        updateMessages: handleUpdateMessages,
        onRoomCreated: handleRoomCreated
      });
    }
  }, [isInitialized, rpcClient]);

  const handleUpdateMessages = useCallback((newMessages: Message[], replace = false) => {
    console.log('Handling update messages')
    if (!newMessages.length) return;

    // Get roomId from the first message
    const roomId = newMessages[0].roomId;

    setMessagesByRoom(prevByRoom => {
      const existingMessages = prevByRoom[roomId] || [];

      console.log('Existing messages', existingMessages)
      let updatedMessages: Message[];
      if (replace) {
        // Replace entire message list for this room
        //
        updatedMessages = [...newMessages].sort((a, b) => b.timestamp - a.timestamp);

        console.log('Replacing...', updatedMessages)
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
      }

      // Return updated messagesByRoom
      return {
        ...prevByRoom,
        [roomId]: updatedMessages
      };
    });

    // Update hasMoreMessages flag
    if (newMessages.length < 20) {
      setHasMoreMessages(false);
    } else {
      setHasMoreMessages(true);
    }
  }, []);


  const handleRoomCreated = useCallback((room: Room) => {
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
  }, []);

  // Refresh rooms list from backend
  const refreshRooms = async () => {
    if (!rpcClient || !isInitialized) return;

    try {
      const request = rpcClient.request('getRooms');
      await request.send();
      // The response will be handled by the RPC event handler in WorkletContext
      // which will update the rooms array
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
    setHasMoreMessages(true); // Reset pagination state
    setCurrentRoom(room);

    // Call backend to join room if we have a worklet
    if (rpcClient && isInitialized) {
      try {
        const request = rpcClient.request('joinRoom');
        await request.send(JSON.stringify({ roomId: room.id }));
        // Response will be handled in WorkletContext and will update messages
      } catch (error) {
        console.error('Error joining room:', error);
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
    setHasMoreMessages(true);
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

      // The actual message will be updated via the RPC event handler in WorkletContext
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Load older messages (for pagination)

  const loadMoreMessages = async (): Promise<boolean> => {
    if (!currentRoom || !rpcClient || !isInitialized || isLoadingMore || !hasMoreMessages) {
      return false;
    }

    const messages = getCurrentMessages();
    if (messages.length === 0) {
      return false;
    }

    // Get the oldest message timestamp
    const oldestMessage = messages[messages.length - 1];

    try {
      setIsLoadingMore(true);

      // Create request with oldest message timestamp as a reference point
      const request = rpcClient.request('loadMoreMessages');
      await request.send(JSON.stringify({
        roomId: currentRoom.id,
        before: oldestMessage.timestamp,
        limit: 20 // Number of messages to load
      }));

      // The response will be handled in the WorkletContext callback
      // Set loading to false after a reasonable timeout
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 5000);

      return true;
    } catch (error) {
      console.error('Error loading more messages:', error);
      setIsLoadingMore(false);
      return false;
    }
  };


  return (
    <ChatContext.Provider
      value={{
        rooms,
        currentRoom,
        messages: getCurrentMessages(),
        onlineUsers,
        selectRoom,
        leaveRoom,
        sendMessage,
        refreshRooms,
        createRoom,
        loadMoreMessages
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProvider;

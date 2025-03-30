import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Room, Message, User, ChatContextType } from '../types';
import { MOCK_ROOMS, MOCK_MESSAGES, MOCK_USERS } from '../utils/constants';
import useUser from '../hooks/useUser';
import useWorklet from '../hooks/useWorklet';

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
  createRoom: async () => { return { success: false, roomId: '' } }
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);

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

  // Callback handlers for WorkletContext
  const handleUpdateRooms = useCallback((updatedRooms: Room[]) => {
    setRooms(updatedRooms);
  }, []);

  const handleUpdateMessages = useCallback((newMessages: Message[]) => {
    setMessages(prev => {
      // Combine old and new messages, removing duplicates based on id
      const messageMap = new Map();

      // Add existing messages to map
      prev.forEach(msg => {
        messageMap.set(msg.id, msg);
      });

      // Add or update with new messages
      newMessages.forEach(msg => {
        messageMap.set(msg.id, msg);
      });

      // Convert map back to array and sort by timestamp (oldest first)
      return Array.from(messageMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);
    });
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

      // The response will be handled by the RPC event handler in WorkletContext
      // For now, we'll just return success
      return { success: true, roomId: 'pending' };
    } catch (error) {
      console.error('Error creating room:', error);
      return { success: false, roomId: '' };
    }
  };

  // Select a room and join it
  const selectRoom = async (room: Room) => {
    setCurrentRoom(room);
    setMessages([]); // Clear previous messages

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

    // Mock: add user to online users if not already present
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
    setMessages([]);
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

  return (
    <ChatContext.Provider
      value={{
        rooms,
        currentRoom,
        messages,
        onlineUsers,
        selectRoom,
        leaveRoom,
        sendMessage,
        refreshRooms,
        createRoom
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProvider;

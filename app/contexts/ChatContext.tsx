import React, { createContext, useState, useContext } from 'react';
import { Room, Message, User, ChatContextType } from '../types';
import { AuthContext } from './AuthContext';
import { MOCK_ROOMS, MOCK_MESSAGES, MOCK_USERS } from '../utils/constants';

// Default context values
const defaultChatContext: ChatContextType = {
  rooms: [],
  currentRoom: null,
  messages: [],
  onlineUsers: [],
  selectRoom: async () => { },
  leaveRoom: () => { },
  sendMessage: async () => { }
};

export const ChatContext = createContext<ChatContextType>(defaultChatContext);

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useContext(AuthContext);

  // Use mock data for UI development
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [onlineUsers, setOnlineUsers] = useState<User[]>(MOCK_USERS);

  // Mock implementation for UI development
  const selectRoom = async (room: Room) => {
    setCurrentRoom(room);

    // Mock: add user to online users if not already present
    if (user && !onlineUsers.find(u => u.id === user.id)) {
      setOnlineUsers(prev => [
        ...prev,
        {
          id: user.id,
          username: user.username,
          isOnline: true
        }
      ]);
    }
  };

  const leaveRoom = () => {
    setCurrentRoom(null);
  };

  const sendMessage = async (text: string) => {
    if (!currentRoom || !user) return;

    // Add mock message
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      roomId: currentRoom.id,
      userId: user.id,
      username: user.username,
      text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMessage]);
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
        sendMessage
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProvider

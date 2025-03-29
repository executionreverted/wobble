import { Room, Message, User } from '../types';
import { MOCK_ROOMS, MOCK_MESSAGES, MOCK_USERS } from '../utils/constants';

// Mock implementation for UI development
export const getRooms = async (): Promise<Room[]> => {
  return MOCK_ROOMS;
};

export const joinRoom = async (roomId: string, userId: string): Promise<{
  messages: Message[];
  onlineUsers: User[];
}> => {
  // Filter messages for this room
  const roomMessages = MOCK_MESSAGES.filter(msg => msg.roomId === roomId);

  // Mock online users
  const mockOnlineUsers = [...MOCK_USERS];

  // Add the current user if not already in the list
  if (!mockOnlineUsers.find(u => u.id === userId)) {
    // Find the username from the messages if possible
    const userMessage = MOCK_MESSAGES.find(msg => msg.userId === userId);

    mockOnlineUsers.push({
      id: userId,
      username: userMessage?.username || `User_${userId}`,
      isOnline: true
    });
  }

  return {
    messages: roomMessages,
    onlineUsers: mockOnlineUsers
  };
};

export const leaveRoom = (roomId: string, userId: string): void => {
  // Mock leave room - no implementation needed for UI
};

export const sendMessage = async (message: Omit<Message, 'id'>): Promise<void> => {
  // Mock sending a message - no implementation needed for UI
};

export const getRoomHistory = async (roomId: string): Promise<Message[]> => {
  // Filter messages for this room
  return MOCK_MESSAGES.filter(msg => msg.roomId === roomId);
};

export default {
  getRooms,
  joinRoom,
  leaveRoom,
  sendMessage,
  getRoomHistory
}

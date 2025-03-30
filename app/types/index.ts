export type User = {
  id: string;
  username: string;
  isOnline: boolean;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  createdAt?: number;
  messageCount?: number;
};

export type Message = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
};

export type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
  register: (username: string, password: string) => Promise<void>;
};

export type ChatContextType = {
  rooms: Room[];
  currentRoom: Room | null;
  messages: Message[];
  onlineUsers: User[];
  selectRoom: (room: Room) => Promise<void>;
  leaveRoom: () => void;
  sendMessage: (text: string) => Promise<void>;
  refreshRooms: () => Promise<void>;
  createRoom: (name: string, description: string) => Promise<{ success: boolean, roomId: string }>;
};

export type SeedPhraseResponse = string[];

export default {}

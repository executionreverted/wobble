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
  invite?: string; // For sharing room invites
};

export type Message = {
  id: string;
  roomId: string;
  userId?: string;
  username?: string;
  sender: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
  system?: boolean;
  hasAttachments?: boolean;
  attachments?: string | string[];
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
  messages: Message[]; // Current room's messages
  messagesByRoom: { [roomId: string]: Message[] }; // Messages organized by room ID
  onlineUsers: User[];
  isLoading?: boolean; // Loading state for the current room
  selectRoom: (room: Room) => Promise<void>;
  leaveRoom: () => void;
  sendMessage: (text: string) => Promise<void>;
  refreshRooms: () => Promise<any>;
  createRoom: (name: string, description: string) => Promise<{ success: boolean, roomId: string }>;
  loadMoreMessages: () => Promise<boolean>;
  setCurrentRoom?: any
  setMessagesByRoom?: any
  setOnlineUsers?: any
  setRooms?: any
  reset?: any
};

export type SeedPhraseResponse = string[];

export type MessageBatch = {
  messages: Message[];
  hasMore: boolean;
};

export interface FileAttachment {
  path: string;
  name: string;
  size: number;
  blobId: string | any;
  coreKey: string;
  ownCoreKey: string;
  timestamp: number;
  sender: string;
  metadata?: {
    mimeType?: string;
    preview?: boolean;
  };
}

export default {}



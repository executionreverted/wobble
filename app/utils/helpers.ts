import { Message, User, Room } from '../types';
import { Platform } from 'react-native';

// Format timestamp for messages
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format date for message groups
export const formatMessageDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
};

// Group messages by date for UI rendering
export const groupMessagesByDate = (messages: Message[]): { date: string; messages: Message[] }[] => {
  const groups: { [key: string]: Message[] } = {};

  messages.forEach((message) => {
    const date = new Date(message.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });

  return Object.keys(groups).map((date) => {
    const firstMessage = groups[date][0];
    return {
      date: formatMessageDate(firstMessage.timestamp),
      messages: groups[date],
    };
  }).sort((a, b) => {
    const dateA = new Date(a.messages[0].timestamp);
    const dateB = new Date(b.messages[0].timestamp);
    return dateA.getTime() - dateB.getTime();
  });
};

// Filter and sort online users
export const getSortedUsers = (users: User[]): User[] => {
  return [...users].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.username.localeCompare(b.username);
  });
};

// Generate unique ID for messages
export const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get file extension from path
export const getFileExtension = (path: string): string => {
  return path.split('.').pop() || '';
};

// Check if platform is iOS
export const isIOS = Platform.OS === 'ios';

// Check if platform is Android
export const isAndroid = Platform.OS === 'android';

// Check if message is from today
export const isToday = (timestamp: number): boolean => {
  const today = new Date();
  const date = new Date(timestamp);
  return date.toDateString() === today.toDateString();
};

// Filter rooms by search term
export const filterRooms = (rooms: Room[], searchTerm: string): Room[] => {
  if (!searchTerm) return rooms;
  const term = searchTerm.toLowerCase();

  return rooms.filter((room) =>
    room.name.toLowerCase().includes(term) ||
    room.description.toLowerCase().includes(term)
  );
};

// Format user status text
export const getUserStatusText = (user: User): string => {
  return user.isOnline ? 'Online' : 'Offline';
};

export const createStableBlobId = (blobRef: any) => {
  if (!blobRef) return 'unknown-blob';

  if (typeof blobRef === 'string') return blobRef;

  if (typeof blobRef === 'object') {
    // For hyperblobs object with block info
    if (blobRef.blockLength && blobRef.blockOffset && blobRef.byteLength) {
      return `blob-${blobRef.byteOffset}-${blobRef.byteLength}`;
    }

    // Try to use any numeric properties to create a stable ID
    const numericProps = Object.entries(blobRef)
      .filter(([_, val]) => typeof val === 'number')
      .map(([key, val]) => `${key}-${val}`);

    if (numericProps.length > 0) {
      return `blob-${numericProps.join('-')}`;
    }

    // Last resort: stable hash from stringified object
    try {
      const str = JSON.stringify(blobRef);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      return `blob-hash-${Math.abs(hash)}`;
    } catch (e) {
      return `blob-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    }
  }

  // Fallback for any other type
  return `blob-${Date.now()}-${Math.random().toString(36).substring(2)}`;
};


export default {}

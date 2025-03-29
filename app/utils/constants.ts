// API constants
export const API_TIMEOUT = 30000; // 30 seconds

// Storage keys
export const STORAGE_KEYS = {
  USER: '@DiscordClone:user',
  AUTH_TOKEN: '@DiscordClone:authToken',
};

// Theme colors
export const COLORS = {
  // Primary colors
  primary: '#7289da',
  primaryDark: '#5b6eae',
  primaryLight: '#8ea1e1',

  // Discord colors
  background: '#36393f',
  secondaryBackground: '#2f3136',
  tertiaryBackground: '#202225',

  // Text colors
  textPrimary: '#ffffff',
  textSecondary: '#b9bbbe',
  textMuted: '#72767d',

  // Status colors
  online: '#3ba55c',
  idle: '#faa61a',
  dnd: '#ed4245',
  offline: '#747f8d',

  // UI elements
  input: '#40444b',
  separator: '#2f3136',

  // Accent colors
  success: '#3ba55c',
  warning: '#faa61a',
  error: '#ed4245',
  info: '#5865f2',
};

// Mock rooms and users for UI development
export const MOCK_ROOMS = [
  { id: '1', name: 'general', description: 'General discussions' },
  { id: '2', name: 'random', description: 'Random topics' },
  { id: '3', name: 'help', description: 'Get help here' },
  { id: '4', name: 'music', description: 'Music recommendations' },
  { id: '5', name: 'gaming', description: 'Gaming discussions' },
];

export const MOCK_USERS = [
  { id: 'user1', username: 'Alice', isOnline: true },
  { id: 'user2', username: 'Bob', isOnline: true },
  { id: 'user3', username: 'Charlie', isOnline: false },
  { id: 'user4', username: 'David', isOnline: true },
  { id: 'user5', username: 'Eve', isOnline: false },
];

export const MOCK_MESSAGES = [
  {
    id: 'msg1',
    roomId: '1',
    userId: 'system',
    username: 'System',
    text: 'Welcome to the general channel!',
    timestamp: Date.now() - 3600000 * 24,
    isSystem: true
  },
  {
    id: 'msg2',
    roomId: '1',
    userId: 'user1',
    username: 'Alice',
    text: 'Hey everyone! How are you today?',
    timestamp: Date.now() - 3600000
  },
  {
    id: 'msg3',
    roomId: '1',
    userId: 'user2',
    username: 'Bob',
    text: 'I\'m doing great! Working on a new project.',
    timestamp: Date.now() - 1800000
  },
  {
    id: 'msg4',
    roomId: '1',
    userId: 'user4',
    username: 'David',
    text: 'Just joined! What\'s everyone talking about?',
    timestamp: Date.now() - 900000
  },
];


export default {}

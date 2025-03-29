import { User } from '../types';

// Mock implementation for UI development
export const getCurrentUser = async (): Promise<User | null> => {
  // Mock: no stored user
  return null;
};

export const login = async (username: string): Promise<User> => {
  // Mock successful login
  return {
    id: `user_${Date.now()}`,
    username,
    isOnline: true
  };
};

export const register = async (username: string, password: string): Promise<User> => {
  // Mock successful registration
  return {
    id: `user_${Date.now()}`,
    username,
    isOnline: true
  };
};

export const logout = async (): Promise<void> => {
  // Mock successful logout
  return;
};

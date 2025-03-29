import React, { createContext, useState, ReactNode } from 'react';
import { User, AuthContextType } from '../types';

// Default context values
const defaultAuthContext: AuthContextType = {
  user: null,
  isAuthenticated: false,
  login: async () => { },
  logout: () => { },
  register: async () => { }
};

export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mock implementation for UI development
  const login = async (username: string) => {
    // Mock successful login
    const mockUser: User = {
      id: `user_${Date.now()}`,
      username,
      isOnline: true
    };

    setUser(mockUser);
    setIsAuthenticated(true);
  };

  const register = async (username: string, password: string) => {
    // Mock successful registration
    const mockUser: User = {
      id: `user_${Date.now()}`,
      username,
      isOnline: true
    };

    setUser(mockUser);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider

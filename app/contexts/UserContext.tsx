import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Alert } from 'react-native';
// Define the User type
export interface UserData {
  id: string;
  name: string;
  status: string,
  contacts: any[],
  rooms: any[]
}

// Define the context type
export interface UserContextType {
  // User state
  user: UserData | null;
  seedPhrase: string[] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;

  // User actions
  storeSeedPhrase: any;
  updateUser: (user: UserData) => {},
  getUserPublicKey: () => Promise<string | null>;
}

// Create the context with default values
export const UserContext = createContext<UserContextType>({
  // Default state
  user: null,
  seedPhrase: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Default action implementations (will be overridden by provider)
  storeSeedPhrase: async (seedPhrase?: string[]) => { },
  updateUser: async (userdata: UserData) => { },
  getUserPublicKey: async () => null,
});

// Props for the provider component
interface UserProviderProps {
  children: ReactNode;
}

// Create the provider component
export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  // State
  const [user, setUser] = useState<UserData | null>(null);
  const [seedPhrase, setSeedPhrase] = useState<string[] | null>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Load user data from storage on initial mount
  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      try {

      } catch (err) {
        console.error('Failed to load user data:', err);
        setError(err instanceof Error ? err : new Error('Unknown error loading user data'));
      } finally {
        setIsLoading(false);
      }
    };
  }, [isAuthenticated]);

  // Update username
  const updateUser = useCallback(async (user: UserData) => {
    if (!user) {
      throw new Error('No authenticated user');
    }
    try {
      setUser(prevUser =>
        user
      );
    } catch (err) {
      console.error('Failed to update username:', err);
      setError(err instanceof Error ? err : new Error('Failed to update username'));
      throw err;
    }
  }, []);

  // Get user's public key
  const getUserPublicKey = useCallback(async () => {
    if (!user) {
      return null;
    }

    try {
      // In a real implementation, you would retrieve this from your crypto identity
      return user.id || null;
    } catch (err) {
      console.error('Failed to get public key:', err);
      setError(err instanceof Error ? err : new Error('Failed to get public key'));
      return null;
    }
  }, [user]);

  // Create the context value
  const value: UserContextType = {
    user,
    seedPhrase,
    isAuthenticated,
    isLoading,
    error,
    storeSeedPhrase: setSeedPhrase,
    updateUser,
    getUserPublicKey,
  };

  // Provide the context
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;

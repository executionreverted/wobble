import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Alert } from 'react-native';
// Define the User type
export interface UserData {
  id: string;
  username: string;
  publicKey?: string;
  avatar?: string;
  createdAt: number;
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
  login: (seedPhrase?: string[]) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
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
  login: async () => { },
  logout: async () => { },
  updateUsername: async () => { },
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
        // In a real app, you would load from secure storage
        // For now, we'll just check if we have seed phrase in memory
        // and auto-authenticate if we do
        if (seedPhrase) {
          await login(seedPhrase);
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
        setError(err instanceof Error ? err : new Error('Unknown error loading user data'));
      } finally {
        setIsLoading(false);
      }
    };
  }, [isAuthenticated]);

  // Login with seed phrase
  const login = useCallback(async (incomingSeedPhrase?: string[]) => {
    setIsLoading(true);
    try {
      // Use the provided seed phrase or the stored one
      const phraseToUse = incomingSeedPhrase || seedPhrase;

      if (!phraseToUse) {
        throw new Error('No seed phrase available for login');
      }

      // In a real implementation, you would:
      // 1. Derive keys from the seed phrase
      // 2. Set up your crypto identity
      // 3. Connect to the network
      // 4. Load user profile data

      // For now, we'll create a mock user
      const mockUser: UserData = {
        id: `user_${Date.now()}`,
        username: `User_${phraseToUse[0].substring(0, 4)}`,
        publicKey: 'mock_public_key',
        createdAt: Date.now()
      };

      // Store seed phrase if it's coming from outside
      if (incomingSeedPhrase && !seedPhrase) {
        setSeedPhrase(incomingSeedPhrase);
      }

      // Update state
      setUser(mockUser);
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      console.error('Login failed:', err);
      setError(err instanceof Error ? err : new Error('Login failed'));
      Alert.alert('Login Failed', 'Could not authenticate with the provided seed phrase');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [seedPhrase]);

  // Logout
  const logout = useCallback(async () => {
    try {
      // In a real implementation, you might want to:
      // 1. Disconnect from the network
      // 2. Clear sensitive data from memory
      // 3. Maybe preserve the seed phrase in secure storage

      // Clear state
      setUser(null);
      setIsAuthenticated(false);

      // For this demo, we'll clear the seed phrase too
      // In a real app, you might want to keep it in secure storage
      setSeedPhrase(null);
    } catch (err) {
      console.error('Logout failed:', err);
      setError(err instanceof Error ? err : new Error('Logout failed'));
      throw err;
    }
  }, []);

  // Update username
  const updateUsername = useCallback(async (username: string) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    try {
      // In a real implementation, you might want to:
      // 1. Update the user's profile on the network
      // 2. Store the update locally

      // Update user state
      setUser(prevUser =>
        prevUser ? { ...prevUser, username } : null
      );
    } catch (err) {
      console.error('Failed to update username:', err);
      setError(err instanceof Error ? err : new Error('Failed to update username'));
      throw err;
    }
  }, [user]);

  // Get user's public key
  const getUserPublicKey = useCallback(async () => {
    if (!user) {
      return null;
    }

    try {
      // In a real implementation, you would retrieve this from your crypto identity
      return user.publicKey || null;
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
    login,
    logout,
    updateUsername,
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

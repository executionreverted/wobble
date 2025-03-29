import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Worklet } from 'react-native-bare-kit';
import { Platform } from 'react-native';
import RPC from 'bare-rpc';
// @ts-ignore
import bundle from '../app.bundle';

export interface WorkletContextType {
  worklet: Worklet | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  generateSeedPhrase: () => Promise<string[]>;
}

export const WorkletContext = createContext<WorkletContextType | undefined>(undefined);

export interface WorkletProviderProps {
  children: ReactNode;
}

export const WorkletProvider: React.FC<WorkletProviderProps> = ({ children }) => {
  const [worklet, setWorklet] = useState<Worklet | null>(null);
  const [rpcClient, setRpcClient] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize worklet on component mount
  useEffect(() => {
    const initWorklet = async () => {
      try {
        console.log('Init worklet')
        setIsLoading(true);
        const newWorklet = new Worklet();
        newWorklet.start('/app.bundle', bundle, [Platform.OS]);

        // Initialize RPC client
        const { IPC } = newWorklet;
        const client = new RPC(IPC, (req) => {
          // Handle incoming RPC requests
          if (req.command == 'getNewSeed') {
            console.log(req)
            console.log(req.data.value)
            try {
              const value = JSON.parse(req.data)
              return value
            }
            catch (e) {
              console.log(e)
            }
            return []
          }
        });

        setWorklet(newWorklet);
        setRpcClient(client);
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize worklet:', err);
        setError(err instanceof Error ? err : new Error('Unknown error initializing worklet'));
      } finally {
        setIsLoading(false);
      }
    };

    initWorklet();

    // Clean up on unmount
    return () => {
      if (worklet) {
        worklet.terminate();
      }
    };
  }, []);

  const generateSeedPhrase = useCallback(async (): Promise<string[]> => {
    if (!rpcClient) {
      console.error('NO RPC')
      return []
    }

    try {
      const request = rpcClient.request('getNewSeed');
      const response = await request.send();
      console.log({ response })
      return response as string[] || [];
    } catch (err) {
      console.error('Failed to generate seed phrase:', err);
      throw err instanceof Error ? err : new Error('Failed to generate seed phrase');
    }
  }, [rpcClient]);

  const value = {
    worklet,
    isInitialized,
    isLoading,
    error,
    generateSeedPhrase
  };

  return (
    <WorkletContext.Provider value={value}>
      {children}
    </WorkletContext.Provider>
  );
};



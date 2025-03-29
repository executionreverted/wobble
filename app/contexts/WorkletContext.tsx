import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Worklet } from 'react-native-bare-kit';
import { Platform } from 'react-native';
import RPC from 'bare-rpc';
// @ts-ignore
import bundle from '../app.bundle';
import b4a from "b4a"
import useUser from '../hooks/useUser';
export interface WorkletContextType {
  worklet: Worklet | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  generateSeedPhrase: () => Promise<string[]>;
  confirmSeedPhrase: () => Promise<string[]>;
}

export const WorkletContext = createContext<WorkletContextType>(undefined as any);

export interface WorkletProviderProps {
  children: ReactNode;
}

export const WorkletProvider: React.FC<WorkletProviderProps> = ({ children }) => {
  const { storeSeedPhrase } = useUser()
  const [worklet, setWorklet] = useState<Worklet | null>(null);
  const [rpcClient, setRpcClient] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize worklet on component mount
  useEffect(() => {
    const initWorklet = async () => {
      try {
        console.log('Init worklet');
        setIsLoading(true);
        const newWorklet = new Worklet();
        newWorklet.start('/app.bundle', bundle, [Platform.OS]);

        // Initialize RPC client
        const { IPC } = newWorklet;
        const client = new RPC(
          IPC,
          (req: any) => {
            if (req.command === 'seedGenerated') {
              try {
                const data = b4a.toString(req.data)
                const parsedData = JSON.parse(data)
                console.log(parsedData)
                storeSeedPhrase(parsedData)
              }
              catch (e) {
                console.error(e)
              }
            }
          }
        );

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

  const generateSeedPhrase = useCallback(async (): Promise<any> => {
    if (!rpcClient) {
      console.error('NO RPC');
      return [];
    }
    try {
      const request = rpcClient.request('generateSeed');
      await request.send();
    } catch (err) {
      console.error('Failed to generate seed phrase:', err);
      throw err instanceof Error ? err : new Error('Failed to generate seed phrase');
    }
  }, [rpcClient]);


  const confirmSeedPhrase = useCallback(async (seedPhrase: string[]): Promise<{ success: boolean, userId?: string, error?: string }> => {
    if (!rpcClient) {
      console.error('NO RPC');
      return { success: false, error: 'RPC client not initialized' };
    }

    try {
      const request = rpcClient.request('confirmSeed');
      await request.send(JSON.stringify(seedPhrase));
    } catch (err) {
      console.error('Failed to confirm seed phrase:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to confirm seed phrase'
      };
    }
  }, [rpcClient]);

  const value = {
    worklet,
    isInitialized,
    isLoading,
    error,
    generateSeedPhrase,
    confirmSeedPhrase
  };

  return (
    <WorkletContext.Provider value={value}>
      {children}
    </WorkletContext.Provider>
  );
};

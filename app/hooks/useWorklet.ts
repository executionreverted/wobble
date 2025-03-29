import { useState, useCallback } from 'react';
import { Worklet } from 'react-native-bare-kit';
import { Platform } from 'react-native';
import RPC from 'bare-rpc'
// @ts-ignore
import bundle from '../app.bundle';

export const useWorklet = () => {
  const [worklet, setWorklet] = useState<Worklet | null>(null);

  const initialize = useCallback(() => {
    try {
      const newWorklet = new Worklet();
      newWorklet.start('/app.bundle', bundle, [Platform.OS]);
      setWorklet(newWorklet);
      const { IPC }: any = worklet
      // Initialise RPC
      new RPC(IPC, (req) => {
        // Handle incoming RPC requests

        if (req.command === 'message') {

        }

        if (req.command === 'reset') {

        }


      })
      return newWorklet;
    } catch (error) {
      console.error('Failed to initialize worklet:', error);
      return null;
    }


  }, []);

  const teardown = useCallback(() => {
    if (worklet) {
      worklet.terminate();
      setWorklet(null);
    }
  }, [worklet]);

  return {
    worklet,
    initialize,
    teardown
  };
};

export default useWorklet

import { useState, useCallback } from 'react';
import { Worklet } from 'react-native-bare-kit';
import { Platform } from 'react-native';
// @ts-ignore
import bundle from '../app.bundle';

export const useWorklet = () => {
  const [worklet, setWorklet] = useState<Worklet | null>(null);

  const initialize = useCallback(() => {
    try {
      const newWorklet = new Worklet();
      newWorklet.start('/app.bundle', bundle, [Platform.OS]);
      setWorklet(newWorklet);
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

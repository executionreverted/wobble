
import React, { ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ResetContext, resetRegistry } from './resetSystem';

interface ResetProviderProps {
  children: ReactNode;
}

export const ResetProvider: React.FC<ResetProviderProps> = ({ children }) => {
  const navigation = useNavigation();

  const resetAllContexts = () => {
    // Reset all registered contexts
    resetRegistry.resetAll();

    // Navigate to the Welcome screen
    navigation.reset({
      index: 0,
      // @ts-ignore
      routes: [{ name: 'Welcome' }],
    });
  };

  return (
    <ResetContext.Provider value={{ resetAllContexts }}>
      {children}
    </ResetContext.Provider>
  );
};

export default ResetProvider;

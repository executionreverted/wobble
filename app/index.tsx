import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import App from './App';

const Root = () => {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

registerRootComponent(Root);

export default Root;

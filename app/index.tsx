import './utils/gesture-handler.js';

import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import AppNavigator from './App';
import useWorklet from './hooks/useWorklet';

const App = () => {
  useWorklet()
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <ChatProvider>
          <AppNavigator />
        </ChatProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

registerRootComponent(App);

export default App;

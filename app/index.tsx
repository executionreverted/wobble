import './utils/gesture-handler.js';

import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChatProvider } from './contexts/ChatContext';
import AppNavigator from './App';
import { WorkletProvider } from './contexts/WorkletContext';
import { UserProvider } from './contexts/UserContext';


const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      <UserProvider>
        <WorkletProvider>
          <ChatProvider>
            <AppNavigator />
          </ChatProvider>
        </WorkletProvider>
      </UserProvider>

    </SafeAreaProvider>
  );
};

registerRootComponent(App);

export default App;

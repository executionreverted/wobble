import './utils/gesture-handler.js';

import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChatProvider } from './contexts/ChatContext';
import AppNavigator from './App';
import { WorkletProvider } from './contexts/WorkletContext';
import { UserProvider } from './contexts/UserContext';

import { ResetProvider } from './contexts/ResetProvider';

const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ResetProvider>
        <UserProvider>
          <WorkletProvider>
            <ChatProvider>
              <AppNavigator />
            </ChatProvider>
          </WorkletProvider>
        </UserProvider>
      </ResetProvider>
    </SafeAreaProvider>
  );
};

registerRootComponent(App);

export default App;

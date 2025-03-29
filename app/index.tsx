import './utils/gesture-handler.js';

import React from 'react';
import { registerRootComponent } from 'expo';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import AppNavigator from './App';
import { COLORS } from './utils/constants';

const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <ChatProvider>
          <NavigationContainer
            theme={{
              dark: true,
              colors: {
                primary: COLORS.primary,
                background: COLORS.background,
                card: COLORS.secondaryBackground,
                text: COLORS.textPrimary,
                border: COLORS.separator,
                notification: COLORS.error,
              },
            }}
          >
            <AppNavigator />
          </NavigationContainer>
        </ChatProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

registerRootComponent(App);

export default App;

import React from 'react';
import { View, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { WorkletProvider } from './contexts/WorkletContext';

import WelcomeScreen from './components/Welcome';
import LoginScreen from './components/auth/Login';
import HomeScreen from './components/Home';
import RoomListScreen from './components/chat/RoomList';
import Room from './components/chat/Room';
import { COLORS } from './utils/constants';
import { useAuth } from './hooks/useAuth';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main tabs for authenticated users
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.tertiaryBackground,
          borderTopColor: COLORS.separator,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Rooms"
        component={RoomListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="forum" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsPlaceholder}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Placeholder for settings (not implemented)
const SettingsPlaceholder = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
      <MaterialIcons name="settings" size={48} color={COLORS.textMuted} />
      <Text style={{ color: COLORS.textPrimary, fontSize: 18, marginTop: 16 }}>
        Settings would go here
      </Text>
    </View>
  );
};

// Root navigation component without NavigationContainer
const AppNavigator = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.tertiaryBackground,
        },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
      initialRouteName={isAuthenticated ? 'MainTabs' : 'Welcome'}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={Room}
            options={({ route }: any) => ({
              title: route.params?.roomName || 'Chat',
              headerBackTitle: 'Back'
            })}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
              animationTypeForReplace: 'pop'
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;

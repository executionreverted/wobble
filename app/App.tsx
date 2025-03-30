import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { AppState } from 'react-native';
import WelcomeScreen from './components/Welcome';
import LoginScreen from './components/auth/Login';
import HomeScreen from './components/Home';
import RoomListScreen from './components/chat/RoomList';
import Room from './components/chat/Room';
import ProfileScreen from './components/user/Profile';
import { COLORS } from './utils/constants';
import useUser from './hooks/useUser';
import Loader from './components/common/Loading';
import useWorklet from './hooks/useWorklet';

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
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Root navigation component without NavigationContainer
const AppNavigator = () => {
  const { user } = useUser();
  const isAuthenticated = !!user;

  const { isInitialized, isLoading, isBackendReady, reinitializeBackend } = useWorklet();
  const [appReady, setAppReady] = useState(false);

  // Wait for worklet initialization to complete
  useEffect(() => {
    if (isInitialized && !isLoading && isBackendReady) {
      // Add a small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        setAppReady(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isInitialized, isLoading, isBackendReady]);


  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active' && !isLoading && isInitialized && isBackendReady) {
        // App came to foreground, reinitialize backend to ensure clean state
        console.log('App came to foreground, reinitializing backend...');
        await reinitializeBackend();
      }
    };

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isInitialized, isBackendReady, isLoading, reinitializeBackend]);


  // Show loader if app is not ready yet
  if (!appReady) {
    return <Loader message="Setting up your secure connection..." />;
  }

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
            options={({ route }) => ({
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

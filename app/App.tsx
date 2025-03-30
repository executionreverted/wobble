import React, { useEffect, useRef, useState } from 'react';
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
  const timeoutRef = useRef<any>(null);

  // Wait for worklet initialization to complete
  useEffect(() => {
    if (isAuthenticated && isInitialized && !isLoading && isBackendReady) {
      // Add a small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        setAppReady(true);
      }, 500);

      return () => clearTimeout(timer);
    }

    // Add a timeout to prevent endless loading
    if (!appReady && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        console.log("Loading timeout - forcing app ready state");
        // If we're still loading after 10 seconds, force app to ready state
        setAppReady(true);

        // Try to reinitialize the backend
        if (reinitializeBackend) {
          reinitializeBackend().catch(err => {
            console.error("Error reinitializing after timeout:", err);
          });
        }
      }, 1000); // 10 second timeout
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isInitialized, isLoading, isBackendReady, appReady, reinitializeBackend]);

  useEffect(() => {
    if (isInitialized && !isLoading) {
      // If backend is initialized but no user exists, just show login
      if (!user) {
        setAppReady(true);
      }
      // Otherwise if user exists and backend is ready
      else if (isBackendReady) {
        setAppReady(true);
      }
    }
  }, [isInitialized, isLoading, isBackendReady, user]);

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

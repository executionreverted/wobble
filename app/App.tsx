import { View, Platform, StyleSheet } from 'react-native';
import Room from './components/chat/Room';
import Home from './components/Home';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Easing } from 'react-native-reanimated';
import { Text, PlatformPressable } from '@react-navigation/elements';
import { useLinkBuilder, useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

function MyTabBar({ state, descriptors, navigation }: any) {
  const { colors } = useTheme();
  const { buildHref } = useLinkBuilder();

  return (
    <View style={{ flexDirection: 'row' }}>
      {state.routes.map((route: any, index: any) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <PlatformPressable
            href={buildHref(route.name, route.params)}
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={{ flex: 1 }}
          >
            <Text style={{ color: isFocused ? colors.primary : colors.text }}>
              {label}
            </Text>
          </PlatformPressable>
        );
      })}
    </View>
  );
}

const AppTabs = createBottomTabNavigator({
  tabBar: (props) => <MyTabBar {...props} />,
  screens: {
    Home: Home,
    Chat: Room,
  },
});

function AppScreen() {
  return (
    <SafeAreaView style={[styles.fill, styles.container]}>
      <AppTabs.Navigator
        screenOptions={{
          transitionSpec: {
            animation: 'timing',
            config: {
              duration: 150,
              easing: Easing.inOut(Easing.ease),
            },
          },
          sceneStyleInterpolator: ({ current }) => ({
            sceneStyle: {
              opacity: current.progress.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [0, 1, 0],
              }),
            },
          }),
        }}
      >
        <AppTabs.Screen name="Home" component={Home} />
        <AppTabs.Screen name="Chat" component={Room} />
      </AppTabs.Navigator>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  container: {
    backgroundColor: '#f5f5f5',
  },
  content: {
    backgroundColor: '#ffffff',
  },
})

export default AppScreen

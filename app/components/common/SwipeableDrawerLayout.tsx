import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;
const RIGHT_DRAWER_WIDTH = width * 0.7;

interface SwipeableDrawerLayoutProps {
  leftDrawer: React.ReactNode;
  rightDrawer?: React.ReactNode;
  children: React.ReactNode;
  showRightDrawer?: boolean;
}

const SwipeableDrawerLayout: React.FC<SwipeableDrawerLayoutProps> = ({
  leftDrawer,
  rightDrawer,
  children,
  showRightDrawer = false,
}) => {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  const leftPosition = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!showRightDrawer && gestureState.dx > 0) {
          // Only left drawer, only right swipe
          let newPosition = gestureState.dx;
          if (newPosition > DRAWER_WIDTH) newPosition = DRAWER_WIDTH;
          leftPosition.setValue(newPosition);
        } else if (showRightDrawer) {
          // Both drawers available
          let newPosition = leftDrawerOpen ? DRAWER_WIDTH + gestureState.dx : gestureState.dx;

          // Limit to drawer boundaries
          if (newPosition > DRAWER_WIDTH) newPosition = DRAWER_WIDTH;
          if (newPosition < -RIGHT_DRAWER_WIDTH) newPosition = -RIGHT_DRAWER_WIDTH;

          leftPosition.setValue(newPosition);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 50) {
          // Open left drawer
          openLeftDrawer();
        } else if (gestureState.dx < -50 && showRightDrawer) {
          // Open right drawer
          openRightDrawer();
        } else {
          // Close any open drawer
          closeDrawers();
        }
      },
    })
  ).current;

  const openLeftDrawer = () => {
    setLeftDrawerOpen(true);
    setRightDrawerOpen(false);
    Animated.spring(leftPosition, {
      toValue: DRAWER_WIDTH,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const openRightDrawer = () => {
    setLeftDrawerOpen(false);
    setRightDrawerOpen(true);
    Animated.spring(leftPosition, {
      toValue: -RIGHT_DRAWER_WIDTH,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const closeDrawers = () => {
    setLeftDrawerOpen(false);
    setRightDrawerOpen(false);
    Animated.spring(leftPosition, {
      toValue: 0,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const mainViewTransform = {
    transform: [{ translateX: leftPosition }],
  };

  return (
    <View style={styles.container}>
      {/* Left Drawer */}
      <View style={[styles.leftDrawer]}>
        {leftDrawer}
      </View>

      {/* Right Drawer */}
      {showRightDrawer && (
        <View style={[styles.rightDrawer]}>
          {rightDrawer}
        </View>
      )}

      {/* Main Content with Animation */}
      <Animated.View
        style={[styles.mainContent, mainViewTransform]}
        {...panResponder.panHandlers}
      >
        {/* Hamburger Menu Button */}
        <TouchableOpacity
          style={styles.leftMenuButton}
          onPress={leftDrawerOpen ? closeDrawers : openLeftDrawer}
        >
          <Ionicons
            name={leftDrawerOpen ? "close" : "menu"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>

        {/* Users List Button (only when right drawer is available) */}
        {showRightDrawer && (
          <TouchableOpacity
            style={styles.rightMenuButton}
            onPress={rightDrawerOpen ? closeDrawers : openRightDrawer}
          >
            <Ionicons
              name={rightDrawerOpen ? "close" : "people"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {children}

        {/* Overlay when drawer is open to capture taps to close */}
        {(leftDrawerOpen || rightDrawerOpen) && (
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={closeDrawers}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2f3136',
  },
  leftDrawer: {
    position: 'absolute',
    width: DRAWER_WIDTH,
    left: -DRAWER_WIDTH,
    top: 0,
    bottom: 0,
    backgroundColor: '#2f3136',
  },
  rightDrawer: {
    position: 'absolute',
    width: RIGHT_DRAWER_WIDTH,
    right: -RIGHT_DRAWER_WIDTH,
    top: 0,
    bottom: 0,
    backgroundColor: '#2f3136',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#36393f',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  leftMenuButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    padding: 10,
  },
  rightMenuButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    padding: 10,
  },
});

export default SwipeableDrawerLayout;

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface StatusIndicatorProps {
  isOnline: boolean;
  size?: number;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  isOnline,
  size = 10
}) => {
  return (
    <View
      style={[
        styles.indicator,
        { backgroundColor: isOnline ? '#3ba55c' : '#747f8d' },
        { width: size, height: size, borderRadius: size / 2 }
      ]}
    />
  );
};

const styles = StyleSheet.create({
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default StatusIndicator;

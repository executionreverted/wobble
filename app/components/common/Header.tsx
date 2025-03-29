import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBackPress,
  rightComponent,
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftContainer}>
        {showBackButton && (
          <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>

      {rightComponent && (
        <View style={styles.rightContainer}>
          {rightComponent}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#36393f',
    borderBottomWidth: 1,
    borderBottomColor: '#2f3136',
    paddingHorizontal: 16,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightContainer: {},
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default Header;

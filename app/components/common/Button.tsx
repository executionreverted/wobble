import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  buttonStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const Button: React.FC<ButtonProps> = ({
  title,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  buttonStyle,
  textStyle,
  ...rest
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryButton;
      case 'secondary':
        return styles.secondaryButton;
      case 'danger':
        return styles.dangerButton;
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'danger':
        return styles.dangerText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallButton;
      case 'medium':
        return styles.mediumButton;
      case 'large':
        return styles.largeButton;
      default:
        return styles.mediumButton;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallText;
      case 'medium':
        return styles.mediumText;
      case 'large':
        return styles.largeText;
      default:
        return styles.mediumText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getVariantStyle(),
        getSizeStyle(),
        disabled || loading ? styles.disabledButton : null,
        buttonStyle
      ]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? '#7289da' : '#fff'}
          size={size === 'small' ? 'small' : 'small'}
        />
      ) : (
        <Text
          style={[
            styles.text,
            getTextStyle(),
            getTextSizeStyle(),
            textStyle
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: 'bold',
  },
  // Variants
  primaryButton: {
    backgroundColor: '#7289da',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#7289da',
  },
  dangerButton: {
    backgroundColor: '#ed4245',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#7289da',
  },
  dangerText: {
    color: '#fff',
  },
  // Sizes
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  mediumButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  largeButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  // States
  disabledButton: {
    opacity: 0.6,
  },
});

export default Button;

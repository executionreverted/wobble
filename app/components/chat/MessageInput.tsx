import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  placeholder = 'Send a message...'
}) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#72767d"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          onPress={handleSend}
          style={styles.sendButton}
          disabled={!message.trim()}
        >
          <Ionicons
            name="send"
            size={24}
            color={message.trim() ? '#7289da' : '#72767d'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2f3136',
    backgroundColor: '#36393f',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#40444b',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: '#dcddde',
    fontSize: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
});

export default MessageInput;

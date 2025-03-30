import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';

interface JoinRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onRoomJoined: (room: any) => void;
}

const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  visible,
  onClose,
  onRoomJoined,
}) => {
  const { rpcClient } = useWorklet();
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinRoom = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    try {
      setIsLoading(true);

      // Join the room via RPC call to backend
      const request = rpcClient.request('joinRoomByInvite');
      await request.send(JSON.stringify({ inviteCode: inviteCode.trim() }));

      // We'll get a response via the roomJoinResult handler in WorkletContext
      // Reset form
      setInviteCode('');

      // Close modal - actual room joining will be handled by the callback
      onClose();

    } catch (error) {
      console.error('Error joining room:', error);
      Alert.alert('Error', 'Failed to join room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Join a Room</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Invite Code</Text>
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Enter invite code"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.helperText}>
              Paste the invite code shared with you to join a room.
            </Text>

            <TouchableOpacity
              style={[
                styles.joinButton,
                (!inviteCode.trim() || isLoading) && styles.disabledButton,
              ]}
              onPress={handleJoinRoom}
              disabled={!inviteCode.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <>
                  <MaterialIcons name="group-add" size={20} color={COLORS.textPrimary} />
                  <Text style={styles.joinButtonText}>Join Room</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 240,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 5,
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.input,
    borderRadius: 8,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  helperText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  joinButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default JoinRoomModal;

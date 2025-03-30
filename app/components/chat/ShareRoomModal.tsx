import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Share,
  Platform,
  Clipboard,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

interface ShareRoomProps {
  visible: boolean;
  onClose: () => void;
  inviteCode: string;
  roomName: string;
}

const ShareRoomModal: React.FC<ShareRoomProps> = ({
  visible,
  onClose,
  inviteCode,
  roomName
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(inviteCode);
      } else {
        await Clipboard.setString(inviteCode);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      Alert.alert('Success', 'Invite code copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy invite code');
    }
  };

  const handleShareInvite = async () => {
    try {
      const result = await Share.share({
        message: `Join my Roombase chat room "${roomName}" with this invite code: ${inviteCode}`,
        title: `Join ${roomName} on Roombase`
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error) {
      Alert.alert('Error', 'Error sharing invite code');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Room</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            <Text style={styles.roomName}>{roomName}</Text>

            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCodeLabel}>Invite Code:</Text>
              <Text style={styles.inviteCode} numberOfLines={2} ellipsizeMode="middle">
                {inviteCode}
              </Text>
            </View>

            <Text style={styles.instructionText}>
              Share this invite code with people you want to join this room.
              Anyone with this code can join the room.
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCopyInvite}
              >
                <MaterialIcons name="content-copy" size={24} color={COLORS.textPrimary} />
                <Text style={styles.actionButtonText}>
                  {copied ? 'Copied!' : 'Copy Code'}
                </Text>
              </TouchableOpacity>

              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.shareButton]}
                  onPress={handleShareInvite}
                >
                  <MaterialIcons name="share" size={24} color={COLORS.textPrimary} />
                  <Text style={styles.actionButtonText}>Share</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  contentContainer: {
    padding: 20,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  inviteCodeContainer: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  inviteCodeLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 8,
    backgroundColor: COLORS.tertiaryBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  shareButton: {
    backgroundColor: COLORS.primaryDark,
  },
  actionButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default ShareRoomModal;

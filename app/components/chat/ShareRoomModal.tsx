import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Share,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

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
  const [isLoading, setIsLoading] = useState(false);

  // Reset copied state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setCopied(false);
    }
  }, [visible]);

  const handleCopyInvite = async () => {
    if (!inviteCode) {
      Alert.alert('Error', 'No invite code available');
      return;
    }

    try {
      setIsLoading(true);

      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(inviteCode);
        } else {
          throw new Error('Clipboard not available');
        }
      } else {
        await Clipboard.setStringAsync(inviteCode);
      }

      setCopied(true);
      Alert.alert('Success', 'Invite code copied to clipboard');

      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy invite code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteCode) {
      Alert.alert('Error', 'No invite code available');
      return;
    }

    try {
      setIsLoading(true);
      const result = await Share.share({
        message: `Join my Roombase chat room "${roomName}" with this invite code: ${inviteCode}`,
        title: `Join ${roomName} on Roombase`
      });

      if (result.action === Share.sharedAction) {
        console.log('Successfully shared invite code');
      }
    } catch (error) {
      console.error('Error sharing invite code:', error);
      Alert.alert('Error', 'Failed to share invite code');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there's an invite code to display
  const hasInviteCode = !!inviteCode && inviteCode.length > 0;

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
            <Text style={styles.roomName}>#{roomName}</Text>

            {!hasInviteCode ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Generating invite code...</Text>
              </View>
            ) : (
              <>
                <View style={styles.qrContainer}>
                  <QRCode
                    value={inviteCode}
                    size={180}
                    color={COLORS.textPrimary}
                    backgroundColor={COLORS.tertiaryBackground}
                    logoBackgroundColor={COLORS.tertiaryBackground}
                  />
                </View>

                <View style={styles.inviteCodeContainer}>
                  <Text style={styles.inviteCodeLabel}>Invite Code:</Text>
                  <TouchableOpacity
                    style={styles.codeWrapper}
                    activeOpacity={0.7}
                    onPress={handleCopyInvite}
                  >
                    <Text style={styles.inviteCode} selectable={true}>
                      {inviteCode}
                    </Text>
                    <MaterialIcons
                      name="content-copy"
                      size={20}
                      color={COLORS.primary}
                      style={styles.copyIcon}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.instructionText}>
                  Share this invite code or scan the QR code to join this room.
                  Anyone with this code can join the room.
                </Text>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, copied && styles.copiedButton]}
                    onPress={handleCopyInvite}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={COLORS.textPrimary} />
                    ) : (
                      <>
                        <MaterialIcons
                          name={copied ? "check" : "content-copy"}
                          size={24}
                          color={COLORS.textPrimary}
                        />
                        <Text style={styles.actionButtonText}>
                          {copied ? 'Copied!' : 'Copy Code'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {Platform.OS !== 'web' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.shareButton]}
                      onPress={handleShareInvite}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={COLORS.textPrimary} />
                      ) : (
                        <>
                          <MaterialIcons name="share" size={24} color={COLORS.textPrimary} />
                          <Text style={styles.actionButtonText}>Share</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    paddingBottom: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
    padding: 8,
    borderRadius: 20,
  },
  contentContainer: {
    padding: 20,
    minHeight: 200,
  },
  roomName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 20,
    backgroundColor: COLORS.tertiaryBackground,
    borderRadius: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
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
    marginBottom: 10,
    fontWeight: '500',
  },
  codeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.tertiaryBackground,
    borderRadius: 6,
    padding: 12,
    paddingVertical: 14,
  },
  inviteCode: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyIcon: {
    marginLeft: 8,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  copiedButton: {
    backgroundColor: COLORS.success,
  },
  shareButton: {
    backgroundColor: COLORS.primaryDark,
  },
  actionButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
});

export default ShareRoomModal;

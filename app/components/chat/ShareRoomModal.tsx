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
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

const { width, height } = Dimensions.get('window');

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
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalWrapper}>
          {/* Close Button */}
          <View style={styles.closeButtonContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <MaterialIcons
                name="close"
                size={24}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Modal Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.modalTitle}>Share Room</Text>
          </View>

          {/* Room Name */}
          <View style={styles.roomNameContainer}>
            <Text style={styles.roomName}>#{roomName}</Text>
          </View>

          {/* Loading State */}
          {!hasInviteCode ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
              />
              <Text style={styles.loadingText}>
                Generating invite code...
              </Text>
            </View>
          ) : (
            <>
              {/* QR Code Container */}
              <View style={styles.qrContainer}>
                <QRCode
                  value={inviteCode}
                  size={200}
                  color={COLORS.textPrimary}
                  backgroundColor={COLORS.tertiaryBackground}
                  logoBackgroundColor={COLORS.tertiaryBackground}
                />
              </View>

              {/* Invite Code Container */}
              <View style={styles.inviteCodeContainer}>
                <Text style={styles.inviteCodeLabel}>Invite Code:</Text>
                <TouchableOpacity
                  style={styles.inviteCodeWrapper}
                  activeOpacity={0.7}
                  onPress={handleCopyInvite}
                >
                  <Text
                    style={styles.inviteCode}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {inviteCode}
                  </Text>
                  <MaterialIcons
                    name="content-copy"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>

              {/* Instructions */}
              <Text style={styles.instructionText}>
                Share this invite code or scan the QR code to join this room.
                Anyone with this code can join the room.
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {/* Copy Button */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleCopyInvite}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.textPrimary}
                    />
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

                {/* Share Button (Mobile Only) */}
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleShareInvite}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.textPrimary}
                      />
                    ) : (
                      <>
                        <MaterialIcons
                          name="share"
                          size={24}
                          color={COLORS.textPrimary}
                        />
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
    </Modal>
  );
};


export const styles = StyleSheet.create({
  // Full-screen modal container
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Modal content wrapper
  modalWrapper: {
    width: width * 0.90, // 90% of screen width
    maxWidth: 500, // Maximum width
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.25,
    shadowRadius: 4.65,
    elevation: 8,
  },

  // Close button positioning
  closeButtonContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 8,
  },

  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  // Room Name Styles
  roomNameContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // QR Code Container Styles
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 20,
  },

  // Invite Code Styles
  inviteCodeContainer: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  inviteCodeLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  inviteCodeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.tertiaryBackground,
    borderRadius: 8,
    padding: 12,
  },
  inviteCode: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
    marginRight: 10,
  },

  // Loading Styles
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Button Styles
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },

  // Instruction Text
  instructionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 20,
  },
}); export default ShareRoomModal;

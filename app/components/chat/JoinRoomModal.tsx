import React, { useState, useEffect } from 'react';
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
import { CameraView, Camera } from "expo-camera";

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
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setScannerVisible(false);
      setScanned(false);
    }
  }, [visible]);

  // Request camera permissions
  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    if (scannerVisible) {
      getCameraPermissions();
    }
  }, [scannerVisible]);

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

  const handleScanQR = () => {
    setScannerVisible(true);
    setScanned(false);
  };

  const handleBarcodeScanned = ({ type, data }: { type: string, data: string }) => {
    setScanned(true);
    if (data) {
      setInviteCode(data);
      setTimeout(() => {
        setScannerVisible(false);
      }, 500);
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

          {scannerVisible ? (
            <View style={styles.scannerContainer}>
              {hasPermission ? (
                <>
                  <CameraView
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                    style={styles.scanner}
                  />
                  <View style={styles.scannerOverlay}>
                    <View style={styles.scannerTarget} />
                  </View>
                  <TouchableOpacity
                    style={styles.cancelScanButton}
                    onPress={() => setScannerVisible(false)}
                  >
                    <MaterialIcons name="cancel" size={24} color={COLORS.textPrimary} />
                    <Text style={styles.cancelScanText}>Cancel Scan</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.permissionContainer}>
                  <MaterialIcons name="camera-alt" size={48} color={COLORS.textSecondary} />
                  <Text style={styles.permissionText}>
                    Camera permission is required to scan QR codes
                  </Text>
                  <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={() => setScannerVisible(false)}
                  >
                    <Text style={styles.permissionButtonText}>Close Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
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

              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleScanQR}
              >
                <MaterialIcons name="qr-code-scanner" size={20} color={COLORS.primary} />
                <Text style={styles.scanButtonText}>Scan QR Code</Text>
              </TouchableOpacity>

              <Text style={styles.helperText}>
                Paste the invite code or scan the QR code shared with you to join a room.
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
          )}
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 12,
  },
  scanButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
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
  scannerContainer: {
    height: 300,
    overflow: 'hidden',
    borderRadius: 12,
    marginBottom: 20,
    position: 'relative',
    backgroundColor: COLORS.tertiaryBackground,
  },
  scanner: {
    ...StyleSheet.absoluteFillObject,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerTarget: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cancelScanButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: COLORS.error,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelScanText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
  },
  permissionButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
});

export default JoinRoomModal;

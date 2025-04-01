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
  const { rpcClient, setCallbacks } = useWorklet();
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setScannerVisible(false);
      setScanned(false);
      setErrorMessage(null);
    } else {
      // Set up callbacks when modal opens
      setupCallbacks();
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

  // Set up callbacks for room join results
  const setupCallbacks = () => {
    setCallbacks({
      onRoomJoined: (room) => {
        console.log('Room joined callback triggered:', room);
        setIsLoading(false);

        // Clean up and close modal
        setInviteCode('');
        onClose();

        // Notify parent component
        onRoomJoined(room);
      }
    });
  };

  const handleJoinRoom = async () => {
    if (!inviteCode.trim()) {
      setErrorMessage('Please enter an invite code');
      return;
    }

    // Add a pre-processing step to clean the invite code
    let cleanedCode = inviteCode.trim();

    // Replace any non-Z32 characters
    // cleanedCode = cleanedCode.replace(/[^a-z2-7]/g, '');

    if (cleanedCode !== inviteCode.trim()) {
      setInviteCode(cleanedCode)
      return;
    }

    submitJoinRequest(inviteCode.trim());
  };

  // Separate function to submit the join request
  const submitJoinRequest = async (code) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      console.log('Submitting join request with code:', code);

      // Join the room via RPC call to backend
      const request = rpcClient.request('joinRoomByInvite');
      await request.send(JSON.stringify({ inviteCode: code }));

      // Set a timeout for the request
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          setErrorMessage('Request timed out. Please try again.');
        }
      }, 35000);

    } catch (error) {
      console.error('Error joining room:', error);
      setIsLoading(false);
      setErrorMessage('Failed to join room. Please try again.');
    }
  };
  const handleScanQR = () => {
    setScannerVisible(true);
    setScanned(false);
    setErrorMessage(null);
  };

  const handleBarcodeScanned = ({ type, data }: { type: string, data: string }) => {
    setScanned(true);
    if (data) {
      setInviteCode(data);
      // Automatically try to join after scanning if invite code looks valid
      if (data.length >= 16) {
        setTimeout(() => {
          setScannerVisible(false);
          handleJoinRoom();
        }, 500);
      } else {
        setTimeout(() => {
          setScannerVisible(false);
        }, 500);
      }
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
            <TouchableOpacity onPress={onClose} style={styles.closeButton} disabled={isLoading}>
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
                  style={[styles.input, errorMessage ? styles.inputError : null]}
                  value={inviteCode}
                  onChangeText={(text) => {
                    setInviteCode(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter invite code"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                {errorMessage && (
                  <Text style={styles.errorText}>{errorMessage}</Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleScanQR}
                disabled={isLoading}
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

              {isLoading && (
                <Text style={styles.loadingText}>
                  Connecting to room... This may take a moment.
                </Text>
              )}
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 5,
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
  loadingText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 16,
    fontSize: 14,
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

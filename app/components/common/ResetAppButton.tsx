import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import * as Updates from 'expo-updates';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';
import { useNavigation } from '@react-navigation/native';

const ResetAppButton = () => {
  const { rpcClient, worklet } = useWorklet();
  const [isResetting, setIsResetting] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  const navigation = useNavigation();
  // Call this after reset is confirmed
  const restartApp = () => {

    navigation.reset({
      index: 0,
      // @ts-ignore
      routes: [{ name: 'Welcome' }],
    });


    Alert.alert(
      'Reset Complete',
      'The app has been reset successfully. The app will now restart.',
      [
        {
          text: 'OK',
          onPress: async () => {
            // Terminate worklet if it exists
            if (worklet) {
              worklet.terminate();
            }

            try {
              // Reload the app
              await Updates.reloadAsync();
            } catch (err) {
              console.error('Failed to reload: ', err);
            }
          }
        }
      ]
    );
  };
  // Handle app reset
  const resetApp = async () => {
    if (!rpcClient) {
      Alert.alert('Error', 'Cannot reset app: RPC client not initialized');
      return;
    }

    try {
      setIsResetting(true);
      const request = rpcClient.request('resetAppState');
      request.send();
    } catch (error) {
      console.error('Error resetting app:', error);
      Alert.alert(
        'Reset Failed',
        'Failed to reset app state. Please try again.'
      );
    } finally {
      setIsResetting(false);
      setConfirmModalVisible(false);
    }
  };

  // Show confirmation modal
  const handleResetPress = () => {
    setConfirmModalVisible(true);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleResetPress}
        disabled={isResetting}
      >
        <MaterialIcons name="delete-forever" size={20} color="#FFF" />
        <Text style={styles.resetButtonText}>Reset App</Text>
      </TouchableOpacity>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <MaterialIcons name="warning" size={48} color={COLORS.warning} style={styles.warningIcon} />

            <Text style={styles.modalTitle}>Reset App State?</Text>

            <Text style={styles.modalText}>
              This will delete all user data, rooms, and messages. This action cannot be undone.
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setConfirmModalVisible(false)}
                disabled={isResetting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={resetApp}
                disabled={isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Reset</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  resetButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  warningIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: COLORS.tertiaryBackground,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

export default ResetAppButton;

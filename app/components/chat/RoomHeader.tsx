import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../utils/constants';
import ShareRoomModal from './ShareRoomModal';
import useWorklet from '../../hooks/useWorklet';

interface RoomHeaderProps {
  roomId: string;
  roomName: string;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({ roomId, roomName }) => {
  const navigation = useNavigation();
  const { rpcClient, setInviteCallbacks } = useWorklet();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Set up callback for receiving invite codes
  useEffect(() => {
    setInviteCallbacks({
      onInviteGenerated: (id, code) => {
        console.log(`Received invite code for room ${id}: ${code}`);
        if (id === roomId) {
          setInviteCode(code);
          setIsGenerating(false);
          setShareModalVisible(true);
        }
      }
    });

    // Clean up callback when component unmounts
    return () => {
      setInviteCallbacks({
        onInviteGenerated: undefined
      });
    };
  }, [roomId, setInviteCallbacks]);

  useEffect(() => {
    // Set the room name in the header
    navigation.setOptions({
      title: `#${roomName}`,
      headerRight: () => (
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareRoom}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color={COLORS.textPrimary} />
          ) : (
            <MaterialIcons name="share" size={24} color={COLORS.textPrimary} />
          )}
        </TouchableOpacity>
      )
    });
  }, [navigation, roomName, isGenerating]);

  // Function to handle generating an invite code
  const handleShareRoom = async () => {
    if (!roomId || !rpcClient) return;

    // If we already have an invite code, just show the modal
    if (inviteCode) {
      setShareModalVisible(true);
      return;
    }

    try {
      setIsGenerating(true);
      // Request invite code from backend
      const request = rpcClient.request('generateRoomInvite');
      await request.send(JSON.stringify({ roomId }));

      // The response will come through the onInviteGenerated callback

      // Add a timeout to prevent UI being stuck if something goes wrong
      setTimeout(() => {
        if (isGenerating) {
          console.log('Invite generation timed out');
          setIsGenerating(false);
        }
      }, 5000);
    } catch (error) {
      console.error('Error generating invite code:', error);
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Text style={styles.roomTitle}>#{roomName}</Text>
      <ShareRoomModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        inviteCode={inviteCode}
        roomName={roomName}
      />
    </>
  );
};

const styles = StyleSheet.create({
  shareButton: {
    marginRight: 16,
    padding: 4,
  },
});

export default RoomHeader;

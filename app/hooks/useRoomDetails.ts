import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useChat } from './useChat';
import useUser from './useUser';
import useWorklet from './useWorklet';
import { useNavigation } from '@react-navigation/native';

/**
 * Hook for managing a room's detailed information including
 * shared media, files, members, and room actions
 */
export const useRoomDetails = (roomId: string) => {
  const { currentRoom, messagesByRoom, onlineUsers, leaveRoom } = useChat();
  const { user } = useUser();
  const { rpcClient } = useWorklet();
  const navigation = useNavigation();

  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);

  // Load room details data
  const loadRoomDetails = useCallback(async () => {
    if (!roomId) return;

    setIsLoading(true);

    try {
      // Find all media and files in messages
      const roomMessages = messagesByRoom[roomId] || [];
      const mediaItems: any[] = [];
      const fileItems: any[] = [];

      // Set of all member IDs who've sent messages
      const memberIds = new Set<string>();
      const members: any[] = [];

      // Process messages to extract data
      roomMessages.forEach(message => {
        // Track members who sent messages
        if (message.sender && !memberIds.has(message.sender)) {
          memberIds.add(message.sender);
          const isCurrentUser = user && user.id === message.sender;

          members.push({
            id: message.sender,
            username: message.sender, // In real app, resolve to actual username
            isOnline: onlineUsers.some(u => u.id === message.sender),
            isCurrentUser
          });
        }

        // Process message attachments
        if (message.hasAttachments && message.attachments) {
          let attachments = [];

          // Parse attachments if they're a string
          if (typeof message.attachments === 'string') {
            try {
              attachments = JSON.parse(message.attachments);

              if (typeof message.attachments === 'string') {
                attachments = JSON.parse(attachments)
              }
            } catch (e) {
              console.error('Error parsing attachments:', e);
              attachments = [];
            }
          } else if (Array.isArray(message.attachments)) {
            attachments = message.attachments;
          }

          // Categorize attachments as media or files
          if (attachments) {

            attachments.forEach(attachment => {
              if (!attachment || !attachment.name) return;

              const fileName = attachment.name.toLowerCase();
              const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isVideo = fileName.match(/\.(mp4|mov|avi|webm)$/i);
              const isAudio = fileName.match(/\.(mp3|wav|ogg|m4a)$/i);

              if (isImage || isVideo) {
                mediaItems.push({
                  ...attachment,
                  messageId: message.id,
                  sender: message.sender,
                  timestamp: message.timestamp,
                  type: isImage ? 'image' : 'video'
                });
              } else {
                fileItems.push({
                  ...attachment,
                  messageId: message.id,
                  sender: message.sender,
                  timestamp: message.timestamp,
                  type: isAudio ? 'audio' : 'file'
                });
              }
            });

          }
        }
      });

      // Combine parsed members with online users who haven't sent messages
      onlineUsers.forEach(onlineUser => {
        if (!memberIds.has(onlineUser.id)) {
          members.push({
            ...onlineUser,
            isCurrentUser: user && user.id === onlineUser.id
          });
        }
      });

      // Sort most recent first
      const sortByTimestamp = (a: any, b: any) => b.timestamp - a.timestamp;
      mediaItems.sort(sortByTimestamp);
      fileItems.sort(sortByTimestamp);

      // Update state with processed data
      setSharedMedia(mediaItems);
      setSharedFiles(fileItems);
      setRoomMembers(members);

      // Determine if current user is an admin
      // This is a simplified check. In a real app, you would check against
      // a proper admin/owner field in the room data
      if (currentRoom && user) {
        setIsAdmin(currentRoom.creator === user.id);
      }
    } catch (error) {
      console.error('Error loading room details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, messagesByRoom, onlineUsers, currentRoom, user]);

  // Handle leaving the room
  const handleLeaveRoom = useCallback(async () => {
    try {
      setIsLoading(true);
      await leaveRoom();
      // Navigate back to rooms list
      navigation.navigate('Rooms' as never);
      return true;
    } catch (error) {
      console.error('Error leaving room:', error);
      Alert.alert('Error', 'Failed to leave the room. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [leaveRoom, navigation]);

  // Generate and fetch room invite
  const getInviteCode = useCallback(async () => {
    if (!roomId || !rpcClient) {
      Alert.alert('Error', 'Cannot generate invite at this time');
      return null;
    }

    try {
      setIsLoading(true);

      // Check if current room already has an invite code
      if (currentRoom?.invite) {
        setIsLoading(false);
        return currentRoom.invite;
      }

      // Request new invite code from backend
      return new Promise((resolve) => {
        // Set up a callback to receive the invite code
        const onInviteGenerated = (id: string, code: string) => {
          if (id === roomId) {
            setIsLoading(false);
            resolve(code);
          }
        };

        // Register the callback
        if (rpcClient.setInviteCallbacks) {
          rpcClient.setInviteCallbacks({ onInviteGenerated });
        }

        // Request the invite
        const request = rpcClient.request('generateRoomInvite');
        request.send(JSON.stringify({ roomId }));

        // Add a timeout to prevent UI being stuck
        setTimeout(() => {
          setIsLoading(false);
          resolve(null);
        }, 10000);
      });
    } catch (error) {
      console.error('Error generating invite code:', error);
      setIsLoading(false);
      return null;
    }
  }, [roomId, rpcClient, currentRoom]);

  // Load data on initial mount
  useEffect(() => {
    if (roomId) {
      loadRoomDetails();
    }
  }, [roomId, loadRoomDetails]);

  return {
    // State
    currentRoom,
    sharedMedia,
    sharedFiles,
    roomMembers,
    isLoading,
    isAdmin,

    // Actions
    loadRoomDetails,
    handleLeaveRoom,
    getInviteCode,
    onlineUsers
  };
};

export default useRoomDetails;

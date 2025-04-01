// app/components/chat/Message.tsx - updated to use new attachment components
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatTimestamp } from '../../utils/helpers';
import { EnhancedFileAttachment, EnhancedImageAttachment } from './FileAttachments';
import { FileCacheManager } from '../../utils/FileCacheManager';

// Message component to render each chat message
const EnhancedMessage = ({ message, isOwnMessage, roomId }) => {
  if (!message) return null;

  // Parse attachments if present
  const hasAttachments = message.hasAttachments &&
    message.attachments !== undefined && message.attachments !== null;

  // Parse attachments if they're a string, ensure we always have an array
  let attachments = [];
  if (hasAttachments) {
    try {
      if (typeof message.attachments === 'string') {
        attachments = JSON.parse(message.attachments);
      } else if (Array.isArray(message.attachments)) {
        attachments = message.attachments;
      }

      // Ensure we have an array even after parsing
      if (!Array.isArray(attachments)) {
        attachments = JSON.parse(attachments);
      }
    } catch (error) {
      console.error('Error parsing attachments:', error, message.attachments);
      attachments = [];
    }
  }

  // Handler for attachment press
  const handleAttachmentPress = (attachment) => {
    console.log('Attachment pressed:', attachment);
    // In the future, this could show a detailed view or trigger a download
  };

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
    ]}>
      {!isOwnMessage && (
        <Text style={styles.messageSender}>{message.sender || 'Unknown'}</Text>
      )}

      <View style={[
        styles.messageContent,
        isOwnMessage ? styles.ownMessageContent : styles.otherMessageContent
      ]}>
        {/* Only show text content if there is some */}
        {message.content && (
          <Text style={styles.messageText}>{message.content}</Text>
        )}

        {/* Render attachments if present */}
        {hasAttachments && attachments.length > 0 && (
          <View style={styles.attachmentsContainer}>
            {attachments.map((attachment: any, index: any) => {
              if (!attachment || !attachment.name) {
                console.warn('Invalid attachment at index', index, attachment);
                return null;
              }

              // Generate a unique ID for this attachment
              const attachmentId = attachment.blobId || `attachment-${message.id}-${index}`;

              const isOwnFile = attachment.coreKey === message.roomBlobCoreKey;
              // Check if file is an image
              const isImage = FileCacheManager.isImageFile(attachment.name);

              return isImage ?
                <EnhancedImageAttachment
                  key={`img-${attachmentId}`}
                  handleAttachmentPress={() => handleAttachmentPress(attachment)}
                  attachment={attachment}
                  roomId={roomId}
                  isOwnFile={isOwnFile}
                /> :
                <EnhancedFileAttachment
                  key={`file-${attachmentId}`}
                  handleAttachmentPress={() => handleAttachmentPress(attachment)}
                  attachment={attachment}
                  roomId={roomId}
                  isOwnFile={isOwnFile}
                />;
            })}
          </View>
        )}
      </View>

      <Text style={[
        styles.messageTimestamp,
        isOwnMessage ? styles.ownMessageTimestamp : styles.otherMessageTimestamp
      ]}>
        {formatTimestamp(message.timestamp || Date.now())}
      </Text>
    </View>);
};

// System message component
export const SystemMessage = ({ message }) => {
  if (!message) return null;

  return (
    <View style={styles.systemMessageContainer}>
      <Text style={styles.systemMessageText}>{message.content || ''}</Text>
      <Text style={styles.systemMessageTimestamp}>
        {formatTimestamp(message.timestamp || Date.now())}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 6,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  messageContent: {
    padding: 10,
    borderRadius: 16,
  },
  ownMessageContent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageContent: {
    backgroundColor: COLORS.secondaryBackground,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  messageTimestamp: {
    fontSize: 10,
    marginTop: 2,
    alignSelf: 'flex-end',
    color: COLORS.textMuted,
  },
  ownMessageTimestamp: {
    color: COLORS.textSecondary,
  },
  otherMessageTimestamp: {
    color: COLORS.textMuted,
  },
  systemMessageContainer: {
    alignSelf: 'center',
    marginVertical: 10,
    backgroundColor: 'rgba(114, 137, 218, 0.1)',
    padding: 8,
    borderRadius: 12,
    marginHorizontal: 40,
  },
  systemMessageText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  systemMessageTimestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  attachmentsContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
  },
});

export default EnhancedMessage;

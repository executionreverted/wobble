// app/components/common/FileCacheInfo.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';
import * as FileSystem from 'expo-file-system';

const FileCacheInfo: React.FC = () => {
  const { getCacheInfo, clearCache } = useWorklet();
  const [cacheInfo, setCacheInfo] = useState({ size: 0, files: 0 });
  const [downloadsDirSize, setDownloadsDirSize] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh cache info
  useEffect(() => {
    const info = getCacheInfo();
    setCacheInfo(info);

    // Also get info about downloads directory
    checkDownloadsDir();
  }, [refreshKey]);

  // Get size of downloads directory
  const checkDownloadsDir = async () => {
    try {
      const downloadsDir = `${FileSystem.documentDirectory}roombase_downloads/`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);

      if (dirInfo.exists) {
        // On iOS we can get directory size directly
        if (Platform.OS === 'ios' && dirInfo.size) {
          setDownloadsDirSize(dirInfo.size);
        } else {
          // On Android we need to list files and sum sizes
          const files = await FileSystem.readDirectoryAsync(downloadsDir);
          let totalSize = 0;

          for (const file of files) {
            const fileInfo = await FileSystem.getInfoAsync(`${downloadsDir}${file}`);
            if (fileInfo.exists && fileInfo.size) {
              totalSize += fileInfo.size;
            }
          }

          setDownloadsDirSize(totalSize);
        }
      }
    } catch (error) {
      console.error('Error checking downloads directory:', error);
    }
  };

  // Format bytes to human-readable size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle cache clear button
  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear the temporary file cache? Downloaded files in your permanent storage will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            await clearCache();
            setRefreshKey(prev => prev + 1); // Refresh the display
          }
        }
      ]
    );
  };

  // Handle clearing downloads
  const handleClearDownloads = async () => {
    Alert.alert(
      'Clear Downloads',
      'Are you sure you want to clear all saved files in the downloads folder? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Downloads',
          style: 'destructive',
          onPress: async () => {
            try {
              const downloadsDir = `${FileSystem.documentDirectory}roombase_downloads/`;
              await FileSystem.deleteAsync(downloadsDir, { idempotent: true });
              await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
              setDownloadsDirSize(0);
              setRefreshKey(prev => prev + 1);
            } catch (error) {
              console.error('Error clearing downloads:', error);
              Alert.alert('Error', 'Failed to clear downloads folder');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Temporary Cache</Text>
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <MaterialIcons name="storage" size={24} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {formatSize(cacheInfo.size)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="folder" size={24} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {cacheInfo.files} {cacheInfo.files === 1 ? 'file' : 'files'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearCache}
        >
          <MaterialIcons name="cleaning-services" size={20} color={COLORS.textPrimary} />
          <Text style={styles.buttonText}>Clear Cache</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Saved Downloads</Text>
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <MaterialIcons name="save-alt" size={24} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {formatSize(downloadsDirSize)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.clearButton, styles.warningButton]}
          onPress={handleClearDownloads}
        >
          <MaterialIcons name="delete" size={20} color={COLORS.textPrimary} />
          <Text style={styles.buttonText}>Clear Downloads</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  infoSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: 8,
  },
  clearButton: {
    backgroundColor: COLORS.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  warningButton: {
    backgroundColor: COLORS.error,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
  }
});

export default FileCacheInfo;

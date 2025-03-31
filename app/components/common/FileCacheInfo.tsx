// Add this component to app/components/common/FileCacheInfo.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '../../hooks/useWorklet';

const FileCacheInfo: React.FC = () => {
  const { getCacheInfo, clearCache } = useWorklet();
  const [cacheInfo, setCacheInfo] = useState({ size: 0, files: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

  console.log(cacheInfo)
  // Refresh cache info
  useEffect(() => {
    const info = getCacheInfo();
    setCacheInfo(info);
  }, [refreshKey]);

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
      'Are you sure you want to clear the file cache? All cached files will be deleted.',
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

  return (
    <View style={styles.container}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
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
  buttonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
  }
});

export default FileCacheInfo;

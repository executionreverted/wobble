// app/utils/FileCacheManager.ts

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { getUTIForMimeType, createStableBlobId } from './helpers';

// File size constants
const SMALL_FILE_THRESHOLD = 2 * 1024 * 1024; // 2MB - for cache
const MEDIUM_FILE_THRESHOLD = 20 * 1024 * 1024; // 20MB - for temp storage
const CACHE_MAX_SIZE = 100 * 1024 * 1024; // 100MB max cache

// Cache directories
const CACHE_METADATA_KEY = '@roombase:fileCache';
const CACHE_DIR = `${FileSystem.cacheDirectory}roombase_cache/`;
const TEMP_DIR = `${FileSystem.cacheDirectory}roombase_temp/`;
const PREVIEWS_DIR = `${FileSystem.cacheDirectory}roombase_previews/`;
const DOWNLOADS_DIR = `${FileSystem.documentDirectory}roombase_downloads/`;

// Interface for file cache entry
interface FileCacheEntry {
  key: string;
  fileName: string;
  filePath: string;
  size: number;
  timestamp: number;
  mimeType: string;
  isPreview: boolean;
}

// Main cache manager class
export class FileCacheManager {
  private static instance: FileCacheManager;
  private initialized = false;
  private initializing = false;
  private initPromise: Promise<void> | null = null;
  private cacheMetadata: Record<string, FileCacheEntry> = {};
  private cacheSize = 0;

  // Get singleton instance
  static getInstance(): FileCacheManager {
    if (!FileCacheManager.instance) {
      FileCacheManager.instance = new FileCacheManager();
    }
    return FileCacheManager.instance;
  }

  // Private constructor to enforce singleton pattern
  private constructor() { }

  // Initialize cache system
  async initialize(): Promise<any> {
    if (this.initialized || this.initializing) {
      return this.initPromise;
    }

    this.initializing = true;
    this.initPromise = this._initializeInternal();
    await this.initPromise;
    this.initializing = false;
    this.initialized = true;
    return;
  }

  // Internal initialization logic
  private async _initializeInternal(): Promise<void> {
    try {
      // Ensure directories exist
      await this.ensureDirectoriesExist();

      // Load cache metadata
      const metadataString = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (metadataString) {
        this.cacheMetadata = JSON.parse(metadataString);

        // Calculate current cache size and verify files
        await this.reconcileCache();
      }

      console.log(`Cache initialized: ${Object.keys(this.cacheMetadata).length} files, ${(this.cacheSize / (1024 * 1024)).toFixed(2)}MB`);
    } catch (error) {
      console.error('Error initializing file cache:', error);
      // Reset cache on error
      this.cacheMetadata = {};
      this.cacheSize = 0;
      await AsyncStorage.removeItem(CACHE_METADATA_KEY);
    }
  }

  // Ensure all required directories exist
  private async ensureDirectoriesExist(): Promise<void> {
    const directories = [CACHE_DIR, TEMP_DIR, PREVIEWS_DIR, DOWNLOADS_DIR];

    for (const dir of directories) {
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    }
  }

  // Reconcile cache with actual files
  private async reconcileCache(): Promise<void> {
    const validMetadata: Record<string, FileCacheEntry> = {};
    let totalValidSize = 0;

    for (const [key, entry] of Object.entries(this.cacheMetadata)) {
      try {
        // Skip invalid entries
        if (!entry || !entry.filePath) continue;

        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(entry.filePath);

        if (fileInfo.exists && fileInfo.size > 0) {
          validMetadata[key] = {
            ...entry,
            size: fileInfo.size
          };
          totalValidSize += fileInfo.size;
        }
      } catch (error) {
        console.error(`Error checking file ${key}:`, error);
      }
    }

    // Update metadata
    this.cacheMetadata = validMetadata;
    this.cacheSize = totalValidSize;
    await this.saveMetadata();
  }

  // Save metadata to persistent storage
  private async saveMetadata(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(this.cacheMetadata));
    } catch (error) {
      console.error('Error saving cache metadata:', error);
    }
  }

  // Clean cache if it exceeds size limits
  private async cleanCache(): Promise<void> {
    if (this.cacheSize <= CACHE_MAX_SIZE * 0.8) return;

    // Get all entries sorted by timestamp (oldest first)
    const entries = Object.values(this.cacheMetadata)
      .sort((a, b) => a.timestamp - b.timestamp);

    let newSize = this.cacheSize;
    const newMetadata = { ...this.cacheMetadata };

    // Remove oldest files until we're under the limit
    for (const entry of entries) {
      if (newSize <= CACHE_MAX_SIZE * 0.7) break;

      try {
        await FileSystem.deleteAsync(entry.filePath, { idempotent: true });
        delete newMetadata[entry.key];
        newSize -= entry.size;
      } catch (error) {
        console.error(`Error removing file ${entry.fileName}:`, error);
      }
    }

    this.cacheMetadata = newMetadata;
    this.cacheSize = newSize;
    await this.saveMetadata();
  }

  // Store file in appropriate location based on size and type
  async storeFile(
    key: string,
    data: string,
    fileName: string,
    mimeType: string,
    isPreview: boolean = false,
    fileSize?: number
  ): Promise<{ path: string; cached: boolean }> {
    await this.initialize();

    // Determine actual size
    const estimatedSize = fileSize || Math.ceil(data.length * 0.75); // Base64 to binary estimation
    const isSmallFile = estimatedSize <= SMALL_FILE_THRESHOLD;

    // Determine appropriate directory
    let directory: string;
    let cached = false;

    if (isPreview) {
      directory = PREVIEWS_DIR;
      cached = true;
    } else if (isSmallFile) {
      directory = CACHE_DIR;
      cached = true;
    } else {
      directory = TEMP_DIR;
      cached = false;
    }

    // Create a unique filename
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9\._]/g, '_');
    const filePath = `${directory}${timestamp}_${safeFileName}`;

    try {
      // Write file to storage
      await FileSystem.writeAsStringAsync(filePath, data, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Get actual file size
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      const actualSize = fileInfo.size;

      // If it's a cached file, update metadata
      if (cached) {
        this.cacheMetadata[key] = {
          key,
          fileName,
          filePath,
          size: actualSize,
          timestamp,
          mimeType,
          isPreview
        };

        this.cacheSize += actualSize;
        await this.saveMetadata();

        // Clean cache if necessary
        await this.cleanCache();
      }

      return { path: filePath, cached };
    } catch (error) {
      console.error(`Error storing file ${fileName}:`, error);
      throw error;
    }
  }

  // Retrieve file data from cache
  async getFile(key: string): Promise<{
    data: string;
    mimeType: string;
    fileName: string;
    path: string;
  } | null> {
    await this.initialize();

    const entry = this.cacheMetadata[key];
    if (!entry) return null;

    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(entry.filePath);
      if (!fileInfo.exists || fileInfo.size === 0) {
        // Remove invalid entry
        delete this.cacheMetadata[key];
        this.cacheSize -= entry.size;
        await this.saveMetadata();
        return null;
      }

      // Read file data
      const data = await FileSystem.readAsStringAsync(entry.filePath, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Update timestamp to mark as recently used
      this.cacheMetadata[key] = {
        ...entry,
        timestamp: Date.now()
      };
      await this.saveMetadata();

      return {
        data,
        mimeType: entry.mimeType,
        fileName: entry.fileName,
        path: entry.filePath
      };
    } catch (error) {
      console.error(`Error reading file ${entry?.fileName}:`, error);
      return null;
    }
  }

  // Move file from temporary storage to permanent downloads
  async saveToPermanentStorage(path: string, fileName: string): Promise<string> {
    await this.initialize();

    const safeFileName = fileName.replace(/[^a-zA-Z0-9\._]/g, '_');
    let finalPath = `${DOWNLOADS_DIR}${safeFileName}`;

    // Check if file already exists, add number if needed
    let counter = 1;
    while (true) {
      const fileInfo = await FileSystem.getInfoAsync(finalPath);
      if (!fileInfo.exists) break;

      const ext = safeFileName.lastIndexOf('.');
      const baseName = ext !== -1 ? safeFileName.substring(0, ext) : safeFileName;
      const extension = ext !== -1 ? safeFileName.substring(ext) : '';
      finalPath = `${DOWNLOADS_DIR}${baseName}_${counter}${extension}`;
      counter++;
    }

    // Move/copy file
    try {
      await FileSystem.moveAsync({ from: path, to: finalPath });
      return finalPath;
    } catch (error) {
      // If moving fails, try copying
      try {
        const data = await FileSystem.readAsStringAsync(path, {
          encoding: FileSystem.EncodingType.Base64
        });
        await FileSystem.writeAsStringAsync(finalPath, data, {
          encoding: FileSystem.EncodingType.Base64
        });
        return finalPath;
      } catch (copyError) {
        console.error(`Error copying file ${fileName}:`, copyError);
        throw copyError;
      }
    }
  }

  // Save file to device's media library (for images/videos)
  async saveToMediaLibrary(path: string): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return false;

      const asset = await MediaLibrary.createAssetAsync(path);
      await MediaLibrary.createAlbumAsync('Roombase', asset, false);
      return true;
    } catch (error) {
      console.error('Error saving to media library:', error);
      return false;
    }
  }

  // Save file to device's downloads (Android) or share (iOS)
  async saveToDevice(path: string, fileName: string, mimeType: string): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // On iOS, use the sharing API
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, {
            mimeType,
            dialogTitle: `Share ${fileName}`,
            UTI: getUTIForMimeType(mimeType)
          });
          return true;
        }
        return false;
      } else if (Platform.OS === 'android') {
        // On Android, try to save to downloads
        try {
          // Try using SAF (Storage Access Framework)
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              mimeType
            );

            // Read file content
            const fileContent = await FileSystem.readAsStringAsync(path, {
              encoding: FileSystem.EncodingType.Base64
            });

            // Write to destination
            await FileSystem.StorageAccessFramework.writeAsStringAsync(
              destinationUri,
              fileContent,
              { encoding: FileSystem.EncodingType.Base64 }
            );

            return true;
          }
          return false;
        } catch (error) {
          console.error('Error saving file via SAF:', error);
          // Fallback to app's downloads directory
          const finalPath = await this.saveToPermanentStorage(path, fileName);
          return !!finalPath;
        }
      }
      return false;
    } catch (error) {
      console.error(`Error saving file ${fileName} to device:`, error);
      return false;
    }
  }

  // Share file using system share dialog
  async shareFile(path: string, mimeType: string): Promise<boolean> {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sharing file:', error);
      return false;
    }
  }

  async openFile(path: string, mimeType: string): Promise<boolean> {
    try {
      if (await Sharing.isAvailableAsync()) {
        // This will prompt the user to choose an app to open the file
        await Sharing.shareAsync(path, {
          mimeType,
          dialogTitle: 'Open with'
        });
        return true;
      } else {
        console.error('Sharing not available on this device');
        return false;
      }
    } catch (error) {
      console.error('Error opening file:', error);
      return false;
    }
  }

  // Clear all cache and temp files
  async clearCache(): Promise<void> {
    try {
      // Delete cache and temp directories
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await FileSystem.deleteAsync(TEMP_DIR, { idempotent: true });
      await FileSystem.deleteAsync(PREVIEWS_DIR, { idempotent: true });

      // Recreate directories
      await this.ensureDirectoriesExist();

      // Reset metadata
      this.cacheMetadata = {};
      this.cacheSize = 0;
      await AsyncStorage.removeItem(CACHE_METADATA_KEY);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Get cache statistics
  getCacheInfo(): { size: number; files: number } {
    return {
      size: this.cacheSize,
      files: Object.keys(this.cacheMetadata).length
    };
  }

  // Determine if a file is an image
  static isImageFile(fileName: string): boolean {
    const ext = fileName?.split('.')?.pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  }

  // Create a cache key based on roomId and blob reference
  static createCacheKey(roomId: string, blobId: any): string {
    const stableBlobId = createStableBlobId(blobId);
    return `${roomId}_${stableBlobId}`;
  }
}

// Export singleton instance
export default FileCacheManager.getInstance();

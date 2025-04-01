// app/utils/FileCacheManager.ts

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
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
    if (!entry) {
      console.log(`No cache entry found for key: ${key}`);
      return null;
    }

    console.log(`Getting file for key: ${key}, path: ${entry.filePath}`);

    try {
      // Check if file exists using FileSystem API
      const checkPath = async (path) => {
        try {
          const fileInfo = await FileSystem.getInfoAsync(path);
          return fileInfo.exists && fileInfo.size > 0;
        } catch (err) {
          console.log(`Error checking path: ${path}`, err.message);
          return false;
        }
      };

      // Prepare various potential paths to check
      const pathsToCheck = [entry.filePath];

      // Add versions with and without file:// prefix
      if (!entry.filePath.startsWith('file://')) {
        pathsToCheck.push(`file://${entry.filePath}`);
      } else {
        pathsToCheck.push(entry.filePath.substring(7));
      }

      // Find a valid path
      let validPath = null;
      for (const path of pathsToCheck) {
        const exists = await checkPath(path);
        if (exists) {
          console.log(`Found valid path: ${path}`);
          validPath = path;
          break;
        }
      }

      if (!validPath) {
        console.log(`No valid file path found for: ${entry.fileName}. Removing from cache.`);
        // Remove invalid entry
        delete this.cacheMetadata[key];
        this.cacheSize -= entry.size;
        await this.saveMetadata();
        return null;
      }

      // Read file data
      let fileData;
      try {
        fileData = await FileSystem.readAsStringAsync(validPath, {
          encoding: FileSystem.EncodingType.Base64
        });
        console.log(`Successfully read file: ${entry.fileName}, data length: ${fileData.length}`);
      } catch (readError) {
        console.error(`Error reading file: ${entry.fileName}`, readError);

        // On Android, attempt alternative reading method if possible
        if (Platform.OS === 'android') {
          try {
            console.log('Attempting alternate reading method');
            const response = await fetch(`file://${validPath}`);
            const blob = await response.blob();
            fileData = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const base64data = reader.result.split(',')[1];
                resolve(base64data);
              };
              reader.readAsDataURL(blob);
            });
            console.log(`Alternative read succeeded, data length: ${fileData.length}`);
          } catch (altReadError) {
            console.error('Alternative read failed:', altReadError);
            return null;
          }
        } else {
          return null;
        }
      }

      // Update timestamp to mark as recently used
      this.cacheMetadata[key] = {
        ...entry,
        timestamp: Date.now()
      };
      await this.saveMetadata();

      return {
        data: fileData,
        mimeType: entry.mimeType || 'application/octet-stream',
        fileName: entry.fileName || 'unknown_file',
        path: validPath
      };
    } catch (error) {
      console.error(`Comprehensive error getting file: ${entry?.fileName}`, error);
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
      console.log(`Attempting to save file: ${fileName} from path: ${path}`);

      // Verify file exists first with proper path handling
      let validPath = path;
      let fileExists = false;

      // Try different path formats (with and without file:// prefix)
      const pathsToTry = [
        path,
        path.startsWith('file://') ? path.substring(7) : `file://${path}`
      ];

      for (const testPath of pathsToTry) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(testPath);
          if (fileInfo.exists && fileInfo.size > 0) {
            validPath = testPath;
            fileExists = true;
            console.log(`Found valid file at: ${validPath}, size: ${fileInfo.size}`);
            break;
          }
        } catch (pathError) {
          console.log(`Error checking path ${testPath}:`, pathError.message);
        }
      }

      if (!fileExists) {
        console.error('File does not exist or is invalid');
        return false;
      }

      // Handle by file type
      const isVideo = fileName.match(/\.(mp4|mov|avi|mkv|webm)$/i);
      const isImage = FileCacheManager.isImageFile(fileName);
      const isAudio = fileName.match(/\.(mp3|wav|ogg|m4a)$/i);

      if (Platform.OS === 'android' && (isVideo || isImage || isAudio)) {
        try {
          // Get MediaLibrary permission
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            // Ensure the path is in the correct format
            const assetPath = validPath.startsWith('file://') ? validPath : `file://${validPath}`;

            console.log(`Creating media library asset at: ${assetPath}`);
            const asset = await MediaLibrary.createAssetAsync(assetPath);

            if (!asset) {
              throw new Error('Failed to create asset');
            }

            // Save to appropriate album
            let album = await MediaLibrary.getAlbumAsync('Roombase');
            if (!album) {
              album = await MediaLibrary.createAlbumAsync('Roombase', asset, false);
            } else {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }

            // Show success based on media type
            const mediaType = isVideo ? 'video' : isImage ? 'image' : 'audio';
            Alert.alert(
              "File Saved",
              `${fileName} has been saved to your Media Library in the Roombase album. You can access it from your Gallery/Photos app.`
            );
            return true;
          } else {
            throw new Error('Media Library permission denied');
          }
        } catch (mediaError) {
          console.error('Media library error:', mediaError);
          // Fall through to other methods
        }
      }

      // For Android, try with Storage Access Framework if media library fails
      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            // Create the file in the selected location
            const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              mimeType
            );

            // Prepare the content
            let fileContent;
            try {
              fileContent = await FileSystem.readAsStringAsync(validPath, {
                encoding: FileSystem.EncodingType.Base64
              });
            } catch (readError) {
              console.error('Error reading file for SAF:', readError);
              return false;
            }

            // Write to destination
            await FileSystem.StorageAccessFramework.writeAsStringAsync(
              destinationUri,
              fileContent,
              { encoding: FileSystem.EncodingType.Base64 }
            );

            Alert.alert(
              "File Saved",
              `${fileName} has been saved to your selected location`
            );
            return true;
          }
        } catch (safError) {
          console.error('SAF error:', safError);
        }
      }

      // Fall back to sharing intent
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(validPath, {
          mimeType: mimeType || 'application/octet-stream',
          dialogTitle: `Save ${fileName}`
        });
        return true;
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
      console.log(`Attempting to open file at path: ${path} with type: ${mimeType}`);

      if (Platform.OS === 'android') {
        // For Android, we need special handling
        try {
          let sharePath = path;

          // Ensure path has file:// prefix if needed
          if (!path.startsWith('file://') && !path.startsWith('content://')) {
            sharePath = `file://${path}`;
            console.log(`Modified path to: ${sharePath}`);
          }

          if (await Sharing.isAvailableAsync()) {
            console.log('Using Sharing.shareAsync to open file');
            await Sharing.shareAsync(sharePath, {
              mimeType: mimeType || 'application/octet-stream',
              dialogTitle: 'Open with'
            });
            return true;
          }
        } catch (shareError) {
          console.error('Error sharing file on Android:', shareError);

          // Try a different approach for opening - use IntentLauncher if available
          try {
            const IntentLauncher = require('expo-intent-launcher');
            console.log('Attempting to use IntentLauncher');

            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: path.startsWith('file://') ? path : `file://${path}`,
              type: mimeType || 'application/octet-stream',
              flags: 1 // FLAG_GRANT_READ_URI_PERMISSION
            });
            return true;
          } catch (intentError) {
            console.error('IntentLauncher error:', intentError);
          }
        }
      } else {
        // iOS or web
        if (await Sharing.isAvailableAsync()) {
          console.log('Using Sharing.shareAsync to open file');
          await Sharing.shareAsync(path, {
            mimeType,
            dialogTitle: 'Open with'
          });
          return true;
        }
      }

      console.log('No method available to open file');
      return false;
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

  async fileExists(key: string): Promise<boolean> {
    await this.initialize();

    // Check if entry exists in metadata
    const entry = this.cacheMetadata[key];
    if (!entry) return false;

    try {
      // Verify file actually exists on disk
      const fileInfo = await FileSystem.getInfoAsync(entry.filePath);
      return fileInfo.exists && fileInfo.size > 0;
    } catch (error) {
      console.error(`Error checking file existence for ${key}:`, error);
      return false;
    }
  }

  async getMetadata(key: string): Promise<{
    fileName: string;
    filePath: string;
    mimeType: string;
    isPreview: boolean;
    size: number;
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

      // Return metadata without loading file content
      return {
        fileName: entry.fileName,
        filePath: entry.filePath,
        mimeType: entry.mimeType,
        isPreview: entry.isPreview,
        size: fileInfo.size
      };
    } catch (error) {
      console.error(`Error getting metadata for ${key}:`, error);
      return null;
    }
  }

  async getFileData(key: string): Promise<string | null> {
    await this.initialize();

    const entry = this.cacheMetadata[key];
    if (!entry) return null;

    try {
      // Read file data
      return await FileSystem.readAsStringAsync(entry.filePath, {
        encoding: FileSystem.EncodingType.Base64
      });
    } catch (error) {
      console.error(`Error reading file data for ${key}:`, error);
      return null;
    }
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

  async ensureExternalStorageDir() {
    if (Platform.OS !== 'android') return DOWNLOADS_DIR;

    try {
      // For Android, try to use a more accessible location
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Media library permissions not granted, using app-specific directory');
        return DOWNLOADS_DIR;
      }

      // On Android with permission, use a directory in the Pictures folder
      const albumName = 'Roombase';
      const album = await MediaLibrary.getAlbumAsync(albumName);

      if (!album) {
        // Create the album if it doesn't exist
        const asset = await MediaLibrary.createAssetAsync(DOWNLOADS_DIR + 'placeholder.txt');
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
        // Delete the placeholder
        await FileSystem.deleteAsync(DOWNLOADS_DIR + 'placeholder.txt', { idempotent: true });
      }

      return DOWNLOADS_DIR; // We'll still download to our app dir, but then move/copy to shared storage
    } catch (error) {
      console.error('Error ensuring external storage:', error);
      return DOWNLOADS_DIR;
    }
  }


  async registerDownloadedFile(fileData) {
    const {
      attachmentKey,
      filePath,
      publicFilePath,
      fileName,
      mimeType,
      fileSize,
      preview
    } = fileData;

    if (!attachmentKey) {
      console.error('Missing attachmentKey for registerDownloadedFile');
      return false;
    }

    try {
      console.log('Registering downloaded file:', {
        attachmentKey,
        filePath,
        publicFilePath,
        fileName
      });

      // Try to find a valid path that exists
      let validPath = null;
      let validSize = fileSize || 0;

      // Check paths with and without file:// prefix
      const pathsToCheck = [];

      // Add all possible paths to check
      if (filePath) {
        pathsToCheck.push(filePath);
        if (!filePath.startsWith('file://')) pathsToCheck.push(`file://${filePath}`);
      }

      if (publicFilePath) {
        pathsToCheck.push(publicFilePath);
        if (!publicFilePath.startsWith('file://')) pathsToCheck.push(`file://${publicFilePath}`);
      }

      // Add paths without file:// prefix if they have it
      if (filePath && filePath.startsWith('file://')) {
        pathsToCheck.push(filePath.substring(7));
      }

      if (publicFilePath && publicFilePath.startsWith('file://')) {
        pathsToCheck.push(publicFilePath.substring(7));
      }

      console.log('Checking paths:', pathsToCheck);

      // Check each path in order
      for (const pathToCheck of pathsToCheck) {
        try {
          console.log(`Checking path: ${pathToCheck}`);
          const fileInfo = await FileSystem.getInfoAsync(pathToCheck);

          if (fileInfo.exists && fileInfo.size > 0) {
            console.log(`Valid file found at: ${pathToCheck}, size: ${fileInfo.size}`);
            validPath = pathToCheck;
            validSize = fileInfo.size || validSize;
            break;
          } else {
            console.log(`Path exists but invalid: ${pathToCheck}`);
          }
        } catch (checkError) {
          console.log(`Error checking path: ${pathToCheck}`, checkError.message);
          // Continue to the next path
        }
      }

      // If no valid path found, try one more approach with native filesystem (for Android)
      if (!validPath && Platform.OS === 'android') {
        // On Android, these paths might not be accessible through Expo's FileSystem
        // but might be valid for the native filesystem
        console.log('No valid path found via FileSystem API, trying direct registration');

        // Prefer the public path if available
        if (publicFilePath) {
          console.log(`Using public path directly: ${publicFilePath}`);
          validPath = publicFilePath;
        } else if (filePath) {
          console.log(`Using original path directly: ${filePath}`);
          validPath = filePath;
        }
      }

      if (!validPath) {
        console.error('File not found in any path');
        return false;
      }

      // Register the file directly with the found path
      return await this.registerExternalFile(
        attachmentKey,
        validPath,
        fileName || 'unknown_file',
        mimeType || 'application/octet-stream',
        validSize,
        preview || false
      );
    } catch (error) {
      console.error('Error registering downloaded file:', error);
      return false;
    }
  }


  async registerExternalFile(
    key: string,
    existingPath: string,
    fileName: string,
    mimeType: string,
    fileSize: number,
    isPreview: boolean = false
  ): Promise<boolean> {
    await this.initialize();

    try {
      console.log(`Registering external file: ${fileName} at path: ${existingPath}`);

      // Add to cache metadata without requiring file existence check
      // This makes our caching system more robust on Android where
      // FileSystem.getInfoAsync might fail but the file still exists
      this.cacheMetadata[key] = {
        key,
        fileName,
        filePath: existingPath,
        size: fileSize || 0,
        timestamp: Date.now(),
        mimeType: mimeType || 'application/octet-stream',
        isPreview: isPreview || false
      };

      this.cacheSize += fileSize || 0;
      await this.saveMetadata();

      console.log(`Successfully registered ${fileName} in cache metadata`);

      // Clean cache if necessary
      await this.cleanCache();

      return true;
    } catch (error) {
      console.error(`Error registering external file:`, error);
      return false;
    }
  }
}

// Export singleton instance
export default FileCacheManager.getInstance();

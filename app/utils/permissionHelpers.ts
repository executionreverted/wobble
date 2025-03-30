// app/utils/permissionHelpers.ts

import { Platform, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';

export const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return true;

  const { status: existingStatus } = await ImagePicker.getCameraPermissionsAsync();

  if (existingStatus === 'granted') return true;

  const { status } = await ImagePicker.requestCameraPermissionsAsync();

  if (status !== 'granted') {
    Alert.alert(
      'Camera Permission',
      'We need camera access to take photos for sharing in chats.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings()
        },
      ]
    );
    return false;
  }

  return true;
};

export const requestMediaLibraryPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return true;

  const { status: existingStatus } = await MediaLibrary.getPermissionsAsync();

  if (existingStatus === 'granted') return true;

  const { status } = await MediaLibrary.requestPermissionsAsync();

  if (status !== 'granted') {
    Alert.alert(
      'Media Library Permission',
      'We need access to your media library to save and share photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings()
        },
      ]
    );
    return false;
  }

  return true;
};

// Helper for selecting images that handles permissions
export const selectImage = async (options?: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> => {
  if (Platform.OS !== 'web') {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      return { canceled: true, assets: [] } as any;
    }
  }

  return await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos", "livePhotos"],
    allowsEditing: true,
    quality: 0.8,
    ...options
  });
};

// Helper for taking photos that handles permissions
export const takePhoto = async (options?: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> => {
  if (Platform.OS !== 'web') {
    const hasCameraPermission = await requestCameraPermission();
    if (!hasCameraPermission) {
      return { canceled: true, assets: [] } as any;
    }
  }

  return await ImagePicker.launchCameraAsync({
    mediaTypes: ["images", "videos", "livePhotos"],
    allowsEditing: true,
    quality: 0.8,
    ...options
  });
};

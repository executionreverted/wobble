import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '@/app/hooks/useWorklet';
import useUser from '@/app/hooks/useUser';

const SeedPhraseLogin = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Checking for existing account...');
  const navigation = useNavigation();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { generateSeedPhrase, confirmSeedPhrase, checkExistingUser } = useWorklet()
  const { seedPhrase } = useUser()
  const [navigated, setNavigated] = useState(false)
  const [checkedExisting, setCheckedExisting] = useState(false)


  useEffect(() => {
    if (!navigated && user) {
      console.log(user)
      console.log('User detected, navigating to MainTabs');
      setNavigated(true);
      navigation.navigate('MainTabs');
    }
  }, [user, navigated, navigation]);

  const checkForUser = async () => {
    try {

      const result = await checkExistingUser();
      console.log('User check result:', result);

      await generatePhrase();
      // If user exists, the updateUser callback in WorkletContext will be called
      // which will trigger the navigation effect above
    } catch (error) {
      console.error('Error checking for user:', error);
      // Fall back to generating a new phrase
      console.log('Error during user check, falling back to seed generation');
      setLoadingMessage('Generating new seed phrase...');
      await generatePhrase();
    } finally {
      setCheckedExisting(true);
    }
  }
  useEffect(() => {
    if (!checkedExisting) {
      checkForUser();
    }
  }, [checkedExisting]);

  useEffect(() => {
    if (!navigated && user) {
      console.log('User detected, navigating to MainTabs');
      setNavigated(true);
      navigation.navigate('MainTabs');
    }
  }, [user, navigated, navigation]);

  // Fix the generatePhrase function
  const generatePhrase = async () => {
    setIsLoading(true);
    try {
      console.log('Requesting seed phrase generation');
      await generateSeedPhrase();

      // Set a maximum wait time of 3 seconds before showing the UI anyway
      setTimeout(() => {
        console.log('Timeout reached, showing seed UI');
        setIsLoading(false);
      }, 3000);

      // Still check for the seed earlier if it arrives
      const checkForSeed = () => {
        if (seedPhrase && seedPhrase.length > 0) {
          console.log('Seed phrase received, showing UI');
          setIsLoading(false);
        }
      };

      // Check every 500ms
      const interval = setInterval(checkForSeed, 500);
      setTimeout(() => clearInterval(interval), 3500);

    } catch (error) {
      console.error('Error generating seed phrase:', error);
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    generatePhrase();
  };

  const handleConfirm = async () => {
    try {
      if (!seedPhrase || seedPhrase.length === 0) {
        throw new Error("No seed phrase available");
      }

      setIsLoading(true);
      setLoadingMessage('Creating your account...');

      const result = await confirmSeedPhrase(seedPhrase);

      // Let the WorkletContext handle the rest
      console.log('Seed phrase confirmed successfully, waiting for user setup');

      // We don't need to set loading to false because
      // the component will unmount when navigation happens
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Failed to create account. Please try again.');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.logo}>roombase</Text>
        </View>

        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>roombase</Text>
        <Text style={styles.title}>Your Seed Phrase</Text>
        <Text style={styles.subtitle}>
          This is your unique 20-word recovery phrase. Write it down and keep it safe.
        </Text>
      </View>

      <View style={styles.seedContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Generating seed phrase...</Text>
          </View>
        ) : (
          <ScrollView style={styles.seedScrollView}>
            <View style={styles.seedGrid}>
              {seedPhrase?.map((word, index) => (
                <View key={index} style={styles.wordContainer}>
                  <Text style={styles.wordNumber}>{index + 1}.</Text>
                  <Text style={styles.word}>{word}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.warningContainer}>
        <MaterialIcons name="warning" size={24} color={COLORS.warning} style={styles.warningIcon} />
        <Text style={styles.warningText}>
          Never share your seed phrase with anyone. Anyone with these words can access your account.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={20} color={COLORS.textPrimary} />
          <Text style={styles.refreshButtonText}>Generate New</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>I've Saved My Seed Phrase</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  seedContainer: {
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    height: 300,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  spinner: {
    marginBottom: 20,
  },
  seedScrollView: {
    flex: 1,
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordContainer: {
    flexDirection: 'row',
    width: '48%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginVertical: 4,
    backgroundColor: COLORS.tertiaryBackground,
    borderRadius: 6,
    alignItems: 'center',
  },
  wordNumber: {
    color: COLORS.textMuted,
    fontSize: 12,
    width: 20,
  },
  word: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(250, 166, 26, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  warningIcon: {
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    marginTop: 30,
  },
  refreshButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  refreshButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
export default SeedPhraseLogin;

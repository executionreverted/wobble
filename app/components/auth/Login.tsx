import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import useWorklet from '@/app/hooks/useWorklet';
import useUser from '@/app/hooks/useUser';

const SeedPhraseLogin = () => {
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { generateSeedPhrase, confirmSeedPhrase } = useWorklet()
  const { seedPhrase } = useUser()
  const [navigated, setNavigated] = useState(false)


  useEffect(() => {
    if (!navigated && user) {
      setNavigated(true)
      navigation.navigate('MainTabs');
    }
  }, [user])


  useEffect(() => {
    generatePhrase();
  }, []);

  const generatePhrase = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, we would call the backend via IPC RPC
      // For demo purposes, we'll generate a mock seed phrase
      await generateSeedPhrase()
    } catch (error) {
      console.error('Error generating seed phrase:', error);
      Alert.alert('Error', 'Failed to generate seed phrase. Please try again.');
      setIsLoading(false)
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    generatePhrase();
  };

  const handleConfirm = async () => {
    // In a real implementation, we would store the seed phrase
    // For now, we'll just log in the user
    try {
      if (!seedPhrase || seedPhrase.length == 0) {
        throw new Error("Invalid seed")
      }
      await confirmSeedPhrase(seedPhrase)
      // @ts-ignore
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Failed to log in. Please try again.');
    }
  };



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
              {seedPhrase.map((word, index) => (
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
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

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';

interface LoginProps {
  onRegisterPress: () => void;
}

const Login: React.FC<LoginProps> = ({ onRegisterPress }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(username);
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat App</Text>
      <Text style={styles.subtitle}>Login to your account</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Enter your username"
          placeholderTextColor="#999"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={onRegisterPress}>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#36393f',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#b9bbbe',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#40444b',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#7289da',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ed4245',
    marginBottom: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: '#b9bbbe',
    marginRight: 5,
  },
  registerLink: {
    color: '#7289da',
    fontWeight: 'bold',
  },
});

export default Login;

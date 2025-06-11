import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { supabase } from '../config/supabase';

export default function AuthScreen() {
  // Estados para manejar los campos del formulario
  // Separamos email y contraseña para facilitar la validación individual
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Estado para alternar entre modo de inicio de sesión y registro
  // Esto nos permite usar una sola pantalla para ambas funcionalidades
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Estado para manejar indicadores de carga durante las operaciones asíncronas
  // Esto mejora la experiencia de usuario mostrando feedback visual durante la espera
  const [loading, setLoading] = useState(false);

  // Función para manejar el registro de nuevos usuarios
  // Esta función coordina tanto la creación de la cuenta como la configuración inicial del perfil
const handleSignUp = async () => {
  // Toda tu validación existente permanece igual...
  
  if (!email || !password || !username || !fullName) {
    Alert.alert('Error', 'Por favor completa todos los campos');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    Alert.alert('Error', 'Por favor ingresa un email válido');
    return;
  }

  if (password.length < 6) {
    Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
    return;
  }

  setLoading(true);
  
  try {
    console.log('🔐 Iniciando proceso de registro para:', email.trim().toLowerCase());
    console.log('🔐 Datos a enviar:', {
      email: email.trim().toLowerCase(),
      username: username.trim(),
      full_name: fullName.trim()
    });

    // Intentamos crear la cuenta
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password,
      options: {
        data: {
          username: username.trim(),
          full_name: fullName.trim(),
        }
      }
    });

    console.log('🔐 Respuesta de Supabase Auth:', { data, error });

    if (error) {
      console.error('❌ Error específico de Supabase Auth:', {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        details: error
      });
      
      // Proporcionamos mensajes de error más específicos
      if (error.message.includes('rate limit')) {
        Alert.alert('Error', 'Demasiados intentos de registro. Espera unos minutos e intenta nuevamente.');
      } else if (error.message.includes('already registered')) {
        Alert.alert('Error', 'Este email ya está registrado. ¿Quizás quieres iniciar sesión en su lugar?');
      } else if (error.message.includes('invalid email')) {
        Alert.alert('Error', 'El formato del email no es válido.');
      } else if (error.message.includes('weak password')) {
        Alert.alert('Error', 'La contraseña es demasiado débil. Intenta con una contraseña más segura.');
      } else {
        Alert.alert('Error de Registro', `Error detallado: ${error.message}`);
      }
      return;
    }

    console.log('✅ Cuenta de autenticación creada exitosamente');
    
    // Si llegamos aquí, la cuenta se creó exitosamente
    Alert.alert(
      'Registro Exitoso', 
      'Por favor verifica tu email antes de iniciar sesión. Revisa tu bandeja de entrada y spam.',
      [{ text: 'OK', onPress: () => setIsSignUp(false) }]
    );

  } catch (error) {
    console.error('💥 Error inesperado durante el registro:', {
      message: error.message,
      stack: error.stack,
      error: error
    });
    Alert.alert('Error Inesperado', `Ocurrió un error inesperado: ${error.message}. Por favor contacta soporte si el problema persiste.`);
  } finally {
    setLoading(false);
  }
};
  // Función para manejar el inicio de sesión de usuarios existentes
  // Esta función es más simple que el registro porque no requiere creación de perfil
  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa email y contraseña');
      return;
    }

    setLoading(true);

    try {
      // Intentamos autenticar al usuario con las credenciales proporcionadas
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        // Proporcionamos mensajes de error específicos para mejorar la experiencia de usuario
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert('Error', 'Email o contraseña incorrectos');
        } else if (error.message.includes('Email not confirmed')) {
          Alert.alert('Error', 'Por favor verifica tu email antes de iniciar sesión');
        } else {
          Alert.alert('Error de Inicio de Sesión', error.message);
        }
        return;
      }

      // Si llegamos aquí, el inicio de sesión fue exitoso
      // No necesitamos navegación manual porque nuestro componente principal manejará el cambio de estado
      console.log('Inicio de sesión exitoso para:', data.user.email);

    } catch (error) {
      Alert.alert('Error', 'Ocurrió un error inesperado. Intenta nuevamente.');
      console.error('Error de inicio de sesión:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función que alterna entre los modos de registro e inicio de sesión
  // También limpia los campos específicos del registro cuando cambiamos a inicio de sesión
  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    // Limpiamos los campos específicos del registro cuando cambiamos a inicio de sesión
    if (isSignUp) {
      setUsername('');
      setFullName('');
    }
  };

  

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          {/* Header dinámico que cambia según el modo */}
          <Text style={styles.title}>
            {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp 
              ? 'Únete a la comunidad de hábitos saludables' 
              : 'Bienvenido de vuelta'
            }
          </Text>

          {/* Campos específicos del registro */}
          {isSignUp && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nombre de usuario"
                value={username}
                onChangeText={setUsername}
                placeholderTextColor="#95a5a6"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Nombre completo"
                value={fullName}
                placeholderTextColor="#95a5a6"
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </>
          )}

          {/* Campos comunes para registro e inicio de sesión */}
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor="#95a5a6"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            value={password}
            placeholderTextColor="#95a5a6"
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {/* Botón principal de acción */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Procesando...' : (isSignUp ? 'Registrarse' : 'Iniciar Sesión')}
            </Text>
          </TouchableOpacity>

          {/* Botón para alternar entre modos */}
          <TouchableOpacity style={styles.secondaryButton} onPress={toggleMode}>
            <Text style={styles.secondaryButtonText}>
              {isSignUp 
                ? '¿Ya tienes cuenta? Inicia sesión' 
                : '¿No tienes cuenta? Regístrate'
              }
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Estilos que crean una interfaz limpia y profesional para la autenticación
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
  },
  primaryButton: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    alignItems: 'center',
    padding: 10,
  },
  secondaryButtonText: {
    color: '#3498db',
    fontSize: 16,
  },
});
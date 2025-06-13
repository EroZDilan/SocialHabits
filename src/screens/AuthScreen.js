import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Keyboard,
  Platform,
  Dimensions
} from 'react-native';
import { supabase } from '../config/supabase';

// Obtenemos las dimensiones de la pantalla para cálculos de layout
const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function AuthScreen() {
  // =====================================================
  // 🏗️ ESTADOS PRINCIPALES DE AUTENTICACIÓN
  // =====================================================
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // =====================================================
  // 🎯 ESTADOS AVANZADOS PARA GESTIÓN DE TECLADO
  // =====================================================
  // Estos estados nos permiten crear una experiencia de teclado más inteligente
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [activeFieldIndex, setActiveFieldIndex] = useState(-1);
  
  // Referencias para controlar la navegación y el scroll
  const scrollViewRef = useRef(null);
  const inputRefs = useRef([]);
  
  // =====================================================
  // 🎧 CONFIGURACIÓN DE LISTENERS DEL TECLADO
  // =====================================================
  useEffect(() => {
    // Configuramos listeners diferentes según la plataforma
    // iOS tiene eventos "Will" que nos permiten prepararnos antes del cambio
    // Android tiene eventos "Did" que nos notifican después del cambio
    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const keyboardShowListener = Keyboard.addListener(keyboardShowEvent, handleKeyboardShow);
    const keyboardHideListener = Keyboard.addListener(keyboardHideEvent, handleKeyboardHide);

    // Función de limpieza que se ejecuta cuando el componente se desmonta
    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  // =====================================================
  // 🔧 FUNCIONES DE GESTIÓN INTELIGENTE DEL TECLADO
  // =====================================================
  
  // Esta función se ejecuta cuando el teclado aparece
  const handleKeyboardShow = (event) => {
    const { height } = event.endCoordinates;
    setKeyboardHeight(height);
    setIsKeyboardVisible(true);
    
    // Implementamos un retraso pequeño para permitir que el teclado termine de aparecer
    // antes de hacer ajustes de scroll. Esto previene el rebote.
    setTimeout(() => {
      adjustScrollForActiveField(height);
    }, Platform.OS === 'ios' ? 0 : 100);
  };

  // Esta función se ejecuta cuando el teclado desaparece
  const handleKeyboardHide = () => {
    setKeyboardHeight(0);
    setIsKeyboardVisible(false);
    setActiveFieldIndex(-1);
    
    // Opcionalmente, podemos hacer scroll de vuelta al principio
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  // Función inteligente que calcula exactamente cuánto hacer scroll
  const adjustScrollForActiveField = (keyboardHeight) => {
    if (activeFieldIndex >= 0 && inputRefs.current[activeFieldIndex] && scrollViewRef.current) {
      // Medimos la posición exacta del campo activo en la pantalla
      inputRefs.current[activeFieldIndex].measureInWindow((x, y, width, height) => {
        const fieldBottom = y + height;
        const visibleScreenHeight = screenHeight - keyboardHeight;
        const bufferSpace = 50; // Espacio extra para que el campo no quede pegado al teclado
        
        // Solo hacemos scroll si el campo está siendo tapado por el teclado
        if (fieldBottom > visibleScreenHeight - bufferSpace) {
          const scrollAmount = fieldBottom - visibleScreenHeight + bufferSpace;
          scrollViewRef.current.scrollTo({
            y: scrollAmount,
            animated: true
          });
        }
      });
    }
  };

  // =====================================================
  // 🎯 FUNCIONES DE NAVEGACIÓN ENTRE CAMPOS
  // =====================================================
  
  // Función que se ejecuta cuando un campo recibe el foco
  const handleInputFocus = (index) => {
    setActiveFieldIndex(index);
    
    // Si el teclado ya está visible, ajustamos inmediatamente
    if (isKeyboardVisible) {
      setTimeout(() => adjustScrollForActiveField(keyboardHeight), 100);
    }
  };

  // Función para navegar al siguiente campo automáticamente
  const goToNextField = (currentIndex) => {
    const nextIndex = currentIndex + 1;
    const totalFields = isSignUp ? 4 : 2; // 4 campos en registro, 2 en inicio de sesión
    
    if (nextIndex < totalFields && inputRefs.current[nextIndex]) {
      inputRefs.current[nextIndex].focus();
    } else {
      // Si llegamos al último campo, ocultamos el teclado
      Keyboard.dismiss();
    }
  };

  // =====================================================
  // 🔐 FUNCIONES DE AUTENTICACIÓN
  // =====================================================
  
  // Función mejorada para manejar el registro con mejor manejo de errores
  const handleSignUp = async () => {
    // Validación previa más robusta
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

    // Ocultamos el teclado antes de comenzar el proceso
    Keyboard.dismiss();
    setLoading(true);
    
    try {
      console.log('🔐 Iniciando proceso de registro para:', email.trim().toLowerCase());

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

      if (error) {
        console.error('❌ Error de registro:', error);
        
        // Proporcionamos mensajes de error más específicos y útiles
        if (error.message.includes('rate limit')) {
          Alert.alert('Error', 'Demasiados intentos de registro. Espera unos minutos e intenta nuevamente.');
        } else if (error.message.includes('already registered')) {
          Alert.alert('Error', 'Este email ya está registrado. ¿Quizás quieres iniciar sesión en su lugar?');
        } else if (error.message.includes('invalid email')) {
          Alert.alert('Error', 'El formato del email no es válido.');
        } else if (error.message.includes('weak password')) {
          Alert.alert('Error', 'La contraseña es demasiado débil. Intenta con una contraseña más segura.');
        } else {
          Alert.alert('Error de Registro', error.message);
        }
        return;
      }

      console.log('✅ Cuenta creada exitosamente');
      
      Alert.alert(
        'Registro Exitoso', 
        'Por favor verifica tu email antes de iniciar sesión. Revisa tu bandeja de entrada y spam.',
        [{ text: 'OK', onPress: () => setIsSignUp(false) }]
      );

    } catch (error) {
      console.error('💥 Error inesperado en registro:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Función mejorada para manejar el inicio de sesión
  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa email y contraseña');
      return;
    }

    // Ocultamos el teclado antes de comenzar el proceso
    Keyboard.dismiss();
    setLoading(true);

    try {
      console.log('🔐 Iniciando sesión para:', email.trim().toLowerCase());

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        console.error('❌ Error de inicio de sesión:', error);
        
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert('Error', 'Email o contraseña incorrectos');
        } else if (error.message.includes('Email not confirmed')) {
          Alert.alert('Error', 'Por favor verifica tu email antes de iniciar sesión');
        } else {
          Alert.alert('Error de Inicio de Sesión', error.message);
        }
        return;
      }

      console.log('✅ Inicio de sesión exitoso');

    } catch (error) {
      console.error('💥 Error inesperado en inicio de sesión:', error);
      Alert.alert('Error', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // 🔄 FUNCIONES DE CONTROL DE INTERFAZ
  // =====================================================
  
  const toggleMode = () => {
    // Ocultamos el teclado cuando cambiamos de modo
    Keyboard.dismiss();
    
    setIsSignUp(!isSignUp);
    if (isSignUp) {
      setUsername('');
      setFullName('');
    }
    
    // Limpiamos el índice del campo activo
    setActiveFieldIndex(-1);
    
    // Hacemos scroll al principio de la pantalla
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContainer,
          {
            // Ajustamos el padding inferior cuando el teclado está visible
            paddingBottom: isKeyboardVisible ? Math.max(keyboardHeight, 20) : 20
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false} // Elimina el rebote en iOS que puede causar problemas
        scrollEventThrottle={16} // Mejora la suavidad del scroll
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
                ref={(ref) => inputRefs.current[0] = ref}
                style={styles.input}
                placeholder="Nombre de usuario"
                value={username}
                onChangeText={setUsername}
                placeholderTextColor="#95a5a6"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => handleInputFocus(0)}
                onSubmitEditing={() => goToNextField(0)}
                blurOnSubmit={false}
              />
              <TextInput
                ref={(ref) => inputRefs.current[1] = ref}
                style={styles.input}
                placeholder="Nombre completo"
                value={fullName}
                placeholderTextColor="#95a5a6"
                onChangeText={setFullName}
                autoCapitalize="words"
                returnKeyType="next"
                onFocus={() => handleInputFocus(1)}
                onSubmitEditing={() => goToNextField(1)}
                blurOnSubmit={false}
              />
            </>
          )}

          {/* Campos comunes para registro e inicio de sesión */}
          <TextInput
            ref={(ref) => inputRefs.current[isSignUp ? 2 : 0] = ref}
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor="#95a5a6"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onFocus={() => handleInputFocus(isSignUp ? 2 : 0)}
            onSubmitEditing={() => goToNextField(isSignUp ? 2 : 0)}
            blurOnSubmit={false}
          />
          
          <TextInput
            ref={(ref) => inputRefs.current[isSignUp ? 3 : 1] = ref}
            style={styles.input}
            placeholder="Contraseña"
            value={password}
            placeholderTextColor="#95a5a6"
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType={isSignUp ? "done" : "go"}
            onFocus={() => handleInputFocus(isSignUp ? 3 : 1)}
            onSubmitEditing={() => {
              Keyboard.dismiss();
              isSignUp ? handleSignUp() : handleSignIn();
            }}
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
    </View>
  );
}

// =====================================================
// 🎨 ESTILOS OPTIMIZADOS PARA GESTIÓN DE TECLADO
// =====================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    minHeight: screenHeight - 100, // Altura mínima para evitar problemas de layout
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
    // Añadimos un margen inferior para evitar que se pegue al teclado
    marginBottom: 20,
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
    // Añadimos una altura mínima para mejorar la experiencia táctil
    minHeight: 50,
  },
  primaryButton: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
    // Añadimos una altura mínima para mejorar la accesibilidad
    minHeight: 50,
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
    minHeight: 40,
  },
  secondaryButtonText: {
    color: '#3498db',
    fontSize: 16,
  },
});
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Importamos nuestro proveedor de autenticación y el hook para acceder al estado
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';

// Componente principal que decide qué interfaz mostrar basándose en el estado de autenticación
// Este componente debe estar dentro del AuthProvider para acceder al contexto de autenticación
function AppContent() {
  // Accedemos al estado de autenticación usando nuestro hook personalizado
  const { user, loading } = useAuth();

  // Mientras verificamos el estado de autenticación inicial, mostramos un indicador de carga
  // Esto previene mostrar la pantalla incorrecta durante la verificación de sesión existente
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  // Si hay un usuario autenticado, mostramos la aplicación principal con navegación
  // Si no hay usuario autenticado, mostramos la pantalla de autenticación
  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthScreen />}
    </NavigationContainer>
  );
}

// Componente raíz que envuelve toda la aplicación con el proveedor de autenticación
// Este es el punto de entrada principal de tu aplicación
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Estilos para la pantalla de carga que aparece durante la verificación inicial de autenticación
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
});
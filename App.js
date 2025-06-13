import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native'; // 🔥 IMPORTACIÓN CLAVE
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import AppNavigator from './src/navigation/AppNavigator';
import CustomSplashScreen from './src/screens/SplashScreen';

// Prevenir que la splash screen nativa se oculte automáticamente
SplashScreen.preventAutoHideAsync();

// 🎯 COMPONENTE INTERNO PARA MANEJAR LA LÓGICA DE AUTENTICACIÓN
// Separamos esta lógica porque necesita acceso al contexto de autenticación
function AppContent() {
  const { user, loading } = useAuth();

  // 🔧 LÓGICA DE RENDERIZADO CONDICIONAL
  // Si estamos cargando la sesión, no renderizamos nada (el splash se encarga)
  if (loading) {
    return null;
  }

  // 🚪 DECISIÓN DE NAVEGACIÓN BASADA EN AUTENTICACIÓN
  // Si no hay usuario autenticado, mostramos la pantalla de login
  // Si hay usuario, mostramos la navegación principal de la app
  return user ? <AppNavigator /> : <AuthScreen />;
}

// 🏗️ COMPONENTE PRINCIPAL DE LA APLICACIÓN
export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // 🔄 SIMULACIÓN DE CARGA DE RECURSOS
        // En una app real, aquí cargarías fuentes, imágenes, o datos iniciales
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // ✅ MARCAR APP COMO LISTA
        setIsAppReady(true);
        
        // 👋 OCULTAR SPLASH SCREEN NATIVA
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Error durante la inicialización:', e);
        setIsAppReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // 🎬 FUNCIÓN DE CALLBACK PARA TERMINAR SPLASH PERSONALIZADA
  const handleSplashComplete = () => {
    setShowCustomSplash(false);
  };

  // 🖼️ MOSTRAR SPLASH PERSONALIZADA MIENTRAS LA APP NO ESTÉ LISTA
  if (!isAppReady || showCustomSplash) {
    return (
      <CustomSplashScreen 
        onAnimationComplete={handleSplashComplete}
      />
    );
  }

  // 🏛️ ESTRUCTURA PRINCIPAL DE LA APLICACIÓN
  // Esta es la arquitectura correcta para React Navigation:
  // NavigationContainer -> AuthProvider -> AppContent
  return (
    <NavigationContainer>
      {/* 🔐 PROVEEDOR DE CONTEXTO DE AUTENTICACIÓN */}
      <AuthProvider>
        {/* 📱 CONTENIDO PRINCIPAL DE LA APP */}
        <AppContent />
        {/* ⚡ BARRA DE ESTADO */}
        <StatusBar style="auto" />
      </AuthProvider>
    </NavigationContainer>
  );
}
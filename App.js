import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';

// NavigationContainer es el contenedor raíz que envuelve toda la navegación
// Piensa en él como el marco de una casa que contiene todas las habitaciones
// Sin este contenedor, la navegación simplemente no funcionaría
export default function App() {
  return (
    // NavigationContainer maneja el estado global de navegación
    // Rastrea en qué pantalla está el usuario, mantiene el historial
    // y maneja las transiciones entre pantallas de manera fluida
    <NavigationContainer>
      {/* AppNavigator contiene toda nuestra lógica de pestañas */}
      {/* Es como conectar el sistema eléctrico a la estructura de la casa */}
      <AppNavigator />
    </NavigationContainer>
  );
}
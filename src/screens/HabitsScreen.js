import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Esta será la pantalla donde los usuarios gestionan sus hábitos personales
// Por ahora es solo un marcador de posición, pero aquí implementaremos
// el tracking de hábitos, la gamificación y las estadísticas personales
export default function HabitsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Hábitos</Text>
      <Text style={styles.subtitle}>
        Aquí trackearás tus hábitos personales y verás tu progreso
      </Text>
    </View>
  );
}

// Los estilos definen cómo se ve cada elemento en pantalla
// Es como el CSS del mundo móvil, pero con algunas diferencias importantes
const styles = StyleSheet.create({
  container: {
    flex: 1, // Ocupa todo el espacio disponible
    justifyContent: 'center', // Centra verticalmente
    alignItems: 'center', // Centra horizontalmente
    backgroundColor: '#f8f9fa', // Color de fondo suave
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
});
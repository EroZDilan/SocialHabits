import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Esta pantalla será el corazón social de tu aplicación
// Aquí los usuarios verán hábitos compartidos con amigos,
// dividirán gastos grupales, y coordinaran actividades
export default function SocialHubScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hub Social</Text>
      <Text style={styles.subtitle}>
        Conecta con amigos, comparte hábitos y divide gastos
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8f5e8', // Verde suave para representar conexión
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#2d5a3d',
    textAlign: 'center',
    lineHeight: 24,
  },
});
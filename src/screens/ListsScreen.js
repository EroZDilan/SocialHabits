import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Esta pantalla manejará todas las listas compartidas
// Los usuarios podrán crear listas de compras, recordatorios,
// y cualquier tipo de lista colaborativa con amigos
export default function ListsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Listas Compartidas</Text>
      <Text style={styles.subtitle}>
        Crea y comparte listas con tus amigos en tiempo real
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff3e0', // Naranja suave para actividad
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#8d5524',
    textAlign: 'center',
    lineHeight: 24,
  },
});
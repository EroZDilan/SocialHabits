import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Importamos nuestras cuatro pantallas principales
import HabitsScreen from '../screens/HabitsScreen';
import SocialHubScreen from '../screens/SocialHubScreen';
import ListsScreen from '../screens/ListsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: '#95a5a6',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#ecf0f1',
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tab.Screen 
        name="Habits" 
        component={HabitsScreen}
        options={{
          tabBarLabel: 'Mis Hábitos',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20, textAlign: 'center' }}>🎯</Text>
          ),
        }}
      />
      
      <Tab.Screen 
        name="SocialHub" 
        component={SocialHubScreen}
        options={{
          tabBarLabel: 'Social',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20, textAlign: 'center' }}>👥</Text>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Lists" 
        component={ListsScreen}
        options={{
          tabBarLabel: 'Listas',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20, textAlign: 'center' }}>📝</Text>
          ),
        }}
      />

      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20, textAlign: 'center' }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
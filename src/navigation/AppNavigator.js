import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

// Importamos nuestras cinco pantallas principales
import HabitsScreen from '../screens/HabitsScreen';
import SocialHubScreen from '../screens/SocialHubScreen';
import ListsScreen from '../screens/ListsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  // Accedemos al conteo de notificaciones no leídas
  const { unreadNotificationsCount } = useAuth();

  // Componente para mostrar badge de notificaciones no leídas
  const NotificationsBadge = ({ color }) => (
    <View style={{ position: 'relative' }}>
      <Text style={{ color, fontSize: 20, textAlign: 'center' }}>🔔</Text>
      {unreadNotificationsCount > 0 && (
        <View style={{
          position: 'absolute',
          top: -5,
          right: -8,
          backgroundColor: '#e74c3c',
          borderRadius: 10,
          minWidth: 20,
          height: 20,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: '#ffffff',
        }}>
          <Text style={{
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 'bold',
            paddingHorizontal: 4,
          }}>
            {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
          </Text>
        </View>
      )}
    </View>
  );

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
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Notificaciones',
          tabBarIcon: ({ color }) => <NotificationsBadge color={color} />,
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